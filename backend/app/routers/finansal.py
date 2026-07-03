from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from dateutil.relativedelta import relativedelta

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.finansal import (
    Cek, CekGecmis, CekDurum, CekTip,
    LeasingSozlesme, LeasingOdeme,
    TaksitliSatisPlani, TaksitDetay,
    KiralamaSozlesme, KiralamaOdeme,
    BakimKaydi, BakimTip,
)
from app.schemas.finansal import (
    CekOlusturIstegi, CekYanit, CekDurumGuncelleIstegi, CekGecmisYanit,
    LeasingOlusturIstegi, LeasingYanit, LeasingOdemeYanit, OdemeTahsilIstegi,
    TaksitliSatisOlusturIstegi, TaksitliSatisYanit, TaksitDetayYanit, TaksitTahsilIstegi,
    KiralamaOlusturIstegi, KiralamaYanit, KiralamaOdemeOlusturIstegi, KiralamaOdemeYanit,
    BakimOlusturIstegi, BakimYanit,
)
from app.services.para_hareketi import para_hareketi_olustur

router = APIRouter(tags=["Finansal Takip"])


# ============================================================================ ÇEK
@router.post("/cekler", response_model=CekYanit, dependencies=[Depends(izin_gerektir("CEK_DUZENLE"))])
def cek_olustur(istek: CekOlusturIstegi, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    yeni = Cek(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/cekler", response_model=list[CekYanit], dependencies=[Depends(izin_gerektir("CEK_GORUNTULE"))])
def cekleri_listele(
    tip: str | None = None, durum: str | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    sorgu = select(Cek).where(Cek.sirket_id == sirket_id)
    if tip:
        sorgu = sorgu.where(Cek.tip == tip)
    if durum:
        sorgu = sorgu.where(Cek.durum == durum)
    return list(db.execute(sorgu).scalars())


@router.put("/cekler/{cek_id}/durum", response_model=CekYanit, dependencies=[Depends(izin_gerektir("CEK_DUZENLE"))])
def cek_durum_guncelle(
    cek_id: int, istek: CekDurumGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Durum TAHSIL_EDILDI (ALINAN cek bankaya tahsile verildi) veya ODENDI
    (VERILEN cek karsilandi) yapilirken odeme_yontemi zorunludur; bu durumda
    otomatik olarak Ana Kasa'ya veya secilen banka hesabina bir hareket acilir.
    """
    cek = db.get(Cek, cek_id)
    if cek is None or cek.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Çek bulunamadı.")

    if istek.yeni_durum == CekDurum.CIRO_EDILDI and istek.ciro_edilen_cari_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ciro işlemi için ciro_edilen_cari_id zorunludur.")

    para_hareketi_gereken_durumlar = (CekDurum.TAHSIL_EDILDI, CekDurum.ODENDI)
    if istek.yeni_durum in para_hareketi_gereken_durumlar and not istek.odeme_yontemi:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu durum güncellemesi için odeme_yontemi ('NAKIT' veya 'BANKA') zorunludur."
        )

    eski_durum = cek.durum
    cek.durum = istek.yeni_durum
    if istek.ciro_edilen_cari_id is not None:
        cek.ciro_edilen_cari_id = istek.ciro_edilen_cari_id
        from datetime import date
        cek.ciro_tarihi = date.today()

    if istek.yeni_durum in para_hareketi_gereken_durumlar:
        # ALINAN cek tahsil edilince GIRIS, VERILEN cek odenince CIKIS.
        yon = "GIRIS" if cek.tip == CekTip.ALINAN else "CIKIS"
        para_hareketi_olustur(
            db, sirket_id, kullanici.id, yon, cek.tutar,
            istek.odeme_yontemi, istek.banka_hesap_id,
            aciklama=f"Çek {cek.cek_no or ('#' + str(cek.id))} - {istek.yeni_durum.value}",
            kaynak_tablo="CEKLER", kaynak_id=cek.id, cari_id=cek.cari_id,
        )

    db.add(CekGecmis(
        cek_id=cek.id, tarih=cek.ciro_tarihi or cek.alinma_verilme_tarihi,
        eski_durum=eski_durum, yeni_durum=istek.yeni_durum,
        aciklama=istek.aciklama, olusturan_kullanici_id=kullanici.id,
    ))
    db.commit()
    db.refresh(cek)
    return cek


@router.get("/cekler/{cek_id}/gecmis", response_model=list[CekGecmisYanit],
            dependencies=[Depends(izin_gerektir("CEK_GORUNTULE"))])
def cek_gecmisi(cek_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db)):
    cek = db.get(Cek, cek_id)
    if cek is None or cek.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Çek bulunamadı.")
    sorgu = select(CekGecmis).where(CekGecmis.cek_id == cek_id).order_by(CekGecmis.id)
