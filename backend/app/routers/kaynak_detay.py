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
    ust_baslik: str  # Gruplama icin: "Akreditif KRD-001", "Leasing #3 - X Firma", "Çek #12" vb.
    etiket: str       # Alt secimde gorunen kisa aciklama: "Ödeme - Nakliye bedeli", "3. Taksit" vb.
    tutar: Decimal
    para_birimi: str
    vade_tarihi: date | None = None
    yon: str  # GIRIS | CIKIS


bekleyen_router = APIRouter(prefix="/kaynak-detay", tags=["Kaynak Detay"])


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
        TaksitDetay, TaksitliSatisPlani, Cek, CekDurum,
    )
    from app.models.diger import PersonelOdeme, Personel, SabitGider, SabitGiderKategori
    from app.models.akreditif import AkreditifKalemi, Akreditif, AkreditifKalemTip, AkreditifDurum
    from app.models.akreditif_taksit import AkreditifKalemTaksiti

    # --- Çekler (portföyde bekleyenler; ALINAN -> tahsil edilecek GIRIS, VERILEN -> odenecek CIKIS)
    for c in db.execute(
        select(Cek).where(Cek.sirket_id == sirket_id, Cek.durum == CekDurum.PORTFOYDE)
    ).scalars():
        ust_baslik = f"Çek {c.cek_no or '#' + str(c.id)} — {cari_unvan_hizli(db, c.cari_id)}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="CEKLER", kaynak_id=c.id, ust_baslik=ust_baslik,
            etiket=f"{'Tahsilat' if c.tip.value == 'ALINAN' else 'Ödeme'} — Vade {c.vade_tarihi}",
            tutar=c.tutar, para_birimi=c.para_birimi.value, vade_tarihi=c.vade_tarihi,
            yon="GIRIS" if c.tip.value == "ALINAN" else "CIKIS",
        ))

    # --- Leasing taksitleri
    for o in db.execute(
        select(LeasingOdeme).join(LeasingSozlesme, LeasingSozlesme.id == LeasingOdeme.leasing_id)
        .where(LeasingSozlesme.sirket_id == sirket_id, LeasingOdeme.odendi_mi.is_(False))
    ).scalars():
        sozlesme = db.get(LeasingSozlesme, o.leasing_id)
        ust_baslik = f"Leasing {sozlesme.sozlesme_no or '#' + str(sozlesme.id)} — {cari_unvan_hizli(db, sozlesme.leasing_firmasi_cari_id)}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="LEASING_ODEME", kaynak_id=o.id, ust_baslik=ust_baslik,
            etiket=f"Taksit {o.taksit_no}",
            tutar=o.tutar, para_birimi=sozlesme.para_birimi.value, vade_tarihi=o.vade_tarihi, yon="CIKIS",
        ))

    # --- Kiralama dönemleri (biz tahsil ederiz -> GIRIS)
    for o in db.execute(
        select(KiralamaOdeme).join(KiralamaSozlesme, KiralamaSozlesme.id == KiralamaOdeme.sozlesme_id)
        .where(KiralamaSozlesme.sirket_id == sirket_id, KiralamaOdeme.odendi_mi.is_(False))
    ).scalars():
        sozlesme = db.get(KiralamaSozlesme, o.sozlesme_id)
        ust_baslik = f"Kiralama #{sozlesme.id} — {cari_unvan_hizli(db, sozlesme.kiraci_cari_id)}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="KIRALAMA_ODEME", kaynak_id=o.id, ust_baslik=ust_baslik,
            etiket=f"{o.donem_basi} → {o.donem_sonu}",
            tutar=o.tutar, para_birimi=sozlesme.para_birimi.value, vade_tarihi=o.donem_basi, yon="GIRIS",
        ))

    # --- Taksitli satış taksitleri (biz tahsil ederiz -> GIRIS)
    for t in db.execute(
        select(TaksitDetay).join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitDetay.plan_id)
        .where(TaksitliSatisPlani.sirket_id == sirket_id, TaksitDetay.odendi_mi.is_(False))
    ).scalars():
        plan = db.get(TaksitliSatisPlani, t.plan_id)
        ust_baslik = f"Taksitli Satış #{plan.id} — {cari_unvan_hizli(db, plan.musteri_cari_id)}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="TAKSIT_DETAY", kaynak_id=t.id, ust_baslik=ust_baslik,
            etiket=f"Taksit {t.taksit_no}",
            tutar=t.tutar, para_birimi=plan.para_birimi.value, vade_tarihi=t.vade_tarihi, yon="GIRIS",
        ))

    # --- Personel ödemeleri (biz öderiz -> CIKIS)
    for o in db.execute(
        select(PersonelOdeme).join(Personel, Personel.id == PersonelOdeme.personel_id)
        .where(Personel.sirket_id == sirket_id, PersonelOdeme.odendi_mi.is_(False))
    ).scalars():
        personel = db.get(Personel, o.personel_id)
        ust_baslik = f"Personel — {personel.ad_soyad if personel else ''}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="PERSONEL_ODEME", kaynak_id=o.id, ust_baslik=ust_baslik,
            etiket=f"{o.tip.value} ({o.donem})",
            tutar=o.tutar, para_birimi="TRY", vade_tarihi=o.donem, yon="CIKIS",
        ))

    # --- Sabit giderler (biz öderiz -> CIKIS)
    for g in db.execute(
        select(SabitGider).where(SabitGider.sirket_id == sirket_id, SabitGider.odendi_mi.is_(False))
    ).scalars():
        kategori = db.get(SabitGiderKategori, g.kategori_id)
        ust_baslik = f"Sabit Gider — {kategori.ad if kategori else ''}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="SABIT_GIDER", kaynak_id=g.id, ust_baslik=ust_baslik,
            etiket=f"Dönem {g.donem}",
            tutar=g.tutar, para_birimi="TRY", vade_tarihi=g.donem, yon="CIKIS",
        ))

    # --- Akreditif kalemleri (taksitlendirilmemis, KISMEN ya da HIC odenmemis -> CIKIS)
    # NOT: odendi_mi yerine odenen_tutar < tutar kontrol edilir - kismi
    # odeme yapilmis bir kalem de (kalan bakiyesiyle) hala secilebilir olmali.
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
        kalan = k.tutar - (k.odenen_tutar or Decimal("0"))
        if kalan <= 0:
            continue
        ust_baslik = f"Akreditif {akreditif.akreditif_no or '#' + str(akreditif.id)}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="AKREDITIF_KALEMI", kaynak_id=k.id, ust_baslik=ust_baslik,
            etiket=f"{k.tip.value} — {k.aciklama or ''}" + (" (kısmi ödenmiş)" if k.odenen_tutar else ""),
            tutar=kalan, para_birimi=akreditif.para_birimi.value, vade_tarihi=k.vade_tarihi, yon="CIKIS",
        ))

    # --- Akreditifin KALEMLERE DAGITILMAMIS genel bakiyesi (henuz hic kalem
    # eklenmemis olsa bile, acik bir akreditifin tamami taahhut/borc sayilir -
    # bu yuzden kalemlerin toplami akreditifin tutarindan azsa, aradaki fark
    # da "Genel Bakiye" olarak secilebilir olmali; aksi halde kullanici
    # kalem eklemeden o akreditife hicbir odeme giremezdi.)
    acik_akreditifler_genel = list(db.execute(
        select(Akreditif).where(Akreditif.sirket_id == sirket_id, Akreditif.durum != AkreditifDurum.IPTAL)
    ).scalars())
    for ak in acik_akreditifler_genel:
        kalemler = list(db.execute(select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == ak.id)).scalars())
        kalemlere_dagitilmis = sum((k.tutar for k in kalemler), Decimal("0"))
        genel_kalan = ak.tutar - kalemlere_dagitilmis
        if genel_kalan <= 0:
            continue
        ust_baslik = f"Akreditif {ak.akreditif_no or '#' + str(ak.id)}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="AKREDITIF_GENEL", kaynak_id=ak.id, ust_baslik=ust_baslik,
            etiket="Genel Bakiye (henüz kalem eklenmemiş kısım)",
            tutar=genel_kalan, para_birimi=ak.para_birimi, vade_tarihi=ak.vade_tarihi, yon="CIKIS",
        ))

    # --- Akreditif kalem taksitleri (ödenmemiş -> CIKIS)
    for t in db.execute(
        select(AkreditifKalemTaksiti).join(AkreditifKalemi, AkreditifKalemi.id == AkreditifKalemTaksiti.kalem_id)
        .join(Akreditif, Akreditif.id == AkreditifKalemi.akreditif_id)
        .where(Akreditif.sirket_id == sirket_id, AkreditifKalemTaksiti.odendi_mi.is_(False))
    ).scalars():
        kalem = db.get(AkreditifKalemi, t.kalem_id)
        akreditif = db.get(Akreditif, kalem.akreditif_id) if kalem else None
        ust_baslik = f"Akreditif {akreditif.akreditif_no or '#' + str(akreditif.id) if akreditif else ''}"
        sonuc.append(BekleyenOdemeYanit(
            kaynak_tablo="AKREDITIF_KALEM_TAKSIT", kaynak_id=t.id, ust_baslik=ust_baslik,
            etiket=f"{kalem.tip.value if kalem else ''} — Taksit {t.taksit_no}",
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
