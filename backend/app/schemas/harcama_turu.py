from pydantic import BaseModel


class HarcamaTuruOlusturIstegi(BaseModel):
    ad: str


class HarcamaTuruYanit(BaseModel):
    id: int
    ad: str
    aktif: bool

    class Config:
        from_attributes = True
