"""
FastAPI dependency'leri:
- aktif kullaniciyi token'dan cikarir
- X-Sirket-Id header'ini token'daki yetkili sirket listesiyle dogrular
- izin kontrolu yapar (rol -> izinler tablosu uzerinden)

Bu dosya, sistemin coklu sirket guvenlik mantiginin merkezidir:
hicbir endpoint sirket_id'yi body'den almaz, sadece bu dependency'den gelen
deger kullanilir.
"""
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import token_dogrula
from app.models.auth import Kullanici, KullaniciRolu, rol_izinleri, Izin


def aktif_kullanici_getir(
    authorization: str = Header(..., alias="Authorization"),
    db: Session = Depends(get_db),
) -> Kullanici:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Geçersiz yetkilendirme başlığı.")

    token = authorization.removeprefix("Bearer ").strip()
    payload = token_dogrula(token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token geçersiz veya süresi dolmuş.")

    kullanici = db.get(Kullanici, int(payload["sub"]))
    if kullanici is None or not kullanici.aktif:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Kullanıcı bulunamadı veya pasif.")

    # token icindeki yetkili sirket listesini request state'ine tasimak icin
    kullanici._token_sirketleri = payload.get("sirketler", [])
    return kullanici


def aktif_sirket_id_getir(
    x_sirket_id: int = Header(..., alias="X-Sirket-Id"),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
) -> int:
    yetkili_sirketler = getattr(kullanici, "_token_sirketleri", [])
    if x_sirket_id not in yetkili_sirketler:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Bu şirkete erişim yetkiniz yok."
        )
    return x_sirket_id


def izin_gerektir(izin_kodu: str):
    """
    Endpoint'lerde Depends(izin_gerektir('STOK_DUZENLE')) seklinde kullanilir.
    Kullanicinin aktif sirkette bu izni veren bir rolu var mi kontrol eder.
    """
    def dependency(
        kullanici: Kullanici = Depends(aktif_kullanici_getir),
        sirket_id: int = Depends(aktif_sirket_id_getir),
        db: Session = Depends(get_db),
    ):
        sorgu = (
            select(Izin.kod)
            .join(rol_izinleri, rol_izinleri.c.izin_id == Izin.id)
            .join(KullaniciRolu, KullaniciRolu.rol_id == rol_izinleri.c.rol_id)
            .where(
                KullaniciRolu.kullanici_id == kullanici.id,
                KullaniciRolu.sirket_id == sirket_id,
                Izin.kod == izin_kodu,
            )
        )
        sonuc = db.execute(sorgu).first()
        if sonuc is None:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Bu işlem için '{izin_kodu}' iznine sahip değilsiniz."
            )
        return True

    return dependency
