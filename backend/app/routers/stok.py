from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.stok import (StokKarti, StokSeriNo, StokMaliyetKalemi,
                              MALIYET_TIP_SUTUN_ESLEME, StokDurum)
from app.schemas.stok import (StokKartiOlusturIstegi, StokKartiYanit,
                               StokSeriNoYanit, StokDurumGuncelleIstegi,
                               MaliyetKalemiEkleIstegi, KarRaporuYanit, StokSatisIstegi,
                               StokMaliyetKalemiYanit, TopluDurumGuncelleIstegi,
                               StokSeriNoDuzenleIstegi)
from app.services.para_hareketi import para_hareketi_olustur
from pydantic import BaseModel

router = APIRouter(tags=["Stok"])


class SatisCekBaglaIstegi(BaseModel):
    cek_id: int


@router.post("/stok-kartlari", response_model=StokKartiYanit,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_karti_olustur(
    istek: StokKartiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    yeni = StokKarti(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.put("/stok-kartlari/{stok_karti_id}", response_model=StokKartiYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_karti_guncelle(
    stok_karti_id: int,
    istek: StokKartiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kart = db.get(StokKarti, stok_karti_id)
    if kart is None or kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stok kartı bulunamadı.")
    for alan, deger in istek.model_dump().items():
        setattr(kart, alan, deger)
    db.commit()
    db.refresh(kart)
    return kart


@router.delete("/stok-kartlari/{stok_karti_id}",
               dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_karti_sil(
    stok_karti_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kart = db.get(StokKarti, stok_karti_id)
    if kart is None or kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stok kartı bulunamadı.")
    try:
        db.delete(kart)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu stok kartı sipariş veya stok kayıtlarında kullanıldığı için silinemiyor."
        )
    return {"silindi": True}


@router.get("/stok-kartlari", response_model=list[StokKartiYanit],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def stok_kartlarini_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(StokKarti).where(StokKarti.sirket_id == sirket_id)
    return list(db.execute(sorgu).scalars())


@router.get("/stok-seri-no", response_model=list[StokSeriNoYanit],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def stok_seri_no_listele(
    durum: StokDurum | None = None,
    stok_karti_id: int | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(StokSeriNo).where(StokSeriNo.sirket_id == sirket_id)
    if durum:
        sorgu = sorgu.where(StokSeriNo.durum == durum)
    if stok_karti_id:
        sorgu = sorgu.where(StokSeriNo.stok_karti_id == stok_karti_id)
    return list(db.execute(sorgu).scalars())


def _seri_no_getir_veya_404(db: Session, seri_id: int, sirket_id: int) -> StokSeriNo:
    kayit = db.get(StokSeriNo, seri_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seri numaralı stok kaydı bulunamadı.")
    return kayit


@router.get("/stok-seri-no/{seri_id}", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def stok_seri_no_getir(
    seri_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    return _seri_no_getir_veya_404(db, seri_id, sirket_id)


@router.put("/stok-seri-no/toplu-durum-guncelle", response_model=list[StokSeriNoYanit],
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_toplu_durum_guncelle(
    istek: TopluDurumGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Birden fazla urunun (seri no) durumunu TEK SEFERDE gunceller
    (orn. gumrukten cikan 10 urunu birden 'Depoda' yapmak icin).
    SATILDI durumu buradan YAPILAMAZ - odeme/kasa-banka takibinin dogru
    islenmesi icin satislar tek tek "Satis yap" akisiyla yapilmalidir.
    """
    if istek.durum == StokDurum.SATILDI:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Toplu satış desteklenmiyor. Ödeme takibi için ürünleri tek tek 'Satış yap' ile işleyin."
        )
    if not istek.stok_seri_no_idleri:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "En az bir ürün seçmelisiniz.")

    guncellenenler = []
    for seri_id in istek.stok_seri_no_idleri:
        kayit = db.get(StokSeriNo, seri_id)
        if kayit is None or kayit.sirket_id != sirket_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Ürün bulunamadı (ID={seri_id}).")
        kayit.durum = istek.durum
        guncellenenler.append(kayit)

    db.commit()
    for k in guncellenenler:
        db.refresh(k)
    return guncellenenler


@router.put("/stok-seri-no/{seri_id}", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_seri_no_duzenle(
    seri_id: int,
    istek: StokSeriNoDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Bir urunun seri numarasini veya hangi urun tanimina (stok karti) ait oldugunu duzeltir."""
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)

    yeni_kart = db.get(StokKarti, istek.stok_karti_id)
    if yeni_kart is None or yeni_kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ürün tanımı bulunamadı.")

    kayit.seri_no = istek.seri_no
    kayit.stok_karti_id = istek.stok_karti_id
    db.commit()
    db.refresh(kayit)
    return kayit


@router.delete("/stok-seri-no/{seri_id}",
               dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_seri_no_sil(
    seri_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Bir urun kaydini siler. Satis gecmisini korumak icin SATILDI durumundaki
    urunler silinemez - once (varsa) ilgili satis kaydi incelenmelidir.
    Bagli maliyet kalemleri de birlikte silinir.
    """
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    if kayit.durum == StokDurum.SATILDI:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Satılmış bir ürün silinemez (satış geçmişi korunur)."
        )

    for kalem in list(db.execute(
        select(StokMaliyetKalemi).where(StokMaliyetKalemi.stok_seri_no_id == seri_id)
    ).scalars()):
        db.delete(kalem)

    db.delete(kayit)
    db.commit()
    return {"silindi": True}


@router.put("/stok-seri-no/{seri_id}/durum", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_durum_guncelle(
    seri_id: int,
    istek: StokDurumGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)

    if istek.durum == StokDurum.SATILDI and istek.musteri_cari_id is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Durum SATILDI yapılırken musteri_cari_id belirtilmelidir."
        )

    kayit.durum = istek.durum
    if istek.musteri_cari_id is not None:
        kayit.musteri_cari_id = istek.musteri_cari_id
    if istek.satis_fiyati_try is not None:
        kayit.satis_fiyati_try = istek.satis_fiyati_try
    if istek.satis_tarihi is not None:
        kayit.satis_tarihi = istek.satis_tarihi

    db.commit()
    db.refresh(kayit)
    return kayit


@router.post("/stok-seri-no/{seri_id}/satis", response_model=StokSeriNoYanit,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_satisi_yap(
    seri_id: int,
    istek: StokSatisIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Depoda veya antrepoda olan bir urunu PESIN satar: durumu SATILDI yapar
    ve satis tutarini es zamanli olarak Kasa/Banka'ya (GIRIS) yansitir.
    Vadeli/taksitli satislar icin Finansal Takip > Taksitli Satis kullanilmalidir.
    """
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    if kayit.durum == StokDurum.SATILDI:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu ürün zaten satılmış.")

    kayit.durum = StokDurum.SATILDI
    kayit.musteri_cari_id = istek.musteri_cari_id
    kayit.satis_fiyati_try = istek.satis_fiyati_try
    kayit.satis_tarihi = istek.satis_tarihi

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "GIRIS", istek.satis_fiyati_try,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"Stok satışı - Seri No {kayit.seri_no}",
        kaynak_tablo="STOK_SATIS", kaynak_id=kayit.id, cari_id=istek.musteri_cari_id,
    )

    db.commit()
    db.refresh(kayit)
    return kayit


@router.get("/stok-seri-no/{seri_id}/maliyet-kalemleri", response_model=list[StokMaliyetKalemiYanit],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def maliyet_kalemlerini_listele(
    seri_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Bir urune eklenmis tum maliyet faturalarini (nakliye, gumruk, antrepo vb.) tarih sirasiyla doner."""
    _seri_no_getir_veya_404(db, seri_id, sirket_id)
    sorgu = (
        select(StokMaliyetKalemi)
        .where(StokMaliyetKalemi.stok_seri_no_id == seri_id)
        .order_by(StokMaliyetKalemi.tarih.desc())
    )
    return list(db.execute(sorgu).scalars())


@router.post("/stok-seri-no/{seri_id}/maliyet-kalemi", response_model=StokSeriNoYanit,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def maliyet_kalemi_ekle(
    seri_id: int,
    istek: MaliyetKalemiEkleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Yeni bir maliyet faturasi/kalemi ekler (nakliye, gumruk, antrepo, vb.).
    Detay kayit stok_maliyet_kalemleri'ne dusuyor, ozet sutun da
    (orn. nakliye_maliyeti_try) ayni anda guncelleniyor; PDF/rapor
    ekranlari ozet sutunu okuyarak hizli calisir, detay sutun da
    fatura bazinda izlenebilirlik saglar.
    """
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)

    tutar_try = istek.tutar * istek.kur
    yeni_kalem = StokMaliyetKalemi(
        stok_seri_no_id=seri_id,
        tip=istek.tip,
        aciklama=istek.aciklama,
        tedarikci_cari_id=istek.tedarikci_cari_id,
        para_birimi=istek.para_birimi,
        tutar=istek.tutar,
        kur=istek.kur,
        tutar_try=tutar_try,
        belge_no=istek.belge_no,
        tarih=istek.tarih,
    )
    db.add(yeni_kalem)

    ozet_sutun = MALIYET_TIP_SUTUN_ESLEME[istek.tip]
    mevcut_deger = getattr(kayit, ozet_sutun) or 0
    setattr(kayit, ozet_sutun, mevcut_deger + tutar_try)

    db.commit()
    db.refresh(kayit)
    return kayit


@router.put("/stok-seri-no/{seri_id}/satis-cek-baglantisi", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_satis_cek_baglantisi_kur(
    seri_id: int,
    istek: SatisCekBaglaIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Cek ile yapilan bir satista, olusturulan cekin ID'sini urune baglar.
    Boylece daha sonra bu satis geri alinmak istendiginde hangi cekin de
    birlikte silinmesi/iptal edilmesi gerektigi bilinir. SatisYapSayfasi,
    cek olusturulduktan HEMEN SONRA bu uc noktayi cagirir.
    """
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    kayit.satis_cek_id = istek.cek_id
    db.commit()
    db.refresh(kayit)
    return kayit


@router.put("/stok-seri-no/{seri_id}/satisi-geri-al", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_satisini_geri_al(
    seri_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Bir satisi geri alir - pesin (Nakit/Havale/Kart), cek veya taksitli
    (urun uzerinden degil, Taksitli Satis Plani silinerek) satislar icin
    calisir:
      - Pesin satis: olusan Kasa/Banka hareketi silinir.
      - Cek ile satis: bagli cek PORTFOYDE ise cek de silinir; ciro/tahsil
        edilmisse reddedilir (once Finansal Takip -> Cek'ten durumu geri alin).
    Urun her durumda DEPODA'ya doner, satis bilgileri temizlenir.
    """
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    if kayit.durum != StokDurum.SATILDI:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu ürün zaten satılmış durumda değil.")

    from app.models.banka import KasaHareketi, BankaHareketi
    from app.models.finansal import Cek, CekGecmis, CekDurum

    kasa_kayitlari = list(db.execute(
        select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "STOK_SATIS", KasaHareketi.kaynak_id == seri_id)
    ).scalars())
    banka_kayitlari = list(db.execute(
        select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "STOK_SATIS", BankaHareketi.kaynak_id == seri_id)
    ).scalars())

    if kayit.satis_cek_id is not None:
        cek = db.get(Cek, kayit.satis_cek_id)
        if cek is not None:
            if cek.durum != CekDurum.PORTFOYDE:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Bu satışa bağlı çek zaten ciro edilmiş/tahsil edilmiş; önce Finansal Takip → Çek'ten "
                    "durumu geri alın, sonra tekrar deneyin."
                )
            for g in list(db.execute(select(CekGecmis).where(CekGecmis.cek_id == cek.id)).scalars()):
                db.delete(g)
            db.delete(cek)
    elif not kasa_kayitlari and not banka_kayitlari:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu ürün peşin satış yoluyla satılmamış (muhtemelen taksitli satıldı). "
            "Taksitli satışlar için Finansal Takip → Taksitli Satış'tan planı silin; "
            "bu, ürünü otomatik olarak geri döndürür."
        )

    for h in kasa_kayitlari:
        db.delete(h)
    for h in banka_kayitlari:
        db.delete(h)

    kayit.durum = StokDurum.DEPODA
    kayit.musteri_cari_id = None
    kayit.satis_fiyati_try = None
    kayit.satis_tarihi = None
    kayit.satis_cek_id = None

    db.commit()
    db.refresh(kayit)
    return kayit


@router.put("/stok-seri-no/{seri_id}/satinalma-maliyetini-duzelt", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def satinalma_maliyetini_duzelt(
    seri_id: int,
    yeni_tutar_try: float,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Bir urunun satinalma_maliyeti_try alanini dogrudan TL tutari vererek
    duzeltir. Ozellikle Teslim Al akisinda kur cevrimi yapilmadan olusmus
    (dovizli siparislerde yanlislikla ham dovizin TL sanilarak kaydedildigi)
    eski kayitlari duzeltmek icin kullanilir.
    """
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    kayit.satinalma_maliyeti_try = yeni_tutar_try
    db.commit()
    db.refresh(kayit)
    return kayit


@router.get("/stok-seri-no/{seri_id}/kar-raporu", response_model=KarRaporuYanit,
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def kar_raporu(
    seri_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    toplam = (kayit.satinalma_maliyeti_try + kayit.nakliye_maliyeti_try +
              kayit.gumruk_maliyeti_try + kayit.antrepo_maliyeti_try +
              kayit.millilestirme_maliyeti_try + kayit.leasing_maliyeti_try +
              kayit.diger_maliyet_try)
    kar_zarar = (kayit.satis_fiyati_try - toplam) if kayit.satis_fiyati_try is not None else None

    return KarRaporuYanit(
        seri_no=kayit.seri_no,
        toplam_maliyet_try=toplam,
        satis_fiyati_try=kayit.satis_fiyati_try,
        kar_zarar_try=kar_zarar,
        durum=kayit.durum,
    )


# ------------------------------------------------------- MALİYET KALEMİ DÜZENLE/SİL
@router.put("/stok-seri-no/{seri_id}/maliyet-kalemi/{kalem_id}", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def maliyet_kalemi_duzenle(
    seri_id: int,
    kalem_id: int,
    istek: MaliyetKalemiEkleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Yanlis girilmis bir maliyet kalemini duzeltir. Ozet sutun (orn.
    nakliye_maliyeti_try) once eski tutar dusulerek, sonra yeni tutar
    eklenerek guncellenir - tip degisse bile (orn. Nakliye -> Gumruk)
    dogru sutunlar etkilenir.
    """
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    kalem = db.get(StokMaliyetKalemi, kalem_id)
    if kalem is None or kalem.stok_seri_no_id != seri_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Maliyet kalemi bulunamadı.")

    eski_ozet_sutun = MALIYET_TIP_SUTUN_ESLEME[kalem.tip]
    eski_deger = getattr(kayit, eski_ozet_sutun) or 0
    setattr(kayit, eski_ozet_sutun, eski_deger - kalem.tutar_try)

    yeni_tutar_try = istek.tutar * istek.kur
    kalem.tip = istek.tip
    kalem.aciklama = istek.aciklama
    kalem.tedarikci_cari_id = istek.tedarikci_cari_id
    kalem.para_birimi = istek.para_birimi
    kalem.tutar = istek.tutar
    kalem.kur = istek.kur
    kalem.tutar_try = yeni_tutar_try
    kalem.belge_no = istek.belge_no
    kalem.tarih = istek.tarih

    yeni_ozet_sutun = MALIYET_TIP_SUTUN_ESLEME[istek.tip]
    yeni_deger = getattr(kayit, yeni_ozet_sutun) or 0
    setattr(kayit, yeni_ozet_sutun, yeni_deger + yeni_tutar_try)

    db.commit()
    db.refresh(kayit)
    return kayit


@router.delete("/stok-seri-no/{seri_id}/maliyet-kalemi/{kalem_id}", response_model=StokSeriNoYanit,
               dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def maliyet_kalemi_sil(
    seri_id: int,
    kalem_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Bir maliyet kalemini siler ve tutarini ilgili ozet sutundan geri duser."""
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    kalem = db.get(StokMaliyetKalemi, kalem_id)
    if kalem is None or kalem.stok_seri_no_id != seri_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Maliyet kalemi bulunamadı.")

    ozet_sutun = MALIYET_TIP_SUTUN_ESLEME[kalem.tip]
    mevcut_deger = getattr(kayit, ozet_sutun) or 0
    setattr(kayit, ozet_sutun, mevcut_deger - kalem.tutar_try)

    db.delete(kalem)
    db.commit()
    db.refresh(kayit)
    return kayit
