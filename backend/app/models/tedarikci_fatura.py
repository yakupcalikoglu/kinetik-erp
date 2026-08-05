"""
Tedarikci/Hizmet Faturalari modulu - SQLAlchemy modelleri.

Is akisi: Bir firmadan (urun tedarikcisi ya da antrepo/gumrukcu/nakliye gibi
hizmet saglayicisi) fatura GELDIGINDE, once TedarikciFaturasi olarak
KAYDEDILIR (henuz hangi siparise/urune yansiyacagi SECILMEZ - bu asamada
sadece "bize X TL borcumuz var" bilgisi olusur). Fatura ODENIRKEN
(TedarikciFaturaOdemesi), kullanici o odemenin HANGI siparise (orantili
dagitim) ya da HANGI tek urune (StokSeriNo) yansiyacagini VE hangi
maliyet tipinde (gumruk, navlun, TSE, KDV, digger vb.) sayilacagini secer.
Bu secim, ilgili StokSeriNo kayit(lar)ina otomatik StokMaliyetKalemi
eklenmesini tetikler - boylece urun maliyeti dogru sekilde guncellenir.
"""
from sqlalchemy import (Column, BigInteger, String, Numeric, Date, DateTime,
                         ForeignKey, Text, Enum as SAEnum)
from sqlalchemy.sql import func
from app.db.session import Base
from app.models.stok import ParaBirimi, MaliyetTip


class TedarikciFaturasi(Base):
    __tablename__ = "tedarikci_faturalari"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    tedarikci_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"), nullable=False)
    fatura_no = Column(String(100))
    tarih = Column(Date, nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False, default=ParaBirimi.TRY)
    aciklama = Column(Text)
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class TedarikciFaturaOdemesi(Base):
    __tablename__ = "tedarikci_fatura_odemeleri"

    id = Column(BigInteger, primary_key=True)
    fatura_id = Column(BigInteger, ForeignKey("tedarikci_faturalari.id"), nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)  # faturanin kendi para biriminde, BU odemede odenen kisim
    odeme_tarihi = Column(Date, nullable=False)
    odeme_yontemi = Column(String(10), nullable=False)  # "NAKIT" | "BANKA"
    banka_hesap_id = Column(BigInteger, ForeignKey("banka_hesaplari.id"))
    kur = Column(Numeric(18, 6), default=1)  # faturanin PB'si TRY degilse, o gunku kur
    # Dagitim bilgisi - bu odeme HANGI urune/siparise maliyet olarak yansiyacak:
    dagitim_tipi = Column(String(10), nullable=False)  # "SIPARIS" (orantili dagit) | "URUN" (tek urune tamami)
    siparis_id = Column(BigInteger, ForeignKey("siparisler.id"))
    stok_seri_no_id = Column(BigInteger, ForeignKey("stok_seri_no.id"))
    maliyet_tipi = Column(SAEnum(MaliyetTip, name="maliyet_tip_t"), nullable=False)
    olusturma_tarihi = Column(DateTime, server_default=func.now())
