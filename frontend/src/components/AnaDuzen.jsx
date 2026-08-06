import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import {
  LayoutDashboard, Wallet, Users, Boxes, ShoppingCart, Landmark, ArrowLeftRight,
  Receipt, FileSpreadsheet, BarChart3, HandCoins, Tag, Wrench, Settings, Search,
  Building2, Bell, ClipboardList,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, hataMesajiCikar, basariBildirimDinle, yuklemeDurumuDinle, onayIstegiDinle, _onayYaniti, alertIstegiDinle, _alertYaniti, promptIstegiDinle, _promptYaniti } from '../api/client';

const ARAMA_TUR_METIN = { CARI: 'Cari', SIPARIS: 'Sipariş', STOK: 'Stok', URUN_TANIMI: 'Ürün Tanımı', DEMIRBAS: 'Demirbaş', YEDEK_PARCA: 'Yedek Parça' };

function Bildirimler() {
  const [acik, setAcik] = useState(false);
  const [bildirimler, setBildirimler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const navigate = useNavigate();
  const kutuRef = useRef(null);

  useEffect(() => {
    setYukleniyor(true);
    Promise.all([
      api.get('/yedek-parcalar').catch(() => ({ data: [] })),
      api.get('/kiralama-sozlesmeleri').catch(() => ({ data: [] })),
      api.get('/cekler').catch(() => ({ data: [] })),
      api.get('/raporlar/yaklasan-vadeler', { params: { gun: 30 } }).catch(() => ({ data: { odemeler: [] } })),
    ]).then(([yp, kira, cek, vadeler]) => {
      const bugun = new Date().toISOString().slice(0, 10);
      const liste = [];

      (yp.data || [])
        .filter((p) => p.min_stok_seviyesi && Number(p.mevcut_miktar) < Number(p.min_stok_seviyesi))
        .forEach((p) => liste.push({
          id: `yp-${p.id}`,
          mesaj: `${p.ad}: stok azaldı (${p.mevcut_miktar} / min ${p.min_stok_seviyesi} ${p.birim})`,
          yol: '/yedek-parcalar',
        }));

      (kira.data || [])
        .filter((k) => k.durum === 'AKTIF' && k.bitis_tarihi && k.bitis_tarihi < bugun)
        .forEach((k) => liste.push({
          id: `kira-${k.id}`,
          mesaj: `Kiralama sözleşmesi süresi doldu (${k.bitis_tarihi}) — sonlandırmayı unutma`,
          yol: '/finansal?sekme=kiralama',
        }));

      (cek.data || [])
        .filter((c) => c.durum === 'PORTFOYDE' && c.vade_tarihi && c.vade_tarihi < bugun)
        .forEach((c) => liste.push({
          id: `cek-${c.id}`,
          mesaj: `Çek ${c.cek_no || '#' + c.id} vadesi geçti (${c.vade_tarihi})`,
          yol: '/finansal?sekme=cek',
        }));

      (vadeler.data?.odemeler || [])
        .filter((v) => v.tur === 'AKREDITIF' && v.tarih < bugun)
        .forEach((v) => liste.push({
          id: `akr-${v.kaynak_id}`,
          mesaj: `${v.aciklama} vadesi geçti (${v.tarih}) — ${Number(v.tutar).toLocaleString('tr-TR')} ${v.para_birimi}`,
          yol: '/finansal?sekme=akreditif',
        }));

      setBildirimler(liste);
    }).finally(() => setYukleniyor(false));
  }, []);

  useEffect(() => {
    function disaTikla(e) {
      if (kutuRef.current && !kutuRef.current.contains(e.target)) setAcik(false);
    }
    document.addEventListener('mousedown', disaTikla);
    return () => document.removeEventListener('mousedown', disaTikla);
  }, []);

  function bildirimeGit(b) {
    setAcik(false);
    navigate(b.yol);
  }

  return (
    <div ref={kutuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setAcik((a) => !a)}
        style={{
          position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 8, borderRadius: 7, display: 'flex', alignItems: 'center',
        }}
      >
        <Bell size={18} color="white" style={{ opacity: 0.85 }} />
        {bildirimler.length > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, background: 'var(--kirmizi)', color: 'white',
            borderRadius: '50%', minWidth: 16, height: 16, fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
          }}>
            {bildirimler.length}
          </span>
        )}
      </button>
      {acik && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, width: 340, background: 'white',
          border: '1px solid var(--kenarlik)', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
          maxHeight: 380, overflowY: 'auto', zIndex: 60,
        }}>
          <div style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--kenarlik)' }}>
            Bildirimler
          </div>
          {yukleniyor ? (
            <div style={{ padding: 14, fontSize: 12.5, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
          ) : bildirimler.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12.5, color: 'var(--metin-soluk)' }}>✓ Bekleyen bildirim yok</div>
          ) : (
            bildirimler.map((b) => (
              <div
                key={b.id}
                onClick={() => bildirimeGit(b)}
                style={{ padding: '10px 14px', borderBottom: '1px solid var(--kenarlik)', cursor: 'pointer', fontSize: 12.5 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--zemin)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
              >
                ⚠ {b.mesaj}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function GenelArama() {
  const [sorgu, setSorgu] = useState('');
  const [sonuclar, setSonuclar] = useState(null);
  const [acik, setAcik] = useState(false);
  const [secilenIndex, setSecilenIndex] = useState(-1);
  const navigate = useNavigate();
  const kutuRef = useRef(null);

  const [aramaHata, setAramaHata] = useState(null);
  const girdiRef = useRef(null);

  useEffect(() => {
    if (sorgu.trim().length < 2) {
      setSonuclar(null);
      setAramaHata(null);
      return;
    }
    const zamanlayici = setTimeout(() => {
      api.get('/arama', { params: { q: sorgu } })
        .then((r) => { setSonuclar(r.data); setAramaHata(null); setSecilenIndex(-1); })
        .catch((e) => { setSonuclar([]); setAramaHata(hataMesajiCikar(e)); });
    }, 300);
    return () => clearTimeout(zamanlayici);
  }, [sorgu]);

  useEffect(() => {
    function disaTikla(e) {
      if (kutuRef.current && !kutuRef.current.contains(e.target)) setAcik(false);
    }
    document.addEventListener('mousedown', disaTikla);
    return () => document.removeEventListener('mousedown', disaTikla);
  }, []);

  // "/" tusuyla arama kutusuna odaklan (baska bir input/textarea'da
  // yazarken tetiklenmesin diye kontrol ediyoruz), "Esc" ile kapat.
  useEffect(() => {
    function tusaBasildi(e) {
      const hedefEtiket = e.target.tagName;
      const yaziYaziyor = hedefEtiket === 'INPUT' || hedefEtiket === 'TEXTAREA' || e.target.isContentEditable;
      if (e.key === '/' && !yaziYaziyor) {
        e.preventDefault();
        girdiRef.current?.focus();
        setAcik(true);
      } else if (e.key === 'Escape' && acik) {
        setAcik(false);
        girdiRef.current?.blur();
      } else if (acik && sonuclar && sonuclar.length > 0 && document.activeElement === girdiRef.current) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSecilenIndex((i) => (i + 1) % sonuclar.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSecilenIndex((i) => (i - 1 + sonuclar.length) % sonuclar.length);
        } else if (e.key === 'Enter' && secilenIndex >= 0) {
          e.preventDefault();
          sonucaGit(sonuclar[secilenIndex]);
        }
      }
    }
    document.addEventListener('keydown', tusaBasildi);
    return () => document.removeEventListener('keydown', tusaBasildi);
  }, [acik, sonuclar, secilenIndex]); // eslint-disable-line

  // Bu turler icin, hedef sayfa "ara" query param'ini okuyup listeyi otomatik
  // filtreler - boylece genel aramadan bir sonuca tiklayinca tum listeyle
  // degil, DOGRUDAN aranan kayitla karsilasilir.
  const ARANABILIR_TURLER = ['SIPARIS', 'CARI', 'STOK', 'URUN_TANIMI', 'DEMIRBAS', 'YEDEK_PARCA'];

  function sonucaGit(s) {
    setAcik(false);
    setSorgu('');
    if (ARANABILIR_TURLER.includes(s.tur)) {
      navigate(`${s.yol}?ara=${encodeURIComponent(s.baslik)}`);
    } else {
      navigate(s.yol);
    }
  }

  return (
    <div ref={kutuRef} style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
        <input
          ref={girdiRef}
          value={sorgu}
          onChange={(e) => { setSorgu(e.target.value); setAcik(true); }}
          onFocus={() => setAcik(true)}
          placeholder="Ara: cari, sipariş no, seri no, ürün... ( / )"
          style={{
            width: '100%', padding: '7px 10px 7px 32px', borderRadius: 7,
            border: '1px solid var(--kenarlik-koyu)', fontSize: 13, background: 'white',
          }}
        />
      </div>
      {acik && sorgu.trim().length >= 2 && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, right: 0, background: 'white',
          border: '1px solid var(--kenarlik)', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
          maxHeight: 320, overflowY: 'auto', zIndex: 50,
        }}>
          {aramaHata ? (
            <div style={{ padding: 12, fontSize: 12.5, color: 'var(--kirmizi)' }}>{aramaHata}</div>
          ) : sonuclar === null ? (
            <div style={{ padding: 12, fontSize: 12.5, color: 'var(--metin-soluk)' }}>Aranıyor...</div>
          ) : sonuclar.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12.5, color: 'var(--metin-soluk)' }}>Sonuç bulunamadı.</div>
          ) : (
            sonuclar.map((s, i) => (
              <div
                key={`${s.tur}-${s.id}`}
                onClick={() => sonucaGit(s)}
                style={{
                  padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--kenarlik)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                  background: secilenIndex === i ? 'var(--zemin)' : 'white',
                }}
                onMouseEnter={() => setSecilenIndex(i)}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{s.baslik}</div>
                  {s.alt_baslik && <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>{s.alt_baslik}</div>}
                </div>
                <span style={{ fontSize: 10.5, color: 'var(--lacivert)', background: 'var(--zemin)', padding: '2px 7px', borderRadius: 5, flexShrink: 0 }}>
                  {ARAMA_TUR_METIN[s.tur] || s.tur}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const API_TABAN_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Menu, mantiksal gruplara ayrildi - Finansal Takip sayfasindaki sekme
// gruplamasiyla ayni mantik (once duz 14 ogelik bir listeydi).
const MODUL_GRUPLARI = [
  {
    baslik: null, // grup basligi olmadan direkt gosterilir (en ust seviye)
    moduller: [
      { yol: '/', ad: 'Dashboard', Simge: LayoutDashboard },
    ],
  },
  {
    baslik: 'Finansal',
    moduller: [
      { yol: '/kasa', ad: 'Ana Kasa', Simge: Wallet, gerekliIzin: 'KASA_GORUNTULE' },
      { yol: '/banka', ad: 'Banka', Simge: Landmark, gerekliIzin: 'BANKA_GORUNTULE' },
      { yol: '/virman', ad: 'Virman', Simge: ArrowLeftRight },
      { yol: '/finansal', ad: 'Finansal Takip', Simge: Receipt },
    ],
  },
  {
    baslik: 'Ticaret',
    moduller: [
      { yol: '/cariler', ad: 'Cari', Simge: Users, gerekliIzin: 'CARI_GORUNTULE' },
      { yol: '/siparisler', ad: 'Siparişler', Simge: ShoppingCart },
      { yol: '/proforma-fatura', ad: 'Proforma / Fatura', Simge: FileSpreadsheet, gerekliIzin: 'FATURA_GORUNTULE' },
      { yol: '/tedarikci-faturalari', ad: 'Tedarikçi Faturaları', Simge: ClipboardList, gerekliIzin: 'FATURA_GORUNTULE' },
      { yol: '/satis-yap', ad: 'Satış Yap', Simge: HandCoins, gerekliIzin: 'STOK_DUZENLE' },
    ],
  },
  {
    baslik: 'Envanter',
    moduller: [
      { yol: '/stok', ad: 'Stok', Simge: Boxes, gerekliIzin: 'STOK_GORUNTULE' },
      { yol: '/urun-tanimlari', ad: 'Ürün Tanımları', Simge: Tag, gerekliIzin: 'STOK_GORUNTULE' },
      { yol: '/yedek-parcalar', ad: 'Yedek Parça / Sarf', Simge: Wrench, gerekliIzin: 'STOK_GORUNTULE' },
      { yol: '/oz-mal', ad: 'Öz Mal / Demirbaş', Simge: Building2, gerekliIzin: 'STOK_GORUNTULE' },
    ],
  },
  {
    baslik: 'Genel',
    moduller: [
      { yol: '/raporlar', ad: 'Raporlar', Simge: BarChart3 },
      { yol: '/yonetici-paneli', ad: 'Yönetici Paneli', Simge: Settings, gerekliIzin: 'KULLANICI_YONET' },
    ],
  },
];
// Duz liste - eski kod (baslik/sonucaGit/document.title mantigi) MODULLER
// uzerinden calisiyor, gruplamayi bozmadan hepsini birlestiriyoruz.
const MODULLER = MODUL_GRUPLARI.flatMap((g) => g.moduller);

function BasariToast() {
  const [gorunur, setGorunur] = useState(false);

  useEffect(() => {
    let zamanlayici;
    const iptal = basariBildirimDinle(() => {
      setGorunur(true);
      clearTimeout(zamanlayici);
      zamanlayici = setTimeout(() => setGorunur(false), 2200);
    });
    return () => { iptal(); clearTimeout(zamanlayici); };
  }, []);

  if (!gorunur) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 16, right: 16, zIndex: 200,
        background: 'var(--yesil, #1c7c4c)', color: 'white',
        padding: '10px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 500,
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        display: 'flex', alignItems: 'center', gap: 8,
        animation: 'kinetikToastGir 0.2s ease-out',
      }}
    >
      ✓ Kaydedildi
    </div>
  );
}

function YukariCikButonu() {
  const [gorunur, setGorunur] = useState(false);

  useEffect(() => {
    function kaydirmaKontrolu() {
      setGorunur(window.scrollY > 400);
    }
    window.addEventListener('scroll', kaydirmaKontrolu);
    return () => window.removeEventListener('scroll', kaydirmaKontrolu);
  }, []);

  if (!gorunur) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Sayfanın başına dön"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 150,
        width: 40, height: 40, borderRadius: '50%',
        background: 'var(--lacivert, #1e3a6e)', color: 'white', border: 'none',
        fontSize: 18, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      ↑
    </button>
  );
}

function OzelOnayPaneli() {
  const [mesaj, setMesaj] = useState(null);

  useEffect(() => {
    return onayIstegiDinle((m) => setMesaj(m));
  }, []);

  function yanitla(sonuc) {
    _onayYaniti(sonuc);
    setMesaj(null);
  }

  if (!mesaj) return null;

  return (
    <div
      onClick={() => yanitla(false)}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,25,40,0.45)', zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12, padding: 22, minWidth: 300, maxWidth: 420,
          boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--metin-birincil)', marginBottom: 20 }}>
          {mesaj}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => yanitla(false)}
            style={{
              padding: '8px 16px', borderRadius: 7, fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
              background: 'white', color: 'var(--metin-birincil)', border: '1px solid var(--kenarlik-koyu)',
            }}
          >
            Vazgeç
          </button>
          <button
            onClick={() => yanitla(true)}
            style={{
              padding: '8px 16px', borderRadius: 7, fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
              background: 'var(--kirmizi, #c0392b)', color: 'white', border: '1px solid var(--kirmizi, #c0392b)',
            }}
          >
            Onayla
          </button>
        </div>
      </div>
    </div>
  );
}

function OzelAlertPaneli() {
  const [mesaj, setMesaj] = useState(null);

  useEffect(() => {
    return alertIstegiDinle((m) => setMesaj(m));
  }, []);

  function kapat() {
    _alertYaniti();
    setMesaj(null);
  }

  if (!mesaj) return null;

  return (
    <div
      onClick={kapat}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,25,40,0.45)', zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12, padding: 22, minWidth: 300, maxWidth: 420,
          boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--metin-birincil)', marginBottom: 20 }}>
          {mesaj}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={kapat}
            style={{
              padding: '8px 18px', borderRadius: 7, fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
              background: 'var(--lacivert, #1e3a6e)', color: 'white', border: '1px solid var(--lacivert, #1e3a6e)',
            }}
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}

function OzelPromptPaneli() {
  const [istek, setIstek] = useState(null);
  const [deger, setDeger] = useState('');

  useEffect(() => {
    return promptIstegiDinle((i) => { setIstek(i); setDeger(i.varsayilanDeger || ''); });
  }, []);

  function gonder(e) {
    e.preventDefault();
    _promptYaniti(deger);
    setIstek(null);
  }

  function vazgec() {
    _promptYaniti(null);
    setIstek(null);
  }

  if (!istek) return null;

  return (
    <div
      onClick={vazgec}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,25,40,0.45)', zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <form
        onSubmit={gonder}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12, padding: 22, minWidth: 300, maxWidth: 420,
          boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--metin-birincil)', marginBottom: 12 }}>
          {istek.mesaj}
        </div>
        <input
          autoFocus
          type="text"
          value={deger}
          onChange={(e) => setDeger(e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--kenarlik-koyu)',
            fontSize: 13.5, marginBottom: 18, boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={vazgec}
            style={{
              padding: '8px 16px', borderRadius: 7, fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
              background: 'white', color: 'var(--metin-birincil)', border: '1px solid var(--kenarlik-koyu)',
            }}
          >
            Vazgeç
          </button>
          <button
            type="submit"
            style={{
              padding: '8px 16px', borderRadius: 7, fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
              background: 'var(--lacivert, #1e3a6e)', color: 'white', border: '1px solid var(--lacivert, #1e3a6e)',
            }}
          >
            Onayla
          </button>
        </div>
      </form>
    </div>
  );
}

function GenelYuklemeCubugu() {
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    return yuklemeDurumuDinle((durum) => setYukleniyor(durum));
  }, []);

  if (!yukleniyor) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 300, background: 'rgba(30,58,110,0.12)', overflow: 'hidden' }}>
      <div
        style={{
          height: '100%', width: '40%', background: 'var(--lacivert, #1e3a6e)',
          animation: 'kinetikYuklemeKay 1s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes kinetikYuklemeKay {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}

const KISAYOLLAR = [
  { tus: '/', aciklama: 'Genel aramaya odaklan' },
  { tus: '↓ / ↑', aciklama: 'Arama sonuçları arasında gez' },
  { tus: 'Enter', aciklama: 'Seçili arama sonucuna git' },
  { tus: 'Esc', aciklama: 'Açık aramayı / pencereyi kapat' },
  { tus: '?', aciklama: 'Bu yardım penceresini aç/kapat' },
];

function KisayollarPaneli({ onKapat }) {
  return (
    <div
      onClick={onKapat}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12, padding: 24, minWidth: 320,
          boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Klavye Kısayolları</div>
          <button onClick={onKapat} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--metin-ikincil)' }}>×</button>
        </div>
        {KISAYOLLAR.map((k) => (
          <div key={k.tus} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--kenarlik)' }}>
            <span style={{ fontSize: 13, color: 'var(--metin-ikincil)' }}>{k.aciklama}</span>
            <kbd style={{
              background: 'var(--zemin)', border: '1px solid var(--kenarlik-koyu)', borderRadius: 5,
              padding: '3px 8px', fontSize: 12.5, fontFamily: 'monospace', fontWeight: 600,
            }}>
              {k.tus}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnaDuzen() {
  const { oturum, cikisYap, sirketDegistir, sirketleriTazele, izinVarMi } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [kisayollarAcik, setKisayollarAcik] = useState(false);

  useEffect(() => {
    function tusaBasildi(e) {
      const hedefEtiket = e.target.tagName;
      const yaziYaziyor = hedefEtiket === 'INPUT' || hedefEtiket === 'TEXTAREA' || e.target.isContentEditable;
      if (e.key === '?' && !yaziYaziyor) {
        e.preventDefault();
        setKisayollarAcik((a) => !a);
      } else if (e.key === 'Escape' && kisayollarAcik) {
        setKisayollarAcik(false);
      }
    }
    document.addEventListener('keydown', tusaBasildi);
    return () => document.removeEventListener('keydown', tusaBasildi);
  }, [kisayollarAcik]);

  // Tarayici sekmesi basligini aktif sayfaya gore gunceller - boylece
  // birden fazla sekme acikken hangi sekmenin hangi sayfa oldugu kolayca
  // ayirt edilebilir (hepsi ayni "Kinetik ERP" yazisini gostermek yerine).
  useEffect(() => {
    const modul = MODULLER.find((m) => m.yol === location.pathname)
      || MODULLER.find((m) => m.yol !== '/' && location.pathname.startsWith(m.yol));
    document.title = modul ? `${modul.ad} — Kinetik ERP` : 'Kinetik ERP';
  }, [location.pathname]);
  const [yeniSirketFormuAcik, setYeniSirketFormuAcik] = useState(false);
  const [yeniSirketAdi, setYeniSirketAdi] = useState('');
  const [hata, setHata] = useState(null);
  const [mobilMenuAcik, setMobilMenuAcik] = useState(false);

  function cikisIslemi() {
    cikisYap();
    navigate('/giris');
  }

  async function yeniSirketEkle(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/sirketler', { unvan: yeniSirketAdi });
      setYeniSirketFormuAcik(false);
      setYeniSirketAdi('');
      await sirketleriTazele();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  const gorunurModuller = MODULLER.filter((m) => izinVarMi(m.gerekliIzin));
  const gorunurGruplar = MODUL_GRUPLARI
    .map((g) => ({ ...g, moduller: g.moduller.filter((m) => izinVarMi(m.gerekliIzin)) }))
    .filter((g) => g.moduller.length > 0);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <BasariToast />
      <GenelYuklemeCubugu />
      <OzelOnayPaneli />
      <OzelAlertPaneli />
      <OzelPromptPaneli />
      <YukariCikButonu />
      {kisayollarAcik && <KisayollarPaneli onKapat={() => setKisayollarAcik(false)} />}
      <style>{`
        @keyframes kinetikToastGir {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        table tbody tr:hover {
          background: var(--zemin, #f4f5f7);
        }
        .kinetik-hamburger { display: none; }
        .kinetik-sidebar-orten { display: none; }

        @media (max-width: 860px) {
          .kinetik-sidebar {
            position: fixed;
            top: 0; left: 0; bottom: 0;
            z-index: 40;
            transform: translateX(-100%);
            transition: transform 0.2s ease;
          }
          .kinetik-sidebar.acik {
            transform: translateX(0);
          }
          .kinetik-sidebar-orten.acik {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.35);
            z-index: 35;
          }
          .kinetik-hamburger {
            display: flex;
          }
          .kinetik-ana-icerik {
            padding: 14px !important;
          }
          .kinetik-baslik-satiri {
            flex-wrap: wrap;
          }
        }

        /* Genis tablolar/gridler kucuk ekranlarda tasmasin diye yatay kaydirma acik
           tutulur - sayfalar kendi ic yapisini degistirmeden calisir. */
        @media (max-width: 860px) {
          main {
            overflow-x: auto;
          }
        }
      `}</style>

      {mobilMenuAcik && (
        <div className="kinetik-sidebar-orten acik" onClick={() => setMobilMenuAcik(false)} />
      )}

      <aside
        className={`kinetik-sidebar${mobilMenuAcik ? ' acik' : ''}`}
        style={{
          width: 220,
          background: 'var(--lacivert-koyu)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {oturum?.aktifSirketId && (
            <img
              src={`${API_TABAN_URL}/sirketler/${oturum.aktifSirketId}/logo`}
              alt=""
              style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain', background: 'white', flexShrink: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>Kinetik ERP</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
              İthalat ön muhasebe
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {gorunurGruplar.map((grup, i) => (
            <div key={grup.baslik || 'ust'} style={{ marginTop: i === 0 ? 0 : 14 }}>
              {grup.baslik && (
                <div style={{
                  padding: '4px 12px 6px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em',
                  color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
                }}>
                  {grup.baslik}
                </div>
              )}
              {grup.moduller.map((m) => (
            <NavLink
              key={m.yol}
              to={m.yol}
              end={m.yol === '/'}
              onClick={() => setMobilMenuAcik(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 6,
                color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                fontSize: 13.5,
                fontWeight: isActive ? 500 : 400,
              })}
            >
              <m.Simge size={16} style={{ opacity: 0.85, flexShrink: 0 }} />
              {m.ad}
            </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{oturum?.kullanici?.ad_soyad}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
            {oturum?.kullanici?.email}
          </div>
          <button
            onClick={cikisIslemi}
            style={{
              width: '100%',
              padding: '7px 0',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 6,
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13,
            }}
          >
            Çıkış yap
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            minHeight: 56,
            background: 'var(--yuzey)',
            borderBottom: '1px solid var(--kenarlik)',
            display: 'flex',
            flexDirection: 'column',
            padding: '10px 24px',
            flexShrink: 0,
          }}
        >
          <div className="kinetik-baslik-satiri" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%' }}>
            <button
              className="kinetik-hamburger"
              onClick={() => setMobilMenuAcik((a) => !a)}
              aria-label="Menüyü aç/kapat"
              style={{
                alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
                border: '1px solid var(--kenarlik-koyu)', borderRadius: 6, background: 'white',
                fontSize: 16, cursor: 'pointer', flexShrink: 0,
              }}
            >
              ☰
            </button>

            <GenelArama />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <Bildirimler />
              {oturum?.sirketler?.length > 1 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Aktif Şirket:</span>
                  <select
                    value={oturum.aktifSirketId ?? ''}
                    onChange={(e) => sirketDegistir(Number(e.target.value))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1.5px solid var(--lacivert, #1e3a6e)',
                      background: 'white',
                      fontWeight: 600,
                      color: 'var(--lacivert, #1e3a6e)',
                    }}
                  >
                    {oturum.sirketler.map((s) => (
                      <option key={s.id} value={s.id}>{s.unvan}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--metin-ikincil)' }}>
                  {oturum?.sirketler?.[0]?.unvan}
                </span>
              )}
              <button
                onClick={() => setYeniSirketFormuAcik((a) => !a)}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid var(--kenarlik-koyu)',
                  background: 'white', fontSize: 12.5, color: 'var(--metin-ikincil)',
                }}
              >
                + Yeni şirket
              </button>
            </div>
          </div>

          {yeniSirketFormuAcik && (
            <form onSubmit={yeniSirketEkle} style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                required
                value={yeniSirketAdi}
                onChange={(e) => setYeniSirketAdi(e.target.value)}
                placeholder="Yeni şirket unvanı"
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--kenarlik-koyu)', width: 280, maxWidth: '100%' }}
              />
              <button type="submit" style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--lacivert)', background: 'var(--lacivert)', color: 'white', fontSize: 12.5 }}>
                Oluştur
              </button>
              {hata && <span style={{ fontSize: 12, color: 'var(--kirmizi)' }}>{hata}</span>}
            </form>
          )}
        </header>

        <main className="kinetik-ana-icerik" style={{ flex: 1, padding: 28, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
