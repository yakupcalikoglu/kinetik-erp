from datetime import date
from decimal import Decimal
from pydantic import BaseModel
from app.models.finansal import (ParaBirimi, CekTip, CekDurum, BakimTip)


# --------------------------------------------------------------------- Çek
class CekOlusturIstegi(BaseModel):
    tip: CekTip
    cek_no: str | None = None
    banka_adi: str | None = None
    cari_id: int | None = None
    tutar: Decimal
    para_birimi: ParaBirimi = ParaBirimi.TRY
    vade_tarihi: date
    alinma_verilme_tarihi: date
    notlar: str | None = None


class CekYanit(BaseModel):
    id: int
    tip: CekTip
    cek_no: str | None
    banka_adi: str | None
    cari_id: int | None
    tutar: Decimal
    para_birimi: ParaBirimi
    vade_tarihi: date
    alinma_verilme_tarihi: date
    durum: CekDurum
    ciro_edilen_cari_id: int | None
    ciro_tarihi: date | None

    class Config:
        from_attributes = True


class CekDurumGuncelleIstegi(BaseModel):
    yeni_durum: CekDurum
    ciro_edilen_cari_id: int | None = None
    aciklama: str | None = None
    odeme_yontemi: str | None = None  # TAHSIL_EDILDI/ODENDI icin zorunlu: "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None


class CekGecmisYanit(BaseModel):
    id: int
    tarih: date
    eski_durum: CekDurum | None
    yeni_durum: CekDurum | None
    aciklama: str | None

    class Config:
        from_attributes = True


# ----------------------------------------------------------------- Leasing
class LeasingOlusturIstegi(BaseModel):
    leasing_firmasi_cari_id: int
    stok_seri_no_id: int | None = None
    sozlesme_no: str | None = None
    baslangic_tarihi: date
    toplam_tutar: Decimal
    para_birimi: ParaBirimi
    taksit_sayisi: int
    notlar: str | None = None


class LeasingYanit(BaseModel):
    id: int
    leasing_firmasi_cari_id: int
    stok_seri_no_id: int | None
    sozlesme_no: str | None
    baslangic_tarihi: date | None
    toplam_tutar: Decimal | None
    para_birimi: ParaBirimi
    taksit_sayisi: int | None

    class Config:
        from_attributes = True


class LeasingOdemeYanit(BaseModel):
    id: int
    taksit_no: int
    vade_tarihi: date
    tutar: Decimal
    odendi_mi: bool
    odeme_tarihi: date | None

    class Config:
        from_attributes = True


class OdemeTahsilIstegi(BaseModel):
    odeme_tarihi: date
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None


# ------------------------------------------------------------ Taksitli Satış
class TaksitliSatisOlusturIstegi(BaseModel):
    musteri_cari_id: int
    stok_seri_no_id: int | None = None
    toplam_tutar: Decimal
    para_birimi: ParaBirimi
    pesinat: Decimal = Decimal("0")
    taksit_sayisi: int
    baslangic_tarihi: date
    notlar: str | None = None


class TaksitliSatisYanit(BaseModel):
    id: int
    musteri_cari_id: int
    stok_seri_no_id: int | None
    toplam_tutar: Decimal
    para_birimi: ParaBirimi
    pesinat: Decimal
    taksit_sayisi: int
    baslangic_tarihi: date

    class Config:
        from_attributes = True


class TaksitDetayYanit(BaseModel):
    id: int
    taksit_no: int
    vade_tarihi: date
    tutar: Decimal
    odendi_mi: bool
    odeme_tarihi: date | None

    class Config:
        from_attributes = True


class TaksitTahsilIstegi(BaseModel):
    odeme_tarihi: date
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None
    tahsilat_kaynak_tablo: str | None = None
    tahsilat_kaynak_id: int | None = None


# --------------------------------------------------------------- Kiralama
class KiralamaOlusturIstegi(BaseModel):
    stok_seri_no_id: int
    kiraci_cari_id: int
    baslangic_tarihi: date
    bitis_tarihi: date | None = None
    aylik_kira_tutari: Decimal
    para_birimi: ParaBirimi
    depozito: Decimal = Decimal("0")
    notlar: str | None = None


class KiralamaYanit(BaseModel):
    id: int
    stok_seri_no_id: int
    kiraci_cari_id: int
    baslangic_tarihi: date
    bitis_tarihi: date | None
    aylik_kira_tutari: Decimal
    para_birimi: ParaBirimi
    depozito: Decimal
    durum: str

    class Config:
        from_attributes = True


class KiralamaOdemeOlusturIstegi(BaseModel):
    donem_basi: date
    donem_sonu: date
    tutar: Decimal


class KiralamaOdemeYanit(BaseModel):
    id: int
    donem_basi: date
    donem_sonu: date
    tutar: Decimal
    odendi_mi: bool
    odeme_tarihi: date | None

    class Config:
        from_attributes = True


# ------------------------------------------------------------------- Bakım
class BakimOlusturIstegi(BaseModel):
    stok_seri_no_id: int
    tarih: date
    tip: BakimTip
    aciklama: str | None = None
    ilgili_cari_id: int | None = None
    tutar: Decimal
    para_birimi: ParaBirimi = ParaBirimi.TRY


class BakimYanit(BaseModel):
    id: int
    stok_seri_no_id: int
    tarih: date
    tip: BakimTip
    aciklama: str | None
    tutar: Decimal
    para_birimi: ParaBirimi
    odendi_tahsil_edildi_mi: bool

    class Config:
        from_attributes = True
