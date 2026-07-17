import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, hataMesajiCikar } from '../api/client';

const MODULLER = [
  { yol: '/', ad: 'Ana Kasa', simge: '▤', gerekliIzin: 'KASA_GORUNTULE' },
  { yol: '/cariler', ad: 'Cari', simge: '◑', gerekliIzin: 'CARI_GORUNTULE' },
  { yol: '/stok', ad: 'Stok', simge: '◫', gerekliIzin: 'STOK_GORUNTULE' },
  { yol: '/siparisler', ad: 'Siparişler', simge: '⇄' },
  { yol: '/banka', ad: 'Banka', simge: '◈', gerekliIzin: 'BANKA_GORUNTULE' },
  { yol: '/virman', ad: 'Virman', simge: '⇌' },
  { yol: '/finansal', ad: 'Finansal Takip', simge: '◇' },
  { yol: '/proforma-fatura', ad: 'Proforma / Fatura', simge: '▭', gerekliIzin: 'FATURA_GORUNTULE' },
  { yol: '/raporlar', ad: 'Raporlar', simge: '◔' },
  { yol: '/satis-yap', ad: 'Satış Yap', simge: '💰', gerekliIzin: 'STOK_DUZENLE' },
  { yol: '/urun-tanimlari', ad: 'Ürün Tanımları', simge: '📦', gerekliIzin: 'STOK_GORUNTULE' },
  { yol: '/harcama-turleri', ad: 'Harcama Türleri', simge: '☰' },
  { yol: '/yonetici-paneli', ad: 'Yönetici Paneli', simge: '⚙', gerekliIzin: 'KULLANICI_YONET' },
];

export default function AnaDuzen() {
  const { oturum, cikisYap, sirketDegistir, sirketleriTazele, izinVarMi } = useAuth();
  const navigate = useNavigate();
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
              <span style={{ fontSize: 14, opacity: 0.8 }}>{m.simge}</span>
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flex: 1, flexWrap: 'wrap' }}>
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
