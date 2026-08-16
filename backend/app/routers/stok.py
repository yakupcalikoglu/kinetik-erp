from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from datetime import date
from app.models.stok import (StokKarti, StokSeriNo, StokMaliyetKalemi,
                              MALIYET_TIP_SUTUN_ESLEME, StokDurum, MaliyetTip, ParaBirimi, StokKaynak)
import json
from app.schemas.stok import (StokKartiOlusturIstegi, StokKartiYanit,
                               StokSeriNoYanit, StokDurumGuncelleIstegi,
                               MaliyetKalemiEkleIstegi, MaliyetKalemiDuzenleIstegi, KarRaporuYanit, StokSatisIstegi,
                               StokMaliyetKalemiYanit, TopluDurumGuncelleIstegi,
                               StokSeriNoDuzenleIstegi, StokSeriNoDuzenleSifreliIstegi,
                               StokKartiTopluIceAktarIstegi, StokKartiTopluIceAktarSonucu,
                               StokSeriNoIceAktarIstegi, StokSeriNoIceAktarSonucu,
                               OzMalIlkKayitIstegi, HurdayaCikarIstegi,
                               UrunOzetYaniti, UrunOzetDurumSatiri, UrunOzetSatisSatiri,
                               SonAlimFiyatiYaniti)
from app.services.para_hareketi import para_hareketi_olustur
from app.models.denetim import DuzenlemeKaydi
from app.core.security import sifre_dogrula
from app.db.soft_delete import yumusak_sil, yumusak_geri_getir, aktif_filtre
from pydantic import BaseModel

router = APIRouter(tags=["Stok"])


def _degisiklikleri_kaydet(db: Session, sirket_id: int, kullanici_id: int, tablo_adi: str, kayit_id: int, degisiklikler: dict) -> None:
    if not degisiklikler:
        return
    db.add(DuzenlemeKaydi(
        sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
        kayit_id=kayit_id, degisiklikler=json.dumps(degisiklikler, ensure_ascii=False, default=str),
    ))


class SatisCekBaglaIstegi(BaseModel):
    cek_id: int


class TopluMaliyetDagitIstegi(BaseModel):
    stok_seri_no_idleri: list[int]
    tip: MaliyetTip
    aciklama: str | None = None
    tedarikci_cari_id: int | None = None
    para_birimi: ParaBirimi
    toplam_tutar: Decimal
    kur: Decimal = Decimal("1")
    tarih: date
    yontem: str  # "ESIT" | "AGIRLIKLI"


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
    """Karti GERCEKTEN silmez - soft-delete yapar, boylece her zaman geri getirilebilir."""
    kart = db.get(StokKarti, stok_karti_id)
    if kart is None or kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stok kartı bulunamadı.")
    yumusak_sil(db, kart)
    return {"silindi": True}


@router.put("/stok-kartlari/{stok_karti_id}/geri-getir", response_model=StokKartiYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_karti_geri_getir(
    stok_karti_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    kart = db.get(StokKarti, stok_karti_id)
    if kart is None or kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stok kartı bulunamadı.")
    yumusak_geri_getir(db, kart)
    return kart


@router.post("/stok-kartlari/toplu-ice-aktar", response_model=StokKartiTopluIceAktarSonucu,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_karti_toplu_ice_aktar(
    istek: StokKartiTopluIceAktarIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """Excel'den (orn. baska bir sistemden aktarilan) urun tanimi listesini toplu olarak ekler."""
    basarili = 0
    hatalar = []
    for i, satir in enumerate(istek.satirlar, start=1):
        try:
            if not (satir.marka or "").strip() and not (satir.model or "").strip():
                raise ValueError("Marka veya model alanlarından en az biri dolu olmalı.")
            yeni = StokKarti(
                sirket_id=sirket_id, marka=satir.marka, model=satir.model,
                birim=satir.birim or "ADET", mense_ulke=satir.mense_ulke, gtip_kodu=satir.gtip_kodu,
            )
            db.add(yeni)
            db.commit()
            basarili += 1
        except Exception as e:
            db.rollback()
            hatalar.append({"satir_no": i, "marka": satir.marka, "model": satir.model, "hata": str(e)})
    return StokKartiTopluIceAktarSonucu(basarili_sayisi=basarili, hatali_satirlar=hatalar)

@router.post("/stok-seri-no/toplu-ice-aktar", response_model=StokSeriNoIceAktarSonucu,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_seri_no_toplu_ice_aktar(
    istek: StokSeriNoIceAktarIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Excel'den fiziksel envanter (seri no bazli) kayitlarini toplu ekler.
    Her satirdaki marka+model, ONCEDEN Urun Tanimlari'nda kayitli bir
    StokKarti ile ESLESTIRILIR (yeni urun tanimi OLUSTURULMAZ) - eslesme
    bulunamazsa o satir hata olarak isaretlenir. Eklenen kayitlar varsayilan
    olarak DEPODA durumunda baslar (kasa/banka hareketi OLUSTURULMAZ - bu
    gecmis/mevcut envanterin sisteme ilk kez girisi, yeni bir satinalma degil).
    """
    basarili = 0
    hatalar = []
    for i, satir in enumerate(istek.satirlar, start=1):
        try:
            if not (satir.seri_no or "").strip():
                raise ValueError("Seri no zorunlu.")
            mevcut = db.execute(
                select(StokSeriNo).where(StokSeriNo.seri_no == satir.seri_no)
            ).scalar_one_or_none()
            if mevcut is not None:
                raise ValueError(f"'{satir.seri_no}' seri numarası zaten kayıtlı.")

            kart = db.execute(
                select(StokKarti).where(
                    StokKarti.sirket_id == sirket_id,
                    func.lower(StokKarti.marka) == (satir.marka or "").strip().lower(),
                    func.lower(StokKarti.model) == (satir.model or "").strip().lower(),
                )
            ).scalar_one_or_none()
            if kart is None:
                raise ValueError(
                    f"'{satir.marka} {satir.model}' ile eşleşen bir ürün tanımı bulunamadı - "
                    "önce Ürün Tanımları sayfasından bu marka/modeli ekleyin."
                )

            yeni = StokSeriNo(
                sirket_id=sirket_id, stok_karti_id=kart.id, seri_no=satir.seri_no,
                sasi_no=satir.sasi_no, uretim_yili=satir.uretim_yili,
                kaynak=StokKaynak.YURTICI_ALIM, durum=StokDurum.DEPODA,
                sahiplik_tipi=satir.sahiplik_tipi or "TICARI",
                satinalma_maliyeti_try=satir.satinalma_maliyeti_try or Decimal("0"),
            )
            db.add(yeni)
            db.commit()
            basarili += 1
        except Exception as e:
            db.rollback()
            hatalar.append({"satir_no": i, "seri_no": satir.seri_no, "hata": str(e)})
    return StokSeriNoIceAktarSonucu(basarili_sayisi=basarili, hatali_satirlar=hatalar)


@router.get("/stok-kartlari/{stok_karti_id}/son-alim-fiyati", response_model=SonAlimFiyatiYaniti,
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def son_alim_fiyati_getir(
    stok_karti_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Bu urun modeline (marka/model) ait en son eklenen fiziksel envanter
    kaydinin toplam maliyetini doner - yeni siparis olustururken "bu
    urunu son ne fiyata almistik" referansi olarak kullanilir.
    """
    en_son = db.execute(
        select(StokSeriNo)
        .where(StokSeriNo.sirket_id == sirket_id, StokSeriNo.stok_karti_id == stok_karti_id)
        .order_by(StokSeriNo.olusturma_tarihi.desc())
        .limit(1)
    ).scalar_one_or_none()
    if en_son is None:
        return SonAlimFiyatiYaniti(bulundu=False)
    return SonAlimFiyatiYaniti(
        bulundu=True,
        toplam_maliyet_try=en_son.toplam_maliyet_try,
        tarih=en_son.olusturma_tarihi.date() if en_son.olusturma_tarihi else None,
        seri_no=en_son.seri_no,
    )


@router.get("/stok-kartlari", response_model=list[StokKartiYanit],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def stok_kartlarini_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(StokKarti).where(StokKarti.sirket_id == sirket_id, aktif_filtre(StokKarti))
    return list(db.execute(sorgu).scalars())


@router.get("/stok-kartlari/{stok_karti_id}/ozet", response_model=UrunOzetYaniti,
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def urun_ozet(
    stok_karti_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Bir urun MODELININ (marka/model) simdiye kadarki TUM performansini
    tek yerde ozetler: kac tanesi hangi durumda, satilanlarin kar/zarari,
    ortalama kar marji, bakim gelir/gideri. "Bu modeli almaya devam etmeli
    miyim" sorusuna tek ekrandan cevap verir.
    """
    from app.models.finansal import BakimKaydi, BakimTip

    kart = db.get(StokKarti, stok_karti_id)
    if kart is None or kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ürün tanımı bulunamadı.")

    urunler = list(db.execute(select(StokSeriNo).where(StokSeriNo.stok_karti_id == stok_karti_id, StokSeriNo.sirket_id == sirket_id)).scalars())

    durum_sayaci: dict[str, int] = {}
    for u in urunler:
        durum_sayaci[u.durum.value if hasattr(u.durum, "value") else u.durum] = durum_sayaci.get(u.durum.value if hasattr(u.durum, "value") else u.durum, 0) + 1

    cari_haritasi = {}
    musteri_ids = [u.musteri_cari_id for u in urunler if u.musteri_cari_id]
    if musteri_ids:
        from app.models.cari import CariHesap
        cari_haritasi = {c.id: c.unvan for c in db.execute(select(CariHesap).where(CariHesap.id.in_(musteri_ids))).scalars()}

    satislar = []
    toplam_kar = Decimal("0")
    toplam_satis_fiyati = Decimal("0")
    for u in urunler:
        if u.durum != StokDurum.SATILDI:
            continue
        toplam_maliyet = (
            u.satinalma_maliyeti_try + u.nakliye_maliyeti_try + u.sigorta_maliyeti_try + u.gumruk_maliyeti_try +
            u.antrepo_maliyeti_try + u.millilestirme_maliyeti_try + u.leasing_maliyeti_try + u.diger_maliyet_try
        )
        kar = (u.satis_fiyati_try - toplam_maliyet) if u.satis_fiyati_try is not None else None
        satislar.append(UrunOzetSatisSatiri(
            seri_no=u.seri_no, satis_tarihi=u.satis_tarihi, musteri_unvan=cari_haritasi.get(u.musteri_cari_id),
            satis_fiyati_try=u.satis_fiyati_try, toplam_maliyet_try=toplam_maliyet, kar_zarar_try=kar,
        ))
        if kar is not None:
            toplam_kar += kar
            toplam_satis_fiyati += u.satis_fiyati_try or Decimal("0")

    satislar.sort(key=lambda s: s.satis_tarihi or date.min, reverse=True)
    ortalama_kar_marji = (toplam_kar / toplam_satis_fiyati * 100) if toplam_satis_fiyati > 0 else None

    seri_ids = [u.id for u in urunler]
    bakim_geliri = Decimal("0")
    bakim_gideri = Decimal("0")
    if seri_ids:
        for b in db.execute(select(BakimKaydi).where(BakimKaydi.stok_seri_no_id.in_(seri_ids))).scalars():
            if b.tip == BakimTip.GELIR:
                bakim_geliri += b.tutar
            else:
                bakim_gideri += b.tutar

    return UrunOzetYaniti(
        marka=kart.marka, model=kart.model, toplam_adet=len(urunler),
        durum_dagilimi=[UrunOzetDurumSatiri(durum=d, adet=a) for d, a in durum_sayaci.items()],
        satislar=satislar, toplam_satis_adedi=len(satislar), toplam_kar_zarar_try=toplam_kar,
        ortalama_kar_marji_yuzde=ortalama_kar_marji, bakim_geliri_toplam=bakim_geliri, bakim_gideri_toplam=bakim_gideri,
    )


@router.get("/stok-seri-no", response_model=list[StokSeriNoYanit],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def stok_seri_no_listele(
    durum: StokDurum | None = None,
    stok_karti_id: int | None = None,
    siparis_id: int | None = None,
    sahiplik_tipi: str | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(StokSeriNo).where(StokSeriNo.sirket_id == sirket_id, aktif_filtre(StokSeriNo))
    if durum:
        sorgu = sorgu.where(StokSeriNo.durum == durum)
    if stok_karti_id:
        sorgu = sorgu.where(StokSeriNo.stok_karti_id == stok_karti_id)
    if siparis_id:
        sorgu = sorgu.where(StokSeriNo.siparis_id == siparis_id)
    if sahiplik_tipi:
        sorgu = sorgu.where(StokSeriNo.sahiplik_tipi == sahiplik_tipi)
    return list(db.execute(sorgu).scalars())


@router.get("/stok-seri-no/toplam-doviz-maliyet-haritasi",
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def toplam_doviz_maliyet_haritasi(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Her stok_seri_no_id icin, o urune eklenmis maliyet kalemlerinden USD ve
    EUR cinsinden GIRILMIS olanlarin ORIJINAL (canli kurla yeniden
    hesaplanmamis) tutarlarinin toplamini doner. Boylece "USD Karsiligi"
    gibi sutunlar, bugunku kurla yapilan bir TAHMIN yerine, o urun icin
    GERCEKTEN doviz cinsinden odenmis tarihsel tutari gosterebilir.
    Not: Bir urune sadece TL cinsinden maliyet girildiyse (orn. normal
    Siparis->Teslim Al akisindan gelen ve hicbir zaman geriye donuk
    maliyet kalemi eklenmemis urunler), bu haritada o urun icin veri
    OLMAYACAKTIR - boyle durumlarda frontend canli kur tahminine geri
    donmelidir.
    """
    # Dogrudan dovizli (USD/EUR) girilmis kalemler - orijinal tutar aynen kullanilir.
    sorgu = (
        select(StokMaliyetKalemi.stok_seri_no_id, StokMaliyetKalemi.para_birimi,
               func.sum(StokMaliyetKalemi.tutar).label("toplam"))
        .join(StokSeriNo, StokSeriNo.id == StokMaliyetKalemi.stok_seri_no_id)
        .where(StokSeriNo.sirket_id == sirket_id, StokMaliyetKalemi.para_birimi != ParaBirimi.TRY)
        .group_by(StokMaliyetKalemi.stok_seri_no_id, StokMaliyetKalemi.para_birimi)
    )
    harita: dict[str, dict[str, Decimal]] = {}
    for seri_id, para_birimi, toplam in db.execute(sorgu).all():
        pb = para_birimi.value if hasattr(para_birimi, "value") else para_birimi
        harita.setdefault(str(seri_id), {})[pb] = toplam

    # TL cinsinden girilmis ama referans_usd_kuru belirtilmis kalemler -
    # o gunku GERCEK kurla USD karsiligi hesaplanip USD toplamina eklenir
    # (canli/guncel kurla degil).
    tl_sorgu = (
        select(StokMaliyetKalemi.stok_seri_no_id, StokMaliyetKalemi.tutar_try, StokMaliyetKalemi.referans_usd_kuru)
        .join(StokSeriNo, StokSeriNo.id == StokMaliyetKalemi.stok_seri_no_id)
        .where(
            StokSeriNo.sirket_id == sirket_id,
            StokMaliyetKalemi.para_birimi == ParaBirimi.TRY,
            StokMaliyetKalemi.referans_usd_kuru.isnot(None),
            StokMaliyetKalemi.referans_usd_kuru > 0,
        )
    )
    for seri_id, tutar_try, referans_kur in db.execute(tl_sorgu).all():
        usd_karsiligi = tutar_try / referans_kur
        mevcut = harita.setdefault(str(seri_id), {})
        mevcut["USD"] = (mevcut.get("USD") or Decimal("0")) + usd_karsiligi

    return harita


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


@router.post("/stok-seri-no/toplu-maliyet-dagit", response_model=list[StokSeriNoYanit],
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_toplu_maliyet_dagit(
    istek: TopluMaliyetDagitIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Birden fazla urune AYNI ANDA bir maliyet kalemi ekler ve toplam tutari
    aralarinda dagitir (Akreditif'teki maliyet dagitimi ile ayni mantik).
    ESIT: toplam, secilen urun adedine esit bolunur.
    AGIRLIKLI: toplam, urunlerin mevcut satinalma_maliyeti_try degerine
    oranla dagilir (satinalma maliyeti daha yuksek olan urun, daha fazla pay alir).
    Her urun icin ayri bir StokMaliyetKalemi satiri olusturulur - boylece
    her biri daha sonra tek tek duzenlenebilir/silinebilir.
    """
    if not istek.stok_seri_no_idleri:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "En az bir ürün seçmelisiniz.")

    urunler = []
    for seri_id in istek.stok_seri_no_idleri:
        u = db.get(StokSeriNo, seri_id)
        if u is None or u.sirket_id != sirket_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Ürün bulunamadı (ID={seri_id}).")
        urunler.append(u)

    toplam_tutar_try = istek.toplam_tutar * istek.kur
    ozet_sutun = MALIYET_TIP_SUTUN_ESLEME[istek.tip]

    if istek.yontem == "ESIT":
        pay_try = toplam_tutar_try / len(urunler)
        paylar = {u.id: pay_try for u in urunler}
    elif istek.yontem == "AGIRLIKLI":
        toplam_satinalma = sum(u.satinalma_maliyeti_try or 0 for u in urunler)
        if toplam_satinalma == 0:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Ürünlerin satınalma maliyeti girilmemiş, ağırlıklı dağıtım yapılamıyor."
            )
        paylar = {u.id: toplam_tutar_try * ((u.satinalma_maliyeti_try or 0) / toplam_satinalma) for u in urunler}
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "yontem 'ESIT' veya 'AGIRLIKLI' olmalıdır.")

    for u in urunler:
        pay_try = paylar[u.id]
        pay_orijinal = pay_try / istek.kur if istek.kur else pay_try
        db.add(StokMaliyetKalemi(
            stok_seri_no_id=u.id, tip=istek.tip, aciklama=istek.aciklama,
            tedarikci_cari_id=istek.tedarikci_cari_id, para_birimi=istek.para_birimi,
            tutar=pay_orijinal, kur=istek.kur, tutar_try=pay_try,
            tarih=istek.tarih,
        ))
        mevcut = getattr(u, ozet_sutun) or 0
        setattr(u, ozet_sutun, mevcut + pay_try)

    db.commit()
    for u in urunler:
        db.refresh(u)
    return urunler


@router.put("/stok-seri-no/{seri_id}", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_seri_no_duzenle(
    seri_id: int,
    istek: StokSeriNoDuzenleSifreliIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """Bir urunun seri numarasini veya hangi urun tanimina (stok karti) ait oldugunu duzeltir. Sifre onayi zorunludur."""
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)

    yeni_kart = db.get(StokKarti, istek.stok_karti_id)
    if yeni_kart is None or yeni_kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ürün tanımı bulunamadı.")

    degisiklikler = {}
    if kayit.seri_no != istek.seri_no:
        degisiklikler["Seri No"] = {"eski": kayit.seri_no, "yeni": istek.seri_no}
    if kayit.stok_karti_id != istek.stok_karti_id:
        degisiklikler["Ürün Tanımı"] = {"eski": kayit.stok_karti_id, "yeni": istek.stok_karti_id}
    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "stok_seri_no", kayit.id, degisiklikler)

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
    Bir urun kaydini siler. Satis/hurda gecmisini korumak (ve olasi asili
    kalmis Kasa/Banka hareketlerini onlemek) icin SATILDI veya HURDA
    durumundaki urunler silinemez - once ilgili "Satisi/Hurdayi Geri Al"
    islemi yapilmalidir. Bagli maliyet kalemleri de birlikte silinir.
    """
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    if kayit.durum in (StokDurum.SATILDI, StokDurum.HURDA):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Satılmış veya hurdaya çıkarılmış bir ürün doğrudan silinemez (geçmiş korunur). "
            "Önce ürünün 'Satışı/Hurdayı Geri Al' işlemini yapın."
        )

    # Maliyet kalemleri (alt kayitlar) GERCEKTEN silinir - bunlar bagimsiz
    # bir "kayit" degil, urunun BIR PARCASI; ana urun soft-delete ile
    # geri getirilince, maliyet kalemleri de zaten SIFIRDAN girilebilir.
    for kalem in list(db.execute(
        select(StokMaliyetKalemi).where(StokMaliyetKalemi.stok_seri_no_id == seri_id)
    ).scalars()):
        db.delete(kalem)

    yumusak_sil(db, kayit)
    return {"silindi": True}


@router.put("/stok-seri-no/{seri_id}/geri-getir", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_seri_no_geri_getir(
    seri_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    kayit = db.get(StokSeriNo, seri_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ürün bulunamadı.")
    yumusak_geri_getir(db, kayit)
    return kayit


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
    if istek.satis_odeme_tipi is not None:
        kayit.satis_odeme_tipi = istek.satis_odeme_tipi
    if istek.satis_yontemi is not None:
        kayit.satis_yontemi = istek.satis_yontemi
    if istek.durum == StokDurum.SATILDI:
        from datetime import datetime as _datetime
        kayit.satis_kayit_zamani = _datetime.now()

    db.commit()
    db.refresh(kayit)
    return kayit


@router.post("/stok-seri-no/oz-mal-ilk-kayit", response_model=StokSeriNoYanit,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def oz_mal_ilk_kaydi_olustur(
    istek: OzMalIlkKayitIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Gecmiste alinmis, siparis kaydi olmadan elde bulunan bir urunu (Oz Mal /
    Demirbas) dogrudan envantere ekler. HICBIR Kasa/Banka hareketi
    OLUSTURMAZ (para gecmiste zaten harcanmis kabul edilir) - sadece
    maliyeti kayit altina alir ki ileride satildiginda/hurdaya
    cikarildiginda kar/zarar dogru hesaplansin. Bundan sonraki yeni
    alimlar icin normal Siparis -> Teslim Al akisi kullanilmalidir (o akis
    SiparisOdeme uzerinden normal sekilde Kasa/Banka'ya yansir).
    """
    kart = db.get(StokKarti, istek.stok_karti_id)
    if kart is None or kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Ürün tanımı bulunamadı (ID={istek.stok_karti_id}).")

    mevcut = db.execute(select(StokSeriNo).where(StokSeriNo.seri_no == istek.seri_no)).scalar_one_or_none()
    if mevcut is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{istek.seri_no}' seri numaralı bir ürün zaten mevcut.")

    maliyet_try = istek.maliyet_orijinal * istek.kur
    yeni = StokSeriNo(
        sirket_id=sirket_id, stok_karti_id=istek.stok_karti_id,
        seri_no=istek.seri_no, sasi_no=istek.sasi_no, uretim_yili=istek.uretim_yili,
        kaynak=StokKaynak.YURTICI_ALIM, siparis_id=None, durum=istek.durum,
        sahiplik_tipi="OZ_MAL", satinalma_maliyeti_try=maliyet_try,
    )
    db.add(yeni)
    db.flush()

    # Orijinal doviz tutarini (ornegin 18.600 USD) KALICI olarak kaydetmek
    # icin bir StokMaliyetKalemi de aciyoruz - boylece "Maliyet Detayi"
    # panelinde ve toplu USD/EUR ozetlerinde gercek tarihsel tutar (canli
    # kurla yeniden hesaplanmis bir tahmin degil) gorunur. odendi_mi=True,
    # cunku bu gecmiste zaten harcanmis bir tutardir.
    db.add(StokMaliyetKalemi(
        stok_seri_no_id=yeni.id, tip=MaliyetTip.SATINALMA,
        aciklama=istek.aciklama or "Öz Mal ilk kaydı",
        para_birimi=istek.para_birimi, tutar=istek.maliyet_orijinal,
        kur=istek.kur, tutar_try=maliyet_try, tarih=date.today(), odendi_mi=True,
    ))

    db.commit()
    db.refresh(yeni)
    return yeni


@router.put("/stok-seri-no/{seri_id}/hurdaya-cikar", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def urunu_hurdaya_cikar(
    seri_id: int,
    istek: HurdayaCikarIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Bir urunu hurdaya cikarir. hurda_bedeli_try > 0 ise bu tutar Kasa/
    Banka'ya GIRIS olarak islenir; kar_zarar_try alani (toplam maliyet -
    hurda bedeli farki uzerinden) otomatik olarak hesaplanmis olur - ayni
    normal satis akisindaki kar/zarar mantigi (satis_fiyati_try alanina
    hurda bedelini yazarak).
    """
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    if kayit.durum in (StokDurum.SATILDI, StokDurum.HURDA):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu ürün zaten satılmış veya hurdaya çıkarılmış.")

    if istek.hurda_bedeli_try > 0 and not istek.odeme_yontemi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Hurda bedeli girildiyse ödeme yöntemi (Nakit/Banka) zorunludur.")

    kayit.durum = StokDurum.HURDA
    kayit.satis_fiyati_try = istek.hurda_bedeli_try
    kayit.satis_tarihi = date.today()

    if istek.hurda_bedeli_try > 0:
        para_hareketi_olustur(
            db, sirket_id, kullanici.id, "GIRIS", istek.hurda_bedeli_try,
            istek.odeme_yontemi, istek.banka_hesap_id,
            aciklama=f"Hurda bedeli - Seri No {kayit.seri_no}" + (f" - {istek.aciklama}" if istek.aciklama else ""),
            kaynak_tablo="STOK_SATIS", kaynak_id=kayit.id,
        )

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

    from datetime import datetime as _datetime
    kayit.durum = StokDurum.SATILDI
    kayit.musteri_cari_id = istek.musteri_cari_id
    kayit.satis_fiyati_try = istek.satis_fiyati_try
    kayit.satis_tarihi = istek.satis_tarihi
    kayit.satis_kayit_zamani = _datetime.now()
    if istek.satis_odeme_tipi is not None:
        kayit.satis_odeme_tipi = istek.satis_odeme_tipi
    if istek.satis_yontemi is not None:
        kayit.satis_yontemi = istek.satis_yontemi

    # Banka hesabina GERCEK ISLEM para biriminde/tutarinda yazmak icin -
    # istek.islem_tutari verilmemisse (eski/basit cagrilar) TL varsayilir.
    # para_hareketi_olustur, hesabin KENDI para birimiyle bu deger
    # UYUSMUYORSA artik NET BIR HATA firlatir (sessizce yanlis kaydetmez -
    # az once yasadigimiz "TL tutari USD hesaba USD sanilarak yazildi"
    # hatasi BIR DAHA OLUSAMAZ).
    gonderilecek_tutar = istek.islem_tutari if istek.islem_tutari is not None else istek.satis_fiyati_try
    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "GIRIS", gonderilecek_tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"Stok satışı - Seri No {kayit.seri_no}",
        kaynak_tablo="STOK_SATIS", kaynak_id=kayit.id, cari_id=istek.musteri_cari_id,
        para_birimi=istek.islem_para_birimi, kur=istek.kur,
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
        referans_usd_kuru=istek.referans_usd_kuru,
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
    if kayit.durum not in (StokDurum.SATILDI, StokDurum.HURDA):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu ürün satılmış veya hurdaya çıkarılmış durumda değil.")

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
    kayit.satis_kayit_zamani = None
    # Eski satis bilgisi tamamen temizlensin - aksi halde urun DEPODA'ya
    # dondugu halde "satis_odeme_tipi"/"satis_yontemi" eski (yanlis) degeri
    # tasimaya devam edebilirdi (temiz veri icin, dusuk risk ama dogru olan).
    kayit.satis_odeme_tipi = None
    kayit.satis_yontemi = None

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


@router.post("/stok-seri-no/{seri_id}/satinalma-kalemini-geriye-donuk-olustur", response_model=StokSeriNoYanit,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def satinalma_kalemini_geriye_donuk_olustur(
    seri_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Satinalma maliyetinin bir kalem satiri olarak otomatik kaydedilmeye
    baslamasindan ONCE teslim alinmis urunler icin, mevcut
    satinalma_maliyeti_try degerini GERIYE DONUK olarak bir maliyet kalemi
    satirina donusturur. Ozet sutuna DOKUNMAZ (deger zaten orada) - sadece
    "Maliyet Detayi" listesinde gorunur hale getirir. Zaten bir Satinalma
    kalemi varsa (yeni teslim alinan urunlerde oldugu gibi) cift kayit
    olusturmamak icin reddedilir.
    """
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)

    mevcut = db.execute(
        select(StokMaliyetKalemi).where(
            StokMaliyetKalemi.stok_seri_no_id == seri_id,
            StokMaliyetKalemi.tip == MaliyetTip.SATINALMA,
        )
    ).first()
    if mevcut is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu ürünün zaten bir satınalma kalemi var.")

    if not kayit.satinalma_maliyeti_try or kayit.satinalma_maliyeti_try == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu ürünün kayıtlı bir satınalma maliyeti yok.")

    db.add(StokMaliyetKalemi(
        stok_seri_no_id=seri_id,
        tip=MaliyetTip.SATINALMA,
        aciklama="Satınalma (geriye dönük eklendi)",
        para_birimi=ParaBirimi.TRY,
        tutar=kayit.satinalma_maliyeti_try,
        kur=1,
        tutar_try=kayit.satinalma_maliyeti_try,
        tarih=kayit.giris_tarihi or date.today(),
    ))
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
    toplam = (kayit.satinalma_maliyeti_try + kayit.nakliye_maliyeti_try + kayit.sigorta_maliyeti_try +
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
    istek: MaliyetKalemiDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Yanlis girilmis bir maliyet kalemini duzeltir. Sifre onayi zorunludur;
    degisiklikler denetim_kayitlari'na islenir. Ozet sutun (orn.
    nakliye_maliyeti_try) once eski tutar dusulerek, sonra yeni tutar
    eklenerek guncellenir - tip degisse bile (orn. Nakliye -> Gumruk)
    dogru sutunlar etkilenir.
    """
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    kalem = db.get(StokMaliyetKalemi, kalem_id)
    if kalem is None or kalem.stok_seri_no_id != seri_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Maliyet kalemi bulunamadı.")

    alan_adlari = {"tip": "Tip", "aciklama": "Açıklama", "tedarikci_cari_id": "Tedarikçi", "para_birimi": "Para Birimi", "tutar": "Tutar", "kur": "Kur", "belge_no": "Belge No", "tarih": "Tarih", "referans_usd_kuru": "Referans USD Kuru"}
    yeni_degerler = {
        "tip": istek.tip, "aciklama": istek.aciklama, "tedarikci_cari_id": istek.tedarikci_cari_id,
        "para_birimi": istek.para_birimi, "tutar": istek.tutar, "kur": istek.kur,
        "belge_no": istek.belge_no, "tarih": istek.tarih, "referans_usd_kuru": istek.referans_usd_kuru,
    }
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(kalem, alan)
        yeni = yeni_degerler[alan]
        eski_metin = eski.value if hasattr(eski, "value") else eski
        yeni_metin = yeni.value if hasattr(yeni, "value") else yeni
        if str(eski_metin) != str(yeni_metin):
            degisiklikler[etiket] = {"eski": eski_metin, "yeni": yeni_metin}
    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "stok_maliyet_kalemleri", kalem.id, degisiklikler)

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
    kalem.referans_usd_kuru = istek.referans_usd_kuru

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


class UrunBaglantiSatiri(BaseModel):
    tur: str  # "SIPARIS" | "LEASING" | "KIRALAMA" | "TAKSITLI_SATIS" | "CEK" | "BAKIM"
    etiket: str
    kaynak_tablo: str  # frontend navigasyon haritasinda kullanilir
    kaynak_id: int


@router.get("/stok-seri-no/{seri_id}/baglantilar", response_model=list[UrunBaglantiSatiri],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def urun_baglantilarini_getir(
    seri_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Bir urunun (StokSeriNo) BAGLI OLDUGU TUM kayitlari (Siparis, Leasing,
    Kiralama, Taksitli Satis, Cek, Bakim) tek bir listede doner - Stok
    sayfasindan "bu urun nerede kullaniliyor" sorusuna hizli cevap icin.
    Sayfa/sekmeler arasindaki kopuklugu azaltmak amaciyla eklenmistir.
    """
    from app.models.finansal import (
        LeasingKalemUrunu, LeasingSozlesmeKalemi, LeasingSozlesme,
        KiralamaKalemUrunu, KiralamaSozlesmeKalemi, KiralamaSozlesme,
        TaksitliSatisKalemUrunu, TaksitliSatisKalemi, TaksitliSatisPlani,
        BakimKaydi,
    )

    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    sonuclar: list[UrunBaglantiSatiri] = []

    if kayit.siparis_id:
        sonuclar.append(UrunBaglantiSatiri(
            tur="SIPARIS", etiket=f"Sipariş #{kayit.siparis_id}",
            kaynak_tablo="SIPARIS", kaynak_id=kayit.siparis_id,
        ))

    leasing_baglar = list(db.execute(
        select(LeasingKalemUrunu, LeasingSozlesmeKalemi, LeasingSozlesme)
        .join(LeasingSozlesmeKalemi, LeasingSozlesmeKalemi.id == LeasingKalemUrunu.kalem_id)
        .join(LeasingSozlesme, LeasingSozlesme.id == LeasingSozlesmeKalemi.leasing_id)
        .where(LeasingKalemUrunu.stok_seri_no_id == seri_id)
    ).all())
    for _, _, sozlesme in leasing_baglar:
        sonuclar.append(UrunBaglantiSatiri(
            tur="LEASING", etiket=f"Leasing — {sozlesme.sozlesme_no or ('#' + str(sozlesme.id))}",
            kaynak_tablo="LEASING", kaynak_id=sozlesme.id,
        ))

    kiralama_baglar = list(db.execute(
        select(KiralamaKalemUrunu, KiralamaSozlesmeKalemi, KiralamaSozlesme)
        .join(KiralamaSozlesmeKalemi, KiralamaSozlesmeKalemi.id == KiralamaKalemUrunu.kalem_id)
        .join(KiralamaSozlesme, KiralamaSozlesme.id == KiralamaSozlesmeKalemi.sozlesme_id)
        .where(KiralamaKalemUrunu.stok_seri_no_id == seri_id)
    ).all())
    for _, _, sozlesme in kiralama_baglar:
        sonuclar.append(UrunBaglantiSatiri(
            tur="KIRALAMA", etiket=f"Kiralama — Sözleşme #{sozlesme.id} ({sozlesme.durum})",
            kaynak_tablo="KIRALAMA", kaynak_id=sozlesme.id,
        ))

    taksit_baglar = list(db.execute(
        select(TaksitliSatisKalemUrunu, TaksitliSatisKalemi, TaksitliSatisPlani)
        .join(TaksitliSatisKalemi, TaksitliSatisKalemi.id == TaksitliSatisKalemUrunu.kalem_id)
        .join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitliSatisKalemi.plan_id)
        .where(TaksitliSatisKalemUrunu.stok_seri_no_id == seri_id)
    ).all())
    for _, _, plan in taksit_baglar:
        sonuclar.append(UrunBaglantiSatiri(
            tur="TAKSITLI_SATIS", etiket=f"Taksitli Satış — Plan #{plan.id}",
            kaynak_tablo="TAKSITLI_SATIS", kaynak_id=plan.id,
        ))

    if kayit.satis_cek_id:
        sonuclar.append(UrunBaglantiSatiri(
            tur="CEK", etiket=f"Çek #{kayit.satis_cek_id}",
            kaynak_tablo="CEKLER", kaynak_id=kayit.satis_cek_id,
        ))

    bakimlar = list(db.execute(
        select(BakimKaydi).where(BakimKaydi.stok_seri_no_id == seri_id)
    ).scalars())
    if bakimlar:
        sonuclar.append(UrunBaglantiSatiri(
            tur="BAKIM", etiket=f"{len(bakimlar)} bakım kaydı",
            kaynak_tablo="BAKIM_KAYDI", kaynak_id=seri_id,
        ))

    return sonuclar
