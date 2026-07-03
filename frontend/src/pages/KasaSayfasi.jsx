import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, paraFormat } from '../components/Ortak';

function YeniKasaHareketiFormu({ onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({ tarih: new Date().toISOString().slice(0, 10), yon: 'GIRIS', tutar_try: '', aciklama: '' });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.post('/kasa-hareketleri', { ...form, tutar_try: Number(form.tutar_try) });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <Kart style={{ marginBottom: 16 }}>
      <form onSubmit={kaydet}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Yeni kasa hareketi</div>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Tarih">
            <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Yön">
            <select value={form.yon} onChange={(e) => setForm((f) => ({ ...f, yon: e.target.value }))} style={girdiStili}>
              <option value="GIRIS">Giriş</option>
              <option value="CIKIS">Çıkış</option>
            </select>
          </Alan>
          <Alan etiket="Tutar (TL)">
            <input required type="number" step="0.01" value={form.tutar_try} onChange={(e) => setForm((f) => ({ ...f, tutar_try: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Açıklama">
            <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
          </Alan>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Hareketi kaydet'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

export default function KasaSayfasi() {
  const [kasaBakiye, setKasaBakiye] = useState(null);
  const [kasaHareketleri, setKasaHareketleri] = useState([]);
  const [yonFiltre, setYonFiltre] = useState('');
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);

  function yukle() {
    setYukleniyor(true);
    Promise.all([
      api.get('/kasa-bakiye'),
      api.get('/kasa-hareketleri'),
    ])
      .then(([bakiyeRes, hareketRes]) => {
        setKasaBakiye(bakiyeRes.data);
        setKasaHareketleri(hareketRes.data);
      })
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  useEffect(yukle, []);

  const gosterilecekHareketler = yonFiltre
    ? kasaHareketleri.filter((h) => h.yon === yonFiltre)
    : kasaHareketleri;

  return (
    <div>
      <SayfaBasligi baslik="Ana Kasa" aciklama="Nakit giriş/çıkış hareketleri" />
      <HataMesaji>{hata}</HataMesaji>

      <Kart style={{ marginBottom: 16, background: 'var(--lacivert)', color: 'white' }}>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
          Ana kasa net bakiyesi
        </div>
        <div style={{ fontSize: 28, fontWeight: 600 }}>
          {kasaBakiye ? paraFormat(kasaBakiye.net_bakiye_try) : '—'}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
          Sadece gerçek nakit girişi/çıkışı burada izlenir — banka hareketleri bu bakiyeyi etkilemez.
        </div>
      </Kart>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 12 }}>
        <Alan etiket="Yöne göre filtrele">
          <select value={yonFiltre} onChange={(e) => setYonFiltre(e.target.value)} style={{ ...girdiStili, minWidth: 180 }}>
            <option value="">Tümü</option>
            <option value="GIRIS">Giriş</option>
            <option value="CIKIS">Çıkış</option>
          </select>
        </Alan>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni kasa hareketi'}</Buton>
      </div>

      {formAcik && (
        <YeniKasaHareketiFormu onKaydedildi={() => { setFormAcik(false); yukle(); }} onVazgec={() => setFormAcik(false)} />
      )}

      <Kart style={{ padding: 0 }}>
        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : gosterilecekHareketler.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Bu filtrede kasa hareketi yok.</div>
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Tarih', 'Yön', 'Tutar (TL)', 'Açıklama'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gosterilecekHareketler.map((h) => (
                <tr key={h.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{h.tarih}</td>
                  <td style={{ padding: '10px 16px' }}>{h.yon === 'GIRIS' ? 'Giriş' : 'Çıkış'}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: h.yon === 'GIRIS' ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                    {paraFormat(h.tutar_try)}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{h.aciklama || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}
