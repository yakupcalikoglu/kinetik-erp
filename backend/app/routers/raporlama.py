from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir
from app.models.stok import StokSeriNo, StokKarti, StokDurum
from app.models.cari import CariHesap, CariHareket
from app.models.banka import KasaHareketi
from app.models.finansal import (
    Cek, CekDurum, TaksitDetay, TaksitliSatisPlani,
    KiralamaOdeme, KiralamaSozlesme, BakimKaydi, BakimTip,
)
from app.models.diger import PersonelOdeme, Personel, SabitGider, BorcOdeme, Borc
from app.schemas.raporlama import (
    SeriNoRaporYaniti, HareketTuruRaporYaniti, HareketTuruSatiri,
    AnaKasaOzetYaniti, GenelBakisYaniti, YaklasanVadeSatiri, YaklasanVadelerYaniti,
)

router = APIRouter(prefix="/raporlar", tags=["Raporlama"])


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


_HAREKET_TURU_FONKSIYONLARI = {
    "MAAS": _maas_satirlari,
    "KIRA_GELIRI": _kira_geliri_satirlari,
    "SABIT_GIDER": _kira_gideri_satirlari,
    "BORC_ODEME": _borc_odeme_satirlari,
    "BAKIM_GELIRI": lambda db, s, b1, b2: _bakim_satirlari(db, s, b1, b2, BakimTip.GELIR),
    "BAKIM_GIDERI": lambda db, s, b1, b2: _bakim_satirlari(db, s, b1, b2, BakimTip.GIDER),
}


@router.get("/hareket-turu", response_model=HareketTuruRaporYaniti,
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def hareket_turu_raporu(
    tur: str = Query(..., description="MAAS, KIRA_GELIRI, SABIT_GIDER, BORC_ODEME, BAKIM_GELIRI, BAKIM_GIDERI"),
    baslangic: date | None = None,
    bitis: date | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Sistemdeki farkli tablolara dagilmis hareketleri tek bir 'tur' uzerinden
    raporlar. Bu, Personel/Kiralama/SabitGider/Borc/Bakim modullerinin
    hepsinin ortak bir raporlama arayuzu altinda birlesmesini saglar.
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

    toplam_giris = sum((h.tutar_try for h in hareketler if h.yon.value == "GIRIS"), Decimal("0"))
    toplam_cikis = sum((h.tutar_try for h in hareketler if h.yon.value == "CIKIS"), Decimal("0"))

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
        (h.tutar_try if h.yon.value == "GIRIS" else -h.tutar_try for h in tum_kasa), Decimal("0")
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
