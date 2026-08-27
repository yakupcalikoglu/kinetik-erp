import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SayfaBasligi } from '../components/Ortak';

import CekSekmesi from '../components/finansal/Cek';
import PosTaksitSekmesi from '../components/finansal/PosTaksit';
import AkreditifSekmesi from '../components/finansal/Akreditif';
import LeasingSekmesi from '../components/finansal/Leasing';
import TaksitSekmesi from '../components/finansal/Taksit';
import KiralamaSekmesi from '../components/finansal/Kiralama';
import BakimSekmesi from '../components/finansal/Bakim';
import PersonelSekmesi from '../components/finansal/Personel';
import SabitGiderSekmesi from '../components/finansal/SabitGider';
import BorcSekmesi from '../components/finansal/Borc';

export default function FinansalTakipSayfasi() {
  const [arananParametreler] = useSearchParams();
  const [sekme, setSekme] = useState(arananParametreler.get('sekme') || 'taksit');
  // Navigasyon ARTIK sol ANA menudeki (AnaDuzen) akordeondan geliyor - o,
  // URL'i ("/finansal?sekme=X") degistirerek calisiyor. Bu component ZATEN
  // "/finansal" sayfasindaysa (yeniden MOUNT olmadan, SADECE query
  // degisirse), useState'in ILK deger okumasi TEKRAR calismaz - bu yuzden
  // URL degistiginde "sekme"yi burada AYRICA senkronize ediyoruz.
  useEffect(() => {
    const yeni = arananParametreler.get('sekme');
    if (yeni) setSekme(yeni);
  }, [arananParametreler]);

  return (
    <div>
      <SayfaBasligi baslik="Finansal takip" aciklama="Çek, leasing, taksitli satış, kiralama, bakım, personel, diğer giderler ve borçlar" />
      {sekme === 'cek' && <CekSekmesi />}
      {sekme === 'postaksit' && <PosTaksitSekmesi />}
      {sekme === 'akreditif' && <AkreditifSekmesi />}
      {sekme === 'leasing' && <LeasingSekmesi />}
      {sekme === 'taksit' && <TaksitSekmesi />}
      {sekme === 'kiralama' && <KiralamaSekmesi />}
      {sekme === 'bakim' && <BakimSekmesi />}
      {sekme === 'personel' && <PersonelSekmesi />}
      {sekme === 'gider' && <SabitGiderSekmesi />}
      {sekme === 'borc' && <BorcSekmesi />}
    </div>
  );
}
