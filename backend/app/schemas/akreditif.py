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
    odenen_tutar: Decimal = Decimal("0")
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
    toplam_odenen: Decimal = Decimal("0")  # backend'de hesaplanir
    kalan_bakiye: Decimal = Decimal("0")   # backend'de hesaplanir (tutar - toplam_odenen)

    class Config:
        from_attributes = True


class AkreditifDurumGuncelleIstegi(BaseModel):
    durum: AkreditifDurum


class AkreditifKalemEkleIstegi(BaseModel):
    tip: AkreditifKalemTip
    aciklama: str | None = None
    tutar: Decimal
    vade_tarihi: date


class AkreditifKalemDuzenleIstegi(BaseModel):
    sifre: str  # kullanicinin kendi giris sifresi - degisiklik onayi icin zorunlu
    tip: AkreditifKalemTip
    aciklama: str | None = None
    tutar: Decimal
    vade_tarihi: date


class AkreditifKalemOdeIstegi(BaseModel):
    tutar: Decimal  # bu odemede fiilen odenen tutar - kalemin tamami olmak ZORUNDA DEGIL (kismi odeme desteklenir)
    odeme_tarihi: date
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None
    kur: Decimal | None = None  # NAKIT + TRY disi para birimi icin zorunlu


# --------------------------------------------------------- Maliyet Dağıtımı
class AkreditifUrunSecenegi(BaseModel):
    stok_seri_no_id: int
    seri_no: str
    stok_karti_id: int
    urun_adi: str | None = None
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


# --------------------------------------------------------- Kalem Taksitlendirme
class TaksitManuelSatir(BaseModel):
    vade_tarihi: date
    tutar: Decimal


class AkreditifKalemTaksitlendirIstegi(BaseModel):
    # taksitler VERILMEZSE (eski/basit kullanim): taksit_sayisi'na gore
    # toplam ESIT boluniyor, ilk_vade_tarihi'nden aylik araliklarla vade
    # atanir - GERIYE DONUK UYUMLU eski davranis.
    # taksitler VERILIRSE: her taksidin KENDI tutari/vadesi kullanicidan
    # geldigi HALIYLE (esit olmasi ZORUNLU degil) kaydedilir - "taksit
    # sayisi", "ek_ucret" ve "ilk_vade_tarihi" bu durumda YOK SAYILIR.
    taksit_sayisi: int = 1
    ek_ucret: Decimal = Decimal("0")  # taksitlendirme hizmeti icin alinan ek ucret
    ilk_vade_tarihi: date | None = None
    taksitler: list[TaksitManuelSatir] | None = None


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


class AkreditifKalemTaksitiDuzenleIstegi(BaseModel):
    vade_tarihi: date
    tutar: Decimal
