import { useState, useEffect, useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { api, hataMesajiCikar, ozelOnayIste } from '../api/client';

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

// Programi hic bilmeyen biri "Akreditif ile Leasing farki ne" gibi
// SEKTOR terimlerini bilmeyebilir - kucuk bir (?) ikonu, TIKLANINCA kisa
// bir aciklama gosterir. Hover DEGIL tiklama kullanilir (mobil/dokunmatik
// ekranlarda da calissin diye).
// Kullanici uzun bir formu doldururken YANLISLIKLA sekmeyi kapatirsa/
// yenilerse, veriler kaybolmadan ONCE tarayicinin KENDI (native) "Bu
// sayfadan ayrilmak istediginizden emin misiniz?" uyarisini gostermek
// icin. Kullanimi: useKirliFormUyarisi(form degisti mi BOOLEAN'i).
// NOT: Bu SADECE sekme kapama/yenileme/disarida bir URL'e gitme gibi
// TARAYICI SEVIYESI navigasyonlari yakalar - uygulama ICI (React Router)
// sayfa gecislerini KAPSAMAZ, cunku o GUVENILIR bicimde react-router-dom
// surumune bagli bir API gerektirir.
export function useKirliFormUyarisi(kirliMi) {
  useEffect(() => {
    function beforeUnload(e) {
      if (!kirliMi) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [kirliMi]);
}

export function BilgiIpucu({ metin }) {
  const [acik, setAcik] = useState(false);
  const kutuRef = useRef(null);

  useEffect(() => {
    if (!acik) return;
    function disaTikla(e) {
      if (kutuRef.current && !kutuRef.current.contains(e.target)) setAcik(false);
    }
    document.addEventListener('mousedown', disaTikla);
    return () => document.removeEventListener('mousedown', disaTikla);
  }, [acik]);

  return (
    <span ref={kutuRef} style={{ position: 'relative', display: 'inline-block', marginLeft: 5 }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setAcik((a) => !a); }}
        title="Bilgi"
        style={{
          width: 15, height: 15, borderRadius: '50%', border: '1px solid var(--metin-soluk)',
          background: 'transparent', color: 'var(--metin-soluk)', fontSize: 10, fontWeight: 700,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, lineHeight: 1, verticalAlign: 'middle',
        }}
      >
        ?
      </button>
      {acik && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: '130%', left: 0, zIndex: 80, width: 240,
            background: 'var(--lacivert-koyu, #16233f)', color: 'white', fontSize: 12, fontWeight: 400,
            lineHeight: 1.5, padding: '10px 12px', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
          }}
        >
          {metin}
        </div>
      )}
    </span>
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

// Bagimlilik gerektirmeyen (npm install gerekmeyen), saf SVG tabanli cizgi
// grafik. veri: [{ etiket: 'Oca', alan1: 100, alan2: 50 }, ...]
// cizgiler: [{ alan: 'alan1', renk: '#1e3a6e', ad: 'Gelir' }, ...]
export function CizgiGrafik({ veri, cizgiler, yukseklik = 200 }) {
  const genislik = 640;
  const kb = { sol: 55, sag: 16, ust: 16, alt: 26 };
  const gg = genislik - kb.sol - kb.sag;
  const gy = yukseklik - kb.ust - kb.alt;

  if (!veri || veri.length === 0) {
    return <div style={{ color: 'var(--metin-soluk)', fontSize: 13, padding: '20px 0' }}>Gösterilecek veri yok.</div>;
  }

  const tumDegerler = veri.flatMap((v) => cizgiler.map((c) => Number(v[c.alan]) || 0));
  const maxDeger = Math.max(...tumDegerler, 0);
  const minDeger = Math.min(...tumDegerler, 0);
  const araligi = (maxDeger - minDeger) || 1;

  function xKonum(i) {
    return kb.sol + (veri.length > 1 ? (i / (veri.length - 1)) * gg : gg / 2);
  }
  function yKonum(deger) {
    return kb.ust + gy - ((deger - minDeger) / araligi) * gy;
  }

  const etiketAraligi = Math.max(1, Math.ceil(veri.length / 8));

  return (
    <div>
      <svg viewBox={`0 0 ${genislik} ${yukseklik}`} style={{ width: '100%', height: yukseklik, display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((oran) => (
          <line
            key={oran} x1={kb.sol} x2={genislik - kb.sag}
            y1={kb.ust + oran * gy} y2={kb.ust + oran * gy}
            stroke="var(--kenarlik)" strokeWidth="1"
          />
        ))}
        {minDeger < 0 && maxDeger > 0 && (
          <line x1={kb.sol} y1={yKonum(0)} x2={genislik - kb.sag} y2={yKonum(0)} stroke="var(--kenarlik-koyu)" strokeWidth="1" strokeDasharray="3,3" />
        )}
        {cizgiler.map((c) => {
          const noktalar = veri.map((v, i) => `${xKonum(i)},${yKonum(Number(v[c.alan]) || 0)}`).join(' ');
          return (
            <g key={c.alan}>
              <polyline points={noktalar} fill="none" stroke={c.renk} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {veri.map((v, i) => (
                <circle key={i} cx={xKonum(i)} cy={yKonum(Number(v[c.alan]) || 0)} r="3" fill={c.renk} />
              ))}
            </g>
          );
        })}
        {veri.map((v, i) => (
          i % etiketAraligi === 0 && (
            <text key={i} x={xKonum(i)} y={yukseklik - 6} fontSize="10" fill="var(--metin-ikincil)" textAnchor="middle">
              {v.etiket}
            </text>
          )
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {cizgiler.map((c) => (
          <div key={c.alan} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--metin-ikincil)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.renk, display: 'inline-block' }} />
            {c.ad}
          </div>
        ))}
      </div>
    </div>
  );
}

// Bagimlilik gerektirmeyen, saf SVG tabanli bar grafik.
// veri: [{ etiket: '30 Gün', deger: 100 }, ...]
export function BarGrafik({ veri, alan = 'deger', renk = 'var(--lacivert, #1e3a6e)', yukseklik = 200 }) {
  const genislik = 640;
  const kb = { sol: 55, sag: 16, ust: 16, alt: 26 };
  const gg = genislik - kb.sol - kb.sag;
  const gy = yukseklik - kb.ust - kb.alt;

  if (!veri || veri.length === 0) {
    return <div style={{ color: 'var(--metin-soluk)', fontSize: 13, padding: '20px 0' }}>Gösterilecek veri yok.</div>;
  }

  const degerler = veri.map((v) => Number(v[alan]) || 0);
  const maxDeger = Math.max(...degerler, 0);
  const minDeger = Math.min(...degerler, 0);
  const araligi = (maxDeger - minDeger) || 1;
  const sifirY = kb.ust + gy - ((0 - minDeger) / araligi) * gy;

  const adimGenislik = gg / veri.length;
  const barGenislik = adimGenislik * 0.55;

  return (
    <svg viewBox={`0 0 ${genislik} ${yukseklik}`} style={{ width: '100%', height: yukseklik, display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((oran) => (
        <line
          key={oran} x1={kb.sol} x2={genislik - kb.sag}
          y1={kb.ust + oran * gy} y2={kb.ust + oran * gy}
          stroke="var(--kenarlik)" strokeWidth="1"
        />
      ))}
      {veri.map((v, i) => {
        const deger = Number(v[alan]) || 0;
        const barYukseklik = Math.abs((deger - 0) / araligi) * gy;
        const x = kb.sol + i * adimGenislik + (adimGenislik - barGenislik) / 2;
        const y = deger >= 0 ? sifirY - barYukseklik : sifirY;
        const dolgu = deger >= 0 ? renk : 'var(--kirmizi, #c0392b)';
        return (
          <g key={i}>
            <rect x={x} y={y} width={barGenislik} height={Math.max(barYukseklik, 1)} fill={dolgu} rx="3" />
            <text x={x + barGenislik / 2} y={yukseklik - 6} fontSize="10" fill="var(--metin-ikincil)" textAnchor="middle">
              {v.etiket}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Uzun tarihli listeleri (Banka/Kasa hareketleri, Cek, Bakim vb.) Yil -> Ay
// seviyesinde katlanabilir gruplara ayirmak icin. tarihAlani formatinin
// "YYYY-MM-DD" (string, sozlesilebilir siralanan) oldugu varsayilir.
export const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function useTarihGruplama(liste, tarihAlani = 'tarih') {
  const [acikYillar, setAcikYillar] = useState(new Set());
  const [acikAylar, setAcikAylar] = useState(new Set());

  const gruplar = {}; // { "2026": { "2026-08": [...], "2026-07": [...] } }
  liste.forEach((item) => {
    const tarih = item[tarihAlani];
    if (!tarih) return;
    const yil = String(tarih).slice(0, 4);
    const ayAnahtari = String(tarih).slice(0, 7);
    if (!gruplar[yil]) gruplar[yil] = {};
    if (!gruplar[yil][ayAnahtari]) gruplar[yil][ayAnahtari] = [];
    gruplar[yil][ayAnahtari].push(item);
  });

  const yillar = Object.keys(gruplar).sort().reverse();

  // Ilk yuklemede, EN SON yilin EN SON ayini otomatik acik goster - kullanici
  // sifirdan tiklamak zorunda kalmasin, en guncel donem hazir gelsin.
  useEffect(() => {
    if (yillar.length > 0 && acikYillar.size === 0 && acikAylar.size === 0) {
      const enSonYil = yillar[0];
      const enSonAy = Object.keys(gruplar[enSonYil]).sort().reverse()[0];
      setAcikYillar(new Set([enSonYil]));
      setAcikAylar(new Set([enSonAy]));
    }
  }, [liste.length]); // eslint-disable-line

  function yilAcKapat(yil) {
    setAcikYillar((s) => {
      const yeni = new Set(s);
      if (yeni.has(yil)) yeni.delete(yil); else yeni.add(yil);
      return yeni;
    });
  }

  function ayAcKapat(ayAnahtari) {
    setAcikAylar((s) => {
      const yeni = new Set(s);
      if (yeni.has(ayAnahtari)) yeni.delete(ayAnahtari); else yeni.add(ayAnahtari);
      return yeni;
    });
  }

  return { gruplar, yillar, acikYillar, acikAylar, yilAcKapat, ayAcKapat };
}

// Ay basligi - tiklanabilir, acik/kapali oku + kayit sayisi + opsiyonel ozet
// metni (orn. "12 hareket — Toplam: 45.000 ₺") gosterir.
export function AyBasligi({ ayAnahtari, kayitSayisi, ozetMetni, acik, onTikla }) {
  const [, ayNo] = ayAnahtari.split('-');
  return (
    <div
      onClick={onTikla}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        cursor: 'pointer', background: acik ? 'var(--zemin, #f4f5f7)' : 'white',
        borderTop: '1px solid var(--kenarlik)', userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--metin-ikincil)', width: 12 }}>{acik ? '▼' : '▶'}</span>
      <span style={{ fontWeight: 600, fontSize: 13.5, minWidth: 90 }}>{AY_ADLARI[Number(ayNo) - 1]}</span>
      <span style={{ fontSize: 12.5, color: 'var(--metin-ikincil)' }}>
        {kayitSayisi} kayıt{ozetMetni ? ` — ${ozetMetni}` : ''}
      </span>
    </div>
  );
}

// Yil basligi - ayni mantik, biraz daha vurgulu (kalin, biraz daha buyuk).
export function YilBasligi({ yil, kayitSayisi, ozetMetni, acik, onTikla }) {
  return (
    <div
      onClick={onTikla}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        cursor: 'pointer', background: 'var(--lacivert, #1e3a6e)', color: 'white', userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 11, width: 12 }}>{acik ? '▼' : '▶'}</span>
      <span style={{ fontWeight: 700, fontSize: 14.5, minWidth: 60 }}>{yil}</span>
      <span style={{ fontSize: 12.5, opacity: 0.85 }}>
        {kayitSayisi} kayıt{ozetMetni ? ` — ${ozetMetni}` : ''}
      </span>
    </div>
  );
}

// Genel amacli, tek seviyeli katlanabilir grup basligi (Yil/Ay disindaki
// gruplamalar icin - orn. "Siparis No" bazli gruplama). YilBasligi ile
// ayni gorsel dile sahip.
export function GrupBasligi({ baslik, altBaslik, acik, onTikla }) {
  return (
    <div
      onClick={onTikla}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        cursor: 'pointer', background: 'var(--lacivert, #1e3a6e)', color: 'white', userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 11, width: 12 }}>{acik ? '▼' : '▶'}</span>
      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{baslik}</span>
      {altBaslik && <span style={{ fontSize: 12, opacity: 0.85 }}>{altBaslik}</span>}
    </div>
  );
}

// "Yukleniyor..." yazisi yerine, verinin seklini taklit eden hafif
// parlayan gri kutucuklar - daha canli/profesyonel bir yukleme hissi verir.
export function TabloIskeleti({ satirSayisi = 5, sutunSayisi = 6 }) {
  return (
    <div>
      {Array.from({ length: satirSayisi }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex', gap: 16, padding: '14px 16px', alignItems: 'center',
            borderTop: i > 0 ? '1px solid var(--kenarlik)' : 'none',
          }}
        >
          {Array.from({ length: sutunSayisi }).map((_, j) => (
            <div
              key={j}
              style={{
                height: 13, borderRadius: 4, flex: j === 0 ? 2 : 1,
                background: 'linear-gradient(90deg, #eef0f3 25%, #f7f8f9 50%, #eef0f3 75%)',
                backgroundSize: '200% 100%',
                animation: 'kinetikIskelet 1.4s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ))}
      <style>{`
        @keyframes kinetikIskelet {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export const MALIYET_TIP_METIN = {
  SATINALMA: 'Satınalma', NAKLIYE: 'Nakliye/Navlun', SIGORTA: 'Sigorta', GUMRUK: 'Gümrük', ANTREPO: 'Antrepo',
  MILLILESTIRME: 'Millileştirme', ARDIYE: 'Ardiye', ILAVE_GUMRUK_VERGISI: 'İlave Gümrük Vergisi',
  DAMGA_VERGISI: 'Damga Vergisi', TSE_UCRETI: 'TSE Ücreti', GUMRUKCU_MASRAFI: 'Gümrükçü Masrafı',
  BANKA_MASRAFI: 'Banka Masrafı', KDV: 'KDV', LEASING: 'Leasing', DIGER: 'Diğer',
};

// Satis turune gore (Leasing / Faturali) BEKLENEN maliyet kategorileri -
// SatisYapSayfasi'ndaki kontrol listesinde kullanilir.
export const LEASING_SATIS_MALIYET_TIPLERI = ['ARDIYE', 'GUMRUK', 'ILAVE_GUMRUK_VERGISI', 'DAMGA_VERGISI', 'TSE_UCRETI', 'LEASING', 'BANKA_MASRAFI'];
export const FATURALI_SATIS_MALIYET_TIPLERI = ['GUMRUK', 'ILAVE_GUMRUK_VERGISI', 'DAMGA_VERGISI', 'TSE_UCRETI', 'GUMRUKCU_MASRAFI', 'BANKA_MASRAFI', 'KDV'];

// Bir StokSeriNo urunune manuel maliyet kalemi eklemek icin genel amacli
// form - hem Siparisler (ithalat maliyetleri) hem Satis Yap (satis-sonrasi
// maliyetler) sayfalarinda kullanilir.
export function ManuelMaliyetKalemiEkleFormu({ urun, onKaydedildi, onVazgec, varsayilanTip = 'NAKLIYE', digerUrunler = null }) {
  const [cariler, setCariler] = useState([]);
  const [tumSiparriseDagit, setTumSiparriseDagit] = useState(false);
  const [form, setForm] = useState({
    tip: varsayilanTip, tutar: '', para_birimi: 'TRY', kur: '1', referans_usd_kuru: '',
    tedarikci_cari_id: '', belge_no: '', tarih: new Date().toISOString().slice(0, 10), aciklama: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.para_birimi === 'TRY') {
      setForm((f) => ({ ...f, kur: '1' }));
      api.get('/kur/USD').then((r) => setForm((f) => ({ ...f, referans_usd_kuru: r.data.kur }))).catch(() => {});
      return;
    }
    api.get(`/kur/${form.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: r.data.kur }))).catch(() => {});
  }, [form.para_birimi]); // eslint-disable-line

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      const girilenTutar = Number(form.tutar);
      const kurDeger = Number(form.kur);
      const tutarTry = form.para_birimi === 'TRY' ? girilenTutar : girilenTutar * kurDeger;
      const ortak = {
        tip: form.tip, para_birimi: form.para_birimi, kur: kurDeger,
        tedarikci_cari_id: form.tedarikci_cari_id ? Number(form.tedarikci_cari_id) : null,
        belge_no: form.belge_no || null, tarih: form.tarih, aciklama: form.aciklama || null,
        referans_usd_kuru: form.para_birimi === 'TRY' && form.referans_usd_kuru ? Number(form.referans_usd_kuru) : null,
      };

      if (tumSiparriseDagit && digerUrunler && digerUrunler.length > 1) {
        // Bu siparisteki TUM urunlere, satinalma maliyetine ORANTILI dagit
        // (hicbirinde satinalma maliyeti girilmemisse ESIT dagit).
        const toplamSatinalma = digerUrunler.reduce((acc, u) => acc + Number(u.satinalma_maliyeti_try || 0), 0);
        const basarisizlar = [];
        for (const u of digerUrunler) {
          const payTry = toplamSatinalma === 0
            ? tutarTry / digerUrunler.length
            : tutarTry * (Number(u.satinalma_maliyeti_try || 0) / toplamSatinalma);
          const payOrijinal = form.para_birimi === 'TRY' ? payTry : payTry / kurDeger;
          try {
            await api.post(`/stok-seri-no/${u.id}/maliyet-kalemi`, { ...ortak, tutar: payOrijinal });
          } catch (err) {
            basarisizlar.push(u.seri_no);
          }
        }
        if (basarisizlar.length > 0) {
          setHata(`Şu ürünlere eklenemedi: ${basarisizlar.join(', ')}`);
          setKaydediliyor(false);
          return;
        }
      } else {
        await api.post(`/stok-seri-no/${urun.id}/maliyet-kalemi`, { ...ortak, tutar: girilenTutar });
      }
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <form onSubmit={kaydet} style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8, marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
        {urun.seri_no} — Manuel maliyet kalemi ekle
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {digerUrunler && digerUrunler.length > 1 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={tumSiparriseDagit} onChange={(e) => setTumSiparriseDagit(e.target.checked)} />
          Bu tutarı, bu siparişteki {digerUrunler.length} ürünün tamamına satınalma maliyetine oranlı dağıt (sadece {urun.seri_no}'ya eklemek yerine)
        </label>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <Alan etiket="Maliyet tipi">
          <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
            {Object.entries(MALIYET_TIP_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Alan>
        <Alan etiket="Para birimi">
          <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </Alan>
        <Alan etiket="Tutar">
          <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
        </Alan>
        {form.para_birimi !== 'TRY' ? (
          <Alan etiket="Kur (otomatik, elle değiştirilebilir)">
            <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
          </Alan>
        ) : (
          <Alan etiket="O günkü USD kuru (opsiyonel)">
            <input type="number" step="0.0001" value={form.referans_usd_kuru} onChange={(e) => setForm((f) => ({ ...f, referans_usd_kuru: e.target.value }))} style={girdiStili} />
          </Alan>
        )}
        <Alan etiket="Tedarikçi/firma (opsiyonel)">
          <select value={form.tedarikci_cari_id} onChange={(e) => setForm((f) => ({ ...f, tedarikci_cari_id: e.target.value }))} style={girdiStili}>
            <option value="">Seçin...</option>
            {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
          </select>
        </Alan>
        <Alan etiket="Belge/fatura no">
          <input value={form.belge_no} onChange={(e) => setForm((f) => ({ ...f, belge_no: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Tarih">
          <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
        </Alan>
        <Alan etiket="Açıklama">
          <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
        </Alan>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}</Buton>
        <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
      </div>
    </form>
  );
}

// Satis turune (odemeTipi) gore, o satisa BEKLENEN maliyet kategorilerinin
// girilip girilmedigini gosteren kontrol listesi.
// onMaliyetEkle verilirse (opsiyonel), her kategoriye TIKLANABILIR olur -
// tiklaninca o kategori (tip) ile cagrilir, cagiran taraf bunu kullanarak
// "Maliyet Ekle" formunu o tur onceden secili acabilir (Siparisler
// sayfasindaki Maliyet Kalemi Kontrolu ile AYNI davranis).
// kalemler (opsiyonel) verilirse - o urune ait GERCEK maliyet kalemleri
// (StokMaliyetKalemi listesi, her biri kendi aciklamasiyla) - ozellikle
// "Diger" turu icin, SADECE tutari degil, kullanicinin YAZDIGI aciklamayi
// da (kucuk bir not olarak) gosterir. "Diger"in TEK anlami aciklamasidir,
// bu yuzden aciklama gorunmezse kutunun degeri kalmaz.
export function SatisMaliyetKontrolListesi({ urun, odemeTipi, onMaliyetEkle, kalemler = null }) {
  const beklenenTipler = odemeTipi === 'LEASINGLI' ? LEASING_SATIS_MALIYET_TIPLERI : FATURALI_SATIS_MALIYET_TIPLERI;
  const SUTUN_ESLEME = {
    ARDIYE: 'ardiye_maliyeti_try', GUMRUK: 'gumruk_maliyeti_try', ILAVE_GUMRUK_VERGISI: 'ilave_gumruk_vergisi_try',
    DAMGA_VERGISI: 'damga_vergisi_try', TSE_UCRETI: 'tse_ucreti_try', GUMRUKCU_MASRAFI: 'gumrukcu_masrafi_try',
    BANKA_MASRAFI: 'banka_masrafi_try', KDV: 'kdv_try', LEASING: 'leasing_maliyeti_try', DIGER: 'diger_maliyet_try',
  };
  const eksikSayisi = beklenenTipler.filter((tip) => !Number(urun[SUTUN_ESLEME[tip]] || 0)).length;

  function aciklamalariGetir(tip) {
    if (!kalemler) return [];
    return kalemler.filter((k) => k.tip === tip && k.aciklama).map((k) => k.aciklama);
  }

  return (
    <div style={{ padding: '10px 12px', background: eksikSayisi > 0 ? 'var(--amber-acik, #fdf0d5)' : 'var(--yesil-acik, #e3f5e9)', borderRadius: 8, marginBottom: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 6 }}>
        Satış Maliyeti Kontrolü ({odemeTipi === 'LEASINGLI' ? 'Leasing' : 'Faturalı'}) {eksikSayisi > 0 ? `— ${eksikSayisi} kalem eksik olabilir` : '— tamam'}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
        {beklenenTipler.map((tip) => {
          const deger = Number(urun[SUTUN_ESLEME[tip]] || 0);
          const aciklamalar = aciklamalariGetir(tip);
          return (
            <div
              key={tip}
              onClick={onMaliyetEkle ? () => onMaliyetEkle(tip) : undefined}
              title={onMaliyetEkle ? 'Bu kalemi eklemek için tıklayın' : undefined}
              style={{ display: 'flex', flexDirection: 'column', gap: 1, cursor: onMaliyetEkle ? 'pointer' : 'default' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>{deger > 0 ? '✅' : '⚠️'}</span>
                <span style={{ color: 'var(--metin-ikincil)', textDecoration: onMaliyetEkle && deger === 0 ? 'underline' : 'none' }}>{MALIYET_TIP_METIN[tip]}</span>
                {deger > 0 && <strong>({paraFormat(deger)})</strong>}
              </div>
              {aciklamalar.length > 0 && (
                <div style={{ fontSize: 10.5, color: 'var(--metin-soluk)', marginLeft: 20 }}>
                  {aciklamalar.join(' · ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// Bir odeme/tahsilat GERCEKTEN gonderilmeden ONCE, ilgili Kasa/Banka
// hesabinin bakiyesinin NE OLACAGINI gosterip onay ister. Bakiye anormal
// (5 katindan fazla) degisiyorsa, kullaniciyi ekstra uyarir - "TL tutari
// yanlislikla doviz sanildi" gibi hatalar, islem TAMAMLANMADAN ONCE gozle
// fark edilebilsin diye (sonradan avlamak yerine). Tum odeme formlarinda
// (Akreditif/Leasing/Taksit/Kiralama/Bakim) AYNI davranisi saglamak icin
// tek bir yerden yonetilir.
// hesapEtiketi: "KuveytTurk (USD)" gibi gosterim metni.
// eskiBakiye/tutar: SAYI (Number), AYNI para biriminde olmali.
// yon: "GIRIS" | "CIKIS" - CIKIS ise tutar bakiyeden DUSULUR.
export async function odemeOnizlemeOnayi({ hesapEtiketi, paraBirimi, eskiBakiye, tutar, yon = 'CIKIS' }) {
  const degisim = yon === 'GIRIS' ? tutar : -tutar;
  const yeniBakiye = eskiBakiye + degisim;
  const oranAsiriMi = eskiBakiye !== 0 && Math.abs(yeniBakiye / eskiBakiye) > 5;
  const uyariBasligi = oranAsiriMi
    ? `⚠️ DİKKAT: Bu işlem bakiyeyi ${Math.abs(yeniBakiye / eskiBakiye).toFixed(1)} KAT değiştiriyor — bir hata olabilir!\n\n`
    : '';
  const onayMetni = `${uyariBasligi}${hesapEtiketi}:\n${paraFormat(eskiBakiye, paraBirimi)} → ${paraFormat(yeniBakiye, paraBirimi)}\n\nOnaylıyor musunuz?`;
  return ozelOnayIste(onayMetni);
}
