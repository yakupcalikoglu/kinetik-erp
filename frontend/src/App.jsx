import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AuthSaglayici, useAuth } from './context/AuthContext';
import AnaDuzen from './components/AnaDuzen';
import YetkiliSayfa from './components/YetkiliSayfa';
import GirisSayfasi from './pages/GirisSayfasi';
import SifremiUnuttumSayfasi from './pages/SifremiUnuttumSayfasi';
import SifreSifirlaSayfasi from './pages/SifreSifirlaSayfasi';
import CarilerSayfasi from './pages/CarilerSayfasi';
import StokSayfasi from './pages/StokSayfasi';
import SiparislerSayfasi from './pages/SiparislerSayfasi';
import SiparisOlusturSayfasi from './pages/SiparisOlusturSayfasi';
import SiparisTeslimAlSayfasi from './pages/SiparisTeslimAlSayfasi';
import BankaSayfasi from './pages/BankaSayfasi';
import KasaSayfasi from './pages/KasaSayfasi';
import RaporlarSayfasi from './pages/RaporlarSayfasi';
import FinansalTakipSayfasi from './pages/FinansalTakipSayfasi';
import ProformaFaturaSayfasi from './pages/ProformaFaturaSayfasi';
import YoneticiPaneliSayfasi from './pages/YoneticiPaneliSayfasi';
import VirmanSayfasi from './pages/VirmanSayfasi';
import UrunTanimlariSayfasi from './pages/UrunTanimlariSayfasi';
import SatisYapSayfasi from './pages/SatisYapSayfasi';
import HarcamaTurleriSayfasi from './pages/HarcamaTurleriSayfasi';
import YedekParcaSayfasi from './pages/YedekParcaSayfasi';

function KorumaliRota({ children }) {
  const { oturum } = useAuth();
  if (!oturum) return <Navigate to="/giris" replace />;
  return children;
}

function App() {
  return (
    <AuthSaglayici>
      <BrowserRouter>
        <Routes>
          <Route path="/giris" element={<GirisSayfasi />} />
          <Route path="/sifremi-unuttum" element={<SifremiUnuttumSayfasi />} />
          <Route path="/sifre-sifirla" element={<SifreSifirlaSayfasi />} />
          <Route
            path="/"
            element={
              <KorumaliRota>
                <AnaDuzen />
              </KorumaliRota>
            }
          >
            {/* "/" (Genel Bakis) ve "/kasa" (Ana Kasa) ARTIK AYNI SAYFA -
                onceden iki farkli dosyaydi (GenelBakisSayfasi.jsx ile
                KasaSayfasi.jsx), bu da kafa karistirici, birbirinden
                bagimsiz iki kopya haline gelmisti. Tek bir bilesen
                kullanilarak birlestirildi; /kasa yolu da eski linkler
                kirilmasin diye ayni bilesene yonlendirilmeye devam ediyor. */}
            <Route index element={<YetkiliSayfa gerekliIzin="KASA_GORUNTULE"><KasaSayfasi /></YetkiliSayfa>} />
            <Route path="cariler" element={<YetkiliSayfa gerekliIzin="CARI_GORUNTULE"><CarilerSayfasi /></YetkiliSayfa>} />
            <Route path="stok" element={<YetkiliSayfa gerekliIzin="STOK_GORUNTULE"><StokSayfasi /></YetkiliSayfa>} />
            <Route path="siparisler" element={<SiparislerSayfasi />} />
            <Route path="siparisler/:siparisId/duzenle" element={<SiparisOlusturSayfasi />} />
            <Route path="siparisler/yeni" element={<SiparisOlusturSayfasi />} />
            <Route path="siparisler/:siparisId/teslim-al" element={<SiparisTeslimAlSayfasi />} />
            <Route path="banka" element={<YetkiliSayfa gerekliIzin="BANKA_GORUNTULE"><BankaSayfasi /></YetkiliSayfa>} />
            <Route path="kasa" element={<YetkiliSayfa gerekliIzin="KASA_GORUNTULE"><KasaSayfasi /></YetkiliSayfa>} />
            <Route path="virman" element={<VirmanSayfasi />} />
            <Route path="finansal" element={<FinansalTakipSayfasi />} />
            <Route path="proforma-fatura" element={<YetkiliSayfa gerekliIzin="FATURA_GORUNTULE"><ProformaFaturaSayfasi /></YetkiliSayfa>} />
            <Route path="raporlar" element={<RaporlarSayfasi />} />
            <Route path="urun-tanimlari" element={<YetkiliSayfa gerekliIzin="STOK_GORUNTULE"><UrunTanimlariSayfasi /></YetkiliSayfa>} />
            <Route path="yonetici-paneli" element={<YetkiliSayfa gerekliIzin="KULLANICI_YONET"><YoneticiPaneliSayfasi /></YetkiliSayfa>} />
            <Route path="harcama-turleri" element={<HarcamaTurleriSayfasi />} />
            <Route path="yedek-parcalar" element={<YedekParcaSayfasi />} />
            <Route path="satis-yap" element={<YetkiliSayfa gerekliIzin="STOK_DUZENLE"><SatisYapSayfasi /></YetkiliSayfa>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthSaglayici>
  );
}

export default App;
