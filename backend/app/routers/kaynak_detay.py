"""
Kasa/Banka hareketlerindeki kaynak_tablo + kaynak_id ikilisini, ekranda
okunakli bir ozete ceviren genel amacli "detay cozucu". Boylece kullanici
bir para hareketine tikladiginda "bu nereden geldi?" sorusuna cevap bulur.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir

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

    if kaynak_tablo == "AKREDITIF_KALEMI":
        from app.models.akreditif import AkreditifKalemi, Akreditif
        kalem = db.get(AkreditifKalemi, kaynak_id)
        if kalem is not None:
            akreditif = db.get(Akreditif, kalem.akreditif_id)
            baslik = f"Akreditif Kalemi — {kalem.tip.value}"
            detaylar = [
                ("Akreditif No", akreditif.akreditif_no or f"#{akreditif.id}" if akreditif else "—"),
                ("Kalem Açıklaması", kalem.aciklama or "—"),
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
                ("Sözleşme No", sozlesme.sozlesme_no or f"#{sozlesme.id}" if sozlesme else "—"),
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
                ("Müşteri Cari ID", str(plan.musteri_cari_id) if plan else "—"),
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
                ("Kiracı Cari ID", str(sozlesme.kiraci_cari_id) if sozlesme else "—"),
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
                ("Cari ID", str(borc.cari_id) if borc else "—"),
                ("Tarih", str(odeme.tarih)),
                ("Açıklama", odeme.aciklama or "—"),
                ("Konum", "Finansal Takip → Ortak/Dış Borç"),
            ]

    elif kaynak_tablo == "BAKIM_KAYDI":
        from app.models.finansal import BakimKaydi
        bakim = db.get(BakimKaydi, kaynak_id)
        if bakim is not None:
            baslik = f"Bakım Kaydı — {bakim.tip.value}"
            detaylar = [
                ("Stok Seri No ID", str(bakim.stok_seri_no_id)),
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
                ("Akreditif No", akreditif.akreditif_no or f"#{akreditif.id}" if akreditif else "—"),
                ("Kalem Tipi", kalem.tip.value if kalem else "—"),
                ("Vade Tarihi", str(taksit.vade_tarihi)),
                ("Konum", "Finansal Takip → Akreditif → Kalemler → Taksitler"),
            ]

    elif kaynak_tablo == "VIRMAN_CARI_CARI":
        baslik = "Cari Arası Virman (Borç Devri)"
        detaylar = [("Konum", "Virman → Cari → Cari")]

    return {"baslik": baslik, "detaylar": detaylar}
