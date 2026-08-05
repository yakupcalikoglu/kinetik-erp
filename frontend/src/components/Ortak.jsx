import { useState, useEffect, useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';

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
  const [hover, setHover] = useState(false);
  const aktifHover = hover && !props.disabled;
  const stiller = {
    birincil: {
      background: aktifHover ? '#16305c' : 'var(--lacivert)',
      color: 'white', border: '1px solid var(--lacivert)',
      boxShadow: aktifHover ? '0 5px 14px rgba(30,58,110,0.3)' : '0 1px 2px rgba(30,58,110,0.12)',
    },
    ikincil: {
      background: aktifHover ? 'var(--zemin, #eef1f7)' : 'white',
      color: 'var(--metin-birincil)', border: '1px solid var(--kenarlik-koyu)',
      boxShadow: aktifHover ? '0 3px 10px rgba(0,0,0,0.08)' : 'none',
    },
    tehlike: {
      background: aktifHover ? '#fadbdb' : 'var(--kirmizi-acik)',
      color: 'var(--kirmizi)', border: '1px solid var(--kirmizi-acik)',
      boxShadow: aktifHover ? '0 3px 10px rgba(192,57,43,0.18)' : 'none',
    },
  };
  return (
    <button
      {...props}
      onMouseEnter={(e) => { setHover(true); props.onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); props.onMouseLeave?.(e); }}
      style={{
        padding: '8px 16px',
        borderRadius: 7,
        fontSize: 13.5,
        fontWeight: 500,
        opacity: props.disabled ? 0.55 : 1,
        cursor: props.disabled ? 'default' : 'pointer',
        transition: 'background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
        transform: aktifHover ? 'translateY(-1px)' : 'none',
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
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        animation: 'kinetikHataGir 0.2s ease-out',
      }}
    >
      <span style={{ flexShrink: 0, fontSize: 14, lineHeight: 1.4 }}>⚠</span>
      <span style={{ lineHeight: 1.5 }}>{children}</span>
      <style>{`
        @keyframes kinetikHataGir {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
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

// "..." (uc nokta) acilir menusu - az kullanilan islemleri (Yazdir, Excel
// Indir/Ice Aktar vb.) tek bir kompakt buton altinda toplamak icin.
// ogeler: [{ etiket, onClick }]
export function DahaFazlaMenu({ ogeler, kompakt = false }) {
  const [acik, setAcik] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  const kutuRef = useRef(null);

  useEffect(() => {
    function disaTikla(e) {
      if (kutuRef.current && !kutuRef.current.contains(e.target)) setAcik(false);
    }
    document.addEventListener('mousedown', disaTikla);
    return () => document.removeEventListener('mousedown', disaTikla);
  }, []);

  return (
    <div ref={kutuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setAcik((a) => !a)}
        style={{
          padding: kompakt ? 6 : 9,
          borderRadius: 8,
          border: acik ? '1.5px solid var(--lacivert)' : '1px solid var(--kenarlik-koyu)',
          background: acik ? 'var(--lacivert)' : 'white',
          color: acik ? 'white' : 'var(--metin-ikincil)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
        title="Diğer işlemler"
      >
        <MoreHorizontal size={kompakt ? 15 : 17} />
      </button>
      {acik && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, background: 'white',
          border: '1px solid var(--kenarlik)', borderRadius: 10, boxShadow: '0 8px 28px rgba(30,58,110,0.16)',
          zIndex: 50, minWidth: 210, overflow: 'hidden', padding: 4,
        }}>
          {ogeler.map((oge, i) => (
            <button
              key={i}
              onClick={() => { oge.onClick(); setAcik(false); }}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
                border: 'none', borderRadius: 6, marginBottom: 1,
                background: hoverIndex === i ? 'var(--zemin, #eef1f7)' : 'none',
                color: hoverIndex === i ? 'var(--lacivert)' : 'var(--metin-birincil)',
                cursor: 'pointer', fontSize: 13, fontWeight: hoverIndex === i ? 500 : 400,
                transition: 'background 0.1s',
              }}
            >
              {oge.etiket}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
