import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, apiYapilandir, hataMesajiCikar } from '../api/client';

const AuthBaglami = createContext(null);

const DEPOLAMA_ANAHTARI = 'kinetik_oturum';

export function AuthSaglayici({ children }) {
  const [oturum, setOturum] = useState(() => {
    const kayitli = localStorage.getItem(DEPOLAMA_ANAHTARI);
    const ilkOturum = kayitli ? JSON.parse(kayitli) : null;
    // Sayfa ilk yuklendiginde, herhangi bir component veri cekmeye baslamadan
    // ONCE header'lari senkron olarak ayarla (useEffect'e birakirsak, alt
    // component'lerin effect'leri daha once calisip headersiz istek atabilir).
    apiYapilandir({ token: ilkOturum?.token, sirketId: ilkOturum?.aktifSirketId });
    return ilkOturum;
  });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState(null);

  // localStorage senkronizasyonu (header ayari yukarida senkron yapildigi
  // icin burada sadece kalici depolamayi guncelliyoruz)
  useEffect(() => {
    if (oturum) {
      localStorage.setItem(DEPOLAMA_ANAHTARI, JSON.stringify(oturum));
    } else {
      localStorage.removeItem(DEPOLAMA_ANAHTARI);
    }
  }, [oturum]);

  const girisYap = useCallback(async (email, sifre) => {
    setYukleniyor(true);
    setHata(null);
    try {
      const { data } = await api.post('/auth/login', { email, sifre });
      const ilkSirket = data.erisebildigi_sirketler?.[0];
      const yeniOturum = {
        token: data.token,
        kullanici: data.kullanici,
        sirketler: data.erisebildigi_sirketler,
        aktifSirketId: ilkSirket?.id ?? null,
      };
      apiYapilandir({ token: yeniOturum.token, sirketId: yeniOturum.aktifSirketId });
      setOturum(yeniOturum);
      return true;
    } catch (err) {
      setHata(hataMesajiCikar(err));
      return false;
    } finally {
      setYukleniyor(false);
    }
  }, []);

  const cikisYap = useCallback(() => {
    apiYapilandir({ token: null, sirketId: null });
    setOturum(null);
  }, []);

  const sirketDegistir = useCallback((sirketId) => {
    setOturum((onceki) => {
      if (!onceki) return onceki;
      apiYapilandir({ token: onceki.token, sirketId });
      return { ...onceki, aktifSirketId: sirketId };
    });
  }, []);

  // Yeni sirket olusturulduktan sonra, token icindeki eski sirket listesini
  // yenilemeden kullaniciya gosterebilmek icin /auth/me'den guncel listeyi
  // ceker ve oturuma isler (sayfayi yeniden yuklemeye gerek kalmaz).
  const sirketleriTazele = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setOturum((onceki) => onceki ? { ...onceki, sirketler: data.erisebildigi_sirketler } : onceki);
    } catch {
      // sessizce yut - kritik olmayan bir tazeleme islemi
    }
  }, []);
  
const izinVarMi = useCallback((izinKodu) => {
    if (!izinKodu) return true; // izin belirtilmemisse herkese acik
    const aktifSirket = oturum?.sirketler?.find((s) => s.id === oturum.aktifSirketId);
    return aktifSirket?.izin_kodlari?.includes(izinKodu) ?? false;
  }, [oturum]);
  
  return (
    <AuthBaglami.Provider value={{ oturum, girisYap, cikisYap, sirketDegistir, sirketleriTazele, izinVarMi, yukleniyor, hata }}>

export function useAuth() {
  const baglam = useContext(AuthBaglami);
  if (!baglam) throw new Error('useAuth, AuthSaglayici icinde kullanilmalidir.');
  return baglam;
}
