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
