import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, HataMesaji, paraFormat } from '../components/Ortak';

export default function BankaKasaSayfasi() {
  const [bakiyeler, setBakiyeler] = useState([]);
  const [kasaBakiye, setKasaBakiye] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/banka-bakiyeleri'),
      api.get('/kasa-bakiye'),
    ])
      .then(([bankaRes, kasaRes]) => {
        setBakiyeler(bankaRes.data);
        setKasaBakiye(kasaRes.data);
      })
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }, []);

  return (
    <div>
      <SayfaBasligi baslik="Banka / Ana Kasa" aciklama="Banka hesap bakiyeleri ve ana kasa net durumu" />
      <HataMesaji>{hata}</HataMesaji>

      {yukleniyor ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : (
        <>
          <Kart style={{ marginBottom: 16, background: 'var(--lacivert)', color: 'white' }}>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
              Ana kasa net bakiyesi
            </div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>
              {kasaBakiye ? paraFormat(kasaBakiye.net_bakiye_try) : '—'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
              Banka ve döviz çevirme hareketleri bu bakiyeyi etkilemez — yalnızca gerçek nakit girişi/çıkışı.
            </div>
          </Kart>

          <Kart style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--kenarlik)' }}>
              Banka hesapları
            </div>
            <table>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Banka', 'Hesap', 'Para Birimi', 'Bakiye'].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bakiyeler.map((b) => (
                  <tr key={b.banka_hesap_id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{b.banka_adi}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--metin-ikincil)' }}>{b.hesap_adi || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{b.para_birimi}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{paraFormat(b.bakiye, b.para_birimi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kart>
        </>
      )}
    </div>
  );
}
