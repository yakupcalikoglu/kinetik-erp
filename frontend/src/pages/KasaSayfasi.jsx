import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, paraFormat, eylemChipStili, OtomatikTamamlamaGirdisi } from '../components/Ortak';

function tarihFormat(iso) {
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return iso || '—';
  const [yil, ay, gun] = iso.slice(0, 10).split('-');
  if (!yil || !ay || !gun) return iso;
  return `${gun}/${ay}/${yil}`;
}

function useSiralama() {
  const [alan, setAlan] = useState(null);
  const [yon, setYon] = useState('asc');
  function tikla(yeniAlan) {
    if (alan === yeniAlan) setYon((y) => (y === 'asc' ? 'desc' : 'asc'));
    else { setAlan(yeniAlan); setYon('asc'); }
  }
  function sirala(liste, degerFn) {
    if (!alan) return liste;
    return [...liste].sort((a, b) => {
      const av = degerFn(a, alan);
      const bv = degerFn(b, alan);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') {
        return yon === 'asc' ? av.localeCompare(bv, 'tr') : bv.localeCompare(av, 'tr');
      }
      return yon === 'asc' ? av - bv : bv - av;
    });
  }
  return { alan, yon, tikla, sirala };
}

function SiraliBaslik({ children, alanAdi, siralama, style }) {
  const aktif = siralama.alan === alanAdi;
  return (
    <th
      onClick={() => siralama.tikla(alanAdi)}
      style={{
        textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)',
        fontWeight: 500, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style,
      }}
    >
      {children} {aktif ? (siralama.yon === 'asc' ? '▲' : '▼') : ''}
    </th>
  );
}

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
    tutar_try_karsiligi: '', aciklama: '', cari_id: '',
  });
  const harcamaTurleri = useHarcamaTurleri();
  const cariler = useCariler();
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
    cari_id: hareket.cari_id ? String(hareket.cari_id) : '', sifre: '',
  });
  const [kur, setKur] = useState(() => (
    hareket.para_birimi !== 'TRY' && hareket.tutar_try_karsiligi
      ? (Number(hareket.tutar_try_karsiligi) / Number(hareket.tutar)).toFixed(4)
      : '1'
  ));
  const harcamaTurleri = useHarcamaTurleri();
  const cariler = useCariler();
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  function kuruUygula(yeniKur) {
    setKur(yeniKur);
    if (form.tutar && yeniKur) {
      setForm((f) => ({ ...f, tutar_try_karsiligi: (Number(f.tutar) * Number(yeniKur)).toFixed(2) }));
    }
  }

  function guncelKuruGetir() {
    if (form.para_birimi === 'TRY') return;
    api.get(`/kur/${form.para_birimi}`).then((r) => kuruUygula(r.data.kur)).catch(() => {});
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/kasa-hareketleri/${hareket.id}`, {
        ...form,
        tutar: Number(form.tutar),
        tutar_try_karsiligi: form.para_birimi === 'TRY' ? null : Number(form.tutar_try_karsiligi),
        cari_id: form.cari_id ? Number(form.cari_id) : null,
      });
      // NOT: 'sifre' alani ...form icinde zaten govdeye dahil ediliyor.
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
                <>
                  <Alan etiket="Kur">
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="number" step="0.0001" value={kur} onChange={(e) => kuruUygula(e.target.value)} style={girdiStili} />
                      <button type="button" onClick={guncelKuruGetir} style={{ ...eylemChipStili('lacivert'), whiteSpace: 'nowrap' }}>Güncel kur</button>
                    </div>
                  </Alan>
                  <Alan etiket="TL karşılığı (kur ile otomatik hesaplanır, elle de değiştirilebilir)">
                    <input required type="number" step="0.01" value={form.tutar_try_karsiligi} onChange={(e) => setForm((f) => ({ ...f, tutar_try_karsiligi: e.target.value }))} style={girdiStili} />
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
                  listeId="harcama-turleri-duzenle-kasa"
                  placeholder="Yazmaya başlayın veya listeden seçin"
                />
              </Alan>
              <Alan etiket="Şifreniz (onay için zorunlu)">
                <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} placeholder="Giriş şifreniz" />
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

function VadesiGelenlerPaneli() {
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    api.get('/raporlar/yaklasan-vadeler', { params: { gun: 7 } })
      .then((r) => setVeri(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)));
  }, []);

  if (hata || !veri) return null;

  const bugun = new Date().toISOString().slice(0, 10);
  const tumSatirlar = [
    ...veri.odemeler.map((s) => ({ ...s, yon: 'ODEME' })),
    ...veri.tahsilatlar.map((s) => ({ ...s, yon: 'TAHSILAT' })),
  ].sort((a, b) => a.tarih.localeCompare(b.tarih));

  const TUR_METIN = { CEK: 'Çek', LEASING: 'Leasing', AKREDITIF: 'Akreditif', TAKSIT: 'Taksit', KIRA: 'Kira' };

  return (
    <Kart style={{ marginBottom: 16, border: tumSatirlar.length > 0 ? '1px solid var(--amber, #f0b429)' : '1px solid var(--kenarlik)' }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: tumSatirlar.length > 0 ? 10 : 0 }}>
        ⏰ Önümüzdeki 7 gün içinde vadesi gelen ödeme/tahsilatlar
      </div>
      {tumSatirlar.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--metin-soluk)' }}>Önümüzdeki 7 gün içinde vadesi gelen bir ödeme/tahsilat bulunmuyor.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tumSatirlar.map((s, i) => {
          const bugunMu = s.tarih === bugun;
          return (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 7,
                background: bugunMu ? 'var(--kirmizi-acik, #fde2e2)' : 'var(--zemin)',
                fontSize: 13,
              }}
            >
              <div>
                {bugunMu && <strong style={{ color: 'var(--kirmizi)', marginRight: 6 }}>BUGÜN</strong>}
                <Etiket ton={s.yon === 'ODEME' ? 'kirmizi' : 'yesil'}>{s.yon === 'ODEME' ? 'Ödeme' : 'Tahsilat'}</Etiket>
                {' '}{TUR_METIN[s.tur] || s.tur} — {s.aciklama}
              </div>
              <div style={{ display: 'flex', gap: 12, color: 'var(--metin-ikincil)' }}>
                <span>{tarihFormat(s.tarih)}</span>
                <span style={{ fontWeight: 600, color: 'var(--metin-birincil)' }}>{paraFormat(s.tutar, s.para_birimi)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Kart>
  );
}

export default function KasaSayfasi() {
  const cariHaritasi = useCariHaritasi();
  const siralama = useSiralama();
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

      <VadesiGelenlerPaneli />

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
                <SiraliBaslik alanAdi="tarih" siralama={siralama}>Tarih</SiraliBaslik>
                <SiraliBaslik alanAdi="yon" siralama={siralama}>Yön</SiraliBaslik>
                <SiraliBaslik alanAdi="tutar" siralama={siralama}>Tutar</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>TL Karşılığı</th>
                <SiraliBaslik alanAdi="_cari" siralama={siralama}>Cari</SiraliBaslik>
                <SiraliBaslik alanAdi="aciklama" siralama={siralama}>Açıklama</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {siralama.sirala(gosterilecekHareketler, (item, alan) => {
                if (alan === '_cari') return item.cari_id ? (cariHaritasi[item.cari_id] || '') : '';
                return item[alan];
              }).map((h) => {
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
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: tiklanabilir ? 'pointer' : 'default' }}>{tarihFormat(h.tarih)}</td>
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', cursor: tiklanabilir ? 'pointer' : 'default' }}>{h.yon === 'GIRIS' ? 'Giriş' : 'Çıkış'}</td>
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', fontWeight: 500, color: h.yon === 'GIRIS' ? 'var(--yesil)' : 'var(--kirmizi)', cursor: tiklanabilir ? 'pointer' : 'default' }}>
                        {paraFormat(h.tutar, h.para_birimi)}
                      </td>
                      <td onClick={() => satiraTikla(h)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: tiklanabilir ? 'pointer' : 'default' }}>
                        {h.tutar_try_karsiligi != null ? paraFormat(h.tutar_try_karsiligi) : '—'}
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
