from sqlalchemy import Column, BigInteger, Integer, Date, Numeric, Boolean
from app.db.session import Base


class AkreditifKalemTaksiti(Base):
    """
    Bir akreditif kaleminin (odenmemis ODEME/KOMISYON/MASRAF) finansman
    sikintisi durumunda ek bir ucret karsiliginda taksitlere bolunmesiyle
    olusan satirlar. Orijinal AkreditifKalemi tablosuna DOKUNULMAZ; bir
    kalemin "taksitlendirilmis" olup olmadigi, bu tabloda kayit olup
    olmamasina bakilarak anlasilir.
    """
    __tablename__ = "akreditif_kalem_taksitleri"
    id = Column(BigInteger, primary_key=True)
    kalem_id = Column(BigInteger, nullable=False)
    taksit_no = Column(Integer, nullable=False)
    vade_tarihi = Column(Date, nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    odendi_mi = Column(Boolean, default=False)
    odeme_tarihi = Column(Date)
