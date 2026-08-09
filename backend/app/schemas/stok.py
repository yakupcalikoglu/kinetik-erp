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
    standart_alt_metin: str | None = None


class StokKartiYanit(BaseModel):
    id: int
    kategori_id: int | None
    marka: str | None
    model: str | None
    birim: str
    birim_agirlik_kg: Decimal | None
    mense_ulke: str | None
    gtip_kodu: str | None
    standart_alt_metin: str | None = None

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
    sigorta_maliyeti_try: Decimal = Decimal("0")
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
    sahiplik_tipi: str = "TICARI"
    satis_odeme_tipi: str | None = None
    satis_yontemi: str | None = None
    # Satis-sonrasi maliyet kalemleri (ITHALAT maliyetlerinden BAGIMSIZ -
    # toplam_maliyet_try'ye DAHIL DEGIL, ayrica toplam_satis_maliyeti_try
    # ile gosterilir):
    ardiye_maliyeti_try: Decimal = Decimal("0")
    ilave_gumruk_vergisi_try: Decimal = Decimal("0")
    damga_vergisi_try: Decimal = Decimal("0")
    tse_ucreti_try: Decimal = Decimal("0")
    gumrukcu_masrafi_try: Decimal = Decimal("0")
    banka_masrafi_try: Decimal = Decimal("0")
    kdv_try: Decimal = Decimal("0")

    class Config:
        from_attributes = True

    @computed_field
    def toplam_maliyet_try(self) -> Decimal:
        return (self.satinalma_maliyeti_try + self.nakliye_maliyeti_try +
                self.sigorta_maliyeti_try + self.gumruk_maliyeti_try + self.antrepo_maliyeti_try +
                self.millilestirme_maliyeti_try + self.leasing_maliyeti_try +
                self.diger_maliyet_try)

    @computed_field
    def toplam_satis_maliyeti_try(self) -> Decimal:
        return (self.ardiye_maliyeti_try + self.ilave_gumruk_vergisi_try +
                self.damga_vergisi_try + self.tse_ucreti_try +
                self.gumrukcu_masrafi_try + self.banka_masrafi_try + self.kdv_try)


# ------------------------------------------------------- Öz Mal / Demirbaş
class OzMalIlkKayitIstegi(BaseModel):
    """
    Gecmiste alinmis, siparis kaydi olmadan dogrudan envantere eklenecek
    'Oz Mal' urunler icin. Kasa/Banka hareketi OLUSTURMAZ (para zaten
    gecmiste harcanmis kabul edilir) - sadece maliyeti kayit altina alir ki
    ileride satildiginda/hurdaya cikarildiginda kar/zarar hesaplanabilsin.
    """
    stok_karti_id: int
    seri_no: str
    sasi_no: str | None = None
    uretim_yili: int | None = None
    durum: StokDurum = StokDurum.DEPODA
    maliyet_orijinal: Decimal  # girilen tutar, kendi para biriminde
    para_birimi: str = "TRY"
    kur: Decimal = Decimal("1")
    aciklama: str | None = None


class HurdayaCikarIstegi(BaseModel):
    """
    Bir urunu hurdaya cikarir. hurda_bedeli_try > 0 ise (orn. hurda demir
    karsiligi bir miktar nakit alindiysa) bu tutar Kasa/Banka'ya GIRIS
    olarak islenir; toplam maliyet ile hurda bedeli arasindaki fark
    otomatik olarak zarar (kar_zarar_try negatif) olarak hesaplanir -
    normal satis akisindaki ayni kar/zarar mantigi kullanilir.
    """
    hurda_bedeli_try: Decimal = Decimal("0")
    odeme_yontemi: str | None = None  # "NAKIT" | "BANKA" - hurda_bedeli_try > 0 ise zorunlu
    banka_hesap_id: int | None = None
    aciklama: str | None = None


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
    satis_odeme_tipi: str | None = None  # "LEASINGLI" | "FATURALI"
    satis_yontemi: str | None = None  # "PESIN_NAKIT" | "PESIN_HAVALE" | "PESIN_KART" | "TAKSITLI" | "LEASINGLI" | "CEK"


class MaliyetKalemiEkleIstegi(BaseModel):
    tip: MaliyetTip
    aciklama: str | None = None
    tedarikci_cari_id: int | None = None
    para_birimi: ParaBirimi
    tutar: Decimal
    kur: Decimal = Decimal("1")
    belge_no: str | None = None
    tarih: date
    # TL cinsinden girilen kalemler icin (Nakliye/Gumruk/Antrepo vb. genelde
    # TL odenir) - odemenin yapildigi GUNKU USD kurunu saklamak icin.
    # Boylece bu TL tutarin USD karsiligi, ileride CANLI kurla yeniden
    # hesaplanan bir TAHMIN degil, o gunku GERCEK kurla hesaplanmis olur.
    referans_usd_kuru: Decimal | None = None


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
    referans_usd_kuru: Decimal | None = None


class UrunOzetDurumSatiri(BaseModel):
    durum: str
    adet: int


class UrunOzetSatisSatiri(BaseModel):
    seri_no: str
    satis_tarihi: date | None
    musteri_unvan: str | None = None
    satis_fiyati_try: Decimal | None
    toplam_maliyet_try: Decimal
    kar_zarar_try: Decimal | None


class UrunOzetYaniti(BaseModel):
    marka: str | None
    model: str | None
    toplam_adet: int
    durum_dagilimi: list[UrunOzetDurumSatiri]
    satislar: list[UrunOzetSatisSatiri]
    toplam_satis_adedi: int
    toplam_kar_zarar_try: Decimal
    ortalama_kar_marji_yuzde: Decimal | None
    bakim_geliri_toplam: Decimal
    bakim_gideri_toplam: Decimal


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
    kdv_orani: Decimal = Decimal("20")
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
    kdv_orani: Decimal = Decimal("20")

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
    satis_fiyati_try: Decimal  # HER ZAMAN TL karsiligi - raporlama/kar-zarar bu alani kullanir
    satis_tarihi: date
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None
    satis_odeme_tipi: str | None = None  # "LEASINGLI" | "FATURALI"
    satis_yontemi: str | None = None  # "PESIN_NAKIT" | "PESIN_HAVALE" | "PESIN_KART" | "TAKSITLI" | "LEASINGLI" | "CEK"
    # ASAGIDAKI 3 ALAN, odeme BANKA ile VE hesap doviz cinsindense onemlidir:
    # banka hesabina GERCEK ISLEM para biriminde/tutarinda yazmak icin
    # kullanilir - VERILMEZSE (eski davranis) TL varsayilir, bu da hesap
    # dovizliyse HATALI kaydin (TL tutarinin dogrudan doviz sanilmasi)
    # onune GECMEZ. Bu yuzden BANKA + dovizli hesap segiliyse frontend
    # BUNLARI DOLDURMALIDIR.
    islem_para_birimi: str = "TRY"
    islem_tutari: Decimal | None = None  # None ise satis_fiyati_try (TL) kullanilir
    kur: Decimal = Decimal("1")


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
    referans_usd_kuru: Decimal | None = None

    class Config:
        from_attributes = True


class TopluDurumGuncelleIstegi(BaseModel):
    stok_seri_no_idleri: list[int]
    durum: StokDurum


# --------------------------------------------------------- Sipariş Ödemeleri
class SiparisOdemeOlusturIstegi(BaseModel):
    tarih: date
    tutar: Decimal  # siparisin kendi para biriminde (orn. USD)
    odeme_yontemi: str  # "NAKIT" | "BANKA" | "CEK" | "LEASING"
    banka_hesap_id: int | None = None
    kur: Decimal | None = None  # NAKIT + TRY disi para birimi icin zorunlu
    # odeme_yontemi == "CEK" ise:
    cek_no: str | None = None
    cek_banka_adi: str | None = None
    cek_vade_tarihi: date | None = None
    notlar: str | None = None


class SiparisOdemeYanit(BaseModel):
    id: int
    siparis_id: int
    tarih: date
    tutar: Decimal
    odeme_yontemi: str | None = None
    notlar: str | None
    asim_uyarisi: str | None = None  # eger bu odeme toplam siparis tutarini asarsa doldurulur

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
    kdv_tutari: Decimal = Decimal("0")  # tutar_try icindeki KDV kismi - KDV Ozeti raporuna otomatik yansir
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
    kdv_tutari: Decimal = Decimal("0")
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


class StokSeriNoIceAktarSatiri(BaseModel):
    seri_no: str
    marka: str
    model: str
    sasi_no: str | None = None
    uretim_yili: int | None = None
    satinalma_maliyeti_try: Decimal = Decimal("0")
    sahiplik_tipi: str = "TICARI"  # "TICARI" | "OZ_MAL"


class StokSeriNoIceAktarIstegi(BaseModel):
    satirlar: list[StokSeriNoIceAktarSatiri]


class StokSeriNoIceAktarSonucu(BaseModel):
    basarili_sayisi: int
    hatali_satirlar: list[dict]


class SonAlimFiyatiYaniti(BaseModel):
    bulundu: bool
    toplam_maliyet_try: Decimal | None = None
    tarih: date | None = None
    seri_no: str | None = None
