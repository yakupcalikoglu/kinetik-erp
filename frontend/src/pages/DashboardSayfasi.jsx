import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, HataMesaji, BosDurum, paraFormat, Etiket } from '../components/Ortak';

function TiklanabilirKart({ baslik, onClick, children, vurgu }) {
  const [uzerinde, setUzerinde] = useState(false);
  return (
    <Kart
      onClick={onClick}
      style={{
        cursor: 'pointer',
        boxShadow: uzerinde ? '0 4px 14px rgba(0,0,0,0.08)' : 'var(--golge-sm)',
        transform: uzerinde ? 'translateY(-1px)' : 'none',
        transition: 'all 0.15s',
        border: vurgu ? '1px solid var(--kirmizi)' : '1px solid var(--kenarlik)',
      }}
      onMouseEnter={() => setUzerinde(true)}
      onMouseLeave={() => setUzerinde(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{baslik}</div>
        <span style={{ fontSize: 12, color: 'var(--lacivert)' }}>Aç →</span>
      </div>
      {children}
    </Kart>
  );
}

function paraBazliToplamGoster(satirlar, alan = 'tutar') {
  if (!satirlar || satirlar.length === 0) return '—';
  const gruplar = {};
  satirlar.forEach((s) => {
    const pb = s.para_birimi || 'TRY';
    gruplar[pb] = (gruplar[pb] || 0) + Number(s[alan]);
  });
  return Object.entries(gruplar).map(([pb, tutar]) => paraFormat(tutar, pb)).join(' + ');
}

// -------------------------------------------------------------- Ana Kasa
function AnaKasaKutusu({ navigate }) {
  const [bakiye, setBakiye] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/kasa-bakiye').then((r) => setBakiye(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  return (
    <TiklanabilirKart baslik="💰 Ana Kasa" onClick={() => navigate('/kasa')}>
      {hata ? <HataMesaji>{hata}</HataMesaji> : !bakiye ? (
        <div style={{ color: 'var(--metin-soluk)', fontSize: 13 }}>Yükleniyor...</div>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {bakiye.bakiyeler.map((b) => (
            <div key={b.para_birimi}>
              <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>{b.para_birimi}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: Number(b.net_bakiye) >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                {paraFormat(b.net_bakiye, b.para_birimi)}
              </div>
            </div>
          ))}
          <div style={{ borderLeft: '1px solid var(--kenarlik)', paddingLeft: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>Toplam (TL karşılığı)</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{paraFormat(bakiye.net_bakiye_try_toplam)}</div>
          </div>
        </div>
      )}
    </TiklanabilirKart>
  );
}

// -------------------------------------------------------------- Bankalar
function BankalarKutusu({ navigate }) {
  const [hesaplar, setHesaplar] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/banka-bakiyeleri').then((r) => setHesaplar(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  return (
    <TiklanabilirKart baslik="🏦 Bankalar" onClick={() => navigate('/banka')}>
      {hata ? <HataMesaji>{hata}</HataMesaji> : !hesaplar ? (
        <div style={{ color: 'var(--metin-soluk)', fontSize: 13 }}>Yükleniyor...</div>
      ) : hesaplar.length === 0 ? (
        <BosDurum baslik="Henüz banka hesabı yok" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hesaplar.map((h) => (
            <div key={h.banka_hesap_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--metin-ikincil)' }}>{h.banka_adi}{h.hesap_adi ? ` — ${h.hesap_adi}` : ''}</span>
              <span style={{ fontWeight: 600 }}>{paraFormat(h.bakiye, h.para_birimi)}</span>
            </div>
          ))}
        </div>
      )}
    </TiklanabilirKart>
  );
}

// -------------------------------------------------------------- Stok
const STOK_DURUM_METIN = {
  YOLDA: 'Yolda', GUMRUKTE: 'Gümrükte', ANTREPODA: 'Antrepoda', DEPODA: 'Depoda',
  SATILDI: 'Satıldı', KIRADA: 'Kirada',
};

function StokKutusu({ navigate }) {
  const [urunler, setUrunler] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/stok-seri-no').then((r) => setUrunler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  const durumOzet = {};
  if (urunler) {
    urunler.forEach((u) => { durumOzet[u.durum] = (durumOzet[u.durum] || 0) + 1; });
  }
  const gosterilecekDurumlar = ['DEPODA', 'ANTREPODA', 'YOLDA', 'GUMRUKTE', 'KIRADA'];

  return (
    <TiklanabilirKart baslik="📦 Stok" onClick={() => navigate('/stok')}>
      {hata ? <HataMesaji>{hata}</HataMesaji> : !urunler ? (
        <div style={{ color: 'var(--metin-soluk)', fontSize: 13 }}>Yükleniyor...</div>
      ) : (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {gosterilecekDurumlar.filter((d) => durumOzet[d]).map((d) => (
            <div key={d} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{durumOzet[d]}</div>
              <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>{STOK_DURUM_METIN[d] || d}</div>
            </div>
          ))}
          {gosterilecekDurumlar.every((d) => !durumOzet[d]) && <BosDurum baslik="Stokta ürün yok" />}
        </div>
      )}
    </TiklanabilirKart>
  );
}

// -------------------------------------------------------------- Kiralık Ürünler
function KiralikUrunlerKutusu({ navigate }) {
  const [liste, setListe] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/raporlar/aktif-kiralamalar').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  const toplamKira = liste ? paraBazliToplamGoster(liste, 'aylik_kira_tutari') : '—';

  return (
    <TiklanabilirKart baslik="🔑 Kiralık Ürünler" onClick={() => navigate('/finansal')}>
      {hata ? <HataMesaji>{hata}</HataMesaji> : !liste ? (
        <div style={{ color: 'var(--metin-soluk)', fontSize: 13 }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <BosDurum baslik="Aktif kiralama yok" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{liste.length}</div>
              <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>Kirada ürün</div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--yesil)' }}>{toplamKira}</div>
              <div style={{ fontSize: 11, color: 'var(--metin-ikincil)' }}>Aylık kira geliri</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {liste.slice(0, 4).map((k) => (
              <div key={k.stok_seri_no_id} style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{k.marka} {k.model} — {k.kiraci_unvan}</span>
                <span style={{ fontWeight: 500, color: 'var(--metin-birincil)' }}>{paraFormat(k.aylik_kira_tutari, k.para_birimi)}</span>
              </div>
            ))}
            {liste.length > 4 && <div style={{ fontSize: 11.5, color: 'var(--metin-soluk)' }}>+ {liste.length - 4} tane daha...</div>}
          </div>
        </>
      )}
    </TiklanabilirKart>
  );
}

// -------------------------------------------------------------- Aylık Ödeme / Alacak
function OdemeAlacakKutusu({ navigate }) {
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/raporlar/yaklasan-vadeler', { params: { gun: 30 } }).then((r) => setVeri(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  const bugun = new Date().toISOString().slice(0, 10);
  const gecikenOdeme = veri ? veri.odemeler.filter((o) => o.tarih < bugun).length : 0;
  const gecikenTahsilat = veri ? veri.tahsilatlar.filter((t) => t.tarih < bugun).length : 0;

  return (
    <TiklanabilirKart baslik="📅 Aylık Ödeme / Alacak Listesi" onClick={() => navigate('/raporlar')} vurgu={gecikenOdeme > 0 || gecikenTahsilat > 0}>
      {hata ? <HataMesaji>{hata}</HataMesaji> : !veri ? (
        <div style={{ color: 'var(--metin-soluk)', fontSize: 13 }}>Yükleniyor...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--kirmizi)', fontWeight: 600, marginBottom: 6 }}>
              Ödemelerim ({veri.odemeler.length}) {gecikenOdeme > 0 && <span>· {gecikenOdeme} gecikmiş</span>}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{paraBazliToplamGoster(veri.odemeler)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--yesil)', fontWeight: 600, marginBottom: 6 }}>
              Alacaklarım ({veri.tahsilatlar.length}) {gecikenTahsilat > 0 && <span>· {gecikenTahsilat} gecikmiş</span>}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{paraBazliToplamGoster(veri.tahsilatlar)}</div>
          </div>
        </div>
      )}
    </TiklanabilirKart>
  );
}

export default function DashboardSayfasi() {
  const navigate = useNavigate();

  return (
    <div>
      <SayfaBasligi baslik="Dashboard" aciklama="Genel durumunuza hızlı bakış — herhangi bir kutuya tıklayarak ilgili ekrana gidebilirsiniz" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <AnaKasaKutusu navigate={navigate} />
        <BankalarKutusu navigate={navigate} />
        <StokKutusu navigate={navigate} />
        <KiralikUrunlerKutusu navigate={navigate} />
        <OdemeAlacakKutusu navigate={navigate} />
      </div>
    </div>
  );
}
