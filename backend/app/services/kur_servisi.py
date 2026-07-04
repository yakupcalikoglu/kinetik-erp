"""
Guncel doviz kuru servisi. Ucretsiz, API anahtari gerektirmeyen bir kur
servisinden (open.er-api.com) USD/EUR -> TRY kurunu ceker. Ayni gun icin
sonucu bellekte tutar (onbellek), boylece her form acildiginda tekrar
tekrar dis servise istek atilmaz. Servis erisilemezse None doner; bu
durumda kullanici kur alanini elle girer.
"""
import httpx
from decimal import Decimal, InvalidOperation
from datetime import date

_ONBELLEK: dict[tuple[date, str], Decimal] = {}


async def guncel_kur_getir(hedef_para_birimi: str) -> Decimal | None:
    hedef_para_birimi = hedef_para_birimi.upper()
    if hedef_para_birimi == "TRY":
        return Decimal("1")
    if hedef_para_birimi == "ALTIN":
        return None  # altin kuru bu servisten gelmiyor, elle girilir

    bugun = date.today()
    anahtar = (bugun, hedef_para_birimi)
    if anahtar in _ONBELLEK:
        return _ONBELLEK[anahtar]

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            yanit = await client.get(f"https://open.er-api.com/v6/latest/{hedef_para_birimi}")
            veri = yanit.json()
            kur = Decimal(str(veri["rates"]["TRY"]))
            _ONBELLEK[anahtar] = kur
            return kur
    except (httpx.HTTPError, KeyError, InvalidOperation, Exception):
        return None
