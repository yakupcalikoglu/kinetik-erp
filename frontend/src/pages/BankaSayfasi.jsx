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

function HareketlerSekmesi() {
  const [hesaplar, setHesaplar] = useState([]);
  const [bankaHareketleri, setBankaHareketleri] = useState([]);
  const [hesapFiltre, setHesapFiltre] = useState('');
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [bankaFormuAcik, setBankaFormuAcik] = useState(false);

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
                {['Tarih', 'Hesap', 'Tür', 'Tutar', 'Açıklama'].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gosterilecekHareketler.map((h) => (
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
  );
}

export default function BankaSayfasi() {
  const [sekme, setSekme] = useState('hesaplar');

  return (
    <div>
      <SayfaBasligi baslik="Banka" aciklama="Banka hesap yönetimi ve para hareketleri" />
      <Sekmeler sekmeler={SEKMELER} aktif={sekme} onDegistir={setSekme} />

      {sekme === 'hesaplar' && <HesaplarSekmesi />}
      {sekme === 'hareketler' && <HareketlerSekmesi />}
    </div>
  );
}
