from datetime import date
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
 
