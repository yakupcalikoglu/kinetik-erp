"""
Sifre onayi gerektiren duzenleme islemlerinin VE silme/olusturma
islemlerinin denetim izi. Hangi kullanicinin, ne zaman, hangi tablo/
kayitta, ne YAPTIGINI (islem_tipi) ve (duzenlemede) hangi alanlari eski/
yeni degerleriyle degistirdigini tutar. Yonetici Paneli'nden goruntulenir.
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
    # "DUZENLEME" (varsayilan, geriye donuk uyumluluk icin - eski kayitlarda
    # bu alan hep DUZENLEME anlamina gelir), "OLUSTURMA" veya "SILME".
    islem_tipi = Column(String(20), nullable=False, server_default="DUZENLEME")
    degisiklikler = Column(Text)  # JSON metni: {"alan": {"eski": ..., "yeni": ...}, ...} - SILME/OLUSTURMA icin bos/None olabilir
    tarih = Column(DateTime, server_default=func.now())
