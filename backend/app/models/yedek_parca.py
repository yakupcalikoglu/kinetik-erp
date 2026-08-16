"""
Yedek parca / sarf malzeme stogu - forklift gibi seri numarali ana urunlerin
YANI SIRA, seri no'suz, adet/miktar bazinda takip edilen kucuk parcalar
(lastik, aku, hidrolik yag vb.) icin ayri ve basit bir stok sistemi.
"""
import enum
from sqlalchemy import Column, BigInteger, String, Numeric, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.sql import func
from app.db.session import Base
from app.db.soft_delete import SoftDeleteMixin


class YedekParcaHareketYon(str, enum.Enum):
    GIRIS = "GIRIS"
    CIKIS = "CIKIS"


class YedekParca(Base, SoftDeleteMixin):
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
    """
    Giris (satinalma) veya cikis (kullanim/satis) hareketi. mevcut_miktar bu
    hareketlerle senkron tutulur. Dovizli girisler icin birim_fiyat_orijinal
    (girilen tutar, kendi para biriminde) + para_birimi + kur saklanir;
    birim_fiyat_try bunlardan hesaplanan TL karsiligidir (raporlama/toplam
    deger hesabinda kullanilir).
    """
    __tablename__ = "yedek_parca_hareketleri"

    id = Column(BigInteger, primary_key=True)
    yedek_parca_id = Column(BigInteger, ForeignKey("yedek_parcalar.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    yon = Column(SAEnum(YedekParcaHareketYon, name="yedek_parca_hareket_yon_t"), nullable=False)
    miktar = Column(Numeric(18, 2), nullable=False)
    birim_fiyat_orijinal = Column(Numeric(18, 2))
    para_birimi = Column(String(10), nullable=False, default="TRY")
    kur = Column(Numeric(18, 6), nullable=False, default=1)
    birim_fiyat_try = Column(Numeric(18, 2))
    ilgili_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    aciklama = Column(String(300))
    # SADECE satis cikislarinda doldurulur: o anki (satis anindaki) referans
    # maliyet - parcanin GENEL birim_fiyat_try'si zamanla degisse bile, bu
    # satisin karini dogru/sabit hesaplayabilmek icin anlik olarak saklanir.
    maliyet_birim_fiyat_try = Column(Numeric(18, 2))
    # Odeme entegrasyonu: doldurulursa Kasa/Banka'ya gercek bir hareket
    # yansitilir (GIRIS=alis->para CIKISI, CIKIS+satis_fiyati var->para GIRISI).
    # Bos birakilirsa (orn. sarf/kullanim cikisi) hicbir mali hareket olusmaz.
    odeme_yontemi = Column(String(10))  # "NAKIT" | "BANKA" | None
    banka_hesap_id = Column(BigInteger, ForeignKey("banka_hesaplari.id"))
    # Bu parcanin HANGI urune (forklift vb.) takildigini/kullanildigini
    # izlemek icin - ozellikle bedelsiz (garanti kapsami) verme durumunda
    # onemli: "hangi musterinin hangi seri nolu urunune garanti kapsaminda
    # takildi" bilgisini kalici olarak saklar.
    ilgili_stok_seri_no_id = Column(BigInteger, ForeignKey("stok_seri_no.id"))
    olusturma_tarihi = Column(DateTime, server_default=func.now())
