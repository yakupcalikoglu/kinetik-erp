from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.cari import CariHesap, CariHareket, HareketYon
from app.models.stok import StokSeriNo
from app.models.virman import UrunSahiplikGecmisi
from app.schemas.virman import (
    CariVirmanIstegi, CariVirmanYaniti, UrunVirmanIstegi, UrunVirmanYaniti,
    UrunSahiplikGecmisiYanit, CariVirmanGecmisiYanit,
)

router = APIRouter(prefix="/virman", tags=["Virman"])


@router.post("/cari-cariye", response_model=CariVirmanYaniti,
             dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def cari_cariye_virman(
    istek: CariVirmanIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Borc devri: kaynak carinin uzerindeki borc/alacak, ayni tutarda hedef
    cariye tasinir. Kaynak caride GIRIS (borcu kapanir), hedef caride CIKIS
    (borc onun uzerine gecer) hareketi acilir. Iki hareket birbirine
    kaynak_tablo/kaynak_id ile capraz baglidir, boylece virman gecmisi
    izlenebilir.
    """
    if istek.kaynak_cari_id == istek.hedef_cari_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Kaynak ve hedef cari aynı olamaz.")
    kaynak = db.get(CariHesap, istek.kaynak_cari_id)
    if kaynak is None or kaynak.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Kaynak cari bulunamadı (ID={istek.kaynak_cari_id}).")
    hedef = db.get(CariHesap, istek.hedef_cari_id)
    if hedef is None or hedef.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Hedef cari bulunamadı (ID={istek.hedef_cari_id}).")
    aciklama_metni = istek.aciklama or f"Borç devri: {kaynak.unvan} → {hedef.unvan}"
    kaynak_hareket = CariHareket(
        cari_id=istek.kaynak_cari_id,
        sirket_id=sirket_id,
        tarih=date.today(),
        aciklama=aciklama_metni,
        yon=HareketYon.GIRIS,
        para_birimi=istek.para_birimi,
        tutar=istek.tutar,
        kaynak_tablo="VIRMAN_CARI_CARI",
        olusturan_kullanici_id=kullanici.id,
    )
    db.add(kaynak_hareket)
    db.flush()
    hedef_hareket = CariHareket(
        cari_id=istek.hedef_cari_id,
        sirket_id=sirket_id,
        tarih=date.today(),
        aciklama=aciklama_metni,
        yon=HareketYon.CIKIS,
        para_birimi=istek.para_birimi,
        tutar=istek.tutar,
        kaynak_tablo="VIRMAN_CARI_CARI",
        kaynak_id=kaynak_hareket.id,
        olusturan_kullanici_id=kullanici.id,
    )
    db.add(hedef_hareket)
    db.flush()
    kaynak_hareket.kaynak_id = hedef_hareket.id
    db.commit()
    return CariVirmanYaniti(kaynak_hareket_id=kaynak_hareket.id, hedef_hareket_id=hedef_hareket.id)


@router.get("/cari-cariye/gecmis", response_model=list[CariVirmanGecmisiYanit],
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
def cari_cariye_virman_gecmisi(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Yapilan tum Cari->Cari borc devirlerini listeler. Her devir iki
    CariHareket satirindan olustugu icin, sadece GIRIS (kaynak) tarafini
    baz alarak tekrarlanmadan listeler; hedef bilgisi karsi hareketten okunur.
    """
    kaynak_hareketler = list(db.execute(
        select(CariHareket).where(
            CariHareket.sirket_id == sirket_id,
            CariHareket.kaynak_tablo == "VIRMAN_CARI_CARI",
            CariHareket.yon == HareketYon.GIRIS,
        ).order_by(CariHareket.id.desc())
    ).scalars())

    cari_unvanlari = {
        c.id: c.unvan for c in db.execute(
            select(CariHesap).where(CariHesap.sirket_id == sirket_id)
        ).scalars()
    }

    sonuc = []
    for kh in kaynak_hareketler:
        hedef_hareket = db.get(CariHareket, kh.kaynak_id) if kh.kaynak_id else None
        sonuc.append(CariVirmanGecmisiYanit(
            id=kh.id,
            kaynak_cari_id=kh.cari_id,
            kaynak_cari_unvan=cari_unvanlari.get(kh.cari_id),
            hedef_cari_id=hedef_hareket.cari_id if hedef_hareket else None,
            hedef_cari_unvan=cari_unvanlari.get(hedef_hareket.cari_id) if hedef_hareket else None,
            tutar=kh.tutar, para_birimi=kh.para_birimi.value if hasattr(kh.para_birimi, "value") else kh.para_birimi,
            aciklama=kh.aciklama, tarih=kh.tarih,
        ))
    return sonuc


@router.delete("/cari-cariye/{kaynak_hareket_id}/geri-al",
               dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def cari_cariye_virmani_geri_al(
    kaynak_hareket_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Bir borc devrini tamamen geri alir - hem kaynak hem hedef hareketi siler."""
    kaynak_hareket = db.get(CariHareket, kaynak_hareket_id)
    if kaynak_hareket is None or kaynak_hareket.sirket_id != sirket_id or kaynak_hareket.kaynak_tablo != "VIRMAN_CARI_CARI":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Virman kaydı bulunamadı.")

    hedef_hareket = db.get(CariHareket, kaynak_hareket.kaynak_id) if kaynak_hareket.kaynak_id else None
    if hedef_hareket is not None:
        db.delete(hedef_hareket)
    db.delete(kaynak_hareket)
    db.commit()
    return {"geri_alindi": True}


@router.post("/urun-cariye", response_model=UrunVirmanYaniti,
             dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def urun_cariye_virman(
    istek: UrunVirmanIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Bir urunun (konsinye vb.) sahiplik/zimmet ataması bir cariden digerine
    devredilir. Urunun durumu ve satis bilgileri degismez; sadece
    musteri_cari_id alani guncellenir. Islem, gecmis takibi icin
    urun_sahiplik_gecmisi tablosuna da kaydedilir.
    """
    urun = db.get(StokSeriNo, istek.stok_seri_no_id)
    if urun is None or urun.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ürün (seri no) bulunamadı.")
    hedef = db.get(CariHesap, istek.hedef_cari_id)
    if hedef is None or hedef.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Hedef cari bulunamadı (ID={istek.hedef_cari_id}).")

    eski_cari_id = urun.musteri_cari_id
    urun.musteri_cari_id = istek.hedef_cari_id

    db.add(UrunSahiplikGecmisi(
        stok_seri_no_id=urun.id, eski_cari_id=eski_cari_id, yeni_cari_id=istek.hedef_cari_id,
        aciklama=istek.aciklama, tarih=date.today(),
    ))

    db.commit()
    return UrunVirmanYaniti(stok_seri_no_id=urun.id, yeni_sahip_cari_id=istek.hedef_cari_id)


@router.get("/urun-cariye/gecmis", response_model=list[UrunSahiplikGecmisiYanit],
            dependencies=[Depends(izin_gerektir("STOK_GORUNTULE"))])
def urun_cariye_virman_gecmisi(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kayitlar = list(db.execute(
        select(UrunSahiplikGecmisi).order_by(UrunSahiplikGecmisi.id.desc())
    ).scalars())

    urunler = {
        u.id: u.seri_no for u in db.execute(
            select(StokSeriNo).where(StokSeriNo.sirket_id == sirket_id)
        ).scalars()
    }
    cari_unvanlari = {
        c.id: c.unvan for c in db.execute(
            select(CariHesap).where(CariHesap.sirket_id == sirket_id)
        ).scalars()
    }

    sonuc = []
    for k in kayitlar:
        if k.stok_seri_no_id not in urunler:
            continue  # baska sirkete ait, atla
        sonuc.append(UrunSahiplikGecmisiYanit(
            id=k.id, stok_seri_no_id=k.stok_seri_no_id, seri_no=urunler.get(k.stok_seri_no_id),
            eski_cari_id=k.eski_cari_id, eski_cari_unvan=cari_unvanlari.get(k.eski_cari_id),
            yeni_cari_id=k.yeni_cari_id, yeni_cari_unvan=cari_unvanlari.get(k.yeni_cari_id),
            aciklama=k.aciklama, tarih=k.tarih,
        ))
    return sonuc


@router.delete("/urun-cariye/{gecmis_id}/geri-al",
               dependencies=[Depends(izin_gerektir("STOK_DUZENLE"))])
def urun_cariye_virmanini_geri_al(
    gecmis_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Bir sahiplik devrini geri alir: urunun sahibini eski cariye dondurur ve gecmis kaydini siler."""
    kayit = db.get(UrunSahiplikGecmisi, gecmis_id)
    if kayit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Devir kaydı bulunamadı.")
    urun = db.get(StokSeriNo, kayit.stok_seri_no_id)
    if urun is None or urun.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Devir kaydı bulunamadı.")

    urun.musteri_cari_id = kayit.eski_cari_id
    db.delete(kayit)
    db.commit()
    return {"geri_alindi": True}
