import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MODULLER = [
  { yol: '/', ad: 'Genel Bakış', simge: '◧' },
  { yol: '/cariler', ad: 'Cari', simge: '◑' },
  { yol: '/stok', ad: 'Stok', simge: '◫' },
  { yol: '/siparisler', ad: 'Siparişler', simge: '⇄' },
  { yol: '/banka-kasa', ad: 'Banka / Kasa', simge: '◈' },
  { yol: '/finansal', ad: 'Finansal Takip', simge: '◇' },
  { yol: '/proforma-fatura', ad: 'Proforma / Fatura', simge: '▭' },
  { yol: '/raporlar', ad: 'Raporlar', simge: '◔' },
  { yol: '/yonetici-paneli', ad: 'Yönetici Paneli', simge: '⚙' },
];

export default function AnaDuzen() {
  const { oturum, cikisYap, sirketDegistir } = useAuth();
  const navigate = useNavigate();

  function cikisIslemi() {
    cikisYap();
    navigate('/giris');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
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

        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {MODULLER.map((m) => (
            <NavLink
              key={m.yol}
              to={m.yol}
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
            height: 56,
            background: 'var(--yuzey)',
            borderBottom: '1px solid var(--kenarlik)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 24px',
            flexShrink: 0,
          }}
        >
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
        </header>

        <main style={{ flex: 1, padding: 28, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
