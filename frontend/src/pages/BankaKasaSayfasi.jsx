import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, paraFormat, eylemChipStili, Sekmeler } from '../components/Ortak';

const SEKMELER = [
  { deger: 'hesaplar', etiket: 'Hesaplar' },
  { deger: 'hareketler', etiket: 'Hareketler' },
];

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

// ============================================================== HESAPLAR SEKMESİ
function HesaplarSekmesi() {
  const [bakiyeler, setBakiyeler] = useState([]);
  const [kasaBakiye, setKasaBakiye] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hesapFormuAcik, setHesapFormuAcik] = useState(false);
  const [duzenlenenHesap, setDuzenlenenHesap] = useState(null);

  function yukle() {
    setYukleniyor(true);
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
        </>
      )}
    </div>
  );
}

// ============================================================== HAREKETLER SEKMESİ
const BANKA_HAREKET_TIP_METIN = {
  GIRIS: 'Giriş', CIKIS: 'Çıkış', HESAPLAR_ARASI_TRANSFER: 'Transfer',
  DOVIZ_ALIM: 'Döviz Alım', DOVIZ_SATIM: 'Döviz Satım',
};

function YeniBankaHareketiFormu({ hesaplar, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    banka_hesap_id: '', tarih: new Date().toISOString().slice(0, 10), tip: 'GIRIS',
    tutar: '', aciklama: '', karsi_hesap_id: '', kullanilan_kur: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const ciftTarafli = ['HESAPLAR_ARASI_TRANSFER', 'DOVIZ_ALIM', 'DOVIZ_SATIM'].includes(form.tip);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.post('/banka-hareketleri', {
        banka_hesap_id: Number(form.banka_hesap_id),
        tarih: form.tarih,
        tip: form.tip,
        tutar: Number(form.tutar),
        aciklama: form.aciklama || null,
        karsi_hesap_id: form.karsi_hesap_id ? Number(form.karsi_hesap_id) : null,
        kullanilan_kur: form.kullanilan_kur ? Number(form.kullanilan_kur) : null,
      });
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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

function HareketlerSekmesi() {
  const [hesaplar, setHesaplar] = useState([]);
  const [bankaHareketleri, setBankaHareketleri] = useState([]);
  const [kasaHareketleri, setKasaHareketleri] = useState([]);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [bankaFormuAcik, setBankaFormuAcik] = useState(false);
  const [kasaFormuAcik, setKasaFormuAcik] = useState(false);
  const [altSekme, setAltSekme] = useState('banka');

  function yukle() {
    setYukleniyor(true);
    Promise.all([
      api.get('/banka-bakiyeleri'),
      api.get('/banka-hareketleri'),
      api.get('/kasa-hareketleri'),
    ])
      .then(([hesapRes, bankaRes, kasaRes]) => {
        setHesaplar(hesapRes.data);
        setBankaHareketleri(bankaRes.data);
        setKasaHareketleri(kasaRes.data);
      })
      .catch((err) => setHata(hataMesajiCikar(err)))
      .finally(() => setYukleniyor(false));
  }

  useEffect(yukle, []);

  function hesapAdiGoster(hesapId) {
    const h = hesaplar.find((x) => x.banka_hesap_id === hesapId);
    return h ? `${h.banka_adi} — ${h.hesap_adi || h.para_birimi}` : `#${hesapId}`;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setAltSekme('banka')}
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid var(--kenarlik)', cursor: 'pointer',
            background: altSekme === 'banka' ? 'var(--lacivert)' : 'white',
            color: altSekme === 'banka' ? 'white' : 'var(--metin-birincil)', fontSize: 13, fontWeight: 500,
          }}
        >
          Banka Hareketleri
        </button>
        <button
          onClick={() => setAltSekme('kasa')}
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid var(--kenarlik)', cursor: 'pointer',
            background: altSekme === 'kasa' ? 'var(--lacivert)' : 'white',
            color: altSekme === 'kasa' ? 'white' : 'var(--metin-birincil)', fontSize: 13, fontWeight: 500,
          }}
        >
          Kasa Hareketleri
        </button>
      </div>

      <HataMesaji>{hata}</HataMesaji>

      {altSekme === 'banka' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Buton onClick={() => setBankaFormuAcik((a) => !a)}>{bankaFormuAcik ? 'Kapat' : '+ Yeni banka hareketi'}</Buton>
          </div>
          {bankaFormuAcik && (
            <YeniBankaHareketiFormu hesaplar={hesaplar} onKaydedildi={() => { setBankaFormuAcik(false); yukle(); }} onVazgec={() => setBankaFormuAcik(false)} />
          )}
          <Kart style={{ padding: 0 }}>
            {yukleniyor ? (
              <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
            ) : bankaHareketleri.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Henüz banka hareketi yok.</div>
            ) : (
              <table>
                <thead>
                  <tr style={{ background: 'var(--zemin)' }}>
                    {['Tarih', 'Hesap', 'Tür', 'Tutar', 'Açıklama'].map((b) => (
                      <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bankaHareketleri.map((h) => (
                    <tr key={h.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                      <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{h.tarih}</td>
                      <td style={{ padding: '10px 16px' }}>{hesapAdiGoster(h.banka_hesap_id)}</td>
                      <td style={{ padding: '10px 16px' }}>{BANKA_HAREKET_TIP_METIN[h.tip] || h.tip}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 500, color: Number(h.tutar) >= 0 ? 'var(--yesil)' : 'var(--kirmizi)' }}>
                        {paraFormat(h.tutar)}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{h.aciklama || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Kart>
        </div>
      )}

      {altSekme === 'kasa' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Buton onClick={() => setKasaFormuAcik((a) => !a)}>{kasaFormuAcik ? 'Kapat' : '+ Yeni kasa hareketi'}</Buton>
          </div>
          {kasaFormuAcik && (
            <YeniKasaHareketiFormu onKaydedildi={() => { setKasaFormuAcik(false); yukle(); }} onVazgec={() => setKasaFormuAcik(false)} />
          )}
          <Kart style={{ padding: 0 }}>
            {yukleniyor ? (
              <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
            ) : kasaHareketleri.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Henüz kasa hareketi yok.</div>
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
                  {kasaHareketleri.map((h) => (
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
      )}
    </div>
  );
}

export default function BankaKasaSayfasi() {
  const [sekme, setSekme] = useState('hesaplar');

  return (
    <div>
      <SayfaBasligi baslik="Banka / Ana Kasa" aciklama="Hesap yönetimi ve para hareketleri" />
      <Sekmeler sekmeler={SEKMELER} aktif={sekme} onDegistir={setSekme} />

      {sekme === 'hesaplar' && <HesaplarSekmesi />}
      {sekme === 'hareketler' && <HareketlerSekmesi />}
    </div>
  );
}
