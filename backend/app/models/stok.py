"""
Stok (seri no bazli) ve Siparis modulu - SQLAlchemy modelleri.
"""
import enum
from sqlalchemy import (Column, BigInteger, String, Numeric, Boolean, Integer,
                         DateTime, Date, ForeignKey, Text, Enum as SAEnum)
from sqlalchemy.sql import func
from app.db.session import Base
from app.db.soft_delete import SoftDeleteMixin


class StokKaynak(str, enum.Enum):
    ITHALAT = "ITHALAT"
    YURTICI_ALIM = "YURTICI_ALIM"


class StokDurum(str, enum.Enum):
    DEPODA = "DEPODA"
    SIPARISTE = "SIPARISTE"
    YOLDA = "YOLDA"
    GUMRUKTE = "GUMRUKTE"
    ANTREPODA = "ANTREPODA"
    SATILDI = "SATILDI"
    KIRADA = "KIRADA"
    BAKIMDA = "BAKIMDA"
    HURDA = "HURDA"


class MaliyetTip(str, enum.Enum):
    # Ithalat asamasi maliyetleri (siparis bazli, urun antrepoya gelene kadar):
    SATINALMA = "SATINALMA"
    NAKLIYE = "NAKLIYE"
    SIGORTA = "SIGORTA"
    GUMRUK = "GUMRUK"
    ANTREPO = "ANTREPO"
    MILLILESTIRME = "MILLILESTIRME"
    # Satis asamasi maliyetleri (SADECE o satisa ozel - Leasing/Faturali
    # satis turune gore hangilerinin beklendigi degisir):
    ARDIYE = "ARDIYE"
    ILAVE_GUMRUK_VERGISI = "ILAVE_GUMRUK_VERGISI"
    DAMGA_VERGISI = "DAMGA_VERGISI"
    TSE_UCRETI = "TSE_UCRETI"
    GUMRUKCU_MASRAFI = "GUMRUKCU_MASRAFI"
    BANKA_MASRAFI = "BANKA_MASRAFI"
    KDV = "KDV"
    LEASING = "LEASING"
    DIGER = "DIGER"


class SiparisDurum(str, enum.Enum):
    TASLAK = "TASLAK"
    ONAYLANDI = "ONAYLANDI"
    YOLDA = "YOLDA"
    GUMRUKTE = "GUMRUKTE"
    TESLIM_ALINDI = "TESLIM_ALINDI"
    TAMAMLANDI = "TAMAMLANDI"
    IPTAL = "IPTAL"


class ParaBirimi(str, enum.Enum):
    TRY = "TRY"
    USD = "USD"
    EUR = "EUR"
    ALTIN = "ALTIN"


class StokKategori(Base):
    __tablename__ = "stok_kategorileri"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    ad = Column(String(150), nullable=False)


class StokKarti(Base, SoftDeleteMixin):
    __tablename__ = "stok_kartlari"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    kategori_id = Column(BigInteger, ForeignKey("stok_kategorileri.id"))
    marka = Column(String(100))
    model = Column(String(150))
    aciklama = Column(Text)
    birim = Column(String(20), default="ADET")
    birim_agirlik_kg = Column(Numeric(10, 2))
    mense_ulke = Column(String(100))
    gtip_kodu = Column(String(20))
    # Bu urun modeli icin standart bir alt yazi/not sablonu (orn. garanti
    # sartlari, teslimat kosullari). Proforma/Fatura olustururken bu
    # modelden kalem eklenince, bu metin otomatik olarak Notlar alanina
    # onerilir - kullanici isterse duzenler/cikartir.
    standart_alt_metin = Column(Text)
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class StokSeriNo(Base, SoftDeleteMixin):
    __tablename__ = "stok_seri_no"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    stok_karti_id = Column(BigInteger, ForeignKey("stok_kartlari.id"), nullable=False)
    seri_no = Column(String(100), unique=True, nullable=False)
    sasi_no = Column(String(100))
    uretim_yili = Column(Integer)
    kaynak = Column(SAEnum(StokKaynak, name="stok_kaynak_t"), nullable=False)
    siparis_id = Column(BigInteger, ForeignKey("siparisler.id"))
    durum = Column(SAEnum(StokDurum, name="stok_durum_t"), nullable=False, default=StokDurum.SIPARISTE)
    tedarikci_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    # TICARI: musteriye satmak icin alinan normal stok. OZ_MAL: kendi
    # kullanimimiz/kiralama icin ayirdigimiz, kendi mulkumuz olan urun -
    # yine de maliyeti uzerinden ileride satilabilir/hurdaya cikarilabilir.
    sahiplik_tipi = Column(String(20), nullable=False, default="TICARI")

    satinalma_maliyeti_try = Column(Numeric(18, 2), default=0)
    nakliye_maliyeti_try = Column(Numeric(18, 2), default=0)
    sigorta_maliyeti_try = Column(Numeric(18, 2), default=0)
    gumruk_maliyeti_try = Column(Numeric(18, 2), default=0)
    antrepo_maliyeti_try = Column(Numeric(18, 2), default=0)
    millilestirme_maliyeti_try = Column(Numeric(18, 2), default=0)
    leasing_maliyeti_try = Column(Numeric(18, 2), default=0)
    diger_maliyet_try = Column(Numeric(18, 2), default=0)
    # toplam_maliyet_try veritabaninda GENERATED ALWAYS AS ... STORED;
    # SQLAlchemy bu sutunu salt-okunur olarak haritalar (deferred read).
    # Bu GENERATED sutuna DOKUNMUYORUZ (formulu bilinmiyor, riskli) - asagidaki
    # YENI satis-asamasi maliyet sutunlari, toplam_maliyet_try'YE DAHIL DEGIL,
    # backend'de AYRICA "toplam_satis_maliyeti_try" olarak toplanip donuluyor.
    ardiye_maliyeti_try = Column(Numeric(18, 2), default=0)
    ilave_gumruk_vergisi_try = Column(Numeric(18, 2), default=0)
    damga_vergisi_try = Column(Numeric(18, 2), default=0)
    tse_ucreti_try = Column(Numeric(18, 2), default=0)
    gumrukcu_masrafi_try = Column(Numeric(18, 2), default=0)
    banka_masrafi_try = Column(Numeric(18, 2), default=0)
    kdv_try = Column(Numeric(18, 2), default=0)

    satis_fiyati_try = Column(Numeric(18, 2))
    satis_tarihi = Column(Date)
    # Satisin GERCEKTEN sisteme islendigi an (saat dahil) - satis_tarihi
    # kullanicinin sectigi/geriye donuk olabilen bir tarih, bu alan ise
    # "Son Islemler" akisinda dogru zamanla gorunmesi icin OTOMATIK doldurulur.
    satis_kayit_zamani = Column(DateTime)
    musteri_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    # Satis turu - "LEASINGLI" veya "FATURALI" (KDV'li/pesin/taksitli/cek
    # hepsi FATURALI sayilir). Satis-sonrasi maliyet kontrol listesinde
    # (SatisMaliyetKontrolListesi) hangi kalemlerin beklendigini belirlemek
    # icin kullanilir.
    satis_odeme_tipi = Column(String(20))
    # Satisin GERCEK yontemi (PESIN_NAKIT/PESIN_HAVALE/PESIN_KART/TAKSITLI/
    # LEASINGLI/CEK) - satis_odeme_tipi (LEASINGLI/FATURALI, maliyet
    # kontrolu icin) ile KARISTIRILMASIN; bu alan SADECE "nasil satildi"
    # bilgisini Stok listesinde gostermek icindir.
    satis_yontemi = Column(String(20))
    # Cek ile yapilan satislarda, hangi cekin bu satisa karsilik geldigini
    # izler - satis geri alinirken (henuz ciro/tahsil edilmemisse) hem
    # urunu hem cekin kendisini birlikte geri almak icin kullanilir.
    satis_cek_id = Column(BigInteger, ForeignKey("cekler.id"))

    giris_tarihi = Column(Date)
    garanti_bitis_tarihi = Column(Date)
    barkod = Column(String(100))
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class StokMaliyetKalemi(Base):
    __tablename__ = "stok_maliyet_kalemleri"

    id = Column(BigInteger, primary_key=True)
    stok_seri_no_id = Column(BigInteger, ForeignKey("stok_seri_no.id"), nullable=False)
    tip = Column(SAEnum(MaliyetTip, name="maliyet_tip_t"), nullable=False)
    aciklama = Column(String(300))
    tedarikci_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)
    kur = Column(Numeric(18, 4), default=1)
    tutar_try = Column(Numeric(18, 2), nullable=False)
    belge_no = Column(String(100))
    tarih = Column(Date, nullable=False)
    odendi_mi = Column(Boolean, default=False)
    # TL kalemler icin, odeme tarihindeki GERCEK USD/TRY kuru (referans
    # bilgi - sadece bu kalemin USD karsiligini dogru hesaplamak icin).
    referans_usd_kuru = Column(Numeric(18, 6))
    # Bu kalem bir Tedarikci Faturasi odemesinden OTOMATIK olusturulduysa,
    # hangi odemeden geldigini KESIN olarak izlemek icin (belge_no/tarih
    # esleştirmesi yerine dogrudan FK - "odemeyi geri al" islemini
    # guvenilir kilar).
    tedarikci_fatura_odeme_id = Column(BigInteger, ForeignKey("tedarikci_fatura_odemeleri.id"))


# Maliyet tipi -> stok_seri_no uzerindeki ozet sutun adi eslemesi.
# Yeni bir maliyet kalemi eklendiginde ilgili ozet sutun bu sozlukle guncellenir.
MALIYET_TIP_SUTUN_ESLEME = {
    MaliyetTip.SATINALMA: "satinalma_maliyeti_try",
    MaliyetTip.NAKLIYE: "nakliye_maliyeti_try",
    MaliyetTip.SIGORTA: "sigorta_maliyeti_try",
    MaliyetTip.GUMRUK: "gumruk_maliyeti_try",
    MaliyetTip.ANTREPO: "antrepo_maliyeti_try",
    MaliyetTip.MILLILESTIRME: "millilestirme_maliyeti_try",
    MaliyetTip.ARDIYE: "ardiye_maliyeti_try",
    MaliyetTip.ILAVE_GUMRUK_VERGISI: "ilave_gumruk_vergisi_try",
    MaliyetTip.DAMGA_VERGISI: "damga_vergisi_try",
    MaliyetTip.TSE_UCRETI: "tse_ucreti_try",
    MaliyetTip.GUMRUKCU_MASRAFI: "gumrukcu_masrafi_try",
    MaliyetTip.BANKA_MASRAFI: "banka_masrafi_try",
    MaliyetTip.KDV: "kdv_try",
    MaliyetTip.LEASING: "leasing_maliyeti_try",
    MaliyetTip.DIGER: "diger_maliyet_try",
}

# Satis turune gore, o satisa ozel BEKLENEN maliyet kategorileri (kontrol
# listesi icin). "Diger" her ikisinde de esneklik icin dahil.
LEASING_SATIS_MALIYET_TIPLERI = [
    MaliyetTip.ARDIYE, MaliyetTip.GUMRUK, MaliyetTip.ILAVE_GUMRUK_VERGISI,
    MaliyetTip.DAMGA_VERGISI, MaliyetTip.TSE_UCRETI, MaliyetTip.LEASING,
    MaliyetTip.BANKA_MASRAFI, MaliyetTip.DIGER,
]
FATURALI_SATIS_MALIYET_TIPLERI = [
    MaliyetTip.GUMRUK, MaliyetTip.ILAVE_GUMRUK_VERGISI, MaliyetTip.DAMGA_VERGISI,
    MaliyetTip.TSE_UCRETI, MaliyetTip.GUMRUKCU_MASRAFI, MaliyetTip.BANKA_MASRAFI,
    MaliyetTip.KDV, MaliyetTip.DIGER,
]


class Siparis(Base, SoftDeleteMixin):
    __tablename__ = "siparisler"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    siparis_no = Column(String(50), unique=True, nullable=False)
    tedarikci_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"), nullable=False)
    kaynak = Column(SAEnum(StokKaynak, name="stok_kaynak_t"), nullable=False)
    kopya_kaynak_siparis_id = Column(BigInteger, ForeignKey("siparisler.id"))
    siparis_tarihi = Column(Date, nullable=False)
    tahmini_teslim_tarihi = Column(Date)
    durum = Column(SAEnum(SiparisDurum, name="siparis_durum_t"), default=SiparisDurum.TASLAK)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    cikis_limani = Column(String(150))
    varis_limani = Column(String(150))
    konsimento_no = Column(String(100))
    gumruk_beyanname_no = Column(String(100))
    notlar = Column(Text)
    olusturan_kullanici_id = Column(BigInteger, ForeignKey("kullanicilar.id"))
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class SiparisDetay(Base):
    __tablename__ = "siparis_detay"

    id = Column(BigInteger, primary_key=True)
    siparis_id = Column(BigInteger, ForeignKey("siparisler.id"), nullable=False)
    stok_karti_id = Column(BigInteger, ForeignKey("stok_kartlari.id"), nullable=False)
    miktar = Column(Integer, nullable=False, default=1)
    birim_fiyat = Column(Numeric(18, 2), nullable=False)
    para_birimi = Column(SAEnum(ParaBirimi, name="para_birimi_t"), nullable=False)
    birim_agirlik_kg = Column(Numeric(10, 2))
    kdv_orani = Column(Numeric(5, 2), nullable=False, default=20)
    aciklama = Column(String(300))


class SiparisOdeme(Base):
    """
    Bir siparise (tedarikciye) yapilan avans/ara/kapama odemelerini takip
    eder. Bu, stok maliyeti hesabindan (satinalma_maliyeti_try) TAMAMEN
    BAGIMSIZDIR: bu tablo "ne kadar nakit ciktigini/borcumuz kaldigini",
    stok maliyeti ise "urunun gercek maliyetini" gosterir - ikisi ayni
    tutari temsil etmeyebilir (orn. henuz tam odenmemis bir siparis, teslim
    alindiginda maliyeti zaten sozlesme fiyati uzerinden hesaba yazilir).
    """
    __tablename__ = "siparis_odemeleri"

    id = Column(BigInteger, primary_key=True)
    siparis_id = Column(BigInteger, ForeignKey("siparisler.id"), nullable=False)
    tarih = Column(Date, nullable=False)
    tutar = Column(Numeric(18, 2), nullable=False)  # siparisin kendi para biriminde (orn. USD)
    odeme_yontemi = Column(String(10))  # "NAKIT" | "BANKA" | "CEK" | "LEASING"
    cek_id = Column(BigInteger, ForeignKey("cekler.id"))  # odeme_yontemi == "CEK" ise, olusturulan cek kaydi
    notlar = Column(String(300))
    olusturma_tarihi = Column(DateTime, server_default=func.now())


class GumrukBeyannamesi(Base):
    """
    Bir ithalat siparisine ait gumruk beyannamesi kaydi (beyanname no,
    tarihi, gumruk musaviri cari'si ve odenen tutar). Bir siparise birden
    fazla beyanname acilabilir (kismi teslimatlarda oldugu gibi).
    """
    __tablename__ = "gumruk_beyannameleri"

    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    siparis_id = Column(BigInteger, ForeignKey("siparisler.id"), nullable=False)
    beyanname_no = Column(String(100))
    beyanname_tarihi = Column(Date, nullable=False)
    gumruk_musaviri_cari_id = Column(BigInteger, ForeignKey("cari_hesaplar.id"))
    tutar = Column(Numeric(18, 2), nullable=False)
    para_birimi = Column(String(10), nullable=False, default="TRY")
    kur = Column(Numeric(18, 6), nullable=False, default=1)
    tutar_try = Column(Numeric(18, 2), nullable=False)
    # Bu tutarin (tutar_try) icinde ne kadarinin KDV oldugu - varsa KDV
    # Ozeti raporundaki "Indirilecek KDV" hesabina otomatik dahil edilir.
    kdv_tutari = Column(Numeric(18, 2), nullable=False, default=0)
    notlar = Column(String(500))
    olusturma_tarihi = Column(DateTime, server_default=func.now())
