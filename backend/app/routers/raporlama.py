from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir
from app.models.stok import StokSeriNo, StokKarti, StokDurum, Siparis, SiparisOdeme, SiparisDetay
from app.models.cari import CariHesap, CariHareket
from app.models.banka import KasaHareketi, BankaHesabi, BankaHareketi
from app.models.finansal import (
    Cek, CekDurum, CekTip, TaksitDetay, TaksitliSatisPlani,
    KiralamaOdeme, KiralamaSozlesme, BakimKaydi, BakimTip,
    LeasingOdeme, LeasingSozlesme,
)
from app.models.akreditif import Akreditif, AkreditifKalemi, AkreditifDurum
from app.models.akreditif_taksit import AkreditifKalemTaksiti
from app.models.diger import PersonelOdeme, Personel, SabitGider, BorcOdeme, Borc, BorcTip
from app.models.yedek_parca import YedekParca
from app.services.kur_servisi import guncel_kur_getir
from app.schemas.raporlama import (
    SeriNoRaporYaniti, HareketTuruRaporYaniti, HareketTuruSatiri,
    AnaKasaOzetYaniti, GenelBakisYaniti, YaklasanVadeSatiri, YaklasanVadelerYaniti,
    DepoEnvanterSatiri, AktifKiralamaSatiri,
)

router = APIRouter(prefix="/raporlar", tags=["Raporlama"])

from pydantic import BaseModel


class KarMarjiSatiri(BaseModel):
    stok_karti_id: int
    urun_adi: str
    adet_satildi: int
    toplam_maliyet_try: Decimal
    toplam_satis_try: Decimal
    toplam_kar_try: Decimal
    ortalama_kar_marji_yuzde: Decimal


@router.get("/kar-marji-analizi", response_model=list[KarMarjiSatiri],
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def kar_marji_analizi(sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    """
    Urun tanimi (stok karti) basina, simdiye kadar SATILMIS urunlerin
    toplam maliyet/satis/kar rakamlarini ve ortalama kar marji yuzdesini
    hesaplar. En kazancli urun turunden en aza dogru siralanir.
    """
    satilan_urunler = list(db.execute(
        select(StokSeriNo).where(
            StokSeriNo.sirket_id == sirket_id,
            StokSeriNo.durum == StokDurum.SATILDI,
            StokSeriNo.satis_fiyati_try.isnot(None),
        )
    ).scalars())

    kart_haritasi = {
        k.id: k for k in db.execute(select(StokKarti).where(StokKarti.sirket_id == sirket_id)).scalars()
    }

    gruplar = {}
    for u in satilan_urunler:
        toplam_maliyet = (
            u.satinalma_maliyeti_try + u.nakliye_maliyeti_try + u.gumruk_maliyeti_try +
            u.antrepo_maliyeti_try + u.millilestirme_maliyeti_try + u.leasing_maliyeti_try + u.diger_maliyet_try
        )
        g = gruplar.setdefault(u.stok_karti_id, {"adet": 0, "maliyet": Decimal("0"), "satis": Decimal("0")})
        g["adet"] += 1
        g["maliyet"] += toplam_maliyet
        g["satis"] += u.satis_fiyati_try

    sonuc = []
    for stok_karti_id, g in gruplar.items():
        kart = kart_haritasi.get(stok_karti_id)
        urun_adi = f"{kart.marka} {kart.model}".strip() if kart else f"#{stok_karti_id}"
        kar = g["satis"] - g["maliyet"]
        marj = (kar / g["maliyet"] * 100) if g["maliyet"] else Decimal("0")
        sonuc.append(KarMarjiSatiri(
            stok_karti_id=stok_karti_id, urun_adi=urun_adi, adet_satildi=g["adet"],
            toplam_maliyet_try=g["maliyet"], toplam_satis_try=g["satis"],
            toplam_kar_try=kar, ortalama_kar_marji_yuzde=round(marj, 2),
        ))
    sonuc.sort(key=lambda s: s.toplam_kar_try, reverse=True)
    return sonuc


@router.get("/seri-no", response_model=SeriNoRaporYaniti,
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def seri_no_raporu(
    seri_no: str,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Tek bir urunun (seri numarasi) tum maliyet, satis ve bakim gecmisini
    birlestirip getirir. Stok + Bakim modullerini birlestiren ilk rapor.
    """
    kayit = db.execute(
        select(StokSeriNo, StokKarti)
        .join(StokKarti, StokKarti.id == StokSeriNo.stok_karti_id)
        .where(StokSeriNo.seri_no == seri_no, StokSeriNo.sirket_id == sirket_id)
    ).first()
    if kayit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bu seri numarasına ait kayıt bulunamadı.")
    seri, kart = kayit

    toplam_maliyet = (seri.satinalma_maliyeti_try + seri.nakliye_maliyeti_try +
                       seri.gumruk_maliyeti_try + seri.antrepo_maliyeti_try +
                       seri.millilestirme_maliyeti_try + seri.leasing_maliyeti_try +
                       seri.diger_maliyet_try)
    kar_zarar = (seri.satis_fiyati_try - toplam_maliyet) if seri.satis_fiyati_try is not None else None

    bakim_gelir = db.execute(
        select(func.coalesce(func.sum(BakimKaydi.tutar), 0))
        .where(BakimKaydi.stok_seri_no_id == seri.id, BakimKaydi.tip == BakimTip.GELIR)
    ).scalar_one()
    bakim_gider = db.execute(
        select(func.coalesce(func.sum(BakimKaydi.tutar), 0))
        .where(BakimKaydi.stok_seri_no_id == seri.id, BakimKaydi.tip == BakimTip.GIDER)
    ).scalar_one()

    return SeriNoRaporYaniti(
        seri_no=seri.seri_no, marka=kart.marka, model=kart.model, durum=seri.durum.value,
        satinalma_maliyeti_try=seri.satinalma_maliyeti_try,
        nakliye_maliyeti_try=seri.nakliye_maliyeti_try,
        gumruk_maliyeti_try=seri.gumruk_maliyeti_try,
        antrepo_maliyeti_try=seri.antrepo_maliyeti_try,
        millilestirme_maliyeti_try=seri.millilestirme_maliyeti_try,
        leasing_maliyeti_try=seri.leasing_maliyeti_try,
        diger_maliyet_try=seri.diger_maliyet_try,
        toplam_maliyet_try=toplam_maliyet,
        satis_fiyati_try=seri.satis_fiyati_try,
        kar_zarar_try=kar_zarar,
        bakim_geliri_toplam=bakim_gelir,
        bakim_gideri_toplam=bakim_gider,
    )


# Hareket turu -> bu turun hangi tablodan nasil cekilecegini bilen fonksiyon eslemesi.
# Yeni bir hareket turu eklemek istendiginde sadece bu sozluge bir fonksiyon eklenir.
def _maas_satirlari(db, sirket_id, baslangic, bitis):
    sorgu = (
        select(PersonelOdeme, Personel.ad_soyad)
        .join(Personel, Personel.id == PersonelOdeme.personel_id)
        .where(Personel.sirket_id == sirket_id, PersonelOdeme.odendi_mi.is_(True))
    )
    if baslangic:
        sorgu = sorgu.where(PersonelOdeme.odeme_tarihi >= baslangic)
    if bitis:
        sorgu = sorgu.where(PersonelOdeme.odeme_tarihi <= bitis)
    return [
        HareketTuruSatiri(tarih=p.odeme_tarihi, tur="MAAS", aciklama=f"{ad} - {p.tip.value}", tutar=p.tutar)
        for p, ad in db.execute(sorgu).all()
    ]


def _kira_geliri_satirlari(db, sirket_id, baslangic, bitis):
    sorgu = (
        select(KiralamaOdeme, KiralamaSozlesme.kiraci_cari_id)
        .join(KiralamaSozlesme, KiralamaSozlesme.id == KiralamaOdeme.sozlesme_id)
        .where(KiralamaSozlesme.sirket_id == sirket_id, KiralamaOdeme.odendi_mi.is_(True))
    )
    if baslangic:
        sorgu = sorgu.where(KiralamaOdeme.odeme_tarihi >= baslangic)
    if bitis:
        sorgu = sorgu.where(KiralamaOdeme.odeme_tarihi <= bitis)
    return [
        HareketTuruSatiri(tarih=o.odeme_tarihi, tur="KIRA_GELIRI",
                           aciklama=f"Dönem: {o.donem_basi} - {o.donem_sonu}", tutar=o.tutar, cari_id=cari_id)
        for o, cari_id in db.execute(sorgu).all()
    ]


def _kira_gideri_satirlari(db, sirket_id, baslangic, bitis):
    sorgu = (
        select(SabitGider)
        .where(SabitGider.sirket_id == sirket_id, SabitGider.odendi_mi.is_(True))
    )
    if baslangic:
        sorgu = sorgu.where(SabitGider.odeme_tarihi >= baslangic)
    if bitis:
        sorgu = sorgu.where(SabitGider.odeme_tarihi <= bitis)
    satirlar = []
    for g in db.execute(sorgu).scalars():
        satirlar.append(HareketTuruSatiri(tarih=g.odeme_tarihi, tur="SABIT_GIDER",
                                           aciklama=g.aciklama, tutar=g.tutar))
    return satirlar


def _borc_odeme_satirlari(db, sirket_id, baslangic, bitis):
    sorgu = (
        select(BorcOdeme, Borc.cari_id)
        .join(Borc, Borc.id == BorcOdeme.borc_id)
        .where(Borc.sirket_id == sirket_id)
    )
    if baslangic:
        sorgu = sorgu.where(BorcOdeme.tarih >= baslangic)
    if bitis:
        sorgu = sorgu.where(BorcOdeme.tarih <= bitis)
    return [
        HareketTuruSatiri(tarih=o.tarih, tur="BORC_ODEME", aciklama=o.aciklama, tutar=o.tutar, cari_id=cari_id)
        for o, cari_id in db.execute(sorgu).all()
    ]


def _bakim_satirlari(db, sirket_id, baslangic, bitis, tip):
    sorgu = select(BakimKaydi).where(BakimKaydi.sirket_id == sirket_id, BakimKaydi.tip == tip)
    if baslangic:
        sorgu = sorgu.where(BakimKaydi.tarih >= baslangic)
    if bitis:
        sorgu = sorgu.where(BakimKaydi.tarih <= bitis)
    return [
        HareketTuruSatiri(tarih=b.tarih, tur=f"BAKIM_{tip.value}", aciklama=b.aciklama,
                           tutar=b.tutar, cari_id=b.ilgili_cari_id)
        for b in db.execute(sorgu).scalars()
    ]


def _akreditif_satirlari(db, sirket_id, baslangic, bitis):
    from app.models.akreditif import Akreditif, AkreditifKalemi
    from app.models.akreditif_taksit import AkreditifKalemTaksiti

    satirlar = []
    kalem_sorgu = (
        select(AkreditifKalemi, Akreditif.akreditif_no)
        .join(Akreditif, Akreditif.id == AkreditifKalemi.akreditif_id)
        .where(Akreditif.sirket_id == sirket_id, AkreditifKalemi.odendi_mi.is_(True))
    )
    for kalem, akreditif_no in db.execute(kalem_sorgu).all():
        satirlar.append(HareketTuruSatiri(
            tarih=kalem.vade_tarihi, tur="AKREDITIF",
            aciklama=f"Akreditif {akreditif_no or ''} - {kalem.tip.value} - {kalem.aciklama or ''}",
            tutar=kalem.tutar,
        ))

    taksit_sorgu = (
        select(AkreditifKalemTaksiti, Akreditif.akreditif_no)
        .join(AkreditifKalemi, AkreditifKalemi.id == AkreditifKalemTaksiti.kalem_id)
        .join(Akreditif, Akreditif.id == AkreditifKalemi.akreditif_id)
        .where(Akreditif.sirket_id == sirket_id, AkreditifKalemTaksiti.odendi_mi.is_(True))
    )
    for taksit, akreditif_no in db.execute(taksit_sorgu).all():
        satirlar.append(HareketTuruSatiri(
            tarih=taksit.vade_tarihi, tur="AKREDITIF",
            aciklama=f"Akreditif {akreditif_no or ''} - Taksit {taksit.taksit_no}",
            tutar=taksit.tutar,
        ))

    if baslangic:
        satirlar = [s for s in satirlar if s.tarih >= baslangic]
    if bitis:
        satirlar = [s for s in satirlar if s.tarih <= bitis]
    return satirlar


def _leasing_satirlari(db, sirket_id, baslangic, bitis):
    from app.models.finansal import LeasingOdeme, LeasingSozlesme

    sorgu = (
        select(LeasingOdeme, LeasingSozlesme.sozlesme_no)
        .join(LeasingSozlesme, LeasingSozlesme.id == LeasingOdeme.leasing_id)
        .where(LeasingSozlesme.sirket_id == sirket_id, LeasingOdeme.odendi_mi.is_(True))
    )
    if baslangic:
        sorgu = sorgu.where(LeasingOdeme.odeme_tarihi >= baslangic)
    if bitis:
        sorgu = sorgu.where(LeasingOdeme.odeme_tarihi <= bitis)
    return [
        HareketTuruSatiri(tarih=o.odeme_tarihi, tur="LEASING",
                           aciklama=f"Leasing {no or ''} - Taksit {o.taksit_no}", tutar=o.tutar)
        for o, no in db.execute(sorgu).all()
    ]


def _taksit_satirlari(db, sirket_id, baslangic, bitis):
    sorgu = (
        select(TaksitDetay, TaksitliSatisPlani.musteri_cari_id)
        .join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitDetay.plan_id)
        .where(TaksitliSatisPlani.sirket_id == sirket_id, TaksitDetay.odendi_mi.is_(True))
    )
    if baslangic:
        sorgu = sorgu.where(TaksitDetay.odeme_tarihi >= baslangic)
    if bitis:
        sorgu = sorgu.where(TaksitDetay.odeme_tarihi <= bitis)
    return [
        HareketTuruSatiri(tarih=t.odeme_tarihi, tur="TAKSIT",
                           aciklama=f"Taksit {t.taksit_no} tahsilatı", tutar=t.odenen_tutar or t.tutar, cari_id=cari_id)
        for t, cari_id in db.execute(sorgu).all()
    ]


def _cek_satirlari(db, sirket_id, baslangic, bitis):
    from app.models.finansal import CekGecmis, CekDurum as _CekDurum

    sorgu = (
        select(CekGecmis, Cek)
        .join(Cek, Cek.id == CekGecmis.cek_id)
        .where(
            Cek.sirket_id == sirket_id,
            CekGecmis.yeni_durum.in_([_CekDurum.TAHSIL_EDILDI, _CekDurum.ODENDI]),
        )
    )
    if baslangic:
        sorgu = sorgu.where(CekGecmis.tarih >= baslangic)
    if bitis:
        sorgu = sorgu.where(CekGecmis.tarih <= bitis)
    satirlar = []
    for gecmis, cek in db.execute(sorgu).all():
        isaret = 1 if gecmis.yeni_durum == _CekDurum.TAHSIL_EDILDI else -1
        satirlar.append(HareketTuruSatiri(
            tarih=gecmis.tarih, tur="CEK",
            aciklama=f"Çek {cek.cek_no or '#' + str(cek.id)} - {'Tahsilat' if isaret > 0 else 'Ödeme'}",
            tutar=isaret * cek.tutar, cari_id=cek.cari_id,
        ))
    return satirlar


def _stok_satis_satirlari(db, sirket_id, baslangic, bitis):
    sorgu = select(StokSeriNo).where(StokSeriNo.sirket_id == sirket_id, StokSeriNo.durum == StokDurum.SATILDI)
    if baslangic:
        sorgu = sorgu.where(StokSeriNo.satis_tarihi >= baslangic)
    if bitis:
        sorgu = sorgu.where(StokSeriNo.satis_tarihi <= bitis)
    return [
        HareketTuruSatiri(tarih=s.satis_tarihi, tur="STOK_SATIS",
                           aciklama=f"Satış - Seri No {s.seri_no}", tutar=s.satis_fiyati_try or Decimal("0"),
                           cari_id=s.musteri_cari_id)
        for s in db.execute(sorgu).scalars() if s.satis_tarihi is not None
    ]


_HAREKET_TURU_FONKSIYONLARI = {
    "MAAS": _maas_satirlari,
    "KIRA_GELIRI": _kira_geliri_satirlari,
    "SABIT_GIDER": _kira_gideri_satirlari,
    "BORC_ODEME": _borc_odeme_satirlari,
    "BAKIM_GELIRI": lambda db, s, b1, b2: _bakim_satirlari(db, s, b1, b2, BakimTip.GELIR),
    "BAKIM_GIDERI": lambda db, s, b1, b2: _bakim_satirlari(db, s, b1, b2, BakimTip.GIDER),
    "AKREDITIF": _akreditif_satirlari,
    "LEASING": _leasing_satirlari,
    "TAKSIT": _taksit_satirlari,
    "CEK": _cek_satirlari,
    "STOK_SATIS": _stok_satis_satirlari,
}


@router.get("/hareket-turu", response_model=HareketTuruRaporYaniti,
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def hareket_turu_raporu(
    tur: str = Query(..., description="MAAS, KIRA_GELIRI, SABIT_GIDER, BORC_ODEME, BAKIM_GELIRI, BAKIM_GIDERI, AKREDITIF, LEASING, TAKSIT, CEK, STOK_SATIS"),
    baslangic: date | None = None,
    bitis: date | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Sistemdeki farkli tablolara dagilmis hareketleri tek bir 'tur' uzerinden
    raporlar. Bu, Personel/Kiralama/SabitGider/Borc/Bakim/Akreditif/Leasing/
    Taksit/Cek/Stok modullerinin hepsinin ortak bir raporlama arayuzu
    altinda birlesmesini saglar.
    """
    fonksiyon = _HAREKET_TURU_FONKSIYONLARI.get(tur)
    if fonksiyon is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Geçersiz hareket türü: {tur}. Geçerli değerler: {list(_HAREKET_TURU_FONKSIYONLARI.keys())}"
        )
    satirlar = fonksiyon(db, sirket_id, baslangic, bitis)
    toplam = sum((s.tutar for s in satirlar), Decimal("0"))
    return HareketTuruRaporYaniti(tur=tur, toplam_tutar=toplam, adet=len(satirlar), satirlar=satirlar)


@router.get("/cari", response_model=list[HareketTuruSatiri],
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def cari_raporu(
    cari_id: int,
    baslangic: date | None = None,
    bitis: date | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")

    sorgu = select(CariHareket).where(CariHareket.cari_id == cari_id, CariHareket.sirket_id == sirket_id)
    if baslangic:
        sorgu = sorgu.where(CariHareket.tarih >= baslangic)
    if bitis:
        sorgu = sorgu.where(CariHareket.tarih <= bitis)
    sorgu = sorgu.order_by(CariHareket.tarih)

    return [
        HareketTuruSatiri(
            tarih=h.tarih, tur=h.yon.value, aciklama=h.aciklama,
            tutar=h.tutar if h.yon.value == "GIRIS" else -h.tutar, cari_id=cari_id,
        )
        for h in db.execute(sorgu).scalars()
    ]


@router.get("/ana-kasa-ozet", response_model=AnaKasaOzetYaniti,
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def ana_kasa_ozet(
    baslangic: date | None = None,
    bitis: date | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(KasaHareketi).where(KasaHareketi.sirket_id == sirket_id)
    if baslangic:
        sorgu = sorgu.where(KasaHareketi.tarih >= baslangic)
    if bitis:
        sorgu = sorgu.where(KasaHareketi.tarih <= bitis)
    hareketler = list(db.execute(sorgu).scalars())

    toplam_giris = sum((h.tutar_try_karsiligi or h.tutar for h in hareketler if h.yon.value == "GIRIS"), Decimal("0"))
    toplam_cikis = sum((h.tutar_try_karsiligi or h.tutar for h in hareketler if h.yon.value == "CIKIS"), Decimal("0"))

    return AnaKasaOzetYaniti(
        baslangic=baslangic, bitis=bitis,
        toplam_giris=toplam_giris, toplam_cikis=toplam_cikis,
        net_bakiye=toplam_giris - toplam_cikis,
    )


@router.get("/genel-bakis", response_model=GenelBakisYaniti,
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def genel_bakis(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Dashboard ekrani icin tek cagrida ozet bilgi: ana kasa bakiyesi,
    yaklasan cek vadeleri, geciken taksitler, depo durumu, aktif kiralamalar.
    """
    from app.models.banka import HareketYon

    tum_kasa = list(db.execute(select(KasaHareketi).where(KasaHareketi.sirket_id == sirket_id)).scalars())
    kasa_net = sum(
        (
            (h.tutar_try_karsiligi or 0) if h.yon.value == "GIRIS" else -(h.tutar_try_karsiligi or 0)
            for h in tum_kasa
        ), Decimal("0")
    )

    bugun = date.today()
    yedi_gun_sonra = bugun + timedelta(days=7)
    yaklasan_cekler = list(db.execute(
        select(Cek).where(
            Cek.sirket_id == sirket_id,
            Cek.durum == CekDurum.PORTFOYDE,
            Cek.vade_tarihi <= yedi_gun_sonra,
            Cek.vade_tarihi >= bugun,
        )
    ).scalars())

    geciken_taksitler = list(db.execute(
        select(TaksitDetay)
        .join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitDetay.plan_id)
        .where(
            TaksitliSatisPlani.sirket_id == sirket_id,
            TaksitDetay.odendi_mi.is_(False),
            TaksitDetay.vade_tarihi < bugun,
        )
    ).scalars())

    depodaki_sayisi = db.execute(
        select(func.count()).select_from(StokSeriNo)
        .where(StokSeriNo.sirket_id == sirket_id, StokSeriNo.durum == StokDurum.DEPODA)
    ).scalar_one()

    aktif_kiralama_sayisi = db.execute(
        select(func.count()).select_from(KiralamaSozlesme)
        .where(KiralamaSozlesme.sirket_id == sirket_id, KiralamaSozlesme.durum == "AKTIF")
    ).scalar_one()

    return GenelBakisYaniti(
        ana_kasa_bakiye_try=kasa_net,
        banka_toplam_try_karsiligi_not="Banka bakiyeleri çoklu para birimi içerir; toplu TL karşılığı için kur tablosu entegrasyonu gerekir (sonraki adım).",
        vadesi_yaklasan_cek_sayisi=len(yaklasan_cekler),
        vadesi_yaklasan_cek_toplami=sum((c.tutar for c in yaklasan_cekler), Decimal("0")),
        geciken_taksit_sayisi=len(geciken_taksitler),
        geciken_taksit_toplami=sum((t.tutar for t in geciken_taksitler), Decimal("0")),
        depodaki_urun_sayisi=depodaki_sayisi,
        aktif_kiralama_sayisi=aktif_kiralama_sayisi,
    )


@router.get("/yaklasan-vadeler", response_model=YaklasanVadelerYaniti,
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def yaklasan_vadeler(
    gun: int = Query(30, description="Kac gun ileriye kadar vadeler getirilsin"),
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Genel Bakis ekrani icin: onumuzdeki `gun` gun icinde vadesi gelecek
    tum odemeleri (para cikisi) ve tahsilatlari (para girisi) tek bir
    listede, kaynagi ne olursa olsun (cek/leasing/akreditif/taksit/kira)
    birlestirip tarihe gore siralar.
    """
    from app.models.finansal import CekTip, LeasingSozlesme, LeasingOdeme
    from app.models.akreditif import Akreditif, AkreditifKalemi

    bugun = date.today()
    son_tarih = bugun + timedelta(days=gun)

    odemeler: list[YaklasanVadeSatiri] = []
    tahsilatlar: list[YaklasanVadeSatiri] = []

    # --- Çek: VERİLEN -> odeme, ALINAN -> tahsilat
    cekler = list(db.execute(
        select(Cek).where(
            Cek.sirket_id == sirket_id,
            Cek.durum == CekDurum.PORTFOYDE,
            Cek.vade_tarihi >= bugun,
            Cek.vade_tarihi <= son_tarih,
        )
    ).scalars())
    for c in cekler:
        satir = YaklasanVadeSatiri(
            tarih=c.vade_tarihi, tur="CEK",
            aciklama=f"Çek {c.cek_no or ('#' + str(c.id))}",
            tutar=c.tutar, para_birimi=c.para_birimi.value,
        )
        (odemeler if c.tip == CekTip.VERILEN else tahsilatlar).append(satir)

    # --- Leasing ödemeleri -> odeme
    leasing_odemeleri = list(db.execute(
        select(LeasingOdeme, LeasingSozlesme.sozlesme_no, LeasingSozlesme.para_birimi)
        .join(LeasingSozlesme, LeasingSozlesme.id == LeasingOdeme.leasing_id)
        .where(
            LeasingSozlesme.sirket_id == sirket_id,
            LeasingOdeme.odendi_mi.is_(False),
            LeasingOdeme.vade_tarihi >= bugun,
            LeasingOdeme.vade_tarihi <= son_tarih,
        )
    ).all())
    for odeme, sozlesme_no, para_birimi in leasing_odemeleri:
        odemeler.append(YaklasanVadeSatiri(
            tarih=odeme.vade_tarihi, tur="LEASING",
            aciklama=f"Leasing {sozlesme_no or ''} - Taksit {odeme.taksit_no}",
            tutar=odeme.tutar, para_birimi=para_birimi.value,
        ))

    # --- Akreditif kalemleri -> odeme
    akreditif_kalemleri = list(db.execute(
        select(AkreditifKalemi, Akreditif.akreditif_no, Akreditif.para_birimi)
        .join(Akreditif, Akreditif.id == AkreditifKalemi.akreditif_id)
        .where(
            Akreditif.sirket_id == sirket_id,
            AkreditifKalemi.odendi_mi.is_(False),
            AkreditifKalemi.vade_tarihi >= bugun,
            AkreditifKalemi.vade_tarihi <= son_tarih,
        )
    ).all())
    for kalem, akreditif_no, para_birimi in akreditif_kalemleri:
        odemeler.append(YaklasanVadeSatiri(
            tarih=kalem.vade_tarihi, tur="AKREDITIF",
            aciklama=f"Akreditif {akreditif_no or ''} - {kalem.tip.value}",
            tutar=kalem.tutar, para_birimi=para_birimi,
        ))

    # --- Taksitli satış taksitleri -> tahsilat
    taksitler = list(db.execute(
        select(TaksitDetay, TaksitliSatisPlani.para_birimi)
        .join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitDetay.plan_id)
        .where(
            TaksitliSatisPlani.sirket_id == sirket_id,
            TaksitDetay.odendi_mi.is_(False),
            TaksitDetay.vade_tarihi >= bugun,
            TaksitDetay.vade_tarihi <= son_tarih,
        )
    ).all())
    for taksit, para_birimi in taksitler:
        tahsilatlar.append(YaklasanVadeSatiri(
            tarih=taksit.vade_tarihi, tur="TAKSIT",
            aciklama=f"Taksit {taksit.taksit_no}",
            tutar=taksit.tutar, para_birimi=para_birimi.value,
        ))

    # --- Kiralama ödemeleri -> tahsilat (donem_sonu vade kabul edilir)
    kira_odemeleri = list(db.execute(
        select(KiralamaOdeme, KiralamaSozlesme.para_birimi)
        .join(KiralamaSozlesme, KiralamaSozlesme.id == KiralamaOdeme.sozlesme_id)
        .where(
            KiralamaSozlesme.sirket_id == sirket_id,
            KiralamaOdeme.odendi_mi.is_(False),
            KiralamaOdeme.donem_sonu >= bugun,
            KiralamaOdeme.donem_sonu <= son_tarih,
        )
    ).all())
    for odeme, para_birimi in kira_odemeleri:
        tahsilatlar.append(YaklasanVadeSatiri(
            tarih=odeme.donem_sonu, tur="KIRA",
            aciklama=f"Kira dönemi {odeme.donem_basi} - {odeme.donem_sonu}",
            tutar=odeme.tutar, para_birimi=para_birimi.value,
        ))

    odemeler.sort(key=lambda s: s.tarih)
    tahsilatlar.sort(key=lambda s: s.tarih)

    return YaklasanVadelerYaniti(
        odemeler=odemeler,
        odemeler_toplam=sum((s.tutar for s in odemeler), Decimal("0")),
        tahsilatlar=tahsilatlar,
        tahsilatlar_toplam=sum((s.tutar for s in tahsilatlar), Decimal("0")),
    )


@router.get("/depo-envanteri", response_model=list[DepoEnvanterSatiri],
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def depo_envanteri(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Depodaki (durum=DEPODA) urunleri stok karti bazinda gruplar; her grup
    icin adet ve toplam maliyet degerini hesaplar. Genel Bakis ekraninda
    'urun turune gore depo degeri' gorunumu icin kullanilir.
    """
    kayitlar = list(db.execute(
        select(StokSeriNo, StokKarti)
        .join(StokKarti, StokKarti.id == StokSeriNo.stok_karti_id)
        .where(StokSeriNo.sirket_id == sirket_id, StokSeriNo.durum == StokDurum.DEPODA)
    ).all())

    gruplar: dict[int, dict] = {}
    for seri, kart in kayitlar:
        toplam = (seri.satinalma_maliyeti_try + seri.nakliye_maliyeti_try +
                  seri.gumruk_maliyeti_try + seri.antrepo_maliyeti_try +
                  seri.millilestirme_maliyeti_try + seri.leasing_maliyeti_try +
                  seri.diger_maliyet_try)
        grup = gruplar.setdefault(kart.id, {
            "stok_karti_id": kart.id, "marka": kart.marka, "model": kart.model,
            "birim": kart.birim, "adet": 0, "toplam_deger_try": Decimal("0"),
        })
        grup["adet"] += 1
        grup["toplam_deger_try"] += toplam

    return [DepoEnvanterSatiri(**g) for g in gruplar.values()]


@router.get("/aktif-kiralamalar", response_model=list[AktifKiralamaSatiri],
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def aktif_kiralamalar(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Aktif kiralama sozlesmelerini urun bilgisi ve kiraci unvaniyla birlikte
    getirir. Genel Bakis ekraninda 'kime kiralandi, ne kadara' gorunumu icin.
    """
    kayitlar = list(db.execute(
        select(KiralamaSozlesme, StokSeriNo, StokKarti, CariHesap)
        .join(StokSeriNo, StokSeriNo.id == KiralamaSozlesme.stok_seri_no_id)
        .join(StokKarti, StokKarti.id == StokSeriNo.stok_karti_id)
        .join(CariHesap, CariHesap.id == KiralamaSozlesme.kiraci_cari_id)
        .where(KiralamaSozlesme.sirket_id == sirket_id, KiralamaSozlesme.durum == "AKTIF")
    ).all())

    return [
        AktifKiralamaSatiri(
            stok_seri_no_id=seri.id, marka=kart.marka, model=kart.model, seri_no=seri.seri_no,
            kiraci_unvan=cari.unvan, aylik_kira_tutari=sozlesme.aylik_kira_tutari,
            para_birimi=sozlesme.para_birimi.value,
        )
        for sozlesme, seri, kart, cari in kayitlar
    ]


class NetDurumKalemi(BaseModel):
    kategori: str
    tutar_try: Decimal


class NetDurumYaniti(BaseModel):
    varliklar: list[NetDurumKalemi]
    alacaklar: list[NetDurumKalemi]
    borclar: list[NetDurumKalemi]
    toplam_varlik_try: Decimal
    toplam_alacak_try: Decimal
    toplam_borc_try: Decimal
    net_deger_try: Decimal


@router.get("/net-durum", response_model=NetDurumYaniti,
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
async def net_durum(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Sirketin genel mali durumunun (bilanco benzeri) ozeti: nakit + stok
    (VARLIK), musteri/cek/taksit/kiralama alacaklari (ALACAK), akreditif/
    leasing/cek/ortak-dis borc/tedarikci (BORC) kalemlerini TL karsiligi
    olarak toplar. Dovizli kalemler icin GUNCEL kur kullanilir (gecmis
    kur degil) - bu yuzden rakam gunden gune kur hareketine gore
    degisebilir, sadece 'su an' icin yaklasik bir gostergedir.
    """
    kur_cache: dict[str, Decimal] = {}

    async def kur_getir(pb: str) -> Decimal:
        if pb == "TRY":
            return Decimal("1")
        if pb not in kur_cache:
            k = await guncel_kur_getir(pb)
            kur_cache[pb] = Decimal(str(k)) if k else Decimal("0")
        return kur_cache[pb]

    # ------------------------------------------------------------- VARLIKLAR
    # 1) Ana Kasa (nakit)
    kasa_hareketleri = list(db.execute(select(KasaHareketi).where(KasaHareketi.sirket_id == sirket_id)).scalars())
    kasa_bakiye_try = Decimal("0")
    for h in kasa_hareketleri:
        tutar_try = h.tutar_try_karsiligi if h.tutar_try_karsiligi is not None else h.tutar
        kasa_bakiye_try += tutar_try if h.yon == "GIRIS" else -tutar_try

    # 2) Banka (guncel kurla TL karsiligi)
    banka_sorgu = (
        select(BankaHesabi.para_birimi, func.coalesce(func.sum(BankaHareketi.tutar), 0).label("bakiye"))
        .outerjoin(BankaHareketi, BankaHareketi.banka_hesap_id == BankaHesabi.id)
        .where(BankaHesabi.sirket_id == sirket_id)
        .group_by(BankaHesabi.id, BankaHesabi.para_birimi)
    )
    banka_bakiye_try = Decimal("0")
    for r in db.execute(banka_sorgu).all():
        kur = await kur_getir(r.para_birimi)
        banka_bakiye_try += Decimal(r.bakiye) * kur

    # 3) Stok (henuz SATILMAMIS urunlerin toplam maliyeti)
    stok_urunleri = list(db.execute(
        select(StokSeriNo).where(StokSeriNo.sirket_id == sirket_id, StokSeriNo.durum != StokDurum.SATILDI)
    ).scalars())
    stok_degeri_try = sum((
        u.satinalma_maliyeti_try + u.nakliye_maliyeti_try + u.gumruk_maliyeti_try +
        u.antrepo_maliyeti_try + u.millilestirme_maliyeti_try + u.leasing_maliyeti_try + u.diger_maliyet_try
        for u in stok_urunleri
    ), Decimal("0"))

    # 4) Yedek parca / sarf malzeme
    yedek_parcalar = list(db.execute(select(YedekParca).where(YedekParca.sirket_id == sirket_id)).scalars())
    yedek_parca_degeri_try = sum((p.mevcut_miktar * p.birim_fiyat_try for p in yedek_parcalar), Decimal("0"))

    # ------------------------------------------------------------- ALACAKLAR
    # 5) NOT: Ayri bir "Cari Hesaplardan Alacak/Borc" kalemi KASITLI
    # OLARAK YOK. Nedeni: CariHareket tablosu sistemde hicbir yerde
    # doldurulmuyor (para_hareketi_olustur da dahil hicbir servis
    # CariHareket veya CariHesap.bakiye_try/usd/eur alanlarini
    # guncellemiyor) - doldursak bile bu "cari ile net nakit akisi"
    # anlamina gelir, "kalan borc/alacak" ile AYNI sey degildir (orn.
    # bir tedarikciye yapilan odemeler "borcumuz var" degil "simdiye
    # kadar odedik" demektir). Her modulun (Siparis, Taksit, Kiralama,
    # Akreditif, Leasing, Cek, Ortak Borc) KENDI dogru "kalan bakiye"
    # hesabi zaten asagida ayri ayri yer aliyor; ayrica bir "Cari"
    # kalemi eklemek yanlis anlasilmaya/cift sayima yol acardi.

    # 6) Taksitli satis - henuz tahsil edilmemis taksitlerin toplami (TRY sabit)
    taksitli_taksitler = list(db.execute(
        select(TaksitDetay)
        .join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitDetay.plan_id)
        .where(TaksitliSatisPlani.sirket_id == sirket_id, TaksitDetay.odendi_mi.is_(False))
    ).scalars())
    taksit_alacak_try = sum((t.tutar for t in taksitli_taksitler), Decimal("0"))

    # 7) Kiralama - henuz tahsil edilmemis donemlerin toplami
    kiralama_sozlesmeler = {
        s.id: s for s in db.execute(select(KiralamaSozlesme).where(KiralamaSozlesme.sirket_id == sirket_id)).scalars()
    }
    kiralama_odemeleri = list(db.execute(
        select(KiralamaOdeme).where(
            KiralamaOdeme.sozlesme_id.in_(list(kiralama_sozlesmeler.keys())) if kiralama_sozlesmeler else False,
            KiralamaOdeme.odendi_mi.is_(False),
        )
    ).scalars()) if kiralama_sozlesmeler else []
    kiralama_alacak_try = Decimal("0")
    for o in kiralama_odemeleri:
        sozlesme = kiralama_sozlesmeler.get(o.sozlesme_id)
        pb = sozlesme.para_birimi.value if sozlesme else "TRY"
        kur = await kur_getir(pb)
        kiralama_alacak_try += o.tutar * kur

    # 8) Alinan cekler (portfoyde, henuz tahsil edilmemis)
    alinan_cekler = list(db.execute(
        select(Cek).where(Cek.sirket_id == sirket_id, Cek.durum == CekDurum.PORTFOYDE, Cek.tip == CekTip.ALINAN)
    ).scalars())
    cek_alacak_try = Decimal("0")
    for c in alinan_cekler:
        kur = await kur_getir(c.para_birimi.value if hasattr(c.para_birimi, "value") else c.para_birimi)
        cek_alacak_try += c.tutar * kur

    # 9) Ortaga verilen borclarin kalan bakiyesi (bize geri donecek)
    tum_borclar = list(db.execute(select(Borc).where(Borc.sirket_id == sirket_id)).scalars())
    ortak_alacak_try = Decimal("0")
    ortak_borc_try = Decimal("0")
    for b in tum_borclar:
        odenen = db.execute(
            select(func.coalesce(func.sum(BorcOdeme.tutar), 0)).where(BorcOdeme.borc_id == b.id)
        ).scalar_one()
        kalan = b.tutar - odenen
        if kalan <= 0:
            continue
        pb = b.para_birimi.value if hasattr(b.para_birimi, "value") else b.para_birimi
        kur = await kur_getir(pb)
        kalan_try = kalan * kur
        if b.tip == BorcTip.ORTAGA_VERILEN:
            ortak_alacak_try += kalan_try
        else:
            ortak_borc_try += kalan_try

    # --------------------------------------------------------------- BORCLAR
    # 10) Akreditif - toplam LIMIT (tutar) eksi simdiye kadar fiilen odenen kisim.
    # Kalem eklenmemis olsa bile acik akreditifin tamami taahhut/borc sayilir -
    # sadece kalem uzerinden gitmek, henuz kalem girilmemis akreditifleri
    # bilancodan tamamen dusuruyordu (yanlis olurdu).
    acik_akreditifler = list(db.execute(
        select(Akreditif).where(Akreditif.sirket_id == sirket_id, Akreditif.durum != AkreditifDurum.IPTAL)
    ).scalars())
    akreditif_borc_try = Decimal("0")
    for ak in acik_akreditifler:
        kalemler = list(db.execute(select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == ak.id)).scalars())
        pb = ak.para_birimi if isinstance(ak.para_birimi, str) else ak.para_birimi.value
        kur = await kur_getir(pb)
        odenen_toplam = Decimal("0")
        for k in kalemler:
            if k.odendi_mi:
                odenen_toplam += k.tutar
                continue
            taksitler = list(db.execute(select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id == k.id)).scalars())
            odenen_toplam += sum((t.tutar for t in taksitler if t.odendi_mi), Decimal("0"))
        kalan_borc = ak.tutar - odenen_toplam
        if kalan_borc > 0:
            akreditif_borc_try += kalan_borc * kur

    # 11) Leasing - odenmemis taksitler
    leasing_sozlesmeler = list(db.execute(select(LeasingSozlesme).where(LeasingSozlesme.sirket_id == sirket_id)).scalars())
    leasing_borc_try = Decimal("0")
    for l in leasing_sozlesmeler:
        odemeler = list(db.execute(
            select(LeasingOdeme).where(LeasingOdeme.leasing_id == l.id, LeasingOdeme.odendi_mi.is_(False))
        ).scalars())
        pb = l.para_birimi if isinstance(l.para_birimi, str) else l.para_birimi.value
        kur = await kur_getir(pb)
        leasing_borc_try += sum((o.tutar for o in odemeler), Decimal("0")) * kur

    # 12) Verilen cekler (portfoyde, henuz odenmemis)
    verilen_cekler = list(db.execute(
        select(Cek).where(Cek.sirket_id == sirket_id, Cek.durum == CekDurum.PORTFOYDE, Cek.tip == CekTip.VERILEN)
    ).scalars())
    cek_borc_try = Decimal("0")
    for c in verilen_cekler:
        kur = await kur_getir(c.para_birimi.value if hasattr(c.para_birimi, "value") else c.para_birimi)
        cek_borc_try += c.tutar * kur

    # 13b) Personele tahakkuk etmis, henuz odenmemis maas/avans/prim (TRY sabit)
    odenmemis_personel_odemeleri = list(db.execute(
        select(PersonelOdeme)
        .join(Personel, Personel.id == PersonelOdeme.personel_id)
        .where(Personel.sirket_id == sirket_id, PersonelOdeme.odendi_mi.is_(False))
    ).scalars())
    personel_borc_try = sum((o.tutar for o in odenmemis_personel_odemeleri), Decimal("0"))

    # 13c) Odenmemis diger giderler (dovizli olabilir, tutar_try hazir)
    odenmemis_giderler = list(db.execute(
        select(SabitGider).where(SabitGider.sirket_id == sirket_id, SabitGider.odendi_mi.is_(False))
    ).scalars())
    diger_gider_borc_try = sum((g.tutar_try for g in odenmemis_giderler), Decimal("0"))

    # 13) Tedarikciye olan kalan borc (siparisler)
    # ONEMLI: Akreditifli bir siparisin odemesi AKREDITIF uzerinden
    # yapilir (SiparisOdeme uzerinden degil), ve o akreditifin tutari
    # zaten yukarida (10. adim) "Akreditif (Odenmemis)" kaleminde AYRICA
    # borc olarak sayiliyor. Bu yuzden bu siparise bagli acik akreditif
    # varsa, o akreditifin tutarini burada "odenmis" gibi dusuyoruz -
    # aksi halde AYNI borc iki kere sayilirdi (hem Siparis hem Akreditif
    # kaleminde).
    siparisler = list(db.execute(
        select(Siparis).where(Siparis.sirket_id == sirket_id, Siparis.durum.notin_(["TASLAK", "IPTAL"]))
    ).scalars())
    siparis_borc_try = Decimal("0")
    for s in siparisler:
        urunler = list(db.execute(select(SiparisDetay).where(SiparisDetay.siparis_id == s.id)).scalars())
        toplam_tutar = sum((u.miktar * u.birim_fiyat for u in urunler), Decimal("0"))
        odenen = db.execute(
            select(func.coalesce(func.sum(SiparisOdeme.tutar), 0)).where(SiparisOdeme.siparis_id == s.id)
        ).scalar_one()
        pb = s.para_birimi if isinstance(s.para_birimi, str) else s.para_birimi.value
        kur = await kur_getir(pb)
        kalan_try = (toplam_tutar - odenen) * kur

        ilgili_akreditifler = [ak for ak in acik_akreditifler if ak.siparis_id == s.id]
        for ak in ilgili_akreditifler:
            ak_pb = ak.para_birimi if isinstance(ak.para_birimi, str) else ak.para_birimi.value
            ak_kur = await kur_getir(ak_pb)
            kalan_try -= ak.tutar * ak_kur

        if kalan_try > 0:
            siparis_borc_try += kalan_try

    varliklar = [
        NetDurumKalemi(kategori="Ana Kasa (Nakit)", tutar_try=kasa_bakiye_try),
        NetDurumKalemi(kategori="Banka", tutar_try=banka_bakiye_try),
        NetDurumKalemi(kategori="Stok (satılmamış ürünler)", tutar_try=stok_degeri_try),
        NetDurumKalemi(kategori="Yedek Parça / Sarf Malzeme", tutar_try=yedek_parca_degeri_try),
    ]
    alacaklar = [
        NetDurumKalemi(kategori="Taksitli Satış Alacağı", tutar_try=taksit_alacak_try),
        NetDurumKalemi(kategori="Kiralama Tahsilat Alacağı", tutar_try=kiralama_alacak_try),
        NetDurumKalemi(kategori="Alınan Çekler (Portföyde)", tutar_try=cek_alacak_try),
        NetDurumKalemi(kategori="Ortağa Verilen Borç (Alacak)", tutar_try=ortak_alacak_try),
    ]
    borclar = [
        NetDurumKalemi(kategori="Akreditif (Ödenmemiş)", tutar_try=akreditif_borc_try),
        NetDurumKalemi(kategori="Leasing (Ödenmemiş Taksitler)", tutar_try=leasing_borc_try),
        NetDurumKalemi(kategori="Verilen Çekler (Portföyde)", tutar_try=cek_borc_try),
        NetDurumKalemi(kategori="Ortaktan/Dışarıdan Alınan Borç", tutar_try=ortak_borc_try),
        NetDurumKalemi(kategori="Tedarikçilere Olan Borç (Sipariş)", tutar_try=siparis_borc_try),
        NetDurumKalemi(kategori="Personele Ödenmemiş Tahakkuklar", tutar_try=personel_borc_try),
        NetDurumKalemi(kategori="Ödenmemiş Diğer Giderler", tutar_try=diger_gider_borc_try),
    ]

    toplam_varlik = sum((v.tutar_try for v in varliklar), Decimal("0"))
    toplam_alacak = sum((a.tutar_try for a in alacaklar), Decimal("0"))
    toplam_borc = sum((b.tutar_try for b in borclar), Decimal("0"))

    return NetDurumYaniti(
        varliklar=varliklar, alacaklar=alacaklar, borclar=borclar,
        toplam_varlik_try=toplam_varlik, toplam_alacak_try=toplam_alacak, toplam_borc_try=toplam_borc,
        net_deger_try=(toplam_varlik + toplam_alacak) - toplam_borc,
    )
