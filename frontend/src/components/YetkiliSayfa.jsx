import { useAuth } from '../context/AuthContext';

// Bir sayfayi, kullanicinin belirtilen izne sahip olup olmadigina gore
// gosterir/gizler. Menude gizlenen bir sayfaya URL ile dogrudan girilmeye
// calisilirsa da bu bileşen devreye girer.
export default function YetkiliSayfa({ gerekliIzin, children }) {
  const { izinVarMi } = useAuth();

  if (gerekliIzin && !izinVarMi(gerekliIzin)) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: 'var(--metin-ikincil)' }}>
          Bu sayfayı görüntüleme yetkiniz yok
        </div>
        <div style={{ fontSize: 13, color: 'var(--metin-soluk)' }}>
          Erişim gerekiyorsa yöneticinizden bu sayfa için izin istemesini rica edin.
        </div>
      </div>
    );
  }

  return children;
}
