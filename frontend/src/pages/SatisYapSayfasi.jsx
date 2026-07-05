import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, paraFormat, Sekmeler } from '../components/Ortak';

const ODEME_TIPLERI = [
  { deger: 'PESIN_NAKIT', etiket: 'Nakit' },
  { deger: 'PESIN_HAVALE', etiket: 'Havale/EFT' },
  { deger: 'PESIN_KART', etiket: 'Kredi Kartı' },
  { deger: 'TAKSITLI', etiket: 'Taksitli' },
  { deger: 'LEASINGLI', etiket: 'Leasing' },
  { deger: 'CEK', etiket: 'Çek' },
];

const ODEME_TIPI_ACIKLAMA = {
  PESIN_NAKIT: 'Tutar elden alınır, Ana Kasa\'ya işlenir.',
  PESIN_HAVALE: 'Tutar seçtiğiniz banka hesabına yatar.',
  PESIN_KART: 'Tutar POS\'unuzun bağlı olduğu banka hesabına yatar.',
  TAKSITLI: 'Müşteri, belirlediğiniz sayıda taksitle öder.',
  LEASINGLI: 'Leasing şirketi üzerinden taksitli ödeme yapılır.',
  CEK: 'Müşteriden çek alınır, vadesinde tahsil edilir.',
};

export default function SatisYapSayfasi() {
  const [searchParams] = useSearchParams();
  const onSeciliUrunId = searchParams.get('urun');

  const [urunler, setUrunler] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [urunId, setUrunId] = useState(onSeciliUrunId || '');
  const [musteriCariId, setMusteriCariId] = useState('');
  const [odemeTipi, setOdemeTipi] = useState('PESIN_NAKIT');
  const [tutar, setTutar] = useState('');
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [bankaHesapId, setBankaHesapId] = useState('');
  const [taksitSayisi, setTaksitSayisi] = useState(3);
  const [pesinat, setPesinat] = useState('0');
  const [cekNo, setCekNo] = useState('');
  const [cekBankaAdi, setCekBankaAdi] = useState('');
  const [cekVadeTarihi, setCekVadeTarihi] = useState('');
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [tamamlandi, setTamamlandi] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/stok-seri-no', { params: { durum: 'DEPODA' } }),
      api.get('/stok-seri-no', { params: { durum: 'ANTREPODA' } }),
    ]).then(([depoRes, antrepoRes]) => {
      setUrunler([...depoRes.data, ...antrepoRes.data]);
    }).catch((e) => setHata(hataMesajiCikar(e)));
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
  }, []);

  const seciliUrun = urunler.find((u) => String(u.id) === String(urunId));
  const bankaGerekli = odemeTipi === 'PESIN_HAVALE' || odemeTipi === 'PESIN_KART' || odemeTipi === 'LEASINGLI';

  async function satisiTamamla(e) {
    e.preventDefault();
    setHata(null);

    if (!urunId) { setHata('Lütfen satılacak ürünü seçin.'); return; }
    if (!musteriCariId) { setHata('Lütfen müşteriyi seçin.'); return; }
    if (!tutar || Number(tutar) <= 0) { setHata('Lütfen geçerli bir tutar girin.'); return; }

    setKaydediliyor(true);
    try {
      if (odemeTipi === 'PESIN_NAKIT') {
        await api.post(`/stok-seri-no/${urunId}/satis`, {
          musteri_cari_id: Number(musteriCariId), satis_fiyati_try: Number(tutar),
          satis_tarihi: tarih, odeme_yontemi: 'NAKIT', banka_hesap_id: null,
        });
      } else if (odemeTipi === 'PESIN_HAVALE' || odemeTipi === 'PESIN_KART' || odemeTipi === 'LEASINGLI') {
        if (!bankaHesapId) { setHata('Lütfen paranın yatacağı banka hesabını seçin.'); setKaydediliyor(false); return; }
        await api.post(`/stok-seri-no/${urunId}/satis`, {
          musteri_cari_id: Number(musteriCariId), satis_fiyati_try: Number(tutar),
          satis_tarihi: tarih, odeme_yontemi: 'BANKA', banka_hesap_id: Number(bankaHesapId),
        });
      } else if (odemeTipi === 'TAKSITLI') {
        await api.post('/taksitli-satis-planlari', {
          musteri_cari_id: Number(musteriCariId), stok_seri_no_id: Number(urunId),
          toplam_tutar: Number(tutar), pesinat: Number(pesinat || 0),
          taksit_sayisi: Number(taksitSayisi), baslangic_tarihi: tarih, para_birimi: 'TRY',
        });
      } else if (odemeTipi === 'CEK') {
        if (!cekVadeTarihi) { setHata('Lütfen çekin vade tarihini girin.'); setKaydediliyor(false); return; }
        await api.put(`/stok-seri-no/${urunId}/durum`, {
          durum: 'SATILDI', musteri_cari_id: Number(musteriCariId),
          satis_fiyati_try: Number(tutar), satis_tarihi: tarih,
        });
        await api.post('/cekler', {
          tip: 'ALINAN', cek_no: cekNo || null, banka_adi: cekBankaAdi || null,
          cari_id: Number(musteriCariId), tutar: Number(tutar),
          vade_tarihi: cekVadeTarihi, alinma_verilme_tarihi: tarih,
        });
      }
      setTamamlandi(true);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  if (tamamlandi) {
    return (
      <div>
        <SayfaBasligi baslik="Satış Yap" />
        <Kart style={{ background: 'var(--yesil-acik)' }}>
          <div style={{ color: 'var(--yesil)', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Satış tamamlandı</div>
          <div style={{ fontSize: 13.5, color: 'var(--metin-ikincil)', marginBottom: 16 }}>
            Ürün "Satıldı" olarak işaretlendi ve ilgili kayıt oluşturuldu.
          </div>
          <Buton onClick={() => window.location.reload()}>Yeni satış yap</Buton>
        </Kart>
      </div>
    );
  }

  return (
    <div>
      <SayfaBasligi baslik="Satış Yap" aciklama="Satış otomatik olarak Kasa/Banka/Çek/Taksit kayıtlarına işlenir" />
      <HataMesaji>{hata}</HataMesaji>

      <Kart>
        <form onSubmit={satisiTamamla}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Alan etiket="Ürün">
              <select required value={urunId} onChange={(e) => setUrunId(e.target.value)} style={girdiStili}>
                <option value="">Seçin...</option>
                {urunler.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.seri_no} — Maliyet: {paraFormat(u.toplam_maliyet_try)}
                  </option>
                ))}
              </select>
              {urunler.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', marginTop: 4 }}>
                  Depoda veya Antrepoda ürün yok. Stok sayfasından bir ürünün durumunu güncelleyin.
                </div>
              )}
            </Alan>
            <Alan etiket="Müşteri">
              <select required value={musteriCariId} onChange={(e) => setMusteriCariId(e.target.value)} style={girdiStili}>
                <option value="">Seçin...</option>
                {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
              </select>
            </Alan>
          </div>

          <div style={{ marginTop: 16, marginBottom: 4 }}>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 6 }}>Ödeme Türü</span>
            <Sekmeler sekmeler={ODEME_TIPLERI} aktif={odemeTipi} onDegistir={setOdemeTipi} />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)', marginTop: -12, marginBottom: 14 }}>
            {ODEME_TIPI_ACIKLAMA[odemeTipi]}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <Alan etiket={odemeTipi === 'TAKSITLI' || odemeTipi === 'LEASINGLI' ? 'Toplam Tutar (TL)' : 'Tutar (TL)'}>
              <input required type="number" step="0.01" value={tutar} onChange={(e) => setTutar(e.target.value)} style={girdiStili} />
            </Alan>
            <Alan etiket="Tarih">
              <input required type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={girdiStili} />
            </Alan>

            {bankaGerekli && (
              <Alan etiket="Banka Hesabı">
                <select required value={bankaHesapId} onChange={(e) => setBankaHesapId(e.target.value)} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {bankaHesaplari.map((h) => (
                    <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                  ))}
                </select>
              </Alan>
            )}

            {(odemeTipi === 'TAKSITLI' || odemeTipi === 'LEASINGLI') && (
              <>
                <Alan etiket="Peşinat (TL)">
                  <input type="number" step="0.01" value={pesinat} onChange={(e) => setPesinat(e.target.value)} style={girdiStili} />
                </Alan>
                <Alan etiket="Taksit Sayısı">
                  <input required type="number" min="2" value={taksitSayisi} onChange={(e) => setTaksitSayisi(e.target.value)} style={girdiStili} />
                </Alan>
              </>
            )}

            {odemeTipi === 'CEK' && (
              <>
                <Alan etiket="Çek No">
                  <input value={cekNo} onChange={(e) => setCekNo(e.target.value)} style={girdiStili} />
                </Alan>
                <Alan etiket="Çekin Bankası">
                  <input value={cekBankaAdi} onChange={(e) => setCekBankaAdi(e.target.value)} style={girdiStili} />
                </Alan>
                <Alan etiket="Vade Tarihi">
                  <input required type="date" value={cekVadeTarihi} onChange={(e) => setCekVadeTarihi(e.target.value)} style={girdiStili} />
                </Alan>
              </>
            )}
          </div>

          {seciliUrun && tutar && (
            <div style={{
              marginTop: 4, marginBottom: 16, padding: 10, borderRadius: 7, background: 'var(--zemin)', fontSize: 13,
              color: Number(tutar) - seciliUrun.toplam_maliyet_try >= 0 ? 'var(--yesil)' : 'var(--kirmizi)',
            }}>
              Tahmini kâr/zarar: {paraFormat(Number(tutar) - seciliUrun.toplam_maliyet_try)}
              <span style={{ color: 'var(--metin-soluk)' }}> (maliyet: {paraFormat(seciliUrun.toplam_maliyet_try)})</span>
            </div>
          )}

          <Buton type="submit" disabled={kaydediliyor}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Satışı Tamamla'}
          </Buton>
        </form>
      </Kart>
    </div>
  );
}
