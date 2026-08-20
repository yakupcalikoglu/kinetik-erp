"""
Tedarikci/Hizmet Faturalari modulu - Pydantic semalari.
"""
from datetime import date
from decimal import Decimal
from pydantic import BaseModel


class TedarikciFaturaOlusturIstegi(BaseModel):
    tedarikci_cari_id: int
    fatura_no: str | None = None
    tarih: date
    tutar: Decimal
    para_birimi: str = "TRY"
    aciklama: str | None = None
    varsayilan_maliyet_tipi: str = "DIGER"


class TedarikciFaturaGuncelleIstegi(BaseModel):
    sifre: str  # kullanicinin kendi giris sifresi - degisiklik onayi icin zorunlu
    tedarikci_cari_id: int | None = None
    fatura_no: str | None = None
    tarih: date | None = None
    tutar: Decimal | None = None
    para_birimi: str | None = None
    aciklama: str | None = None
    varsayilan_maliyet_tipi: str | None = None


class TedarikciFaturaOdemeIstegi(BaseModel):
    tutar: Decimal  # faturanin kendi para biriminde, bu odemede odenen kisim
    odeme_tarihi: date
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None
    kur: Decimal = Decimal("1")  # fatura TRY disi ise, o gunku kur
    # Dagitim: bu odeme HANGI urune/siparise maliyet olarak yansiyacak.
    dagitim_tipi: str  # "SIPARIS" (tum siparise orantili/esit dagit) | "URUN" (tek urune tamami) | "URUNLER" (secili birkac urune dagit)
    siparis_id: int | None = None  # dagitim_tipi == "SIPARIS" ise zorunlu
    stok_seri_no_id: int | None = None  # dagitim_tipi == "URUN" ise zorunlu
    stok_seri_no_idleri: list[int] | None = None  # dagitim_tipi == "URUNLER" ise zorunlu
    yontem: str = "ORANSAL"  # "ORANSAL" (satinalma maliyetine gore) | "ESIT" - SIPARIS/URUNLER icin kullanilir
    maliyet_tipi: str
    aciklama: str | None = None


class TedarikciFaturaOdemeDuzenleIstegi(BaseModel):
    sifre: str  # kullanicinin kendi giris sifresi - degisiklik onayi icin zorunlu
    tutar: Decimal
    odeme_tarihi: date
    odeme_yontemi: str
    banka_hesap_id: int | None = None
    kur: Decimal = Decimal("1")
    stok_seri_no_idleri: list[int]
    yontem: str = "ORANSAL"
    maliyet_tipi: str
    aciklama: str | None = None


class TedarikciFaturaOdemeYanit(BaseModel):
    id: int
    fatura_id: int
    tutar: Decimal
    odeme_tarihi: date
    odeme_yontemi: str
    banka_hesap_id: int | None = None
    kur: Decimal
    dagitim_tipi: str
    siparis_id: int | None = None
    stok_seri_no_id: int | None = None
    maliyet_tipi: str
    # Router'da _detayli_getir icinde SONRADAN atanan, insan-okunabilir alanlar:
    siparis_no: str | None = None
    seri_no: str | None = None
    # "URUNLER" dagitiminda, bu odemenin GERCEKTEN hangi urun(ler)e
    # dagitildigini (ID olarak) tasir - duzenleme formunun onceden hangi
    # urunlerin secili oldugunu gosterebilmesi icin gereklidir.
    stok_seri_no_idleri: list[int] = []

    class Config:
        from_attributes = True


class TedarikciFaturaYanit(BaseModel):
    id: int
    tedarikci_cari_id: int
    fatura_no: str | None = None
    tarih: date
    tutar: Decimal
    para_birimi: str
    aciklama: str | None = None
    varsayilan_maliyet_tipi: str
    # Router'da _detayli_getir icinde SONRADAN atanan alanlar:
    tedarikci_unvan: str | None = None
    odemeler: list[TedarikciFaturaOdemeYanit] = []
    toplam_odenen: Decimal = Decimal("0")
    kalan_bakiye: Decimal = Decimal("0")

    class Config:
        from_attributes = True
