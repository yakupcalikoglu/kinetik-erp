import { useState, useEffect } from 'react';

export function Kart({ children, style }) {
  return (
    <div
      style={{
        background: 'var(--yuzey)',
        border: '1px solid var(--kenarlik)',
        borderRadius: 'var(--radius-buyuk)',
        padding: 20,
        boxShadow: 'var(--golge-sm)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SayfaBasligi({ baslik, aciklama, eylem }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{baslik}</h1>
        {aciklama && (
          <p style={{ fontSize: 13.5, color: 'var(--metin-ikincil)', margin: '4px 0 0' }}>{aciklama}</p>
        )}
      </div>
      {eylem}
    </div>
  );
}

export function Buton({ children, variant = 'birincil', ...props }) {
  const stiller = {
    birincil: { background: 'var(--lacivert)', color: 'white', border: '1px solid var(--lacivert)' },
    ikincil: { background: 'white', color: 'var(--metin-birincil)', border: '1px solid var(--kenarlik-koyu)' },
    tehlike: { background: 'var(--kirmizi-acik)', color: 'var(--kirmizi)', border: '1px solid var(--kirmizi-acik)' },
  };
  return (
    <button
      {...props}
      style={{
        padding: '8px 16px',
        borderRadius: 7,
        fontSize: 13.5,
        fontWeight: 500,
        opacity: props.disabled ? 0.55 : 1,
        ...stiller[variant],
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

export function Etiket({ children, ton = 'notr' }) {
  const tonlar = {
    notr: { background: '#F1F2F4', color: 'var(--metin-ikincil)' },
    yesil: { background: 'var(--yesil-acik)', color: 'var(--yesil)' },
    kirmizi: { background: 'var(--kirmizi-acik)', color: 'var(--kirmizi)' },
    amber: { background: 'var(--amber-acik)', color: 'var(--amber)' },
  };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 9px',
        borderRadius: 5,
        fontSize: 12,
        fontWeight: 500,
        ...tonlar[ton],
      }}
    >
      {children}
    </span>
  );
}

export function Alan({ etiket, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 5 }}>
        {etiket}
      </span>
      {children}
    </label>
  );
}

export const girdiStili = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--kenarlik-koyu)',
  borderRadius: 7,
  background: 'white',
};

export function BosDurum({ baslik, aciklama }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--metin-soluk)' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', opacity: 0.35 }}>
        <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M3 7l9 4 9-4M12 11v10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--metin-ikincil)', marginBottom: 4 }}>{baslik}</div>
      {aciklama && <div style={{ fontSize: 13 }}>{aciklama}</div>}
    </div>
  );
}

// Donen yukleniyor animasyonu - "Yukleniyor..." yazisinin yaninda/yerine
// kullanilabilir, boyut prop'u ile kucultup buyutebilirsiniz.
export function Spinner({ boyut = 18, renk = 'currentColor' }) {
  return (
    <svg
      width={boyut} height={boyut} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'kinetikDonme 0.8s linear infinite', display: 'inline-block', verticalAlign: 'middle' }}
    >
      <circle cx="12" cy="12" r="9" stroke={renk} strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={renk} strokeWidth="2.5" strokeLinecap="round" />
      <style>{'@keyframes kinetikDonme { to { transform: rotate(360deg); } }'}</style>
    </svg>
  );
}

// Yukleniyor... yazisinin yerine kullanilabilecek, spinner+metin birlesimi
export function YukleniyorGosterge({ metin = 'Yükleniyor...' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--metin-soluk)', padding: '20px 0' }}>
      <Spinner boyut={16} />
      <span>{metin}</span>
    </div>
  );
}

export function HataMesaji({ children }) {
  if (!children) return null;
  return (
    <div
      style={{
        background: 'var(--kirmizi-acik)',
        color: 'var(--kirmizi)',
        padding: '10px 14px',
        borderRadius: 7,
        fontSize: 13,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

export function Sekmeler({ sekmeler, aktif, onDegistir }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--kenarlik)', marginBottom: 20 }}>
      {sekmeler.map((s) => (
        <button
          key={s.deger}
          onClick={() => onDegistir(s.deger)}
          style={{
            padding: '9px 16px',
            background: 'none',
            border: 'none',
            borderBottom: aktif === s.deger ? '2px solid var(--lacivert)' : '2px solid transparent',
            color: aktif === s.deger ? 'var(--lacivert)' : 'var(--metin-ikincil)',
            fontWeight: aktif === s.deger ? 600 : 400,
            fontSize: 13.5,
            marginBottom: -1,
          }}
        >
          {s.etiket}
        </button>
      ))}
    </div>
  );
}

export function tarihFormat(deger) {
  if (!deger) return '—';
  return deger;
}

export function paraFormat(deger, paraBirimi = 'TRY') {
  if (deger === null || deger === undefined) return '—';
  const sembol = { TRY: '₺', USD: '$', EUR: '€', ALTIN: 'gr' }[paraBirimi] || '';
  return `${Number(deger).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sembol}`;
}
// Küçük, renkli "chip" tarzı işlem butonu/linki.
// ton: 'lacivert' | 'yesil' | 'kirmizi' | 'notr'
const EYLEM_CHIP_RENK = {
  lacivert: { bg: '#e8edf7', renk: '#1e3a6e' },
  yesil: { bg: '#e3f5e9', renk: '#1c7c4c' },
  kirmizi: { bg: '#fdeaea', renk: '#c0392b' },
  notr: { bg: '#f1f2f4', renk: '#5a6472' },
};

export function eylemChipStili(ton = 'notr') {
  const { bg, renk } = EYLEM_CHIP_RENK[ton] || EYLEM_CHIP_RENK.notr;
  return {
    background: bg,
    color: renk,
    border: 'none',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    lineHeight: 1.4,
  };
}
export const BIRIM_SECENEKLERI = [
  'ADET', 'KG', 'LT', 'M', 'M2', 'M3', 'TON', 'PAKET', 'KUTU', 'ÇİFT', 'TAKIM',
];
// Metin girerken birkac harf yazinca ya da acilir listeden secim yapilabilen
// otomatik tamamlama girdisi. Native <datalist> kullanir; ekstra kutuphane
// gerektirmez, klavye/mouse ile secim ve serbest metin girisi ikisini de destekler.
export function OtomatikTamamlamaGirdisi({ value, onChange, secenekler, placeholder, listeId, required }) {
  return (
    <>
      <input
        required={required}
        list={listeId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={girdiStili}
      />
      <datalist id={listeId}>
        {secenekler.map((s) => <option key={s} value={s} />)}
      </datalist>
    </>
  );
}

// Para/tutar girisi icin: kullanici yazarken bile binlik ayiracini (1.000.000
// gibi) canli olarak gosterir. Disariya (onChange) HER ZAMAN ham, noktali
// ondalikli bir string dondurur (orn. "1234.5") - form state'i hep temiz
// sayisal deger tutar, gosterim ayri bir katmandir.
// Kullanimi standart <input type="number"> ile ayni: value + onChange(deger).
export function ParaGirdisi({ value, onChange, style, placeholder, required, disabled }) {
  function hamDegerdenGorunume(hamStr) {
    if (hamStr === '' || hamStr === null || hamStr === undefined) return '';
    const [tamKisim, ondalikKisim] = String(hamStr).split('.');
    const eksiMi = tamKisim.startsWith('-');
    const tamKismiTemiz = eksiMi ? tamKisim.slice(1) : tamKisim;
    const tamFormatli = tamKismiTemiz.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const isaretli = eksiMi ? `-${tamFormatli}` : tamFormatli;
    return ondalikKisim !== undefined ? `${isaretli},${ondalikKisim}` : isaretli;
  }

  function degisti(e) {
    const girilen = e.target.value;
    // Sadece rakam, eksi isareti ve virgul (ondalik ayiraci) kabul et; nokta
    // (kullanicinin gordugu binlik ayiraci) yok sayilir - tekrar hesaplanir.
    let sadeceGecerli = girilen.replace(/[^0-9,-]/g, '');
    const eksiMi = sadeceGecerli.startsWith('-');
    sadeceGecerli = sadeceGecerli.replace(/-/g, '');
    const parcalar = sadeceGecerli.split(',');
    const tamKisim = parcalar[0] || '';
    const ondalikKisim = parcalar.length > 1 ? parcalar.slice(1).join('') : undefined;
    let hamDeger = ondalikKisim !== undefined ? `${tamKisim}.${ondalikKisim}` : tamKisim;
    if (eksiMi && hamDeger) hamDeger = `-${hamDeger}`;
    onChange(hamDeger);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      required={required}
      disabled={disabled}
      value={hamDegerdenGorunume(value)}
      onChange={degisti}
      placeholder={placeholder}
      style={{ ...girdiStili, textAlign: 'right', ...style }}
    />
  );
}

// Uzun listeleri (Cari, Stok, Siparis vb.) kisa tutmak icin: baslangicta
// sadece ilk N kaydi gosterir, "Daha Fazla Goster" ile genisletir. Backend'e
// dokunmadan, sadece GORUNUMU sinirlar (veri zaten yuklu).
export function useKademelıGoster(liste, sayfaBoyu = 50) {
  const [gosterilenSayi, setGosterilenSayi] = useState(sayfaBoyu);
  useEffect(() => { setGosterilenSayi(sayfaBoyu); }, [liste.length]); // eslint-disable-line
  return {
    gosterilecekler: liste.slice(0, gosterilenSayi),
    dahaFazlaVarMi: liste.length > gosterilenSayi,
    dahaFazlaGoster: () => setGosterilenSayi((n) => n + sayfaBoyu),
    toplamSayi: liste.length,
    gosterilenSayi: Math.min(gosterilenSayi, liste.length),
  };
}

export function DahaFazlaGosterButonu({ kademe }) {
  if (!kademe.dahaFazlaVarMi) return null;
  return (
    <div style={{ textAlign: 'center', padding: '14px 0' }}>
      <button
        onClick={kademe.dahaFazlaGoster}
        style={{
          padding: '9px 20px', borderRadius: 7, border: '1px solid var(--kenarlik-koyu)',
          background: 'white', cursor: 'pointer', fontSize: 13, color: 'var(--metin-birincil)',
        }}
      >
        {kademe.gosterilenSayi} / {kademe.toplamSayi} gösteriliyor — daha fazla göster
      </button>
    </div>
  );
}
