"""
Banka hesaplari/hareketleri ve Ana Kasa modulu - SQLAlchemy modelleri.
"""
import enum
from sqlalchemy import (Column, BigInteger, String, Numeric, Boolean,
                         DateTime, Date, ForeignKey, Enum as SAEnum)
from sqlalchemy.sql import func
from app.db.session import Base


class ParaBirimi(str, enum.Enum):
    TRY = "TRY"
    USD = "USD"
    EUR = "EUR"
    ALTIN = "ALTIN"


class BankaHareketTip(str, enum.Enum):
    GIRIS = "GIRIS"
    CIKIS = "CIKIS"
    HESAPLAR_ARASI_TRANSFER = "HESAPLAR_ARASI_TRANSFER"
    DOVIZ_ALIM = "DOVIZ_ALIM"
    DOVIZ_SATIM = "DOVIZ_SATIM"


class HareketYon(str, enum.Enum):
    GIRIS = "GIRIS"
    CIKIS = "CIKIS"


class BankaHesabi(Base):
    __tablename__ = "banka_hesaplari"
    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    banka_adi = Column(String(150), nullable=False)
    sube = Column(String(100))
    hesap_adi = Column(String(150))
    iban = Column(String(50))
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    aktif = Column(Boolean, default=True)


class BankaHareketi(Base):
    __tablename__ = "banka_hareketleri"
    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    banka_hesap_id = Column(BigInteger, ForeignKey("banka_hesaplari.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    tip = Column(SAEnum(BankaHareketTip, name="banka_hareket_tip_t"), nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)  # pozitif: giris, negatif: cikis
    aciklama = Column(String(500))
    karsi_hesap_id = Column(BigInteger, ForeignKey("banka_hesaplari.id"))
    kullanilan_kur = Column(Numeric(18, 4))
    kaynak_tablo = Column(String(50))
    kaynak_id = Column(BigInteger)
    cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    olusturan_kullanici_id = Column(BigInteger, ForeignKey("kullanicilar.id"))
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class KasaHareketi(Base):
    """
    Ana Kasa artik coklu para birimi destekler (bankada islemlerin buyuk
    kismi doviz oldugu, virmanlarin da doviz/TL olabildigi icin). `tutar`
    hareketin kendi para biriminde tutulur; `tutar_try_karsiligi` ise o
    gunku kur ile hesaplanmis TL karsiligidir ve raporlarda (Genel Bakis
    net bakiye gibi) TEK bir TL toplami gostermek icin kullanilir.
    """
    __tablename__ = "kasa_hareketleri"
    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    yon = Column(SAEnum(HareketYon, name="hareket_yon_t"), nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False, default=ParaBirimi.TRY)
    tutar = Column(Numeric(18, 2), nullable=False)
    tutar_try_karsiligi = Column(Numeric(18, 2))
    aciklama = Column(String(500))
    kaynak_tablo = Column(String(50))
    kaynak_id = Column(BigInteger)
    olusturan_kullanici_id = Column(BigInteger, ForeignKey("kullanicilar.id"))
    olusturma_tarihi = Column(DateTime, server_default=func.now())
