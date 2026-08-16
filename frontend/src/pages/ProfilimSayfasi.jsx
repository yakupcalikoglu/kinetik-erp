import { useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji } from '../components/Ortak';

function SifreDegistirFormu() {
  const [form, setForm] = useState({ mevcut_sifre: '', yeni_sifre: '', yeni_sifre_tekrar: '' });
  const [hata, setHata] = useState(null);
  const [basari, setBasari] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setBasari(false);

    if (form.yeni_sifre !== form.yeni_sifre_tekrar) {
      setHata('Yeni şifreler birbiriyle eşleşmiyor.');
      return;
    }
    if (form.yeni_sifre.length < 6) {
      setHata('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }

    setKaydediliyor(true);
    try {
      await api.put('/auth/sifre-degistir', {
        mevcut_sifre: form.mevcut_sifre, yeni_sifre: form.yeni_sifre,
      });
      setBasari(true);
      setForm({ mevcut_sifre: '', yeni_sifre: '', yeni_sifre_tekrar: '' });
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Kart style={{ maxWidth: 440 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Şifremi Değiştir</div>
      <HataMesaji>{hata}</HataMesaji>
      {basari && (
        <div style={{ background: 'var(--yesil-acik)', color: 'var(--yesil)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
          Şifreniz başarıyla güncellendi.
        </div>
      )}
      <form onSubmit={kaydet}>
        <Alan etiket="Mevcut şifreniz">
          <input
            required type="password" value={form.mevcut_sifre}
            onChange={(e) => setForm((f) => ({ ...f, mevcut_sifre: e.target.value }))}
            style={girdiStili}
          />
        </Alan>
        <Alan etiket="Yeni şifre (en az 6 karakter)">
          <input
            required type="password" minLength={6} value={form.yeni_sifre}
            onChange={(e) => setForm((f) => ({ ...f, yeni_sifre: e.target.value }))}
            style={girdiStili}
          />
        </Alan>
        <Alan etiket="Yeni şifre (tekrar)">
          <input
            required type="password" value={form.yeni_sifre_tekrar}
            onChange={(e) => setForm((f) => ({ ...f, yeni_sifre_tekrar: e.target.value }))}
            style={girdiStili}
          />
        </Alan>
        <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}</Buton>
      </form>
    </Kart>
  );
}

export default function ProfilimSayfasi() {
  const { oturum } = useAuth();
  const kullanici = oturum?.kullanici;

  return (
    <div>
      <SayfaBasligi baslik="Profilim" aciklama="Hesap bilgileriniz ve şifre değişikliği" />

      <Kart style={{ maxWidth: 440, marginBottom: 20 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Hesap Bilgileri</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
          <div>
            <div style={{ color: 'var(--metin-ikincil)', marginBottom: 2 }}>Ad Soyad</div>
            <div style={{ fontWeight: 500 }}>{kullanici?.ad_soyad || '—'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--metin-ikincil)', marginBottom: 2 }}>E-posta</div>
            <div style={{ fontWeight: 500 }}>{kullanici?.email || '—'}</div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--metin-soluk)', marginTop: 12 }}>
          Ad Soyad veya e-posta adresinizi değiştirmek için yöneticinizle iletişime geçin.
        </div>
      </Kart>

      <SifreDegistirFormu />
    </div>
  );
}
