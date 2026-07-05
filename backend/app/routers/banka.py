from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.banka import BankaHesabi, BankaHareketi, KasaHareketi, BankaHareketTip
from app.schemas.banka import (
    BankaHesabiOlusturIstegi, BankaHesabiYanit, BankaBakiyeYanit,
    BankaHareketiOlusturIstegi, BankaHareketiYanit,
    KasaHareketiOlusturIstegi, KasaHareketiYanit, KasaBakiyeYanit, KasaBakiyeSatiri,
)
from app.services.kur_servisi import guncel_kur_getir

router = APIRouter(tags=["Banka ve Ana Kasa"])

_CIFT_TARAFLI_TIPLER = {
    BankaHareketTip.HESAPLAR_ARASI_TRANSFER,
    BankaHareketTip.DOVIZ_ALIM,
    BankaHareketTip.DOVIZ_SATIM,
}


@router.get("/kur/{para_birimi}")
async def guncel_kur(para_birimi: str):
    """Guncel USD/EUR -> TRY kurunu doner (ucretsiz dis servisten). Frontend
    formlari bu degeri varsayilan olarak doldurur; kullanici elle degistirebilir."""
    kur = await guncel_kur_getir(para_birimi)
    if kur is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Kur bilgisi alınamadı, lütfen elle girin.")
    return {"para_birimi": para_birimi.upper(), "kur": str(kur), "tarih": str(date.today())}


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


@router.put("/banka-hesaplari/{hesap_id}", response_model=BankaHesabiYanit,
            dependencies=[Depends(izin_gerektir("BANKA_DUZENLE"))])
def banka_hesabi_guncelle(
    hesap_id: int,
    istek: BankaHesabiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    hesap = db.get(BankaHesabi, hesap_id)
    if hesap is None or hesap.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Banka hesabı bulunamadı.")
    for alan, deger in istek.model_dump().items():
        setattr(hesap, alan, deger)
    db.commit()
    db.refresh(hesap)
    return hesap


@router.delete("/banka-hesaplari/{hesap_id}",
               dependencies=[Depends(izin_gerektir("BANKA_DUZENLE"))])
def banka_hesabi_sil(
    hesap_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    hesap = db.get(BankaHesabi, hesap_id)
    if hesap is None or hesap.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Banka hesabı bulunamadı.")
    try:
        db.delete(hesap)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu banka hesabında hareketler olduğu için silinemiyor. Hesabı pasif hale getirmeyi düşünebilirsiniz."
        )
    return {"silindi": True}


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
        karsi_tutar = -istek.tutar * carpan
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


@router.get("/banka-hareketleri", response_model=list[BankaHareketiYanit],
            dependencies=[Depends(izin_gerektir("BANKA_GORUNTULE"))])
def tum_banka_hareketlerini_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Sirketin tum banka hesaplarindaki hareketleri tek listede, en yeniden eskiye dogru getirir."""
    sorgu = (
        select(BankaHareketi)
        .where(BankaHareketi.sirket_id == sirket_id)
        .order_by(BankaHareketi.tarih.desc())
    )
    return list(db.execute(sorgu).scalars())


@router.put("/banka-hareketleri/{hareket_id}", response_model=BankaHareketiYanit,
            dependencies=[Depends(izin_gerektir("BANKA_DUZENLE"))])
def banka_hareketi_guncelle(
    hareket_id: int,
    istek: BankaHareketiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Mevcut bir banka hareketini duzenler. Sadece BANKA_DUZENLE iznine sahip
    kullanicilar cagirabilir (Yonetici Paneli > Rol/Izinler'den atanir).
    Not: cift tarafli (transfer/doviz) hareketlerde SADECE bu satir
    guncellenir, otomatik acilmis karsi kayit degismez - gerekirse o da
    ayrica duzenlenmelidir.
    """
    kayit = db.get(BankaHareketi, hareket_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Banka hareketi bulunamadı.")

    kayit.banka_hesap_id = istek.banka_hesap_id
    kayit.tarih = istek.tarih
    kayit.tip = istek.tip
    kayit.tutar = istek.tutar
    kayit.aciklama = istek.aciklama
    kayit.karsi_hesap_id = istek.karsi_hesap_id
    kayit.kullanilan_kur = istek.kullanilan_kur
    kayit.cari_id = istek.cari_id

    db.commit()
    db.refresh(kayit)
    return kayit


# --------------------------------------------------------------- Ana Kasa
@router.post("/kasa-hareketleri", response_model=KasaHareketiYanit,
             dependencies=[Depends(izin_gerektir("KASA_DUZENLE"))])
def kasa_hareketi_olustur(
    istek: KasaHareketiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    if istek.para_birimi.value != "TRY" and istek.tutar_try_karsiligi is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "TRY dışı bir para birimi seçildiğinde tutar_try_karsiligi (kur ile hesaplanan TL karşılığı) zorunludur."
        )
    tutar_try_karsiligi = istek.tutar_try_karsiligi if istek.para_birimi.value != "TRY" else istek.tutar

    yeni = KasaHareketi(
        sirket_id=sirket_id,
        olusturan_kullanici_id=kullanici.id,
        tarih=istek.tarih,
        yon=istek.yon,
        para_birimi=istek.para_birimi,
        tutar=istek.tutar,
        tutar_try_karsiligi=tutar_try_karsiligi,
        aciklama=istek.aciklama,
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


@router.put("/kasa-hareketleri/{hareket_id}", response_model=KasaHareketiYanit,
            dependencies=[Depends(izin_gerektir("KASA_DUZENLE"))])
def kasa_hareketi_guncelle(
    hareket_id: int,
    istek: KasaHareketiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Mevcut bir kasa hareketini duzenler. Sadece KASA_DUZENLE iznine sahip kullanicilar cagirabilir."""
    kayit = db.get(KasaHareketi, hareket_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kasa hareketi bulunamadı.")

    if istek.para_birimi.value != "TRY" and istek.tutar_try_karsiligi is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "TRY dışı bir para birimi seçildiğinde tutar_try_karsiligi zorunludur."
        )
    tutar_try_karsiligi = istek.tutar_try_karsiligi if istek.para_birimi.value != "TRY" else istek.tutar

    kayit.tarih = istek.tarih
    kayit.yon = istek.yon
    kayit.para_birimi = istek.para_birimi
    kayit.tutar = istek.tutar
    kayit.tutar_try_karsiligi = tutar_try_karsiligi
    kayit.aciklama = istek.aciklama

    db.commit()
    db.refresh(kayit)
    return kayit


@router.get("/kasa-bakiye", response_model=KasaBakiyeYanit,
            dependencies=[Depends(izin_gerektir("KASA_GORUNTULE"))])
def kasa_bakiye(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Her para birimi icin ayri net bakiye (TRY, USD, EUR, ALTIN) DONER,
    ayrica hepsinin o gunku kur ile hesaplanmis TL karsiligi toplamini da verir.
    """
    hareketler = list(db.execute(
        select(KasaHareketi).where(KasaHareketi.sirket_id == sirket_id)
    ).scalars())

    para_birimi_toplamlari: dict[str, Decimal] = {}
    try_toplam = Decimal("0")
    for h in hareketler:
        isaret = 1 if h.yon.value == "GIRIS" else -1
        pb = h.para_birimi.value
        para_birimi_toplamlari[pb] = para_birimi_toplamlari.get(pb, Decimal("0")) + isaret * h.tutar
        if h.tutar_try_karsiligi is not None:
            try_toplam += isaret * h.tutar_try_karsiligi

    bakiyeler = [
        KasaBakiyeSatiri(para_birimi=pb, net_bakiye=tutar)
        for pb, tutar in para_birimi_toplamlari.items()
    ]

    return KasaBakiyeYanit(bakiyeler=bakiyeler, net_bakiye_try_toplam=try_toplam)
