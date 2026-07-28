from datetime import date
from decimal import Decimal
from pydantic import BaseModel


class DemirbasOlusturIstegi(BaseModel):
    kategori: str  # ARAC | GAYRIMENKUL | OFIS_EKIPMANI | DIGER
    ad: str
    tanimlayici_no: str | None = None
    konum: str | None = None
    durum: str = "KULLANIMDA"
    kiraci_cari_id: int | None = None
    maliyet_orijinal: Decimal
    para_birimi: str = "TRY"
    kur: Decimal = Decimal("1")
    alim_tarihi: date | None = None
    notlar: str | None = None


class DemirbasDuzenleIstegi(BaseModel):
    sifre: str  # kullanicinin kendi giris sifresi - degisiklik onayi icin zorunlu
    kategori: str
    ad: str
    tanimlayici_no: str | None = None
    konum: str | None = None
    durum: str
    kiraci_cari_id: int | None = None
    maliyet_try: Decimal
    alim_tarihi: date | None = None
    notlar: str | None = None


class DemirbasSatisIstegi(BaseModel):
    satis_fiyati_try: Decimal = Decimal("0")
    odeme_yontemi: str | None = None  # "NAKIT" | "BANKA" - satis_fiyati_try > 0 ise zorunlu
    banka_hesap_id: int | None = None
    aciklama: str | None = None


class DemirbasTopluIceAktarSatiri(BaseModel):
    kategori: str | None = None
    ad: str | None = None
    tanimlayici_no: str | None = None
    konum: str | None = None
    maliyet_try: Decimal | None = None
    alim_tarihi: date | None = None


class DemirbasTopluIceAktarIstegi(BaseModel):
    satirlar: list[DemirbasTopluIceAktarSatiri]


class DemirbasTopluIceAktarSonucu(BaseModel):
    basarili_sayisi: int
    hatali_satirlar: list[dict]


class DemirbasYanit(BaseModel):
    id: int
    kategori: str
    ad: str
    tanimlayici_no: str | None
    konum: str | None
    durum: str
    kiraci_cari_id: int | None
    kiraci_unvan: str | None = None
    maliyet_try: Decimal
    maliyet_orijinal: Decimal | None = None
    para_birimi: str = "TRY"
    alim_tarihi: date | None
    satis_fiyati_try: Decimal | None
    satis_tarihi: date | None
    notlar: str | None

    class Config:
        from_attributes = True
