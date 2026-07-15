"""
Personel, Sabit Gider, Ortak/Dis Borc, Proforma/Fatura modulleri - SQLAlchemy modelleri.
"""
import enum
from sqlalchemy import (Column, BigInteger, String, Numeric, Boolean, Integer,
                         DateTime, Date, ForeignKey, Text, Enum as SAEnum)
from sqlalchemy.sql import func
from app.db.session import Base


class ParaBirimi(str, enum.Enum):
    TRY = "TRY"
    USD = "USD"
    EUR = "EUR"
    ALTIN = "ALTIN"


# ----------------------------------------------------------------- Personel
class Personel(Base):
    __tablename__ = "personel"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    ad_soyad = Column(String(150), nullable=False)
    pozisyon = Column(String(100))
    aylik_maas = Column(Numeric(18, 2))
    ise_baslama_tarihi = Column(Date)
    aktif = Column(Boolean, default=True)


class PersonelOdemeTip(str, enum.Enum):
    MAAS = "MAAS"
    AVANS = "AVANS"
    PRIM = "PRIM"
    SGK = "SGK"
    DIGER = "DIGER"


class PersonelOdeme(Base):
    __tablename__ = "personel_odemeleri"

    id = Column(BigInteger, primary_key=True)
    personel_id = Column(BigInteger, ForeignKey("personel.id"), nullable=False)
    donem = Column(Date, nullable=False)
    tip = Column(SAEnum(PersonelOdemeTip, name="personel_odeme_tip_t"), nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    odendi_mi = Column(Boolean, default=False)
    odeme_tarihi = Column(Date)
    aciklama = Column(String(300))


# ------------------------------------------------------------ Sabit Giderler
class SabitGiderKategori(Base):
    """
    ARTIK KULLANILMIYOR (gecmis uyumlulugu icin tablo/model duruyor).
    Sabit giderler artik serbest metin 'kategori' alanini kullaniyor -
    Harcama Turleri ile ayni otomatik tamamlama listesini paylasiyor,
    boylece iki ayri kategori sistemi yonetmek gerekmiyor.
    """
    __tablename__ = "sabit_gider_kategorileri"

    id = Column(BigInteger, primary_key=True)
    ad = Column(String(100), nullable=False)


class SabitGider(Base):
    __tablename__ = "sabit_giderler"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    kategori_id = Column(BigInteger, ForeignKey("sabit_gider_kategorileri.id"))  # artik kullanilmiyor, gecmis kayitlar icin duruyor
    kategori = Column(String(150))  # serbest metin - Harcama Turleri ile ayni otomatik tamamlama listesi
    donem = Column(Date, nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)  # girildigi orijinal para biriminde
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False, default=ParaBirimi.TRY)
    kur = Column(Numeric(18, 6), nullable=False, default=1)
    tutar_try = Column(Numeric(18, 2), nullable=False)  # tutar * kur - TL karsiligi (odeme/rapor bunu kullanir)
    odendi_mi = Column(Boolean, default=False)
    odeme_tarihi = Column(Date)
    aciklama = Column(String(300))


# ------------------------------------------------------------- Ortak/Dış Borç
class BorcTip(str, enum.Enum):
    ORTAKTAN_ALINAN = "ORTAKTAN_ALINAN"
    DISARIDAN_ALINAN = "DISARIDAN_ALINAN"
    ORTAGA_VERILEN = "ORTAGA_VERILEN"


class Borc(Base):
    __tablename__ = "borclar"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    tip = Column(SAEnum(BorcTip, name="borc_tip_t"), nullable=False)
    cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"), nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    faiz_orani = Column(Numeric(6, 3), default=0)
    alinma_tarihi = Column(Date, nullable=False)
    vade_tarihi = Column(Date)
    notlar = Column(Text)


class BorcOdeme(Base):
    __tablename__ = "borc_odemeleri"

    id = Column(BigInteger, primary_key=True)
    borc_id = Column(BigInteger, ForeignKey("borclar.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    aciklama = Column(String(300))


# ------------------------------------------------------------ Proforma/Fatura
class ProformaFatura(Base):
    __tablename__ = "proforma_faturalar"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    proforma_no = Column(String(50), unique=True, nullable=False)
    cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    gecerlilik_tarihi = Column(Date)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    ara_toplam = Column(Numeric(18, 2), nullable=False)
    kdv_tutari = Column(Numeric(18, 2), default=0)
    genel_toplam = Column(Numeric(18, 2), nullable=False)
    durum = Column(String(20), default="BEKLEMEDE")
    notlar = Column(Text)
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class ProformaDetay(Base):
    __tablename__ = "proforma_detay"

    id = Column(BigInteger, primary_key=True)
    proforma_id = Column(BigInteger, ForeignKey("proforma_faturalar.id"), nullable=False)
    stok_karti_id = Column(BigInteger, ForeignKey("stok_kartlari.id"))
    aciklama = Column(String(300))
    miktar = Column(Numeric(18, 2), nullable=False, default=1)
    birim_fiyat = Column(Numeric(18, 2), nullable=False)
    kdv_orani = Column(Numeric(5, 2), default=20)


class Fatura(Base):
    __tablename__ = "faturalar"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    fatura_no = Column(String(50), unique=True, nullable=False)
    proforma_id = Column(BigInteger, ForeignKey("proforma_faturalar.id"))
    cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    ara_toplam = Column(Numeric(18, 2), nullable=False)
    kdv_tutari = Column(Numeric(18, 2), default=0)
    genel_toplam = Column(Numeric(18, 2), nullable=False)
    odeme_durumu = Column(String(20), default="ODENMEDI")
    notlar = Column(Text)
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class FaturaDetay(Base):
    __tablename__ = "fatura_detay"

    id = Column(BigInteger, primary_key=True)
    fatura_id = Column(BigInteger, ForeignKey("faturalar.id"), nullable=False)
    stok_karti_id = Column(BigInteger, ForeignKey("stok_kartlari.id"))
    stok_seri_no_id = Column(BigInteger, ForeignKey("stok_seri_no.id"))
    aciklama = Column(String(300))
    miktar = Column(Numeric(18, 2), nullable=False, default=1)
    birim_fiyat = Column(Numeric(18, 2), nullable=False)
    kdv_orani = Column(Numeric(5, 2), default=20)
