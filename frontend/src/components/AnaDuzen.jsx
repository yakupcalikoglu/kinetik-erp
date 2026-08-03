import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import {
  LayoutDashboard, Wallet, Users, Boxes, ShoppingCart, Landmark, ArrowLeftRight,
  Receipt, FileSpreadsheet, BarChart3, HandCoins, Tag, Wrench, Settings, Search,
  Building2, Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, hataMesajiCikar } from '../api/client';

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
    ]).then(([yp, kira, cek]) => {
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
  const navigate = useNavigate();
  const kutuRef = useRef(null);

  const [aramaHata, setAramaHata] = useState(null);

  useEffect(() => {
    if (sorgu.trim().length < 2) {
      setSonuclar(null);
      setAramaHata(null);
      return;
    }
    const zamanlayici = setTimeout(() => {
      api.get('/arama', { params: { q: sorgu } })
        .then((r) => { setSonuclar(r.data); setAramaHata(null); })
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
          value={sorgu}
          onChange={(e) => { setSorgu(e.target.value); setAcik(true); }}
          onFocus={() => setAcik(true)}
          placeholder="Ara: cari, sipariş no, seri no, ürün..."
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
            sonuclar.map((s) => (
              <div
                key={`${s.tur}-${s.id}`}
                onClick={() => sonucaGit(s)}
                style={{
                  padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--kenarlik)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--zemin)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
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

const MODULLER = [
  { yol: '/', ad: 'Dashboard', Simge: LayoutDashboard },
  { yol: '/kasa', ad: 'Ana Kasa', Simge: Wallet, gerekliIzin: 'KASA_GORUNTULE' },
  { yol: '/cariler', ad: 'Cari', Simge: Users, gerekliIzin: 'CARI_GORUNTULE' },
  { yol: '/stok', ad: 'Stok', Simge: Boxes, gerekliIzin: 'STOK_GORUNTULE' },
  { yol: '/siparisler', ad: 'Siparişler', Simge: ShoppingCart },
  { yol: '/banka', ad: 'Banka', Simge: Landmark, gerekliIzin: 'BANKA_GORUNTULE' },
  { yol: '/virman', ad: 'Virman', Simge: ArrowLeftRight },
  { yol: '/finansal', ad: 'Finansal Takip', Simge: Receipt },
  { yol: '/proforma-fatura', ad: 'Proforma / Fatura', Simge: FileSpreadsheet, gerekliIzin: 'FATURA_GORUNTULE' },
  { yol: '/raporlar', ad: 'Raporlar', Simge: BarChart3 },
  { yol: '/satis-yap', ad: 'Satış Yap', Simge: HandCoins, gerekliIzin: 'STOK_DUZENLE' },
  { yol: '/urun-tanimlari', ad: 'Ürün Tanımları', Simge: Tag, gerekliIzin: 'STOK_GORUNTULE' },
  { yol: '/yedek-parcalar', ad: 'Yedek Parça / Sarf', Simge: Wrench, gerekliIzin: 'STOK_GORUNTULE' },
  { yol: '/oz-mal', ad: 'Öz Mal / Demirbaş', Simge: Building2, gerekliIzin: 'STOK_GORUNTULE' },
  { yol: '/yonetici-paneli', ad: 'Yönetici Paneli', Simge: Settings, gerekliIzin: 'KULLANICI_YONET' },
];

export default function AnaDuzen() {
  const { oturum, cikisYap, sirketDegistir, sirketleriTazele, izinVarMi } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <style>{`
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
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>Kinetik ERP</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
            İthalat ön muhasebe
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {gorunurModuller.map((m) => (
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
                <select
                  value={oturum.aktifSirketId ?? ''}
                  onChange={(e) => sirketDegistir(Number(e.target.value))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--kenarlik-koyu)',
                    background: 'white',
                  }}
                >
                  {oturum.sirketler.map((s) => (
                    <option key={s.id} value={s.id}>{s.unvan}</option>
                  ))}
                </select>
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
