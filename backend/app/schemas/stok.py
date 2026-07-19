from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, computed_field
from app.models.stok import StokKaynak, StokDurum, MaliyetTip, SiparisDurum, ParaBirimi


# ---------------------------------------------------------------- Stok kartı
class StokKartiOlusturIstegi(BaseModel):
    kategori_id: int | None = None
    marka: str | None = None
    model: str | None = None
    aciklama: str | None = None
    birim: str = "ADET"
    birim_agirlik_kg: Decimal | None = None
    mense_ulke: str | None = None
    gtip_kodu: str | None = None


class StokKartiYanit(BaseModel):
    id: int
    kategori_id: int | None
    marka: str | None
    model: str | None
    birim: str
    birim_agirlik_kg: Decimal | None
    mense_ulke: str | None
    gtip_kodu: str | None

    class Config:
        from_attributes = True


# -------------------------------------------------------------- Stok seri no
class StokSeriNoYanit(BaseModel):
    id: int
    stok_karti_id: int
    seri_no: str
    sasi_no: str | None
    uretim_yili: int | None
    kaynak: StokKaynak
    siparis_id: int | None = None
    durum: StokDurum
    tedarikci_cari_id: int | None
    satinalma_maliyeti_try: Decimal
    nakliye_maliyeti_try: Decimal
    gumruk_maliyeti_try: Decimal
    antrepo_maliyeti_try: Decimal
    millilestirme_maliyeti_try: Decimal
    leasing_maliyeti_try: Decimal
    diger_maliyet_try: Decimal
    satis_fiyati_try: Decimal | None
    satis_tarihi: date | None
    musteri_cari_id: int | None
    satis_cek_id: int | None = None
    garanti_bitis_tarihi: date | None
    barkod: str | None

    class Config:
        from_attributes = True

    @computed_field
    def toplam_maliyet_try(self) -> Decimal:
        return (self.satinalma_maliyeti_try + self.nakliye_maliyeti_try +
                self.gumruk_maliyeti_try + self.antrepo_maliyeti_try +
                self.millilestirme_maliyeti_try + self.leasing_maliyeti_try +
                self.diger_maliyet_try)


class StokSeriNoDuzenleIstegi(BaseModel):
    seri_no: str
    stok_karti_id: int


class StokSeriNoDuzenleSifreliIstegi(BaseModel):
    sifre: str  # kullanicinin kendi giris sifresi - degisiklik onayi icin zorunlu
    seri_no: str
    stok_karti_id: int


class StokDurumGuncelleIstegi(BaseModel):
    durum: StokDurum
    musteri_cari_id: int | None = None
    satis_fiyati_try: Decimal | None = None
    satis_tarihi: date | None = None


class MaliyetKalemiEkleIstegi(BaseModel):
    tip: MaliyetTip
    aciklama: str | None = None
    tedarikci_cari_id: int | None = None
    para_birimi: ParaBirimi
    tutar: Decimal
    kur: Decimal = Decimal("1")
    belge_no: str | None = None
    tarih: date


class MaliyetKalemiDuzenleIstegi(BaseModel):
    sifre: str  # kullanicinin kendi giris sifresi - degisiklik onayi icin zorunlu
    tip: MaliyetTip
    aciklama: str | None = None
    tedarikci_cari_id: int | None = None
    para_birimi: ParaBirimi
    tutar: Decimal
    kur: Decimal = Decimal("1")
    belge_no: str | None = None
    tarih: date


class KarRaporuYanit(BaseModel):
    seri_no: str
    toplam_maliyet_try: Decimal
    satis_fiyati_try: Decimal | None
    kar_zarar_try: Decimal | None
    durum: StokDurum


# ----------------------------------------------------------------- Sipariş
class SiparisUrunIstegi(BaseModel):
    stok_karti_id: int
    miktar: int = 1
    birim_fiyat: Decimal
    para_birimi: ParaBirimi
    birim_agirlik_kg: Decimal | None = None
    aciklama: str | None = None


class SiparisOlusturIstegi(BaseModel):
    siparis_no: str
    tedarikci_cari_id: int
    kaynak: StokKaynak
    siparis_tarihi: date
    tahmini_teslim_tarihi: date | None = None
    para_birimi: ParaBirimi
    cikis_limani: str | None = None
    varis_limani: str | None = None
    notlar: str | None = None
    urunler: list[SiparisUrunIstegi]


class SiparisGuncelleIstegi(BaseModel):
    sifre: str  # kullanicinin kendi giris sifresi - degisiklik onayi icin zorunlu
    siparis_no: str
    tedarikci_cari_id: int
    kaynak: StokKaynak
    siparis_tarihi: date
    tahmini_teslim_tarihi: date | None = None
    para_birimi: ParaBirimi
    cikis_limani: str | None = None
    varis_limani: str | None = None
    notlar: str | None = None
    urunler: list[SiparisUrunIstegi]


class SiparisDurumGuncelleIstegi(BaseModel):
    durum: SiparisDurum


class SiparisUrunYanit(BaseModel):
    id: int
    stok_karti_id: int
    miktar: int
    birim_fiyat: Decimal
    para_birimi: ParaBirimi
    birim_agirlik_kg: Decimal | None

    class Config:
        from_attributes = True


class SiparisYanit(BaseModel):
    id: int
    siparis_no: str
    tedarikci_cari_id: int
    kaynak: StokKaynak
    siparis_tarihi: date
    tahmini_teslim_tarihi: date | None
    durum: SiparisDurum
    para_birimi: ParaBirimi
    cikis_limani: str | None
    varis_limani: str | None
    notlar: str | None
    urunler: list[SiparisUrunYanit] = []

    class Config:
        from_attributes = True


class StokSatisIstegi(BaseModel):
    musteri_cari_id: int
    satis_fiyati_try: Decimal
    satis_tarihi: date
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None


class TeslimAlinanUrun(BaseModel):
    siparis_detay_id: int
    seri_no: str
    sasi_no: str | None = None
    uretim_yili: int | None = None
    garanti_bitis_tarihi: date | None = None
    barkod: str | None = None


class TeslimAlIstegi(BaseModel):
    urunler: list[TeslimAlinanUrun]
    hedef_durum: StokDurum | None = None  # Belirtilmezse eski otomatik kural kullanilir
    kur: Decimal = Decimal("1")  # Siparis dovizliyse (USD/EUR), birim_fiyat'i TL'ye cevirmek icin


class StokMaliyetKalemiYanit(BaseModel):
    id: int
    tip: str
    aciklama: str | None
    tedarikci_cari_id: int | None
    para_birimi: str
    tutar: Decimal
    kur: Decimal
    tutar_try: Decimal
    belge_no: str | None
    tarih: date

    class Config:
        from_attributes = True


class TopluDurumGuncelleIstegi(BaseModel):
    stok_seri_no_idleri: list[int]
    durum: StokDurum


# --------------------------------------------------------- Sipariş Ödemeleri
class SiparisOdemeOlusturIstegi(BaseModel):
    tarih: date
    tutar: Decimal  # siparisin kendi para biriminde (orn. USD)
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None
    kur: Decimal | None = None  # NAKIT + TRY disi para birimi icin zorunlu
    notlar: str | None = None


class SiparisOdemeYanit(BaseModel):
    id: int
    siparis_id: int
    tarih: date
    tutar: Decimal
    notlar: str | None

    class Config:
        from_attributes = True


class SiparisBakiyeYanit(BaseModel):
    siparis_id: int
    para_birimi: ParaBirimi
    toplam_siparis_tutari: Decimal
    toplam_odenen: Decimal
    kalan_bakiye: Decimal


# ------------------------------------------------------ Gümrük Beyannamesi
class GumrukBeyannamesiOlusturIstegi(BaseModel):
    beyanname_no: str | None = None
    beyanname_tarihi: date
    gumruk_musaviri_cari_id: int | None = None
    tutar: Decimal
    para_birimi: str = "TRY"
    kur: Decimal = Decimal("1")
    notlar: str | None = None


class GumrukBeyannamesiYanit(BaseModel):
    id: int
    siparis_id: int
    beyanname_no: str | None
    beyanname_tarihi: date
    gumruk_musaviri_cari_id: int | None
    gumruk_musaviri_unvan: str | None = None
    tutar: Decimal
    para_birimi: str
    kur: Decimal
    tutar_try: Decimal
    notlar: str | None

    class Config:
        from_attributes = True


# ---------------------------------------------------------- Toplu İçe Aktarma
class StokKartiTopluIceAktarSatiri(BaseModel):
    marka: str | None = None
    model: str | None = None
    birim: str = "ADET"
    mense_ulke: str | None = None
    gtip_kodu: str | None = None


class StokKartiTopluIceAktarIstegi(BaseModel):
    satirlar: list[StokKartiTopluIceAktarSatiri]


class StokKartiTopluIceAktarSonucu(BaseModel):
    basarili_sayisi: int
    hatali_satirlar: list[dict]
