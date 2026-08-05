from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.models.auth import Sirket
from app.core.deps import aktif_kullanici_getir, izin_gerektir, aktif_sirket_id_getir
from app.schemas.auth import SirketOlusturIstegi, SirketOzet, SirketDetayYanit, SirketGuncelleIstegi

router = APIRouter(prefix="/sirketler", tags=["Şirketler"])


@router.get("", response_model=list[SirketOzet])
def sirketleri_listele(
    kullanici=Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """Kullanicinin erisebildigi tum sirketleri doner (sirket secim ekrani icin)."""
    from app.models.auth import KullaniciSirketErisim
    sorgu = (
        select(Sirket)
        .join(KullaniciSirketErisim, KullaniciSirketErisim.sirket_id == Sirket.id)
        .where(KullaniciSirketErisim.kullanici_id == kullanici.id)
    )
    return list(db.execute(sorgu).scalars())


@router.post("", response_model=SirketOzet, dependencies=[Depends(izin_gerektir("SIRKET_YONET"))])
def sirket_olustur(
    istek: SirketOlusturIstegi,
    kullanici=Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Yeni sirket olusturur VE olusturan kullaniciya bu sirkete erisim
    verir (KullaniciSirketErisim). Bu eksik olursa kullanici kendi
    olusturdugu sirketi sirket seciminde goremez - GET /sirketler
    bu tabloya join ederek calisir.
    """
    from app.models.auth import KullaniciSirketErisim
    yeni = Sirket(**istek.model_dump())
    db.add(yeni)
    db.flush()
    db.add(KullaniciSirketErisim(kullanici_id=kullanici.id, sirket_id=yeni.id))
    db.commit()
    db.refresh(yeni)
    return yeni


@router.get("/{sirket_id}", response_model=SirketDetayYanit,
            dependencies=[Depends(izin_gerektir("SIRKET_YONET"))])
def sirket_detay(sirket_id: int, db: Session = Depends(get_db)):
    sirket = db.get(Sirket, sirket_id)
    if sirket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Şirket bulunamadı.")
    return sirket


@router.put("/{sirket_id}", response_model=SirketDetayYanit,
            dependencies=[Depends(izin_gerektir("SIRKET_YONET"))])
def sirket_guncelle(sirket_id: int, istek: SirketGuncelleIstegi, db: Session = Depends(get_db)):
    sirket = db.get(Sirket, sirket_id)
    if sirket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Şirket bulunamadı.")
    for alan, deger in istek.model_dump(exclude_unset=True).items():
        setattr(sirket, alan, deger)
    db.commit()
    db.refresh(sirket)
    return sirket


@router.post("/{sirket_id}/logo", response_model=SirketDetayYanit,
             dependencies=[Depends(izin_gerektir("SIRKET_YONET"))])
async def logo_yukle(sirket_id: int, dosya: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Logo iceriğini DOGRUDAN VERITABANINDA saklar (logo_verisi, BYTEA).
    ONCEDEN dosya sunucunun /tmp diskine yaziliyordu - Render gibi
    platformlarda /tmp KALICI DEGIL, her deploy'da sifirlaniyor, bu da
    logonun her deploy sonrasi "kaybolmasina" yol aciyordu. Veritabaninda
    saklamak bu sorunu tamamen ortadan kaldirir.
    """
    sirket = db.get(Sirket, sirket_id)
    if sirket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Şirket bulunamadı.")
    icerik = await dosya.read()
    sirket.logo_verisi = icerik
    sirket.logo_content_type = dosya.content_type or "image/png"
    sirket.logo_dosya_yolu = None  # eski yontemden kalma alani temizle
    db.commit()
    db.refresh(sirket)
    return sirket


@router.get("/{sirket_id}/logo")
def logo_getir(sirket_id: int, db: Session = Depends(get_db)):
    sirket = db.get(Sirket, sirket_id)
    if sirket is None or not sirket.logo_verisi:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Logo bulunamadı.")
    return Response(content=sirket.logo_verisi, media_type=sirket.logo_content_type or "image/png")
