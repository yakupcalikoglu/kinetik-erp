from decimal import Decimal
from pydantic import BaseModel
from app.models.cari import ParaBirimi


class CariVirmanIstegi(BaseModel):
    kaynak_cari_id: int
    hedef_cari_id: int
    tutar: Decimal
    para_birimi: ParaBirimi = ParaBirimi.TRY
    aciklama: str | None = None


class CariVirmanYaniti(BaseModel):
    kaynak_hareket_id: int
    hedef_hareket_id: int


class UrunVirmanIstegi(BaseModel):
    stok_seri_no_id: int
    hedef_cari_id: int
    aciklama: str | None = None


class UrunVirmanYaniti(BaseModel):
    stok_seri_no_id: int
    yeni_sahip_cari_id: int

class UrunSahiplikGecmisiYanit(BaseModel):
    id: int
    stok_seri_no_id: int
    seri_no: str | None = None
    eski_cari_id: int | None
    eski_cari_unvan: str | None = None
    yeni_cari_id: int
    yeni_cari_unvan: str | None = None
    aciklama: str | None
    tarih: date

    class Config:
        from_attributes = True


class CariVirmanGecmisiYanit(BaseModel):
    id: int
    kaynak_cari_id: int
    kaynak_cari_unvan: str | None = None
    hedef_cari_id: int
    hedef_cari_unvan: str | None = None
    tutar: Decimal
    para_birimi: str
    aciklama: str | None
    tarih: date
