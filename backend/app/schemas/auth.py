from pydantic import BaseModel, EmailStr
class GirisIstegi(BaseModel):
    email: EmailStr
    sifre: str
class SirketOzet(BaseModel):
    id: int
    unvan: str
    izin_kodlari: list[str] = []
    class Config:
        from_attributes = True
        
class SifremiUnuttumIstegi(BaseModel):
    email: EmailStr
class SifreSifirlaIstegi(BaseModel):
    token: str
    yeni_sifre: str
class SifreDegistirIstegi(BaseModel):
    """Oturum acikken, kullanicinin KENDI sifresini bilerek degistirmesi
    icin - 'sifremi unuttum' (email token'li) akisindan FARKLI: burada
    kullanici mevcut sifreyi zaten biliyor, sadece degistirmek istiyor."""
    mevcut_sifre: str
    yeni_sifre: str
class KullaniciOzet(BaseModel):
    id: int
    ad_soyad: str
    email: EmailStr
    class Config:
        from_attributes = True
class GirisYaniti(BaseModel):
    token: str
    kullanici: KullaniciOzet
    erisebildigi_sirketler: list[SirketOzet]
class SirketDegistirIstegi(BaseModel):
    sirket_id: int
class SirketOlusturIstegi(BaseModel):
    unvan: str
    vergi_dairesi: str | None = None
    vergi_no: str | None = None
    adres: str | None = None
    telefon: str | None = None
    email: EmailStr | None = None
class SirketDetayYanit(BaseModel):
    id: int
    unvan: str
    vergi_dairesi: str | None = None
    vergi_no: str | None = None
    adres: str | None = None
    telefon: str | None = None
    email: EmailStr | None = None
    logo_dosya_yolu: str | None = None
    class Config:
        from_attributes = True
class SirketGuncelleIstegi(BaseModel):
    unvan: str | None = None
    vergi_dairesi: str | None = None
    vergi_no: str | None = None
    adres: str | None = None
    telefon: str | None = None
    email: EmailStr | None = None
class KullaniciOlusturIstegi(BaseModel):
    ad_soyad: str
    email: EmailStr
    sifre: str
    telefon: str | None = None
