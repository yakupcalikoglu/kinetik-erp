import json
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.demirbas import Demirbas
from app.models.cari import CariHesap
from app.models.denetim import DuzenlemeKaydi
from app.core.security import sifre_dogrula
from app.services.para_hareketi import para_hareketi_olustur
from app.schemas.demirbas import (
    DemirbasOlusturIstegi, DemirbasDuzenleIstegi, DemirbasSatisIstegi, DemirbasYanit,
)

router = APIRouter(prefix="/demirbaslar", tags=["Demirbaş"])


def _degisiklikleri_kaydet(db: Session, sirket_id: int, kullanici_id: int, tablo_adi: str, kayit_id: int, degisiklikler: dict) -> None:
    if not degisiklikler:
        return
    db.add(DuzenlemeKaydi(
        sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
        kayit_id=kayit_id, degisiklikler=json.dumps(degisiklikler, ensure_ascii=False, default=str),
    ))


def _demirbas_getir_veya_404(db: Session, demirbas_id: int, sirket_id: int) -> Demirbas:
    kayit = db.get(Demirbas, demirbas_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demirbaş bulunamadı.")
    return kayit


def _cari_unvan_ekle(db: Session, kayitlar: list[Demirbas]) -> None:
    cari_ids = [k.kiraci_cari_id for k in kayitlar if k.kiraci_cari_id]
    cari_haritasi = {}
    if cari_ids:
        cari_haritasi = {
            c.id: c.unvan for c in db.execute(select(CariHesap).where(CariHesap.id.in_(cari_ids))).scalars()
        }
    for k in kayitlar:
        k.kiraci_unvan = cari_haritasi.get(k.kiraci_cari_id)


@router.post("", response_model=DemirbasYanit,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def demirbas_olustur(
    istek: DemirbasOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """Yeni bir demirbas (arac, gayrimenkul, ofis ekipmani vb.) kaydi olusturur. Kasa/Banka hareketi OLUSTURMAZ."""
    maliyet_try = istek.maliyet_orijinal * istek.kur
    yeni = Demirbas(
        sirket_id=sirket_id, kategori=istek.kategori, ad=istek.ad,
        tanimlayici_no=istek.tanimlayici_no, konum=istek.konum, durum=istek.durum,
        kiraci_cari_id=istek.kiraci_cari_id, maliyet_try=maliyet_try,
        alim_tarihi=istek.alim_tarihi, notlar=istek.notlar,
    )
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    _cari_unvan_ekle(db, [yeni])
    return yeni


@router.get("", response_model=list[DemirbasYanit],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def demirbaslari_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(Demirbas).where(Demirbas.sirket_id == sirket_id).order_by(Demirbas.id.desc())
    kayitlar = list(db.execute(sorgu).scalars())
    _cari_unvan_ekle(db, kayitlar)
    return kayitlar


@router.put("/{demirbas_id}", response_model=DemirbasYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def demirbas_duzenle(
    demirbas_id: int, istek: DemirbasDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    kayit = _demirbas_getir_veya_404(db, demirbas_id, sirket_id)
    alan_adlari = {
        "kategori": "Kategori", "ad": "Ad", "tanimlayici_no": "Tanımlayıcı No", "konum": "Konum",
        "durum": "Durum", "kiraci_cari_id": "Kiracı", "maliyet_try": "Maliyet", "alim_tarihi": "Alım Tarihi",
        "notlar": "Notlar",
    }
    yeni_degerler = {
        "kategori": istek.kategori, "ad": istek.ad, "tanimlayici_no": istek.tanimlayici_no,
        "konum": istek.konum, "durum": istek.durum, "kiraci_cari_id": istek.kiraci_cari_id,
        "maliyet_try": istek.maliyet_try, "alim_tarihi": istek.alim_tarihi, "notlar": istek.notlar,
    }
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(kayit, alan)
        yeni = yeni_degerler[alan]
        if str(eski) != str(yeni):
            degisiklikler[etiket] = {"eski": eski, "yeni": yeni}
        setattr(kayit, alan, yeni)

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "demirbaslar", kayit.id, degisiklikler)

    db.commit()
    db.refresh(kayit)
    _cari_unvan_ekle(db, [kayit])
    return kayit


@router.delete("/{demirbas_id}", dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def demirbas_sil(
    demirbas_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    kayit = _demirbas_getir_veya_404(db, demirbas_id, sirket_id)
    db.delete(kayit)
    db.commit()
    return {"silindi": True}


@router.put("/{demirbas_id}/satis", response_model=DemirbasYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def demirbas_satisi_yap(
    demirbas_id: int, istek: DemirbasSatisIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Bir demirbasi satar. satis_fiyati_try Kasa/Banka'ya GIRIS olarak
    islenir (0 olabilir, orn. hurdaya cikarma gibi bedelsiz durumlar icin).
    Kar/zarar = satis_fiyati_try - maliyet_try (frontend'de hesaplanip
    gosterilir, StokSeriNo'daki ayni mantik).
    """
    kayit = _demirbas_getir_veya_404(db, demirbas_id, sirket_id)
    if kayit.durum in ("SATILDI", "HURDA"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu demirbaş zaten satılmış veya hurdaya çıkarılmış.")

    if istek.satis_fiyati_try > 0 and not istek.odeme_yontemi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Satış tutarı girildiyse ödeme yöntemi (Nakit/Banka) zorunludur.")

    kayit.durum = "SATILDI"
    kayit.satis_fiyati_try = istek.satis_fiyati_try
    kayit.satis_tarihi = date.today()

    if istek.satis_fiyati_try > 0:
        para_hareketi_olustur(
            db, sirket_id, kullanici.id, "GIRIS", istek.satis_fiyati_try,
            istek.odeme_yontemi, istek.banka_hesap_id,
            aciklama=f"Demirbaş satışı - {kayit.ad}" + (f" - {istek.aciklama}" if istek.aciklama else ""),
            kaynak_tablo="DEMIRBAS_SATIS", kaynak_id=kayit.id,
        )

    db.commit()
    db.refresh(kayit)
    _cari_unvan_ekle(db, [kayit])
    return kayit
