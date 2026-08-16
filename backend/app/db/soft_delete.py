"""
Soft-delete (yumusak silme) icin ORTAK altyapi.

Amac: "Sil" dedigimizde kaydin GERCEKTEN veritabanindan silinmesi yerine,
"silindi" olarak ISARETLENMESI - boylece yanlislikla silinen bir kayit
(cari, urun, siparis, sozlesme vb.) HER ZAMAN geri getirilebilir.

Kullanim (bir modelde):
    from app.db.soft_delete import SoftDeleteMixin

    class CariHesap(Base, SoftDeleteMixin):
        __tablename__ = "cari_hesaplar"
        ...

Bu, modele otomatik olarak iki sutun ekler:
    - silindi_mi (Boolean, varsayilan False)
    - silinme_tarihi (DateTime, nullable)

Router'larda kullanim:
    from app.db.soft_delete import yumusak_sil, yumusak_geri_getir, aktif_filtre

    # Listelerken (sadece silinmemisleri getir):
    sorgu = select(CariHesap).where(aktif_filtre(CariHesap), CariHesap.sirket_id == sirket_id)

    # Silerken:
    yumusak_sil(db, kayit)

    # Geri getirirken:
    yumusak_geri_getir(db, kayit)
"""
from datetime import datetime

from sqlalchemy import Column, Boolean, DateTime
from sqlalchemy.orm import Session


class SoftDeleteMixin:
    """
    Bir modele "yumusak silme" alanlarini ekler. Bu mixin, Base ile
    BIRLIKTE (once Base, sonra SoftDeleteMixin sirasiyla) kullanilmalidir:
        class Ornek(Base, SoftDeleteMixin): ...
    """
    silindi_mi = Column(Boolean, nullable=False, default=False, server_default="false")
    silinme_tarihi = Column(DateTime, nullable=True)


def aktif_filtre(model):
    """
    Bir SELECT sorgusuna eklenecek "sadece silinmemis kayitlar" kosulu.
    Ornek: select(CariHesap).where(aktif_filtre(CariHesap), ...)
    """
    return model.silindi_mi.is_(False)


def yumusak_sil(db: Session, kayit) -> None:
    """
    Kaydi GERCEKTEN silmek yerine "silindi" olarak isaretler ve commit eder.
    Kaydin modeli SoftDeleteMixin'den turemis olmalidir.
    """
    kayit.silindi_mi = True
    kayit.silinme_tarihi = datetime.now()
    db.commit()


def yumusak_geri_getir(db: Session, kayit) -> None:
    """Silinmis bir kaydi geri getirir (silindi_mi=False yapar) ve commit eder."""
    kayit.silindi_mi = False
    kayit.silinme_tarihi = None
    db.commit()
