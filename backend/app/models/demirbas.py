"""
Demirbas: forklift/ekipman disindaki oz mal varliklar (arac, gayrimenkul,
ofis ekipmani vb.) icin ayri ve basit bir takip sistemi. StokKarti/
StokSeriNo (GTIP, gumruk, seri no vb. iceren) yapisindan BAGIMSIZDIR -
cunku bir araba ya da bina icin "GTIP kodu" veya "gumruk maliyeti" gibi
kavramlar anlamli degildir.
"""
import enum
from sqlalchemy import Column, BigInteger, String, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base


class DemirbasKategori(str, enum.Enum):
    ARAC = "ARAC"
    GAYRIMENKUL = "GAYRIMENKUL"
    OFIS_EKIPMANI = "OFIS_EKIPMANI"
    DIGER = "DIGER"


class DemirbasDurum(str, enum.Enum):
    KULLANIMDA = "KULLANIMDA"
    KIRADA = "KIRADA"
    BOSTA = "BOSTA"
    SATILDI = "SATILDI"
    HURDA = "HURDA"


class Demirbas(Base):
    __tablename__ = "demirbaslar"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    kategori = Column(String(30), nullable=False)
    ad = Column(String(200), nullable=False)
    tanimlayici_no = Column(String(100))  # plaka, tapu no, seri no vb. - kategoriye gore serbest
    konum = Column(String(300))  # adres, sube, kimde vb.
    durum = Column(String(20), nullable=False, default="KULLANIMDA")
    kiraci_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    maliyet_try = Column(Numeric(18, 2), nullable=False, default=0)
    # Girilen orijinal tutar/para birimi KALICI olarak saklanir (Stok'taki
    # Oz Mal ile ayni mantik) - boylece "18.600 $ verdim" gibi tarihsel
    # bilgi, ileride canli kurla yeniden hesaplanan bir TAHMIN olarak degil,
    # GERCEK deger olarak gosterilebilir.
    maliyet_orijinal = Column(Numeric(18, 2))
    para_birimi = Column(String(10), nullable=False, default="TRY")
    alim_tarihi = Column(Date)
    satis_fiyati_try = Column(Numeric(18, 2))
    satis_tarihi = Column(Date)
    notlar = Column(String(500))
    olusturma_tarihi = Column(DateTime, server_default=func.now())
