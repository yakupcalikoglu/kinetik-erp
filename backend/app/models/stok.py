"""
Stok (seri no bazli) ve Siparis modulu - SQLAlchemy modelleri.
"""
import enum
from sqlalchemy import (Column, BigInteger, String, Numeric, Boolean, Integer,
                         DateTime, Date, ForeignKey, Text, Enum as SAEnum)
from sqlalchemy.sql import func
from app.db.session import Base
from app.db.soft_delete import SoftDeleteMixin


class StokKaynak(str, enum.Enum):
    ITHALAT = "ITHALAT"
    YURTICI_ALIM = "YURTICI_ALIM"


class StokDurum(str, enum.Enum):
    DEPODA = "DEPODA"
    SIPARISTE = "SIPARISTE"
    YOLDA = "YOLDA"
    GUMRUKTE = "GUMRUKTE"
    ANTREPODA = "ANTREPODA"
    SATILDI = "SATILDI"
    KIRADA = "KIRADA"
    BAKIMDA = "BAKIMDA"
    HURDA = "HURDA"


class MaliyetTip(str, enum.Enum):
    SATINALMA = "SATINALMA"
    NAKLIYE = "NAKLIYE"
    SIGORTA = "SIGORTA"
    GUMRUK = "GUMRUK"
    ANTREPO = "ANTREPO"
    MILLILESTIRME = "MILLILESTIRME"
    ARDIYE = "ARDIYE"
    ILAVE_GUMRUK_VERGISI = "ILAVE_GUMRUK_VERGISI"
    DAMGA_VERGISI = "DAMGA_VERGISI"
    TSE_UCRETI = "TSE_UCRETI"
    GUMRUKCU_MASRAFI = "GUMRUKCU_MASRAFI"
    BANKA_MASRAFI = "BANKA_MASRAFI"
    KDV = "KDV"
    LEASING = "LEASING"
    DIGER = "DIGER"


class SiparisDurum(str, enum.Enum):
    TASLAK = "TASLAK"
    ONAYLANDI = "ONAYLANDI"
    YOLDA = "YOLDA"
    GUMRUKTE = "GUMRUKTE"
    TESLIM_ALINDI = "TESLIM_ALINDI"
    TAMAMLANDI = "TAMAMLANDI"
    IPTAL = "IPTAL"


class ParaBirimi(str, enum.Enum):
    TRY = "TRY"
    USD = "USD"
    EUR = "EUR"
    ALTIN = "ALTIN"


class StokKategori(Base):
    __tablename__ = "stok_kategorileri"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    ad = Column(String(150), nullable=False)


class StokKarti(Base, SoftDeleteMixin):
    __tablename__ = "stok_kartlari"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    kategori_id = Column(BigInteger, ForeignKey("stok_kategorileri.id"))
    marka = Column(String(100))
    model = Column(String(150))
    aciklama = Column(Text)
    birim = Column(String(20), default="ADET")
    birim_agirlik_kg = Column(Numeric(10, 2))
    mense_ulke = Column(String(100))
    gtip_kodu = Column(String(20))
    standart_alt_metin = Column(Text)
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class StokSeriNo(Base, SoftDeleteMixin):
    __tablename__ = "stok_seri_no"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    stok_karti_id = Column(BigInteger, ForeignKey("stok_kartlari.id"), nullable=False)
    seri_no = Column(String(100), unique=True, nullable=False)
    sasi_no = Column(String(100))
    uretim_yili = Column(Integer)
    kaynak = Column(SAEnum(StokKaynak, name="stok_kaynak_t"), nullable=False)
    siparis_id = Column(BigInteger, ForeignKey("siparisler.id"))
    durum = Column(SAEnum(StokDurum, name="stok_durum_t"), nullable=False, default=StokDurum.SIPARISTE)
    tedarikci_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    sahiplik_tipi = Column(String(20), nullable=False, default="TICARI")

    satinalma_maliyeti_try = Column(Numeric(18, 2), default=0)
    nakliye_maliyeti_try = Column(Numeric(18, 2), default=0)
    sigorta_maliyeti_try = Column(Numeric(18, 2), default=0)
    gumruk_maliyeti_try = Column(Numeric(18, 2), default=0)
    antrepo_maliyeti_try = Column(Numeric(18, 2), default=0)
    millilestirme_maliyeti_try = Column(Numeric(18, 2), default=0)
    leasing_maliyeti_try = Column(Numeric(18, 2), default=0)
    diger_maliyet_try = Column(Numeric(18, 2), default=0)
    ardiye_maliyeti_try = Column(Numeric(18, 2), default=0)
    ilave_gumruk_vergisi_try = Column(Numeric(18, 2), default=0)
    damga_vergisi_try = Column(Numeric(18, 2), default=0)
    tse_ucreti_try = Column(Numeric(18, 2), default=0)
    gumrukcu_masrafi_try = Column(Numeric(18, 2), default=0)
    banka_masrafi_try = Column(Numeric(18, 2), default=0)
    kdv_try = Column(Numeric(18, 2), default=0)

    satis_fiyati_try = Column(Numeric(18, 2))
    satis_tarihi = Column(Date)
    satis_kayit_zamani = Column(DateTime)
    musteri_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    satis_odeme_tipi = Column(String(20))
    satis_yontemi = Column(String(20))
    satis_cek_id = Column(BigInteger, ForeignKey("cekler.id"))

    giris_tarihi = Column(Date)
    garanti_bitis_tarihi = Column(Date)
    barkod = Column(String(100))
    # Periyodik bakim hatirlatmasi icin - HER kac GUNDE bir bakim
    # yapilmasi gerektigini belirtir (orn. 90). Bos birakilirsa, bu urun
    # icin hicbir bakim hatirlatmasi olusturulmaz. Referans tarih olarak
    # en son BakimKaydi.tarih (yoksa giris_tarihi) kullanilir - bkz.
    # raporlar/bakim-hatirlaticilari endpoint'i.
    bakim_periyodu_gun = Column(Integer, nullable=True)
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class StokMaliyetKalemi(Base):
    __tablename__ = "stok_maliyet_kalemleri"

    id = Column(BigInteger, primary_key=True)
    stok_seri_no_id = Column(BigInteger, ForeignKey("stok_seri_no.id"), nullable=False)
    tip = Column(SAEnum(MaliyetTip, name="maliyet_tip_t"), nullable=False)
    aciklama = Column(String(300))
    tedarikci_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    kur = Column(Numeric(18, 4), default=1)
    tutar_try = Column(Numeric(18, 2), nullable=False)
    belge_no = Column(String(100))
    tarih = Column(Date, nullable=False)
    odendi_mi = Column(Boolean, default=False)
    referans_usd_kuru = Column(Numeric(18, 6))
    tedarikci_fatura_odeme_id = Column(BigInteger, ForeignKey("tedarikci_fatura_odemeleri.id"))


MALIYET_TIP_SUTUN_ESLEME = {
    MaliyetTip.SATINALMA: "satinalma_maliyeti_try",
    MaliyetTip.NAKLIYE: "nakliye_maliyeti_try",
    MaliyetTip.SIGORTA: "sigorta_maliyeti_try",
    MaliyetTip.GUMRUK: "gumruk_maliyeti_try",
    MaliyetTip.ANTREPO: "antrepo_maliyeti_try",
    MaliyetTip.MILLILESTIRME: "millilestirme_maliyeti_try",
    MaliyetTip.ARDIYE: "ardiye_maliyeti_try",
    MaliyetTip.ILAVE_GUMRUK_VERGISI: "ilave_gumruk_vergisi_try",
    MaliyetTip.DAMGA_VERGISI: "damga_vergisi_try",
    MaliyetTip.TSE_UCRETI: "tse_ucreti_try",
    MaliyetTip.GUMRUKCU_MASRAFI: "gumrukcu_masrafi_try",
    MaliyetTip.BANKA_MASRAFI: "banka_masrafi_try",
    MaliyetTip.KDV: "kdv_try",
    MaliyetTip.LEASING: "leasing_maliyeti_try",
    MaliyetTip.DIGER: "diger_maliyet_try",
}

LEASING_SATIS_MALIYET_TIPLERI = [
    MaliyetTip.ARDIYE, MaliyetTip.GUMRUK, MaliyetTip.ILAVE_GUMRUK_VERGISI,
    MaliyetTip.DAMGA_VERGISI, MaliyetTip.TSE_UCRETI, MaliyetTip.LEASING,
    MaliyetTip.BANKA_MASRAFI, MaliyetTip.DIGER,
]
FATURALI_SATIS_MALIYET_TIPLERI = [
    MaliyetTip.GUMRUK, MaliyetTip.ILAVE_GUMRUK_VERGISI, MaliyetTip.DAMGA_VERGISI,
    MaliyetTip.TSE_UCRETI, MaliyetTip.GUMRUKCU_MASRAFI, MaliyetTip.BANKA_MASRAFI,
    MaliyetTip.KDV, MaliyetTip.DIGER,
]


class Siparis(Base, SoftDeleteMixin):
    __tablename__ = "siparisler"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    siparis_no = Column(String(50), unique=True, nullable=False)
    tedarikci_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"), nullable=False)
    kaynak = Column(SAEnum(StokKaynak, name="stok_kaynak_t"), nullable=False)
    kopya_kaynak_siparis_id = Column(BigInteger, ForeignKey("siparisler.id"))
    siparis_tarihi = Column(Date, nullable=False)
    tahmini_teslim_tarihi = Column(Date)
    durum = Column(SAEnum(SiparisDurum, name="siparis_durum_t"), default=SiparisDurum.TASLAK)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    cikis_limani = Column(String(150))
    varis_limani = Column(String(150))
    konsimento_no = Column(String(100))
    gumruk_beyanname_no = Column(String(100))
    notlar = Column(Text)
    olusturan_kullanici_id = Column(BigInteger, ForeignKey("kullanicilar.id"))
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class SiparisDetay(Base):
    __tablename__ = "siparis_detay"

    id = Column(BigInteger, primary_key=True)
    siparis_id = Column(BigInteger, ForeignKey("siparisler.id"), nullable=False)
    stok_karti_id = Column(BigInteger, ForeignKey("stok_kartlari.id"), nullable=False)
    miktar = Column(Integer, nullable=False, default=1)
    birim_fiyat = Column(Numeric(18, 2), nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    birim_agirlik_kg = Column(Numeric(10, 2))
    kdv_orani = Column(Numeric(5, 2), nullable=False, default=20)
    aciklama = Column(String(300))


class SiparisOdeme(Base):
    __tablename__ = "siparis_odemeleri"

    id = Column(BigInteger, primary_key=True)
    siparis_id = Column(BigInteger, ForeignKey("siparisler.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    odeme_yontemi = Column(String(10))
    cek_id = Column(BigInteger, ForeignKey("cekler.id"))
    notlar = Column(String(300))
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class GumrukBeyannamesi(Base):
    __tablename__ = "gumruk_beyannameleri"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    siparis_id = Column(BigInteger, ForeignKey("siparisler.id"), nullable=False)
    beyanname_no = Column(String(100))
    beyanname_tarihi = Column(Date, nullable=False)
    gumruk_musaviri_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    tutar = Column(Numeric(18, 2), nullable=False)
    para_birimi = Column(String(10), nullable=False, default="TRY")
    kur = Column(Numeric(18, 6), nullable=False, default=1)
    tutar_try = Column(Numeric(18, 2), nullable=False)
    kdv_tutari = Column(Numeric(18, 2), nullable=False, default=0)
    notlar = Column(String(500))
    olusturma_tarihi = Column(DateTime, server_default=func.now())
