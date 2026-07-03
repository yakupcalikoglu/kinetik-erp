from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir
from app.models.stok import (StokKarti, StokSeriNo, StokMaliyetKalemi,
                              MALIYET_TIP_SUTUN_ESLEME, StokDurum)
from app.schemas.stok import (StokKartiOlusturIstegi, StokKartiYanit,
                               StokSeriNoYanit, StokDurumGuncelleIstegi,
                               MaliyetKalemiEkleIstegi, KarRaporuYanit)

router = APIRouter(tags=["Stok"])


@router.post("/stok-kartlari", response_model=StokKartiYanit,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_karti_olustur(
    istek: StokKartiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    yeni = StokKarti(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.put("/stok-kartlari/{stok_karti_id}", response_model=StokKartiYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_karti_guncelle(
    stok_karti_id: int,
    istek: StokKartiOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kart = db.get(StokKarti, stok_karti_id)
    if kart is None or kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stok kartı bulunamadı.")
    for alan, deger in istek.model_dump().items():
        setattr(kart, alan, deger)
    db.commit()
    db.refresh(kart)
    return kart


@router.delete("/stok-kartlari/{stok_karti_id}",
               dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_karti_sil(
    stok_karti_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kart = db.get(StokKarti, stok_karti_id)
    if kart is None or kart.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stok kartı bulunamadı.")
    try:
        db.delete(kart)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu stok kartı sipariş veya stok kayıtlarında kullanıldığı için silinemiyor."
        )
    return {"silindi": True}


@router.get("/stok-kartlari", response_model=list[StokKartiYanit],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def stok_kartlarini_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(StokKarti).where(StokKarti.sirket_id == sirket_id)
    return list(db.execute(sorgu).scalars())


@router.get("/stok-seri-no", response_model=list[StokSeriNoYanit],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def stok_seri_no_listele(
    durum: StokDurum | None = None,
    stok_karti_id: int | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(StokSeriNo).where(StokSeriNo.sirket_id == sirket_id)
    if durum:
        sorgu = sorgu.where(StokSeriNo.durum == durum)
    if stok_karti_id:
        sorgu = sorgu.where(StokSeriNo.stok_karti_id == stok_karti_id)
    return list(db.execute(sorgu).scalars())


def _seri_no_getir_veya_404(db: Session, seri_id: int, sirket_id: int) -> StokSeriNo:
    kayit = db.get(StokSeriNo, seri_id)
    if kayit is None or kayit.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seri numaralı stok kaydı bulunamadı.")
    return kayit


@router.get("/stok-seri-no/{seri_id}", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def stok_seri_no_getir(
    seri_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    return _seri_no_getir_veya_404(db, seri_id, sirket_id)


@router.put("/stok-seri-no/{seri_id}/durum", response_model=StokSeriNoYanit,
            dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def stok_durum_guncelle(
    seri_id: int,
    istek: StokDurumGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)

    if istek.durum == StokDurum.SATILDI and istek.musteri_cari_id is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Durum SATILDI yapılırken musteri_cari_id belirtilmelidir."
        )

    kayit.durum = istek.durum
    if istek.musteri_cari_id is not None:
        kayit.musteri_cari_id = istek.musteri_cari_id
    if istek.satis_fiyati_try is not None:
        kayit.satis_fiyati_try = istek.satis_fiyati_try
    if istek.satis_tarihi is not None:
        kayit.satis_tarihi = istek.satis_tarihi

    db.commit()
    db.refresh(kayit)
    return kayit


@router.post("/stok-seri-no/{seri_id}/maliyet-kalemi", response_model=StokSeriNoYanit,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def maliyet_kalemi_ekle(
    seri_id: int,
    istek: MaliyetKalemiEkleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Yeni bir maliyet faturasi/kalemi ekler (nakliye, gumruk, antrepo, vb.).
    Detay kayit stok_maliyet_kalemleri'ne dusuyor, ozet sutun da
    (orn. nakliye_maliyeti_try) ayni anda guncelleniyor; PDF/rapor
    ekranlari ozet sutunu okuyarak hizli calisir, detay sutun da
    fatura bazinda izlenebilirlik saglar.
    """
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)

    tutar_try = istek.tutar * istek.kur
    yeni_kalem = StokMaliyetKalemi(
        stok_seri_no_id=seri_id,
        tip=istek.tip,
        aciklama=istek.aciklama,
        tedarikci_cari_id=istek.tedarikci_cari_id,
        para_birimi=istek.para_birimi,
        tutar=istek.tutar,
        kur=istek.kur,
        tutar_try=tutar_try,
        belge_no=istek.belge_no,
        tarih=istek.tarih,
    )
    db.add(yeni_kalem)

    ozet_sutun = MALIYET_TIP_SUTUN_ESLEME[istek.tip]
    mevcut_deger = getattr(kayit, ozet_sutun) or 0
    setattr(kayit, ozet_sutun, mevcut_deger + tutar_try)

    db.commit()
    db.refresh(kayit)
    return kayit


@router.get("/stok-seri-no/{seri_id}/kar-raporu", response_model=KarRaporuYanit,
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def kar_raporu(
    seri_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kayit = _seri_no_getir_veya_404(db, seri_id, sirket_id)
    toplam = (kayit.satinalma_maliyeti_try + kayit.nakliye_maliyeti_try +
              kayit.gumruk_maliyeti_try + kayit.antrepo_maliyeti_try +
              kayit.millilestirme_maliyeti_try + kayit.leasing_maliyeti_try +
              kayit.diger_maliyet_try)
    kar_zarar = (kayit.satis_fiyati_try - toplam) if kayit.satis_fiyati_try is not None else None

    return KarRaporuYanit(
        seri_no=kayit.seri_no,
        toplam_maliyet_try=toplam,
        satis_fiyati_try=kayit.satis_fiyati_try,
        kar_zarar_try=kar_zarar,
        durum=kayit.durum,
    )
