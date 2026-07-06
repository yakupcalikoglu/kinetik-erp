"""Virman modulu - urun sahiplik/zimmet devri gecmisi."""
from sqlalchemy import Column, BigInteger, String, Date, DateTime, Text
from sqlalchemy.sql import func
from app.db.session import Base


class UrunSahiplikGecmisi(Base):
    __tablename__ = "urun_sahiplik_gecmisi"
    id = Column(BigInteger, primary_key=True)
    stok_seri_no_id = Column(BigInteger, nullable=False)
    eski_cari_id = Column(BigInteger, nullable=True)
    yeni_cari_id = Column(BigInteger, nullable=False)
    aciklama = Column(Text)
    tarih = Column(Date, nullable=False)
    olusturma_tarihi = Column(DateTime, server_default=func.now())
