from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models.auth import Kullanici, KullaniciSirketErisim, Sirket
from app.core.security import sifre_dogrula, token_olustur
from app.core.deps import aktif_kullanici_getir
from app.schemas.auth import GirisIstegi, GirisYaniti, SirketDegistirIstegi

router = APIRouter(prefix="/auth", tags=["Kimlik Doğrulama"])


def _erisebildigi_sirketler(db: Session, kullanici_id: int) -> list[Sirket]:
    sorgu = (
        select(Sirket)
        .join(KullaniciSirketErisim, KullaniciSirketErisim.sirket_id == Sirket.id)
        .where(KullaniciSirketErisim.kullanici_id == kullanici_id, Sirket.aktif.is_(True))
    )
    return list(db.execute(sorgu).scalars())


@router.post("/login", response_model=GirisYaniti)
def giris_yap(istek: GirisIstegi, db: Session = Depends(get_db)):
    kullanici = db.execute(
        select(Kullanici).where(Kullanici.email == istek.email)
    ).scalar_one_or_none()

    if kullanici is None or not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-posta veya şifre hatalı.")
    if not kullanici.aktif:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Kullanıcı hesabı pasif.")

    sirketler = _erisebildigi_sirketler(db, kullanici.id)
    if not sirketler:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Hiçbir şirkete erişim yetkiniz yok.")

    token = token_olustur(kullanici.id, [s.id for s in sirketler])
    return GirisYaniti(token=token, kullanici=kullanici, erisebildigi_sirketler=sirketler)


@router.get("/me", response_model=GirisYaniti)
def benim_bilgilerim(
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    sirketler = _erisebildigi_sirketler(db, kullanici.id)
    # mevcut token'i tekrar uretmeye gerek yok, sadece bilgi donduruyoruz
    sahte_token = ""  # /auth/me token uretmez, sadece bilgi verir
    return GirisYaniti(token=sahte_token, kullanici=kullanici, erisebildigi_sirketler=sirketler)


@router.post("/sirket-degistir", response_model=GirisYaniti)
def sirket_degistir(
    istek: SirketDegistirIstegi,
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    sirketler = _erisebildigi_sirketler(db, kullanici.id)
    if istek.sirket_id not in [s.id for s in sirketler]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu şirkete erişim yetkiniz yok.")

    token = token_olustur(kullanici.id, [s.id for s in sirketler])
    return GirisYaniti(token=token, kullanici=kullanici, erisebildigi_sirketler=sirketler)
