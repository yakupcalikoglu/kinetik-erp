import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar, ozelOnayIste } from '../../api/client';
import { Kart, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, eylemChipStili, ParaGirdisi } from '../Ortak';
import { useSiralama, SiraliBaslik, OdemeFormu } from './Ortak';

function bosPersonelFormu() {
  return { ad_soyad: '', pozisyon: '', aylik_maas: '', ise_baslama_tarihi: '', sifre: '' };
}

export default function PersonelSekmesi() {
  const [liste, setListe] = useState([]);
  const siralama = useSiralama();
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenPersonel, setDuzenlenenPersonel] = useState(null);
  const [form, setForm] = useState(bosPersonelFormu());
  const [hata, setHata] = useState(null);
  const [seciliPersonel, setSeciliPersonel] = useState(null);
  const [odemeler, setOdemeler] = useState(null);
  const [odemeForm, setOdemeForm] = useState({ donem: new Date().toISOString().slice(0, 10), tip: 'MAAS', tutar: '', aciklama: '' });
  const [odemeAcikId, setOdemeAcikId] = useState(null);

  function yukle() {
    api.get('/personel').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  function duzenlemeyeBasla(p) {
    setDuzenlenenPersonel(p);
    setForm({
      ad_soyad: p.ad_soyad, pozisyon: p.pozisyon || '', aylik_maas: p.aylik_maas != null ? String(p.aylik_maas) : '',
      ise_baslama_tarihi: p.ise_baslama_tarihi || '', sifre: '',
    });
    setFormAcik(true);
  }

  function formuKapat() {
    setFormAcik(false);
    setDuzenlenenPersonel(null);
    setForm(bosPersonelFormu());
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      const govde = { ...form, aylik_maas: form.aylik_maas ? Number(form.aylik_maas) : null, ise_baslama_tarihi: form.ise_baslama_tarihi || null };
      if (duzenlenenPersonel) {
        await api.put(`/personel/${duzenlenenPersonel.id}`, govde);
      } else {
        delete govde.sifre;
        await api.post('/personel', govde);
      }
      formuKapat();
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeleriGoster(personelId) {
    try {
      const { data } = await api.get(`/personel/${personelId}/odemeler`);
      setSeciliPersonel(personelId);
      setOdemeler(data);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeEkle(e) {
    e.preventDefault();
    try {
      await api.post(`/personel-odemeleri?personel_id=${seciliPersonel}`, { ...odemeForm, tutar: Number(odemeForm.tutar) });
      odemeleriGoster(seciliPersonel);
      setOdemeForm({ donem: new Date().toISOString().slice(0, 10), tip: 'MAAS', tutar: '', aciklama: '' });
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeyiTamamla(odeme, secim) {
    await api.put(`/personel-odemeleri/${odeme.id}/ode`, secim);
    setOdemeAcikId(null);
    odemeleriGoster(seciliPersonel);
  }

  async function odemeGeriAl(odemeId) {
    if (!(await ozelOnayIste('Bu ödemeyi geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.'))) return;
    try {
      await api.put(`/personel-odemeleri/${odemeId}/odemeyi-geri-al`);
      odemeleriGoster(seciliPersonel);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeSil(odemeId) {
    if (!(await ozelOnayIste('Bu tahakkuk kaydını silmek istediğinize emin misiniz?'))) return;
    try {
      await api.delete(`/personel-odemeleri/${odemeId}`);
      odemeleriGoster(seciliPersonel);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => (formAcik ? formuKapat() : setFormAcik(true))}>{formAcik ? 'Kapat' : '+ Yeni personel'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            {duzenlenenPersonel ? 'Personeli düzenle' : 'Yeni personel'}
          </div>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Ad Soyad">
              <input required value={form.ad_soyad} onChange={(e) => setForm((f) => ({ ...f, ad_soyad: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Pozisyon">
              <input value={form.pozisyon} onChange={(e) => setForm((f) => ({ ...f, pozisyon: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Aylık maaş (TL)">
              <ParaGirdisi value={form.aylik_maas} onChange={(v) => setForm((f) => ({ ...f, aylik_maas: v }))} />
            </Alan>
            <Alan etiket="İşe başlama tarihi">
              <input type="date" value={form.ise_baslama_tarihi} onChange={(e) => setForm((f) => ({ ...f, ise_baslama_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            {duzenlenenPersonel && (
              <Alan etiket="Şifreniz (onay için zorunlu)">
                <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} placeholder="Giriş şifreniz" />
              </Alan>
            )}
            <div style={{ alignSelf: 'end' }}><Buton type="submit">{duzenlenenPersonel ? 'Değişiklikleri kaydet' : 'Kaydet'}</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0, marginBottom: 16 }}>
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              <SiraliBaslik alanAdi="ad_soyad" siralama={siralama}>Ad Soyad</SiraliBaslik>
              <SiraliBaslik alanAdi="pozisyon" siralama={siralama}>Pozisyon</SiraliBaslik>
              <SiraliBaslik alanAdi="aylik_maas" siralama={siralama}>Aylık Maaş</SiraliBaslik>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }} />
            </tr>
          </thead>
          <tbody>
            {siralama.sirala(liste, (item, alan) => item[alan]).map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--kenarlik)', background: seciliPersonel === p.id ? 'var(--zemin)' : 'transparent' }}>
                <td onClick={() => odemeleriGoster(p.id)} style={{ padding: '10px 16px', fontWeight: 500, cursor: 'pointer' }}>
                  {p.ad_soyad}
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--lacivert)' }}>
                    {seciliPersonel === p.id ? '▲ detayı gizle' : '▼ ödemeleri gör'}
                  </span>
                </td>
                <td onClick={() => odemeleriGoster(p.id)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: 'pointer' }}>{p.pozisyon || '—'}</td>
                <td onClick={() => odemeleriGoster(p.id)} style={{ padding: '10px 16px', cursor: 'pointer' }}>{p.aylik_maas != null ? paraFormat(p.aylik_maas) : '—'}</td>
                <td style={{ padding: '10px 16px' }}>
                  <button onClick={() => duzenlemeyeBasla(p)} style={eylemChipStili('lacivert')}>Düzenle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kart>

      {seciliPersonel && (
        <Kart>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 12 }}>
            {(liste.find((p) => p.id === seciliPersonel) || {}).ad_soyad || `Personel #${seciliPersonel}`} — ödeme geçmişi
          </div>

          {odemeler && odemeler.length > 0 && (
            <div style={{ display: 'flex', gap: 24, marginBottom: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Toplam Ödenen (bugüne kadar)</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--yesil)' }}>
                  {paraFormat(odemeler.filter((o) => o.odendi_mi).reduce((acc, o) => acc + Number(o.tutar), 0))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)' }}>Bekleyen Tahakkuk</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--kirmizi)' }}>
                  {paraFormat(odemeler.filter((o) => !o.odendi_mi).reduce((acc, o) => acc + Number(o.tutar), 0))}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={odemeEkle} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr auto', gap: 10, marginBottom: 14 }}>
            <Alan etiket="Dönem">
              <input required type="date" value={odemeForm.donem} onChange={(e) => setOdemeForm((f) => ({ ...f, donem: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tip">
              <select value={odemeForm.tip} onChange={(e) => setOdemeForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="MAAS">Maaş</option>
                <option value="AVANS">Avans</option>
                <option value="PRIM">Prim</option>
                <option value="SGK">SGK</option>
                <option value="DIGER">Diğer</option>
              </select>
            </Alan>
            <Alan etiket="Tutar">
              <ParaGirdisi required value={odemeForm.tutar} onChange={(v) => setOdemeForm((f) => ({ ...f, tutar: v }))} />
            </Alan>
            <Alan etiket="Açıklama (opsiyonel)">
              <input value={odemeForm.aciklama} onChange={(e) => setOdemeForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Tahakkuk ettir</Buton></div>
          </form>

          {odemeler && (
            odemeler.length === 0 ? <BosDurum baslik="Kayıt bulunamadı" /> : (
              <table>
                <thead>
                  <tr style={{ background: 'var(--zemin)' }}>
                    {['Dönem', 'Tip', 'Tutar', 'Açıklama', 'Durum', ''].map((b) => (
                      <th key={b} style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {odemeler.map((o) => (
                    <Fragment key={o.id}>
                      <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                        <td style={{ padding: '8px 0' }}>{o.donem}</td>
                        <td style={{ padding: '8px 0' }}>{o.tip}</td>
                        <td style={{ padding: '8px 0' }}>{paraFormat(o.tutar)}</td>
                        <td style={{ padding: '8px 0', color: 'var(--metin-ikincil)' }}>{o.aciklama || '—'}</td>
                        <td style={{ padding: '8px 0' }}><Etiket ton={o.odendi_mi ? 'yesil' : 'amber'}>{o.odendi_mi ? 'Ödendi' : 'Bekliyor'}</Etiket></td>
                        <td style={{ padding: '8px 0' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {o.odendi_mi ? (
                              <button onClick={() => odemeGeriAl(o.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                            ) : (
                              <>
                                <button
                                  onClick={() => setOdemeAcikId((mevcut) => (mevcut === o.id ? null : o.id))}
                                  style={eylemChipStili('lacivert')}
                                >
                                  {odemeAcikId === o.id ? 'Kapat' : 'Öde'}
                                </button>
                                <button onClick={() => odemeSil(o.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {odemeAcikId === o.id && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0 0 10px' }}>
                            <OdemeFormu
                              tutar={o.tutar}
                              paraBirimi="TRY"
                              onOde={(secim) => odemeyiTamamla(o, secim)}
                              onVazgec={() => setOdemeAcikId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )
          )}
        </Kart>
      )}
    </div>
  );
}
