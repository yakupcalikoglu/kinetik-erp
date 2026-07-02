import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, hataMesajiCikar } from '../api/client';
import { Buton, Alan, girdiStili, HataMesaji } from '../components/Ortak';

export default function SifreSifirlaSayfasi() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [yeniSifre, setYeniSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState(null);
  const [basarili, setBasarili] = useState(false);

  async function gonder(e) {
    e.preventDefault();
    setHata(null);

    if (yeniSifre !== sifreTekrar) {
      setHata('Şifreler birbiriyle eşleşmiyor.');
      return;
    }
    if (!token) {
      setHata('Geçersiz sıfırlama bağlantısı.');
      return;
    }

    setYukleniyor(true);
    try {
      await api.post('/auth/sifre-sifirla', { token, yeni_sifre: yeniSifre });
      setBasarili(true);
      setTimeout(() => navigate('/giris'), 2000);
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
          <div style={{ fontSize: 20, fontWeight: 600 }}>Şifre Sıfırla</div>
          <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginTop: 2 }}>
            Yeni şifrenizi belirleyin.
          </div>
        </div>

        {basarili ? (
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            <p>Şifreniz başarıyla güncellendi. Giriş sayfasına yönlendiriliyorsunuz...</p>
          </div>
        ) : (
          <form onSubmit={gonder}>
            <HataMesaji>{hata}</HataMesaji>
            <Alan etiket="Yeni Şifre">
              <input
                type="password"
                required
                minLength={6}
                value={yeniSifre}
                onChange={(e) => setYeniSifre(e.target.value)}
                placeholder="••••••••"
                style={girdiStili}
              />
            </Alan>
            <Alan etiket="Yeni Şifre (Tekrar)">
              <input
                type="password"
                required
                minLength={6}
                value={sifreTekrar}
                onChange={(e) => setSifreTekrar(e.target.value)}
                placeholder="••••••••"
                style={girdiStili}
              />
            </Alan>
            <Buton type="submit" disabled={yukleniyor} style={{ width: '100%', marginTop: 6, padding: '10px 0' }}>
              {yukleniyor ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
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
