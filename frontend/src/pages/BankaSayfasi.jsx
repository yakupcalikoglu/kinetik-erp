import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, paraFormat, eylemChipStili, Sekmeler, OtomatikTamamlamaGirdisi } from '../components/Ortak';

function useHarcamaTurleri() {
  const [turler, setTurler] = useState([]);
  useEffect(() => {
    api.get('/harcama-turleri').then((r) => setTurler(r.data.map((t) => t.ad))).catch(() => {});
  }, []);
  return turler;
}

function useCariHaritasi() {
  const [harita, setHarita] = useState({});
  useEffect(() => {
    api.get('/cariler').then((r) => {
      const h = {};
      r.data.forEach((c) => { h[c.id] = c.unvan; });
      setHarita(h);
    }).catch(() => {});
  }, []);
  return harita;
}

function useCariler() {
  const [cariler, setCariler] = useState([]);
  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);
  return cariler;
}

function useBekleyenOdemeler() {
  const [liste, setListe] = useState([]);
  useEffect(() => {
    api.get('/kaynak-detay/bekleyen-odemeler').then((r) => setListe(r.data)).catch(() => {});
  }, []);
  return liste;
}

const TUR_GRUPLARI = {
  AKREDITIF: ['AKREDITIF_KALEMI', 'AKREDITIF_KALEM_TAKSIT'],
  LEASING: ['LEASING_ODEME'],
  CEK: ['CEKLER'],
  KIRALAMA: ['KIRALAMA_ODEME'],
  TAKSIT: ['TAKSIT_DETAY'],
  PERSONEL: ['PERSONEL_ODEME'],
  SABIT_GIDER: ['SABIT_GIDER'],
};

const TUR_METIN = {
  SERBEST: 'Serbest (bağımsız hareket)',
  AKREDITIF: 'Akreditif',
  LEASING: 'Leasing',
  CEK: 'Çek',
  KIRALAMA: 'Kiralama',
  TAKSIT: 'Taksitli Satış',
  PERSONEL: 'Personel',
  SABIT_GIDER: 'Sabit Gider',
};

const UST_BASLIK_ETIKET = {
  AKREDITIF: 'Akreditif No',
  LEASING: 'Leasing Sözleşme No',
  CEK: 'Çek',
  KIRALAMA: 'Kiralama Sözleşmesi',
  TAKSIT: 'Taksitli Satış Planı',
  PERSONEL: 'Personel',
  SABIT_GIDER: 'Kategori',
};

const BEKLEYEN_ENDPOINT_MAP = {
  LEASING_ODEME: (id) => `/leasing-odemeleri/${id}/ode`,
  KIRALAMA_ODEME: (id) => `/kiralama-odemeleri/${id}/tahsil-et`,
  TAKSIT_DETAY: (id) => `/taksit-detay/${id}/tahsil-et`,
  PERSONEL_ODEME: (id) => `/personel-odemeleri/${id}/ode`,
  SABIT_GIDER: (id) => `/sabit-giderler/${id}/ode`,
  AKREDITIF_KALEMI: (id) => `/akreditif-kalemleri/${id}/ode`,
  AKREDITIF_KALEM_TAKSIT: (id) => `/akreditif-kalem-taksitleri/${id}/ode`,
};

async function bekleyenOdemeyiGonder(secili, { odeme_tarihi, odeme_yontemi, banka_hesap_id, kur }) {
  if (secili.kaynak_tablo === 'CEKLER') {
    return api.put(`/cekler/${secili.kaynak_id}/durum`, {
      yeni_durum: secili.yon === 'GIRIS' ? 'TAHSIL_EDILDI' : 'ODENDI',
      odeme_yontemi, banka_hesap_id, kur,
    });
  }
  const endpointFn = BEKLEYEN_ENDPOINT_MAP[secili.kaynak_tablo];
  return api.put(endpointFn(secili.kaynak_id), { odeme_tarihi, odeme_yontemi, banka_hesap_id, kur });
}

const SEKMELER = [
  { deger: 'hareketler', etiket: 'Hareketler' },
  { deger: 'hesaplar', etiket: 'Hesaplar' },
];

// Her kaynak_tablo icin "geri al" uc noktasi. Burada olmayan turler (orn.
// BAKIM_KAYDI, VIRMAN_CARI_CARI) icin panelde geri al butonu gosterilmez -
// o modullerin kendi sayfasindan yonetilmesi gerekir.
const GERI_AL_HARITASI = {
  AKREDITIF_KALEMI: { yontem: 'PUT', url: (id) => `/akreditif-kalemleri/${id}/odemeyi-geri-al` },
  AKREDITIF_KALEM_TAKSIT: { yontem: 'PUT', url: (id) => `/akreditif-kalem-taksitleri/${id}/odemeyi-geri-al` },
  LEASING_ODEME: { yontem: 'PUT', url: (id) => `/leasing-odemeleri/${id}/odemeyi-geri-al` },
  KIRALAMA_ODEME: { yontem: 'PUT', url: (id) => `/kiralama-odemeleri/${id}/tahsilati-geri-al` },
  TAKSIT_DETAY: { yontem: 'PUT', url: (id) => `/taksit-detay/${id}/tahsilati-geri-al` },
  PERSONEL_ODEME: { yontem: 'PUT', url: (id) => `/personel-odemeleri/${id}/odemeyi-geri-al` },
  SABIT_GIDER: { yontem: 'PUT', url: (id) => `/sabit-giderler/${id}/odemeyi-geri-al` },
  BORC_ODEME: { yontem: 'DELETE', url: (id) => `/borc-odemeleri/${id}` },
  STOK_SATIS: { yontem: 'PUT', url: (id) => `/stok-seri-no/${id}/satisi-geri-al` },
  CEKLER: { yontem: 'PUT', url: (id) => `/cekler/${id}/durumu-geri-al` },
};

function KaynakDetayi({ kaynakTablo, kaynakId, onIslemTamamlandi }) {
  const [detay, setDetay] = useState(null);
  const [hata, setHata] = useState(null);
  const [islemYapiliyor, setIslemYapiliyor] = useState(false);

  useEffect(() => {
    api.get(`/kaynak-detay/${kaynakTablo}/${kaynakId}`)
      .then((r) => setDetay(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)));
  }, [kaynakTablo, kaynakId]);

  const geriAlBilgisi = GERI_AL_HARITASI[kaynakTablo];

  async function geriAl() {
    if (!window.confirm('Bu işlemi geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.')) return;
    setIslemYapiliyor(true);
    setHata(null);
    try {
      if (geriAlBilgisi.yontem === 'DELETE') {
        await api.delete(geriAlBilgisi.url(kaynakId));
      } else {
        await api.put(geriAlBilgisi.url(kaynakId));
      }
      onIslemTamamlandi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
      setIslemYapiliyor(false);
    }
  }

  if (hata) return <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--kirmizi)' }}>{hata}</div>;
  if (!detay) return <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '12px 16px', background: 'var(--zemin)', fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{detay.baslik}</div>
      {detay.detaylar.map(([etiket, deger]) => (
        <div key={etiket} style={{ display: 'flex', gap: 8, color: 'var(--metin-ikincil)' }}>
          <span style={{ minWidth: 130 }}>{etiket}:</span>
          <span style={{ color: 'var(--metin-birincil)' }}>{deger}</span>
        </div>
      ))}
      {geriAlBilgisi && (
        <div style={{ marginTop: 10 }}>
          <button onClick={geriAl} disabled={islemYapiliyor} style={eylemChipStili('kirmizi')}>
            {islemYapiliyor ? 'İşleniyor...' : 'Bu İşlemi Geri Al'}
          </button>
        </div>
      )}
    </div>
  );
}

function bosHesapForm() {
  return { banka_adi: '', hesap_adi: '', iban: '', para_birimi: 'TRY' };
}

function HesapFormu({ duzenlenenHesap, onKaydedildi, onVazgec }) {
  const duzenlemeModu = !!duzenlenenHesap;
  const [form, setForm] = useState(() => duzenlenenHesap
    ? {
        banka_adi: duzenlenenHesap.banka_adi || '',
        hesap_adi: duzenlenenHesap.hesap_adi || '',
        iban: duzenlenenHesap.iban || '',
        para_birimi: duzenlenenHesap.para_birimi || 'TRY',
      }
    : bosHesapForm()
  );
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      if (duzenlemeModu) {
        await api.put(`/banka-hesaplari/${duzenlenenHesap.id}`, form);
      } else {
        await api.post('/banka-hesaplari', form);
      }
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
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>
          {duzenlemeModu ? `Hesabı düzenle — ${duzenlenenHesap.banka_adi}` : 'Yeni banka hesabı'}
        </div>
        <HataMesaji>{hata}</HataMesaji>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Alan etiket="Banka adı">
            <input required value={form.banka_adi} onChange={(e) => setForm((f) => ({ ...f, banka_adi: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Hesap adı">
            <input value={form.hesap_adi} onChange={(e) => setForm((f) => ({ ...f, hesap_adi: e.target.value }))} placeholder="Örn: İş Bankası USD" style={girdiStili} />
          </Alan>
          <Alan etiket="IBAN">
            <input value={form.iban} onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))} style={girdiStili} />
          </Alan>
          <Alan etiket="Para birimi">
            <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ALTIN">ALTIN</option>
            </select>
          </Alan>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Buton type="submit" disabled={kaydediliyor}>
            {kaydediliyor ? 'Kaydediliyor...' : duzenlemeModu ? 'Değişiklikleri kaydet' : 'Hesabı kaydet'}
          </Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

function HesaplarSekmesi() {
  const [bakiyeler, setBakiyeler] = useState([]);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hesapFormuAcik, setHesapFormuAcik] = useState(false);
  const [duzenlenenHesap, setDuzenlenenHesap] = useState(null);

  function yukle() {
    setYukleniyor(true);
    api.get('/banka-bakiyeleri')
      .then((res) => setBakiyeler(res.data))
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  useEffect(yukle, []);

  function yeniHesapAc() {
    setDuzenlenenHesap(null);
    setHesapFormuAcik(true);
  }

  function duzenle(hesap) {
    setDuzenlenenHesap({ id: hesap.banka_hesap_id, banka_adi: hesap.banka_adi, hesap_adi: hesap.hesap_adi, para_birimi: hesap.para_birimi });
    setHesapFormuAcik(true);
  }

  function hesapFormunuKapat() {
    setHesapFormuAcik(false);
    setDuzenlenenHesap(null);
  }

  async function hesabiSil(hesap) {
    if (!window.confirm(`${hesap.banka_adi} hesabını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/banka-hesaplari/${hesap.banka_hesap_id}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => (hesapFormuAcik ? hesapFormunuKapat() : yeniHesapAc())}>
          {hesapFormuAcik ? 'Kapat' : '+ Yeni hesap'}
        </Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {hesapFormuAcik && (
        <HesapFormu
          duzenlenenHesap={duzenlenenHesap}
          onKaydedildi={() => { hesapFormunuKapat(); yukle(); }}
          onVazgec={hesapFormunuKapat}
        />
      )}

      {yukleniyor ? (
        <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : (
        <Kart style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--kenarlik)' }}>
            Banka hesapları
          </div>
          {bakiyeler.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Henüz banka hesabı yok.</div>
          ) : (
            <table>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Banka', 'Hesap', 'Para Birimi', 'Bakiye', 'İşlem'].map((b) => (
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
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => duzenle(b)} style={eylemChipStili('lacivert')}>Düzenle</button>
                        <button onClick={() => hesabiSil(b)} style={eylemChipStili('kirmizi')}>Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Kart>
      )}
    </div>
  );
}

const BANKA_HAREKET_TIP_METIN = {
  GIRIS: 'Giriş', CIKIS: 'Çıkış', HESAPLAR_ARASI_TRANSFER: 'Transfer',
  DOVIZ_ALIM: 'Döviz Alım', DOVIZ_SATIM: 'Döviz Satım',
};

function YeniBankaHareketiFormu({ hesaplar, onKaydedildi, onVazgec }) {
  const bekleyenler = useBekleyenOdemeler();
  const harcamaTurleri = useHarcamaTurleri();
  const cariler = useCariler();

  const [odemeTuru, setOdemeTuru] = useState('SERBEST');
  const [ustBaslik, setUstBaslik] = useState('');
  const [seciliAnahtar, setSeciliAnahtar] = useState('');
  const [baglantiliBankaHesapId, setBaglantiliBankaHesapId] = useState('');
  const [baglantiliTarih, setBaglantiliTarih] = useState(new Date().toISOString().slice(0, 10));
  const [baglantiliKur, setBaglantiliKur] = useState('1');

  const [form, setForm] = useState({
    banka_hesap_id: '', tarih: new Date().toISOString().slice(0, 10), tip: 'GIRIS',
    tutar: '', aciklama: '', karsi_hesap_id: '', kullanilan_kur: '', cari_id: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const ciftTarafli = ['HESAPLAR_ARASI_TRANSFER', 'DOVIZ_ALIM', 'DOVIZ_SATIM'].includes(form.tip);

  const kapsananTablolar = odemeTuru !== 'SERBEST' ? TUR_GRUPLARI[odemeTuru] : [];
  const buTurdekiBekleyenler = bekleyenler.filter((b) => kapsananTablolar.includes(b.kaynak_tablo));
  const ustBasliklar = [...new Set(buTurdekiBekleyenler.map((b) => b.ust_baslik))];
  const altKayitlar = ustBaslik ? buTurdekiBekleyenler.filter((b) => b.ust_baslik === ustBaslik) : [];
  const seciliKayit = altKayitlar.find((b) => `${b.kaynak_tablo}:${b.kaynak_id}` === seciliAnahtar);
  const baglantiliDovizli = seciliKayit && seciliKayit.para_birimi !== 'TRY';

  useEffect(() => {
    if (seciliKayit && seciliKayit.para_birimi !== 'TRY') {
      api.get(`/kur/${seciliKayit.para_birimi}`).then((r) => setBaglantiliKur(r.data.kur)).catch(() => {});
    }
  }, [seciliKayit?.kaynak_tablo, seciliKayit?.kaynak_id]); // eslint-disable-line

  function turDegistir(yeniTur) {
    setOdemeTuru(yeniTur);
    setUstBaslik('');
    setSeciliAnahtar('');
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      if (odemeTuru !== 'SERBEST') {
        if (!seciliKayit) {
          setHata('Lütfen hangi kayda ait olduğunu seçin.');
          setKaydediliyor(false);
          return;
        }
        if (!baglantiliBankaHesapId) {
          setHata('Lütfen hangi banka hesabından işlem yapıldığını seçin.');
          setKaydediliyor(false);
          return;
        }
        await bekleyenOdemeyiGonder(seciliKayit, {
          odeme_tarihi: baglantiliTarih,
          odeme_yontemi: 'BANKA',
          banka_hesap_id: Number(baglantiliBankaHesapId),
          kur: baglantiliDovizli ? Number(baglantiliKur) : null,
        });
      } else {
        await api.post('/banka-hareketleri', {
          banka_hesap_id: Number(form.banka_hesap_id),
          tarih: form.tarih,
          tip: form.tip,
          tutar: Number(form.tutar),
          aciklama: form.aciklama || null,
          karsi_hesap_id: form.karsi_hesap_id ? Number(form.karsi_hesap_id) : null,
          kullanilan_kur: form.kullanilan_kur ? Number(form.kullanilan_kur) : null,
          cari_id: form.cari_id ? Number(form.cari_id) : null,
        });
      }
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
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Yeni banka hareketi</div>
        <HataMesaji>{hata}</HataMesaji>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          {odemeTuru === 'SERBEST' && (
            <Alan etiket="Hesap">
              <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçin...</option>
                {hesaplar.map((h) => (
                  <option key={h.banka_hesap_id} value={h.banka_hesap_id}>
                    {h.banka_adi} — {h.hesap_adi || h.para_birimi}
                  </option>
                ))}
              </select>
            </Alan>
          )}
          {odemeTuru === 'SERBEST' && (
            <Alan etiket="İşlem türü">
              <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="GIRIS">Giriş</option>
                <option value="CIKIS">Çıkış</option>
                <option value="HESAPLAR_ARASI_TRANSFER">Hesaplar Arası Transfer</option>
                <option value="DOVIZ_ALIM">Döviz Alım</option>
                <option value="DOVIZ_SATIM">Döviz Satım</option>
              </select>
            </Alan>
          )}
          <Alan etiket="Ödeme Türü">
            <select value={odemeTuru} onChange={(e) => turDegistir(e.target.value)} style={girdiStili}>
              {Object.entries(TUR_METIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Alan>
        </div>

        {odemeTuru === 'SERBEST' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Tarih">
              <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket={ciftTarafli ? 'Tutar (kaynaktan çıkan, negatif girin)' : 'Tutar'}>
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))}
                placeholder={ciftTarafli ? 'Örn: -10000' : ''} style={girdiStili} />
            </Alan>
            {ciftTarafli && (
              <>
                <Alan etiket="Karşı hesap">
                  <select required value={form.karsi_hesap_id} onChange={(e) => setForm((f) => ({ ...f, karsi_hesap_id: e.target.value }))} style={girdiStili}>
                    <option value="">Seçin...</option>
                    {hesaplar.filter((h) => String(h.banka_hesap_id) !== form.banka_hesap_id).map((h) => (
                      <option key={h.banka_hesap_id} value={h.banka_hesap_id}>
                        {h.banka_adi} — {h.hesap_adi || h.para_birimi}
                      </option>
                    ))}
                  </select>
                </Alan>
                <Alan etiket="Kullanılan kur">
                  <input required type="number" step="0.0001" value={form.kullanilan_kur} onChange={(e) => setForm((f) => ({ ...f, kullanilan_kur: e.target.value }))} style={girdiStili} />
                </Alan>
              </>
            )}
            <Alan etiket="Cari (opsiyonel)">
              <select value={form.cari_id} onChange={(e) => setForm((f) => ({ ...f, cari_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçin...</option>
                {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
              </select>
            </Alan>
            <Alan etiket="Açıklama">
              <OtomatikTamamlamaGirdisi
                value={form.aciklama}
                onChange={(v) => setForm((f) => ({ ...f, aciklama: v }))}
                secenekler={harcamaTurleri}
                listeId="harcama-turleri-yeni-banka"
                placeholder="Yazmaya başlayın veya listeden seçin"
              />
            </Alan>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Alan etiket={UST_BASLIK_ETIKET[odemeTuru]}>
              <select
                required
                value={ustBaslik}
                onChange={(e) => { setUstBaslik(e.target.value); setSeciliAnahtar(''); }}
                style={girdiStili}
              >
                <option value="">Seçin...</option>
                {ustBasliklar.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              {ustBasliklar.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--metin-soluk)', marginTop: 4 }}>Bu türde bekleyen kayıt yok.</div>
              )}
            </Alan>
            <Alan etiket="Kalem / Taksit / Dönem">
              <select
                required
                disabled={!ustBaslik}
                value={seciliAnahtar}
                onChange={(e) => setSeciliAnahtar(e.target.value)}
                style={girdiStili}
              >
                <option value="">{ustBaslik ? 'Seçin...' : 'Önce üstteki seçimi yapın'}</option>
                {altKayitlar.map((b) => (
                  <option key={`${b.kaynak_tablo}:${b.kaynak_id}`} value={`${b.kaynak_tablo}:${b.kaynak_id}`}>
                    {b.etiket} — {paraFormat(b.tutar, b.para_birimi)} {b.vade_tarihi ? `(${b.vade_tarihi})` : ''}
                  </option>
                ))}
              </select>
            </Alan>
            <Alan etiket="Hangi banka hesabından?">
              <select required value={baglantiliBankaHesapId} onChange={(e) => setBaglantiliBankaHesapId(e.target.value)} style={girdiStili}>
                <option value="">Seçin...</option>
                {hesaplar.map((h) => (
                  <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                ))}
              </select>
            </Alan>
            {baglantiliDovizli && (
              <Alan etiket={`${seciliKayit.para_birimi} için TL kuru (otomatik, elle değiştirilebilir)`}>
                <input required type="number" step="0.0001" value={baglantiliKur} onChange={(e) => setBaglantiliKur(e.target.value)} style={girdiStili} />
              </Alan>
            )}
            <Alan etiket="Tarih">
              <input required type="date" value={baglantiliTarih} onChange={(e) => setBaglantiliTarih(e.target.value)} style={girdiStili} />
            </Alan>
          </div>
        )}
        {baglantiliDovizli && baglantiliKur && seciliKayit && (
          <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginTop: -8, marginBottom: 8 }}>
            TL karşılığı: <strong>{paraFormat(Number(seciliKayit.tutar) * (Number(baglantiliKur) || 0))}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Hareketi kaydet'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </Kart>
  );
}

function BankaHareketiDuzenleFormu({ hareket, hesaplar, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    banka_hesap_id: String(hareket.banka_hesap_id), tarih: hareket.tarih, tip: hareket.tip,
    tutar: hareket.tutar, aciklama: hareket.aciklama || '',
    karsi_hesap_id: hareket.karsi_hesap_id ? String(hareket.karsi_hesap_id) : '',
    kullanilan_kur: hareket.kullanilan_kur ?? '',
    cari_id: hareket.cari_id ? String(hareket.cari_id) : '',
  });
  const harcamaTurleri = useHarcamaTurleri();
  const cariler = useCariler();
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const ciftTarafli = ['HESAPLAR_ARASI_TRANSFER', 'DOVIZ_ALIM', 'DOVIZ_SATIM'].includes(form.tip);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/banka-hareketleri/${hareket.id}`, {
        banka_hesap_id: Number(form.banka_hesap_id),
        tarih: form.tarih,
        tip: form.tip,
        tutar: Number(form.tutar),
        aciklama: form.aciklama || null,
        karsi_hesap_id: form.karsi_hesap_id ? Number(form.karsi_hesap_id) : null,
        kullanilan_kur: form.kullanilan_kur ? Number(form.kullanilan_kur) : null,
        cari_id: form.cari_id ? Number(form.cari_id) : null,
      });
      onKaydedildi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <tr>
      <td colSpan={7} style={{ padding: 0 }}>
        <div style={{ padding: 16, background: 'var(--zemin)' }}>
          <form onSubmit={kaydet}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Hareketi düzenle</div>
            <HataMesaji>{hata}</HataMesaji>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Alan etiket="Hesap">
                <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                  {hesaplar.map((h) => (
                    <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                  ))}
                </select>
              </Alan>
              <Alan etiket="İşlem türü">
                <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                  <option value="GIRIS">Giriş</option>
                  <option value="CIKIS">Çıkış</option>
                  <option value="HESAPLAR_ARASI_TRANSFER">Hesaplar Arası Transfer</option>
                  <option value="DOVIZ_ALIM">Döviz Alım</option>
                  <option value="DOVIZ_SATIM">Döviz Satım</option>
                </select>
              </Alan>
              <Alan etiket="Tarih">
                <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Tutar">
                <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
              </Alan>
              {ciftTarafli && (
                <>
                  <Alan etiket="Karşı hesap">
                    <select required value={form.karsi_hesap_id} onChange={(e) => setForm((f) => ({ ...f, karsi_hesap_id: e.target.value }))} style={girdiStili}>
                      <option value="">Seçin...</option>
                      {hesaplar.filter((h) => String(h.banka_hesap_id) !== form.banka_hesap_id).map((h) => (
                        <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                      ))}
                    </select>
                  </Alan>
                  <Alan etiket="Kullanılan kur">
                    <input required type="number" step="0.0001" value={form.kullanilan_kur} onChange={(e) => setForm((f) => ({ ...f, kullanilan_kur: e.target.value }))} style={girdiStili} />
                  </Alan>
                </>
              )}
              <Alan etiket="Cari (opsiyonel)">
                <select value={form.cari_id} onChange={(e) => setForm((f) => ({ ...f, cari_id: e.target.value }))} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {cariler.map((c) => <option key={c.id} value={c.id}>{c.unvan}</option>)}
                </select>
              </Alan>
              <Alan etiket="Açıklama">
                <OtomatikTamamlamaGirdisi
                  value={form.aciklama}
                  onChange={(v) => setForm((f) => ({ ...f, aciklama: v }))}
                  secenekler={harcamaTurleri}
                  listeId="harcama-turleri-duzenle-banka"
                  placeholder="Yazmaya başlayın veya listeden seçin"
                />
              </Alan>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Değişiklikleri kaydet'}</Buton>
              <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}

function HareketlerSekmesi() {
  const cariHaritasi = useCariHaritasi();
  const [hesaplar, setHesaplar] = useState([]);
  const [bankaHareketleri, setBankaHareketleri] = useState([]);
  const [hesapFiltre, setHesapFiltre] = useState('');
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [bankaFormuAcik, setBankaFormuAcik] = useState(false);
  const [acikDetayId, setAcikDetayId] = useState(null);
  const [duzenlenenId, setDuzenlenenId] = useState(null);

  function yukle() {
    setYukleniyor(true);
    Promise.all([
      api.get('/banka-bakiyeleri'),
      api.get('/banka-hareketleri'),
    ])
      .then(([hesapRes, bankaRes]) => {
        setHesaplar(hesapRes.data);
        setBankaHareketleri(bankaRes.data);
      })
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  useEffect(yukle, []);

  function hesapAdiGoster(hesapId) {
    const h = hesaplar.find((x) => x.banka_hesap_id === hesapId);
    return h ? `${h.banka_adi} — ${h.hesap_adi || h.para_birimi}` : `#${hesapId}`;
  }

  function hesapParaBirimi(hesapId) {
    const h = hesaplar.find((x) => x.banka_hesap_id === hesapId);
    return h ? h.para_birimi : 'TRY';
  }

  function satiraTikla(h) {
    if (!h.kaynak_tablo || !h.kaynak_id) return;
    setAcikDetayId((mevcut) => (mevcut === h.id ? null : h.id));
  }

  async function hareketiSil(hareketId, hareket) {
    const uyari = ['HESAPLAR_ARASI_TRANSFER', 'DOVIZ_ALIM', 'DOVIZ_SATIM'].includes(hareket.tip)
      ? '\n\nNOT: Bu bir transfer/döviz işlemi. Karşı hesaptaki eş kaydı bu işlemle silinmez, gerekirse onu da ayrıca silin.'
      : '';
    if (!window.confirm(`Bu banka hareketini silmek istediğinize emin misiniz?${uyari}`)) return;
    try {
      await api.delete(`/banka-hareketleri/${hareketId}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  const gosterilecekHareketler = hesapFiltre
    ? bankaHareketleri.filter((h) => String(h.banka_hesap_id) === hesapFiltre)
    : bankaHareketleri;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 12 }}>
        <Alan etiket="Hesaba göre filtrele">
          <select value={hesapFiltre} onChange={(e) => setHesapFiltre(e.target.value)} style={{ ...girdiStili, minWidth: 220 }}>
            <option value="">Tüm hesaplar</option>
            {hesaplar.map((h) => (
              <option key={h.banka_hesap_id} value={h.banka_hesap_id}>
                {h.banka_adi} — {h.hesap_adi || h.para_birimi}
              </option>
            ))}
          </select>
        </Alan>
        <Buton onClick={() => setBankaFormuAcik((a) => !a)}>{bankaFormuAcik ? 'Kapat' : '+ Yeni banka hareketi'}</Buton>
      </div>

      <HataMesaji>{hata}</HataMesaji>

      {bankaFormuAcik && (
        <YeniBankaHareketiFormu hesaplar={hesaplar} onKaydedildi={() => { setBankaFormuAcik(false); yukle(); }} onVazgec={() => setBankaFormuAcik(false)} />
      )}

      <Kart style={{ padding: 0 }}>
        {yukleniyor ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
        ) : gosterilecekHareketler.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Bu filtrede banka hareketi yok.</div>
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Tarih', 'Hesap', 'Tür', 'Tutar', 'Cari', 'Açıklama', 'İşlem'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gosterilecekHareketler.map((h) => {
                const tiklanabilir = !!(h.kaynak_tablo && h.kaynak_id);
                const otomatikGeldi = !!h.kaynak_tablo;
                if (duzenlenenId === h.id) {
                  return (
                    <BankaHareketiDuzenleFormu
                      key={h.id}
                      hareket={h}
                      hesaplar={hesaplar}
                      onKaydedildi={() => { setDuzenlenenId(null); yukle(); }}
                      onVazgec={() => setDuzenlenenId(null)}
                    />
                  );
                }
                return (
                  <Fragment key={h.id}>
                    <tr
                      style={{
                        borderTop: '1px solid var(--kenarlik)',
                        background: acikDetayId === h.id ? 'var(--zemin)' : 'transparent',
                      }}
                    >
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: tiklanabilir ? 'pointer' : 'default' }}>{h.tarih}</td>
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', cursor: tiklanabilir ? 'pointer' : 'default' }}>{hesapAdiGoster(h.banka_hesap_id)}</td>
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', cursor: tiklanabilir ? 'pointer' : 'default' }}>{BANKA_HAREKET_TIP_METIN[h.tip] || h.tip}</td>
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', fontWeight: 500, color: Number(h.tutar) >= 0 ? 'var(--yesil)' : 'var(--kirmizi)', cursor: tiklanabilir ? 'pointer' : 'default' }}>
                        {paraFormat(h.tutar, hesapParaBirimi(h.banka_hesap_id))}
                      </td>
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: tiklanabilir ? 'pointer' : 'default' }}>
                        {h.cari_id ? (cariHaritasi[h.cari_id] || `#${h.cari_id}`) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>
                        <span onClick={() => satiraTikla(h)} style={{ cursor: tiklanabilir ? 'pointer' : 'default' }}>
                          {h.aciklama || '—'}
                          {tiklanabilir && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--lacivert)' }}>
                              {acikDetayId === h.id ? '▲ detayı gizle' : '▼ detay göster'}
                            </span>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {otomatikGeldi ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 11.5, color: 'var(--metin-soluk)', fontStyle: 'italic' }}>
                              Otomatik ({h.kaynak_tablo}) — geri almak için kaynağa gidin
                            </span>
                            <button onClick={() => hareketiSil(h.id, h)} style={eylemChipStili('kirmizi')}>Sil (kaynak yoksa)</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setDuzenlenenId(h.id)} style={eylemChipStili('lacivert')}>Düzenle</button>
                            <button onClick={() => hareketiSil(h.id, h)} style={eylemChipStili('kirmizi')}>Sil</button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {acikDetayId === h.id && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <KaynakDetayi kaynakTablo={h.kaynak_tablo} kaynakId={h.kaynak_id} onIslemTamamlandi={() => { setAcikDetayId(null); yukle(); }} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}

export default function BankaSayfasi() {
  const [sekme, setSekme] = useState('hareketler');

  return (
    <div>
      <SayfaBasligi baslik="Banka" aciklama="Banka hesap yönetimi ve para hareketleri" />
      <Sekmeler sekmeler={SEKMELER} aktif={sekme} onDegistir={setSekme} />

      {sekme === 'hareketler' && <HareketlerSekmesi />}
      {sekme === 'hesaplar' && <HesaplarSekmesi />}
    </div>
  );
}
