from datetime import date
from decimal import Decimal
from pydantic import BaseModel
from app.models.diger import ParaBirimi, PersonelOdemeTip, BorcTip


# ----------------------------------------------------------------- Personel
class PersonelOlusturIstegi(BaseModel):
    ad_soyad: str
    pozisyon: str | None = None
    aylik_maas: Decimal | None = None
    ise_baslama_tarihi: date | None = None


class PersonelYanit(BaseModel):
    id: int
    ad_soyad: str
    pozisyon: str | None
    aylik_maas: Decimal | None
    ise_baslama_tarihi: date | None
    aktif: bool

    class Config:
        from_attributes = True


class PersonelOdemeOlusturIstegi(BaseModel):
    donem: date
    tip: PersonelOdemeTip
    tutar: Decimal
    aciklama: str | None = None


class PersonelOdemeYanit(BaseModel):
    id: int
    personel_id: int
    donem: date
    tip: PersonelOdemeTip
    tutar: Decimal
    odendi_mi: bool
    odeme_tarihi: date | None

    class Config:
        from_attributes = True


class OdeIstegi(BaseModel):
    odeme_tarihi: date
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None


# ------------------------------------------------------------ Sabit Giderler
class SabitGiderOlusturIstegi(BaseModel):
    kategori: str  # Serbest metin - Harcama Turleri ile ayni oneri listesini kullanir
    donem: date
    tutar: Decimal
    aciklama: str | None = None


class SabitGiderYanit(BaseModel):
    id: int
    kategori: str | None
    donem: date
    tutar: Decimal
    odendi_mi: bool
    odeme_tarihi: date | None
    aciklama: str | None

    class Config:
        from_attributes = True


# ------------------------------------------------------------- Ortak/Dış Borç
class BorcOlusturIstegi(BaseModel):
    tip: BorcTip
    cari_id: int
    tutar: Decimal
    para_birimi: ParaBirimi
    faiz_orani: Decimal = Decimal("0")
    alinma_tarihi: date
    vade_tarihi: date | None = None
    notlar: str | None = None


class BorcYanit(BaseModel):
    id: int
    tip: BorcTip
    cari_id: int
    tutar: Decimal
    para_birimi: ParaBirimi
    faiz_orani: Decimal
    alinma_tarihi: date
    vade_tarihi: date | None

    class Config:
        from_attributes = True


class BorcOdemeOlusturIstegi(BaseModel):
    tarih: date
    tutar: Decimal
    aciklama: str | None = None
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None


class BorcOdemeYanit(BaseModel):
    id: int
    tarih: date
    tutar: Decimal
    aciklama: str | None

    class Config:
        from_attributes = True


class BorcBakiyeYanit(BaseModel):
    borc_id: int
    toplam_borc: Decimal
    toplam_odenen: Decimal
    kalan_bakiye: Decimal


# ------------------------------------------------------------ Proforma/Fatura
class KalemIstegi(BaseModel):
    stok_karti_id: int | None = None
    aciklama: str | None = None
    miktar: Decimal = Decimal("1")
    birim_fiyat: Decimal
    kdv_orani: Decimal = Decimal("20")


class ProformaOlusturIstegi(BaseModel):
    proforma_no: str
    cari_id: int
    tarih: date
    gecerlilik_tarihi: date | None = None
    para_birimi: ParaBirimi
    notlar: str | None = None
    kalemler: list[KalemIstegi]


class ProformaKalemYanit(BaseModel):
    id: int
    stok_karti_id: int | None
    aciklama: str | None
    miktar: Decimal
    birim_fiyat: Decimal
    kdv_orani: Decimal

    class Config:
        from_attributes = True


class ProformaYanit(BaseModel):
    id: int
    proforma_no: str
    cari_id: int
    tarih: date
    para_birimi: ParaBirimi
    ara_toplam: Decimal
    kdv_tutari: Decimal
    genel_toplam: Decimal
    durum: str
    notlar: str | None = None
    kalemler: list[ProformaKalemYanit] = []

    class Config:
        from_attributes = True


class NotGuncelleIstegi(BaseModel):
    notlar: str | None = None


class FaturayaCevirYaniti(BaseModel):
    fatura_id: int
    fatura_no: str


class FaturaKalemYanit(BaseModel):
    id: int
    stok_karti_id: int | None
    aciklama: str | None
    miktar: Decimal
    birim_fiyat: Decimal
    kdv_orani: Decimal

    class Config:
        from_attributes = True


class FaturaYanit(BaseModel):
    id: int
    fatura_no: str
    proforma_id: int | None
    cari_id: int
    tarih: date
    para_birimi: ParaBirimi
    ara_toplam: Decimal
    kdv_tutari: Decimal
    genel_toplam: Decimal
    odeme_durumu: str
    notlar: str | None = None
    kalemler: list[FaturaKalemYanit] = []

    class Config:
        from_attributes = True
