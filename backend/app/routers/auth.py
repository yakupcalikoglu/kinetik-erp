from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models.auth import Kullanici, KullaniciSirketErisim, Sirket
from app.core.security import sifre_dogrula, token_olustur, sifre_hashle
from app.core.deps import aktif_kullanici_getir
from app.schemas.auth import (
    GirisIstegi, GirisYaniti, SirketDegistirIstegi,
    SifremiUnuttumIstegi, SifreSifirlaIstegi,
)
from app.services.eposta import sifre_sifirlama_epostasi_gonder
import secrets
from datetime import datetime, timedelta, timezone

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


@router.post("/sifremi-unuttum")
def sifremi_unuttum(istek: SifremiUnuttumIstegi, db: Session = Depends(get_db)):
    kullanici = db.execute(
        select(Kullanici).where(Kullanici.email == istek.email)
    ).scalar_one_or_none()

    # Guvenlik: kullanici bulunamasa bile ayni mesaji donduruyoruz,
    # boylece kayitli e-postalar tahmin edilemez.
    if kullanici is not None:
        token = secrets.token_urlsafe(32)
        kullanici.sifre_sifirlama_token = token
        kullanici.sifre_sifirlama_son_gecerlilik = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()
        sifre_sifirlama_epostasi_gonder(kullanici.email, token)

    return {"mesaj": "Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi."}


@router.post("/sifre-sifirla")
def sifre_sifirla(istek: SifreSifirlaIstegi, db: Session = Depends(get_db)):
    kullanici = db.execute(
        select(Kullanici).where(Kullanici.sifre_sifirlama_token == istek.token)
    ).scalar_one_or_none()

    if kullanici is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Geçersiz veya süresi dolmuş bağlantı.")

    son_gecerlilik = kullanici.sifre_sifirlama_son_gecerlilik
    if son_gecerlilik is not None and son_gecerlilik.tzinfo is None:
        son_gecerlilik = son_gecerlilik.replace(tzinfo=timezone.utc)

    if son_gecerlilik is None or son_gecerlilik < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Geçersiz veya süresi dolmuş bağlantı.")

    kullanici.sifre_hash = sifre_hashle(istek.yeni_sifre)
    kullanici.sifre_sifirlama_token = None
    kullanici.sifre_sifirlama_son_gecerlilik = None
    db.commit()

    return {"mesaj": "Şifreniz başarıyla güncellendi."}
