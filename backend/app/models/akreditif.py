"""
Akreditif (Letter of Credit) modulu - SQLAlchemy modelleri.
Bir siparis ve bir banka hesabina baglidir; odeme/komisyon/masraf
kalemleri serbest sekilde tek tek eklenir (sabit taksit plani yok).
"""
import enum
from sqlalchemy import (Column, BigInteger, String, Numeric, Boolean,
                         DateTime, Date, ForeignKey, Text, Enum as SAEnum)
from sqlalchemy.sql import func
from app.db.session import Base
 
 
class AkreditifTip(str, enum.Enum):
    GORULDUGUNDE = "GORULDUGUNDE"
    VADELI = "VADELI"
 
 
class AkreditifDurum(str, enum.Enum):
    ACIK = "ACIK"
    KISMI_ODENDI = "KISMI_ODENDI"
    KAPANDI = "KAPANDI"
    IPTAL = "IPTAL"
 
 
class AkreditifKalemTip(str, enum.Enum):
    ODEME = "ODEME"
    KOMISYON = "KOMISYON"
    MASRAF = "MASRAF"
 
 
class Akreditif(Base):
    __tablename__ = "akreditifler"
 
    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    siparis_id = Column(BigInteger, ForeignKey("siparisler.id"), nullable=False)
    banka_hesap_id = Column(BigInteger, ForeignKey("banka_hesaplari.id"), nullable=False)
    akreditif_no = Column(String(100))
    tip = Column(SAEnum(AkreditifTip, name="akreditif_tip_t"), nullable=False, default=AkreditifTip.VADELI)
    para_birimi = Column(String(10), nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    acilis_tarihi = Column(Date, nullable=False)
    vade_tarihi = Column(Date)
    durum = Column(SAEnum(AkreditifDurum, name="akreditif_durum_t"), default=AkreditifDurum.ACIK)
    notlar = Column(Text)
    olusturma_tarihi = Column(DateTime, server_default=func.now())
 
 
class AkreditifKalemi(Base):
    __tablename__ = "akreditif_kalemleri"
 
    id = Column(BigInteger, primary_key=True)
    akreditif_id = Column(BigInteger, ForeignKey("akreditifler.id"), nullable=False)
    tip = Column(SAEnum(AkreditifKalemTip, name="akreditif_kalem_tip_t"), nullable=False)
    aciklama = Column(String(300))
    tutar = Column(Numeric(18, 2), nullable=False)
    vade_tarihi = Column(Date, nullable=False)
    odendi_mi = Column(Boolean, default=False)
    odeme_tarihi = Column(Date)
 
