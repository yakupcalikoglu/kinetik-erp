from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel
from app.models.akreditif import AkreditifTip, AkreditifDurum, AkreditifKalemTip


class AkreditifOlusturIstegi(BaseModel):
    siparis_id: int
    banka_hesap_id: int
    akreditif_no: str | None = None
    tip: AkreditifTip = AkreditifTip.VADELI
    para_birimi: str
    tutar: Decimal
    acilis_tarihi: date
    vade_tarihi: date | None = None
    notlar: str | None = None


class AkreditifKalemYanit(BaseModel):
    id: int
    tip: AkreditifKalemTip
    aciklama: str | None
    tutar: Decimal
    vade_tarihi: date
    odendi_mi: bool
    odeme_tarihi: date | None

    class Config:
        from_attributes = True


class AkreditifYanit(BaseModel):
    id: int
    siparis_id: int
    banka_hesap_id: int
    akreditif_no: str | None
    tip: AkreditifTip
    para_birimi: str
    tutar: Decimal
    acilis_tarihi: date
    vade_tarihi: date | None
    durum: AkreditifDurum
    notlar: str | None
    kalemler: list[AkreditifKalemYanit] = []

    class Config:
        from_attributes = True


class AkreditifDurumGuncelleIstegi(BaseModel):
    durum: AkreditifDurum


class AkreditifKalemEkleIstegi(BaseModel):
    tip: AkreditifKalemTip
    aciklama: str | None = None
    tutar: Decimal
    vade_tarihi: date


class AkreditifKalemOdeIstegi(BaseModel):
    odeme_tarihi: date
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None
    kur: Decimal | None = None  # NAKIT + TRY disi para birimi icin zorunlu


# --------------------------------------------------------- Maliyet Dağıtımı
class AkreditifUrunSecenegi(BaseModel):
    stok_seri_no_id: int
    seri_no: str
    satinalma_maliyeti_try: Decimal | None
    mevcut_diger_maliyet_try: Decimal | None


class AkreditifMaliyetDagitIstegi(BaseModel):
    yontem: str  # "ESIT" | "AGIRLIKLI"
    kur: Decimal = Decimal("1")  # akreditif TRY disi ise TL karsiligi icin zorunlu
    stok_seri_no_idleri: list[int] | None = None  # None ise siparisteki TUM urunlere dagitilir


class AkreditifMaliyetDagitYaniti(BaseModel):
    dagitilan_urun_sayisi: int
    toplam_dagitilan_try: Decimal


class AkreditifMaliyetDagitimSatiri(BaseModel):
    id: int
    stok_seri_no_id: int
    seri_no: str | None = None
    yontem: str
    kur: Decimal | None
    tutar_try: Decimal
    olusturma_tarihi: datetime | None

    class Config:
        from_attributes = True
        class AkreditifKalemTaksitlendirIstegi(BaseModel):
    taksit_sayisi: int
    ek_ucret: Decimal = Decimal("0")  # taksitlendirme hizmeti icin alinan ek ucret
    ilk_vade_tarihi: date


class AkreditifKalemTaksitiYanit(BaseModel):
    id: int
    kalem_id: int
    taksit_no: int
    vade_tarihi: date
    tutar: Decimal
    odendi_mi: bool
    odeme_tarihi: date | None

    class Config:
        from_attributes = True


class AkreditifKalemTaksitOdeIstegi(BaseModel):
    odeme_tarihi: date
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None
    kur: Decimal | None = None
