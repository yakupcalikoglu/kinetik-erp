import { useNavigate } from 'react-router-dom';
import { Buton } from '../components/Ortak';

export default function SayfaBulunamadiSayfasi() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
      <div style={{ fontSize: 56, fontWeight: 700, color: 'var(--kenarlik-koyu)', marginBottom: 8 }}>404</div>
      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Sayfa Bulunamadı</div>
      <div style={{ fontSize: 13.5, color: 'var(--metin-ikincil)', marginBottom: 20, maxWidth: 360 }}>
        Aradığınız sayfa mevcut değil, taşınmış olabilir ya da adres yanlış yazılmış olabilir.
      </div>
      <Buton onClick={() => navigate('/')}>Ana Sayfaya Dön</Buton>
    </div>
  );
}
