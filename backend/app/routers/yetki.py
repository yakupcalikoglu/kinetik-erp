from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir
from app.models.auth import (Izin, Rol, rol_izinleri, Kullanici,
                              KullaniciSirketErisim, KullaniciRolu)
from app.core.security import sifre_hashle

router = APIRouter(tags=["Yetki Yönetimi"])


class IzinYanit(BaseModel):
    id: int
    kod: str
    modul: str
    aciklama: str | None

    class Config:
        from_attributes = True


class RolYanit(BaseModel):
    id: int
    ad: str
    aciklama: str | None
    izin_kodlari: list[str]


class RolIzinGuncelleIstegi(BaseModel):
    izin_idleri: list[int]


@router.get("/izinler", response_model=list[IzinYanit])
def izinleri_listele(db: Session = Depends(get_db)):
    """Sistemdeki tum izin kodlarini doner (yonetici panelinin checkbox listesi icin)."""
    return list(db.execute(select(Izin)).scalars())


@router.get("/roller", response_model=list[RolYanit],
            dependencies=[Depends(izin_gerektir("KULLANICI_YONET"))])
def rolleri_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(Rol).where((Rol.sirket_id == sirket_id) | (Rol.sirket_id.is_(None)))
    sonuclar = []
    for rol in db.execute(sorgu).scalars():
        izin_kodlari = list(db.execute(
            select(Izin.kod)
            .join(rol_izinleri, rol_izinleri.c.izin_id == Izin.id)
            .where(rol_izinleri.c.rol_id == rol.id)
        ).scalars())
        sonuclar.append(RolYanit(id=rol.id, ad=rol.ad, aciklama=rol.aciklama, izin_kodlari=izin_kodlari))
    return sonuclar


@router.put("/roller/{rol_id}/izinler", response_model=RolYanit,
            dependencies=[Depends(izin_gerektir("KULLANICI_YONET"))])
def rol_izinlerini_guncelle(
    rol_id: int,
    istek: RolIzinGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Bir rolun sahip oldugu izin listesini tamamen yeniden yazar.
    Yonetici paneli ekraninda checkbox'lar isaretlenip 'kaydet' denince
    bu endpoint cagrilir.
    """
    rol = db.get(Rol, rol_id)
    if rol is None or (rol.sirket_id is not None and rol.sirket_id != sirket_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rol bulunamadı.")

    db.execute(rol_izinleri.delete().where(rol_izinleri.c.rol_id == rol_id))
    for izin_id in istek.izin_idleri:
        db.execute(rol_izinleri.insert().values(rol_id=rol_id, izin_id=izin_id))
    db.commit()

    izin_kodlari = list(db.execute(
        select(Izin.kod)
        .join(rol_izinleri, rol_izinleri.c.izin_id == Izin.id)
        .where(rol_izinleri.c.rol_id == rol_id)
    ).scalars())
    return RolYanit(id=rol.id, ad=rol.ad, aciklama=rol.aciklama, izin_kodlari=izin_kodlari)


# ============================================================== KULLANICI YÖNETİMİ
class KullaniciOlusturIstegi(BaseModel):
    ad_soyad: str
    email: EmailStr
    sifre: str
    rol_id: int | None = None


class KullaniciYanit(BaseModel):
    id: int
    ad_soyad: str
    email: EmailStr
    aktif: bool
    roller: list[str]

    class Config:
        from_attributes = True


class KullaniciRolGuncelleIstegi(BaseModel):
    rol_id: int


@router.get("/kullanicilar", response_model=list[KullaniciYanit],
            dependencies=[Depends(izin_gerektir("KULLANICI_YONET"))])
def kullanicilari_listele(
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = (
        select(Kullanici)
        .join(KullaniciSirketErisim, KullaniciSirketErisim.kullanici_id == Kullanici.id)
        .where(KullaniciSirketErisim.sirket_id == sirket_id)
    )
    sonuc = []
    for k in db.execute(sorgu).scalars():
        roller = list(db.execute(
            select(Rol.ad)
            .join(KullaniciRolu, KullaniciRolu.rol_id == Rol.id)
            .where(KullaniciRolu.kullanici_id == k.id, KullaniciRolu.sirket_id == sirket_id)
        ).scalars())
        sonuc.append(KullaniciYanit(id=k.id, ad_soyad=k.ad_soyad, email=k.email, aktif=k.aktif, roller=roller))
    return sonuc


@router.post("/kullanicilar", response_model=KullaniciYanit,
             dependencies=[Depends(izin_gerektir("KULLANICI_YONET"))])
def kullanici_olustur(
    istek: KullaniciOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    mevcut = db.execute(select(Kullanici).where(Kullanici.email == istek.email)).scalar_one_or_none()
    if mevcut is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu e-posta adresi zaten kayıtlı.")

    yeni = Kullanici(ad_soyad=istek.ad_soyad, email=istek.email, sifre_hash=sifre_hashle(istek.sifre))
    db.add(yeni)
    db.flush()

    db.add(KullaniciSirketErisim(kullanici_id=yeni.id, sirket_id=sirket_id))
    roller = []
    if istek.rol_id is not None:
        db.add(KullaniciRolu(kullanici_id=yeni.id, rol_id=istek.rol_id, sirket_id=sirket_id))
        rol = db.get(Rol, istek.rol_id)
        if rol:
            roller.append(rol.ad)

    db.commit()
    return KullaniciYanit(id=yeni.id, ad_soyad=yeni.ad_soyad, email=yeni.email, aktif=yeni.aktif, roller=roller)


@router.put("/kullanicilar/{kullanici_id}/rol", response_model=KullaniciYanit,
            dependencies=[Depends(izin_gerektir("KULLANICI_YONET"))])
def kullanici_rolu_guncelle(
    kullanici_id: int,
    istek: KullaniciRolGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    kullanici = db.get(Kullanici, kullanici_id)
    if kullanici is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kullanıcı bulunamadı.")

    db.execute(KullaniciRolu.__table__.delete().where(
        KullaniciRolu.kullanici_id == kullanici_id, KullaniciRolu.sirket_id == sirket_id
    ))
    db.add(KullaniciRolu(kullanici_id=kullanici_id, rol_id=istek.rol_id, sirket_id=sirket_id))
    db.commit()

    rol = db.get(Rol, istek.rol_id)
    return KullaniciYanit(id=kullanici.id, ad_soyad=kullanici.ad_soyad, email=kullanici.email,
                           aktif=kullanici.aktif, roller=[rol.ad] if rol else [])


class KullaniciDurumGuncelleIstegi(BaseModel):
    aktif: bool


class KullaniciSifreSifirlaIstegi(BaseModel):
    yeni_sifre: str


class RolOlusturIstegi(BaseModel):
    ad: str
    aciklama: str | None = None


@router.put("/kullanicilar/{kullanici_id}/durum", response_model=KullaniciYanit,
            dependencies=[Depends(izin_gerektir("KULLANICI_YONET"))])
def kullanici_durumunu_guncelle(
    kullanici_id: int,
    istek: KullaniciDurumGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Kullaniciyi aktif/pasif yapar (ornegin isten ayrilan bir calisanin erisimini kapatmak icin)."""
    kullanici = db.get(Kullanici, kullanici_id)
    if kullanici is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kullanıcı bulunamadı.")
    kullanici.aktif = istek.aktif
    db.commit()
    roller = list(db.execute(
        select(Rol.ad).join(KullaniciRolu, KullaniciRolu.rol_id == Rol.id)
        .where(KullaniciRolu.kullanici_id == kullanici_id, KullaniciRolu.sirket_id == sirket_id)
    ).scalars())
    return KullaniciYanit(id=kullanici.id, ad_soyad=kullanici.ad_soyad, email=kullanici.email,
                           aktif=kullanici.aktif, roller=roller)


@router.put("/kullanicilar/{kullanici_id}/sifre-sifirla",
            dependencies=[Depends(izin_gerektir("KULLANICI_YONET"))])
def kullanici_sifresini_sifirla(
    kullanici_id: int,
    istek: KullaniciSifreSifirlaIstegi,
    db: Session = Depends(get_db),
):
    """Yonetici, bir kullanicinin sifresini e-posta akisi olmadan dogrudan degistirir."""
    kullanici = db.get(Kullanici, kullanici_id)
    if kullanici is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kullanıcı bulunamadı.")
    if len(istek.yeni_sifre) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Şifre en az 6 karakter olmalıdır.")
    kullanici.sifre_hash = sifre_hashle(istek.yeni_sifre)
    db.commit()
    return {"guncellendi": True}


# ============================================================== ROL YÖNETİMİ
@router.post("/roller", response_model=RolYanit, dependencies=[Depends(izin_gerektir("KULLANICI_YONET"))])
def rol_olustur(
    istek: RolOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    yeni = Rol(sirket_id=sirket_id, ad=istek.ad, aciklama=istek.aciklama)
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return RolYanit(id=yeni.id, ad=yeni.ad, aciklama=yeni.aciklama, izin_kodlari=[])


@router.delete("/roller/{rol_id}", dependencies=[Depends(izin_gerektir("KULLANICI_YONET"))])
def rol_sil(
    rol_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """Sadece bu sirkete ait ozel roller silinebilir (sistem varsayilan rolleri sirket_id=None'dir, silinemez)."""
    rol = db.get(Rol, rol_id)
    if rol is None or rol.sirket_id != sirket_id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Rol bulunamadı ya da bu bir sistem varsayılan rolü olduğu için silinemez."
        )
    kullanim_var_mi = db.execute(select(KullaniciRolu).where(KullaniciRolu.rol_id == rol_id)).first()
    if kullanim_var_mi is not None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Bu role sahip kullanıcılar olduğu için silinemiyor. Önce onların rolünü değiştirin."
        )
    db.execute(rol_izinleri.delete().where(rol_izinleri.c.rol_id == rol_id))
    db.delete(rol)
    db.commit()
    return {"silindi": True}
