import json
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.core.security import sifre_dogrula
from app.models.auth import Kullanici
from app.models.banka import BankaHesabi, BankaHareketi, KasaHareketi, BankaHareketTip
from app.models.denetim import DuzenlemeKaydi
from app.schemas.banka import (
    BankaHesabiOlusturIstegi, BankaHesabiYanit, BankaBakiyeYanit,
    BankaHareketiOlusturIstegi, BankaHareketiYanit, BankaHareketiDuzenleIstegi,
    KasaHareketiOlusturIstegi, KasaHareketiYanit, KasaHareketiDuzenleIstegi, KasaBakiyeYanit, KasaBakiyeSatiri,
)
from app.services.kur_servisi import guncel_kur_getir


def _degisiklikleri_kaydet(db: Session, sirket_id: int, kullanici_id: int, tablo_adi: str, kayit_id: int, degisiklikler: dict) -> None:
    """Bos olmayan bir degisiklik sozlugu varsa denetim izi olusturur."""
    if not degisiklikler:
        return
    db.add(DuzenlemeKaydi(
        sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
        kayit_id=kayit_id, degisiklikler=json.dumps(degisiklikler, ensure_ascii=False, default=str),
    ))

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

    # ONEMLI: HESAPLAR_ARASI_TRANSFER / DOVIZ_ALIM / DOVIZ_SATIM icin,
    # kullanicinin "tutar" alanina dogru isareti (+/-) elle girmesine
    # GUVENMIYORUZ artik - bu, kullanicinin yanlislikla hem kaynak hem
    # karsi hesaba ayni isaretli (orn. ikisi de negatif) tutar girmesine
    # yol acan bir hataydi. Bunun yerine: girilen tutarin MUTLAK DEGERI
    # alinir, kaynak hesaptan HER ZAMAN cikar (negatif islenir), karsi
    # hesaba HER ZAMAN (kur ile carpilmis) pozitif olarak islenir.
    if istek.tip in _CIFT_TARAFLI_TIPLER:
        kaynak_tutar = -abs(istek.tutar)
    else:
        kaynak_tutar = istek.tutar

    ana_hareket = BankaHareketi(
        sirket_id=sirket_id,
        banka_hesap_id=istek.banka_hesap_id,
        tarih=istek.tarih,
        tip=istek.tip,
        tutar=kaynak_tutar,
        aciklama=istek.aciklama,
        karsi_hesap_id=istek.karsi_hesap_id,
        kullanilan_kur=istek.kullanilan_kur,
        cari_id=istek.cari_id,
        tutar_try_karsiligi=istek.tutar_try_karsiligi,
        olusturan_kullanici_id=kullanici.id,
    )
    db.add(ana_hareket)

    if istek.tip in _CIFT_TARAFLI_TIPLER and istek.karsi_hesap_id is not None:
        carpan = istek.kullanilan_kur if istek.kullanilan_kur else 1
        karsi_tutar = abs(istek.tutar) * carpan
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
    istek: BankaHareketiDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Mevcut bir banka hareketini duzenler. Sadece BANKA_DUZENLE iznine sahip
    kullanicilar cagirabilir VE kendi sifresini dogrulamalidir (yanlislikla
    ya da yetkisiz degisiklikleri onlemek icin). Her basarili duzenleme,
    kim/ne zaman/hangi alanlar degisti bilgisiyle denetim_kayitlari'na
    islenir - Yonetici Paneli'nden goruntulenebilir.
    Not: cift tarafli (transfer/doviz) hareketlerde SADECE bu satir
    guncellenir, otomatik acilmis karsi kayit degismez - gerekirse o da
    ayrica duzenlenmelidir.
    """
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    kayit = db.get(BankaHareketi, hareket_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Banka hareketi bulunamadı.")

    alan_adlari = {
        "banka_hesap_id": "Banka Hesabı", "tarih": "Tarih", "tip": "Tür", "tutar": "Tutar",
        "aciklama": "Açıklama", "karsi_hesap_id": "Karşı Hesap", "kullanilan_kur": "Kur",
        "cari_id": "Cari", "tutar_try_karsiligi": "TL Karşılığı",
    }
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(kayit, alan)
        yeni = getattr(istek, alan)
        eski_metin = eski.value if hasattr(eski, "value") else eski
        yeni_metin = yeni.value if hasattr(yeni, "value") else yeni
        if str(eski_metin) != str(yeni_metin):
            degisiklikler[etiket] = {"eski": eski_metin, "yeni": yeni_metin}
        setattr(kayit, alan, yeni)

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "banka_hareketleri", kayit.id, degisiklikler)

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
        cari_id=istek.cari_id,
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
    istek: KasaHareketiDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Mevcut bir kasa hareketini duzenler. Sadece KASA_DUZENLE iznine sahip
    kullanicilar cagirabilir VE kendi sifresini dogrulamalidir. Her basarili
    duzenleme denetim_kayitlari'na islenir (Yonetici Paneli > Duzenleme Gecmisi).
    """
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    kayit = db.get(KasaHareketi, hareket_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kasa hareketi bulunamadı.")

    if istek.para_birimi.value != "TRY" and istek.tutar_try_karsiligi is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "TRY dışı bir para birimi seçildiğinde tutar_try_karsiligi zorunludur."
        )
    tutar_try_karsiligi = istek.tutar_try_karsiligi if istek.para_birimi.value != "TRY" else istek.tutar

    alan_adlari = {
        "tarih": "Tarih", "yon": "Yön", "para_birimi": "Para Birimi", "tutar": "Tutar",
        "tutar_try_karsiligi": "TL Karşılığı", "aciklama": "Açıklama", "cari_id": "Cari",
    }
    yeni_degerler = {
        "tarih": istek.tarih, "yon": istek.yon, "para_birimi": istek.para_birimi, "tutar": istek.tutar,
        "tutar_try_karsiligi": tutar_try_karsiligi, "aciklama": istek.aciklama, "cari_id": istek.cari_id,
    }
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(kayit, alan)
        yeni = yeni_degerler[alan]
        eski_metin = eski.value if hasattr(eski, "value") else eski
        yeni_metin = yeni.value if hasattr(yeni, "value") else yeni
        if str(eski_metin) != str(yeni_metin):
            degisiklikler[etiket] = {"eski": eski_metin, "yeni": yeni_metin}
        setattr(kayit, alan, yeni)

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "kasa_hareketleri", kayit.id, degisiklikler)

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


# --------------------------------------------------------------- Yardımcı
def _kaynak_kaydi_var_mi(db: Session, kaynak_tablo: str, kaynak_id: int) -> bool:
    """
    Bir hareketin kaynak_tablo/kaynak_id ikilisinin hala gecerli bir kayda
    isaret edip etmedigini kontrol eder. Kaynak baska bir yoldan (dogrudan
    silme, veri duzeltme vb.) kaldirilmissa (orphan/hayalet kayit), bu
    hareketin manuel silinmesine izin verilir - aksi halde sonsuza kadar
    silinemez bir kayit olarak kalir.
    """
    try:
        if kaynak_tablo == "AKREDITIF_KALEMI":
            from app.models.akreditif import AkreditifKalemi
            return db.get(AkreditifKalemi, kaynak_id) is not None
        if kaynak_tablo == "AKREDITIF_KALEM_TAKSIT":
            from app.models.akreditif_taksit import AkreditifKalemTaksiti
            return db.get(AkreditifKalemTaksiti, kaynak_id) is not None
        if kaynak_tablo == "CEKLER":
            from app.models.finansal import Cek
            return db.get(Cek, kaynak_id) is not None
        if kaynak_tablo == "LEASING_ODEME":
            from app.models.finansal import LeasingOdeme
            return db.get(LeasingOdeme, kaynak_id) is not None
        if kaynak_tablo == "TAKSIT_DETAY":
            from app.models.finansal import TaksitDetay
            return db.get(TaksitDetay, kaynak_id) is not None
        if kaynak_tablo == "KIRALAMA_ODEME":
            from app.models.finansal import KiralamaOdeme
            return db.get(KiralamaOdeme, kaynak_id) is not None
        if kaynak_tablo == "PERSONEL_ODEME":
            from app.models.diger import PersonelOdeme
            return db.get(PersonelOdeme, kaynak_id) is not None
        if kaynak_tablo == "SABIT_GIDER":
            from app.models.diger import SabitGider
            return db.get(SabitGider, kaynak_id) is not None
        if kaynak_tablo == "BORC_ODEME":
            from app.models.diger import BorcOdeme
            return db.get(BorcOdeme, kaynak_id) is not None
        if kaynak_tablo == "BAKIM_KAYDI":
            from app.models.finansal import BakimKaydi
            return db.get(BakimKaydi, kaynak_id) is not None
        if kaynak_tablo == "STOK_SATIS":
            from app.models.stok import StokSeriNo
            return db.get(StokSeriNo, kaynak_id) is not None
    except Exception:
        pass
    # Bilinmeyen bir kaynak_tablo ise, guvenli tarafta kalip "hala var" sayariz.
    return True


# --------------------------------------------------------- KASA HAREKETİ - SİL
@router.delete("/kasa-hareketleri/{hareket_id}", dependencies=[Depends(izin_gerektir("KASA_DUZENLE"))])
def kasa_hareketi_sil(
    hareket_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Manuel girilmis (kaynak_tablo=None) kasa hareketleri her zaman silinebilir.
    Otomatik gelen (kaynak_tablo dolu) bir hareket icin, ONCE kaynagin hala
    gecerli olup olmadigina bakilir: kaynak hala varsa silme reddedilir (o
    modulde "Odemeyi Geri Al" kullanilmali); kaynak artik yoksa (hayalet
    kayit), bu hareketin dogrudan silinmesine izin verilir.
    """
    kayit = db.get(KasaHareketi, hareket_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kasa hareketi bulunamadı.")
    if kayit.kaynak_tablo is not None and _kaynak_kaydi_var_mi(db, kayit.kaynak_tablo, kayit.kaynak_id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Bu hareket '{kayit.kaynak_tablo}' modülünden otomatik oluşturulmuştur ve kaynağı hâlâ mevcut; "
            "buradan silinemez. İlgili modülde 'Ödemeyi Geri Al' seçeneğini kullanın."
        )
    db.delete(kayit)
    db.commit()
    return {"silindi": True}


# ------------------------------------------------------- BANKA HAREKETİ - SİL
@router.delete("/banka-hareketleri/{hareket_id}", dependencies=[Depends(izin_gerektir("BANKA_DUZENLE"))])
def banka_hareketi_sil(
    hareket_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Manuel girilmis (kaynak_tablo=None) banka hareketleri her zaman silinebilir.
    Otomatik gelen bir hareket icin, kaynak hala geçerliyse silme reddedilir;
    kaynak artik yoksa (hayalet kayit) silinmesine izin verilir.
    Cift-tarafli (transfer/doviz) hareketlerde SADECE bu satir silinir; karsi
    hesaptaki es kaydi ayrica silinmelidir.
    """
    kayit = db.get(BankaHareketi, hareket_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Banka hareketi bulunamadı.")
    if kayit.kaynak_tablo is not None and _kaynak_kaydi_var_mi(db, kayit.kaynak_tablo, kayit.kaynak_id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Bu hareket '{kayit.kaynak_tablo}' modülünden otomatik oluşturulmuştur ve kaynağı hâlâ mevcut; "
            "buradan silinemez. İlgili modülde 'Ödemeyi Geri Al' seçeneğini kullanın."
        )
    db.delete(kayit)
    db.commit()
    return {"silindi": True}
