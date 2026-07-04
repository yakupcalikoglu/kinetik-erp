from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.diger import (
    Personel, PersonelOdeme, SabitGiderKategori, SabitGider,
    Borc, BorcOdeme, BorcTip, ProformaFatura, ProformaDetay, Fatura, FaturaDetay,
)
from app.schemas.diger import (
    PersonelOlusturIstegi, PersonelYanit, PersonelOdemeOlusturIstegi, PersonelOdemeYanit, OdeIstegi,
    SabitGiderOlusturIstegi, SabitGiderYanit, SabitGiderKategoriYanit,
    BorcOlusturIstegi, BorcYanit, BorcOdemeOlusturIstegi, BorcOdemeYanit, BorcBakiyeYanit,
    ProformaOlusturIstegi, ProformaYanit, FaturayaCevirYaniti, FaturaYanit,
)
from app.services.para_hareketi import para_hareketi_olustur

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
@router.get("/sabit-gider-kategorileri", response_model=list[SabitGiderKategoriYanit])
def sabit_gider_kategorilerini_listele(db: Session = Depends(get_db)):
    return list(db.execute(select(SabitGiderKategori)).scalars())


@router.post("/sabit-giderler", response_model=SabitGiderYanit, dependencies=[Depends(izin_gerektir("GIDER_DUZENLE"))])
def sabit_gider_ekle(istek: SabitGiderOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    yeni = SabitGider(sirket_id=sirket_id, **istek.model_dump())
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
        db, sirket_id, kullanici.id, "CIKIS", gider.tutar,
        istek.odeme_yontemi, istek.banka_hesap_id,
        aciklama=gider.aciklama or "Sabit gider ödemesi",
        kaynak_tablo="SABIT_GIDER", kaynak_id=gider.id,
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


@router.get("/proforma-faturalar/{proforma_id}", response_model=ProformaYanit,
            dependencies=[Depends(izin_gerektir("FATURA_GORUNTULE"))])
def proforma_getir(proforma_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    proforma = db.get(ProformaFatura, proforma_id)
    if proforma is None or proforma.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proforma fatura bulunamadı.")
    return _proforma_detayli_getir(db, proforma_id)


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


@router.get("/faturalar/{fatura_id}", response_model=FaturaYanit,
            dependencies=[Depends(izin_gerektir("FATURA_GORUNTULE"))])
def fatura_getir(fatura_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    fatura = db.get(Fatura, fatura_id)
    if fatura is None or fatura.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fatura bulunamadı.")
    return fatura
