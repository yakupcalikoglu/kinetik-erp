from sqlalchemy import Column, BigInteger, String, Numeric, DateTime
from sqlalchemy.sql import func
from app.db.session import Base


class AkreditifMaliyetDagitimi(Base):
    """
    Bir akreditifin komisyon/masraf kalemlerinden urunlere yapilan HER
    dagitim iceslemi burada kalici olarak izlenir. Boylece daha sonra
    'Geri Al' ile o dagitimin urun maliyetinden dusulmesi (iptali) mumkun
    olur - dogrudan diger_maliyet_try'i degistirip iz birakmamak yerine.
    """
    __tablename__ = "akreditif_maliyet_dagitimlari"
    id = Column(BigInteger, primary_key=True)
    akreditif_id = Column(BigInteger, nullable=False)
    stok_seri_no_id = Column(BigInteger, nullable=False)
    yontem = Column(String(20), nullable=False)
    kur = Column(Numeric(18, 4))
    tutar_try = Column(Numeric(18, 2), nullable=False)
    olusturma_tarihi = Column(DateTime, server_default=func.now())
