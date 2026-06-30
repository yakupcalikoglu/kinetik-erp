import { useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import {
  Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, BosDurum, paraFormat,
} from '../components/Ortak';

const HAREKET_TURLERI = [
  { deger: 'MAAS', etiket: 'Maaş' },
  { deger: 'KIRA_GELIRI', etiket: 'Kira Geliri' },
  { deger: 'SABIT_GIDER', etiket: 'Sabit Gider' },
  { deger: 'BORC_ODEME', etiket: 'Borç Ödeme' },
  { deger: 'BAKIM_GELIRI', etiket: 'Bakım Geliri' },
  { deger: 'BAKIM_GIDERI', etiket: 'Bakım Gideri' },
];

function HareketTuruRaporu() {
  const [tur, setTur] = useState('MAAS');
  const [sonuc, setSonuc] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function sorgula() {
    setYukleniyor(true);
    setHata(null);
    try {
      const { data } = await api.get('/raporlar/hareket-turu', { params: { tur } });
      setSonuc(data);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <Kart>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>Hareket türüne göre rapor</div>
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <Alan etiket="Hareket türü">
            <select value={tur} onChange={(e) => setTur(e.target.value)} style={girdiStili}>
              {HAREKET_TURLERI.map((t) => <option key={t.deger} value={t.deger}>{t.etiket}</option>)}
            </select>
          </Alan>
        </div>
        <Buton onClick={sorgula} disabled={yukleniyor} style={{ marginBottom: 14 }}>
          {yukleniyor ? 'Sorgulanıyor...' : 'Sorgula'}
        </Buton>
      </div>

      {sonuc && (
        sonuc.satirlar.length === 0 ? (
          <BosDurum baslik="Bu türde kayıt bulunamadı" />
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 10 }}>
              {sonuc.adet} kayıt · Toplam: <strong>{paraFormat(sonuc.toplam_tutar)}</strong>
            </div>
            <table>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Tarih', 'Açıklama', 'Tutar'].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sonuc.satirlar.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '8px 12px' }}>{s.tarih}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--metin-ikincil)' }}>{s.aciklama || '—'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{paraFormat(s.tutar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      )}
    </Kart>
  );
}

function SeriNoRaporu() {
  const [seriNo, setSeriNo] = useState('');
  const [sonuc, setSonuc] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function sorgula() {
    if (!seriNo.trim()) return;
    setYukleniyor(true);
    setHata(null);
    setSonuc(null);
    try {
      const { data } = await api.get('/raporlar/seri-no', { params: { seri_no: seriNo } });
      setSonuc(data);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <Kart style={{ marginTop: 16 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>Seri numarasına göre rapor</div>
      <HataMesaji>{hata}</HataMesaji>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={seriNo}
          onChange={(e) => setSeriNo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sorgula()}
          placeholder="Örn: HC2026-00451"
          style={{ ...girdiStili, maxWidth: 280 }}
        />
        <Buton onClick={sorgula} disabled={yukleniyor}>{yukleniyor ? 'Aranıyor...' : 'Ara'}</Buton>
      </div>

      {sonuc && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13.5 }}>
          <div><span style={{ color: 'var(--metin-ikincil)' }}>Marka / Model:</span> {sonuc.marka} {sonuc.model}</div>
          <div><span style={{ color: 'var(--metin-ikincil)' }}>Durum:</span> {sonuc.durum}</div>
          <div><span style={{ color: 'var(--metin-ikincil)' }}>Toplam maliyet:</span> {paraFormat(sonuc.toplam_maliyet_try)}</div>
          <div><span style={{ color: 'var(--metin-ikincil)' }}>Satış fiyatı:</span> {sonuc.satis_fiyati_try != null ? paraFormat(sonuc.satis_fiyati_try) : '—'}</div>
          <div>
            <span style={{ color: 'var(--metin-ikincil)' }}>Kâr/Zarar:</span>{' '}
            <strong style={{ color: sonuc.kar_zarar_try >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
              {sonuc.kar_zarar_try != null ? paraFormat(sonuc.kar_zarar_try) : '—'}
            </strong>
          </div>
          <div><span style={{ color: 'var(--metin-ikincil)' }}>Bakım geliri / gideri:</span> {paraFormat(sonuc.bakim_geliri_toplam)} / {paraFormat(sonuc.bakim_gideri_toplam)}</div>
        </div>
      )}
    </Kart>
  );
}

export default function RaporlarSayfasi() {
  return (
    <div>
      <SayfaBasligi baslik="Raporlar" aciklama="Hareket türüne ve seri numarasına göre filtrelenebilir raporlar" />
      <HareketTuruRaporu />
      <SeriNoRaporu />
    </div>
  );
}
