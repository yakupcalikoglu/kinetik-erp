"""
Genel amacli belge/dosya eki modulu.
Herhangi bir kayda (Siparis, Leasing/Kiralama sozlesmesi, Cek, Fatura vb.)
gumruk beyannamesi, sozlesme kopyasi, fatura taramasi gibi belgeler
eklenebilmesi icin - kaynak_tablo + kaynak_id ikilisi, kaynak_detay.py'deki
AYNI genel desen (Kasa/Banka hareketlerinin kaynagini cozerken kullanilan
yaklasim). Dosya icerigi DOGRUDAN VERITABANINDA (BYTEA) saklanir - Render
gibi platformlarda /tmp diski KALICI DEGIL (her deploy'da sifirlanir),
logo icin de ayni sebeple bu yontem kullaniliyordu.
"""
from sqlalchemy import Column, BigInteger, String, LargeBinary, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base


class Belge(Base):
    __tablename__ = "belgeler"
    id = Column(BigInteger, primary_key=True)
    sirket_id = Column(BigInteger, ForeignKey("sirketler.id"), nullable=False)
    # Hangi kayda ait - orn. "SIPARIS", "LEASING", "KIRALAMA", "CEKLER",
    # "TEDARIKCI_FATURA", "STOK_SERI_NO" - kaynak_detay.py'deki kaynak_tablo
    # degerleriyle AYNI isimlendirme kullanilir (tutarlilik icin).
    kaynak_tablo = Column(String(50), nullable=False)
    kaynak_id = Column(BigInteger, nullable=False)
    # Ayni kaynak_tablo/kaynak_id altinda, kullanicinin KENDI olusturdugu
    # (orn. "Gümrük Evrakları", "Garanti Belgesi") alt gruplama - GERCEK bir
    # dosya sistemi klasoru degil, sadece bir ETIKET/kategori metni. NULL
    # ise "Genel" (kok, klasorsuz) grup altinda gosterilir.
    klasor_adi = Column(String(100), nullable=True)
    dosya_adi = Column(String(255), nullable=False)
    icerik = Column(LargeBinary, nullable=False)
    content_type = Column(String(100))
    boyut_bayt = Column(BigInteger)
    yukleyen_kullanici_id = Column(BigInteger, ForeignKey("kullanicilar.id"))
    yukleme_tarihi = Column(DateTime, server_default=func.now())
