from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.cari import CariHesap, CariHareket, HareketYon
from app.models.stok import StokSeriNo
from app.schemas.virman import (
    CariVirmanIstegi, CariVirmanYaniti, UrunVirmanIstegi, UrunVirmanYaniti,
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
    musteri_cari_id alani guncellenir.
    """
    urun = db.get(StokSeriNo, istek.stok_seri_no_id)
    if urun is None or urun.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ürün (seri no) bulunamadı.")

    hedef = db.get(CariHesap, istek.hedef_cari_id)
    if hedef is None or hedef.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Hedef cari bulunamadı (ID={istek.hedef_cari_id}).")

    urun.musteri_cari_id = istek.hedef_cari_id
    db.commit()

    return UrunVirmanYaniti(stok_seri_no_id=urun.id, yeni_sahip_cari_id=istek.hedef_cari_id)
