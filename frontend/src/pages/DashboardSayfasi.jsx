import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet2, Landmark, Boxes, KeyRound, CalendarClock, Briefcase, Wrench } from 'lucide-react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, HataMesaji, BosDurum, paraFormat, Etiket, Buton } from '../components/Ortak';

function TiklanabilirKart({ baslik, Simge, onClick, children, vurgu }) {
  const [uzerinde, setUzerinde] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setUzerinde(true)}
      onMouseLeave={() => setUzerinde(false)}
      style={{ cursor: 'pointer' }}
    >
      <Kart
        style={{
          boxShadow: uzerinde ? '0 4px 14px rgba(0,0,0,0.08)' : 'var(--golge-sm)',
          transform: uzerinde ? 'translateY(-1px)' : 'none',
          transition: 'all 0.15s',
          border: vurgu ? '1px solid var(--kirmizi)' : '1px solid var(--kenarlik)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 600 }}>
            {Simge && <Simge size={18} />}
            {baslik}
          </div>
          <span style={{ fontSize: 12, color: 'var(--lacivert)' }}>Aç →</span>
        </div>
        {children}
      </Kart>
    </div>
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

// -------------------------------------------------------------- Net Durum (Bilanço)
function NetDurumKutusu() {
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);
  const [detayAcik, setDetayAcik] = useState(false);

  useEffect(() => {
    api.get('/raporlar/net-durum').then((r) => setVeri(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  if (hata) return <Kart style={{ marginBottom: 16 }}><HataMesaji>{hata}</HataMesaji></Kart>;

  const toplamVarlikVeAlacak = veri ? Number(veri.toplam_varlik_try) + Number(veri.toplam_alacak_try) : 0;

  return (
    <Kart style={{ marginBottom: 16, background: 'var(--lacivert-koyu, #0f2340)', color: 'white' }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Briefcase size={18} /> Net Durum (Bilanço) — şu anki güncel kurla
      </div>
      {!veri ? (
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Yükleniyor...</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>Toplam Varlık + Alacak</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{paraFormat(toplamVarlikVeAlacak)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>Toplam Borç</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ff9d9d' }}>{paraFormat(veri.toplam_borc_try)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>Net Değer</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: Number(veri.net_deger_try) >= 0 ? '#8ef0b0' : '#ff9d9d' }}>
                {paraFormat(veri.net_deger_try)}
              </div>
            </div>
          </div>
          <span
            onClick={() => setDetayAcik((a) => !a)}
            style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {detayAcik ? 'Detayı gizle' : 'Kalem kalem detayı göster'}
          </span>

          {detayAcik && (
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.8)' }}>Varlıklar</div>
                {veri.varliklar.map((v) => (
                  <div key={v.kategori} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{v.kategori}</span>
                    <span>{paraFormat(v.tutar_try)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.8)' }}>Alacaklar</div>
                {veri.alacaklar.map((v) => (
                  <div key={v.kategori} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{v.kategori}</span>
                    <span>{paraFormat(v.tutar_try)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.8)' }}>Borçlar</div>
                {veri.borclar.map((v) => (
                  <div key={v.kategori} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{v.kategori}</span>
                    <span>{paraFormat(v.tutar_try)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Kart>
  );
}

// -------------------------------------------------------------- Ana Kasa
function AnaKasaKutusu({ navigate }) {
  const [bakiye, setBakiye] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/kasa-bakiye').then((r) => setBakiye(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  return (
    <TiklanabilirKart baslik="Ana Kasa" Simge={Wallet2} onClick={() => navigate('/kasa')}>
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
    <TiklanabilirKart baslik="Bankalar" Simge={Landmark} onClick={() => navigate('/banka')}>
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
    <TiklanabilirKart baslik="Stok" Simge={Boxes} onClick={() => navigate('/stok')}>
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

// -------------------------------------------------------------- Yedek Parça (min stok altı)
function YedekParcaKutusu({ navigate }) {
  const [parcalar, setParcalar] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/yedek-parcalar').then((r) => setParcalar(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  const minAltindakiler = parcalar
    ? parcalar.filter((p) => p.min_stok_seviyesi && Number(p.mevcut_miktar) < Number(p.min_stok_seviyesi))
    : [];

  return (
    <TiklanabilirKart baslik="Yedek Parça / Sarf" Simge={Wrench} onClick={() => navigate('/yedek-parcalar')} vurgu={minAltindakiler.length > 0}>
      {hata ? <HataMesaji>{hata}</HataMesaji> : !parcalar ? (
        <div style={{ color: 'var(--metin-soluk)', fontSize: 13 }}>Yükleniyor...</div>
      ) : minAltindakiler.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--yesil)' }}>✓ Tüm parçalar minimum stok seviyesinin üzerinde</div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--kirmizi)', fontWeight: 600, marginBottom: 6 }}>
            ⚠ {minAltindakiler.length} parça minimum stok seviyesinin altında
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {minAltindakiler.slice(0, 4).map((p) => (
              <div key={p.id} style={{ fontSize: 12, color: 'var(--metin-ikincil)' }}>
                {p.ad}: {p.mevcut_miktar} / min {p.min_stok_seviyesi} {p.birim}
              </div>
            ))}
            {minAltindakiler.length > 4 && (
              <div style={{ fontSize: 11.5, color: 'var(--metin-soluk)' }}>+ {minAltindakiler.length - 4} tane daha</div>
            )}
          </div>
        </>
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
    <TiklanabilirKart baslik="Kiralık Ürünler" Simge={KeyRound} onClick={() => navigate('/finansal?sekme=kiralama')}>
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
    <TiklanabilirKart baslik="Aylık Ödeme / Alacak Listesi" Simge={CalendarClock} onClick={() => navigate('/raporlar')} vurgu={gecikenOdeme > 0 || gecikenTahsilat > 0}>
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


const SON_ISLEM_TUR_METIN = {
  SIPARIS: 'Sipariş', TEDARIKCI_FATURA: 'Tedarikçi Faturası', TEDARIKCI_FATURA_ODEME: 'Fatura Ödemesi',
  STOK: 'Stok', STOK_SATIS: 'Satış', CARI: 'Cari',
};

// "Son Islemler" satirindaki kaynak_tablo degerine gore, hangi sayfaya
// gidilecegini belirler. Backend'den gelen kaynak_tablo hem kendi "tur"
// degerlerimizi (SIPARIS, TEDARIKCI_FATURA, STOK, CARI) hem de Kasa/Banka
// hareketlerinin GERCEK kaynagini (orn. AKREDITIF_KALEMI, TAKSIT_DETAY)
// tasiyabilir - BankaSayfasi'ndaki KAYNAK_YOL_HARITASI ile AYNI mantik.
const SON_ISLEM_YOL_HARITASI = {
  SIPARIS: '/siparisler',
  TEDARIKCI_FATURA: '/tedarikci-faturalari',
  STOK: '/stok',
  CARI: '/cariler',
  AKREDITIF_KALEMI: '/finansal?sekme=akreditif',
  AKREDITIF_KALEM_TAKSIT: '/finansal?sekme=akreditif',
  LEASING_ODEME: '/finansal?sekme=leasing',
  KIRALAMA_ODEME: '/finansal?sekme=kiralama',
  TAKSIT_DETAY: '/finansal?sekme=taksit',
  PERSONEL_ODEME: '/finansal?sekme=personel',
  SABIT_GIDER: '/finansal?sekme=gider',
  BORC_ODEME: '/finansal?sekme=borc',
  BAKIM_KAYDI: '/finansal?sekme=bakim',
  CEKLER: '/finansal?sekme=cek',
  SIPARIS_ODEME: '/siparisler',
  DEMIRBAS_SATIS: '/oz-mal',
  YEDEK_PARCA_HAREKET: '/yedek-parcalar',
};

function zamanGoster(iso) {
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SonIslemlerKutusu() {
  const navigate = useNavigate();
  const [liste, setListe] = useState(null);
  const [hata, setHata] = useState(null);
  const [genisletildi, setGenisletildi] = useState(false);

  useEffect(() => {
    api.get('/raporlar/son-islemler', { params: { limit: 50 } })
      .then((r) => setListe(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  const gosterilecekler = genisletildi ? liste : (liste || []).slice(0, 10);

  return (
    <Kart style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Son İşlemler</div>
      <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 14 }}>
        Sistemde son yapılan işlemler, kayıt zamanına (saat dahil) göre.
      </div>
      {hata ? <HataMesaji>{hata}</HataMesaji> : !liste ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <BosDurum baslik="Henüz işlem yok" />
      ) : (
        <>
          <div>
            {gosterilecekler.map((s, i) => {
              const hedefYol = s.kaynak_tablo ? SON_ISLEM_YOL_HARITASI[s.kaynak_tablo] : null;
              return (
                <div
                  key={i}
                  onClick={hedefYol ? () => navigate(hedefYol) : undefined}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '9px 0', borderTop: i > 0 ? '1px solid var(--kenarlik)' : 'none', fontSize: 13,
                    cursor: hedefYol ? 'pointer' : 'default',
                  }}
                >
                  <div>
                    <Etiket ton="notr">{SON_ISLEM_TUR_METIN[s.tur] || s.tur}</Etiket>
                    <span style={{ marginLeft: 10 }}>{s.aciklama}</span>
                    {hedefYol && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--lacivert)' }}>→ görüntüle</span>}
                  </div>
                  <div style={{ textAlign: 'right', color: 'var(--metin-ikincil)', whiteSpace: 'nowrap' }}>
                    {s.tutar != null && <span style={{ marginRight: 10, fontWeight: 500 }}>{paraFormat(s.tutar, s.para_birimi || 'TRY')}</span>}
                    {zamanGoster(s.zaman)}
                  </div>
                </div>
              );
            })}
          </div>
          {liste.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button
                onClick={() => setGenisletildi((g) => !g)}
                style={{ background: 'none', border: 'none', color: 'var(--lacivert)', cursor: 'pointer', fontSize: 13 }}
              >
                {genisletildi ? 'Daha az göster' : `Tümünü göster (${liste.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </Kart>
  );
}

// Programi ilk kullanan biri bile "ne yapmam lazim" sorusuna hemen cevap
// bulsun diye - en sik yapilan 4 islem, buyuk ve belirgin butonlar olarak
// sayfanin en ustunde. Her buton, ilgili sayfaya goturur.
const HIZLI_ISLEMLER = [
  { etiket: 'Yeni Sipariş', aciklama: 'Tedarikçiden mal alımı başlat', yol: '/siparisler', renk: 'var(--lacivert)' },
  { etiket: 'Satış Yap', aciklama: 'Müşteriye ürün sat', yol: '/satis-yap', renk: 'var(--yesil)' },
  { etiket: 'Ödeme / Tahsilat', aciklama: 'Cari bazlı borç-alacak işlemleri', yol: '/cariler', renk: 'var(--amber, #d97706)' },
  { etiket: 'Yeni Cari', aciklama: 'Müşteri/tedarikçi ekle', yol: '/cariler', renk: 'var(--metin-ikincil)' },
];

function HizliIslemlerKutusu({ navigate }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
      {HIZLI_ISLEMLER.map((h) => (
        <button
          key={h.etiket}
          onClick={() => navigate(h.yol)}
          style={{
            textAlign: 'left', padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
            border: `1.5px solid ${h.renk}`, background: 'white',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: h.renk }}>{h.etiket}</div>
          <div style={{ fontSize: 12, color: 'var(--metin-ikincil)' }}>{h.aciklama}</div>
        </button>
      ))}
    </div>
  );
}

// Programi ILK KEZ acan biri, "burada ne yapacagim" sorusuna hemen cevap
// bulsun diye - sistemin TEMEL AKISINI (Siparis -> Teslim Al -> Satis ->
// Tahsilat) 4 kisa adimda ozetleyen bir karsilama ekrani. localStorage'da
// bir bayrakla SADECE ilk girişte gösterilir, "Anladım" ile kapatılınca
// bir daha çıkmaz (kullanıcı isterse Dashboard'daki (?) ile tekrar açabilir).
const KARSILAMA_ANAHTARI = 'kinetik_erp_karsilama_gosterildi';

const AKIS_ADIMLARI = [
  { no: 1, baslik: 'Sipariş Ver', aciklama: 'Tedarikçiden mal alımı için Siparişler sayfasından yeni sipariş oluştur.' },
  { no: 2, baslik: 'Teslim Al', aciklama: 'Mal geldiğinde, seri numaralarını girerek envantere (Stok) ekle.' },
  { no: 3, baslik: 'Maliyetleri Tamamla', aciklama: 'Navlun, gümrük, sigorta gibi ek masrafları siparişe işle.' },
  { no: 4, baslik: 'Sat ve Tahsil Et', aciklama: 'Müşteriye peşin/taksitli/leasingli satış yap, ödemeleri Finansal Takip\'ten izle.' },
];

function KarsilamaModali({ onKapat }) {
  return (
    <div
      onClick={onKapat}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,25,40,0.55)', zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 14, padding: 28, maxWidth: 520, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Kinetik ERP'ye Hoş Geldiniz 👋</div>
        <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 20, lineHeight: 1.5 }}>
          Bu sistem, forklift ithalat ve satış sürecinizin tamamını (sipariş, envanter, ödeme, kiralama)
          tek bir yerden yönetmeniz için tasarlandı. İşte tipik bir akış:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
          {AKIS_ADIMLARI.map((a) => (
            <div key={a.no} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', background: 'var(--lacivert)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                flexShrink: 0,
              }}>
                {a.no}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.baslik}</div>
                <div style={{ fontSize: 12, color: 'var(--metin-ikincil)' }}>{a.aciklama}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--metin-soluk)', marginBottom: 16 }}>
          İpucu: Üstteki arama kutusuna "/" ile odaklanıp "sipariş", "satış" gibi kelimeler yazarak
          da ilgili sayfaya hızlıca gidebilirsiniz.
        </div>
        <Buton onClick={onKapat}>Anladım, Başlayalım</Buton>
      </div>
    </div>
  );
}

export default function DashboardSayfasi() {
  const navigate = useNavigate();
  const [karsilamaAcik, setKarsilamaAcik] = useState(() => !localStorage.getItem(KARSILAMA_ANAHTARI));

  function karsilamayiKapat() {
    localStorage.setItem(KARSILAMA_ANAHTARI, '1');
    setKarsilamaAcik(false);
  }

  return (
    <div>
      {karsilamaAcik && <KarsilamaModali onKapat={karsilamayiKapat} />}
      <SayfaBasligi
        baslik="Dashboard"
        aciklama="Genel durumunuza hızlı bakış — herhangi bir kutuya tıklayarak ilgili ekrana gidebilirsiniz"
        eylem={
          <button
            onClick={() => setKarsilamaAcik(true)}
            style={{ fontSize: 12.5, color: 'var(--lacivert)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Hızlı tanıtımı tekrar göster
          </button>
        }
      />
      <HizliIslemlerKutusu navigate={navigate} />
      <NetDurumKutusu />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <AnaKasaKutusu navigate={navigate} />
        <BankalarKutusu navigate={navigate} />
        <StokKutusu navigate={navigate} />
        <YedekParcaKutusu navigate={navigate} />
        <KiralikUrunlerKutusu navigate={navigate} />
        <OdemeAlacakKutusu navigate={navigate} />
      </div>
      <SonIslemlerKutusu />
    </div>
  );
}
