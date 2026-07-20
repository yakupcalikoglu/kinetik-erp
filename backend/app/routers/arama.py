from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, or_
from pydantic import BaseModel

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir
from app.models.cari import CariHesap
from app.models.stok import Siparis, StokSeriNo, StokKarti

router = APIRouter(prefix="/arama", tags=["Genel Arama"])


class AramaSonucu(BaseModel):
    tur: str  # "CARI" | "SIPARIS" | "STOK" | "URUN_TANIMI"
    id: int
    baslik: str
    alt_baslik: str | None = None
    yol: str  # frontend route - tiklaninca buraya gidilir


@router.get("", response_model=list[AramaSonucu])
def genel_arama(
    q: str,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Cari (unvan/vergi no), Siparis (siparis no), Stok (seri no/sasi no) ve
    Urun Tanimi (marka/model) uzerinde tek seferde arama yapar. Her
    kategoriden en fazla 8 sonuc doner (asiri uzun listeyi onlemek icin).
    """
    if not q or len(q.strip()) < 2:
        return []
    q_like = f"%{q.strip()}%"
    sonuclar: list[AramaSonucu] = []

    cariler = list(db.execute(
        select(CariHesap).where(
            CariHesap.sirket_id == sirket_id,
            or_(CariHesap.unvan.ilike(q_like), CariHesap.vergi_no.ilike(q_like)),
        ).limit(8)
    ).scalars())
    for c in cariler:
        sonuclar.append(AramaSonucu(tur="CARI", id=c.id, baslik=c.unvan, alt_baslik=c.vergi_no, yol="/cariler"))

    siparisler = list(db.execute(
        select(Siparis).where(Siparis.sirket_id == sirket_id, Siparis.siparis_no.ilike(q_like)).limit(8)
    ).scalars())
    for s in siparisler:
        durum = s.durum.value if hasattr(s.durum, "value") else s.durum
        sonuclar.append(AramaSonucu(tur="SIPARIS", id=s.id, baslik=s.siparis_no, alt_baslik=durum, yol="/siparisler"))

    urunler = list(db.execute(
        select(StokSeriNo).where(
            StokSeriNo.sirket_id == sirket_id,
            or_(StokSeriNo.seri_no.ilike(q_like), StokSeriNo.sasi_no.ilike(q_like)),
        ).limit(8)
    ).scalars())
    kart_haritasi = {}
    if urunler:
        kart_ids = list({u.stok_karti_id for u in urunler})
        kart_haritasi = {
            k.id: k for k in db.execute(select(StokKarti).where(StokKarti.id.in_(kart_ids))).scalars()
        }
    for u in urunler:
        kart = kart_haritasi.get(u.stok_karti_id)
        sonuclar.append(AramaSonucu(
            tur="STOK", id=u.id, baslik=u.seri_no,
            alt_baslik=f"{kart.marka} {kart.model}" if kart else None, yol="/stok",
        ))

    urun_tanimlari = list(db.execute(
        select(StokKarti).where(
            StokKarti.sirket_id == sirket_id,
            or_(StokKarti.marka.ilike(q_like), StokKarti.model.ilike(q_like)),
        ).limit(8)
    ).scalars())
    for k in urun_tanimlari:
        sonuclar.append(AramaSonucu(
            tur="URUN_TANIMI", id=k.id, baslik=f"{k.marka} {k.model}", alt_baslik=k.gtip_kodu, yol="/urun-tanimlari",
        ))

    return sonuclar
