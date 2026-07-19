"""
Yedek parca / sarf malzeme stogu - forklift gibi seri numarali ana urunlerin
YANI SIRA, seri no'suz, adet/miktar bazinda takip edilen kucuk parcalar
(lastik, aku, hidrolik yag vb.) icin ayri ve basit bir stok sistemi.
"""
import enum
from sqlalchemy import Column, BigInteger, String, Numeric, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.sql import func
from app.db.session import Base


class YedekParcaHareketYon(str, enum.Enum):
    GIRIS = "GIRIS"
    CIKIS = "CIKIS"


class YedekParca(Base):
    __tablename__ = "yedek_parcalar"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    ad = Column(String(200), nullable=False)
    birim = Column(String(20), nullable=False, default="ADET")
    mevcut_miktar = Column(Numeric(18, 2), nullable=False, default=0)
    birim_fiyat_try = Column(Numeric(18, 2), nullable=False, default=0)
    min_stok_seviyesi = Column(Numeric(18, 2), default=0)
    notlar = Column(String(500))
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class YedekParcaHareketi(Base):
    """Giris (satinalma) veya cikis (kullanim/satis) hareketi. mevcut_miktar bu hareketlerle senkron tutulur."""
    __tablename__ = "yedek_parca_hareketleri"

    id = Column(BigInteger, primary_key=True)
    yedek_parca_id = Column(BigInteger, ForeignKey("yedek_parcalar.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    yon = Column(SAEnum(YedekParcaHareketYon, name="yedek_parca_hareket_yon_t"), nullable=False)
    miktar = Column(Numeric(18, 2), nullable=False)
    birim_fiyat_try = Column(Numeric(18, 2))
    ilgili_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    aciklama = Column(String(300))
    olusturma_tarihi = Column(DateTime, server_default=func.now())
