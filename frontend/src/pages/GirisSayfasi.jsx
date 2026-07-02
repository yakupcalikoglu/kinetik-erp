import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Buton, Alan, girdiStili, HataMesaji } from '../components/Ortak';
import { Link, useNavigate } from 'react-router-dom';

export default function GirisSayfasi() {
  const { girisYap, yukleniyor, hata } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');

  async function gonder(e) {
    e.preventDefault();
    const basarili = await girisYap(email, sifre);
    if (basarili) navigate('/');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--lacivert-koyu)',
      }}
    >
      <form
        onSubmit={gonder}
        style={{
          background: 'white',
          borderRadius: 14,
          padding: '36px 36px 28px',
          width: 360,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Kinetik ERP</div>
          <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginTop: 2 }}>
            İthalat ön muhasebe ve stok yönetimi
          </div>
        </div>

        <HataMesaji>{hata}</HataMesaji>

        <Alan etiket="E-posta">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@sirket.com.tr"
            style={girdiStili}
          />
        </Alan>
        <Alan etiket="Şifre">
          <input
            type="password"
            required
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            placeholder="••••••••"
            style={girdiStili}
          />
        </Alan>

        <Buton type="submit" disabled={yukleniyor} style={{ width: '100%', marginTop: 6, padding: '10px 0' }}>
          {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </Buton>
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <Link to="/sifremi-unuttum" style={{ fontSize: 13, color: 'var(--metin-ikincil)' }}>
            Şifremi unuttum
          </Link>
        </div>
      </form>
    </div>
  );
}
