import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, paraFormat, eylemChipStili } from '../components/Ortak';

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

function YeniHareketFormu({ hesaplar, onKaydedildi, onVazgec }) {
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

export default function BankaKasaSayfasi() {
  const [bakiyeler, setBakiyeler] = useState([]);
  const [kasaBakiye, setKasaBakiye] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hesapFormuAcik, setHesapFormuAcik] = useState(false);
  const [duzenlenenHesap, setDuzenlenenHesap] = useState(null);
  const [hareketFormuAcik, setHareketFormuAcik] = useState(false);

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
    // banka-bakiyeleri satirlari 'banka_hesap_id' kullanir, formumuz 'id' bekliyor.
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
      <SayfaBasligi
        baslik="Banka / Ana Kasa"
        aciklama="Banka hesap bakiyeleri ve ana kasa net durumu"
        eylem={
          <div style={{ display: 'flex', gap: 8 }}>
            <Buton variant="ikincil" onClick={yeniHesapAc}>+ Yeni hesap</Buton>
            <Buton onClick={() => setHareketFormuAcik((a) => !a)}>+ Yeni hareket</Buton>
          </div>
        }
      />
      <HataMesaji>{hata}</HataMesaji>

      {hesapFormuAcik && (
        <HesapFormu
          duzenlenenHesap={duzenlenenHesap}
          onKaydedildi={() => { hesapFormunuKapat(); yukle(); }}
          onVazgec={hesapFormunuKapat}
        />
      )}
      {hareketFormuAcik && (
        <YeniHareketFormu hesaplar={bakiyeler} onKaydedildi={() => { setHareketFormuAcik(false); yukle(); }} onVazgec={() => setHareketFormuAcik(false)} />
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
