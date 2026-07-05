from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel
from app.models.cari import CariTip, ParaBirimi, HareketYon


class VergiNoSorguIstegi(BaseModel):
    vergi_no: str


class VergiNoSorguYaniti(BaseModel):
    bulundu: bool
    unvan: str | None = None
    vergi_dairesi: str | None = None
    adres: str | None = None
    telefon: str | None = None
    mesaj: str | None = None


class CariOlusturIstegi(BaseModel):
    tip: CariTip
    unvan: str
    vergi_no: str | None = None
    vergi_dairesi: str | None = None
    adres: str | None = None
    telefon: str | None = None
    email: str | None = None
    otomatik_dolduruldu: bool = False


class CariGuncelleIstegi(BaseModel):
    unvan: str | None = None
    vergi_no: str | None = None
    vergi_dairesi: str | None = None
    adres: str | None = None
    telefon: str | None = None
    email: str | None = None
    aktif: bool | None = None


class CariYanit(BaseModel):
    id: int
    tip: CariTip
    unvan: str
    vergi_no: str | None
    vergi_dairesi: str | None
    adres: str | None
    telefon: str | None
    email: str | None
    otomatik_dolduruldu: bool
    bakiye_try: Decimal
    bakiye_usd: Decimal
    bakiye_eur: Decimal
    aktif: bool

    class Config:
        from_attributes = True


class CariHareketYanit(BaseModel):
    id: int
    tarih: date
    aciklama: str | None
    yon: HareketYon
    para_birimi: ParaBirimi
    tutar: Decimal
    tutar_try_karsiligi: Decimal | None
    kaynak_tablo: str | None
    class Config:
        from_attributes = True

    class Config:
        from_attributes = True


class CariBakiyeYanit(BaseModel):
    para_birimi: ParaBirimi
    toplam_giris: Decimal
    toplam_cikis: Decimal
    net_bakiye: Decimal
