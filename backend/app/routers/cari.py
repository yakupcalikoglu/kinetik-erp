import json
from sqlalchemy.exc import IntegrityError
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case
from datetime import date

from app.db.session import get_db
from app.core.deps import aktif_sirket_id_getir, izin_gerektir, aktif_kullanici_getir
from app.models.auth import Kullanici
from app.models.cari import CariHesap, CariHareket
from app.db.soft_delete import yumusak_sil, yumusak_geri_getir, aktif_filtre
from app.models.denetim import DuzenlemeKaydi
from app.core.security import sifre_dogrula
from app.schemas.cari import (
    VergiNoSorguIstegi, VergiNoSorguYaniti, CariOlusturIstegi,
    CariGuncelleIstegi, CariYanit, CariHareketYanit, CariBakiyeYanit,
    CariTopluIceAktarIstegi, CariTopluIceAktarSonucu, CariOzetYaniti, CariOzetKalemi,
    CariHareketSatiri, TedarikciOzetiYaniti, TedarikciSonSiparisSatiri,
    MusteriOzetiYaniti, MusteriSonSatisSatiri,
)
from app.services import uyumsoft_mock

router = APIRouter(prefix="/cariler", tags=["Cari"])


def _degisiklikleri_kaydet(db: Session, sirket_id: int, kullanici_id: int, tablo_adi: str, kayit_id: int, degisiklikler: dict) -> None:
    if not degisiklikler:
        return
    db.add(DuzenlemeKaydi(
        sirket_id=sirket_id, kullanici_id=kullanici_id, tablo_adi=tablo_adi,
        kayit_id=kayit_id, degisiklikler=json.dumps(degisiklikler, ensure_ascii=False, default=str),
    ))


@router.post("/vergi-no-sorgula", response_model=VergiNoSorguYaniti,
             dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def vergi_no_sorgula(istek: VergiNoSorguIstegi):
    """
    Mukellef sorgu servisini cagirir. Cari kaydi BU asamada olusturulmaz;
    kullanici donen bilgileri onayladiktan sonra POST /cariler cagrilir.
    """
    sonuc = uyumsoft_mock.sorgula(istek.vergi_no)
    return VergiNoSorguYaniti(**sonuc)


@router.get("", response_model=list[CariYanit],
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
def carileri_listele(
    tip: str | None = None,
    arama: str | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    sorgu = select(CariHesap).where(CariHesap.sirket_id == sirket_id, aktif_filtre(CariHesap))
    if tip:
        sorgu = sorgu.where(CariHesap.tip == tip)
    if arama:
        sorgu = sorgu.where(CariHesap.unvan.ilike(f"%{arama}%"))
    return list(db.execute(sorgu).scalars())


@router.post("", response_model=CariYanit,
             dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def cari_olustur(
    istek: CariOlusturIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    yeni = CariHesap(sirket_id=sirket_id, **istek.model_dump())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni


@router.post("/toplu-ice-aktar", response_model=CariTopluIceAktarSonucu,
             dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def cari_toplu_ice_aktar(
    istek: CariTopluIceAktarIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Excel'den (orn. Akinsoft Wolvox gibi baska bir sistemden aktarilan)
    cari listesini toplu olarak ekler. Her satir AYRI AYRI commit edilir -
    boylece bir satirda hata olsa bile diger satirlar etkilenmez, sadece
    hatali olanlar 'hatali_satirlar' listesinde geri bildirilir.
    """
    basarili = 0
    hatalar = []
    gecerli_tipler = {"MUSTERI", "TEDARIKCI", "PERSONEL", "ORTAK", "DIGER"}

    for i, satir in enumerate(istek.satirlar, start=1):
        try:
            if not satir.unvan or not satir.unvan.strip():
                raise ValueError("Unvan boş olamaz.")
            tip = (satir.tip or "DIGER").strip().upper()
            if tip not in gecerli_tipler:
                tip = "DIGER"
            yeni = CariHesap(
                sirket_id=sirket_id, tip=tip, unvan=satir.unvan.strip(),
                vergi_no=satir.vergi_no, vergi_dairesi=satir.vergi_dairesi,
                adres=satir.adres, telefon=satir.telefon, email=satir.email,
                otomatik_dolduruldu=False,
            )
            db.add(yeni)
            db.commit()
            basarili += 1
        except Exception as e:
            db.rollback()
            hatalar.append({"satir_no": i, "unvan": satir.unvan, "hata": str(e)})

    return CariTopluIceAktarSonucu(basarili_sayisi=basarili, hatali_satirlar=hatalar)


@router.get("/ozet-listesi", dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
async def tum_carilerin_ozeti(
    sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Ana Cariler listesindeki Bakiye sutunu icin, TUM carilerin net
    alacak/borc TL karsiligini TEK seferde (cari basina ayri sorgu
    ATMADAN) hesaplar - /{cari_id}/ozet ile ayni mantik, ama N+1 sorgu
    yerine her kategori icin BIR sorgu atip Python'da cari_id'ye gore
    gruplar. Doner: { cari_id: net_try }.
    """
    from decimal import Decimal as _Decimal
    from app.models.stok import Siparis, SiparisDetay, SiparisOdeme
    from app.models.finansal import (
        TaksitliSatisPlani, TaksitDetay, KiralamaSozlesme, KiralamaOdeme, Cek, CekDurum, CekTip,
        LeasingSozlesme, LeasingOdeme,
    )
    from app.models.diger import Borc, BorcOdeme, BorcTip
    from app.models.akreditif import Akreditif, AkreditifKalemi, AkreditifDurum
    from app.models.akreditif_taksit import AkreditifKalemTaksiti
    from app.services.kur_servisi import guncel_kur_getir

    kur_cache: dict[str, _Decimal] = {"TRY": _Decimal("1")}

    async def kur_getir(pb: str) -> _Decimal:
        if pb not in kur_cache:
            k = await guncel_kur_getir(pb)
            kur_cache[pb] = _Decimal(str(k)) if k else _Decimal("0")
        return kur_cache[pb]

    net: dict[int, _Decimal] = {}

    def ekle(cari_id, tutar):
        if cari_id is None:
            return
        net[cari_id] = net.get(cari_id, _Decimal("0")) + tutar

    # Taksit alacagi
    for cari_id, tutar in db.execute(
        select(TaksitliSatisPlani.musteri_cari_id, TaksitDetay.tutar)
        .join(TaksitDetay, TaksitDetay.plan_id == TaksitliSatisPlani.id)
        .where(TaksitliSatisPlani.sirket_id == sirket_id, TaksitDetay.odendi_mi.is_(False))
    ).all():
        ekle(cari_id, tutar)

    # Kredi karti (POS) bekleyen alacagi - henuz bankaya yatmamis taksitler
    from app.models.finansal import PosTaksitPlani, PosTaksitDetay
    for cari_id, tutar in db.execute(
        select(PosTaksitPlani.musteri_cari_id, PosTaksitDetay.tutar)
        .join(PosTaksitDetay, PosTaksitDetay.plan_id == PosTaksitPlani.id)
        .where(PosTaksitPlani.sirket_id == sirket_id, PosTaksitDetay.yatti_mi.is_(False))
    ).all():
        ekle(cari_id, tutar)

    # Kira alacagi
    kira_sozlesmeler = {
        s.id: s for s in db.execute(select(KiralamaSozlesme).where(KiralamaSozlesme.sirket_id == sirket_id)).scalars()
    }
    if kira_sozlesmeler:
        for o in db.execute(select(KiralamaOdeme).where(KiralamaOdeme.sozlesme_id.in_(list(kira_sozlesmeler.keys())), KiralamaOdeme.odendi_mi.is_(False))).scalars():
            s = kira_sozlesmeler.get(o.sozlesme_id)
            if not s:
                continue
            pb = s.para_birimi.value if hasattr(s.para_birimi, "value") else s.para_birimi
            kur = await kur_getir(pb)
            ekle(s.kiraci_cari_id, o.tutar * kur)

    # Leasing borcu (leasing firmasina, odenmemis taksitler)
    leasing_sozlesmeler = {
        s.id: s for s in db.execute(select(LeasingSozlesme).where(LeasingSozlesme.sirket_id == sirket_id)).scalars()
    }
    if leasing_sozlesmeler:
        for o in db.execute(select(LeasingOdeme).where(LeasingOdeme.leasing_id.in_(list(leasing_sozlesmeler.keys())), LeasingOdeme.odendi_mi.is_(False))).scalars():
            s = leasing_sozlesmeler.get(o.leasing_id)
            if not s:
                continue
            pb = s.para_birimi.value if hasattr(s.para_birimi, "value") else s.para_birimi
            kur = await kur_getir(pb)
            ekle(s.leasing_firmasi_cari_id, -(o.tutar * kur))

    # Siparis borcu + Akreditif dususu
    siparisler = list(db.execute(
        select(Siparis).where(Siparis.sirket_id == sirket_id, Siparis.durum.notin_(["TASLAK", "IPTAL"]))
    ).scalars())
    akreditif_borc_per_cari: dict[int, _Decimal] = {}
    for s in siparisler:
        urunler = list(db.execute(select(SiparisDetay).where(SiparisDetay.siparis_id == s.id)).scalars())
        toplam_tutar = sum((u.miktar * u.birim_fiyat for u in urunler), _Decimal("0"))
        odenen = db.execute(select(func.coalesce(func.sum(SiparisOdeme.tutar), 0)).where(SiparisOdeme.siparis_id == s.id)).scalar_one()
        pb = s.para_birimi if isinstance(s.para_birimi, str) else s.para_birimi.value
        kur = await kur_getir(pb)
        kalan_try = (toplam_tutar - odenen) * kur

        akreditifler = list(db.execute(
            select(Akreditif).where(Akreditif.siparis_id == s.id, Akreditif.sirket_id == sirket_id, Akreditif.durum != AkreditifDurum.IPTAL)
        ).scalars())
        for ak in akreditifler:
            ak_pb = ak.para_birimi if isinstance(ak.para_birimi, str) else ak.para_birimi.value
            ak_kur = await kur_getir(ak_pb)
            kalan_try -= ak.tutar * ak_kur

            kalemler = list(db.execute(select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == ak.id)).scalars())
            odenen_toplam = _Decimal("0")
            for k in kalemler:
                if k.odendi_mi:
                    odenen_toplam += k.tutar
                    continue
                taksitler_ak = list(db.execute(select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id == k.id)).scalars())
                odenen_toplam += sum((t.tutar for t in taksitler_ak if t.odendi_mi), _Decimal("0"))
            kalan_ak = ak.tutar - odenen_toplam
            if kalan_ak > 0:
                akreditif_borc_per_cari[s.tedarikci_cari_id] = akreditif_borc_per_cari.get(s.tedarikci_cari_id, _Decimal("0")) + kalan_ak * ak_kur

        if kalan_try > 0:
            ekle(s.tedarikci_cari_id, -kalan_try)

    for cari_id, tutar in akreditif_borc_per_cari.items():
        ekle(cari_id, -tutar)

    # Cekler
    for c in db.execute(select(Cek).where(Cek.sirket_id == sirket_id, Cek.durum == CekDurum.PORTFOYDE)).scalars():
        pb = c.para_birimi.value if hasattr(c.para_birimi, "value") else c.para_birimi
        kur = await kur_getir(pb)
        isaret = 1 if c.tip == CekTip.ALINAN else -1
        ekle(c.cari_id, isaret * c.tutar * kur)

    # Ortak/Dis Borc
    for b in db.execute(select(Borc).where(Borc.sirket_id == sirket_id)).scalars():
        odenen = db.execute(select(func.coalesce(func.sum(BorcOdeme.tutar), 0)).where(BorcOdeme.borc_id == b.id)).scalar_one()
        kalan = b.tutar - odenen
        if kalan <= 0:
            continue
        pb = b.para_birimi.value if hasattr(b.para_birimi, "value") else b.para_birimi
        kur = await kur_getir(pb)
        isaret = 1 if b.tip == BorcTip.ORTAGA_VERILEN else -1
        ekle(b.cari_id, isaret * kalan * kur)

    return {str(k): v for k, v in net.items()}




@router.get("/{cari_id}", response_model=CariYanit,
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
def cari_getir(
    cari_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")
    return cari


@router.put("/{cari_id}", response_model=CariYanit,
            dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def cari_guncelle(
    cari_id: int,
    istek: CariGuncelleIstegi,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    kullanici: Kullanici = Depends(aktif_kullanici_getir),
    db: Session = Depends(get_db),
):
    """Bir cari kaydini duzenler. Sifre onayi zorunludur; degisiklikler denetim_kayitlari'na islenir."""
    if not sifre_dogrula(istek.sifre, kullanici.sifre_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Şifre yanlış, düzenleme yapılamadı.")

    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")

    alan_adlari = {
        "unvan": "Unvan", "vergi_no": "Vergi No", "vergi_dairesi": "Vergi Dairesi",
        "adres": "Adres", "telefon": "Telefon", "email": "E-posta", "aktif": "Aktif",
    }
    degisiklikler = {}
    guncellenecekler = istek.model_dump(exclude_unset=True, exclude={"sifre"})
    for alan, yeni in guncellenecekler.items():
        eski = getattr(cari, alan)
        if str(eski) != str(yeni):
            degisiklikler[alan_adlari.get(alan, alan)] = {"eski": eski, "yeni": yeni}
        setattr(cari, alan, yeni)

    _degisiklikleri_kaydet(db, sirket_id, kullanici.id, "cari_hesaplar", cari.id, degisiklikler)

    db.commit()
    db.refresh(cari)
    return cari


@router.get("/{cari_id}/hareketler", response_model=list[CariHareketYanit],
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
def cari_hareketleri(
    cari_id: int,
    baslangic: date | None = None,
    bitis: date | None = None,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")

    sorgu = select(CariHareket).where(
        CariHareket.cari_id == cari_id,
        CariHareket.sirket_id == sirket_id,
    )
    if baslangic:
        sorgu = sorgu.where(CariHareket.tarih >= baslangic)
    if bitis:
        sorgu = sorgu.where(CariHareket.tarih <= bitis)
    sorgu = sorgu.order_by(CariHareket.tarih.desc())
    return list(db.execute(sorgu).scalars())


@router.get("/{cari_id}/bakiye", response_model=list[CariBakiyeYanit],
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
def cari_bakiye(
    cari_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")

    giris_ifadesi = func.sum(case((CariHareket.yon == "GIRIS", CariHareket.tutar), else_=0))
    cikis_ifadesi = func.sum(case((CariHareket.yon == "CIKIS", CariHareket.tutar), else_=0))

    sorgu = (
        select(
            CariHareket.para_birimi,
            giris_ifadesi.label("toplam_giris"),
            cikis_ifadesi.label("toplam_cikis"),
        )
        .where(CariHareket.cari_id == cari_id, CariHareket.sirket_id == sirket_id)
        .group_by(CariHareket.para_birimi)
    )
    sonuclar = db.execute(sorgu).all()
    return [
        CariBakiyeYanit(
            para_birimi=r.para_birimi,
            toplam_giris=r.toplam_giris or 0,
            toplam_cikis=r.toplam_cikis or 0,
            net_bakiye=(r.toplam_giris or 0) - (r.toplam_cikis or 0),
        )
        for r in sonuclar]


@router.delete("/{cari_id}",
               dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def cari_sil(
    cari_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    """
    Cariyi GERCEKTEN silmez - "silindi" olarak isaretler (soft-delete).
    Boylece iliskili kayitlarda (siparis, cek, hareket vb.) FK ihlali
    olusmaz ve yanlislikla silinen bir cari HER ZAMAN geri getirilebilir.
    """
    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")

    yumusak_sil(db, cari)
    return {"silindi": True}


@router.put("/{cari_id}/geri-getir", response_model=CariYanit,
            dependencies=[Depends(izin_gerektir("CARI_DUZENLE"))])
def cari_geri_getir(
    cari_id: int,
    sirket_id: int = Depends(aktif_sirket_id_getir),
    db: Session = Depends(get_db),
):
    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari kayıt bulunamadı.")
    yumusak_geri_getir(db, cari)
    return cari


@router.get("/{cari_id}/ozet", response_model=CariOzetYaniti,
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
async def cari_ozet(
    cari_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Bu carinin GERCEK alacak/borc durumunu, ilgili TUM modulleri (Taksitli
    Satis, Kiralama, Siparis, Akreditif, Cek, Ortak/Dis Borc) bu cari_id'ye
    gore filtreleyerek hesaplar. CariHesap.bakiye_try/CariHareket
    alanlarina GUVENILMEZ (bunlar sistemde genel olarak doldurulmuyor) -
    bunun yerine /raporlar/net-durum'daki AYNI mantik, TEK bir cari icin
    calistirilir.
    """
    from datetime import date as _date
    from decimal import Decimal as _Decimal
    from app.models.stok import Siparis, SiparisDetay, SiparisOdeme
    from app.models.finansal import (
        TaksitliSatisPlani, TaksitDetay, KiralamaSozlesme, KiralamaOdeme,
        Cek, CekDurum, CekTip, LeasingSozlesme, LeasingOdeme,
    )
    from app.models.diger import Borc, BorcOdeme, BorcTip
    from app.models.akreditif import Akreditif, AkreditifKalemi, AkreditifDurum
    from app.models.akreditif_taksit import AkreditifKalemTaksiti
    from app.services.kur_servisi import guncel_kur_getir

    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari bulunamadı.")

    kur_cache: dict[str, _Decimal] = {}

    async def kur_getir(pb: str) -> _Decimal:
        if pb == "TRY":
            return _Decimal("1")
        if pb not in kur_cache:
            k = await guncel_kur_getir(pb)
            kur_cache[pb] = _Decimal(str(k)) if k else _Decimal("0")
        return kur_cache[pb]

    # 1) Taksitli satis alacagi (bu cari MUSTERI ise)
    taksit_alacak_try = _Decimal("0")
    taksitler = list(db.execute(
        select(TaksitDetay)
        .join(TaksitliSatisPlani, TaksitliSatisPlani.id == TaksitDetay.plan_id)
        .where(TaksitliSatisPlani.sirket_id == sirket_id, TaksitliSatisPlani.musteri_cari_id == cari_id,
               TaksitDetay.odendi_mi.is_(False))
    ).scalars())
    taksit_alacak_try = sum((t.tutar for t in taksitler), _Decimal("0"))

    # 1b) Kredi karti (POS) bekleyen alacagi (bu cari MUSTERI ise) - henuz
    # bankaya yatmamis taksitler, satis aninda ZATEN Stok'tan dustugu icin
    # bu kalem eklenmezse tutar hicbir yerde gorunmeden kaybolurdu.
    from app.models.finansal import PosTaksitPlani, PosTaksitDetay
    pos_taksit_alacak_try = _Decimal("0")
    pos_taksitler = list(db.execute(
        select(PosTaksitDetay)
        .join(PosTaksitPlani, PosTaksitPlani.id == PosTaksitDetay.plan_id)
        .where(PosTaksitPlani.sirket_id == sirket_id, PosTaksitPlani.musteri_cari_id == cari_id,
               PosTaksitDetay.yatti_mi.is_(False))
    ).scalars())
    pos_taksit_alacak_try = sum((t.tutar for t in pos_taksitler), _Decimal("0"))

    # 2) Kiralama tahsilat alacagi (bu cari KIRACI ise)
    kira_alacak_try = _Decimal("0")
    kira_sozlesmeler = {
        s.id: s for s in db.execute(
            select(KiralamaSozlesme).where(KiralamaSozlesme.sirket_id == sirket_id, KiralamaSozlesme.kiraci_cari_id == cari_id)
        ).scalars()
    }
    if kira_sozlesmeler:
        odemeler = list(db.execute(
            select(KiralamaOdeme).where(KiralamaOdeme.sozlesme_id.in_(list(kira_sozlesmeler.keys())), KiralamaOdeme.odendi_mi.is_(False))
        ).scalars())
        for o in odemeler:
            sozlesme = kira_sozlesmeler.get(o.sozlesme_id)
            pb = sozlesme.para_birimi.value if sozlesme and hasattr(sozlesme.para_birimi, "value") else "TRY"
            kur = await kur_getir(pb)
            kira_alacak_try += o.tutar * kur

    # 2b) Leasing borcu (bu cari LEASING FIRMASI ise)
    leasing_borc_try = _Decimal("0")
    leasing_sozlesmeler_bu_cari = {
        s.id: s for s in db.execute(
            select(LeasingSozlesme).where(LeasingSozlesme.sirket_id == sirket_id, LeasingSozlesme.leasing_firmasi_cari_id == cari_id)
        ).scalars()
    }
    if leasing_sozlesmeler_bu_cari:
        leasing_odemeler = list(db.execute(
            select(LeasingOdeme).where(LeasingOdeme.leasing_id.in_(list(leasing_sozlesmeler_bu_cari.keys())), LeasingOdeme.odendi_mi.is_(False))
        ).scalars())
        for o in leasing_odemeler:
            sozlesme = leasing_sozlesmeler_bu_cari.get(o.leasing_id)
            pb = sozlesme.para_birimi.value if sozlesme and hasattr(sozlesme.para_birimi, "value") else "TRY"
            kur = await kur_getir(pb)
            leasing_borc_try += o.tutar * kur

    # 3) Tedarikciye olan siparis borcu (bu cari TEDARIKCI ise)
    siparis_borc_try = _Decimal("0")
    siparisler = list(db.execute(
        select(Siparis).where(Siparis.sirket_id == sirket_id, Siparis.tedarikci_cari_id == cari_id, Siparis.durum.notin_(["TASLAK", "IPTAL"]))
    ).scalars())
    acik_akreditifler_bu_cari = []
    for s in siparisler:
        urunler = list(db.execute(select(SiparisDetay).where(SiparisDetay.siparis_id == s.id)).scalars())
        toplam_tutar = sum((u.miktar * u.birim_fiyat for u in urunler), _Decimal("0"))
        odenen = db.execute(select(func.coalesce(func.sum(SiparisOdeme.tutar), 0)).where(SiparisOdeme.siparis_id == s.id)).scalar_one()
        pb = s.para_birimi if isinstance(s.para_birimi, str) else s.para_birimi.value
        kur = await kur_getir(pb)
        kalan_try = (toplam_tutar - odenen) * kur

        akreditifler = list(db.execute(
            select(Akreditif).where(Akreditif.siparis_id == s.id, Akreditif.sirket_id == sirket_id, Akreditif.durum != AkreditifDurum.IPTAL)
        ).scalars())
        for ak in akreditifler:
            acik_akreditifler_bu_cari.append(ak)
            ak_pb = ak.para_birimi if isinstance(ak.para_birimi, str) else ak.para_birimi.value
            ak_kur = await kur_getir(ak_pb)
            kalan_try -= ak.tutar * ak_kur

        if kalan_try > 0:
            siparis_borc_try += kalan_try

    # 4) Akreditif (ayni sipariste zaten dusuldu, burada ayrica ekliyoruz)
    akreditif_borc_try = _Decimal("0")
    for ak in acik_akreditifler_bu_cari:
        kalemler = list(db.execute(select(AkreditifKalemi).where(AkreditifKalemi.akreditif_id == ak.id)).scalars())
        pb = ak.para_birimi if isinstance(ak.para_birimi, str) else ak.para_birimi.value
        kur = await kur_getir(pb)
        odenen_toplam = _Decimal("0")
        for k in kalemler:
            if k.odendi_mi:
                odenen_toplam += k.tutar
                continue
            taksitler_ak = list(db.execute(select(AkreditifKalemTaksiti).where(AkreditifKalemTaksiti.kalem_id == k.id)).scalars())
            odenen_toplam += sum((t.tutar for t in taksitler_ak if t.odendi_mi), _Decimal("0"))
        kalan = ak.tutar - odenen_toplam
        if kalan > 0:
            akreditif_borc_try += kalan * kur

    # 5) Cekler (bu cariye ait, portfoyde)
    cek_alacak_try = _Decimal("0")
    cek_borc_try = _Decimal("0")
    cekler = list(db.execute(
        select(Cek).where(Cek.sirket_id == sirket_id, Cek.cari_id == cari_id, Cek.durum == CekDurum.PORTFOYDE)
    ).scalars())
    for c in cekler:
        pb = c.para_birimi.value if hasattr(c.para_birimi, "value") else c.para_birimi
        kur = await kur_getir(pb)
        if c.tip == CekTip.ALINAN:
            cek_alacak_try += c.tutar * kur
        else:
            cek_borc_try += c.tutar * kur

    # 6) Ortak/Dis Borc (bu cari ile iliskili)
    ortak_alacak_try = _Decimal("0")
    ortak_borc_try = _Decimal("0")
    borclar = list(db.execute(select(Borc).where(Borc.sirket_id == sirket_id, Borc.cari_id == cari_id)).scalars())
    for b in borclar:
        odenen = db.execute(select(func.coalesce(func.sum(BorcOdeme.tutar), 0)).where(BorcOdeme.borc_id == b.id)).scalar_one()
        kalan = b.tutar - odenen
        if kalan <= 0:
            continue
        pb = b.para_birimi.value if hasattr(b.para_birimi, "value") else b.para_birimi
        kur = await kur_getir(pb)
        kalan_try = kalan * kur
        if b.tip == BorcTip.ORTAGA_VERILEN:
            ortak_alacak_try += kalan_try
        else:
            ortak_borc_try += kalan_try

    alacaklar = [
        CariOzetKalemi(kategori="Taksitli Satış Alacağı", tutar_try=taksit_alacak_try),
        CariOzetKalemi(kategori="Kredi Kartı (POS) Bekleyen Alacağı", tutar_try=pos_taksit_alacak_try),
        CariOzetKalemi(kategori="Kiralama Tahsilat Alacağı", tutar_try=kira_alacak_try),
        CariOzetKalemi(kategori="Alınan Çekler (Portföyde)", tutar_try=cek_alacak_try),
        CariOzetKalemi(kategori="Ortağa Verilen Borç (Alacak)", tutar_try=ortak_alacak_try),
    ]
    borclar_listesi = [
        CariOzetKalemi(kategori="Tedarikçiye Olan Borç (Sipariş)", tutar_try=siparis_borc_try),
        CariOzetKalemi(kategori="Akreditif (Ödenmemiş)", tutar_try=akreditif_borc_try),
        CariOzetKalemi(kategori="Leasing (Ödenmemiş Taksitler)", tutar_try=leasing_borc_try),
        CariOzetKalemi(kategori="Verilen Çekler (Portföyde)", tutar_try=cek_borc_try),
        CariOzetKalemi(kategori="Ortaktan/Dışarıdan Alınan Borç", tutar_try=ortak_borc_try),
    ]

    toplam_alacak = sum((a.tutar_try for a in alacaklar), _Decimal("0"))
    toplam_borc = sum((b.tutar_try for b in borclar_listesi), _Decimal("0"))

    return CariOzetYaniti(
        cari_id=cari.id, unvan=cari.unvan, alacaklar=alacaklar, borclar=borclar_listesi,
        toplam_alacak_try=toplam_alacak, toplam_borc_try=toplam_borc,
        net_try=toplam_alacak - toplam_borc,
    )


@router.get("/{cari_id}/tum-hareketler", response_model=list[CariHareketSatiri],
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
def cari_tum_hareketler(
    cari_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Bu carinin GERCEK GECMISINI (satis, kiralama, bakim, taksitli satis,
    cek, siparis) TEK bir kronolojik listede toplar. Cari detay panelinde
    "bu musteriyle simdiye kadar ne is yaptik" sorusuna cevap verir.
    """
    from app.models.stok import StokSeriNo, StokKarti, Siparis
    from app.models.finansal import (
        TaksitliSatisPlani, KiralamaSozlesme, Cek, CekTip, BakimKaydi, BakimTip, LeasingSozlesme,
        PosTaksitPlani,
    )

    satirlar: list[CariHareketSatiri] = []

    # 0) Leasing sozlesmeleri (bu cari LEASING FIRMASI ise)
    leasing_sozlesmeler = list(db.execute(
        select(LeasingSozlesme).where(LeasingSozlesme.sirket_id == sirket_id, LeasingSozlesme.leasing_firmasi_cari_id == cari_id)
    ).scalars())
    for ls in leasing_sozlesmeler:
        pb = ls.para_birimi.value if hasattr(ls.para_birimi, "value") else ls.para_birimi
        satirlar.append(CariHareketSatiri(
            tarih=ls.baslangic_tarihi, tur="LEASING",
            aciklama=f"Leasing sözleşmesi — {ls.sozlesme_no or ('#' + str(ls.id))} ({ls.toplam_tutar} {pb}, {ls.taksit_sayisi} taksit)",
            tutar_try=0, kaynak_tablo="LEASING", kaynak_id=ls.id,
        ))

    # 1) Stok satislari (bu cari MUSTERI ise)
    urunler = list(db.execute(
        select(StokSeriNo).where(StokSeriNo.sirket_id == sirket_id, StokSeriNo.musteri_cari_id == cari_id, StokSeriNo.satis_tarihi.isnot(None))
    ).scalars())
    for u in urunler:
        kart = db.get(StokKarti, u.stok_karti_id)
        urun_adi = f"{kart.marka} {kart.model}" if kart else ""
        satirlar.append(CariHareketSatiri(
            tarih=u.satis_tarihi, tur="SATIS",
            aciklama=f"Satış — {urun_adi} ({u.seri_no})",
            tutar_try=u.satis_fiyati_try or 0, durum=u.durum,
            kaynak_tablo="STOK_SATIS", kaynak_id=u.id,
        ))

    # 2) Kiralama sozlesmeleri (bu cari KIRACI ise)
    sozlesmeler = list(db.execute(
        select(KiralamaSozlesme).where(KiralamaSozlesme.sirket_id == sirket_id, KiralamaSozlesme.kiraci_cari_id == cari_id)
    ).scalars())
    for s in sozlesmeler:
        satirlar.append(CariHareketSatiri(
            tarih=s.baslangic_tarihi, tur="KIRALAMA",
            aciklama=f"Kiralama sözleşmesi — aylık {s.aylik_kira_tutari} {s.para_birimi if isinstance(s.para_birimi, str) else s.para_birimi.value}",
            tutar_try=s.aylik_kira_tutari * (s.referans_kur or 1),
            durum=s.durum, kaynak_tablo="KIRALAMA_SOZLESME", kaynak_id=s.id,
        ))

    # 3) Bakim kayitlari
    bakimlar = list(db.execute(
        select(BakimKaydi).where(BakimKaydi.sirket_id == sirket_id, BakimKaydi.ilgili_cari_id == cari_id)
    ).scalars())
    for b in bakimlar:
        urun = db.get(StokSeriNo, b.stok_seri_no_id)
        kart = db.get(StokKarti, urun.stok_karti_id) if urun else None
        urun_bilgisi = f"{kart.marka} {kart.model} ({urun.seri_no})" if kart and urun else (urun.seri_no if urun else "")
        satirlar.append(CariHareketSatiri(
            tarih=b.tarih, tur="BAKIM",
            aciklama=f"Bakım ({'Gelir' if b.tip == BakimTip.GELIR else 'Gider'}) — {urun_bilgisi}" + (f" — {b.aciklama}" if b.aciklama else ""),
            tutar_try=b.tutar, kaynak_tablo="BAKIM_KAYDI", kaynak_id=b.id,
        ))

    # 4) Taksitli satis planlari
    planlar = list(db.execute(
        select(TaksitliSatisPlani).where(TaksitliSatisPlani.sirket_id == sirket_id, TaksitliSatisPlani.musteri_cari_id == cari_id)
    ).scalars())
    for p in planlar:
        satirlar.append(CariHareketSatiri(
            tarih=p.baslangic_tarihi, tur="TAKSITLI_SATIS",
            aciklama=f"Taksitli satış planı — {p.taksit_sayisi} taksit",
            tutar_try=0, kaynak_tablo="TAKSITLI_SATIS_PLANI", kaynak_id=p.id,
        ))

    # 4b) Kredi karti (POS) taksitli satislar
    pos_planlar = list(db.execute(
        select(PosTaksitPlani).where(PosTaksitPlani.sirket_id == sirket_id, PosTaksitPlani.musteri_cari_id == cari_id)
    ).scalars())
    for pp in pos_planlar:
        urun = db.get(StokSeriNo, pp.stok_seri_no_id)
        kart = db.get(StokKarti, urun.stok_karti_id) if urun else None
        urun_bilgisi = f"{kart.marka} {kart.model} ({urun.seri_no})" if kart and urun else (urun.seri_no if urun else "")
        satirlar.append(CariHareketSatiri(
            tarih=pp.baslangic_tarihi, tur="POS_TAKSIT",
            aciklama=f"Kredi kartı taksitli satış — {urun_bilgisi} ({pp.taksit_sayisi} taksit)",
            tutar_try=pp.toplam_tutar, kaynak_tablo="POS_TAKSIT", kaynak_id=pp.id,
        ))

    # 5) Cekler
    cekler = list(db.execute(select(Cek).where(Cek.sirket_id == sirket_id, Cek.cari_id == cari_id)).scalars())
    for c in cekler:
        pb = c.para_birimi.value if hasattr(c.para_birimi, "value") else c.para_birimi
        satirlar.append(CariHareketSatiri(
            tarih=c.alinma_verilme_tarihi, tur="CEK",
            aciklama=f"Çek {c.cek_no or ('#' + str(c.id))} ({'Alınan' if c.tip == CekTip.ALINAN else 'Verilen'})",
            tutar_try=c.tutar if pb == "TRY" else 0, durum=c.durum.value if hasattr(c.durum, "value") else c.durum,
            kaynak_tablo="CEKLER", kaynak_id=c.id,
        ))

    # 6) Siparisler (bu cari TEDARIKCI ise)
    siparisler = list(db.execute(
        select(Siparis).where(Siparis.sirket_id == sirket_id, Siparis.tedarikci_cari_id == cari_id)
    ).scalars())
    for s in siparisler:
        satirlar.append(CariHareketSatiri(
            tarih=s.siparis_tarihi, tur="SIPARIS",
            aciklama=f"Sipariş {s.siparis_no}",
            tutar_try=0, durum=s.durum, kaynak_tablo="SIPARIS", kaynak_id=s.id,
        ))

    # 7) Tedarikci/Hizmet Faturalari (bu cari faturayi KESEN firma ise)
    from app.models.tedarikci_fatura import TedarikciFaturasi
    tedarikci_faturalari = list(db.execute(
        select(TedarikciFaturasi).where(TedarikciFaturasi.sirket_id == sirket_id, TedarikciFaturasi.tedarikci_cari_id == cari_id)
    ).scalars())
    for tf in tedarikci_faturalari:
        pb = tf.para_birimi.value if hasattr(tf.para_birimi, "value") else tf.para_birimi
        satirlar.append(CariHareketSatiri(
            tarih=tf.tarih, tur="TEDARIKCI_FATURA",
            aciklama=f"Fatura {tf.fatura_no or ('#' + str(tf.id))}" + (f" — {tf.aciklama}" if tf.aciklama else ""),
            tutar_try=tf.tutar if pb == "TRY" else 0,
            kaynak_tablo="TEDARIKCI_FATURA", kaynak_id=tf.id,
        ))

    satirlar.sort(key=lambda s: s.tarih or date.min, reverse=True)
    return satirlar


@router.get("/{cari_id}/tedarikci-ozeti", response_model=TedarikciOzetiYaniti,
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
async def tedarikci_ozeti(
    cari_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Bir tedarikcinin GECMISTEKI performansini ozetler: toplam kac siparis
    verildi, toplam ne kadar harcandi (TL karsiligi, guncel kurla), guncel
    kalan borc ve en son verilen siparislerin kisa bir listesi. Yeni bir
    siparis olustururken tedarikci secilince "bu firmayla daha once ne is
    yaptik" sorusuna hizlica cevap vermek icin.
    """
    from decimal import Decimal as _Decimal
    from app.models.stok import Siparis, SiparisDetay, StokKarti, SiparisOdeme
    from app.services.kur_servisi import guncel_kur_getir

    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari bulunamadı.")

    kur_cache: dict[str, _Decimal] = {"TRY": _Decimal("1")}

    async def kur_getir(pb: str) -> _Decimal:
        if pb not in kur_cache:
            try:
                k = await guncel_kur_getir(pb)
                kur_cache[pb] = _Decimal(str(k)) if k else _Decimal("1")
            except Exception:
                kur_cache[pb] = _Decimal("1")
        return kur_cache[pb]

    siparisler = list(db.execute(
        select(Siparis).where(
            Siparis.sirket_id == sirket_id, Siparis.tedarikci_cari_id == cari_id,
            Siparis.durum.notin_(["TASLAK", "IPTAL"]),
        )
    ).scalars())
    siparisler.sort(key=lambda s: s.siparis_tarihi, reverse=True)

    toplam_harcama_try = _Decimal("0")
    toplam_odenen_try = _Decimal("0")
    son_siparisler: list[TedarikciSonSiparisSatiri] = []

    for s in siparisler:
        urunler = list(db.execute(select(SiparisDetay).where(SiparisDetay.siparis_id == s.id)).scalars())
        toplam_tutar = sum((u.miktar * u.birim_fiyat for u in urunler), _Decimal("0"))
        odenen = db.execute(
            select(func.coalesce(func.sum(SiparisOdeme.tutar), 0)).where(SiparisOdeme.siparis_id == s.id)
        ).scalar_one()

        pb = s.para_birimi.value if hasattr(s.para_birimi, "value") else s.para_birimi
        kur = await kur_getir(pb) if pb != "TRY" else _Decimal("1")
        toplam_harcama_try += toplam_tutar * kur
        toplam_odenen_try += odenen * kur

        if len(son_siparisler) < 5:
            parcalar = []
            for u in urunler[:3]:
                kart = db.get(StokKarti, u.stok_karti_id)
                parcalar.append(f"{u.miktar}x {(kart.marka + ' ' + kart.model) if kart else '?'}")
            son_siparisler.append(TedarikciSonSiparisSatiri(
                tarih=s.siparis_tarihi, siparis_no=s.siparis_no,
                urun_ozeti=", ".join(parcalar) or "—",
                tutar=toplam_tutar, para_birimi=pb,
            ))

    return TedarikciOzetiYaniti(
        cari_id=cari_id, unvan=cari.unvan,
        toplam_siparis_sayisi=len(siparisler),
        toplam_harcama_try=toplam_harcama_try,
        kalan_bakiye_try=toplam_harcama_try - toplam_odenen_try,
        son_siparisler=son_siparisler,
    )


@router.get("/{cari_id}/musteri-ozeti", response_model=MusteriOzetiYaniti,
            dependencies=[Depends(izin_gerektir("CARI_GORUNTULE"))])
async def musteri_ozeti(
    cari_id: int, sirket_id: int = Depends(aktif_sirket_id_getir), db: Session = Depends(get_db),
):
    """
    Bir musterinin GECMISTEKI satis performansini ozetler: toplam kac
    satis yapildi, toplam ne kadar (TL), guncel alacagimiz ne kadar, ve
    en son yapilan satislarin kisa bir listesi. Satis Yap / Proforma
    olustururken musteri secilince "bu musteriye daha once ne fiyata
    sattik, bizde borcu var mi" sorusuna hizlica cevap vermek icin.
    """
    from decimal import Decimal as _Decimal
    from app.models.stok import StokSeriNo, StokKarti, StokDurum

    cari = db.get(CariHesap, cari_id)
    if cari is None or cari.sirket_id != sirket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cari bulunamadı.")

    satislar = list(db.execute(
        select(StokSeriNo).where(
            StokSeriNo.sirket_id == sirket_id, StokSeriNo.musteri_cari_id == cari_id,
            StokSeriNo.durum == StokDurum.SATILDI,
        )
    ).scalars())
    satislar.sort(key=lambda u: u.satis_tarihi or date.min, reverse=True)

    toplam_satis_tutari = sum((u.satis_fiyati_try or _Decimal("0") for u in satislar), _Decimal("0"))

    son_satislar: list[MusteriSonSatisSatiri] = []
    for u in satislar[:5]:
        kart = db.get(StokKarti, u.stok_karti_id)
        son_satislar.append(MusteriSonSatisSatiri(
            tarih=u.satis_tarihi, seri_no=u.seri_no,
            urun_adi=f"{kart.marka} {kart.model}" if kart else "—",
            tutar_try=u.satis_fiyati_try or _Decimal("0"),
        ))

    ozet = await cari_ozet(cari_id=cari_id, sirket_id=sirket_id, db=db)

    return MusteriOzetiYaniti(
        cari_id=cari_id, unvan=cari.unvan,
        toplam_satis_sayisi=len(satislar),
        toplam_satis_tutari_try=toplam_satis_tutari,
        guncel_alacak_try=ozet.net_try,
        son_satislar=son_satislar,
    )
