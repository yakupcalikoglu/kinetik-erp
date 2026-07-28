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
    # GIRIS'te: alis fiyati. CIKIS'te: DOLDURULURSA bu bir SATIS'tir (kar
    # hesaplanir + odeme_yontemi ile Kasa/Banka'ya yansir); BOS birakilirsa
    # sadece kullanim/sarf sayilir (mali etkisi yoktur, sadece stok duser).
    birim_fiyat_orijinal: Decimal | None = None
    para_birimi: str = "TRY"
    kur: Decimal = Decimal("1")
    ilgili_cari_id: int | None = None
    aciklama: str | None = None
    # Odeme entegrasyonu - doldurulursa gercek Kasa/Banka hareketi olusur.
    odeme_yontemi: str | None = None  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None


class YedekParcaHareketYanit(BaseModel):
    id: int
    yedek_parca_id: int
    tarih: date
    yon: YedekParcaHareketYon
    miktar: Decimal
    birim_fiyat_orijinal: Decimal | None
    para_birimi: str
    kur: Decimal
    birim_fiyat_try: Decimal | None
    maliyet_birim_fiyat_try: Decimal | None = None
    kar_try: Decimal | None = None  # sadece satis cikislarinda hesaplanir
    odeme_yontemi: str | None = None
    banka_hesap_id: int | None = None
    ilgili_cari_id: int | None
    ilgili_cari_unvan: str | None = None
    aciklama: str | None

    class Config:
        from_attributes = True
