from datetime import date
from decimal import Decimal
from pydantic import BaseModel
class SeriNoRaporYaniti(BaseModel):
    seri_no: str
    marka: str | None
    model: str | None
    durum: str
    satinalma_maliyeti_try: Decimal
    nakliye_maliyeti_try: Decimal
    gumruk_maliyeti_try: Decimal
    antrepo_maliyeti_try: Decimal
    millilestirme_maliyeti_try: Decimal
    leasing_maliyeti_try: Decimal
    diger_maliyet_try: Decimal
    toplam_maliyet_try: Decimal
    satis_fiyati_try: Decimal | None
    kar_zarar_try: Decimal | None
    bakim_geliri_toplam: Decimal
    bakim_gideri_toplam: Decimal
class HareketTuruSatiri(BaseModel):
    tarih: date
    tur: str
    aciklama: str | None
    tutar: Decimal
    cari_id: int | None = None
class HareketTuruRaporYaniti(BaseModel):
    tur: str
    toplam_tutar: Decimal
    adet: int
    satirlar: list[HareketTuruSatiri]
class AnaKasaOzetYaniti(BaseModel):
    baslangic: date | None
    bitis: date | None
    toplam_giris: Decimal
    toplam_cikis: Decimal
    net_bakiye: Decimal
class GenelBakisYaniti(BaseModel):
    ana_kasa_bakiye_try: Decimal
    banka_toplam_try_karsiligi_not: str
    vadesi_yaklasan_cek_sayisi: int
    vadesi_yaklasan_cek_toplami: Decimal
    geciken_taksit_sayisi: int
    geciken_taksit_toplami: Decimal
    depodaki_urun_sayisi: int
    aktif_kiralama_sayisi: int
class YaklasanVadeSatiri(BaseModel):
    tarih: date
    tur: str  # CEK, LEASING, AKREDITIF, TAKSIT, KIRA
    aciklama: str
    tutar: Decimal
    para_birimi: str
    cari_unvan: str | None = None  # ilgili musteri/tedarikci/kiraci vb.
    kaynak_tablo: str | None = None  # frontend'de "kaynaga git" icin
    kaynak_id: int | None = None
class YaklasanVadelerYaniti(BaseModel):
    odemeler: list[YaklasanVadeSatiri]
    odemeler_toplam: Decimal
    tahsilatlar: list[YaklasanVadeSatiri]
    tahsilatlar_toplam: Decimal
class DepoEnvanterSatiri(BaseModel):
    stok_karti_id: int
    marka: str | None
    model: str | None
    birim: str
    adet: int
    toplam_deger_try: Decimal
class AktifKiralamaSatiri(BaseModel):
    stok_seri_no_id: int
    marka: str | None
    model: str | None
    seri_no: str
    kiraci_unvan: str | None
    aylik_kira_tutari: Decimal
    para_birimi: str
