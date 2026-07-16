from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from dateutil.relativedelta import relativedelta

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.cari import CariHesap
from app.models.stok import StokSeriNo, StokKarti, StokDurum
from app.models.finansal import (
    Cek, CekGecmis, CekDurum, CekTip,
    LeasingSozlesme, LeasingOdeme, LeasingSozlesmeKalemi,
    TaksitliSatisPlani, TaksitDetay, TaksitliSatisKalemi,
    KiralamaSozlesme, KiralamaOdeme, KiralamaSozlesmeKalemi,
    BakimKaydi, BakimTip,
)
import json
from app.models.denetim import DuzenlemeKaydi
from app.core.security import sifre_dogrula
from app.schemas.finansal import (
    CekOlusturIstegi, CekDuzenleIstegi, CekYanit, CekDurumGuncelleIstegi, CekGecmisYanit,
    LeasingOlusturIstegi, LeasingYanit, LeasingOdemeYanit, OdemeTahsilIstegi,
    TaksitliSatisOlusturIstegi, TaksitliSatisYanit, TaksitDetayYanit, TaksitTahsilIstegi,
    TaksitOdemeSonucu,
    KiralamaOlusturIstegi, KiralamaYanit, KiralamaOdemeOlusturIstegi, KiralamaOdemeYanit,
    BakimOlusturIstegi, BakimYanit,
)
from app.services.para_hareketi import para_hareketi_olustur

router = APIRouter(tags=["Finansal Takip"])


# --------------------------------------------------------------- Yardımcılar
def _cari_haritasi(db: Session, sirket_id: int) -> dict:
    """cari_id -> unvan haritasi. Listelerde ID yerine isim gostermek icin kullanilir."""
    return {
        c.id: c.unvan for c in db.execute(
            select(CariHesap).where(CariHesap.sirket_id == sirket_id)
        ).scalars()
    }


def _urun_haritasi(db: Session, sirket_id: int) -> dict:
    """stok_seri_no_id -> {seri_no, urun_adi} haritasi."""
    kartlar = {
        k.id: k for k in db.execute(
            select(StokKarti).where(StokKarti.sirket_id == sirket_id)
        ).scalars()
    }
    sonuc = {}
    for u in db.execute(select(StokSeriNo).where(StokSeriNo.sirket_id == sirket_id)).scalars():
        kart = kartlar.get(u.stok_karti_id)
        sonuc[u.id] = {
            "seri_no": u.seri_no,
            "urun_adi": f"{kart.marka} {kart.model}".strip() if kart else None,
        }
    return sonuc


def _urun_bilgisi_ekle(nesne, urun_id, urun_haritasi):
    urun = urun_haritasi.get(urun_id) if urun_id else None
    nesne.urun_seri_no = urun["seri_no"] if urun else None
    nesne.urun_adi = urun["urun_adi"] if urun else None


def _degisiklikleri_kaydet(db: Session, sirket_id: int, kullanici_id: int, tablo_adi: str, kayit_id: int, degisiklikler: dict) -> None:
    if not degisiklikler:
        return
    db.add(DuzenlemeKaydi(
        sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
        kayit_id=kayit_id, degisiklikler=json.dumps(degisiklikler, ensure_ascii=False, default=str),
    ))


def _urun_tanimi_haritasi(db: Session, sirket_id: int) -> dict:
    """stok_karti_id -> 'marka model' haritasi (Leasing kalemleri gibi urun TANIMINA - seri no'suz - bagli kayitlar icin)."""
    return {
        k.id: f"{k.marka} {k.model}".strip() for k in db.execute(
            select(StokKarti).where(StokKarti.sirket_id == sirket_id)
        ).scalars()
    }


# ============================================================================ ÇEK
@router.post("/cekler", response_model=CekYanit, dependencies=[Depends(izin_gerektir("CEK_DUZENLE"))])
def cek_olustur(
    istek: CekOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    yeni = Cek(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    cari_h = _cari_haritasi(db, sirket_id)
    yeni.cari_unvan = cari_h.get(yeni.cari_id)
    return yeni


@router.put("/cekler/{cek_id}", response_model=CekYanit, dependencies=[Depends(izin_gerektir("CEK_DUZENLE"))])
def cek_duzenle(
    cek_id: int, istek: CekDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Yanlis girilmis bir cekin bilgilerini duzeltir (cek no, tutar, vade
    tarihi vb.). Sifre onayi zorunludur; degisiklikler denetim_kayitlari'na
    islenir. Zaten tahsil/ciro edilmis bir cek duzenlenemez - once
    durumu geri alinmalidir.
    """
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    cek = db.get(Cek, cek_id)
    if cek is None or cek.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Çek bulunamadı.")
    if cek.durum != CekDurum.PORTFOYDE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sadece portföyde olan bir çek düzenlenebilir.")

    alan_adlari = {
        "tip": "Tip", "cek_no": "Çek No", "banka_adi": "Banka", "cari_id": "Cari",
        "tutar": "Tutar", "para_birimi": "Para Birimi", "vade_tarihi": "Vade Tarihi",
        "alinma_verilme_tarihi": "Alınma/Verilme Tarihi", "notlar": "Notlar",
    }
    yeni_degerler = {
        "tip": istek.tip, "cek_no": istek.cek_no, "banka_adi": istek.banka_adi, "cari_id": istek.cari_id,
        "tutar": istek.tutar, "para_birimi": istek.para_birimi, "vade_tarihi": istek.vade_tarihi,
        "alinma_verilme_tarihi": istek.alinma_verilme_tarihi, "notlar": istek.notlar,
    }
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(cek, alan)
        yeni = yeni_degerler[alan]
        eski_metin = eski.value if hasattr(eski, "value") else eski
        yeni_metin = yeni.value if hasattr(yeni, "value") else yeni
        if str(eski_metin) != str(yeni_metin):
            degisiklikler[etiket] = {"eski": eski_metin, "yeni": yeni_metin}
        setattr(cek, alan, yeni)

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "cekler", cek.id, degisiklikler)

    db.commit()
    db.refresh(cek)
    cari_h = _cari_haritasi(db, sirket_id)
    cek.cari_unvan = cari_h.get(cek.cari_id)
    return cek


@router.get("/cekler", response_model=list[CekYanit], dependencies=[Depends(izin_gerektir("CEK_GORUNTULE"))])
def cekleri_listele(
    tip: str | None = None, durum: str | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(Cek).where(Cek.sirket_id == sirket_id)
    if tip:
        sorgu = sorgu.where(Cek.tip == tip)
    if durum:
        sorgu = sorgu.where(Cek.durum == durum)
    sonuclar = list(db.execute(sorgu).scalars())
    cari_h = _cari_haritasi(db, sirket_id)
    for c in sonuclar:
        c.cari_unvan = cari_h.get(c.cari_id)
    return sonuclar


@router.put("/cekler/{cek_id}/durum", response_model=CekYanit, dependencies=[Depends(izin_gerektir("CEK_DUZENLE"))])
def cek_durum_guncelle(
    cek_id: int, istek: CekDurumGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    cek = db.get(Cek, cek_id)
    if cek is None or cek.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Çek bulunamadı.")

    if istek.yeni_durum == CekDurum.CIRO_EDILDI and istek.ciro_edilen_cari_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ciro işlemi için ciro_edilen_cari_id zorunludur.")

    para_hareketi_gereken_durumlar = (CekDurum.TAHSIL_EDILDI, CekDurum.ODENDI)
    if istek.yeni_durum in para_hareketi_gereken_durumlar and not istek.odeme_yontemi:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu durum güncellemesi için odeme_yontemi ('NAKIT' veya 'BANKA') zorunludur."
        )

    eski_durum = cek.durum
    cek.durum = istek.yeni_durum
    if istek.ciro_edilen_cari_id is not None:
        cek.ciro_edilen_cari_id = istek.ciro_edilen_cari_id
        from datetime import date
        cek.ciro_tarihi = date.today()

    if istek.yeni_durum in para_hareketi_gereken_durumlar:
        yon = "GIRIS" if cek.tip == CekTip.ALINAN else "CIKIS"
        para_hareketi_olustur(
            db, sirket_id, kullanici.id, yon, cek.tutar,
            istek.odeme_yontemi, istek.banka_hesap_id,
            aciklama=f"Çek {cek.cek_no or ('#' + str(cek.id))} - {istek.yeni_durum.value}",
            kaynak_tablo="CEKLER", kaynak_id=cek.id, cari_id=cek.cari_id,
            para_birimi=cek.para_birimi.value, kur=istek.kur,
        )

    db.add(CekGecmis(
        cek_id=cek.id, tarih=cek.ciro_tarihi or cek.alinma_verilme_tarihi,
        eski_durum=eski_durum, yeni_durum=istek.yeni_durum,
        aciklama=istek.aciklama, olusturan_kullanici_id=kullanici.id,
    ))
    db.commit()
    db.refresh(cek)
    cari_h = _cari_haritasi(db, sirket_id)
    cek.cari_unvan = cari_h.get(cek.cari_id)
    return cek


@router.get("/cekler/{cek_id}/gecmis", response_model=list[CekGecmisYanit],
            dependencies=[Depends(izin_gerektir("CEK_GORUNTULE"))])
def cek_gecmisi(cek_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    cek = db.get(Cek, cek_id)
    if cek is None or cek.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Çek bulunamadı.")
    sorgu = select(CekGecmis).where(CekGecmis.cek_id == cek_id).order_by(CekGecmis.id)
    return list(db.execute(sorgu).scalars())


# ========================================================================= LEASING
@router.post("/leasing-sozlesmeleri", response_model=LeasingYanit,
             dependencies=[Depends(izin_gerektir("LEASING_DUZENLE"))])
def leasing_olustur(
    istek: LeasingOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    if not istek.kalemler:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "En az bir ürün kalemi eklemelisiniz.")

    toplam_tutar = sum((k.miktar * k.birim_fiyat for k in istek.kalemler), Decimal("0"))

    yeni = LeasingSozlesme(
        sirket_id=sirket_id,
        leasing_firmasi_cari_id=istek.leasing_firmasi_cari_id,
        sozlesme_no=istek.sozlesme_no,
        baslangic_tarihi=istek.baslangic_tarihi,
        toplam_tutar=toplam_tutar,
        para_birimi=istek.para_birimi,
        taksit_sayisi=istek.taksit_sayisi,
        notlar=istek.notlar,
    )
    db.add(yeni)
    db.flush()

    for k in istek.kalemler:
        db.add(LeasingSozlesmeKalemi(leasing_id=yeni.id, stok_karti_id=k.stok_karti_id, miktar=k.miktar, birim_fiyat=k.birim_fiyat))

    taksit_tutari = round(toplam_tutar / istek.taksit_sayisi, 2)
    for i in range(1, istek.taksit_sayisi + 1):
        vade = istek.baslangic_tarihi + relativedelta(months=i)
        tutar = taksit_tutari
        if i == istek.taksit_sayisi:
            tutar = toplam_tutar - taksit_tutari * (istek.taksit_sayisi - 1)
        db.add(LeasingOdeme(leasing_id=yeni.id, taksit_no=i, vade_tarihi=vade, tutar=tutar))

    db.commit()
    db.refresh(yeni)
    cari_h = _cari_haritasi(db, sirket_id)
    urun_tanimi_h = _urun_tanimi_haritasi(db, sirket_id)
    yeni.leasing_firmasi_unvan = cari_h.get(yeni.leasing_firmasi_cari_id)
    yeni.kalemler = list(db.execute(select(LeasingSozlesmeKalemi).where(LeasingSozlesmeKalemi.leasing_id == yeni.id)).scalars())
    for k in yeni.kalemler:
        k.urun_adi = urun_tanimi_h.get(k.stok_karti_id)
    return yeni


@router.get("/leasing-sozlesmeleri", response_model=list[LeasingYanit],
            dependencies=[Depends(izin_gerektir("LEASING_GORUNTULE"))])
def leasing_listele(sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    sorgu = select(LeasingSozlesme).where(LeasingSozlesme.sirket_id == sirket_id)
    sonuclar = list(db.execute(sorgu).scalars())
    cari_h = _cari_haritasi(db, sirket_id)
    urun_tanimi_h = _urun_tanimi_haritasi(db, sirket_id)
    for l in sonuclar:
        l.leasing_firmasi_unvan = cari_h.get(l.leasing_firmasi_cari_id)
        l.kalemler = list(db.execute(select(LeasingSozlesmeKalemi).where(LeasingSozlesmeKalemi.leasing_id == l.id)).scalars())
        for k in l.kalemler:
            k.urun_adi = urun_tanimi_h.get(k.stok_karti_id)
    return sonuclar


@router.get("/leasing-sozlesmeleri/{leasing_id}/odeme-plani", response_model=list[LeasingOdemeYanit],
            dependencies=[Depends(izin_gerektir("LEASING_GORUNTULE"))])
def leasing_odeme_plani(leasing_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    sozlesme = db.get(LeasingSozlesme, leasing_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leasing sözleşmesi bulunamadı.")
    sorgu = select(LeasingOdeme).where(LeasingOdeme.leasing_id == leasing_id).order_by(LeasingOdeme.taksit_no)
    return list(db.execute(sorgu).scalars())


@router.put("/leasing-odemeleri/{odeme_id}/ode", response_model=LeasingOdemeYanit,
            dependencies=[Depends(izin_gerektir("LEASING_DUZENLE"))])
def leasing_odeme_yap(
    odeme_id: int, istek: OdemeTahsilIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    odeme = db.get(LeasingOdeme, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    sozlesme = db.get(LeasingSozlesme, odeme.leasing_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")

    odeme.odendi_mi = True
    odeme.odeme_tarihi = istek.odeme_tarihi

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "CIKIS", odeme.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"Leasing {sozlesme.sozlesme_no or ''} - Taksit {odeme.taksit_no}",
        kaynak_tablo="LEASING_ODEME", kaynak_id=odeme.id,
        cari_id=sozlesme.leasing_firmasi_cari_id,
        para_birimi=sozlesme.para_birimi.value, kur=istek.kur,
    )

    db.commit()
    db.refresh(odeme)
    return odeme


# =================================================================== TAKSİTLİ SATIŞ
@router.post("/taksitli-satis-planlari", response_model=TaksitliSatisYanit,
             dependencies=[Depends(izin_gerektir("TAKSIT_DUZENLE"))])
def taksitli_satis_olustur(
    istek: TaksitliSatisOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    NOT: Birden fazla urun turu (kalem) icerebilen planlarda, hangi
    SPESIFIK seri numarali fiziksel birimin satildigi otomatik olarak
    isaretlenmez (coklu urun turu oldugunda hangi birimin kime gittigi
    belirsizdir). Satilan spesifik birimlerin durumunu Stok sayfasindan
    "Durum Degistir" ile ayrica SATILDI yapmaniz gerekir.
    """
    if not istek.kalemler:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "En az bir ürün kalemi eklemelisiniz.")

    toplam_tutar = sum((k.miktar * k.birim_fiyat for k in istek.kalemler), Decimal("0"))

    yeni = TaksitliSatisPlani(
        sirket_id=sirket_id,
        musteri_cari_id=istek.musteri_cari_id,
        toplam_tutar=toplam_tutar,
        para_birimi=istek.para_birimi,
        pesinat=istek.pesinat,
        taksit_sayisi=istek.taksit_sayisi,
        baslangic_tarihi=istek.baslangic_tarihi,
        notlar=istek.notlar,
    )
    db.add(yeni)
    db.flush()

    for k in istek.kalemler:
        db.add(TaksitliSatisKalemi(plan_id=yeni.id, stok_karti_id=k.stok_karti_id, miktar=k.miktar, birim_fiyat=k.birim_fiyat))

    kalan = toplam_tutar - istek.pesinat
    taksit_tutari = round(kalan / istek.taksit_sayisi, 2)
    for i in range(1, istek.taksit_sayisi + 1):
        vade = istek.baslangic_tarihi + relativedelta(months=i)
        tutar = taksit_tutari
        if i == istek.taksit_sayisi:
            tutar = kalan - taksit_tutari * (istek.taksit_sayisi - 1)
        db.add(TaksitDetay(plan_id=yeni.id, taksit_no=i, vade_tarihi=vade, tutar=tutar))

    db.commit()
    db.refresh(yeni)
    cari_h = _cari_haritasi(db, sirket_id)
    urun_tanimi_h = _urun_tanimi_haritasi(db, sirket_id)
    yeni.musteri_unvan = cari_h.get(yeni.musteri_cari_id)
    yeni.kalemler = list(db.execute(select(TaksitliSatisKalemi).where(TaksitliSatisKalemi.plan_id == yeni.id)).scalars())
    for k in yeni.kalemler:
        k.urun_adi = urun_tanimi_h.get(k.stok_karti_id)
    return yeni


@router.get("/taksitli-satis-planlari/{plan_id}/taksitler", response_model=list[TaksitDetayYanit],
            dependencies=[Depends(izin_gerektir("TAKSIT_GORUNTULE"))])
def taksitleri_listele(plan_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    plan = db.get(TaksitliSatisPlani, plan_id)
    if plan is None or plan.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit planı bulunamadı.")
    sorgu = select(TaksitDetay).where(TaksitDetay.plan_id == plan_id).order_by(TaksitDetay.taksit_no)
    return list(db.execute(sorgu).scalars())


@router.put("/taksit-detay/{taksit_id}/tahsil-et", response_model=TaksitOdemeSonucu,
            dependencies=[Depends(izin_gerektir("TAKSIT_DUZENLE"))])
def taksit_tahsil_et(
    taksit_id: int, istek: TaksitTahsilIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Bir taksidi tahsil eder. istek.tutar verilmezse taksidin KALAN tam
    bakiyesi tahsil edilir (eski davranisla ayni). istek.tutar verilirse:
      - Kalan bakiyeden AZ ise: taksit "kismen odendi" durumunda kalir
        (odendi_mi=False, odenen_tutar artar) - kalan bakiye ekranda gorunur.
      - Kalan bakiyeden FAZLA ise: bu taksit tamamen kapanir ve artan kisim
        SIRADAKI odenmemis taksit(ler)e otomatik olarak uygulanir (musterinin
        "kalan tum borcumu kapatiyorum" gibi tek seferlik buyuk odemeleri icin).
    Tek bir Kasa/Banka hareketi, GERCEKTEN o an tahsil edilen toplam tutar
    icin olusturulur (birden fazla taksidi kapatsa bile TEK hareket).
    """
    taksit = db.get(TaksitDetay, taksit_id)
    if taksit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    plan = db.get(TaksitliSatisPlani, taksit.plan_id)
    if plan is None or plan.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    if taksit.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu taksit zaten tamamen tahsil edilmiş.")

    kalan_bakiye = taksit.tutar - taksit.odenen_tutar
    tahsil_edilecek_toplam = istek.tutar if istek.tutar is not None else kalan_bakiye
    if tahsil_edilecek_toplam <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tahsilat tutarı sıfırdan büyük olmalıdır.")

    # Bu plana ait, tarih sirasina gore odenmemis TUM taksitleri getir - once
    # secilen taksit, sonra planin sirali diger taksitleri (fazla odemenin
    # otomatik yansitilacagi taksitler).
    diger_odenmemis_taksitler = list(db.execute(
        select(TaksitDetay)
        .where(TaksitDetay.plan_id == plan.id, TaksitDetay.odendi_mi.is_(False), TaksitDetay.id != taksit.id)
        .order_by(TaksitDetay.taksit_no)
    ).scalars())
    islenecek_taksitler = [taksit] + diger_odenmemis_taksitler

    kalan_dagitilacak = tahsil_edilecek_toplam
    guncellenen: list[TaksitDetay] = []
    for t in islenecek_taksitler:
        if kalan_dagitilacak <= 0:
            break
        t_kalan_bakiye = t.tutar - t.odenen_tutar
        if t_kalan_bakiye <= 0:
            continue
        bu_taksite_uygulanan = min(kalan_dagitilacak, t_kalan_bakiye)
        t.odenen_tutar += bu_taksite_uygulanan
        kalan_dagitilacak -= bu_taksite_uygulanan
        if t.odenen_tutar >= t.tutar:
            t.odendi_mi = True
            t.odeme_tarihi = istek.odeme_tarihi
            t.tahsilat_kaynak_tablo = istek.tahsilat_kaynak_tablo
            t.tahsilat_kaynak_id = istek.tahsilat_kaynak_id
        if t.id != taksit.id:
            t.ilk_taksit_id = taksit.id  # bu taksit, asil odemenin yapildigi taksidin ID'sini tasir
        guncellenen.append(t)

    # kalan_dagitilacak hala pozitifse: butun taksitler kapandi ama musteri
    # daha da fazla odedi - bu gercek bir fazla odemedir, hicbir yere
    # yazilmaz, sadece kullaniciya bilgi olarak donulur (Kasa/Banka'ya sadece
    # gercekten taksitlere uygulanan kisim islenir).
    gercekten_islenen_tutar = tahsil_edilecek_toplam - kalan_dagitilacak

    musteri = db.get(CariHesap, plan.musteri_cari_id)
    plan_kalemleri = list(db.execute(select(TaksitliSatisKalemi).where(TaksitliSatisKalemi.plan_id == plan.id)).scalars())
    urun_tanimi_h = _urun_tanimi_haritasi(db, sirket_id)
    urun_parcasi = ""
    if plan_kalemleri:
        urun_parcasi = " - " + ", ".join(f"{k.miktar}x {urun_tanimi_h.get(k.stok_karti_id, '')}" for k in plan_kalemleri)
    if len(guncellenen) > 1:
        taksit_no_araligi = f"{guncellenen[0].taksit_no}-{guncellenen[-1].taksit_no}"
        aciklama = f"Taksit {taksit_no_araligi} - {musteri.unvan if musteri else ''}{urun_parcasi}"
    else:
        aciklama = f"Taksit {taksit.taksit_no} - {musteri.unvan if musteri else ''}{urun_parcasi}"

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "GIRIS", gercekten_islenen_tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=aciklama,
        kaynak_tablo="TAKSIT_DETAY", kaynak_id=taksit.id,
        cari_id=plan.musteri_cari_id,
        para_birimi=plan.para_birimi.value, kur=istek.kur,
    )

    db.commit()
    for t in guncellenen:
        db.refresh(t)

    return TaksitOdemeSonucu(
        guncellenen_taksitler=guncellenen,
        fazla_odeme_var_mi=kalan_dagitilacak > 0,
        fazla_odeme_tutari=kalan_dagitilacak,
    )


@router.get("/taksitler/vadesi-gecenler", response_model=list[TaksitDetayYanit],
            dependencies=[Depends(izin_gerektir("TAKSIT_GORUNTULE"))])
def vadesi_gecen_taksitler(sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    from datetime import date
    sorgu = (
        select(TaksitDetay)
        .join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitDetay.plan_id)
        .where(
            TaksitliSatisPlani.sirket_id == sirket_id,
            TaksitDetay.odendi_mi.is_(False),
            TaksitDetay.vade_tarihi < date.today(),
        )
    )
    sonuclar = list(db.execute(sorgu).scalars())

    plan_idleri = {t.plan_id for t in sonuclar}
    planlar = {
        p.id: p for p in db.execute(
            select(TaksitliSatisPlani).where(TaksitliSatisPlani.id.in_(plan_idleri))
        ).scalars()
    } if plan_idleri else {}

    cari_h = _cari_haritasi(db, sirket_id)
    urun_h = _urun_haritasi(db, sirket_id)
    for t in sonuclar:
        plan = planlar.get(t.plan_id)
        t.musteri_unvan = cari_h.get(plan.musteri_cari_id) if plan else None
        urun = urun_h.get(plan.stok_seri_no_id) if plan and plan.stok_seri_no_id else None
        t.urun_seri_no = urun["seri_no"] if urun else None
    return sonuclar


# ===================================================================== KİRALAMA
@router.post("/kiralama-sozlesmeleri", response_model=KiralamaYanit,
             dependencies=[Depends(izin_gerektir("KIRALAMA_DUZENLE"))])
def kiralama_olustur(
    istek: KiralamaOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    if not istek.kalemler:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "En az bir ürün kalemi eklemelisiniz.")

    aylik_kira_tutari = sum((k.miktar * k.birim_fiyat for k in istek.kalemler), Decimal("0"))

    yeni = KiralamaSozlesme(
        sirket_id=sirket_id,
        kiraci_cari_id=istek.kiraci_cari_id,
        baslangic_tarihi=istek.baslangic_tarihi,
        bitis_tarihi=istek.bitis_tarihi,
        aylik_kira_tutari=aylik_kira_tutari,
        para_birimi=istek.para_birimi,
        depozito=istek.depozito,
        notlar=istek.notlar,
    )
    db.add(yeni)
    db.flush()

    for k in istek.kalemler:
        db.add(KiralamaSozlesmeKalemi(sozlesme_id=yeni.id, stok_karti_id=k.stok_karti_id, miktar=k.miktar, birim_fiyat=k.birim_fiyat))

    db.commit()
    db.refresh(yeni)
    cari_h = _cari_haritasi(db, sirket_id)
    urun_tanimi_h = _urun_tanimi_haritasi(db, sirket_id)
    yeni.kiraci_unvan = cari_h.get(yeni.kiraci_cari_id)
    yeni.kalemler = list(db.execute(select(KiralamaSozlesmeKalemi).where(KiralamaSozlesmeKalemi.sozlesme_id == yeni.id)).scalars())
    for k in yeni.kalemler:
        k.urun_adi = urun_tanimi_h.get(k.stok_karti_id)
    return yeni


@router.put("/kiralama-sozlesmeleri/{sozlesme_id}", response_model=KiralamaYanit,
            dependencies=[Depends(izin_gerektir("KIRALAMA_DUZENLE"))])
def kiralama_sozlesmesi_duzenle(
    sozlesme_id: int, istek: KiralamaDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Sozlesme sartlarini (kiraci, aylik kira tutari, para birimi vb.)
    duzenler. Sifre onayi zorunludur; degisiklikler denetim_kayitlari'na
    islenir. Bu, GECMISTE olusturulmus donem odemelerini ETKILEMEZ - her
    donem kendi tutarini tasir (donem eklerken elle girilir). Yani fiyat
    degisikligi icin yeni sozlesme acmaya veya mevcut sozlesmeyi silmeye
    GEREK YOKTUR; sadece ileride eklenecek donemlerde yeni degerler
    varsayilan/referans olarak gorunur.
    """
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    sozlesme = db.get(KiralamaSozlesme, sozlesme_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kiralama sözleşmesi bulunamadı.")
    if not istek.kalemler:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "En az bir ürün kalemi eklemelisiniz.")

    yeni_aylik_kira = sum((k.miktar * k.birim_fiyat for k in istek.kalemler), Decimal("0"))
    alan_adlari = {
        "kiraci_cari_id": "Kiracı", "baslangic_tarihi": "Başlangıç Tarihi", "bitis_tarihi": "Bitiş Tarihi",
        "para_birimi": "Para Birimi", "depozito": "Depozito", "notlar": "Notlar", "aylik_kira_tutari": "Aylık Kira Tutarı",
    }
    yeni_degerler = {
        "kiraci_cari_id": istek.kiraci_cari_id, "baslangic_tarihi": istek.baslangic_tarihi,
        "bitis_tarihi": istek.bitis_tarihi, "para_birimi": istek.para_birimi, "depozito": istek.depozito,
        "notlar": istek.notlar, "aylik_kira_tutari": yeni_aylik_kira,
    }
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(sozlesme, alan)
        yeni = yeni_degerler[alan]
        eski_metin = eski.value if hasattr(eski, "value") else eski
        yeni_metin = yeni.value if hasattr(yeni, "value") else yeni
        if str(eski_metin) != str(yeni_metin):
            degisiklikler[etiket] = {"eski": eski_metin, "yeni": yeni_metin}
        setattr(sozlesme, alan, yeni)

    eski_kalemler_ozet = ", ".join(
        f"{k.miktar}x #{k.stok_karti_id}@{k.birim_fiyat}"
        for k in db.execute(select(KiralamaSozlesmeKalemi).where(KiralamaSozlesmeKalemi.sozlesme_id == sozlesme_id)).scalars()
    )
    yeni_kalemler_ozet = ", ".join(f"{k.miktar}x #{k.stok_karti_id}@{k.birim_fiyat}" for k in istek.kalemler)
    if eski_kalemler_ozet != yeni_kalemler_ozet:
        degisiklikler["Ürün Kalemleri"] = {"eski": eski_kalemler_ozet, "yeni": yeni_kalemler_ozet}

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "kiralama_sozlesmeleri", sozlesme.id, degisiklikler)

    for eski in list(db.execute(select(KiralamaSozlesmeKalemi).where(KiralamaSozlesmeKalemi.sozlesme_id == sozlesme_id)).scalars()):
        db.delete(eski)
    db.flush()
    for k in istek.kalemler:
        db.add(KiralamaSozlesmeKalemi(sozlesme_id=sozlesme_id, stok_karti_id=k.stok_karti_id, miktar=k.miktar, birim_fiyat=k.birim_fiyat))

    db.commit()
    db.refresh(sozlesme)
    cari_h = _cari_haritasi(db, sirket_id)
    urun_tanimi_h = _urun_tanimi_haritasi(db, sirket_id)
    sozlesme.kiraci_unvan = cari_h.get(sozlesme.kiraci_cari_id)
    sozlesme.kalemler = list(db.execute(select(KiralamaSozlesmeKalemi).where(KiralamaSozlesmeKalemi.sozlesme_id == sozlesme_id)).scalars())
    for k in sozlesme.kalemler:
        k.urun_adi = urun_tanimi_h.get(k.stok_karti_id)
    return sozlesme


@router.get("/kiralama-sozlesmeleri", response_model=list[KiralamaYanit],
            dependencies=[Depends(izin_gerektir("KIRALAMA_GORUNTULE"))])
def kiralamalari_listele(
    durum: str | None = None, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(KiralamaSozlesme).where(KiralamaSozlesme.sirket_id == sirket_id)
    if durum:
        sorgu = sorgu.where(KiralamaSozlesme.durum == durum)
    sonuclar = list(db.execute(sorgu).scalars())
    cari_h = _cari_haritasi(db, sirket_id)
    urun_tanimi_h = _urun_tanimi_haritasi(db, sirket_id)
    for k in sonuclar:
        k.kiraci_unvan = cari_h.get(k.kiraci_cari_id)
        k.kalemler = list(db.execute(select(KiralamaSozlesmeKalemi).where(KiralamaSozlesmeKalemi.sozlesme_id == k.id)).scalars())
        for kk in k.kalemler:
            kk.urun_adi = urun_tanimi_h.get(kk.stok_karti_id)
    return sonuclar


@router.post("/kiralama-sozlesmeleri/{sozlesme_id}/odemeler", response_model=KiralamaOdemeYanit,
             dependencies=[Depends(izin_gerektir("KIRALAMA_DUZENLE"))])
def kiralama_odemesi_ekle(
    sozlesme_id: int, istek: KiralamaOdemeOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sozlesme = db.get(KiralamaSozlesme, sozlesme_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kiralama sözleşmesi bulunamadı.")
    yeni = KiralamaOdeme(sozlesme_id=sozlesme_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/kiralama-sozlesmeleri/{sozlesme_id}/odemeler", response_model=list[KiralamaOdemeYanit],
            dependencies=[Depends(izin_gerektir("KIRALAMA_GORUNTULE"))])
def kiralama_odemelerini_listele(
    sozlesme_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sozlesme = db.get(KiralamaSozlesme, sozlesme_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kiralama sözleşmesi bulunamadı.")
    sorgu = select(KiralamaOdeme).where(KiralamaOdeme.sozlesme_id == sozlesme_id).order_by(KiralamaOdeme.donem_basi)
    return list(db.execute(sorgu).scalars())


@router.put("/kiralama-odemeleri/{odeme_id}/tahsil-et", response_model=KiralamaOdemeYanit,
            dependencies=[Depends(izin_gerektir("KIRALAMA_DUZENLE"))])
def kiralama_odemesi_tahsil_et(
    odeme_id: int, istek: OdemeTahsilIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    odeme = db.get(KiralamaOdeme, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    sozlesme = db.get(KiralamaSozlesme, odeme.sozlesme_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")

    odeme.odendi_mi = True
    odeme.odeme_tarihi = istek.odeme_tarihi

    sozlesme_kalemleri = list(db.execute(select(KiralamaSozlesmeKalemi).where(KiralamaSozlesmeKalemi.sozlesme_id == sozlesme.id)).scalars())
    urun_tanimi_h = _urun_tanimi_haritasi(db, sirket_id)
    urun_parcasi = ""
    if sozlesme_kalemleri:
        urun_parcasi = ", ".join(f"{k.miktar}x {urun_tanimi_h.get(k.stok_karti_id, '')}" for k in sozlesme_kalemleri) + " - "
    aciklama = f"Kiralama - {urun_parcasi}{odeme.donem_basi} - {odeme.donem_sonu}"

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "GIRIS", odeme.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=aciklama,
        kaynak_tablo="KIRALAMA_ODEME", kaynak_id=odeme.id,
        cari_id=sozlesme.kiraci_cari_id,
        para_birimi=sozlesme.para_birimi.value, kur=istek.kur,
    )

    db.commit()
    db.refresh(odeme)
    return odeme


# ========================================================================= BAKIM
@router.post("/bakim-kayitlari", response_model=BakimYanit, dependencies=[Depends(izin_gerektir("BAKIM_DUZENLE"))])
def bakim_kaydi_olustur(
    istek: BakimOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    veri = istek.model_dump(exclude={"odeme_yontemi", "banka_hesap_id", "kur"})
    yeni = BakimKaydi(sirket_id=sirket_id, odendi_tahsil_edildi_mi=True, **veri)
    db.add(yeni)
    db.flush()

    yon = "GIRIS" if istek.tip == BakimTip.GELIR else "CIKIS"
    para_hareketi_olustur(
        db, sirket_id, kullanici.id, yon, istek.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=istek.aciklama or f"Bakım {istek.tip.value}",
        kaynak_tablo="BAKIM_KAYDI", kaynak_id=yeni.id, cari_id=istek.ilgili_cari_id,
        para_birimi=istek.para_birimi.value, kur=istek.kur,
    )

    db.commit()
    db.refresh(yeni)
    cari_h = _cari_haritasi(db, sirket_id)
    urun_h = _urun_haritasi(db, sirket_id)
    yeni.ilgili_cari_unvan = cari_h.get(yeni.ilgili_cari_id)
    _urun_bilgisi_ekle(yeni, yeni.stok_seri_no_id, urun_h)
    return yeni


@router.get("/bakim-kayitlari", response_model=list[BakimYanit], dependencies=[Depends(izin_gerektir("BAKIM_GORUNTULE"))])
def bakim_kayitlarini_listele(
    stok_seri_no_id: int | None = None, tip: str | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(BakimKaydi).where(BakimKaydi.sirket_id == sirket_id)
    if stok_seri_no_id:
        sorgu = sorgu.where(BakimKaydi.stok_seri_no_id == stok_seri_no_id)
    if tip:
        sorgu = sorgu.where(BakimKaydi.tip == tip)
    sonuclar = list(db.execute(sorgu).scalars())
    cari_h = _cari_haritasi(db, sirket_id)
    urun_h = _urun_haritasi(db, sirket_id)
    for b in sonuclar:
        b.ilgili_cari_unvan = cari_h.get(b.ilgili_cari_id)
        _urun_bilgisi_ekle(b, b.stok_seri_no_id, urun_h)
    return sonuclar


# ============================================================================ ÇEK - SİL
@router.delete("/cekler/{cek_id}", dependencies=[Depends(izin_gerektir("CEK_DUZENLE"))])
def cek_sil(cek_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    """
    Sadece 'Portfoyde' durumundaki cekler silinebilir. Eger bu cek bir Stok
    satisina baglanmissa (SatisYapSayfasi -> Cek akisi), ilgili urun de
    otomatik olarak DEPODA durumuna dondurulur - aksi halde urun "Satildi"
    isaretli kalir ama artik hicbir kaydi (ne cek ne kasa/banka) olmaz.
    """
    cek = db.get(Cek, cek_id)
    if cek is None or cek.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Çek bulunamadı.")
    if cek.durum != CekDurum.PORTFOYDE:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Sadece 'Portföyde' durumundaki çekler silinebilir (ciro/tahsil edilmiş çeklerin geçmişi korunur)."
        )
    for gecmis in list(db.execute(select(CekGecmis).where(CekGecmis.cek_id == cek_id)).scalars()):
        db.delete(gecmis)

    baglantili_urunler = list(db.execute(
        select(StokSeriNo).where(StokSeriNo.satis_cek_id == cek_id)
    ).scalars())
    for urun in baglantili_urunler:
        if urun.durum == StokDurum.SATILDI:
            urun.durum = StokDurum.DEPODA
            urun.musteri_cari_id = None
            urun.satis_fiyati_try = None
            urun.satis_tarihi = None
        urun.satis_cek_id = None

    db.delete(cek)
    db.commit()
    return {"silindi": True}


# ========================================================================= LEASING - SİL
@router.delete("/leasing-sozlesmeleri/{leasing_id}", dependencies=[Depends(izin_gerektir("LEASING_DUZENLE"))])
def leasing_sil(leasing_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    sozlesme = db.get(LeasingSozlesme, leasing_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leasing sözleşmesi bulunamadı.")
    odemeler = list(db.execute(select(LeasingOdeme).where(LeasingOdeme.leasing_id == leasing_id)).scalars())
    if any(o.odendi_mi for o in odemeler):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödenmiş taksiti olan bir sözleşme silinemez.")
    for o in odemeler:
        db.delete(o)
    for k in list(db.execute(select(LeasingSozlesmeKalemi).where(LeasingSozlesmeKalemi.leasing_id == leasing_id)).scalars()):
        db.delete(k)
    db.delete(sozlesme)
    db.commit()
    return {"silindi": True}


# =================================================================== TAKSİTLİ SATIŞ - SİL
@router.delete("/taksitli-satis-planlari/{plan_id}", dependencies=[Depends(izin_gerektir("TAKSIT_DUZENLE"))])
def taksitli_satis_plani_sil(plan_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    """
    Plani siler. Eger plan belirli bir urune (stok_seri_no_id) bagliysa VE
    o urun bu satis nedeniyle SATILDI isaretlenmisse, urun otomatik olarak
    DEPODA durumuna ve satis bilgileri temizlenmis haline dondurulur -
    aksi halde urun sonsuza kadar "Satildi" gorunup asla tekrar satilamazdi.
    """
    plan = db.get(TaksitliSatisPlani, plan_id)
    if plan is None or plan.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit planı bulunamadı.")
    taksitler = list(db.execute(select(TaksitDetay).where(TaksitDetay.plan_id == plan_id)).scalars())
    if any(t.odendi_mi for t in taksitler):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tahsil edilmiş taksiti olan bir plan silinemez.")
    for t in taksitler:
        db.delete(t)
    for k in list(db.execute(select(TaksitliSatisKalemi).where(TaksitliSatisKalemi.plan_id == plan_id)).scalars()):
        db.delete(k)

    if plan.stok_seri_no_id:
        urun = db.get(StokSeriNo, plan.stok_seri_no_id)
        if urun is not None and urun.durum == StokDurum.SATILDI:
            urun.durum = StokDurum.DEPODA
            urun.musteri_cari_id = None
            urun.satis_fiyati_try = None
            urun.satis_tarihi = None

    db.delete(plan)
    db.commit()
    return {"silindi": True}


# ===================================================================== KİRALAMA - SİL
@router.delete("/kiralama-sozlesmeleri/{sozlesme_id}", dependencies=[Depends(izin_gerektir("KIRALAMA_DUZENLE"))])
def kiralama_sil(sozlesme_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    sozlesme = db.get(KiralamaSozlesme, sozlesme_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kiralama sözleşmesi bulunamadı.")
    odemeler = list(db.execute(select(KiralamaOdeme).where(KiralamaOdeme.sozlesme_id == sozlesme_id)).scalars())
    if any(o.odendi_mi for o in odemeler):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tahsil edilmiş dönemi olan bir sözleşme silinemez.")
    for o in odemeler:
        db.delete(o)
    for k in list(db.execute(select(KiralamaSozlesmeKalemi).where(KiralamaSozlesmeKalemi.sozlesme_id == sozlesme_id)).scalars()):
        db.delete(k)
    db.delete(sozlesme)
    db.commit()
    return {"silindi": True}


# ========================================================================= BAKIM - SİL
@router.delete("/bakim-kayitlari/{bakim_id}", dependencies=[Depends(izin_gerektir("BAKIM_DUZENLE"))])
def bakim_kaydi_sil(bakim_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    """
    NOT: Bu kayit olusturulurken otomatik bir Kasa/Banka hareketi de acilmisti.
    Bu silme islemi o para hareketini GERI ALMAZ - sadece bakim kaydini siler.
    Gerekirse ilgili Kasa/Banka hareketini ayrica duzeltin.
    """
    kayit = db.get(BakimKaydi, bakim_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bakım kaydı bulunamadı.")
    db.delete(kayit)
    db.commit()
    return {"silindi": True}


# ============================================================================ ÇEK - DURUM GERİ AL
@router.put("/cekler/{cek_id}/durumu-geri-al", dependencies=[Depends(izin_gerektir("CEK_DUZENLE"))])
def cek_durumunu_geri_al(
    cek_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Yanlislikla 'Tahsil Edildi'/'Odendi' isaretlenmis bir cekin durumunu
    'Portfoyde'ye geri dondurur; olusan Kasa/Banka hareketini ve son durum
    gecmisi kaydini siler.
    """
    cek = db.get(Cek, cek_id)
    if cek is None or cek.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Çek bulunamadı.")
    if cek.durum not in (CekDurum.TAHSIL_EDILDI, CekDurum.ODENDI):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sadece tahsil edilmiş/ödenmiş bir çekin durumu geri alınabilir.")

    from app.models.banka import KasaHareketi, BankaHareketi
    for h in list(db.execute(
        select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "CEKLER", KasaHareketi.kaynak_id == cek_id)
    ).scalars()):
        db.delete(h)
    for h in list(db.execute(
        select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "CEKLER", BankaHareketi.kaynak_id == cek_id)
    ).scalars()):
        db.delete(h)

    son_gecmis = db.execute(
        select(CekGecmis).where(CekGecmis.cek_id == cek_id).order_by(CekGecmis.id.desc())
    ).scalars().first()
    if son_gecmis is not None:
        db.delete(son_gecmis)

    cek.durum = CekDurum.PORTFOYDE
    db.commit()
    return {"geri_alindi": True}


# ========================================================================= LEASING - ÖDEME GERİ AL
@router.put("/leasing-odemeleri/{odeme_id}/odemeyi-geri-al", dependencies=[Depends(izin_gerektir("LEASING_DUZENLE"))])
def leasing_odemesini_geri_al(
    odeme_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    odeme = db.get(LeasingOdeme, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    sozlesme = db.get(LeasingSozlesme, odeme.leasing_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    if not odeme.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu taksit zaten ödenmemiş durumda.")

    from app.models.banka import KasaHareketi, BankaHareketi
    for h in list(db.execute(
        select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "LEASING_ODEME", KasaHareketi.kaynak_id == odeme_id)
    ).scalars()):
        db.delete(h)
    for h in list(db.execute(
        select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "LEASING_ODEME", BankaHareketi.kaynak_id == odeme_id)
    ).scalars()):
        db.delete(h)

    odeme.odendi_mi = False
    odeme.odeme_tarihi = None
    db.commit()
    return {"geri_alindi": True}


# =================================================================== TAKSİTLİ SATIŞ - TAHSİLAT GERİ AL
@router.put("/taksit-detay/{taksit_id}/tahsilati-geri-al", dependencies=[Depends(izin_gerektir("TAKSIT_DUZENLE"))])
def taksit_tahsilatini_geri_al(
    taksit_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Bir taksidin tahsilatini geri alir. Eger bu taksit, BASKA bir taksidin
    odemesinden tasan fazlalikla (kademeli/otomatik yansitma) odenmisse
    (ilk_taksit_id doluysa), asil Kasa/Banka hareketi o "ilk" taksidin
    kaynak_id'siyle kayitlidir - bu durumda AYNI odemeyle etkilenen TUM
    taksitler (ilk taksit + ona bagli tum kademeli taksitler) birlikte
    geri alinir, aksi halde sadece bu tek taksit geri alinir.
    """
    taksit = db.get(TaksitDetay, taksit_id)
    if taksit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    plan = db.get(TaksitliSatisPlani, taksit.plan_id)
    if plan is None or plan.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Taksit bulunamadı.")
    if not taksit.odendi_mi and taksit.odenen_tutar <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu taksit zaten tahsil edilmemiş durumda.")

    asil_taksit_id = taksit.ilk_taksit_id if taksit.ilk_taksit_id is not None else taksit.id

    etkilenen_taksitler = list(db.execute(
        select(TaksitDetay).where(
            (TaksitDetay.id == asil_taksit_id) | (TaksitDetay.ilk_taksit_id == asil_taksit_id)
        )
    ).scalars())

    from app.models.banka import KasaHareketi, BankaHareketi
    for h in list(db.execute(
        select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "TAKSIT_DETAY", KasaHareketi.kaynak_id == asil_taksit_id)
    ).scalars()):
        db.delete(h)
    for h in list(db.execute(
        select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "TAKSIT_DETAY", BankaHareketi.kaynak_id == asil_taksit_id)
    ).scalars()):
        db.delete(h)

    for t in etkilenen_taksitler:
        t.odendi_mi = False
        t.odenen_tutar = 0
        t.odeme_tarihi = None
        t.tahsilat_kaynak_tablo = None
        t.tahsilat_kaynak_id = None
        t.ilk_taksit_id = None

    db.commit()
    return {"geri_alindi": True, "etkilenen_taksit_sayisi": len(etkilenen_taksitler)}


# ===================================================================== KİRALAMA - TAHSİLAT GERİ AL
@router.put("/kiralama-odemeleri/{odeme_id}/tahsilati-geri-al", dependencies=[Depends(izin_gerektir("KIRALAMA_DUZENLE"))])
def kiralama_odemesini_geri_al(
    odeme_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    odeme = db.get(KiralamaOdeme, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    sozlesme = db.get(KiralamaSozlesme, odeme.sozlesme_id)
    if sozlesme is None or sozlesme.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    if not odeme.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu dönem zaten tahsil edilmemiş durumda.")

    from app.models.banka import KasaHareketi, BankaHareketi
    for h in list(db.execute(
        select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "KIRALAMA_ODEME", KasaHareketi.kaynak_id == odeme_id)
    ).scalars()):
        db.delete(h)
    for h in list(db.execute(
        select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "KIRALAMA_ODEME", BankaHareketi.kaynak_id == odeme_id)
    ).scalars()):
        db.delete(h)

    odeme.odendi_mi = False
    odeme.odeme_tarihi = None
    db.commit()
    return {"geri_alindi": True}
