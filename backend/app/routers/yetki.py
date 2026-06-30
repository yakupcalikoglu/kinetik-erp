from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir
from app.models.auth import Izin, Rol, rol_izinleri

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
