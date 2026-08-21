from datetime import datetime
from pydantic import BaseModel


class BelgeYanit(BaseModel):
    id: int
    kaynak_tablo: str
    kaynak_id: int
    klasor_adi: str | None = None
    dosya_adi: str
    content_type: str | None = None
    boyut_bayt: int | None = None
    yukleyen_ad: str | None = None
    yukleme_tarihi: datetime

    class Config:
        from_attributes = True
