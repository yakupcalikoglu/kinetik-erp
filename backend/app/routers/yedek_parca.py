import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.yedek_parca import YedekParca, YedekParcaHareketi, YedekParcaHareketYon
from app.models.cari import CariHesap
from app.models.stok import StokSeriNo, StokKarti
from app.models.denetim import DuzenlemeKaydi
from app.core.security import sifre_dogrula
from app.schemas.yedek_parca import (
    YedekParcaOlusturIstegi, YedekParcaDuzenleIstegi, YedekParcaYanit,
    YedekParcaHareketOlusturIstegi, YedekParcaHareketYanit,
    YedekParcaTopluIceAktarIstegi, YedekParcaTopluIceAktarSonucu,
)
from app.services.para_hareketi import para_hareketi_olustur

router = APIRouter(prefix="/yedek-parcalar", tags=["Yedek Parça / Sarf Malzeme"])


def _degisiklikleri_kaydet(db: Session, sirket_id: int, kullanici_id: int, tablo_adi: str, kayit_id: int, degisiklikler: dict) -> None:
    if not degisiklikler:
        return
    db.add(DuzenlemeKaydi(
        sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
        kayit_id=kayit_id, degisiklikler=json.dumps(degisiklikler, ensure_ascii=False, default=str),
    ))


def _urun_bilgisi_getir(db: Session, stok_seri_no_id: int) -> str | None:
    urun = db.get(StokSeriNo, stok_seri_no_id)
    if urun is None:
        return None
    kart = db.get(StokKarti, urun.stok_karti_id)
    return f"{kart.marka} {kart.model} ({urun.seri_no})" if kart else urun.seri_no


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


@router.post("/toplu-ice-aktar", response_model=YedekParcaTopluIceAktarSonucu,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def yedek_parca_toplu_ice_aktar(
    istek: YedekParcaTopluIceAktarIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Excel'den toplu yedek parca tanimi ekler. baslangic_miktari > 0 ise,
    bu miktari kayit altina almak icin ayrica bir GIRIS hareketi de
    olusturulur (odeme_yontemi yok - gecmiste zaten alinmis/mevcut stok
    kabul edilir, Kasa/Banka'ya hicbir hareket yansimaz). Her satir AYRI
    AYRI commit edilir.
    """
    from datetime import date as _date

    basarili = 0
    hatalar = []

    for i, satir in enumerate(istek.satirlar, start=1):
        try:
            if not satir.ad or not satir.ad.strip():
                raise ValueError("Ad boş olamaz.")
            yeni = YedekParca(
                sirket_id=sirket_id, ad=satir.ad.strip(), birim=satir.birim or "ADET",
                birim_fiyat_try=satir.birim_fiyat_try or 0, min_stok_seviyesi=satir.min_stok_seviyesi or 0,
                notlar=satir.notlar,
            )
            db.add(yeni)
            db.flush()

            if satir.baslangic_miktari and satir.baslangic_miktari > 0:
                db.add(YedekParcaHareketi(
                    yedek_parca_id=yeni.id, tarih=_date.today(), yon=YedekParcaHareketYon.GIRIS,
                    miktar=satir.baslangic_miktari, birim_fiyat_orijinal=satir.birim_fiyat_try,
                    para_birimi="TRY", kur=1, birim_fiyat_try=satir.birim_fiyat_try,
                    aciklama="Excel'den toplu içe aktarma - başlangıç stoğu",
                ))
                yeni.mevcut_miktar = satir.baslangic_miktari

            db.commit()
            basarili += 1
        except Exception as e:
            db.rollback()
            hatalar.append({"satir_no": i, "ad": satir.ad, "hata": str(e)})

    return YedekParcaTopluIceAktarSonucu(basarili_sayisi=basarili, hatali_satirlar=hatalar)


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
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Bir yedek parcaya giris (satinalma) ya da cikis (kullanim/satis) hareketi
    ekler ve mevcut_miktar'i buna gore gunceller.

    - GIRIS: birim_fiyat_orijinal ALIS fiyatidir. Parcanin guncel referans
      fiyati (birim_fiyat_try) bu alisla guncellenir.
    - CIKIS + birim_fiyat_orijinal DOLU: bu bir SATIS'tir. O anki referans
      maliyet (kayit.birim_fiyat_try) ile satis fiyati karsilastirilarak
      kar/zarar hesaplanip kalici olarak saklanir (maliyet_birim_fiyat_try).
    - CIKIS + birim_fiyat_orijinal BOS: sadece kullanim/sarf - mali etkisi
      yoktur, sadece stok duser.

    odeme_yontemi doldurulursa (NAKIT/BANKA), Kasa/Banka'ya GERCEK bir
    hareket yansitilir: GIRIS(alis) -> para CIKISI, CIKIS+satis -> para
    GIRISI.
    """
    kayit = _parca_getir_veya_404(db, parca_id, sirket_id)
    if istek.yon == YedekParcaHareketYon.CIKIS and istek.miktar > kayit.mevcut_miktar:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Yetersiz stok. Mevcut: {kayit.mevcut_miktar} {kayit.birim}"
        )
    if istek.odeme_yontemi and istek.odeme_yontemi not in ("NAKIT", "BANKA"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "odeme_yontemi 'NAKIT' veya 'BANKA' olmalıdır.")

    birim_fiyat_try = (istek.birim_fiyat_orijinal * istek.kur) if istek.birim_fiyat_orijinal is not None else None
    satis_mi = istek.yon == YedekParcaHareketYon.CIKIS and istek.birim_fiyat_orijinal is not None
    maliyet_birim_fiyat_try = kayit.birim_fiyat_try if satis_mi else None

    yeni = YedekParcaHareketi(
        yedek_parca_id=parca_id, tarih=istek.tarih, yon=istek.yon, miktar=istek.miktar,
        birim_fiyat_orijinal=istek.birim_fiyat_orijinal, para_birimi=istek.para_birimi, kur=istek.kur,
        birim_fiyat_try=birim_fiyat_try, maliyet_birim_fiyat_try=maliyet_birim_fiyat_try,
        odeme_yontemi=istek.odeme_yontemi, banka_hesap_id=istek.banka_hesap_id,
        ilgili_cari_id=istek.ilgili_cari_id, ilgili_stok_seri_no_id=istek.ilgili_stok_seri_no_id,
        aciklama=istek.aciklama,
    )
    db.add(yeni)
    db.flush()

    if istek.yon == YedekParcaHareketYon.GIRIS:
        kayit.mevcut_miktar = kayit.mevcut_miktar + istek.miktar
        if birim_fiyat_try:
            kayit.birim_fiyat_try = birim_fiyat_try  # guncel referans fiyat her zaman TL olarak tutulur
    else:
        kayit.mevcut_miktar = kayit.mevcut_miktar - istek.miktar

    if istek.odeme_yontemi and istek.birim_fiyat_orijinal is not None:
        tutar_toplam_orijinal = istek.miktar * istek.birim_fiyat_orijinal
        yon_kasa = "CIKIS" if istek.yon == YedekParcaHareketYon.GIRIS else "GIRIS"
        eylem_metni = "alımı" if istek.yon == YedekParcaHareketYon.GIRIS else "satışı"
        para_hareketi_olustur(
            db, sirket_id, kullanici.id, yon_kasa, tutar_toplam_orijinal,
            istek.odeme_yontemi, istek.banka_hesap_id,
            aciklama=f"Yedek parça {eylem_metni} - {kayit.ad} ({istek.miktar} {kayit.birim})" + (f" - {istek.aciklama}" if istek.aciklama else ""),
            kaynak_tablo="YEDEK_PARCA_HAREKET", kaynak_id=yeni.id,
            cari_id=istek.ilgili_cari_id, para_birimi=istek.para_birimi, kur=istek.kur,
        )

    db.commit()
    db.refresh(yeni)

    if yeni.maliyet_birim_fiyat_try is not None and yeni.birim_fiyat_try is not None:
        yeni.kar_try = (yeni.birim_fiyat_try - yeni.maliyet_birim_fiyat_try) * yeni.miktar
    if yeni.ilgili_cari_id:
        cari = db.get(CariHesap, yeni.ilgili_cari_id)
        yeni.ilgili_cari_unvan = cari.unvan if cari else None
    if yeni.ilgili_stok_seri_no_id:
        yeni.ilgili_urun_bilgisi = _urun_bilgisi_getir(db, yeni.ilgili_stok_seri_no_id)
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
    urun_ids = [s.ilgili_stok_seri_no_id for s in sonuclar if s.ilgili_stok_seri_no_id]
    urun_haritasi = {}
    if urun_ids:
        urunler = list(db.execute(select(StokSeriNo).where(StokSeriNo.id.in_(urun_ids))).scalars())
        kart_haritasi = {
            k.id: k for k in db.execute(select(StokKarti).where(StokKarti.id.in_({u.stok_karti_id for u in urunler}))).scalars()
        }
        for u in urunler:
            kart = kart_haritasi.get(u.stok_karti_id)
            urun_haritasi[u.id] = f"{kart.marka} {kart.model} ({u.seri_no})" if kart else u.seri_no

    for s in sonuclar:
        s.ilgili_cari_unvan = cari_haritasi.get(s.ilgili_cari_id)
        s.ilgili_urun_bilgisi = urun_haritasi.get(s.ilgili_stok_seri_no_id)
        if s.maliyet_birim_fiyat_try is not None and s.birim_fiyat_try is not None:
            s.kar_try = (s.birim_fiyat_try - s.maliyet_birim_fiyat_try) * s.miktar
    return sonuclar


@router.delete("/hareketler/{hareket_id}", dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def yedek_parca_hareketi_sil(
    hareket_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Yanlislikla girilmis bir hareketi siler, mevcut_miktar'i geri alir VE
    (eger bu harekete bagli bir odeme/tahsilat yapildiysa) ilgili
    Kasa/Banka hareketini de siler - aksi halde para hareketi asili
    kalir (stok geri alinir ama kasa/banka yanlis kalir).
    """
    from app.models.banka import KasaHareketi, BankaHareketi

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

    if hareket.odeme_yontemi:
        for kh in db.execute(
            select(KasaHareketi).where(KasaHareketi.kaynak_tablo == "YEDEK_PARCA_HAREKET", KasaHareketi.kaynak_id == hareket.id)
        ).scalars():
            db.delete(kh)
        for bh in db.execute(
            select(BankaHareketi).where(BankaHareketi.kaynak_tablo == "YEDEK_PARCA_HAREKET", BankaHareketi.kaynak_id == hareket.id)
        ).scalars():
            db.delete(bh)

    db.delete(hareket)
    db.commit()
    return {"silindi": True}
