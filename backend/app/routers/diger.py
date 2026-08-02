from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
import json
from app.models.diger import (
    Personel, PersonelOdeme, SabitGider,
    Borc, BorcOdeme, BorcTip, ProformaFatura, ProformaDetay, Fatura, FaturaDetay,
    KdvManuelGiris,
)
from app.models.denetim import DuzenlemeKaydi
from app.core.security import sifre_dogrula
from app.schemas.diger import (
    PersonelOlusturIstegi, PersonelYanit, PersonelOdemeOlusturIstegi, PersonelOdemeYanit, OdeIstegi,
    PersonelDuzenleIstegi,
    SabitGiderOlusturIstegi, SabitGiderYanit, SabitGiderDuzenleIstegi,
    BorcOlusturIstegi, BorcYanit, BorcOdemeOlusturIstegi, BorcOdemeYanit, BorcBakiyeYanit,
    BorcDuzenleIstegi,
    ProformaOlusturIstegi, ProformaYanit, FaturayaCevirYaniti, FaturaYanit, NotGuncelleIstegi,
    KdvManuelGirisIstegi, KdvManuelGirisYanit, KdvOzetSatiri, KdvOzetYaniti,
)
from app.services.para_hareketi import para_hareketi_olustur


def _degisiklikleri_kaydet(db: Session, sirket_id: int, kullanici_id: int, tablo_adi: str, kayit_id: int, degisiklikler: dict) -> None:
    if not degisiklikler:
        return
    db.add(DuzenlemeKaydi(
        sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
        kayit_id=kayit_id, degisiklikler=json.dumps(degisiklikler, ensure_ascii=False, default=str),
    ))

router = APIRouter(tags=["Personel, Giderler, Borç, Fatura"])


def _kdv_dahil_toplam_hesapla(kalemler):
    ara_toplam = Decimal("0")
    kdv_toplam = Decimal("0")
    for k in kalemler:
        satir_tutar = k.miktar * k.birim_fiyat
        ara_toplam += satir_tutar
        kdv_toplam += satir_tutar * (k.kdv_orani / Decimal("100"))
    return ara_toplam, kdv_toplam, ara_toplam + kdv_toplam


# ============================================================================ PERSONEL
@router.post("/personel", response_model=PersonelYanit, dependencies=[Depends(izin_gerektir("PERSONEL_DUZENLE"))])
def personel_olustur(istek: PersonelOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    yeni = Personel(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/personel", response_model=list[PersonelYanit], dependencies=[Depends(izin_gerektir("PERSONEL_GORUNTULE"))])
def personel_listele(sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    sorgu = select(Personel).where(Personel.sirket_id == sirket_id, Personel.aktif.is_(True))
    return list(db.execute(sorgu).scalars())


@router.put("/personel/{personel_id}", response_model=PersonelYanit, dependencies=[Depends(izin_gerektir("PERSONEL_DUZENLE"))])
def personel_duzenle(
    personel_id: int, istek: PersonelDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """Bir personelin bilgilerini duzenler. Sifre onayi zorunludur; degisiklikler denetim_kayitlari'na islenir."""
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    personel = db.get(Personel, personel_id)
    if personel is None or personel.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Personel bulunamadı.")

    alan_adlari = {"ad_soyad": "Ad Soyad", "pozisyon": "Pozisyon", "aylik_maas": "Aylık Maaş", "ise_baslama_tarihi": "İşe Başlama Tarihi"}
    yeni_degerler = {
        "ad_soyad": istek.ad_soyad, "pozisyon": istek.pozisyon,
        "aylik_maas": istek.aylik_maas, "ise_baslama_tarihi": istek.ise_baslama_tarihi,
    }
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(personel, alan)
        yeni = yeni_degerler[alan]
        if str(eski) != str(yeni):
            degisiklikler[etiket] = {"eski": eski, "yeni": yeni}
        setattr(personel, alan, yeni)

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "personel", personel.id, degisiklikler)

    db.commit()
    db.refresh(personel)
    return personel


@router.post("/personel-odemeleri", response_model=PersonelOdemeYanit,
             dependencies=[Depends(izin_gerektir("PERSONEL_DUZENLE"))])
def personel_odemesi_ekle(
    personel_id: int, istek: PersonelOdemeOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    personel = db.get(Personel, personel_id)
    if personel is None or personel.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Personel bulunamadı.")
    yeni = PersonelOdeme(personel_id=personel_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/personel/{personel_id}/odemeler", response_model=list[PersonelOdemeYanit],
            dependencies=[Depends(izin_gerektir("PERSONEL_GORUNTULE"))])
def personel_odemelerini_listele(personel_id: int, db: Session = Depends(get_db)):
    sorgu = select(PersonelOdeme).where(PersonelOdeme.personel_id == personel_id).order_by(PersonelOdeme.donem.desc())
    return list(db.execute(sorgu).scalars())


@router.put("/personel-odemeleri/{odeme_id}/ode", response_model=PersonelOdemeYanit,
            dependencies=[Depends(izin_gerektir("PERSONEL_DUZENLE"))])
def personel_odemesi_yap(
    odeme_id: int, istek: OdeIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    odeme = db.get(PersonelOdeme, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")

    personel = db.get(Personel, odeme.personel_id)

    odeme.odendi_mi = True
    odeme.odeme_tarihi = istek.odeme_tarihi

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "CIKIS", odeme.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=f"{personel.ad_soyad if personel else 'Personel'} - {odeme.tip.value}",
        kaynak_tablo="PERSONEL_ODEME", kaynak_id=odeme.id,
    )

    db.commit()
    db.refresh(odeme)
    return odeme


# ===================================================================== SABİT GİDERLER
@router.post("/sabit-giderler", response_model=SabitGiderYanit, dependencies=[Depends(izin_gerektir("GIDER_DUZENLE"))])
def sabit_gider_ekle(istek: SabitGiderOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    tutar_try = istek.tutar * istek.kur
    yeni = SabitGider(
        sirket_id=sirket_id, kategori=istek.kategori, donem=istek.donem,
        tutar=istek.tutar, para_birimi=istek.para_birimi, kur=istek.kur,
        tutar_try=tutar_try, aciklama=istek.aciklama,
    )
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/sabit-giderler", response_model=list[SabitGiderYanit], dependencies=[Depends(izin_gerektir("GIDER_GORUNTULE"))])
def sabit_giderleri_listele(
    donem: str | None = None, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(SabitGider).where(SabitGider.sirket_id == sirket_id)
    if donem:
        sorgu = sorgu.where(func.to_char(SabitGider.donem, "YYYY-MM") == donem)
    return list(db.execute(sorgu).scalars())


@router.put("/sabit-giderler/{gider_id}", response_model=SabitGiderYanit,
            dependencies=[Depends(izin_gerektir("GIDER_DUZENLE"))])
def sabit_gider_duzenle(
    gider_id: int, istek: SabitGiderDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Odenmemis bir gider kaydini duzeltir (yanlis girilen tutar/kategori/tarih
    icin). Sifre onayi zorunludur; degisiklikler denetim_kayitlari'na islenir.
    """
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    gider = db.get(SabitGider, gider_id)
    if gider is None or gider.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gider kaydı bulunamadı.")
    if gider.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödenmiş bir gider kaydı düzenlenemez; önce ödemeyi geri alın.")

    yeni_tutar_try = istek.tutar * istek.kur
    alan_adlari = {"kategori": "Kategori", "donem": "Dönem", "tutar": "Tutar", "para_birimi": "Para Birimi", "kur": "Kur", "tutar_try": "TL Karşılığı", "aciklama": "Açıklama"}
    yeni_degerler = {
        "kategori": istek.kategori, "donem": istek.donem, "tutar": istek.tutar,
        "para_birimi": istek.para_birimi, "kur": istek.kur, "tutar_try": yeni_tutar_try, "aciklama": istek.aciklama,
    }
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(gider, alan)
        yeni = yeni_degerler[alan]
        eski_metin = eski.value if hasattr(eski, "value") else eski
        yeni_metin = yeni.value if hasattr(yeni, "value") else yeni
        if str(eski_metin) != str(yeni_metin):
            degisiklikler[etiket] = {"eski": eski_metin, "yeni": yeni_metin}
        setattr(gider, alan, yeni)

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "sabit_giderler", gider.id, degisiklikler)

    db.commit()
    db.refresh(gider)
    return gider


@router.put("/sabit-giderler/{gider_id}/ode", response_model=SabitGiderYanit,
            dependencies=[Depends(izin_gerektir("GIDER_DUZENLE"))])
def sabit_gider_ode(
    gider_id: int, istek: OdeIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    gider = db.get(SabitGider, gider_id)
    if gider is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gider kaydı bulunamadı.")

    gider.odendi_mi = True
    gider.odeme_tarihi = istek.odeme_tarihi

    para_hareketi_olustur(
        db, sirket_id, kullanici.id, "CIKIS", gider.tutar_try,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=gider.aciklama or f"{gider.kategori or 'Diğer gider'} ödemesi",
        kaynak_tablo="SABIT_GIDER", kaynak_id=gider.id,
        para_birimi=gider.para_birimi.value, kur=gider.kur,
    )

    db.commit()
    db.refresh(gider)
    return gider


# ===================================================================== ORTAK/DIŞ BORÇ
@router.post("/borclar", response_model=BorcYanit, dependencies=[Depends(izin_gerektir("BORC_DUZENLE"))])
def borc_olustur(istek: BorcOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    yeni = Borc(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/borclar", response_model=list[BorcYanit], dependencies=[Depends(izin_gerektir("BORC_GORUNTULE"))])
def borclari_listele(
    tip: str | None = None, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(Borc).where(Borc.sirket_id == sirket_id)
    if tip:
        sorgu = sorgu.where(Borc.tip == tip)
    return list(db.execute(sorgu).scalars())


@router.put("/borclar/{borc_id}", response_model=BorcYanit, dependencies=[Depends(izin_gerektir("BORC_DUZENLE"))])
def borc_duzenle(
    borc_id: int, istek: BorcDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Bir borc kaydini duzenler. Sifre onayi zorunludur; degisiklikler
    denetim_kayitlari'na islenir. Odemesi baslamis bir borc icin dikkatli
    kullanilmali - tutar/para birimi degisikligi gecmis odemelerle
    tutarliligi bozabilir.
    """
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    borc = db.get(Borc, borc_id)
    if borc is None or borc.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Borç kaydı bulunamadı.")

    alan_adlari = {
        "tip": "Tip", "cari_id": "Cari", "tutar": "Tutar", "para_birimi": "Para Birimi",
        "faiz_orani": "Faiz Oranı", "alinma_tarihi": "Alınma Tarihi", "vade_tarihi": "Vade Tarihi", "notlar": "Notlar",
    }
    yeni_degerler = {
        "tip": istek.tip, "cari_id": istek.cari_id, "tutar": istek.tutar, "para_birimi": istek.para_birimi,
        "faiz_orani": istek.faiz_orani, "alinma_tarihi": istek.alinma_tarihi,
        "vade_tarihi": istek.vade_tarihi, "notlar": istek.notlar,
    }
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(borc, alan)
        yeni = yeni_degerler[alan]
        eski_metin = eski.value if hasattr(eski, "value") else eski
        yeni_metin = yeni.value if hasattr(yeni, "value") else yeni
        if str(eski_metin) != str(yeni_metin):
            degisiklikler[etiket] = {"eski": eski_metin, "yeni": yeni_metin}
        setattr(borc, alan, yeni)

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "borclar", borc.id, degisiklikler)

    db.commit()
    db.refresh(borc)
    return borc


@router.post("/borclar/{borc_id}/odeme", response_model=BorcOdemeYanit,
             dependencies=[Depends(izin_gerektir("BORC_DUZENLE"))])
def borc_odemesi_ekle(
    borc_id: int, istek: BorcOdemeOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    ORTAKTAN_ALINAN / DISARIDAN_ALINAN: bu borcu biz odedigimiz icin CIKIS.
    ORTAGA_VERILEN: ortaga verdigimiz para bize geri geldigi icin GIRIS.
    """
    borc = db.get(Borc, borc_id)
    if borc is None or borc.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Borç kaydı bulunamadı.")

    yeni = BorcOdeme(borc_id=borc_id, tarih=istek.tarih, tutar=istek.tutar, aciklama=istek.aciklama)
    db.add(yeni)
    db.flush()

    yon = "GIRIS" if borc.tip == BorcTip.ORTAGA_VERILEN else "CIKIS"
    para_hareketi_olustur(
        db, sirket_id, kullanici.id, yon, istek.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=istek.aciklama or f"Borç ödemesi - {borc.tip.value}",
        kaynak_tablo="BORC_ODEME", kaynak_id=yeni.id, cari_id=borc.cari_id,
        para_birimi=borc.para_birimi.value, kur=istek.kur,
    )

    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/borclar/{borc_id}/bakiye", response_model=BorcBakiyeYanit,
            dependencies=[Depends(izin_gerektir("BORC_GORUNTULE"))])
def borc_bakiyesi(borc_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    borc = db.get(Borc, borc_id)
    if borc is None or borc.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Borç kaydı bulunamadı.")
    toplam_odenen = db.execute(
        select(func.coalesce(func.sum(BorcOdeme.tutar), 0)).where(BorcOdeme.borc_id == borc_id)
    ).scalar_one()
    return BorcBakiyeYanit(
        borc_id=borc_id, toplam_borc=borc.tutar, toplam_odenen=toplam_odenen,
        kalan_bakiye=borc.tutar - toplam_odenen,
    )


# =================================================================== PROFORMA / FATURA
@router.get("/proforma-faturalar/sonraki-no",
            dependencies=[Depends(izin_gerektir("FATURA_GORUNTULE"))])
def proforma_sonraki_no_getir(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Bu yil icin bir sonraki proforma numarasini onerir (PRF-YYYY-NNN formatinda)."""
    yil = date.today().year
    sayac = db.execute(
        select(func.count()).select_from(ProformaFatura).where(
            ProformaFatura.sirket_id == sirket_id,
            func.extract("year", ProformaFatura.tarih) == yil,
        )
    ).scalar_one()
    return {"proforma_no": f"PRF-{yil}-{sayac + 1:03d}"}


@router.post("/proforma-faturalar", response_model=ProformaYanit,
             dependencies=[Depends(izin_gerektir("FATURA_DUZENLE"))])
def proforma_olustur(istek: ProformaOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    ara_toplam, kdv_toplam, genel_toplam = _kdv_dahil_toplam_hesapla(istek.kalemler)

    yeni = ProformaFatura(
        sirket_id=sirket_id, proforma_no=istek.proforma_no, cari_id=istek.cari_id,
        tarih=istek.tarih, gecerlilik_tarihi=istek.gecerlilik_tarihi,
        para_birimi=istek.para_birimi, ara_toplam=ara_toplam, kdv_tutari=kdv_toplam,
        genel_toplam=genel_toplam, notlar=istek.notlar,
    )
    db.add(yeni)
    db.flush()

    for k in istek.kalemler:
        db.add(ProformaDetay(proforma_id=yeni.id, **k.model_dump()))

    db.commit()
    return _proforma_detayli_getir(db, yeni.id)


def _proforma_detayli_getir(db: Session, proforma_id: int) -> ProformaFatura:
    proforma = db.get(ProformaFatura, proforma_id)
    proforma.kalemler = list(db.execute(
        select(ProformaDetay).where(ProformaDetay.proforma_id == proforma_id)
    ).scalars())
    return proforma


@router.get("/proforma-faturalar", response_model=list[ProformaYanit],
            dependencies=[Depends(izin_gerektir("FATURA_GORUNTULE"))])
def proformalari_listele(sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    """Sirketin tum proforma faturalarini en yeniden eskiye siralar (kalemleri de dahil)."""
    sorgu = (
        select(ProformaFatura)
        .where(ProformaFatura.sirket_id == sirket_id)
        .order_by(ProformaFatura.id.desc())
    )
    sonuclar = list(db.execute(sorgu).scalars())
    for p in sonuclar:
        p.kalemler = list(db.execute(
            select(ProformaDetay).where(ProformaDetay.proforma_id == p.id)
        ).scalars())
    return sonuclar


@router.get("/proforma-faturalar/{proforma_id}", response_model=ProformaYanit,
            dependencies=[Depends(izin_gerektir("FATURA_GORUNTULE"))])
def proforma_getir(proforma_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    proforma = db.get(ProformaFatura, proforma_id)
    if proforma is None or proforma.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proforma fatura bulunamadı.")
    return _proforma_detayli_getir(db, proforma_id)


@router.delete("/proforma-faturalar/{proforma_id}", dependencies=[Depends(izin_gerektir("FATURA_DUZENLE"))])
def proforma_sil(
    proforma_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Sadece HENUZ faturaya cevrilmemis bir proforma silinebilir."""
    proforma = db.get(ProformaFatura, proforma_id)
    if proforma is None or proforma.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proforma fatura bulunamadı.")
    if proforma.durum == "FATURALASTI":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faturalaştırılmış bir proforma silinemez.")

    for k in list(db.execute(
        select(ProformaDetay).where(ProformaDetay.proforma_id == proforma_id)
    ).scalars()):
        db.delete(k)
    db.delete(proforma)
    db.commit()
    return {"silindi": True}


@router.post("/proforma-faturalar/{proforma_id}/faturaya-cevir", response_model=FaturayaCevirYaniti,
             dependencies=[Depends(izin_gerektir("FATURA_DUZENLE"))])
def proformayi_faturaya_cevir(
    proforma_id: int, fatura_no: str,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Proforma satirlarini birebir kopyalayarak yeni bir fatura olusturur.
    Orijinal proforma DEGISTIRILMEZ (izlenebilirlik icin); sadece durumu
    FATURALASTI olarak isaretlenir.
    """
    proforma = db.get(ProformaFatura, proforma_id)
    if proforma is None or proforma.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proforma fatura bulunamadı.")
    if proforma.durum == "FATURALASTI":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu proforma zaten faturalaştırılmış.")

    mevcut_fatura_no = db.execute(select(Fatura).where(Fatura.fatura_no == fatura_no)).scalar_one_or_none()
    if mevcut_fatura_no is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu fatura numarası zaten kullanılıyor.")

    proforma_kalemleri = list(db.execute(
        select(ProformaDetay).where(ProformaDetay.proforma_id == proforma_id)
    ).scalars())

    yeni_fatura = Fatura(
        sirket_id=sirket_id, fatura_no=fatura_no, proforma_id=proforma_id,
        cari_id=proforma.cari_id, tarih=proforma.tarih, para_birimi=proforma.para_birimi,
        ara_toplam=proforma.ara_toplam, kdv_tutari=proforma.kdv_tutari,
        genel_toplam=proforma.genel_toplam, notlar=proforma.notlar,
    )
    db.add(yeni_fatura)
    db.flush()

    for k in proforma_kalemleri:
        db.add(FaturaDetay(
            fatura_id=yeni_fatura.id, stok_karti_id=k.stok_karti_id,
            aciklama=k.aciklama, miktar=k.miktar, birim_fiyat=k.birim_fiyat, kdv_orani=k.kdv_orani,
        ))

    proforma.durum = "FATURALASTI"
    db.commit()
    return FaturayaCevirYaniti(fatura_id=yeni_fatura.id, fatura_no=yeni_fatura.fatura_no)


@router.get("/faturalar", response_model=list[FaturaYanit],
            dependencies=[Depends(izin_gerektir("FATURA_GORUNTULE"))])
def faturalari_listele(sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    sorgu = select(Fatura).where(Fatura.sirket_id == sirket_id).order_by(Fatura.id.desc())
    sonuclar = list(db.execute(sorgu).scalars())
    for f in sonuclar:
        f.kalemler = list(db.execute(
            select(FaturaDetay).where(FaturaDetay.fatura_id == f.id)
        ).scalars())
    return sonuclar


@router.get("/faturalar/sonraki-no",
            dependencies=[Depends(izin_gerektir("FATURA_GORUNTULE"))])
def fatura_sonraki_no_getir(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Bu yil icin bir sonraki fatura numarasini onerir (FT-YYYY-NNN formatinda)."""
    yil = date.today().year
    sayac = db.execute(
        select(func.count()).select_from(Fatura).where(
            Fatura.sirket_id == sirket_id,
            func.extract("year", Fatura.tarih) == yil,
        )
    ).scalar_one()
    return {"fatura_no": f"FT-{yil}-{sayac + 1:03d}"}


@router.get("/faturalar/{fatura_id}", response_model=FaturaYanit,
            dependencies=[Depends(izin_gerektir("FATURA_GORUNTULE"))])
def fatura_getir(fatura_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    fatura = db.get(Fatura, fatura_id)
    if fatura is None or fatura.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fatura bulunamadı.")
    fatura.kalemler = list(db.execute(
        select(FaturaDetay).where(FaturaDetay.fatura_id == fatura_id)
    ).scalars())
    return fatura


@router.put("/proforma-faturalar/{proforma_id}/notlar", response_model=ProformaYanit,
            dependencies=[Depends(izin_gerektir("FATURA_DUZENLE"))])
def proforma_notunu_guncelle(
    proforma_id: int, istek: NotGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """Bir proformanin notlarini gunceller - proforma FATURALASTI olsa bile calisir (notlar salt bilgi amaclidir)."""
    proforma = db.get(ProformaFatura, proforma_id)
    if proforma is None or proforma.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proforma fatura bulunamadı.")
    proforma.notlar = istek.notlar
    db.commit()
    return _proforma_detayli_getir(db, proforma_id)


@router.put("/faturalar/{fatura_id}/notlar", response_model=FaturaYanit,
            dependencies=[Depends(izin_gerektir("FATURA_DUZENLE"))])
def fatura_notunu_guncelle(
    fatura_id: int, istek: NotGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    fatura = db.get(Fatura, fatura_id)
    if fatura is None or fatura.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fatura bulunamadı.")
    fatura.notlar = istek.notlar
    db.commit()
    fatura.kalemler = list(db.execute(
        select(FaturaDetay).where(FaturaDetay.fatura_id == fatura_id)
    ).scalars())
    return fatura


@router.delete("/faturalar/{fatura_id}", dependencies=[Depends(izin_gerektir("FATURA_DUZENLE"))])
def fatura_iptal_et(
    fatura_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Faturayi iptal eder (kalemleriyle birlikte siler). Eger bir proformadan
    donusturulmusse, o proformanin durumu FATURALASTI'dan ONAYLANDI'ya
    geri alinir - boylece proforma tekrar faturaya cevrilebilir hale gelir.
    """
    fatura = db.get(Fatura, fatura_id)
    if fatura is None or fatura.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fatura bulunamadı.")

    for k in list(db.execute(select(FaturaDetay).where(FaturaDetay.fatura_id == fatura_id)).scalars()):
        db.delete(k)

    if fatura.proforma_id:
        proforma = db.get(ProformaFatura, fatura.proforma_id)
        if proforma is not None and proforma.durum == "FATURALASTI":
            proforma.durum = "ONAYLANDI"

    db.delete(fatura)
    db.commit()
    return {"iptal_edildi": True}


# ============================================================================ PERSONEL - SİL
@router.delete("/personel/{personel_id}", dependencies=[Depends(izin_gerektir("PERSONEL_DUZENLE"))])
def personel_sil(personel_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    """Personel gecmis odeme kayitlarinin butunlugu icin FIZIKSEL SILINMEZ, pasif hale getirilir."""
    personel = db.get(Personel, personel_id)
    if personel is None or personel.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Personel bulunamadı.")
    personel.aktif = False
    db.commit()
    return {"silindi": True}


@router.put("/personel-odemeleri/{odeme_id}/odemeyi-geri-al", dependencies=[Depends(izin_gerektir("PERSONEL_DUZENLE"))])
def personel_odemesini_geri_al(
    odeme_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    odeme = db.get(PersonelOdeme, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    personel = db.get(Personel, odeme.personel_id)
    if personel is None or personel.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    if not odeme.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu ödeme zaten yapılmamış durumda.")

    from app.models.banka import KasaHareketi, BankaHareketi
    for h in list(db.execute(
        select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "PERSONEL_ODEME", KasaHareketi.kaynak_id == odeme_id)
    ).scalars()):
        db.delete(h)
    for h in list(db.execute(
        select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "PERSONEL_ODEME", BankaHareketi.kaynak_id == odeme_id)
    ).scalars()):
        db.delete(h)

    odeme.odendi_mi = False
    odeme.odeme_tarihi = None
    db.commit()
    return {"geri_alindi": True}


@router.delete("/personel-odemeleri/{odeme_id}", dependencies=[Depends(izin_gerektir("PERSONEL_DUZENLE"))])
def personel_odemesini_sil(
    odeme_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Sadece HENUZ odenmemis bir tahakkuk kaydini siler (yanlislikla girilmisse)."""
    odeme = db.get(PersonelOdeme, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    personel = db.get(Personel, odeme.personel_id)
    if personel is None or personel.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    if odeme.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödenmiş bir kayıt silinemez; önce ödemeyi geri alın.")

    db.delete(odeme)
    db.commit()
    return {"silindi": True}


# ===================================================================== SABİT GİDER - SİL / GERİ AL
@router.delete("/sabit-giderler/{gider_id}", dependencies=[Depends(izin_gerektir("GIDER_DUZENLE"))])
def sabit_gider_sil(gider_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    gider = db.get(SabitGider, gider_id)
    if gider is None or gider.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gider kaydı bulunamadı.")
    if gider.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödenmiş bir gider kaydı silinemez.")
    db.delete(gider)
    db.commit()
    return {"silindi": True}


@router.put("/sabit-giderler/{gider_id}/odemeyi-geri-al", dependencies=[Depends(izin_gerektir("GIDER_DUZENLE"))])
def sabit_gider_odemesini_geri_al(
    gider_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    gider = db.get(SabitGider, gider_id)
    if gider is None or gider.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gider kaydı bulunamadı.")
    if not gider.odendi_mi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu gider zaten ödenmemiş durumda.")

    from app.models.banka import KasaHareketi, BankaHareketi
    for h in list(db.execute(
        select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "SABIT_GIDER", KasaHareketi.kaynak_id == gider_id)
    ).scalars()):
        db.delete(h)
    for h in list(db.execute(
        select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "SABIT_GIDER", BankaHareketi.kaynak_id == gider_id)
    ).scalars()):
        db.delete(h)

    gider.odendi_mi = False
    gider.odeme_tarihi = None
    db.commit()
    return {"geri_alindi": True}


# ===================================================================== ORTAK/DIŞ BORÇ - SİL
@router.delete("/borclar/{borc_id}", dependencies=[Depends(izin_gerektir("BORC_DUZENLE"))])
def borc_sil(borc_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    borc = db.get(Borc, borc_id)
    if borc is None or borc.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Borç kaydı bulunamadı.")
    odeme_var_mi = db.execute(select(BorcOdeme).where(BorcOdeme.borc_id == borc_id)).first()
    if odeme_var_mi is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ödemesi yapılmış bir borç kaydı silinemez.")
    db.delete(borc)
    db.commit()
    return {"silindi": True}


@router.delete("/borc-odemeleri/{odeme_id}", dependencies=[Depends(izin_gerektir("BORC_DUZENLE"))])
def borc_odemesini_sil(
    odeme_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Bir borc odeme kaydini (yanlislikla girildiyse) siler ve olusturdugu
    Kasa/Banka hareketini de geri alir. Borcun kendisi etkilenmez, sadece
    bu tek odeme kaydi kaldirilir.
    """
    odeme = db.get(BorcOdeme, odeme_id)
    if odeme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")
    borc = db.get(Borc, odeme.borc_id)
    if borc is None or borc.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ödeme kaydı bulunamadı.")

    from app.models.banka import KasaHareketi, BankaHareketi
    for h in list(db.execute(
        select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "BORC_ODEME", KasaHareketi.kaynak_id == odeme_id)
    ).scalars()):
        db.delete(h)
    for h in list(db.execute(
        select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "BORC_ODEME", BankaHareketi.kaynak_id == odeme_id)
    ).scalars()):
        db.delete(h)

    db.delete(odeme)
    db.commit()
    return {"silindi": True}


# ===================================================================== KDV RAPORU
@router.get("/raporlar/kdv-ozeti", response_model=KdvOzetYaniti,
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
async def kdv_ozeti(
    ay_sayisi: int = 12, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Ay ay KDV ozeti: Hesaplanan KDV (satis faturalarindaki kdv_tutari,
    TRY'ye canli kurla cevrilir) ve Indirilecek KDV = Siparis (alim)
    kalemlerinden OTOMATIK hesaplanan KDV + kullanicinin elle ekledigi
    manuel girisler (orn. sipariş disi giderlerin KDV'si icin).
    """
    from app.services.kur_servisi import guncel_kur_getir
    from app.models.stok import Siparis, SiparisDetay

    faturalar = list(db.execute(select(Fatura).where(Fatura.sirket_id == sirket_id)).scalars())

    kur_cache: dict[str, Decimal] = {"TRY": Decimal("1")}

    async def kur_getir(pb: str) -> Decimal:
        if pb not in kur_cache:
            try:
                k = await guncel_kur_getir(pb)
                kur_cache[pb] = Decimal(str(k)) if k else Decimal("1")
            except Exception:
                kur_cache[pb] = Decimal("1")
        return kur_cache[pb]

    hesaplanan: dict[str, Decimal] = {}
    for f in faturalar:
        if not f.tarih:
            continue
        ay = f.tarih.strftime("%Y-%m")
        pb = f.para_birimi.value if hasattr(f.para_birimi, "value") else f.para_birimi
        kur = await kur_getir(pb) if pb != "TRY" else Decimal("1")
        hesaplanan[ay] = hesaplanan.get(ay, Decimal("0")) + (f.kdv_tutari or Decimal("0")) * kur

    indirilecek: dict[str, Decimal] = {}

    # 1) Siparis kalemlerinden OTOMATIK indirilecek KDV
    siparis_satirlari = list(db.execute(
        select(Siparis.siparis_tarihi, SiparisDetay.miktar, SiparisDetay.birim_fiyat,
               SiparisDetay.para_birimi, SiparisDetay.kdv_orani)
        .join(SiparisDetay, SiparisDetay.siparis_id == Siparis.id)
        .where(Siparis.sirket_id == sirket_id, Siparis.durum.notin_(["TASLAK", "IPTAL"]))
    ).all())
    for tarih, miktar, birim_fiyat, pb, kdv_orani in siparis_satirlari:
        if not tarih:
            continue
        ay = tarih.strftime("%Y-%m")
        pb_deger = pb.value if hasattr(pb, "value") else pb
        kur = await kur_getir(pb_deger) if pb_deger != "TRY" else Decimal("1")
        kdv_tutari_try = miktar * birim_fiyat * (kdv_orani / Decimal("100")) * kur
        indirilecek[ay] = indirilecek.get(ay, Decimal("0")) + kdv_tutari_try

    # 2) Gumruk beyannamelerindeki KDV (ithalatta gumrukte odenen KDV)
    from app.models.stok import GumrukBeyannamesi
    gumruk_beyannameleri = list(db.execute(
        select(GumrukBeyannamesi).join(Siparis, Siparis.id == GumrukBeyannamesi.siparis_id)
        .where(Siparis.sirket_id == sirket_id, GumrukBeyannamesi.kdv_tutari > 0)
    ).scalars())
    for gb in gumruk_beyannameleri:
        if not gb.beyanname_tarihi:
            continue
        ay = gb.beyanname_tarihi.strftime("%Y-%m")
        indirilecek[ay] = indirilecek.get(ay, Decimal("0")) + gb.kdv_tutari

    # 3) Kullanicinin elle ekledigi ek girisler (siparis/gumruk disi giderler icin)
    for g in db.execute(select(KdvManuelGiris).where(KdvManuelGiris.sirket_id == sirket_id)).scalars():
        indirilecek[g.ay] = indirilecek.get(g.ay, Decimal("0")) + g.tutar_try

    tum_aylar = sorted(set(hesaplanan.keys()) | set(indirilecek.keys()), reverse=True)[:ay_sayisi]
    satirlar = [
        KdvOzetSatiri(
            ay=ay, hesaplanan_kdv_try=hesaplanan.get(ay, Decimal("0")),
            indirilecek_kdv_try=indirilecek.get(ay, Decimal("0")),
            net_kdv_try=hesaplanan.get(ay, Decimal("0")) - indirilecek.get(ay, Decimal("0")),
        )
        for ay in tum_aylar
    ]
    return KdvOzetYaniti(satirlar=satirlar)


@router.post("/kdv-manuel-girisler", response_model=KdvManuelGirisYanit,
             dependencies=[Depends(izin_gerektir("GIDER_DUZENLE"))])
def kdv_manuel_giris_ekle(
    istek: KdvManuelGirisIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    yeni = KdvManuelGiris(sirket_id=sirket_id, ay=istek.ay, tutar_try=istek.tutar_try, aciklama=istek.aciklama)
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/kdv-manuel-girisler", response_model=list[KdvManuelGirisYanit],
            dependencies=[Depends(izin_gerektir("RAPOR_GORUNTULE"))])
def kdv_manuel_girisleri_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(KdvManuelGiris).where(KdvManuelGiris.sirket_id == sirket_id).order_by(KdvManuelGiris.ay.desc())
    return list(db.execute(sorgu).scalars())


@router.delete("/kdv-manuel-girisler/{giris_id}", dependencies=[Depends(izin_gerektir("GIDER_DUZENLE"))])
def kdv_manuel_giris_sil(
    giris_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    kayit = db.get(KdvManuelGiris, giris_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kayıt bulunamadı.")
    db.delete(kayit)
    db.commit()
    return {"silindi": True}
