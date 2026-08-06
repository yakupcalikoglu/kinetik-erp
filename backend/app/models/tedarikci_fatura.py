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
    fatura_no: str | None = None
    tarih: date | None = None
    tutar: Decimal | None = None
    para_birimi: str | None = None
    aciklama: str | None = None
    varsayilan_maliyet_tipi: str | None = None
    sifre: str  # duzenleme onayi icin zorunlu


class TedarikciFaturaOdemeIstegi(BaseModel):
    tutar: Decimal  # bu odemede fiilen odenen tutar (faturanin kendi para biriminde) - kismi odeme desteklenir
    odeme_tarihi: date
    odeme_yontemi: str  # "NAKIT" | "BANKA"
    banka_hesap_id: int | None = None
    kur: Decimal = Decimal("1")  # fatura para birimi TRY degilse zorunlu (o gunku kur)
    dagitim_tipi: str  # "SIPARIS" (orantili dagit) | "URUN" (tek urune tamami)
    siparis_id: int | None = None
    stok_seri_no_id: int | None = None
    maliyet_tipi: str  # MaliyetTip enum degeri (SATINALMA/NAKLIYE/GUMRUK/ANTREPO/MILLILESTIRME/LEASING/DIGER)
    aciklama: str | None = None  # StokMaliyetKalemi'ne eklenirken kullanilacak not (orn. "TSE ücreti")


class TedarikciFaturaOdemeYanit(BaseModel):
    id: int
    fatura_id: int
    tutar: Decimal
    odeme_tarihi: date
    odeme_yontemi: str
    banka_hesap_id: int | None
    kur: Decimal
    dagitim_tipi: str
    siparis_id: int | None
    siparis_no: str | None = None      # backend'de doldurulur
    stok_seri_no_id: int | None
    seri_no: str | None = None         # backend'de doldurulur
    maliyet_tipi: str

    class Config:
        from_attributes = True


class TedarikciFaturaYanit(BaseModel):
    id: int
    tedarikci_cari_id: int
    tedarikci_unvan: str | None = None
    fatura_no: str | None
    tarih: date
    tutar: Decimal
    para_birimi: str
    aciklama: str | None
    varsayilan_maliyet_tipi: str
    toplam_odenen: Decimal = Decimal("0")  # backend'de hesaplanir
    kalan_bakiye: Decimal = Decimal("0")   # backend'de hesaplanir
    odemeler: list[TedarikciFaturaOdemeYanit] = []

    class Config:
        from_attributes = True
