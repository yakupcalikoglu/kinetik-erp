from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.banka import BankaHesabi, BankaHareketi, KasaHareketi, BankaHareketTip
from app.schemas.banka import (
    BankaHesabiOlusturIstegi, BankaHesabiYanit, BankaBakiyeYanit,
    BankaHareketiOlusturIstegi, BankaHareketiYanit,
    KasaHareketiOlusturIstegi, KasaHareketiYanit, KasaBakiyeYanit,
)

router = APIRouter(tags=["Banka ve Ana Kasa"])

# Karsi hesap gerektiren hareket tipleri (cift tarafli kayit acilir)
_CIFT_TARAFLI_TIPLER = {
    BankaHareketTip.HESAPLAR_ARASI_TRANSFER,
    BankaHareketTip.DOVIZ_ALIM,
    BankaHareketTip.DOVIZ_SATIM,
}


# ------------------------------------------------------------- Banka Hesabı
@router.post("/banka-hesaplari", response_model=BankaHesabiYanit,
             dependencies=[Depends(izin_gerektir("BANKA_DUZENLE"))])
def banka_hesabi_olustur(
    istek: BankaHesabiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    yeni = BankaHesabi(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/banka-hesaplari", response_model=list[BankaHesabiYanit],
            dependencies=[Depends(izin_gerektir("BANKA_GORUNTULE"))])
def banka_hesaplarini_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(BankaHesabi).where(BankaHesabi.sirket_id == sirket_id, BankaHesabi.aktif.is_(True))
    return list(db.execute(sorgu).scalars())


@router.get("/banka-bakiyeleri", response_model=list[BankaBakiyeYanit],
            dependencies=[Depends(izin_gerektir("BANKA_GORUNTULE"))])
def banka_bakiyelerini_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Her hesabin guncel bakiyesini banka_hareketleri'nin toplamindan hesaplar.
    (veritabani_semasi.sql'deki v_banka_bakiyeleri view'inin API karsiligi)
    """
    sorgu = (
        select(
            BankaHesabi.id, BankaHesabi.banka_adi, BankaHesabi.hesap_adi,
            BankaHesabi.para_birimi,
            func.coalesce(func.sum(BankaHareketi.tutar), 0).label("bakiye"),
        )
        .outerjoin(BankaHareketi, BankaHareketi.banka_hesap_id == BankaHesabi.id)
        .where(BankaHesabi.sirket_id == sirket_id)
        .group_by(BankaHesabi.id, BankaHesabi.banka_adi, BankaHesabi.hesap_adi, BankaHesabi.para_birimi)
    )
    sonuclar = db.execute(sorgu).all()
    return [
        BankaBakiyeYanit(
            banka_hesap_id=r.id, banka_adi=r.banka_adi, hesap_adi=r.hesap_adi,
            para_birimi=r.para_birimi, bakiye=r.bakiye,
        )
        for r in sonuclar
    ]


@router.get("/banka-hesaplari/{hesap_id}/hareketler", response_model=list[BankaHareketiYanit],
            dependencies=[Depends(izin_gerektir("BANKA_GORUNTULE"))])
def banka_hareketlerini_listele(
    hesap_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    hesap = db.get(BankaHesabi, hesap_id)
    if hesap is None or hesap.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Banka hesabı bulunamadı.")

    sorgu = (
        select(BankaHareketi)
        .where(BankaHareketi.banka_hesap_id == hesap_id, BankaHareketi.sirket_id == sirket_id)
        .order_by(BankaHareketi.tarih.desc())
    )
    return list(db.execute(sorgu).scalars())


# ----------------------------------------------------------- Banka Hareketi
@router.post("/banka-hareketleri", response_model=BankaHareketiYanit,
             dependencies=[Depends(izin_gerektir("BANKA_DUZENLE"))])
def banka_hareketi_olustur(
    istek: BankaHareketiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    GIRIS/CIKIS: tek hesapta tek satir.
    HESAPLAR_ARASI_TRANSFER / DOVIZ_ALIM / DOVIZ_SATIM: kaynak hesapta verilen
    isaretli tutar islenir, karsi hesapta otomatik olarak ters isaretli ve
    (varsa) kur ile carpilmis ikinci bir satir acilir. Bu islem ANA KASAYI
    HIC ETKILEMEZ - kasa_hareketleri tablosuna hicbir kayit eklenmez.
    """
    kaynak_hesap = db.get(BankaHesabi, istek.banka_hesap_id)
    if kaynak_hesap is None or kaynak_hesap.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Banka hesabı bulunamadı.")

    if istek.tip in _CIFT_TARAFLI_TIPLER:
        if istek.karsi_hesap_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"{istek.tip.value} işlemi için karsi_hesap_id zorunludur."
            )
        karsi_hesap = db.get(BankaHesabi, istek.karsi_hesap_id)
        if karsi_hesap is None or karsi_hesap.sirket_id != sirket_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Karşı hesap bulunamadı.")
        if istek.tip in (BankaHareketTip.DOVIZ_ALIM, BankaHareketTip.DOVIZ_SATIM) and not istek.kullanilan_kur:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Döviz alım/satım işlemi için kullanilan_kur zorunludur."
            )

    ana_hareket = BankaHareketi(
        sirket_id=sirket_id,
        banka_hesap_id=istek.banka_hesap_id,
        tarih=istek.tarih,
        tip=istek.tip,
        tutar=istek.tutar,
        aciklama=istek.aciklama,
        karsi_hesap_id=istek.karsi_hesap_id,
        kullanilan_kur=istek.kullanilan_kur,
        cari_id=istek.cari_id,
        olusturan_kullanici_id=kullanici.id,
    )
    db.add(ana_hareket)

    if istek.tip in _CIFT_TARAFLI_TIPLER and istek.karsi_hesap_id is not None:
        carpan = istek.kullanilan_kur if istek.kullanilan_kur else 1
        karsi_tutar = -istek.tutar * carpan  # kaynaktan cikan, karsiya ters isaretle girer
        karsi_hareket = BankaHareketi(
            sirket_id=sirket_id,
            banka_hesap_id=istek.karsi_hesap_id,
            tarih=istek.tarih,
            tip=istek.tip,
            tutar=karsi_tutar,
            aciklama=f"[Otomatik karşı kayıt] {istek.aciklama or ''}".strip(),
            karsi_hesap_id=istek.banka_hesap_id,
            kullanilan_kur=istek.kullanilan_kur,
            cari_id=istek.cari_id,
            olusturan_kullanici_id=kullanici.id,
        )
        db.add(karsi_hareket)

    db.commit()
    db.refresh(ana_hareket)
    return ana_hareket


# --------------------------------------------------------------- Ana Kasa
@router.post("/kasa-hareketleri", response_model=KasaHareketiYanit,
             dependencies=[Depends(izin_gerektir("KASA_DUZENLE"))])
def kasa_hareketi_olustur(
    istek: KasaHareketiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    yeni = KasaHareketi(
        sirket_id=sirket_id,
        olusturan_kullanici_id=kullanici.id,
        **istek.model_dump(),
    )
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/kasa-hareketleri", response_model=list[KasaHareketiYanit],
            dependencies=[Depends(izin_gerektir("KASA_GORUNTULE"))])
def kasa_hareketlerini_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = (
        select(KasaHareketi)
        .where(KasaHareketi.sirket_id == sirket_id)
        .order_by(KasaHareketi.tarih.desc())
    )
    return list(db.execute(sorgu).scalars())


@router.get("/kasa-bakiye", response_model=KasaBakiyeYanit,
            dependencies=[Depends(izin_gerektir("KASA_GORUNTULE"))])
def kasa_bakiye(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(
        func.coalesce(func.sum(
            case((KasaHareketi.yon == "GIRIS", KasaHareketi.tutar_try),
                 else_=-KasaHareketi.tutar_try)
        ), 0)
    ).where(KasaHareketi.sirket_id == sirket_id)
    net = db.execute(sorgu).scalar_one()
    return KasaBakiyeYanit(net_bakiye_try=net)
