import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../../api/client';
import {
  Kart, Alan, girdiStili, HataMesaji, paraFormat, Buton, eylemChipStili, ParaGirdisi, BosDurum,
} from '../Ortak';

export function tarihFormat(iso) {
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return iso || '—';
  const [yil, ay, gun] = iso.slice(0, 10).split('-');
  if (!yil || !ay || !gun) return iso;
  return `${gun}/${ay}/${yil}`;
}

export function useSiralama() {
  const [alan, setAlan] = useState(null);
  const [yon, setYon] = useState('asc');
  function tikla(yeniAlan) {
    if (alan === yeniAlan) setYon((y) => (y === 'asc' ? 'desc' : 'asc'));
    else { setAlan(yeniAlan); setYon('asc'); }
  }
  function sirala(liste, degerFn) {
    if (!alan) return liste;
    return [...liste].sort((a, b) => {
      const av = degerFn(a, alan);
      const bv = degerFn(b, alan);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') {
        return yon === 'asc' ? av.localeCompare(bv, 'tr') : bv.localeCompare(av, 'tr');
      }
      return yon === 'asc' ? av - bv : bv - av;
    });
  }
  return { alan, yon, tikla, sirala };
}

export function SiraliBaslik({ children, alanAdi, siralama, style }) {
  const aktif = siralama.alan === alanAdi;
  return (
    <th
      onClick={() => siralama.tikla(alanAdi)}
      style={{
        textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)',
        fontWeight: 500, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style,
      }}
    >
      {children} {aktif ? (siralama.yon === 'asc' ? '▲' : '▼') : ''}
    </th>
  );
}

export function BasitTablo({ basliklar, satirlar, render, siralama, tarihAlani }) {
  // NOT: useTarihGruplama, Fragment, YilBasligi, AyBasligi bu dosyaya tasinmadi -
  // tarihAlani kullanan cagiranlar (varsa) kendi sayfalarinda import edip
  // kullanmali. Bu fonksiyon, tarihAlani verilmediginde (coğu kullanim) sorunsuz calisir.
  if (satirlar.length === 0) return <BosDurum baslik="Kayıt bulunamadı" />;

  return (
    <table>
      <thead>
        <tr style={{ background: 'var(--zemin)' }}>
          {basliklar.map((b) => {
            const etiket = typeof b === 'string' ? b : b.etiket;
            const alan = typeof b === 'string' ? null : b.alan;
            const tiklanabilir = !!(siralama && alan);
            const aktif = tiklanabilir && siralama.alan === alan;
            return (
              <th
                key={etiket}
                onClick={tiklanabilir ? () => siralama.tikla(alan) : undefined}
                style={{
                  textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)',
                  fontWeight: 500, cursor: tiklanabilir ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap',
                }}
              >
                {etiket}{aktif ? ` ${siralama.yon === 'asc' ? '▲' : '▼'}` : ''}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {satirlar.map(render)}
      </tbody>
    </table>
  );
}

export function useCariHaritasi() {
  const [harita, setHarita] = useState({});
  useEffect(() => {
    api.get('/cariler')
      .then((r) => {
        const h = {};
        r.data.forEach((c) => { h[c.id] = c.unvan; });
        setHarita(h);
      })
      .catch(() => {});
  }, []);
  return harita;
}

export function useCariler() {
  const [cariler, setCariler] = useState([]);
  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);
  return cariler;
}

export function useKurlar() {
  const [kurlar, setKurlar] = useState({ USD: null, EUR: null });
  useEffect(() => {
    api.get('/kur/USD').then((r) => setKurlar((k) => ({ ...k, USD: Number(r.data.kur) }))).catch(() => {});
    api.get('/kur/EUR').then((r) => setKurlar((k) => ({ ...k, EUR: Number(r.data.kur) }))).catch(() => {});
  }, []);
  return kurlar;
}

export function tlKarsiligiGoster(tutar, paraBirimi, kurlar) {
  if (paraBirimi === 'TRY') return '—';
  const kur = kurlar[paraBirimi];
  if (!kur) return '—';
  return paraFormat(Number(tutar) * kur);
}

export function useUrunSecenekleri() {
  const [urunler, setUrunler] = useState([]);
  const [kartlar, setKartlar] = useState([]);
  useEffect(() => {
    api.get('/stok-seri-no').then((r) => setUrunler(r.data)).catch(() => {});
    api.get('/stok-kartlari').then((r) => setKartlar(r.data)).catch(() => {});
  }, []);
  return urunler.map((u) => {
    const kart = kartlar.find((k) => k.id === u.stok_karti_id);
    return { ...u, etiket: kart ? `${u.seri_no} — ${kart.marka} ${kart.model}` : u.seri_no };
  });
}

export function useUrunTanimlari() {
  const [kartlar, setKartlar] = useState([]);
  useEffect(() => {
    api.get('/stok-kartlari').then((r) => setKartlar(r.data)).catch(() => {});
  }, []);
  return kartlar;
}

export function useHarcamaTurleri(tetikleyici) {
  const [turler, setTurler] = useState([]);
  useEffect(() => {
    api.get('/harcama-turleri').then((r) => {
      const adlar = r.data.map((t) => t.ad);
      setTurler(adlar.includes('Diğer') ? adlar : [...adlar, 'Diğer']);
    }).catch(() => setTurler(['Diğer']));
  }, [tetikleyici]); // eslint-disable-line
  return turler;
}

export function cariGoster(id, harita) {
  if (id === null || id === undefined || id === '') return '—';
  const unvan = harita[id];
  return unvan ? `#${id} — ${unvan}` : `#${id}`;
}

export function DovizKarsiligiGosterge({ tutar, paraBirimi }) {
  const [kur, setKur] = useState('1');
  useEffect(() => {
    if (!paraBirimi || paraBirimi === 'TRY') return;
    api.get(`/kur/${paraBirimi}`).then((r) => setKur(r.data.kur)).catch(() => {});
  }, [paraBirimi]);

  if (!paraBirimi || paraBirimi === 'TRY') return null;
  const tl = tutar ? Number(tutar) * (Number(kur) || 0) : null;

  return (
    <Alan etiket={`${paraBirimi} için TL kuru (yaklaşık, bilgi amaçlı)`}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="number" step="0.0001" value={kur} onChange={(e) => setKur(e.target.value)} style={{ ...girdiStili, width: 100 }} />
        {tl != null && <span style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', whiteSpace: 'nowrap' }}>≈ {paraFormat(tl)}</span>}
      </div>
    </Alan>
  );
}

export function OdemeFormu({ tutar: tutarProp, paraBirimi = 'TRY', aksiyonMetni = 'Ödemeyi tamamla', onOde, onVazgec, tutarDuzenlenebilir = false, tutarEtiketi = 'Tahsil edilecek tutar (TL)' }) {
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [yontem, setYontem] = useState('NAKIT');
  const [bankaHesapId, setBankaHesapId] = useState('');
  const [kur, setKur] = useState('1');
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [tutarDuzenlenmis, setTutarDuzenlenmis] = useState(String(tutarProp));
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
    if (paraBirimi !== 'TRY') {
      api.get(`/kur/${paraBirimi}`).then((r) => setKur(r.data.kur)).catch(() => {});
    }
  }, []); // eslint-disable-line

  const dovizli = paraBirimi !== 'TRY';
  const tutarHesap = tutarDuzenlenebilir ? tutarDuzenlenmis : tutarProp;
  const tlKarsiligi = dovizli && tutarHesap ? (Number(tutarHesap) * (Number(kur) || 0)) : null;

  async function gonder(e) {
    e.preventDefault();
    setHata(null);
    if (yontem === 'BANKA' && !bankaHesapId) {
      setHata('Lütfen banka hesabı seçin.');
      return;
    }
    if (tutarDuzenlenebilir && (!tutarDuzenlenmis || Number(tutarDuzenlenmis) <= 0)) {
      setHata('Lütfen geçerli bir tutar girin.');
      return;
    }
    setKaydediliyor(true);
    try {
      await onOde({
        odeme_tarihi: tarih,
        odeme_yontemi: yontem,
        banka_hesap_id: yontem === 'BANKA' ? Number(bankaHesapId) : null,
        kur: dovizli ? Number(kur) : null,
        ...(tutarDuzenlenebilir ? { tutar: Number(tutarDuzenlenmis) } : {}),
      });
    } catch (err) {
      setHata(hataMesajiCikar(err));
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ padding: 14, background: 'var(--zemin)', border: '1px solid var(--kenarlik)', borderRadius: 8, marginTop: 8 }}>
      <form onSubmit={gonder}>
        <HataMesaji>{hata}</HataMesaji>
        {tutarDuzenlenebilir && (
          <div style={{ marginBottom: 10, maxWidth: 220 }}>
            <Alan etiket={tutarEtiketi}>
              <ParaGirdisi required value={tutarDuzenlenmis} onChange={(v) => setTutarDuzenlenmis(v)} />
            </Alan>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: dovizli ? (yontem === 'BANKA' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr') : '1fr 1fr', gap: 10 }}>
          <Alan etiket="Ödeme yöntemi">
            <select value={yontem} onChange={(e) => setYontem(e.target.value)} style={girdiStili}>
              <option value="NAKIT">Nakit (Ana Kasa)</option>
              <option value="BANKA">Banka</option>
            </select>
          </Alan>
          {yontem === 'BANKA' && (
            <Alan etiket="Banka hesabı">
              <select required value={bankaHesapId} onChange={(e) => setBankaHesapId(e.target.value)} style={girdiStili}>
                <option value="">Seçin...</option>
                {bankaHesaplari.map((h) => (
                  <option key={h.banka_hesap_id} value={h.banka_hesap_id}>
                    {h.banka_adi} — {h.hesap_adi || h.para_birimi} ({h.para_birimi})
                  </option>
                ))}
              </select>
            </Alan>
          )}
          {dovizli && (
            <Alan etiket={`${paraBirimi} için TL kuru (otomatik, elle değiştirilebilir)`}>
              <input required type="number" step="0.0001" value={kur} onChange={(e) => setKur(e.target.value)} style={girdiStili} />
            </Alan>
          )}
          <Alan etiket="Tarih">
            <input required type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={girdiStili} />
          </Alan>
        </div>
        {tlKarsiligi != null && (
          <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginTop: 6 }}>
            TL karşılığı: <strong>{paraFormat(tlKarsiligi)}</strong>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : aksiyonMetni}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </div>
  );
}
