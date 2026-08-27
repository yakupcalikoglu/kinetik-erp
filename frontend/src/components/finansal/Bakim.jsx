import { useEffect, useState } from 'react';
import { api, hataMesajiCikar, ozelOnayIste, geriAlBildirimGoster } from '../../api/client';
import {
  Kart, Buton, Etiket, Alan, girdiStili, HataMesaji, paraFormat, eylemChipStili,
  ParaGirdisi, OtomatikTamamlamaGirdisi,
} from '../Ortak';
import AramaliSecici from '../AramaliSecici';
import {
  tarihFormat, useSiralama, useCariler, useUrunSecenekleri, useHarcamaTurleri, BasitTablo,
} from './Ortak';

export default function BakimSekmesi() {
  const [liste, setListe] = useState([]);
  const siralama = useSiralama();
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const harcamaTurleri = useHarcamaTurleri();
  const urunSecenekleri = useUrunSecenekleri();
  const cariler = useCariler();
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({
    stok_seri_no_id: '', tarih: new Date().toISOString().slice(0, 10), tip: 'GIDER', aciklama: '', ilgili_cari_id: '', tutar: '',
    para_birimi: 'TRY', kur: '1', odeme_yontemi: 'NAKIT', banka_hesap_id: '',
  });
  const [hata, setHata] = useState(null);

  function yukle() {
    api.get('/bakim-kayitlari').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(() => {
    yukle();
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/bakim-kayitlari', {
        ...form,
        stok_seri_no_id: Number(form.stok_seri_no_id),
        ilgili_cari_id: form.ilgili_cari_id ? Number(form.ilgili_cari_id) : null,
        tutar: Number(form.tutar),
        banka_hesap_id: form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        kur: form.odeme_yontemi === 'NAKIT' && form.para_birimi !== 'TRY' ? Number(form.kur) : null,
      });
      setFormAcik(false);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function sil(bakimId) {
    if (!(await ozelOnayIste('Bu bakım kaydını silmek istediğinize emin misiniz? Oluşan Kasa/Banka hareketi bu işlemle silinmez.'))) return;
    try {
      await api.delete(`/bakim-kayitlari/${bakimId}`);
      yukle();
      geriAlBildirimGoster('Bakım kaydı silindi.', async () => {
        await api.put(`/bakim-kayitlari/${bakimId}/geri-getir`);
        yukle();
      });
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni bakım kaydı'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Ürün">
              <select required value={form.stok_seri_no_id} onChange={(e) => setForm((f) => ({ ...f, stok_seri_no_id: e.target.value }))} style={girdiStili}>
                <option value="">Seçin...</option>
                {urunSecenekleri.map((u) => <option key={u.id} value={u.id}>{u.etiket}</option>)}
              </select>
            </Alan>
            <Alan etiket="İlgili cari (opsiyonel)">
              <AramaliSecici secenekler={cariler} deger={form.ilgili_cari_id} onDegistir={(v) => setForm((f) => ({ ...f, ilgili_cari_id: v }))} etiketFn={(c) => c.unvan} />
            </Alan>
            <Alan etiket="Tarih">
              <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tip">
              <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="GIDER">Gider</option>
                <option value="GELIR">Gelir</option>
              </select>
            </Alan>
            <Alan etiket="Açıklama">
              <OtomatikTamamlamaGirdisi
                value={form.aciklama}
                onChange={(v) => setForm((f) => ({ ...f, aciklama: v }))}
                secenekler={harcamaTurleri}
                listeId="harcama-turleri-bakim"
                placeholder="Yazmaya başlayın veya listeden seçin"
              />
            </Alan>
            <Alan etiket="Tutar">
              <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
            </Alan>
            <Alan etiket="Para birimi">
              <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Alan>
            <Alan etiket="Ödeme yöntemi">
              <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                <option value="NAKIT">Nakit</option>
                <option value="BANKA">Banka</option>
              </select>
            </Alan>
            {form.odeme_yontemi === 'BANKA' ? (
              <Alan etiket="Banka hesabı">
                <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                  <option value="">Seçin...</option>
                  {bankaHesaplari.map((h) => (
                    <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                  ))}
                </select>
              </Alan>
            ) : form.para_birimi !== 'TRY' && (
              <Alan etiket={`${form.para_birimi} için TL kuru (otomatik, elle değiştirilebilir)`}>
                <input required type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
              </Alan>
            )}
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Kaydet</Buton></div>
          </form>
        </Kart>
      )}
      <Kart style={{ padding: 0 }}>
        <BasitTablo
          tarihAlani="tarih"
          basliklar={[
            { etiket: 'Ürün', alan: '_urun' },
            { etiket: 'İlgili Cari', alan: 'ilgili_cari_unvan' },
            { etiket: 'Tarih', alan: 'tarih' },
            { etiket: 'Tip', alan: 'tip' },
            { etiket: 'Açıklama', alan: 'aciklama' },
            { etiket: 'Tutar', alan: 'tutar' },
            '',
          ]}
          siralama={siralama}
          satirlar={siralama.sirala(liste, (item, alan) => {
            if (alan === '_urun') return item.urun_adi || item.urun_seri_no || '';
            return item[alan];
          })}
          render={(b) => (
            <tr key={b.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{b.urun_adi ? `${b.urun_adi} (${b.urun_seri_no})` : (b.urun_seri_no || `#${b.stok_seri_no_id}`)}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{b.ilgili_cari_unvan || '—'}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{tarihFormat(b.tarih)}</td>
              <td style={{ padding: '10px 16px' }}><Etiket ton={b.tip === 'GELIR' ? 'yesil' : 'kirmizi'}>{b.tip === 'GELIR' ? 'Gelir' : 'Gider'}</Etiket></td>
              <td style={{ padding: '10px 16px' }}>{b.aciklama || '—'}</td>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{paraFormat(b.tutar)}</td>
              <td style={{ padding: '10px 16px' }}>
                <button onClick={() => sil(b.id)} style={eylemChipStili('kirmizi')}>Sil</button>
              </td>
            </tr>
          )}
        />
      </Kart>
    </div>
  );
}
