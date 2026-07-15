"""
Sifre onayi gerektiren duzenleme islemlerinin denetim izi.
Hangi kullanicinin, ne zaman, hangi tablo/kayitta, hangi alanlari
eski/yeni degerleriyle degistirdigini tutar. Yonetici Paneli'nden
goruntulenir.
"""
from sqlalchemy import Column, BigInteger, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base


class DuzenlemeKaydi(Base):
    __tablename__ = "duzenleme_kayitlari"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    kullanici_id = Column(BigInteger, ForeignKey("kullanicilar.id"), nullable=False)
    tablo_adi = Column(String(50), nullable=False)
    kayit_id = Column(BigInteger, nullable=False)
    degisiklikler = Column(Text)  # JSON metni: {"alan": {"eski": ..., "yeni": ...}, ...}
    tarih = Column(DateTime, server_default=func.now())
