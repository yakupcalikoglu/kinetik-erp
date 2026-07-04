from datetime import date
from decimal import Decimal
from pydantic import BaseModel
from app.models.banka import ParaBirimi, BankaHareketTip, HareketYon


# ------------------------------------------------------------- Banka Hesabı
class BankaHesabiOlusturIstegi(BaseModel):
    banka_adi: str
    sube: str | None = None
    hesap_adi: str | None = None
    iban: str | None = None
    para_birimi: ParaBirimi


class BankaHesabiYanit(BaseModel):
    id: int
    banka_adi: str
    sube: str | None
    hesap_adi: str | None
    iban: str | None
    para_birimi: ParaBirimi
    aktif: bool

    class Config:
        from_attributes = True


class BankaBakiyeYanit(BaseModel):
    banka_hesap_id: int
    banka_adi: str
    hesap_adi: str | None
    para_birimi: ParaBirimi
    bakiye: Decimal


# ----------------------------------------------------------- Banka Hareketi
class BankaHareketiOlusturIstegi(BaseModel):
    banka_hesap_id: int
    tarih: date
    tip: BankaHareketTip
    tutar: Decimal  # GIRIS/CIKIS icin isaretli (cikis negatif); transfer/doviz icin asagidaki not'a bak
    aciklama: str | None = None
    karsi_hesap_id: int | None = None  # TRANSFER ve DOVIZ_* icin zorunlu
    kullanilan_kur: Decimal | None = None  # DOVIZ_* icin zorunlu
    cari_id: int | None = None


class BankaHareketiYanit(BaseModel):
    id: int
    banka_hesap_id: int
    tarih: date
    tip: BankaHareketTip
    tutar: Decimal
    aciklama: str | None
    karsi_hesap_id: int | None
    kullanilan_kur: Decimal | None

    class Config:
        from_attributes = True


# --------------------------------------------------------------- Ana Kasa
class KasaHareketiOlusturIstegi(BaseModel):
    tarih: date
    yon: HareketYon
    tutar: Decimal
    para_birimi: ParaBirimi = ParaBirimi.TRY
    tutar_try_karsiligi: Decimal | None = None  # TRY disi para biriminde zorunlu (kur ile hesaplanir)
    aciklama: str | None = None


class KasaHareketiYanit(BaseModel):
    id: int
    tarih: date
    yon: HareketYon
    tutar: Decimal
    para_birimi: ParaBirimi
    tutar_try_karsiligi: Decimal | None
    aciklama: str | None
    kaynak_tablo: str | None

    class Config:
        from_attributes = True


class KasaBakiyeSatiri(BaseModel):
    para_birimi: ParaBirimi
    net_bakiye: Decimal


class KasaBakiyeYanit(BaseModel):
    bakiyeler: list[KasaBakiyeSatiri]
    net_bakiye_try_toplam: Decimal  # tum para birimlerinin TL karsiligi toplami
