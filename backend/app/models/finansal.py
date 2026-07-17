"""
Cek, Leasing, Taksitli Satis, Kiralama, Bakim modulleri - SQLAlchemy modelleri.
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


# --------------------------------------------------------------------- Çek
class CekTip(str, enum.Enum):
    ALINAN = "ALINAN"
    VERILEN = "VERILEN"


class CekDurum(str, enum.Enum):
    PORTFOYDE = "PORTFOYDE"
    CIRO_EDILDI = "CIRO_EDILDI"
    TAHSIL_EDILDI = "TAHSIL_EDILDI"
    ODENDI = "ODENDI"
    KARSILIKSIZ = "KARSILIKSIZ"
    IPTAL = "IPTAL"


class Cek(Base):
    __tablename__ = "cekler"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    tip = Column(SAEnum(CekTip, name="cek_tip_t"), nullable=False)
    cek_no = Column(String(50))
    banka_adi = Column(String(150))
    cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    tutar = Column(Numeric(18, 2), nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), default=ParaBirimi.TRY)
    vade_tarihi = Column(Date, nullable=False)
    alinma_verilme_tarihi = Column(Date, nullable=False)
    durum = Column(SAEnum(CekDurum, name="cek_durum_t"), default=CekDurum.PORTFOYDE)
    ciro_edilen_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    ciro_tarihi = Column(Date)
    notlar = Column(String(500))
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class CekGecmis(Base):
    __tablename__ = "cek_hareket_gecmisi"

    id = Column(BigInteger, primary_key=True)
    cek_id = Column(BigInteger, ForeignKey("cekler.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    eski_durum = Column(SAEnum(CekDurum, name="cek_durum_t"))
    yeni_durum = Column(SAEnum(CekDurum, name="cek_durum_t"))
    aciklama = Column(String(300))
    olusturan_kullanici_id = Column(BigInteger, ForeignKey("kullanicilar.id"))


# ----------------------------------------------------------------- Leasing
class LeasingSozlesme(Base):
    __tablename__ = "leasing_sozlesmeleri"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    leasing_firmasi_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"), nullable=False)
    stok_seri_no_id = Column(BigInteger, ForeignKey("stok_seri_no.id"))
    sozlesme_no = Column(String(100))
    baslangic_tarihi = Column(Date)
    toplam_tutar = Column(Numeric(18, 2))
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    taksit_sayisi = Column(Integer)
    notlar = Column(Text)


class LeasingSozlesmeKalemi(Base):
    """
    Bir leasing sozlesmesine dahil edilen urun tipi + adet + birim fiyat.
    Bir sozlesmede birden fazla urun turu olabilir (orn. 3x forklift A,
    3x forklift B, 2x forklift C - tek sozlesme altinda). Bu tablo, Siparis
    modulundeki SiparisDetay ile ayni mantigi kullanir - stok_karti_id
    (urun TANIMINA, belirli bir seri numarali fiziksel birime degil) baglidir.
    """
    __tablename__ = "leasing_sozlesme_kalemleri"

    id = Column(BigInteger, primary_key=True)
    leasing_id = Column(BigInteger, ForeignKey("leasing_sozlesmeleri.id"), nullable=False)
    stok_karti_id = Column(BigInteger, ForeignKey("stok_kartlari.id"), nullable=False)
    miktar = Column(Integer, nullable=False, default=1)
    birim_fiyat = Column(Numeric(18, 2), nullable=False)


class LeasingKalemUrunu(Base):
    """Bir leasing kalemine (urun turune) baglanan SPESIFIK seri numarali fiziksel birim(ler)."""
    __tablename__ = "leasing_kalem_urunleri"

    id = Column(BigInteger, primary_key=True)
    kalem_id = Column(BigInteger, ForeignKey("leasing_sozlesme_kalemleri.id"), nullable=False)
    stok_seri_no_id = Column(BigInteger, ForeignKey("stok_seri_no.id"), nullable=False)


class LeasingOdeme(Base):
    __tablename__ = "leasing_odeme_plani"

    id = Column(BigInteger, primary_key=True)
    leasing_id = Column(BigInteger, ForeignKey("leasing_sozlesmeleri.id"), nullable=False)
    taksit_no = Column(Integer, nullable=False)
    vade_tarihi = Column(Date, nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    odendi_mi = Column(Boolean, default=False)
    odeme_tarihi = Column(Date)
    banka_hareket_id = Column(BigInteger, ForeignKey("banka_hareketleri.id"))


# ------------------------------------------------------------ Taksitli Satış
class TaksitliSatisPlani(Base):
    __tablename__ = "taksitli_satis_planlari"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    musteri_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"), nullable=False)
    stok_seri_no_id = Column(BigInteger, ForeignKey("stok_seri_no.id"))
    toplam_tutar = Column(Numeric(18, 2), nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    pesinat = Column(Numeric(18, 2), default=0)
    taksit_sayisi = Column(Integer, nullable=False)
    baslangic_tarihi = Column(Date, nullable=False)
    notlar = Column(Text)


class TaksitliSatisKalemi(Base):
    """Bir taksitli satis planina dahil urun tipi + adet + birim fiyat (Leasing ile ayni mantik)."""
    __tablename__ = "taksitli_satis_kalemleri"

    id = Column(BigInteger, primary_key=True)
    plan_id = Column(BigInteger, ForeignKey("taksitli_satis_planlari.id"), nullable=False)
    stok_karti_id = Column(BigInteger, ForeignKey("stok_kartlari.id"), nullable=False)
    miktar = Column(Integer, nullable=False, default=1)
    birim_fiyat = Column(Numeric(18, 2), nullable=False)


class TaksitDetay(Base):
    __tablename__ = "taksit_detay"

    id = Column(BigInteger, primary_key=True)
    plan_id = Column(BigInteger, ForeignKey("taksitli_satis_planlari.id"), nullable=False)
    taksit_no = Column(Integer, nullable=False)
    vade_tarihi = Column(Date, nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    odenen_tutar = Column(Numeric(18, 2), nullable=False, default=0)
    odendi_mi = Column(Boolean, default=False)
    odeme_tarihi = Column(Date)
    tahsilat_kaynak_tablo = Column(String(50))
    tahsilat_kaynak_id = Column(BigInteger)
    # Bir odeme, secilen taksidin kalan bakiyesinden FAZLA ise, fazlalik
    # sonraki odenmemis taksit(ler)e otomatik uygulanir. Bu durumda o
    # taksitlerde ilk_taksit_id, ODEMENIN ASIL YAPILDIGI (Kasa/Banka
    # hareketinin kaynak_id'sinin isaret ettigi) taksidin ID'sini tutar -
    # boylece "geri al" istendiginde ayni odemeyle etkilenen TUM taksitler
    # dogru sekilde birlikte geri alinabilir.
    ilk_taksit_id = Column(BigInteger, ForeignKey("taksit_detay.id"))


# --------------------------------------------------------------- Kiralama
class KiralamaSozlesme(Base):
    __tablename__ = "kiralama_sozlesmeleri"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    stok_seri_no_id = Column(BigInteger, ForeignKey("stok_seri_no.id"), nullable=False)
    kiraci_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"), nullable=False)
    baslangic_tarihi = Column(Date, nullable=False)
    bitis_tarihi = Column(Date)
    aylik_kira_tutari = Column(Numeric(18, 2), nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    depozito = Column(Numeric(18, 2), default=0)
    durum = Column(String(20), default="AKTIF")
    notlar = Column(Text)


class KiralamaSozlesmeKalemi(Base):
    """Bir kiralama sozlesmesine dahil urun tipi + adet + aylik birim fiyat (Leasing ile ayni mantik)."""
    __tablename__ = "kiralama_sozlesme_kalemleri"

    id = Column(BigInteger, primary_key=True)
    sozlesme_id = Column(BigInteger, ForeignKey("kiralama_sozlesmeleri.id"), nullable=False)
    stok_karti_id = Column(BigInteger, ForeignKey("stok_kartlari.id"), nullable=False)
    miktar = Column(Integer, nullable=False, default=1)
    birim_fiyat = Column(Numeric(18, 2), nullable=False)


class KiralamaKalemUrunu(Base):
    """Bir kiralama kalemine (urun turune) baglanan SPESIFIK seri numarali fiziksel birim(ler)."""
    __tablename__ = "kiralama_kalem_urunleri"

    id = Column(BigInteger, primary_key=True)
    kalem_id = Column(BigInteger, ForeignKey("kiralama_sozlesme_kalemleri.id"), nullable=False)
    stok_seri_no_id = Column(BigInteger, ForeignKey("stok_seri_no.id"), nullable=False)


class KiralamaOdeme(Base):
    __tablename__ = "kiralama_odemeleri"

    id = Column(BigInteger, primary_key=True)
    sozlesme_id = Column(BigInteger, ForeignKey("kiralama_sozlesmeleri.id"), nullable=False)
    donem_basi = Column(Date, nullable=False)
    donem_sonu = Column(Date, nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    odendi_mi = Column(Boolean, default=False)
    odeme_tarihi = Column(Date)
    tahsilat_kaynak_tablo = Column(String(50))
    tahsilat_kaynak_id = Column(BigInteger)


# ------------------------------------------------------------------- Bakım
class BakimTip(str, enum.Enum):
    GELIR = "GELIR"
    GIDER = "GIDER"


class BakimKaydi(Base):
    __tablename__ = "bakim_kayitlari"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    stok_seri_no_id = Column(BigInteger, ForeignKey("stok_seri_no.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    tip = Column(SAEnum(BakimTip, name="bakim_tip_t"), nullable=False)
    aciklama = Column(String(500))
    ilgili_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    tutar = Column(Numeric(18, 2), nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), default=ParaBirimi.TRY)
    odendi_tahsil_edildi_mi = Column(Boolean, default=False)
