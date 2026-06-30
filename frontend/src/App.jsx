import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AuthSaglayici, useAuth } from './context/AuthContext';
import AnaDuzen from './components/AnaDuzen';
import GirisSayfasi from './pages/GirisSayfasi';
import GenelBakisSayfasi from './pages/GenelBakisSayfasi';
import CarilerSayfasi from './pages/CarilerSayfasi';
import StokSayfasi from './pages/StokSayfasi';
import SiparislerSayfasi from './pages/SiparislerSayfasi';
import BankaKasaSayfasi from './pages/BankaKasaSayfasi';
import RaporlarSayfasi from './pages/RaporlarSayfasi';

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
          <Route
            path="/"
            element={
              <KorumaliRota>
                <AnaDuzen />
              </KorumaliRota>
            }
          >
            <Route index element={<GenelBakisSayfasi />} />
            <Route path="cariler" element={<CarilerSayfasi />} />
            <Route path="stok" element={<StokSayfasi />} />
            <Route path="siparisler" element={<SiparislerSayfasi />} />
            <Route path="banka-kasa" element={<BankaKasaSayfasi />} />
            <Route path="raporlar" element={<RaporlarSayfasi />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthSaglayici>
  );
}

export default App;
