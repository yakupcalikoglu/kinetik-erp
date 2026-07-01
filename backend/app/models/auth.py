"""
Auth/Yetki modulu - SQLAlchemy modelleri.
veritabani_semasi.sql dosyasindaki ilgili tablolarla birebir eslesir.
"""
from sqlalchemy import (Column, BigInteger, String, Boolean, DateTime,
                         ForeignKey, Table, Text)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class Sirket(Base):
    __tablename__ = "sirketler"
    id = Column(BigInteger, primary_key=True)
    unvan = Column(String(255), nullable=False)
    vergi_dairesi = Column(String(100))
    vergi_no = Column(String(20))
    adres = Column(Text)
    telefon = Column(String(50))
    email = Column(String(100))
    logo_dosya_yolu = Column(String(500))
    aktif = Column(Boolean, default=True)
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class Kullanici(Base):
    __tablename__ = "kullanicilar"
    id = Column(BigInteger, primary_key=True)
    ad_soyad = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    sifre_hash = Column(String(255), nullable=False)
    telefon = Column(String(50))
    aktif = Column(Boolean, default=True)
    son_giris = Column(DateTime)
    olusturma_tarihi = Column(DateTime, server_default=func.now())
    sifre_sifirlama_token = Column(String(255), nullable=True)
    sifre_sifirlama_son_gecerlilik = Column(DateTime, nullable=True)
    sirket_erisimleri = relationship("KullaniciSirketErisim", back_populates="kullanici")


class KullaniciSirketErisim(Base):
    __tablename__ = "kullanici_sirket_erisim"
    id = Column(BigInteger, primary_key=True)
    kullanici_id = Column(BigInteger, ForeignKey("kullanicilar.id"), nullable=False)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    kullanici = relationship("Kullanici", back_populates="sirket_erisimleri")
    sirket = relationship("Sirket")


class Rol(Base):
    __tablename__ = "roller"
    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=True)
    ad = Column(String(100), nullable=False)
    aciklama = Column(String(255))


class Izin(Base):
    __tablename__ = "izinler"
    id = Column(BigInteger, primary_key=True)
    kod = Column(String(100), unique=True, nullable=False)
    modul = Column(String(100), nullable=False)
    aciklama = Column(String(255))


rol_izinleri = Table(
    "rol_izinleri", Base.metadata,
    Column("rol_id", BigInteger, ForeignKey("roller.id"), primary_key=True),
    Column("izin_id", BigInteger, ForeignKey("izinler.id"), primary_key=True),
)


class KullaniciRolu(Base):
    __tablename__ = "kullanici_rolleri"
    kullanici_id = Column(BigInteger, ForeignKey("kullanicilar.id"), primary_key=True)
    rol_id = Column(BigInteger, ForeignKey("roller.id"), primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), primary_key=True)
