"""
Kasa/Banka hareketlerindeki kaynak_tablo + kaynak_id ikilisini, ekranda
okunakli bir ozete ceviren genel amacli "detay cozucu". Boylece kullanici
bir para hareketine tikladiginda "bu nereden geldi?" sorusuna cevap bulur.

Ayrica /bekleyen-odemeler ucnoktasini barindirir: Banka/Kasa'dan MANUEL bir
hareket girilirken, o hareketin hangi bekleyen yukumluluge (leasing taksiti,
akreditif kalemi, kiralama donemi vb.) karsilik geldigini secebilmek icin
tum modullerdeki odenmemis kayitlari TEK LISTEDE toplar.
"""
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir
from app.models.cari import CariHesap

router = APIRouter(prefix="/kaynak-detay", tags=["Kaynak Detay"])


@router.get("/{kaynak_tablo}/{kaynak_id}")
def kaynak_detayi_getir(
    kaynak_tablo: str,
    kaynak_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    baslik = "Kayıt bulunamadı"
    detaylar: list[tuple[str, str]] = []

    def cari_unvan(cari_id):
        if cari_id is None:
            return "—"
        c = db.get(CariHesap, cari_id)
        return c.unvan if c else f"#{cari_id}"

    if kaynak_tablo == "AKREDITIF_KALEMI":
        from app.models.akreditif import AkreditifKalemi, Akreditif
        kalem = db.get(AkreditifKalemi, kaynak_id)
        if kalem is not None:
            akreditif = db.get(Akreditif, kalem.akreditif_id)
            baslik = f"Akreditif Kalemi — {kalem.tip.value}"
            detaylar = [
                ("Akreditif No", (akreditif.akreditif_no or f"#{akreditif.id}") if akreditif else "—"),
                ("Kalem Açıklaması", kalem.aciklama or "—"),
                ("Tutar", f"{kalem.tutar} {akreditif.para_birimi.value if akreditif else ''}"),
                ("Vade Tarihi", str(kalem.vade_tarihi)),
                ("Konum", "Finansal Takip → Akreditif"),
            ]

    elif kaynak_tablo == "CEKLER":
        from app.models.finansal import Cek
        cek = db.get(Cek, kaynak_id)
        if cek is not None:
            baslik = f"Çek — {'Alınan' if cek.tip.value == 'ALINAN' else 'Verilen'}"
            detaylar = [
                ("Çek No", cek.cek_no or "—"),
                ("Banka", cek.banka_adi or "—"),
                ("Cari", cari_unvan(cek.cari_id)),
                ("Tutar", f"{cek.tutar} {cek.para_birimi.value}"),
                ("Durum", cek.durum.value),
                ("Konum", "Finansal Takip → Çek"),
            ]

    elif kaynak_tablo == "LEASING_ODEME":
        from app.models.finansal import LeasingOdeme, LeasingSozlesme
        odeme = db.get(LeasingOdeme, kaynak_id)
        if odeme is not None:
            sozlesme = db.get(LeasingSozlesme, odeme.leasing_id)
            baslik = f"Leasing Ödemesi — Taksit {odeme.taksit_no}"
            detaylar = [
                ("Sözleşme No", (sozlesme.sozlesme_no or f"#{sozlesme.id}") if sozlesme else "—"),
                ("Leasing Firması", cari_unvan(sozlesme.leasing_firmasi_cari_id) if sozlesme else "—"),
                ("Tutar", f"{odeme.tutar} {sozlesme.para_birimi.value if sozlesme else ''}"),
                ("Vade Tarihi", str(odeme.vade_tarihi)),
                ("Konum", "Finansal Takip → Leasing"),
            ]

    elif kaynak_tablo == "TAKSIT_DETAY":
        from app.models.finansal import TaksitDetay, TaksitliSatisPlani
        taksit = db.get(TaksitDetay, kaynak_id)
        if taksit is not None:
            plan = db.get(TaksitliSatisPlani, taksit.plan_id)
            baslik = f"Taksitli Satış — Taksit {taksit.taksit_no}"
            detaylar = [
                ("Müşteri", cari_unvan(plan.musteri_cari_id) if plan else "—"),
                ("Tutar", f"{taksit.tutar} {plan.para_birimi.value if plan else ''}"),
                ("Vade Tarihi", str(taksit.vade_tarihi)),
                ("Konum", "Finansal Takip → Taksitli Satış"),
            ]

    elif kaynak_tablo == "KIRALAMA_ODEME":
        from app.models.finansal import KiralamaOdeme, KiralamaSozlesme
        odeme = db.get(KiralamaOdeme, kaynak_id)
        if odeme is not None:
            sozlesme = db.get(KiralamaSozlesme, odeme.sozlesme_id)
            baslik = "Kiralama Ödemesi"
            detaylar = [
                ("Dönem", f"{odeme.donem_basi} → {odeme.donem_sonu}"),
                ("Kiracı", cari_unvan(sozlesme.kiraci_cari_id) if sozlesme else "—"),
                ("Tutar", f"{odeme.tutar} {sozlesme.para_birimi.value if sozlesme else ''}"),
                ("Konum", "Finansal Takip → Kiralama"),
            ]

    elif kaynak_tablo == "PERSONEL_ODEME":
        from app.models.diger import PersonelOdeme, Personel
        odeme = db.get(PersonelOdeme, kaynak_id)
        if odeme is not None:
            personel = db.get(Personel, odeme.personel_id)
            baslik = f"Personel Ödemesi — {odeme.tip.value}"
            detaylar = [
                ("Personel", personel.ad_soyad if personel else "—"),
                ("Tutar", str(odeme.tutar)),
                ("Dönem", str(odeme.donem)),
                ("Konum", "Finansal Takip → Personel"),
            ]

    elif kaynak_tablo == "SABIT_GIDER":
        from app.models.diger import SabitGider, SabitGiderKategori
        gider = db.get(SabitGider, kaynak_id)
        if gider is not None:
            kategori = db.get(SabitGiderKategori, gider.kategori_id)
            baslik = "Sabit Gider"
            detaylar = [
                ("Kategori", kategori.ad if kategori else "—"),
                ("Tutar", str(gider.tutar)),
                ("Dönem", str(gider.donem)),
                ("Açıklama", gider.aciklama or "—"),
                ("Konum", "Finansal Takip → Sabit Giderler"),
            ]

    elif kaynak_tablo == "BORC_ODEME":
        from app.models.diger import BorcOdeme, Borc
        odeme = db.get(BorcOdeme, kaynak_id)
        if odeme is not None:
            borc = db.get(Borc, odeme.borc_id)
            baslik = f"Borç Ödemesi — {borc.tip.value if borc else ''}"
            detaylar = [
                ("Cari", cari_unvan(borc.cari_id) if borc else "—"),
                ("Tutar", f"{odeme.tutar} {borc.para_birimi.value if borc else ''}"),
                ("Tarih", str(odeme.tarih)),
                ("Açıklama", odeme.aciklama or "—"),
                ("Konum", "Finansal Takip → Ortak/Dış Borç"),
            ]

    elif kaynak_tablo == "BAKIM_KAYDI":
        from app.models.finansal import BakimKaydi
        from app.models.stok import StokSeriNo, StokKarti
        bakim = db.get(BakimKaydi, kaynak_id)
        if bakim is not None:
            urun = db.get(StokSeriNo, bakim.stok_seri_no_id)
            kart = db.get(StokKarti, urun.stok_karti_id) if urun else None
            urun_adi = f"{kart.marka} {kart.model} ({urun.seri_no})" if (urun and kart) else (urun.seri_no if urun else "—")
            baslik = f"Bakım Kaydı — {bakim.tip.value}"
            detaylar = [
                ("Ürün", urun_adi),
                ("İlgili Cari", cari_unvan(bakim.ilgili_cari_id)),
                ("Tutar", f"{bakim.tutar} {bakim.para_birimi.value}"),
                ("Tarih", str(bakim.tarih)),
                ("Açıklama", bakim.aciklama or "—"),
                ("Konum", "Finansal Takip → Bakım"),
            ]

    elif kaynak_tablo == "STOK_SATIS":
        from app.models.stok import StokSeriNo
        urun = db.get(StokSeriNo, kaynak_id)
        if urun is not None:
            baslik = "Stok Satışı"
            detaylar = [
                ("Seri No", urun.seri_no),
                ("Müşteri", cari_unvan(urun.musteri_cari_id)),
                ("Satış Tarihi", str(urun.satis_tarihi) if urun.satis_tarihi else "—"),
                ("Satış Fiyatı", str(urun.satis_fiyati_try) if urun.satis_fiyati_try is not None else "—"),
                ("Konum", "Stok"),
            ]

    elif kaynak_tablo == "AKREDITIF_KALEM_TAKSIT":
        from app.models.akreditif_taksit import AkreditifKalemTaksiti
        from app.models.akreditif import AkreditifKalemi, Akreditif
        taksit = db.get(AkreditifKalemTaksiti, kaynak_id)
        if taksit is not None:
            kalem = db.get(AkreditifKalemi, taksit.kalem_id)
            akreditif = db.get(Akreditif, kalem.akreditif_id) if kalem else None
            baslik = f"Akreditif Kalem Taksiti — {taksit.taksit_no}. taksit"
            detaylar = [
                ("Akreditif No", (akreditif.akreditif_no or f"#{akreditif.id}") if akreditif else "—"),
                ("Kalem Tipi", kalem.tip.value if kalem else "—"),
                ("Tutar", f"{taksit.tutar} {akreditif.para_birimi.value if akreditif else ''}"),
                ("Vade Tarihi", str(taksit.vade_tarihi)),
                ("Konum", "Finansal Takip → Akreditif → Kalemler → Taksitler"),
            ]

    elif kaynak_tablo == "VIRMAN_CARI_CARI":
        from app.models.cari import CariHareket
        hareket = db.get(CariHareket, kaynak_id)
        if hareket is not None:
            para_birimi = hareket.para_birimi.value if hasattr(hareket.para_birimi, "value") else hareket.para_birimi
            baslik = "Cari Arası Virman (Borç Devri)"
            detaylar = [
                ("Cari", cari_unvan(hareket.cari_id)),
                ("Tutar", f"{hareket.tutar} {para_birimi}"),
                ("Açıklama", hareket.aciklama or "—"),
                ("Konum", "Virman → Cari → Cari"),
            ]

    return {"baslik": baslik, "detaylar": detaylar}


# ================================================================= BEKLEYEN ÖDEMELER
class BekleyenOdemeYanit(BaseModel):
    kaynak_tablo: str
    kaynak_id: int
    etiket: str
    tutar: Decimal
    para_birimi: str
    vade_tarihi: date | None = None
    yon: str  # GIRIS | CIKIS


bekleyen_router = APIRouter(tags=["Kaynak Detay"])


@bekleyen_router.get("/bekleyen-odemeler", response_model=list[BekleyenOdemeYanit])
def bekleyen_odemeleri_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Banka/Kasa'ya MANUEL bir hareket girilirken, o hareketin hangi bekleyen
    yukumluluge (leasing taksiti, akreditif kalemi, kiralama donemi, taksitli
    satis taksiti, personel odemesi, sabit gider) karsilik geldigini
    secebilmek icin TUM modullerdeki odenmemis kayitlari tek listede toplar.
    Cek ve Ortak/Dis Borc buraya dahil DEGILDIR (kendi akislari zaten var).
    """
    sonuc: list[BekleyenOdemeYanit] = []

    from app.models.finansal import (
        LeasingOdeme, LeasingSozlesme, KiralamaOdeme, KiralamaSozlesme,
        TaksitDetay, TaksitliSatisPlani,
    )
    from app.models.diger import PersonelOdeme, Personel, SabitGider, SabitGiderKategori
    from app.models.akreditif import AkreditifKalemi, Akreditif, AkreditifKalemTip
    from app.models.akreditif_taksit import AkreditifKalemTaksiti

    # --- Leasing taksitleri
    for o in db.execute(
        select(LeasingOdeme).join(LeasingSozlesme, LeasingSozlesme.id == LeasingOdeme.leasing_id)
        .where(LeasingSozlesme.sirket_id == sirket_id, LeasingOdeme.odendi_mi.is_(False))
    ).scalars():
        sozlesme = db.get(LeasingSozlesme, o.leasing_id)
        etiket = f"Leasing {sozlesme.sozlesme_no or '#' + str(sozlesme.id)} — {cari_unvan_hizli(db, sozlesme.leasing_firmasi_cari_id)} — Taksit {o.taksit_no}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="LEASING_ODEME", kaynak_id=o.id, etiket=etiket,
            tutar=o.tutar, para_birimi=sozlesme.para_birimi.value, vade_tarihi=o.vade_tarihi, yon="CIKIS",
        ))

    # --- Kiralama dönemleri (biz tahsil ederiz -> GIRIS)
    for o in db.execute(
        select(KiralamaOdeme).join(KiralamaSozlesme, KiralamaSozlesme.id == KiralamaOdeme.sozlesme_id)
        .where(KiralamaSozlesme.sirket_id == sirket_id, KiralamaOdeme.odendi_mi.is_(False))
    ).scalars():
        sozlesme = db.get(KiralamaSozlesme, o.sozlesme_id)
        etiket = f"Kiralama — {cari_unvan_hizli(db, sozlesme.kiraci_cari_id)} — {o.donem_basi}→{o.donem_sonu}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="KIRALAMA_ODEME", kaynak_id=o.id, etiket=etiket,
            tutar=o.tutar, para_birimi=sozlesme.para_birimi.value, vade_tarihi=o.donem_basi, yon="GIRIS",
        ))

    # --- Taksitli satış taksitleri (biz tahsil ederiz -> GIRIS)
    for t in db.execute(
        select(TaksitDetay).join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitDetay.plan_id)
        .where(TaksitliSatisPlani.sirket_id == sirket_id, TaksitDetay.odendi_mi.is_(False))
    ).scalars():
        plan = db.get(TaksitliSatisPlani, t.plan_id)
        etiket = f"Taksitli Satış — {cari_unvan_hizli(db, plan.musteri_cari_id)} — Taksit {t.taksit_no}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="TAKSIT_DETAY", kaynak_id=t.id, etiket=etiket,
            tutar=t.tutar, para_birimi=plan.para_birimi.value, vade_tarihi=t.vade_tarihi, yon="GIRIS",
        ))

    # --- Personel ödemeleri (biz öderiz -> CIKIS)
    for o in db.execute(
        select(PersonelOdeme).join(Personel, Personel.id == PersonelOdeme.personel_id)
        .where(Personel.sirket_id == sirket_id, PersonelOdeme.odendi_mi.is_(False))
    ).scalars():
        personel = db.get(Personel, o.personel_id)
        etiket = f"Personel — {personel.ad_soyad if personel else ''} — {o.tip.value} ({o.donem})"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="PERSONEL_ODEME", kaynak_id=o.id, etiket=etiket,
            tutar=o.tutar, para_birimi="TRY", vade_tarihi=o.donem, yon="CIKIS",
        ))

    # --- Sabit giderler (biz öderiz -> CIKIS)
    for g in db.execute(
        select(SabitGider).where(SabitGider.sirket_id == sirket_id, SabitGider.odendi_mi.is_(False))
    ).scalars():
        kategori = db.get(SabitGiderKategori, g.kategori_id)
        etiket = f"Sabit Gider — {kategori.ad if kategori else ''} ({g.donem})"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="SABIT_GIDER", kaynak_id=g.id, etiket=etiket,
            tutar=g.tutar, para_birimi="TRY", vade_tarihi=g.donem, yon="CIKIS",
        ))

    # --- Akreditif kalemleri (taksitlendirilmemiş, ödenmemiş -> CIKIS)
    for k in db.execute(
        select(AkreditifKalemi).join(Akreditif, Akreditif.id == AkreditifKalemi.akreditif_id)
        .where(Akreditif.sirket_id == sirket_id, AkreditifKalemi.odendi_mi.is_(False))
    ).scalars():
        taksit_var_mi = db.execute(
            select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id == k.id)
        ).first()
        if taksit_var_mi is not None:
            continue  # taksitlendirilmis kalemler yerine kendi taksitleri listelenir
        akreditif = db.get(Akreditif, k.akreditif_id)
        etiket = f"Akreditif {akreditif.akreditif_no or '#' + str(akreditif.id)} — {k.tip.value} — {k.aciklama or ''}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="AKREDITIF_KALEMI", kaynak_id=k.id, etiket=etiket,
            tutar=k.tutar, para_birimi=akreditif.para_birimi.value, vade_tarihi=k.vade_tarihi, yon="CIKIS",
        ))

    # --- Akreditif kalem taksitleri (ödenmemiş -> CIKIS)
    for t in db.execute(
        select(AkreditifKalemTaksiti).join(AkreditifKalemi, AkreditifKalemi.id == AkreditifKalemTaksiti.kalem_id)
        .join(Akreditif, Akreditif.id == AkreditifKalemi.akreditif_id)
        .where(Akreditif.sirket_id == sirket_id, AkreditifKalemTaksiti.odendi_mi.is_(False))
    ).scalars():
        kalem = db.get(AkreditifKalemi, t.kalem_id)
        akreditif = db.get(Akreditif, kalem.akreditif_id) if kalem else None
        etiket = f"Akreditif {akreditif.akreditif_no or '#' + str(akreditif.id) if akreditif else ''} — {kalem.tip.value if kalem else ''} — Taksit {t.taksit_no}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="AKREDITIF_KALEM_TAKSIT", kaynak_id=t.id, etiket=etiket,
            tutar=t.tutar, para_birimi=akreditif.para_birimi.value if akreditif else "TRY",
            vade_tarihi=t.vade_tarihi, yon="CIKIS",
        ))

    sonuc.sort(key=lambda x: (x.vade_tarihi is None, x.vade_tarihi))
    return sonuc


def cari_unvan_hizli(db: Session, cari_id) -> str:
    if cari_id is None:
        return "—"
    c = db.get(CariHesap, cari_id)
    return c.unvan if c else f"#{cari_id}"
