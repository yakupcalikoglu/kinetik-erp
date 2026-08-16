"""
Cari hesap modulu - SQLAlchemy modelleri.
"""
from sqlalchemy import (Column, BigInteger, String, Numeric, Boolean,
                         DateTime, Date, ForeignKey, Text, Enum as SAEnum)
from sqlalchemy.sql import func
import enum
from app.db.session import Base
from app.db.soft_delete import SoftDeleteMixin
class CariTip(str, enum.Enum):
    MUSTERI = "MUSTERI"
    TEDARIKCI = "TEDARIKCI"
    PERSONEL = "PERSONEL"
    ORTAK = "ORTAK"
    DIGER = "DIGER"
class ParaBirimi(str, enum.Enum):
    TRY = "TRY"
    USD = "USD"
    EUR = "EUR"
    ALTIN = "ALTIN"
class HareketYon(str, enum.Enum):
    GIRIS = "GIRIS"
    CIKIS = "CIKIS"
class CariHesap(Base, SoftDeleteMixin):
    __tablename__ = "cari_hesaplar"
    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    tip = Column(SAEnum(CariTip, name="cari_tip_t"), nullable=False)
    unvan = Column(String(255), nullable=False)
    vergi_no = Column(String(20))
    vergi_dairesi = Column(String(100))
    adres = Column(Text)
    telefon = Column(String(50))
    email = Column(String(100))
    otomatik_dolduruldu = Column(Boolean, default=False)
    bakiye_try = Column(Numeric(18, 2), default=0)
    bakiye_usd = Column(Numeric(18, 2), default=0)
    bakiye_eur = Column(Numeric(18, 2), default=0)
    aktif = Column(Boolean, default=True)
    olusturma_tarihi = Column(DateTime, server_default=func.now())
class CariHareket(Base):
    __tablename__ = "cari_hareketler"
    id = Column(BigInteger, primary_key=True)
    cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"), nullable=False)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    aciklama = Column(String(500))
    yon = Column(SAEnum(HareketYon, name="hareket_yon_t"), nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    tutar_try_karsiligi = Column(Numeric(18, 2))
    kaynak_tablo = Column(String(50))
    kaynak_id = Column(BigInteger)
    olusturan_kullanici_id = Column(BigInteger, ForeignKey("kullanicilar.id"))
    olusturma_tarihi = Column(DateTime, server_default=func.now())
