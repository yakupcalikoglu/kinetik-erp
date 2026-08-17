from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models.auth import Kullanici, KullaniciSirketErisim, Sirket, Izin, rol_izinleri, KullaniciRolu
from app.core.security import sifre_dogrula, token_olustur, sifre_hashle
from app.core.deps import aktif_kullanici_getir
from app.schemas.auth import (
    GirisIstegi, GirisYaniti, SirketDegistirIstegi,
    SifremiUnuttumIstegi, SifreSifirlaIstegi, SifreDegistirIstegi,
)
from app.services.eposta import sifre_sifirlama_epostasi_gonder
import secrets
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/auth", tags=["Kimlik Doğrulama"])


def _izin_kodlarini_getir(db: Session, kullanici_id: int, sirket_id: int) -> list[str]:
    """Bir kullanicinin BELIRLI bir sirketteki tum izin kodlarini doner (rolu uzerinden)."""
    sorgu = (
        select(Izin.kod)
        .join(rol_izinleri, rol_izinleri.c.izin_id == Izin.id)
        .join(KullaniciRolu, KullaniciRolu.rol_id == rol_izinleri.c.rol_id)
        .where(KullaniciRolu.kullanici_id == kullanici_id, KullaniciRolu.sirket_id == sirket_id)
    )
    return list(db.execute(sorgu).scalars())


def _erisebildigi_sirketler(db: Session, kullanici_id: int) -> list[Sirket]:
    sorgu = (
        select(Sirket)
        .join(KullaniciSirketErisim, KullaniciSirketErisim.sirket_id == Sirket.id)
        .where(KullaniciSirketErisim.kullanici_id == kullanici_id, Sirket.aktif.is_(True))
    )
    sirketler = list(db.execute(sorgu).scalars())
    # Her sirket icin, o sirkette bu kullanicinin sahip oldugu izin kodlarini
    # nesnenin uzerine ekliyoruz - SirketOzet semasi bunu izin_kodlari olarak okur.
    for s in sirketler:
        s.izin_kodlari = _izin_kodlarini_getir(db, kullanici_id, s.id)
    return sirketler


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


@router.put("/sifre-degistir")
def sifre_degistir(
    istek: SifreDegistirIstegi,
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """
    Oturum acmis bir kullanicinin KENDI sifresini degistirmesi icin -
    'sifremi unuttum' (email token'li) akisindan FARKLI: burada kullanici
    mevcut sifreyi zaten biliyor, sadece guncellemek istiyor. Guvenlik icin
    mevcut sifre once dogrulanir.
    """
    if not sifre_dogrula(istek.mevcut_sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Mevcut şifreniz yanlış.")
    if len(istek.yeni_sifre) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Yeni şifre en az 6 karakter olmalıdır.")

    kullanici.sifre_hash = sifre_hashle(istek.yeni_sifre)
    db.commit()
    return {"mesaj": "Şifreniz başarıyla güncellendi."}


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
