import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, hataMesajiCikar } from '../api/client';
import { Buton, Alan, girdiStili, HataMesaji } from '../components/Ortak';

export default function SifremiUnuttumSayfasi() {
  const [email, setEmail] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState(null);
  const [gonderildi, setGonderildi] = useState(false);

  async function gonder(e) {
    e.preventDefault();
    setYukleniyor(true);
    setHata(null);
    try {
      await api.post('/auth/sifremi-unuttum', { email });
      setGonderildi(true);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setYukleniyor(false);
    }
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
      <div
        style={{
          background: 'white',
          borderRadius: 14,
          padding: '36px 36px 28px',
          width: 360,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Şifremi Unuttum</div>
          <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginTop: 2 }}>
            E-posta adresinize sıfırlama bağlantısı gönderelim.
          </div>
        </div>

        {gonderildi ? (
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            <p>Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.</p>
            <Link to="/giris" style={{ color: 'var(--lacivert-koyu)' }}>
              Giriş sayfasına dön
            </Link>
          </div>
        ) : (
          <form onSubmit={gonder}>
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
            <Buton type="submit" disabled={yukleniyor} style={{ width: '100%', marginTop: 6, padding: '10px 0' }}>
              {yukleniyor ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
            </Buton>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link to="/giris" style={{ fontSize: 13, color: 'var(--metin-ikincil)' }}>
                Giriş sayfasına dön
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
