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
    # Denetim izi de ISTIYORSAK (kim/ne zaman/hangi kaydi sildi):
    yumusak_sil(db, kayit, kullanici_id=kullanici.id, tablo_adi="cari_hesaplar", sirket_id=sirket_id)
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


def yumusak_sil(
    db: Session, kayit,
    kullanici_id: int | None = None, tablo_adi: str | None = None, sirket_id: int | None = None,
) -> None:
    """
    Kaydi GERCEKTEN silmek yerine "silindi" olarak isaretler ve commit eder.
    Kaydin modeli SoftDeleteMixin'den turemis olmalidir.

    OPSIYONEL denetim izi: kullanici_id + tablo_adi + sirket_id ucu BIRLIKTE
    verilirse, bu silme islemi OTOMATIK olarak denetim_kayitlari'na
    (islem_tipi="SILME") islenir - "kim, ne zaman, hangi kaydi sildi"
    sorusuna Yonetici Paneli'nden cevap verilebilir hale gelir. Bu 3
    parametre GERIYE DONUK UYUMLULUK icin opsiyoneldir - mevcut cagrilar
    (yumusak_sil(db, kayit)) hicbir degisiklik gerektirmeden calismaya
    devam eder, sadece o cagrilarda YENI bir denetim kaydi OLUSMAZ.
    """
    kayit.silindi_mi = True
    kayit.silinme_tarihi = datetime.now()
    if kullanici_id is not None and tablo_adi is not None and sirket_id is not None:
        from app.models.denetim import DuzenlemeKaydi
        db.add(DuzenlemeKaydi(
            sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
            kayit_id=kayit.id, islem_tipi="SILME", degisiklikler=None,
        ))
    db.commit()


def yumusak_geri_getir(db: Session, kayit) -> None:
    """Silinmis bir kaydi geri getirir (silindi_mi=False yapar) ve commit eder."""
    kayit.silindi_mi = False
    kayit.silinme_tarihi = None
    db.commit()
