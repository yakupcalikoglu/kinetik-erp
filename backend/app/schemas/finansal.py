from datetime import date
from decimal import Decimal
from pydantic import BaseModel, computed_field
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
    cari_unvan: str | None = None
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
    kur: Decimal | None = None  # NAKIT + TRY disi para birimi icin zorunlu


class CekGecmisYanit(BaseModel):
    id: int
    tarih: date
    eski_durum: CekDurum | None
    yeni_durum: CekDurum | None
    aciklama: str | None

    class Config:
        from_attributes = True


# ----------------------------------------------------------------- Leasing
class LeasingKalemIstegi(BaseModel):
    stok_karti_id: int
    miktar: int = 1
    birim_fiyat: Decimal


class LeasingKalemYanit(BaseModel):
    id: int
    stok_karti_id: int
    miktar: int
    birim_fiyat: Decimal
    urun_adi: str | None = None

    class Config:
        from_attributes = True


class LeasingOlusturIstegi(BaseModel):
    leasing_firmasi_cari_id: int
    sozlesme_no: str | None = None
    baslangic_tarihi: date
    para_birimi: ParaBirimi
    taksit_sayisi: int
    notlar: str | None = None
    kalemler: list[LeasingKalemIstegi]


class LeasingYanit(BaseModel):
    id: int
    leasing_firmasi_cari_id: int
    leasing_firmasi_unvan: str | None = None
    sozlesme_no: str | None
    baslangic_tarihi: date | None
    toplam_tutar: Decimal | None
    para_birimi: ParaBirimi
    taksit_sayisi: int | None
    kalemler: list[LeasingKalemYanit] = []

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
    kur: Decimal | None = None  # NAKIT + TRY disi para birimi icin zorunlu


# ------------------------------------------------------------ Taksitli Satış
class TaksitKalemIstegi(BaseModel):
    stok_karti_id: int
    miktar: int = 1
    birim_fiyat: Decimal


class TaksitKalemYanit(BaseModel):
    id: int
    stok_karti_id: int
    miktar: int
    birim_fiyat: Decimal
    urun_adi: str | None = None

    class Config:
        from_attributes = True


class TaksitliSatisOlusturIstegi(BaseModel):
    musteri_cari_id: int
    para_birimi: ParaBirimi
    pesinat: Decimal = Decimal("0")
    taksit_sayisi: int
    baslangic_tarihi: date
    notlar: str | None = None
    kalemler: list[TaksitKalemIstegi]


class TaksitliSatisYanit(BaseModel):
    id: int
    musteri_cari_id: int
    musteri_unvan: str | None = None
    toplam_tutar: Decimal
    para_birimi: ParaBirimi
    pesinat: Decimal
    taksit_sayisi: int
    baslangic_tarihi: date
    kalemler: list[TaksitKalemYanit] = []

    class Config:
        from_attributes = True


class TaksitDetayYanit(BaseModel):
    id: int
    plan_id: int | None = None
    musteri_unvan: str | None = None
    urun_seri_no: str | None = None
    taksit_no: int
    vade_tarihi: date
    tutar: Decimal
    odenen_tutar: Decimal = Decimal("0")
    odendi_mi: bool
    odeme_tarihi: date | None

    class Config:
        from_attributes = True

    @computed_field
    def kalan_bakiye(self) -> Decimal:
        return self.tutar - self.odenen_tutar


class TaksitTahsilIstegi(BaseModel):
    odeme_tarihi: date
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None
    kur: Decimal | None = None  # NAKIT + TRY disi para birimi icin zorunlu
    tahsilat_kaynak_tablo: str | None = None
    tahsilat_kaynak_id: int | None = None
    tutar: Decimal | None = None  # Belirtilmezse taksidin kalan tam bakiyesi tahsil edilir


class TaksitOdemeSonucu(BaseModel):
    """Bir tahsilat sonrasi hangi taksitlerin ne kadar etkilendigini gosterir -
    fazla odeme sonraki taksitlere otomatik yansitildiginda birden fazla
    taksit bu tek istekle guncellenebilir."""
    guncellenen_taksitler: list[TaksitDetayYanit]
    fazla_odeme_var_mi: bool
    fazla_odeme_tutari: Decimal


# --------------------------------------------------------------- Kiralama
class KiralamaKalemIstegi(BaseModel):
    stok_karti_id: int
    miktar: int = 1
    birim_fiyat: Decimal  # bu urun turu icin aylik kira bedeli


class KiralamaKalemYanit(BaseModel):
    id: int
    stok_karti_id: int
    miktar: int
    birim_fiyat: Decimal
    urun_adi: str | None = None

    class Config:
        from_attributes = True


class KiralamaOlusturIstegi(BaseModel):
    kiraci_cari_id: int
    baslangic_tarihi: date
    bitis_tarihi: date | None = None
    para_birimi: ParaBirimi
    depozito: Decimal = Decimal("0")
    notlar: str | None = None
    kalemler: list[KiralamaKalemIstegi]


class KiralamaDuzenleIstegi(BaseModel):
    sifre: str  # kullanicinin kendi giris sifresi - degisiklik onayi icin zorunlu
    kiraci_cari_id: int
    baslangic_tarihi: date
    bitis_tarihi: date | None = None
    para_birimi: ParaBirimi
    depozito: Decimal = Decimal("0")
    notlar: str | None = None
    kalemler: list[KiralamaKalemIstegi]


class KiralamaYanit(BaseModel):
    id: int
    kiraci_cari_id: int
    kiraci_unvan: str | None = None
    baslangic_tarihi: date
    bitis_tarihi: date | None
    aylik_kira_tutari: Decimal
    para_birimi: ParaBirimi
    depozito: Decimal
    durum: str
    kalemler: list[KiralamaKalemYanit] = []

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
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None
    kur: Decimal | None = None  # NAKIT + TRY disi para birimi icin zorunlu


class BakimYanit(BaseModel):
    id: int
    stok_seri_no_id: int
    urun_seri_no: str | None = None
    urun_adi: str | None = None
    tarih: date
    tip: BakimTip
    aciklama: str | None
    ilgili_cari_id: int | None = None
    ilgili_cari_unvan: str | None = None
    tutar: Decimal
    para_birimi: ParaBirimi
    odendi_tahsil_edildi_mi: bool

    class Config:
        from_attributes = True
