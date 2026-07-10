import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, paraFormat, eylemChipStili, OtomatikTamamlamaGirdisi } from '../components/Ortak';

function useHarcamaTurleri() {
  const [turler, setTurler] = useState([]);
  useEffect(() => {
    api.get('/harcama-turleri').then((r) => setTurler(r.data.map((t) => t.ad))).catch(() => {});
  }, []);
  return turler;
}

const BEKLEYEN_ENDPOINT_MAP = {
  LEASING_ODEME: (id) => `/leasing-odemeleri/${id}/ode`,
  KIRALAMA_ODEME: (id) => `/kiralama-odemeleri/${id}/tahsil-et`,
  TAKSIT_DETAY: (id) => `/taksit-detay/${id}/tahsil-et`,
  PERSONEL_ODEME: (id) => `/personel-odemeleri/${id}/ode`,
  SABIT_GIDER: (id) => `/sabit-giderler/${id}/ode`,
  AKREDITIF_KALEMI: (id) => `/akreditif-kalemleri/${id}/ode`,
  AKREDITIF_KALEM_TAKSIT: (id) => `/akreditif-kalem-taksitleri/${id}/ode`,
};

const BEKLEYEN_TUR_METIN = {
  LEASING_ODEME: 'Leasing Ödemesi',
  AKREDITIF_KALEMI: 'Akreditif Kalemi',
  AKREDITIF_KALEM_TAKSIT: 'Akreditif Taksiti',
  KIRALAMA_ODEME: 'Kiralama Ödemesi (Tahsilat)',
  TAKSIT_DETAY: 'Taksitli Satış Tahsilatı',
  PERSONEL_ODEME: 'Personel Ödemesi',
  SABIT_GIDER: 'Sabit Gider',
};

function useBekleyenOdemeler() {
  const [liste, setListe] = useState([]);
  useEffect(() => {
    api.get('/kaynak-detay/bekleyen-odemeler').then((r) => setListe(r.data)).catch(() => {});
  }, []);
  return liste;
}

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

function YeniKasaHareketiFormu({ onKaydedildi, onVazgec }) {
  const [baglantiliModu, setBaglantiliModu] = useState(false);
  const bekleyenler = useBekleyenOdemeler();
  const [bekleyenTur, setBekleyenTur] = useState('');
  const [seciliBekleyenAnahtar, setSeciliBekleyenAnahtar] = useState('');
  const [bekleyenKur, setBekleyenKur] = useState('1');

  const mevcutTurler = [...new Set(bekleyenler.map((b) => b.kaynak_tablo))];
  const turaGoreFiltrelenmis = bekleyenTur ? bekleyenler.filter((b) => b.kaynak_tablo === bekleyenTur) : [];

  const [form, setForm] = useState({
    tarih: new Date().toISOString().slice(0, 10), yon: 'GIRIS', tutar: '', para_birimi: 'TRY',
    tutar_try_karsiligi: '', aciklama: '',
  });
  const harcamaTurleri = useHarcamaTurleri();
  const [kurYukleniyor, setKurYukleniyor] = useState(false);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    if (form.para_birimi === 'TRY') {
      setForm((f) => ({ ...f, tutar_try_karsiligi: '' }));
      return;
    }
    if (form.para_birimi === 'ALTIN') return;
    setKurYukleniyor(true);
    api.get(`/kur/${form.para_birimi}`)
      .then((r) => {
        const kur = Number(r.data.kur);
        const tutarSayi = Number(form.tutar) || 0;
        setForm((f) => ({ ...f, tutar_try_karsiligi: (tutarSayi * kur).toFixed(2) }));
      })
      .catch(() => {})
      .finally(() => setKurYukleniyor(false));
  }, [form.para_birimi]); // eslint-disable-line

  const seciliBekleyen = bekleyenler.find((b) => `${b.kaynak_tablo}:${b.kaynak_id}` === seciliBekleyenAnahtar);
  const bekleyenKurGerekli = baglantiliModu && seciliBekleyen && seciliBekleyen.para_birimi !== 'TRY';

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      if (baglantiliModu) {
        if (!seciliBekleyen) {
          setHata('Lütfen hangi ödemeye/tahsilata karşılık geldiğini seçin.');
          setKaydediliyor(false);
          return;
        }
        const endpointFn = BEKLEYEN_ENDPOINT_MAP[seciliBekleyen.kaynak_tablo];
        await api.put(endpointFn(seciliBekleyen.kaynak_id), {
          odeme_tarihi: form.tarih,
          odeme_yontemi: 'NAKIT',
          banka_hesap_id: null,
          kur: bekleyenKurGerekli ? Number(bekleyenKur) : null,
        });
      } else {
        await api.post('/kasa-hareketleri', {
          ...form,
          tutar: Number(form.tutar),
          tutar_try_karsiligi: form.para_birimi === 'TRY' ? null : Number(form.tutar_try_karsiligi),
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
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10 }}>Yeni kasa hareketi</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={baglantiliModu} onChange={(e) => setBaglantiliModu(e.target.checked)} />
          Bu hareket bekleyen bir ödeme/tahsilata karşılık geliyor (Leasing, Akreditif, Kiralama, Taksitli Satış, Personel, Sabit Gider)
        </label>

        <HataMesaji>{hata}</HataMesaji>

        {baglantiliModu ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Alan etiket="1) Ödeme Türü">
                <select
                  required
                  value={bekleyenTur}
                  onChange={(e) => { setBekleyenTur(e.target.value); setSeciliBekleyenAnahtar(''); }}
                  style={girdiStili}
                >
                  <option value="">Seçin...</option>
                  {mevcutTurler.map((t) => (
                    <option key={t} value={t}>{BEKLEYEN_TUR_METIN[t] || t}</option>
                  ))}
                </select>
              </Alan>
              <Alan etiket="2) Hangi kayıt?">
                <select
                  required
                  disabled={!bekleyenTur}
                  value={seciliBekleyenAnahtar}
                  onChange={(e) => setSeciliBekleyenAnahtar(e.target.value)}
                  style={girdiStili}
                >
                  <option value="">{bekleyenTur ? 'Seçin...' : 'Önce tür seçin'}</option>
                  {turaGoreFiltrelenmis.map((b) => (
                    <option key={`${b.kaynak_tablo}:${b.kaynak_id}`} value={`${b.kaynak_tablo}:${b.kaynak_id}`}>
                      {b.etiket} — {paraFormat(b.tutar, b.para_birimi)} {b.vade_tarihi ? `(${b.vade_tarihi})` : ''}
                    </option>
                  ))}
                </select>
                {bekleyenTur && turaGoreFiltrelenmis.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--metin-soluk)', marginTop: 4 }}>Bu türde ödenmemiş kayıt yok.</div>
                )}
              </Alan>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: bekleyenKurGerekli ? '1fr 1fr' : '1fr', gap: 12 }}>
              <Alan etiket="Tarih">
                <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
              </Alan>
              {bekleyenKurGerekli && (
                <Alan etiket={`${seciliBekleyen.para_birimi} için TL kuru`}>
                  <input required type="number" step="0.0001" value={bekleyenKur} onChange={(e) => setBekleyenKur(e.target.value)} style={girdiStili} />
                </Alan>
              )}
            </div>
          </div>
        ) : (
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
            <Alan etiket="Para birimi">
              <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="ALTIN">ALTIN</option>
              </select>
            </Alan>
            <Alan etiket="Tutar">
              <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
            </Alan>
            {form.para_birimi !== 'TRY' && (
              <Alan etiket={kurYukleniyor ? 'TL karşılığı (kur yükleniyor...)' : 'TL karşılığı (otomatik, elle değiştirilebilir)'}>
                <input required type="number" step="0.01" value={form.tutar_try_karsiligi} onChange={(e) => setForm((f) => ({ ...f, tutar_try_karsiligi: e.target.value }))} style={girdiStili} />
              </Alan>
            )}
            <Alan etiket="Açıklama">
              <OtomatikTamamlamaGirdisi
                value={form.aciklama}
                onChange={(v) => setForm((f) => ({ ...f, aciklama: v }))}
                secenekler={harcamaTurleri}
                listeId="harcama-turleri-yeni-kasa"
                placeholder="Yazmaya başlayın veya listeden seçin"
              />
            </Alan>
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

function KasaHareketiDuzenleFormu({ hareket, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    tarih: hareket.tarih, yon: hareket.yon, tutar: hareket.tutar, para_birimi: hareket.para_birimi,
    tutar_try_karsiligi: hareket.tutar_try_karsiligi ?? '', aciklama: hareket.aciklama || '',
  });
  const harcamaTurleri = useHarcamaTurleri();
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/kasa-hareketleri/${hareket.id}`, {
        ...form,
        tutar: Number(form.tutar),
        tutar_try_karsiligi: form.para_birimi === 'TRY' ? null : Number(form.tutar_try_karsiligi),
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
      <td colSpan={6} style={{ padding: 0 }}>
        <div style={{ padding: 16, background: 'var(--zemin)' }}>
          <form onSubmit={kaydet}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Hareketi düzenle</div>
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
              <Alan etiket="Para birimi">
                <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="ALTIN">ALTIN</option>
                </select>
              </Alan>
              <Alan etiket="Tutar">
                <input required type="number" step="0.01" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} style={girdiStili} />
              </Alan>
              {form.para_birimi !== 'TRY' && (
                <Alan etiket="TL karşılığı">
                  <input required type="number" step="0.01" value={form.tutar_try_karsiligi} onChange={(e) => setForm((f) => ({ ...f, tutar_try_karsiligi: e.target.value }))} style={girdiStili} />
                </Alan>
              )}
              <Alan etiket="Açıklama">
                <OtomatikTamamlamaGirdisi
                  value={form.aciklama}
                  onChange={(v) => setForm((f) => ({ ...f, aciklama: v }))}
                  secenekler={harcamaTurleri}
                  listeId="harcama-turleri-duzenle-kasa"
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

export default function KasaSayfasi() {
  const [kasaBakiye, setKasaBakiye] = useState(null);
  const [kasaHareketleri, setKasaHareketleri] = useState([]);
  const [yonFiltre, setYonFiltre] = useState('');
  const [paraBirimiFiltre, setParaBirimiFiltre] = useState('');
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [acikDetayId, setAcikDetayId] = useState(null);
  const [duzenlenenId, setDuzenlenenId] = useState(null);

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

  function satiraTikla(h) {
    if (!h.kaynak_tablo || !h.kaynak_id) return;
    setAcikDetayId((mevcut) => (mevcut === h.id ? null : h.id));
  }

  async function hareketiSil(hareketId) {
    if (!window.confirm('Bu kasa hareketini silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/kasa-hareketleri/${hareketId}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  let gosterilecekHareketler = kasaHareketleri;
  if (yonFiltre) gosterilecekHareketler = gosterilecekHareketler.filter((h) => h.yon === yonFiltre);
  if (paraBirimiFiltre) gosterilecekHareketler = gosterilecekHareketler.filter((h) => h.para_birimi === paraBirimiFiltre);

  return (
    <div>
      <SayfaBasligi baslik="Ana Kasa" aciklama="Nakit giriş/çıkış hareketleri (çoklu para birimi)" />
      <HataMesaji>{hata}</HataMesaji>

      {kasaBakiye && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {kasaBakiye.bakiyeler.map((b) => (
            <Kart key={b.para_birimi} style={{ flex: '1 1 160px', background: 'var(--lacivert)', color: 'white' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{b.para_birimi} bakiyesi</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{paraFormat(b.net_bakiye, b.para_birimi)}</div>
            </Kart>
          ))}
          <Kart style={{ flex: '1 1 200px', background: 'var(--lacivert-koyu, #0f2340)', color: 'white' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Toplam (TL karşılığı)</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{paraFormat(kasaBakiye.net_bakiye_try_toplam)}</div>
          </Kart>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Alan etiket="Yöne göre filtrele">
            <select value={yonFiltre} onChange={(e) => setYonFiltre(e.target.value)} style={{ ...girdiStili, minWidth: 150 }}>
              <option value="">Tümü</option>
              <option value="GIRIS">Giriş</option>
              <option value="CIKIS">Çıkış</option>
            </select>
          </Alan>
          <Alan etiket="Para birimine göre filtrele">
            <select value={paraBirimiFiltre} onChange={(e) => setParaBirimiFiltre(e.target.value)} style={{ ...girdiStili, minWidth: 150 }}>
              <option value="">Tümü</option>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ALTIN">ALTIN</option>
            </select>
          </Alan>
        </div>
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
                {['Tarih', 'Yön', 'Tutar', 'TL Karşılığı', 'Açıklama', 'İşlem'].map((b) => (
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
                    <KasaHareketiDuzenleFormu
                      key={h.id}
                      hareket={h}
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
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', cursor: tiklanabilir ? 'pointer' : 'default' }}>{h.yon === 'GIRIS' ? 'Giriş' : 'Çıkış'}</td>
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', fontWeight: 500, color: h.yon === 'GIRIS' ? 'var(--yesil)' : 'var(--kirmizi)', cursor: tiklanabilir ? 'pointer' : 'default' }}>
                        {paraFormat(h.tutar, h.para_birimi)}
                      </td>
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: tiklanabilir ? 'pointer' : 'default' }}>
                        {h.tutar_try_karsiligi != null ? paraFormat(h.tutar_try_karsiligi) : '—'}
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
                            <button onClick={() => hareketiSil(h.id)} style={eylemChipStili('kirmizi')}>Sil (kaynak yoksa)</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setDuzenlenenId(h.id)} style={eylemChipStili('lacivert')}>Düzenle</button>
                            <button onClick={() => hareketiSil(h.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {acikDetayId === h.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
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
