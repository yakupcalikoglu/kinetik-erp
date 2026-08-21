"""
Genel amacli belge/dosya eki router'i - kaynak_tablo + kaynak_id ile
ILISKILI herhangi bir kayda (Siparis, Leasing, Kiralama, Cek, Tedarikci
Faturasi vb.) belge eklenip listelenip indirilebilir. Ayni Sirket.logo_verisi
mantigi: icerik DOGRUDAN veritabaninda (BYTEA) saklanir - Render'da /tmp
diski KALICI OLMADIGI icin.

Klasor destegi: ayni kaynak_tablo/kaynak_id altinda, kullanicinin KENDI
olusturdugu (orn. "Gümrük Evrakları") isimde alt gruplar - GERCEK bir dosya
sistemi degil, sadece belgeler.klasor_adi sutununa yazilan bir etiket.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.belge import Belge
from app.schemas.belge import BelgeYanit

router = APIRouter(prefix="/belgeler", tags=["Belgeler"])

# Cok buyuk dosyalarin veritabanini sisirmesini onlemek icin makul bir ust
# sinir - gumruk evraki/sozlesme taramasi gibi kullanim senaryolari icin
# 10 MB fazlasiyla yeterlidir.
MAKS_DOSYA_BOYUTU = 10 * 1024 * 1024


def _kullanici_adi_haritasi(db: Session, kullanici_idler: list[int]) -> dict[int, str]:
    if not kullanici_idler:
        return {}
    kullanicilar = db.execute(select(Kullanici).where(Kullanici.id.in_(kullanici_idler))).scalars()
    return {k.id: k.ad_soyad for k in kullanicilar}


@router.get("", response_model=list[BelgeYanit])
def belgeleri_listele(
    kaynak_tablo: str,
    kaynak_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Bu kaynaga (orn. bir Siparis ya da bir StokSeriNo/urun) ait TUM
    belgeleri, hangi klasorde olurlarsa olsunlar, tek listede doner.
    Klasor GRUPLAMASI frontend tarafinda (klasor_adi alanina gore) yapilir -
    boylece "hangi klasorler var" bilgisi de otomatik olarak buradan
    (mevcut belgelerin klasor_adi'lerinden) cikarilabilir, ayri bir
    "klasor olustur" kaydi TUTULMASINA gerek kalmaz.
    """
    belgeler = list(db.execute(
        select(Belge).where(
            Belge.sirket_id == sirket_id, Belge.kaynak_tablo == kaynak_tablo, Belge.kaynak_id == kaynak_id,
        ).order_by(Belge.yukleme_tarihi.desc())
    ).scalars())
    ad_haritasi = _kullanici_adi_haritasi(db, [b.yukleyen_kullanici_id for b in belgeler if b.yukleyen_kullanici_id])
    for b in belgeler:
        b.yukleyen_ad = ad_haritasi.get(b.yukleyen_kullanici_id)
    return belgeler


@router.post("", response_model=BelgeYanit)
async def belge_yukle(
    kaynak_tablo: str,
    kaynak_id: int,
    dosya: UploadFile = File(...),
    klasor_adi: str | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    icerik = await dosya.read()
    if len(icerik) > MAKS_DOSYA_BOYUTU:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dosya boyutu 10 MB'ı aşamaz.")
    # Bos string ("") gelirse "Genel" (klasorsuz) grup olarak degerlendir.
    temiz_klasor = (klasor_adi or "").strip() or None
    yeni = Belge(
        sirket_id=sirket_id, kaynak_tablo=kaynak_tablo, kaynak_id=kaynak_id, klasor_adi=temiz_klasor,
        dosya_adi=dosya.filename or "belge", icerik=icerik,
        content_type=dosya.content_type or "application/octet-stream",
        boyut_bayt=len(icerik), yukleyen_kullanici_id=kullanici.id,
    )
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    yeni.yukleyen_ad = kullanici.ad_soyad
    return yeni


@router.get("/{belge_id}/indir")
def belge_indir(
    belge_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    belge = db.get(Belge, belge_id)
    if belge is None or belge.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Belge bulunamadı.")
    return Response(
        content=belge.icerik, media_type=belge.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{belge.dosya_adi}"'},
    )


@router.delete("/{belge_id}")
def belge_sil(
    belge_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    belge = db.get(Belge, belge_id)
    if belge is None or belge.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Belge bulunamadı.")
    db.delete(belge)
    db.commit()
    return {"silindi": True}
