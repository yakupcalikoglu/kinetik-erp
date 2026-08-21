"""
Cari acilis bakiyesi - sisteme gecmeden ONCE var olan (Wolvox gibi baska
bir muhasebe sisteminden devrolan) alacak/borc durumunu tek bir kalemde
kayit altina almak icin. Sistemdeki diger TUM alacak/borc hesaplamalari
(Siparis, Cek, Kiralama, Leasing, Ortak/Dis Borc vb.) ILGILI islemler
uzerinden CANLI hesaplanir - acilis bakiyesi ise boyle bir islem GECMISI
OLMADAN, TEK SEFERLIK bir "devir" tutari olarak ayri saklanir. cari_ozet
ve ozet-listesi endpoint'leri bu tutari, hesapladiklari NET bakiyeye
EKLER (SIFIRDAN bir sipariste/cekte oldugu gibi ayrica islenmez).
"""
from sqlalchemy import Column, BigInteger, String, Numeric, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.sql import func
from app.db.session import Base
from app.models.cari import ParaBirimi


class CariAcilisBakiyesi(Base):
    __tablename__ = "cari_acilis_bakiyeleri"
    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    # Her cari icin EN FAZLA bir acilis bakiyesi kaydi olur - "belirle"
    # endpoint'i, VARSA gunceller, YOKSA olusturur (upsert).
    cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"), nullable=False, unique=True)
    # POZITIF: bu cari bize borclu (alacagimiz) - NEGATIF: biz bu cariye borcluyuz.
    tutar = Column(Numeric(18, 2), nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False, default=ParaBirimi.TRY)
    kur = Column(Numeric(18, 6), nullable=False, default=1)
    tarih = Column(Date, nullable=False)
    aciklama = Column(String(300))
    olusturma_tarihi = Column(DateTime, server_default=func.now())
