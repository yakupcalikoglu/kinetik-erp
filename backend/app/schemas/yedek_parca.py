from datetime import date
from decimal import Decimal
from pydantic import BaseModel
from app.models.yedek_parca import YedekParcaHareketYon


class YedekParcaOlusturIstegi(BaseModel):
    ad: str
    birim: str = "ADET"
    birim_fiyat_try: Decimal = Decimal("0")
    min_stok_seviyesi: Decimal = Decimal("0")
    notlar: str | None = None


class YedekParcaDuzenleIstegi(BaseModel):
    sifre: str  # kullanicinin kendi giris sifresi - degisiklik onayi icin zorunlu
    ad: str
    birim: str
    birim_fiyat_try: Decimal
    min_stok_seviyesi: Decimal
    notlar: str | None = None


class YedekParcaYanit(BaseModel):
    id: int
    ad: str
    birim: str
    mevcut_miktar: Decimal
    birim_fiyat_try: Decimal
    min_stok_seviyesi: Decimal | None
    notlar: str | None

    class Config:
        from_attributes = True


class YedekParcaHareketOlusturIstegi(BaseModel):
    tarih: date
    yon: YedekParcaHareketYon
    miktar: Decimal
    birim_fiyat_try: Decimal | None = None  # GIRIS icin verilirse guncel birim fiyatini gunceller
    ilgili_cari_id: int | None = None
    aciklama: str | None = None


class YedekParcaHareketYanit(BaseModel):
    id: int
    yedek_parca_id: int
    tarih: date
    yon: YedekParcaHareketYon
    miktar: Decimal
    birim_fiyat_try: Decimal | None
    ilgili_cari_id: int | None
    ilgili_cari_unvan: str | None = None
    aciklama: str | None

    class Config:
        from_attributes = True
