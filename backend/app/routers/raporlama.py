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
    LeasingOdeme, LeasingSozlesme, KiralamaSozlesmeKalemi, KiralamaKalemUrunu,
    PosTaksitDetay, PosTaksitPlani,
)
from app.models.akreditif import Akreditif, AkreditifKalemi, AkreditifDurum
from app.models.akreditif_taksit import AkreditifKalemTaksiti
from app.models.diger import PersonelOdeme, Personel, SabitGider, BorcOdeme, Borc, BorcTip
from app.models.yedek_parca import YedekParca
from app.models.demirbas import Demirbas
from app.services.kur_servisi import guncel_kur_getir
from app.schemas.raporlama import (
    SeriNoRaporYaniti, HareketTuruRaporYaniti, HareketTuruSatiri,
    AnaKasaOzetYaniti, GenelBakisYaniti, YaklasanVadeSatiri, YaklasanVadelerYaniti,
    NakitAkisSatiri, NakitAkisTahminiYaniti,
    DepoEnvanterSatiri, AktifKiralamaSatiri,
)

router = APIRouter(prefix="/raporlar", tags=["Raporlama"])

from pydantic import BaseModel
from datetime import datetime


class KarMarjiSatiri(BaseModel):
    stok_karti_id: int
    urun_adi: str
    adet_satildi: int
    toplam_maliyet_try: Decimal
    toplam_satis_try: Decimal
    toplam_kar_try: Decimal
    ortalama_kar_marji_yuzde: Decimal


class HarcamaTuruSatiri(BaseModel):
    kategori: str
    adet: int
    toplam_tutar_try: Decimal
    odenen_tutar_try: Decimal
    odenmemis_tutar_try: Decimal


@router.get("/harcama-turleri-ozeti", response_model=list[HarcamaTuruSatiri],
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def harcama_turleri_ozeti(
    baslangic: date | None = None,
    bitis: date | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Diger Giderler'deki (SabitGider) her bir harcama turu/kategori icin
    (Elektrik, Su, Kira, Nakliye vb. - serbest metin oldugu icin kullanici
    ne yazdiysa o) toplam, odenen ve odenmemis tutari TL cinsinden ozetler.
    """
    sorgu = select(SabitGider).where(SabitGider.sirket_id == sirket_id)
    if baslangic:
        sorgu = sorgu.where(SabitGider.donem >= baslangic)
    if bitis:
        sorgu = sorgu.where(SabitGider.donem <= bitis)
    giderler = list(db.execute(sorgu).scalars())

    gruplar: dict[str, dict] = {}
    for g in giderler:
        kategori = (g.kategori or "Diğer").strip() or "Diğer"
        grup = gruplar.setdefault(kategori, {"adet": 0, "toplam": Decimal("0"), "odenen": Decimal("0")})
        grup["adet"] += 1
        grup["toplam"] += g.tutar_try
        if g.odendi_mi:
            grup["odenen"] += g.tutar_try

    sonuc = [
        HarcamaTuruSatiri(
            kategori=kategori, adet=g["adet"], toplam_tutar_try=g["toplam"],
            odenen_tutar_try=g["odenen"], odenmemis_tutar_try=g["toplam"] - g["odenen"],
        )
        for kategori, g in gruplar.items()
    ]
    sonuc.sort(key=lambda s: s.toplam_tutar_try, reverse=True)
    return sonuc


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
            u.satinalma_maliyeti_try + u.nakliye_maliyeti_try + u.sigorta_maliyeti_try + u.gumruk_maliyeti_try +
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

    toplam_maliyet = (seri.satinalma_maliyeti_try + seri.nakliye_maliyeti_try + seri.sigorta_maliyeti_try +
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
    sonuc = []
    for o, cari_id in db.execute(sorgu).all():
        cari = db.get(CariHesap, cari_id) if cari_id else None
        sonuc.append(HareketTuruSatiri(
            tarih=o.odeme_tarihi, tur="KIRA_GELIRI",
            aciklama=f"Dönem: {o.donem_basi} - {o.donem_sonu}" + (f" — {cari.unvan}" if cari else ""),
            tutar=o.tutar, cari_id=cari_id, cari_unvan=cari.unvan if cari else None,
        ))
    return sonuc


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
        aciklama = f"{g.kategori or 'Diğer'}" + (f" — {g.aciklama}" if g.aciklama else "")
        satirlar.append(HareketTuruSatiri(tarih=g.odeme_tarihi, tur="SABIT_GIDER",
                                           aciklama=aciklama, tutar=g.tutar_try))
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
    sonuc = []
    for o, cari_id in db.execute(sorgu).all():
        cari = db.get(CariHesap, cari_id) if cari_id else None
        sonuc.append(HareketTuruSatiri(
            tarih=o.tarih, tur="BORC_ODEME",
            aciklama=(o.aciklama or "Borç ödemesi") + (f" — {cari.unvan}" if cari else ""),
            tutar=o.tutar, cari_id=cari_id, cari_unvan=cari.unvan if cari else None,
        ))
    return sonuc


def _bakim_satirlari(db, sirket_id, baslangic, bitis, tip):
    sorgu = select(BakimKaydi).where(BakimKaydi.sirket_id == sirket_id, BakimKaydi.tip == tip)
    if baslangic:
        sorgu = sorgu.where(BakimKaydi.tarih >= baslangic)
    if bitis:
        sorgu = sorgu.where(BakimKaydi.tarih <= bitis)
    kayitlar = list(db.execute(sorgu).scalars())

    urun_haritasi = {}
    if kayitlar:
        urunler = list(db.execute(
            select(StokSeriNo).where(StokSeriNo.id.in_([k.stok_seri_no_id for k in kayitlar]))
        ).scalars())
        kart_haritasi = {
            kart.id: kart for kart in db.execute(
                select(StokKarti).where(StokKarti.id.in_([u.stok_karti_id for u in urunler]))
            ).scalars()
        } if urunler else {}
        urun_haritasi = {
            u.id: f"{u.seri_no}" + (f" ({kart_haritasi[u.stok_karti_id].marka} {kart_haritasi[u.stok_karti_id].model})" if u.stok_karti_id in kart_haritasi else "")
            for u in urunler
        }

    sonuc = []
    for b in kayitlar:
        cari = db.get(CariHesap, b.ilgili_cari_id) if b.ilgili_cari_id else None
        urun_bilgisi = urun_haritasi.get(b.stok_seri_no_id, f"#{b.stok_seri_no_id}")
        aciklama_parcalari = [urun_bilgisi]
        if b.aciklama:
            aciklama_parcalari.append(b.aciklama)
        if cari:
            aciklama_parcalari.append(cari.unvan)
        sonuc.append(HareketTuruSatiri(
            tarih=b.tarih, tur=f"BAKIM_{tip.value}", aciklama=" — ".join(aciklama_parcalari),
            tutar=b.tutar, cari_id=b.ilgili_cari_id, cari_unvan=cari.unvan if cari else None,
        ))
    return sonuc


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
        select(LeasingOdeme, LeasingSozlesme.sozlesme_no, LeasingSozlesme.leasing_firmasi_cari_id)
        .join(LeasingSozlesme, LeasingSozlesme.id == LeasingOdeme.leasing_id)
        .where(LeasingSozlesme.sirket_id == sirket_id, LeasingOdeme.odendi_mi.is_(True))
    )
    if baslangic:
        sorgu = sorgu.where(LeasingOdeme.odeme_tarihi >= baslangic)
    if bitis:
        sorgu = sorgu.where(LeasingOdeme.odeme_tarihi <= bitis)
    sonuc = []
    for o, no, firma_cari_id in db.execute(sorgu).all():
        cari = db.get(CariHesap, firma_cari_id) if firma_cari_id else None
        sonuc.append(HareketTuruSatiri(
            tarih=o.odeme_tarihi, tur="LEASING",
            aciklama=f"Leasing {no or ''} - Taksit {o.taksit_no}" + (f" — {cari.unvan}" if cari else ""),
            tutar=o.tutar, cari_id=firma_cari_id, cari_unvan=cari.unvan if cari else None,
        ))
    return sonuc


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
    sonuc = []
    for t, cari_id in db.execute(sorgu).all():
        cari = db.get(CariHesap, cari_id) if cari_id else None
        sonuc.append(HareketTuruSatiri(
            tarih=t.odeme_tarihi, tur="TAKSIT",
            aciklama=f"Taksit {t.taksit_no} tahsilatı" + (f" — {cari.unvan}" if cari else ""),
            tutar=t.odenen_tutar or t.tutar, cari_id=cari_id, cari_unvan=cari.unvan if cari else None,
        ))
    return sonuc


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
        cari = db.get(CariHesap, cek.cari_id) if cek.cari_id else None
        satirlar.append(HareketTuruSatiri(
            tarih=gecmis.tarih, tur="CEK",
            aciklama=f"Çek {cek.cek_no or '#' + str(cek.id)} - {'Tahsilat' if isaret > 0 else 'Ödeme'}" + (f" — {cari.unvan}" if cari else ""),
            tutar=isaret * cek.tutar, cari_id=cek.cari_id, cari_unvan=cari.unvan if cari else None,
        ))
    return satirlar


def _stok_satis_satirlari(db, sirket_id, baslangic, bitis):
    sorgu = select(StokSeriNo).where(StokSeriNo.sirket_id == sirket_id, StokSeriNo.durum == StokDurum.SATILDI)
    if baslangic:
        sorgu = sorgu.where(StokSeriNo.satis_tarihi >= baslangic)
    if bitis:
        sorgu = sorgu.where(StokSeriNo.satis_tarihi <= bitis)
    urunler = [s for s in db.execute(sorgu).scalars() if s.satis_tarihi is not None]

    kart_haritasi = {}
    if urunler:
        kart_haritasi = {
            k.id: k for k in db.execute(
                select(StokKarti).where(StokKarti.id.in_({u.stok_karti_id for u in urunler}))
            ).scalars()
        }

    sonuc = []
    for s in urunler:
        kart = kart_haritasi.get(s.stok_karti_id)
        cari = db.get(CariHesap, s.musteri_cari_id) if s.musteri_cari_id else None
        urun_adi = f"{kart.marka} {kart.model}" if kart else ""
        aciklama = f"Satış - {s.seri_no}" + (f" ({urun_adi})" if urun_adi else "") + (f" — {cari.unvan}" if cari else "")
        sonuc.append(HareketTuruSatiri(
            tarih=s.satis_tarihi, tur="STOK_SATIS", aciklama=aciklama,
            tutar=s.satis_fiyati_try or Decimal("0"), cari_id=s.musteri_cari_id,
            cari_unvan=cari.unvan if cari else None,
        ))
    return sonuc


def _pos_taksit_satirlari(db, sirket_id, baslangic, bitis):
    from app.models.finansal import PosTaksitPlani
    sorgu = select(PosTaksitPlani).where(PosTaksitPlani.sirket_id == sirket_id)
    if baslangic:
        sorgu = sorgu.where(PosTaksitPlani.baslangic_tarihi >= baslangic)
    if bitis:
        sorgu = sorgu.where(PosTaksitPlani.baslangic_tarihi <= bitis)
    planlar = list(db.execute(sorgu).scalars())

    urun_haritasi, kart_haritasi = {}, {}
    if planlar:
        urunler = list(db.execute(
            select(StokSeriNo).where(StokSeriNo.id.in_({p.stok_seri_no_id for p in planlar}))
        ).scalars())
        urun_haritasi = {u.id: u for u in urunler}
        if urunler:
            kart_haritasi = {
                k.id: k for k in db.execute(
                    select(StokKarti).where(StokKarti.id.in_({u.stok_karti_id for u in urunler}))
                ).scalars()
            }

    sonuc = []
    for p in planlar:
        urun = urun_haritasi.get(p.stok_seri_no_id)
        kart = kart_haritasi.get(urun.stok_karti_id) if urun else None
        cari = db.get(CariHesap, p.musteri_cari_id) if p.musteri_cari_id else None
        urun_adi = f"{kart.marka} {kart.model}" if kart else ""
        aciklama = f"Kredi kartı taksitli satış - {urun.seri_no if urun else '?'}" + (f" ({urun_adi})" if urun_adi else "") + (f" — {cari.unvan}" if cari else "")
        sonuc.append(HareketTuruSatiri(
            tarih=p.baslangic_tarihi, tur="POS_TAKSIT", aciklama=aciklama,
            tutar=p.toplam_tutar, cari_id=p.musteri_cari_id,
            cari_unvan=cari.unvan if cari else None,
        ))
    return sonuc


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
    "POS_TAKSIT": _pos_taksit_satirlari,
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
    baslangic_gun: int = Query(0, description="Kac gun GERIYE (negatif) kadar vadeler de dahil edilsin - Dashboard'daki 'Bugun Yapilacaklar' icin, vadesi GECMIS ama hala odenmemis kayitlari da gormek icin kullanilir."),
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Genel Bakis ekrani icin: onumuzdeki `gun` gun icinde vadesi gelecek
    (ve istenirse `baslangic_gun` ile GECMISTEKI vadesi gecmis) tum
    odemeleri (para cikisi) ve tahsilatlari (para girisi) tek bir listede,
    kaynagi ne olursa olsun (cek/leasing/akreditif/taksit/kira) birlestirip
    tarihe gore siralar.
    """
    from app.models.finansal import CekTip, LeasingSozlesme, LeasingOdeme
    from app.models.akreditif import Akreditif, AkreditifKalemi

    bugun = date.today()
    baslangic_tarih = bugun + timedelta(days=baslangic_gun)
    son_tarih = bugun + timedelta(days=gun)

    def cari_unvani(cari_id):
        if not cari_id:
            return None
        cari = db.get(CariHesap, cari_id)
        return cari.unvan if cari else None

    odemeler: list[YaklasanVadeSatiri] = []
    tahsilatlar: list[YaklasanVadeSatiri] = []

    # --- Çek: VERİLEN -> odeme, ALINAN -> tahsilat
    cekler = list(db.execute(
        select(Cek).where(
            Cek.sirket_id == sirket_id,
            Cek.durum == CekDurum.PORTFOYDE,
            Cek.vade_tarihi >= baslangic_tarih,
            Cek.vade_tarihi <= son_tarih,
        )
    ).scalars())
    for c in cekler:
        satir = YaklasanVadeSatiri(
            tarih=c.vade_tarihi, tur="CEK",
            aciklama=f"Çek {c.cek_no or ('#' + str(c.id))}",
            tutar=c.tutar, para_birimi=c.para_birimi.value,
            cari_unvan=cari_unvani(c.cari_id), kaynak_tablo="CEKLER", kaynak_id=c.id,
        )
        (odemeler if c.tip == CekTip.VERILEN else tahsilatlar).append(satir)

    # --- Leasing ödemeleri -> odeme
    leasing_odemeleri = list(db.execute(
        select(LeasingOdeme, LeasingSozlesme.sozlesme_no, LeasingSozlesme.para_birimi, LeasingSozlesme.leasing_firmasi_cari_id)
        .join(LeasingSozlesme, LeasingSozlesme.id == LeasingOdeme.leasing_id)
        .where(
            LeasingSozlesme.sirket_id == sirket_id,
            LeasingOdeme.odendi_mi.is_(False),
            LeasingOdeme.vade_tarihi >= baslangic_tarih,
            LeasingOdeme.vade_tarihi <= son_tarih,
        )
    ).all())
    for odeme, sozlesme_no, para_birimi, leasing_firmasi_cari_id in leasing_odemeleri:
        odemeler.append(YaklasanVadeSatiri(
            tarih=odeme.vade_tarihi, tur="LEASING",
            aciklama=f"Leasing {sozlesme_no or ''} - Taksit {odeme.taksit_no}",
            tutar=odeme.tutar, para_birimi=para_birimi.value,
            cari_unvan=cari_unvani(leasing_firmasi_cari_id), kaynak_tablo="LEASING_ODEME", kaynak_id=odeme.id,
        ))

    # --- Akreditif kalemleri -> odeme
    akreditif_kalemleri = list(db.execute(
        select(AkreditifKalemi, Akreditif.akreditif_no, Akreditif.para_birimi, Akreditif.siparis_id)
        .join(Akreditif, Akreditif.id == AkreditifKalemi.akreditif_id)
        .where(
            Akreditif.sirket_id == sirket_id,
            AkreditifKalemi.odendi_mi.is_(False),
            AkreditifKalemi.vade_tarihi >= baslangic_tarih,
            AkreditifKalemi.vade_tarihi <= son_tarih,
        )
    ).all())
    for kalem, akreditif_no, para_birimi, siparis_id in akreditif_kalemleri:
        kalan = kalem.tutar - (kalem.odenen_tutar or Decimal("0"))
        if kalan <= 0:
            continue
        siparis = db.get(Siparis, siparis_id) if siparis_id else None
        odemeler.append(YaklasanVadeSatiri(
            tarih=kalem.vade_tarihi, tur="AKREDITIF",
            aciklama=f"Akreditif {akreditif_no or ''} - {kalem.tip.value}" + (f" ({siparis.siparis_no})" if siparis else "") + (" (kısmi ödenmiş)" if kalem.odenen_tutar else ""),
            tutar=kalan, para_birimi=para_birimi,
            cari_unvan=cari_unvani(siparis.tedarikci_cari_id) if siparis else None,
            kaynak_tablo="AKREDITIF_KALEMI", kaynak_id=kalem.id,
        ))

    # --- Taksitli satış taksitleri -> tahsilat
    taksitler = list(db.execute(
        select(TaksitDetay, TaksitliSatisPlani.para_birimi, TaksitliSatisPlani.musteri_cari_id)
        .join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitDetay.plan_id)
        .where(
            TaksitliSatisPlani.sirket_id == sirket_id,
            TaksitDetay.odendi_mi.is_(False),
            TaksitDetay.vade_tarihi >= baslangic_tarih,
            TaksitDetay.vade_tarihi <= son_tarih,
        )
    ).all())
    for taksit, para_birimi, musteri_cari_id in taksitler:
        musteri_adi = cari_unvani(musteri_cari_id)
        tahsilatlar.append(YaklasanVadeSatiri(
            tarih=taksit.vade_tarihi, tur="TAKSIT",
            aciklama=f"Taksit {taksit.taksit_no}" + (f" — {musteri_adi}" if musteri_adi else ""),
            tutar=taksit.tutar, para_birimi=para_birimi.value,
            cari_unvan=musteri_adi, kaynak_tablo="TAKSIT_DETAY", kaynak_id=taksit.id,
        ))

    # --- Kiralama ödemeleri -> tahsilat (donem_sonu vade kabul edilir)
    kira_odemeleri = list(db.execute(
        select(KiralamaOdeme, KiralamaSozlesme.para_birimi, KiralamaSozlesme.kiraci_cari_id)
        .join(KiralamaSozlesme, KiralamaSozlesme.id == KiralamaOdeme.sozlesme_id)
        .where(
            KiralamaSozlesme.sirket_id == sirket_id,
            KiralamaOdeme.odendi_mi.is_(False),
            KiralamaOdeme.donem_sonu >= baslangic_tarih,
            KiralamaOdeme.donem_sonu <= son_tarih,
        )
    ).all())
    for odeme, para_birimi, kiraci_cari_id in kira_odemeleri:
        kiraci_adi = cari_unvani(kiraci_cari_id)
        tahsilatlar.append(YaklasanVadeSatiri(
            tarih=odeme.donem_sonu, tur="KIRA",
            aciklama=f"Kira dönemi {odeme.donem_basi} - {odeme.donem_sonu}" + (f" — {kiraci_adi}" if kiraci_adi else ""),
            tutar=odeme.tutar, para_birimi=para_birimi.value,
            cari_unvan=kiraci_adi, kaynak_tablo="KIRALAMA_ODEME", kaynak_id=odeme.id,
        ))

    odemeler.sort(key=lambda s: s.tarih)
    tahsilatlar.sort(key=lambda s: s.tarih)

    return YaklasanVadelerYaniti(
        odemeler=odemeler,
        odemeler_toplam=sum((s.tutar for s in odemeler), Decimal("0")),
        tahsilatlar=tahsilatlar,
        tahsilatlar_toplam=sum((s.tutar for s in tahsilatlar), Decimal("0")),
    )


@router.get("/nakit-akis-tahmini", response_model=NakitAkisTahminiYaniti,
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
async def nakit_akis_tahmini(
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Mevcut Kasa+Banka bakiyesi (TL) + onumuzdeki 30/60/90 gunde (kumulatif)
    beklenen tahsilat/odeme netlestirilerek tahmini gelecek bakiye hesaplanir.
    Nakit planlamasi icin: "onumuzdeki ay sonunda kasam yaklasik ne kadar
    olacak" sorusuna cevap verir.
    """
    from app.services.kur_servisi import guncel_kur_getir
    from app.models.banka import BankaHesabi, BankaHareketi

    kur_cache: dict[str, Decimal] = {"TRY": Decimal("1")}

    async def kur_getir(pb: str) -> Decimal:
        if pb not in kur_cache:
            try:
                k = await guncel_kur_getir(pb)
                kur_cache[pb] = Decimal(str(k)) if k else Decimal("1")
            except Exception:
                kur_cache[pb] = Decimal("1")
        return kur_cache[pb]

    # Mevcut Kasa bakiyesi (TL)
    tum_kasa = list(db.execute(select(KasaHareketi).where(KasaHareketi.sirket_id == sirket_id)).scalars())
    kasa_net = sum(
        ((h.tutar_try_karsiligi or 0) if h.yon.value == "GIRIS" else -(h.tutar_try_karsiligi or 0) for h in tum_kasa),
        Decimal("0"),
    )

    # Mevcut Banka bakiyeleri - her hesap kendi para biriminde, TL'ye cevrilir
    banka_sorgu = (
        select(BankaHesabi.para_birimi, func.coalesce(func.sum(BankaHareketi.tutar), 0).label("bakiye"))
        .outerjoin(BankaHareketi, BankaHareketi.banka_hesap_id == BankaHesabi.id)
        .where(BankaHesabi.sirket_id == sirket_id)
        .group_by(BankaHesabi.id, BankaHesabi.para_birimi)
    )
    banka_net_try = Decimal("0")
    for pb, bakiye in db.execute(banka_sorgu).all():
        pb_deger = pb.value if hasattr(pb, "value") else pb
        kur = await kur_getir(pb_deger) if pb_deger != "TRY" else Decimal("1")
        banka_net_try += Decimal(str(bakiye)) * kur

    mevcut_bakiye = kasa_net + banka_net_try

    satirlar = []
    for gun in (30, 60, 90):
        veri = yaklasan_vadeler(gun=gun, sirket_id=sirket_id, db=db)

        toplam_tahsilat = Decimal("0")
        for t in veri.tahsilatlar:
            kur = await kur_getir(t.para_birimi) if t.para_birimi != "TRY" else Decimal("1")
            toplam_tahsilat += t.tutar * kur

        toplam_odeme = Decimal("0")
        for o in veri.odemeler:
            kur = await kur_getir(o.para_birimi) if o.para_birimi != "TRY" else Decimal("1")
            toplam_odeme += o.tutar * kur

        satirlar.append(NakitAkisSatiri(
            gun=gun, beklenen_tahsilat_try=toplam_tahsilat, beklenen_odeme_try=toplam_odeme,
            tahmini_bakiye_try=mevcut_bakiye + toplam_tahsilat - toplam_odeme,
        ))

    return NakitAkisTahminiYaniti(mevcut_bakiye_try=mevcut_bakiye, satirlar=satirlar)


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
        toplam = (seri.satinalma_maliyeti_try + seri.nakliye_maliyeti_try + seri.sigorta_maliyeti_try +
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
    # ONEMLI: KiralamaSozlesme.stok_seri_no_id ESKI (tekli urun) tasarimdan
    # kalma bir alan - coklu urun sistemine gectigimizden beri YENI
    # sozlesmelerde bu alan hep NULL. Gercek urun/seri no baglantisi artik
    # KiralamaSozlesmeKalemi -> KiralamaKalemUrunu uzerinden kuruluyor. Bu
    # yuzden dogrudan STokSeriNo'ya JOIN etmek yerine kalemler/kalem_urunu
    # tablolarini kullaniyoruz.
    sozlesmeler = list(db.execute(
        select(KiralamaSozlesme).where(KiralamaSozlesme.sirket_id == sirket_id, KiralamaSozlesme.durum == "AKTIF")
    ).scalars())

    sonuc = []
    for sozlesme in sozlesmeler:
        cari = db.get(CariHesap, sozlesme.kiraci_cari_id)
        kiraci_unvan = cari.unvan if cari else None
        para_birimi = sozlesme.para_birimi.value if hasattr(sozlesme.para_birimi, "value") else sozlesme.para_birimi

        kalemler = list(db.execute(
            select(KiralamaSozlesmeKalemi).where(KiralamaSozlesmeKalemi.sozlesme_id == sozlesme.id)
        ).scalars())
        for kalem in kalemler:
            kart = db.get(StokKarti, kalem.stok_karti_id)
            baglantilar = list(db.execute(
                select(KiralamaKalemUrunu).where(KiralamaKalemUrunu.kalem_id == kalem.id)
            ).scalars())
            if baglantilar:
                for b in baglantilar:
                    seri = db.get(StokSeriNo, b.stok_seri_no_id)
                    if seri is None:
                        continue
                    sonuc.append(AktifKiralamaSatiri(
                        stok_seri_no_id=seri.id, marka=kart.marka if kart else None,
                        model=kart.model if kart else None, seri_no=seri.seri_no,
                        kiraci_unvan=kiraci_unvan, aylik_kira_tutari=kalem.birim_fiyat, para_birimi=para_birimi,
                    ))
            else:
                # Bu kalem icin spesifik seri no secilmemis (sadece urun turu +
                # miktar girilmis) - yine de "kimde ne kadarlik urun kirada"
                # bilgisi kaybolmasin diye genel bir satir olarak gosteriyoruz.
                sonuc.append(AktifKiralamaSatiri(
                    stok_seri_no_id=kalem.id, marka=kart.marka if kart else None,
                    model=kart.model if kart else None,
                    seri_no=f"{kalem.miktar} adet (seri no belirtilmemiş)",
                    kiraci_unvan=kiraci_unvan, aylik_kira_tutari=kalem.birim_fiyat, para_birimi=para_birimi,
                ))
    return sonuc


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
        u.satinalma_maliyeti_try + u.nakliye_maliyeti_try + u.sigorta_maliyeti_try + u.gumruk_maliyeti_try +
        u.antrepo_maliyeti_try + u.millilestirme_maliyeti_try + u.leasing_maliyeti_try + u.diger_maliyet_try
        for u in stok_urunleri
    ), Decimal("0"))

    # 4) Yedek parca / sarf malzeme
    yedek_parcalar = list(db.execute(select(YedekParca).where(YedekParca.sirket_id == sirket_id)).scalars())
    yedek_parca_degeri_try = sum((p.mevcut_miktar * p.birim_fiyat_try for p in yedek_parcalar), Decimal("0"))

    # ------------------------------------------------------------- ALACAKLAR
    # 5) Cari Arasi Borc Devri (Virman -> Cariden Cariye) bakiyesi.
    # CariHareket tablosu SADECE bu virman ozelliginde dolduruluyor (baska
    # hicbir modul - Siparis/Taksit/Kiralama/Cek/Akreditif/vb. - buraya
    # yazmiyor, o yuzden GENEL bir "Cari Hesaplardan Alacak/Borc" kalemi
    # eklemiyoruz; bu, o modullerin KENDI "kalan bakiye" hesaplariyla
    # cift sayima yol acardi). Ama VIRMAN_CARI_CARI kaynakli kayitlar
    # gercek, ayri bir bakiye olusturuyor (baska hicbir kategoride
    # yakalanmiyor) - bu yuzden SADECE bu kaynagi ayri bir kalem olarak
    # sayiyoruz. Isaret kurali: kaynak caride GIRIS acilir (borcu kapanir),
    # hedef caride CIKIS acilir (borc ona gecer) - yani bir cari icin
    # net alacak = CIKIS - GIRIS (CIKIS ne kadar cok, o kadar bize borclu).
    virman_hareketleri = list(db.execute(
        select(CariHareket).where(CariHareket.sirket_id == sirket_id, CariHareket.kaynak_tablo == "VIRMAN_CARI_CARI")
    ).scalars())
    virman_net_haritasi: dict[int, Decimal] = {}
    for h in virman_hareketleri:
        pb = h.para_birimi.value if hasattr(h.para_birimi, "value") else h.para_birimi
        kur = await kur_getir(pb)
        tutar_try = h.tutar * kur
        yon = h.yon.value if hasattr(h.yon, "value") else h.yon
        katki = tutar_try if yon == "CIKIS" else -tutar_try
        virman_net_haritasi[h.cari_id] = virman_net_haritasi.get(h.cari_id, Decimal("0")) + katki

    virman_alacak_try = Decimal("0")
    virman_borc_try = Decimal("0")
    for net in virman_net_haritasi.values():
        if net > 0:
            virman_alacak_try += net
        elif net < 0:
            virman_borc_try += -net

    # 6) Taksitli satis - henuz tahsil edilmemis taksitlerin toplami (TRY sabit)
    taksitli_taksitler = list(db.execute(
        select(TaksitDetay)
        .join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitDetay.plan_id)
        .where(TaksitliSatisPlani.sirket_id == sirket_id, TaksitDetay.odendi_mi.is_(False))
    ).scalars())
    taksit_alacak_try = sum((t.tutar for t in taksitli_taksitler), Decimal("0"))

    # 6b) Kredi karti (POS) taksitleri - henuz bankaya YATMAMIS taksitlerin
    # toplami. Bu urunler ZATEN SATILDI sayilip Stok'tan dustugu icin, bu
    # kalem eklenmezse tutar hicbir yerde gorunmeden "kaybolurdu" - satis
    # ani ile paranin GERCEKTEN hesaba yatmasi arasindaki GECIKMIS alacagi
    # temsil eder (TRY sabit, kart odemesi zaten TRY).
    pos_taksitler = list(db.execute(
        select(PosTaksitDetay)
        .join(PosTaksitPlani, PosTaksitPlani.id == PosTaksitDetay.plan_id)
        .where(PosTaksitPlani.sirket_id == sirket_id, PosTaksitDetay.yatti_mi.is_(False))
    ).scalars())
    pos_taksit_alacak_try = sum((t.tutar for t in pos_taksitler), Decimal("0"))

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
            taksitler = list(db.execute(select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id == k.id)).scalars())
            if taksitler:
                odenen_toplam += sum((t.tutar for t in taksitler if t.odendi_mi), Decimal("0"))
            else:
                odenen_toplam += k.odenen_tutar or Decimal("0")
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

    # 14) Tedarikci/Hizmet Faturalari (navlun, gumruk, antrepo vb. - Tedarikci
    # Faturalari modulunden) - HENUZ odenmemis kalan bakiyeleri. Bu, Sipariş'in
    # KENDI mal bedeli borcundan (13. adim) TAMAMEN AYRI bir kalem - navlun/
    # gumruk gibi masraflar SIPARIS'in mal bedeli DEGIL, ayrica olusan
    # hizmet faturalaridir.
    from app.models.tedarikci_fatura import TedarikciFaturasi, TedarikciFaturaOdemesi

    tedarikci_faturalari = list(db.execute(
        select(TedarikciFaturasi).where(TedarikciFaturasi.sirket_id == sirket_id)
    ).scalars())
    tedarikci_fatura_borc_try = Decimal("0")
    for f in tedarikci_faturalari:
        odenen = db.execute(
            select(func.coalesce(func.sum(TedarikciFaturaOdemesi.tutar), 0))
            .where(TedarikciFaturaOdemesi.fatura_id == f.id)
        ).scalar_one()
        kalan = f.tutar - odenen
        if kalan <= 0:
            continue
        pb = f.para_birimi if isinstance(f.para_birimi, str) else f.para_birimi.value
        kur = await kur_getir(pb)
        tedarikci_fatura_borc_try += kalan * kur

    varliklar = [
        NetDurumKalemi(kategori="Ana Kasa (Nakit)", tutar_try=kasa_bakiye_try),
        NetDurumKalemi(kategori="Banka", tutar_try=banka_bakiye_try),
        NetDurumKalemi(kategori="Stok (satılmamış ürünler)", tutar_try=stok_degeri_try),
        NetDurumKalemi(kategori="Yedek Parça / Sarf Malzeme", tutar_try=yedek_parca_degeri_try),
    ]
    alacaklar = [
        NetDurumKalemi(kategori="Cari Arası Devir (Bize Borçlu)", tutar_try=virman_alacak_try),
        NetDurumKalemi(kategori="Taksitli Satış Alacağı", tutar_try=taksit_alacak_try),
        NetDurumKalemi(kategori="Kredi Kartı (POS) Bekleyen Alacağı", tutar_try=pos_taksit_alacak_try),
        NetDurumKalemi(kategori="Kiralama Tahsilat Alacağı", tutar_try=kiralama_alacak_try),
        NetDurumKalemi(kategori="Alınan Çekler (Portföyde)", tutar_try=cek_alacak_try),
        NetDurumKalemi(kategori="Ortağa Verilen Borç (Alacak)", tutar_try=ortak_alacak_try),
    ]
    borclar = [
        NetDurumKalemi(kategori="Cari Arası Devir (Biz Borçluyuz)", tutar_try=virman_borc_try),
        NetDurumKalemi(kategori="Akreditif (Ödenmemiş)", tutar_try=akreditif_borc_try),
        NetDurumKalemi(kategori="Leasing (Ödenmemiş Taksitler)", tutar_try=leasing_borc_try),
        NetDurumKalemi(kategori="Verilen Çekler (Portföyde)", tutar_try=cek_borc_try),
        NetDurumKalemi(kategori="Ortaktan/Dışarıdan Alınan Borç", tutar_try=ortak_borc_try),
        NetDurumKalemi(kategori="Tedarikçilere Olan Borç (Sipariş)", tutar_try=siparis_borc_try),
        NetDurumKalemi(kategori="Tedarikçi/Hizmet Faturaları (Ödenmemiş)", tutar_try=tedarikci_fatura_borc_try),
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


class YillikKarsilastirmaYaniti(BaseModel):
    bu_yil: int
    gecen_yil: int
    donem_aciklamasi: str  # "Ocak - Agustos" gibi
    bu_yil_net_kar: Decimal
    gecen_yil_net_kar: Decimal
    net_kar_degisim_yuzde: Decimal | None
    bu_yil_toplam_gelir: Decimal
    gecen_yil_toplam_gelir: Decimal
    gelir_degisim_yuzde: Decimal | None
    bu_yil_toplam_gider: Decimal
    gecen_yil_toplam_gider: Decimal
    gider_degisim_yuzde: Decimal | None


class AylikKarSatiri(BaseModel):
    ay: str  # "2026-07" formatinda
    stok_satis_kari: Decimal
    demirbas_satis_kari: Decimal
    yedek_parca_kari: Decimal
    bakim_geliri: Decimal
    bakim_gideri: Decimal
    kira_geliri: Decimal
    personel_gideri: Decimal
    diger_gider: Decimal
    net_kar: Decimal


@router.get("/aylik-net-kar", response_model=list[AylikKarSatiri],
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def aylik_net_kar(
    ay_sayisi: int = 12,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Ay ay net kar/zarar ozeti. Gelir kalemleri: stok satis kari (satis
    fiyati - toplam maliyet), demirbas satis kari, bakim geliri, kira
    geliri. Gider kalemleri: bakim gideri, odenmis personel maaslari,
    odenmis diger giderler. Akreditif/Leasing/Cek/Taksit odemeleri BURAYA
    DAHIL EDILMEZ - bunlar borc/alacak kapatma islemleridir, kar/zarar
    (gelir tablosu) kalemi degildir.
    """
    aylik: dict[str, dict] = {}

    def satir(ay: str) -> dict:
        return aylik.setdefault(ay, {
            "stok_satis_kari": Decimal("0"), "demirbas_satis_kari": Decimal("0"), "yedek_parca_kari": Decimal("0"),
            "bakim_geliri": Decimal("0"), "bakim_gideri": Decimal("0"),
            "kira_geliri": Decimal("0"), "personel_gideri": Decimal("0"), "diger_gider": Decimal("0"),
        })

    # 1) Stok satis kari
    stok_urunleri = list(db.execute(
        select(StokSeriNo).where(
            StokSeriNo.sirket_id == sirket_id, StokSeriNo.durum == StokDurum.SATILDI,
            StokSeriNo.satis_tarihi.isnot(None),
        )
    ).scalars())
    for u in stok_urunleri:
        ay = u.satis_tarihi.strftime("%Y-%m")
        toplam_maliyet = (
            u.satinalma_maliyeti_try + u.nakliye_maliyeti_try + u.sigorta_maliyeti_try + u.gumruk_maliyeti_try +
            u.antrepo_maliyeti_try + u.millilestirme_maliyeti_try + u.leasing_maliyeti_try + u.diger_maliyet_try
        )
        kar = (u.satis_fiyati_try or Decimal("0")) - toplam_maliyet
        satir(ay)["stok_satis_kari"] += kar

    # 2) Demirbas satis kari
    demirbaslar = list(db.execute(
        select(Demirbas).where(Demirbas.sirket_id == sirket_id, Demirbas.durum == "SATILDI", Demirbas.satis_tarihi.isnot(None))
    ).scalars())
    for d in demirbaslar:
        ay = d.satis_tarihi.strftime("%Y-%m")
        kar = (d.satis_fiyati_try or Decimal("0")) - d.maliyet_try
        satir(ay)["demirbas_satis_kari"] += kar

    # 2b) Yedek parca satis kari (Cikis hareketleri, satis fiyati girilmis olanlar)
    from app.models.yedek_parca import YedekParcaHareketi, YedekParcaHareketYon, YedekParca
    yp_satislari = list(db.execute(
        select(YedekParcaHareketi)
        .join(YedekParca, YedekParca.id == YedekParcaHareketi.yedek_parca_id)
        .where(
            YedekParca.sirket_id == sirket_id, YedekParcaHareketi.yon == YedekParcaHareketYon.CIKIS,
            YedekParcaHareketi.maliyet_birim_fiyat_try.isnot(None), YedekParcaHareketi.birim_fiyat_try.isnot(None),
        )
    ).scalars())
    for h in yp_satislari:
        if not h.tarih:
            continue
        ay = h.tarih.strftime("%Y-%m")
        kar = (h.birim_fiyat_try - h.maliyet_birim_fiyat_try) * h.miktar
        satir(ay)["yedek_parca_kari"] += kar

    # 3) Bakim geliri/gideri
    bakimlar = list(db.execute(select(BakimKaydi).where(BakimKaydi.sirket_id == sirket_id)).scalars())
    for b in bakimlar:
        if not b.tarih:
            continue
        ay = b.tarih.strftime("%Y-%m")
        if b.tip == BakimTip.GELIR:
            satir(ay)["bakim_geliri"] += b.tutar
        else:
            satir(ay)["bakim_gideri"] += b.tutar

    # 4) Kira geliri (tahsil edilmis donemler)
    kira_odemeleri = list(db.execute(
        select(KiralamaOdeme)
        .join(KiralamaSozlesme, KiralamaSozlesme.id == KiralamaOdeme.sozlesme_id)
        .where(KiralamaSozlesme.sirket_id == sirket_id, KiralamaOdeme.odendi_mi.is_(True))
    ).scalars())
    for o in kira_odemeleri:
        if o.odeme_tarihi:
            ay = o.odeme_tarihi.strftime("%Y-%m")
            satir(ay)["kira_geliri"] += o.tutar

    # 5) Odenmis personel maaslari/avanslari
    personel_odemeleri = list(db.execute(
        select(PersonelOdeme)
        .join(Personel, Personel.id == PersonelOdeme.personel_id)
        .where(Personel.sirket_id == sirket_id, PersonelOdeme.odendi_mi.is_(True))
    ).scalars())
    for o in personel_odemeleri:
        if o.odeme_tarihi:
            ay = o.odeme_tarihi.strftime("%Y-%m")
            satir(ay)["personel_gideri"] += o.tutar

    # 6) Odenmis diger giderler (TL karsiligi uzerinden)
    giderler = list(db.execute(
        select(SabitGider).where(SabitGider.sirket_id == sirket_id, SabitGider.odendi_mi.is_(True))
    ).scalars())
    for g in giderler:
        if g.odeme_tarihi:
            ay = g.odeme_tarihi.strftime("%Y-%m")
            satir(ay)["diger_gider"] += g.tutar_try

    sonuc = []
    for ay, veri in aylik.items():
        net_kar = (
            veri["stok_satis_kari"] + veri["demirbas_satis_kari"] + veri["yedek_parca_kari"]
            + veri["bakim_geliri"] + veri["kira_geliri"]
            - veri["bakim_gideri"] - veri["personel_gideri"] - veri["diger_gider"]
        )
        sonuc.append(AylikKarSatiri(ay=ay, net_kar=net_kar, **veri))

    sonuc.sort(key=lambda s: s.ay, reverse=True)
    return sonuc[:ay_sayisi]


@router.get("/yillik-karsilastirma", response_model=YillikKarsilastirmaYaniti,
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def yillik_karsilastirma(
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    "Bu yil, gecen yilin AYNI donemine gore" karsilastirmasi: bugune kadar
    gecen aylarin (orn. Ocak-Agustos) net kar/gelir/gider toplamini, gecen
    yilin AYNI aylik penceresiyle kiyaslar. Boylece "buyuyor muyuz,
    kucaliyor muyuz" sorusuna adil (mevsimsellik dahil) bir cevap verir.
    """
    tum_aylar = aylik_net_kar(ay_sayisi=24, sirket_id=sirket_id, db=db)

    bugun = date.today()
    bu_yil, gecen_yil, bu_ay = bugun.year, bugun.year - 1, bugun.month

    bu_yil_satirlar = [s for s in tum_aylar if s.ay.startswith(f"{bu_yil}-")]
    gecen_yil_satirlar = [
        s for s in tum_aylar
        if s.ay.startswith(f"{gecen_yil}-") and int(s.ay.split("-")[1]) <= bu_ay
    ]

    def toplam_gelir(satirlar):
        return sum((s.stok_satis_kari + s.demirbas_satis_kari + s.yedek_parca_kari + s.bakim_geliri + s.kira_geliri for s in satirlar), Decimal("0"))

    def toplam_gider(satirlar):
        return sum((s.bakim_gideri + s.personel_gideri + s.diger_gider for s in satirlar), Decimal("0"))

    def toplam_net_kar(satirlar):
        return sum((s.net_kar for s in satirlar), Decimal("0"))

    def yuzde_degisim(yeni, eski):
        if eski == 0:
            return None
        return (yeni - eski) / abs(eski) * Decimal("100")

    bu_yil_net_kar, gecen_yil_net_kar = toplam_net_kar(bu_yil_satirlar), toplam_net_kar(gecen_yil_satirlar)
    bu_yil_gelir, gecen_yil_gelir = toplam_gelir(bu_yil_satirlar), toplam_gelir(gecen_yil_satirlar)
    bu_yil_gider, gecen_yil_gider = toplam_gider(bu_yil_satirlar), toplam_gider(gecen_yil_satirlar)

    ay_adlari = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    donem_aciklamasi = f"{ay_adlari[0]} - {ay_adlari[bu_ay - 1]}"

    return YillikKarsilastirmaYaniti(
        bu_yil=bu_yil, gecen_yil=gecen_yil, donem_aciklamasi=donem_aciklamasi,
        bu_yil_net_kar=bu_yil_net_kar, gecen_yil_net_kar=gecen_yil_net_kar,
        net_kar_degisim_yuzde=yuzde_degisim(bu_yil_net_kar, gecen_yil_net_kar),
        bu_yil_toplam_gelir=bu_yil_gelir, gecen_yil_toplam_gelir=gecen_yil_gelir,
        gelir_degisim_yuzde=yuzde_degisim(bu_yil_gelir, gecen_yil_gelir),
        bu_yil_toplam_gider=bu_yil_gider, gecen_yil_toplam_gider=gecen_yil_gider,
        gider_degisim_yuzde=yuzde_degisim(bu_yil_gider, gecen_yil_gider),
    )


class SonIslemSatiri(BaseModel):
    zaman: datetime
    tur: str
    aciklama: str
    tutar: Decimal | None = None
    para_birimi: str | None = None
    # Bu satirin GERCEKTE hangi kayda ait oldugu - frontend'de "ilgili
    # sayfaya git" navigasyonu icin kullanilir. Tiklanabilir olmasi
    # gerekmeyen satirlarda (orn. serbest bir Kasa hareketi) bos kalir.
    kaynak_tablo: str | None = None
    kaynak_id: int | None = None


@router.get("/son-islemler", response_model=list[SonIslemSatiri],
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def son_islemler(
    limit: int = Query(50, le=200),
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Sistemdeki farkli modullerdeki (Siparis, Tedarikci Faturasi, Stok, Cari
    vb.) EN SON olusturulan kayitlari, GERCEK kayit zamanina (olusturma_tarihi
    - saat dahil) gore siralayip birlestirir. "Bugun neler yaptim" sorusuna
    hizli bir bakista cevap verir. Herhangi bir tablo/alan eksikse (henuz
    migration calismamis olabilir) o bolum sessizce atlanir, digerleri
    calismaya devam eder.
    """
    satirlar: list[SonIslemSatiri] = []

    try:
        siparisler = list(db.execute(
            select(Siparis).where(Siparis.sirket_id == sirket_id)
            .order_by(Siparis.olusturma_tarihi.desc()).limit(limit)
        ).scalars())
        for s in siparisler:
            if s.olusturma_tarihi:
                satirlar.append(SonIslemSatiri(
                    zaman=s.olusturma_tarihi, tur="SIPARIS",
                    aciklama=f"Yeni sipariş oluşturuldu — {s.siparis_no}",
                    kaynak_tablo="SIPARIS", kaynak_id=s.id,
                ))
    except Exception:
        pass

    try:
        from app.models.tedarikci_fatura import TedarikciFaturasi, TedarikciFaturaOdemesi

        faturalar = list(db.execute(
            select(TedarikciFaturasi).where(TedarikciFaturasi.sirket_id == sirket_id)
            .order_by(TedarikciFaturasi.olusturma_tarihi.desc()).limit(limit)
        ).scalars())
        for f in faturalar:
            if f.olusturma_tarihi:
                cari = db.get(CariHesap, f.tedarikci_cari_id)
                pb = f.para_birimi.value if hasattr(f.para_birimi, "value") else f.para_birimi
                satirlar.append(SonIslemSatiri(
                    zaman=f.olusturma_tarihi, tur="TEDARIKCI_FATURA",
                    aciklama=f"Fatura kaydedildi — {f.fatura_no or ('#' + str(f.id))}" + (f" ({cari.unvan})" if cari else ""),
                    tutar=f.tutar, para_birimi=pb,
                    kaynak_tablo="TEDARIKCI_FATURA", kaynak_id=f.id,
                ))

        odemeler = list(db.execute(
            select(TedarikciFaturaOdemesi)
            .join(TedarikciFaturasi, TedarikciFaturasi.id == TedarikciFaturaOdemesi.fatura_id)
            .where(TedarikciFaturasi.sirket_id == sirket_id)
            .order_by(TedarikciFaturaOdemesi.olusturma_tarihi.desc()).limit(limit)
        ).scalars())
        for o in odemeler:
            if o.olusturma_tarihi:
                fatura = db.get(TedarikciFaturasi, o.fatura_id)
                pb = None
                if fatura:
                    pb = fatura.para_birimi.value if hasattr(fatura.para_birimi, "value") else fatura.para_birimi
                satirlar.append(SonIslemSatiri(
                    zaman=o.olusturma_tarihi, tur="TEDARIKCI_FATURA_ODEME",
                    aciklama=f"Fatura ödemesi yapıldı — {fatura.fatura_no if fatura and fatura.fatura_no else ('#' + str(o.fatura_id))}",
                    tutar=o.tutar, para_birimi=pb,
                    kaynak_tablo="TEDARIKCI_FATURA", kaynak_id=o.fatura_id,
                ))
    except Exception:
        pass

    try:
        urunler = list(db.execute(
            select(StokSeriNo).where(StokSeriNo.sirket_id == sirket_id)
            .order_by(StokSeriNo.olusturma_tarihi.desc()).limit(limit)
        ).scalars())
        for u in urunler:
            if u.olusturma_tarihi:
                satirlar.append(SonIslemSatiri(
                    zaman=u.olusturma_tarihi, tur="STOK",
                    aciklama=f"Ürün kaydedildi — {u.seri_no}",
                    kaynak_tablo="STOK", kaynak_id=u.id,
                ))

        # Satislar (durum degisikligi - yeni kayit degil, bu yuzden AYRI bir
        # zaman damgasi olan satis_kayit_zamani'ni kullanir).
        satilanlar = list(db.execute(
            select(StokSeriNo).where(
                StokSeriNo.sirket_id == sirket_id,
                StokSeriNo.durum == StokDurum.SATILDI,
                StokSeriNo.satis_kayit_zamani.isnot(None),
            ).order_by(StokSeriNo.satis_kayit_zamani.desc()).limit(limit)
        ).scalars())
        for u in satilanlar:
            satirlar.append(SonIslemSatiri(
                zaman=u.satis_kayit_zamani, tur="STOK_SATIS",
                aciklama=f"Satış yapıldı — {u.seri_no}",
                tutar=u.satis_fiyati_try, para_birimi="TRY",
                kaynak_tablo="STOK", kaynak_id=u.id,
            ))
    except Exception:
        pass

    try:
        cariler = list(db.execute(
            select(CariHesap).where(CariHesap.sirket_id == sirket_id)
            .order_by(CariHesap.olusturma_tarihi.desc()).limit(limit)
        ).scalars())
        for c in cariler:
            if c.olusturma_tarihi:
                satirlar.append(SonIslemSatiri(
                    zaman=c.olusturma_tarihi, tur="CARI",
                    aciklama=f"Yeni cari eklendi — {c.unvan}",
                    kaynak_tablo="CARI", kaynak_id=c.id,
                ))
    except Exception:
        pass

    # TUM Kasa/Banka hareketleri - kaynagi ne olursa olsun (Akreditif,
    # Leasing, Taksit, Kiralama, Bakim, Cek, Stok Satisi, Tedarikci Faturasi
    # vb.) HER PARA HAREKETI, olusturma_tarihi (saat dahil) ile burada
    # gorunur. Boylece "Son Islemler" akisina her yeni modul icin AYRI AYRI
    # kod eklemeye gerek kalmiyor - HANGI MODULDEN GELIRSE GELSIN, bir para
    # hareketi olusturuldugu an burada listelenir.
    try:
        kasa_hareketleri = list(db.execute(
            select(KasaHareketi).where(KasaHareketi.sirket_id == sirket_id)
            .order_by(KasaHareketi.olusturma_tarihi.desc()).limit(limit)
        ).scalars())
        for h in kasa_hareketleri:
            if h.olusturma_tarihi:
                yon_metin = "Giriş" if h.yon.value == "GIRIS" else "Çıkış"
                satirlar.append(SonIslemSatiri(
                    zaman=h.olusturma_tarihi, tur="KASA_HAREKETI",
                    aciklama=f"Ana Kasa {yon_metin} — {h.aciklama or (h.kaynak_tablo or 'Serbest')}",
                    tutar=abs(h.tutar), para_birimi=h.para_birimi.value if hasattr(h.para_birimi, "value") else h.para_birimi,
                    kaynak_tablo=h.kaynak_tablo, kaynak_id=h.kaynak_id,
                ))
    except Exception:
        pass

    try:
        from app.models.banka import BankaHareketi, BankaHesabi
        banka_hareketleri = list(db.execute(
            select(BankaHareketi).where(BankaHareketi.sirket_id == sirket_id)
            .order_by(BankaHareketi.olusturma_tarihi.desc()).limit(limit)
        ).scalars())
        hesap_haritasi = {
            h.id: h for h in db.execute(select(BankaHesabi).where(BankaHesabi.sirket_id == sirket_id)).scalars()
        }
        for h in banka_hareketleri:
            if h.olusturma_tarihi:
                hesap = hesap_haritasi.get(h.banka_hesap_id)
                hesap_pb = hesap.para_birimi.value if hesap and hasattr(hesap.para_birimi, "value") else (hesap.para_birimi if hesap else "TRY")
                yon_metin = "Giriş" if h.tutar >= 0 else "Çıkış"
                satirlar.append(SonIslemSatiri(
                    zaman=h.olusturma_tarihi, tur="BANKA_HAREKETI",
                    aciklama=f"{hesap.banka_adi if hesap else 'Banka'} {yon_metin} — {h.aciklama or (h.kaynak_tablo or 'Serbest')}",
                    tutar=abs(h.tutar), para_birimi=hesap_pb,
                    kaynak_tablo=h.kaynak_tablo, kaynak_id=h.kaynak_id,
                ))
    except Exception:
        pass

    satirlar.sort(key=lambda s: s.zaman, reverse=True)
    return satirlar[:limit]
