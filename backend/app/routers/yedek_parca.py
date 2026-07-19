import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.yedek_parca import YedekParca, YedekParcaHareketi, YedekParcaHareketYon
from app.models.cari import CariHesap
from app.models.denetim import DuzenlemeKaydi
from app.core.security import sifre_dogrula
from app.schemas.yedek_parca import (
    YedekParcaOlusturIstegi, YedekParcaDuzenleIstegi, YedekParcaYanit,
    YedekParcaHareketOlusturIstegi, YedekParcaHareketYanit,
)

router = APIRouter(prefix="/yedek-parcalar", tags=["Yedek Parça / Sarf Malzeme"])


def _degisiklikleri_kaydet(db: Session, sirket_id: int, kullanici_id: int, tablo_adi: str, kayit_id: int, degisiklikler: dict) -> None:
    if not degisiklikler:
        return
    db.add(DuzenlemeKaydi(
        sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
        kayit_id=kayit_id, degisiklikler=json.dumps(degisiklikler, ensure_ascii=False, default=str),
    ))


def _parca_getir_veya_404(db: Session, parca_id: int, sirket_id: int) -> YedekParca:
    kayit = db.get(YedekParca, parca_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Yedek parça bulunamadı.")
    return kayit


@router.post("", response_model=YedekParcaYanit,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def yedek_parca_olustur(
    istek: YedekParcaOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    yeni = YedekParca(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("", response_model=list[YedekParcaYanit],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def yedek_parcalari_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(YedekParca).where(YedekParca.sirket_id == sirket_id).order_by(YedekParca.ad)
    return list(db.execute(sorgu).scalars())


@router.put("/{parca_id}", response_model=YedekParcaYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def yedek_parca_duzenle(
    parca_id: int, istek: YedekParcaDuzenleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """Bir yedek parca kaydinin tanimlayici bilgilerini duzenler (mevcut_miktar buradan degistirilemez - hareket ekleyerek degistirilir). Sifre onayi zorunludur."""
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    kayit = _parca_getir_veya_404(db, parca_id, sirket_id)
    alan_adlari = {"ad": "Ad", "birim": "Birim", "birim_fiyat_try": "Birim Fiyat", "min_stok_seviyesi": "Min Stok Seviyesi", "notlar": "Notlar"}
    yeni_degerler = {
        "ad": istek.ad, "birim": istek.birim, "birim_fiyat_try": istek.birim_fiyat_try,
        "min_stok_seviyesi": istek.min_stok_seviyesi, "notlar": istek.notlar,
    }
    degisiklikler = {}
    for alan, etiket in alan_adlari.items():
        eski = getattr(kayit, alan)
        yeni = yeni_degerler[alan]
        if str(eski) != str(yeni):
            degisiklikler[etiket] = {"eski": eski, "yeni": yeni}
        setattr(kayit, alan, yeni)

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "yedek_parcalar", kayit.id, degisiklikler)

    db.commit()
    db.refresh(kayit)
    return kayit


@router.delete("/{parca_id}", dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def yedek_parca_sil(
    parca_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    kayit = _parca_getir_veya_404(db, parca_id, sirket_id)
    hareket_var_mi = db.execute(
        select(YedekParcaHareketi).where(YedekParcaHareketi.yedek_parca_id == parca_id)
    ).first()
    if hareket_var_mi is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Hareketi olan bir yedek parça silinemez.")
    db.delete(kayit)
    db.commit()
    return {"silindi": True}


@router.post("/{parca_id}/hareketler", response_model=YedekParcaHareketYanit,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def yedek_parca_hareketi_ekle(
    parca_id: int, istek: YedekParcaHareketOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Bir yedek parcaya giris (satinalma) ya da cikis (kullanim/satis) hareketi
    ekler ve mevcut_miktar'i buna gore gunceller. GIRIS hareketinde
    birim_fiyat_try verilirse, parcanin guncel referans fiyati da bu deger
    ile guncellenir (en son alis fiyatini yansitir).
    """
    kayit = _parca_getir_veya_404(db, parca_id, sirket_id)
    if istek.yon == YedekParcaHareketYon.CIKIS and istek.miktar > kayit.mevcut_miktar:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Yetersiz stok. Mevcut: {kayit.mevcut_miktar} {kayit.birim}"
        )

    birim_fiyat_try = (istek.birim_fiyat_orijinal * istek.kur) if istek.birim_fiyat_orijinal is not None else None

    yeni = YedekParcaHareketi(
        yedek_parca_id=parca_id, tarih=istek.tarih, yon=istek.yon, miktar=istek.miktar,
        birim_fiyat_orijinal=istek.birim_fiyat_orijinal, para_birimi=istek.para_birimi, kur=istek.kur,
        birim_fiyat_try=birim_fiyat_try, ilgili_cari_id=istek.ilgili_cari_id, aciklama=istek.aciklama,
    )
    db.add(yeni)

    if istek.yon == YedekParcaHareketYon.GIRIS:
        kayit.mevcut_miktar = kayit.mevcut_miktar + istek.miktar
        if birim_fiyat_try:
            kayit.birim_fiyat_try = birim_fiyat_try  # guncel referans fiyat her zaman TL olarak tutulur
    else:
        kayit.mevcut_miktar = kayit.mevcut_miktar - istek.miktar

    db.commit()
    db.refresh(yeni)

    if yeni.ilgili_cari_id:
        cari = db.get(CariHesap, yeni.ilgili_cari_id)
        yeni.ilgili_cari_unvan = cari.unvan if cari else None
    return yeni


@router.get("/{parca_id}/hareketler", response_model=list[YedekParcaHareketYanit],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def yedek_parca_hareketlerini_listele(
    parca_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    _parca_getir_veya_404(db, parca_id, sirket_id)
    sorgu = (
        select(YedekParcaHareketi)
        .where(YedekParcaHareketi.yedek_parca_id == parca_id)
        .order_by(YedekParcaHareketi.tarih.desc())
    )
    sonuclar = list(db.execute(sorgu).scalars())

    cari_ids = [s.ilgili_cari_id for s in sonuclar if s.ilgili_cari_id]
    cari_haritasi = {}
    if cari_ids:
        cari_haritasi = {
            c.id: c.unvan for c in db.execute(select(CariHesap).where(CariHesap.id.in_(cari_ids))).scalars()
        }
    for s in sonuclar:
        s.ilgili_cari_unvan = cari_haritasi.get(s.ilgili_cari_id)
    return sonuclar


@router.delete("/hareketler/{hareket_id}", dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def yedek_parca_hareketi_sil(
    hareket_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """Yanlislikla girilmis bir hareketi siler ve mevcut_miktar'i geri alir."""
    hareket = db.get(YedekParcaHareketi, hareket_id)
    if hareket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hareket bulunamadı.")
    kayit = db.get(YedekParca, hareket.yedek_parca_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hareket bulunamadı.")

    if hareket.yon == YedekParcaHareketYon.GIRIS:
        kayit.mevcut_miktar = kayit.mevcut_miktar - hareket.miktar
    else:
        kayit.mevcut_miktar = kayit.mevcut_miktar + hareket.miktar

    db.delete(hareket)
    db.commit()
    return {"silindi": True}
