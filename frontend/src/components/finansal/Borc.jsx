import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar } from '../../api/client';
import {
  Kart, Buton, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, eylemChipStili, ParaGirdisi,
} from '../Ortak';
import AramaliSecici from '../AramaliSecici';
import {
  useSiralama, SiraliBaslik, useCariHaritasi, useCariler, useKurlar, tlKarsiligiGoster,
  cariGoster, DovizKarsiligiGosterge, OdemeFormu,
} from './Ortak';

const BORC_TIP_METIN = { ORTAKTAN_ALINAN: 'Ortaktan Alınan', DISARIDAN_ALINAN: 'Dışarıdan Alınan', ORTAGA_VERILEN: 'Ortağa Verilen' };

function BorcDuzenleFormu({ borc, cariler, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    tip: borc.tip, cari_id: String(borc.cari_id), tutar: borc.tutar, para_birimi: borc.para_birimi,
    faiz_orani: borc.faiz_orani ?? '0', alinma_tarihi: borc.alinma_tarihi, vade_tarihi: borc.vade_tarihi || '',
    notlar: borc.notlar || '', sifre: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/borclar/${borc.id}`, {
        ...form, cari_id: Number(form.cari_id), tutar: Number(form.tutar), faiz_orani: Number(form.faiz_orani),
        vade_tarihi: form.vade_tarihi || null,
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
      <td colSpan={6} style={{ padding: '0 16px 12px' }}>
        <div style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8 }}>
          <form onSubmit={kaydet}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Borç kaydını düzenle</div>
            <HataMesaji>{hata}</HataMesaji>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Alan etiket="Tip">
                <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                  <option value="ORTAKTAN_ALINAN">Ortaktan Alınan</option>
                  <option value="DISARIDAN_ALINAN">Dışarıdan Alınan</option>
                  <option value="ORTAGA_VERILEN">Ortağa Verilen</option>
                </select>
              </Alan>
              <Alan etiket="Cari">
                <AramaliSecici secenekler={cariler} deger={form.cari_id} onDegistir={(v) => setForm((f) => ({ ...f, cari_id: v }))} etiketFn={(c) => c.unvan} />
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
                <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
              </Alan>
              <Alan etiket="Faiz oranı (%)">
                <ParaGirdisi value={form.faiz_orani} onChange={(v) => setForm((f) => ({ ...f, faiz_orani: v }))} />
              </Alan>
              <Alan etiket="Alınma tarihi">
                <input required type="date" value={form.alinma_tarihi} onChange={(e) => setForm((f) => ({ ...f, alinma_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Vade tarihi">
                <input type="date" value={form.vade_tarihi} onChange={(e) => setForm((f) => ({ ...f, vade_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Notlar">
                <input value={form.notlar} onChange={(e) => setForm((f) => ({ ...f, notlar: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Şifreniz (onay için zorunlu)">
                <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} placeholder="Giriş şifreniz" />
              </Alan>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Değişiklikleri kaydet'}</Buton>
              <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}

export default function BorcSekmesi() {
  const kurlar = useKurlar();
  const siralama = useSiralama();
  const [filtreCariId, setFiltreCariId] = useState('');
  const [liste, setListe] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ tip: 'ORTAKTAN_ALINAN', cari_id: '', tutar: '', para_birimi: 'TRY', alinma_tarihi: new Date().toISOString().slice(0, 10) });
  const [hata, setHata] = useState(null);
  const [bakiyeler, setBakiyeler] = useState({});
  const cariHaritasi = useCariHaritasi();
  const cariler = useCariler();
  const [odemeAcikId, setOdemeAcikId] = useState(null);
  const [odemeTutari, setOdemeTutari] = useState('');
  const [duzenlenenBorcId, setDuzenlenenBorcId] = useState(null);

  function yukle() {
    api.get('/borclar').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/borclar', { ...form, cari_id: Number(form.cari_id), tutar: Number(form.tutar) });
      setFormAcik(false);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function bakiyeyiGetir(borcId) {
    try {
      const { data } = await api.get(`/borclar/${borcId}/bakiye`);
      setBakiyeler((b) => ({ ...b, [borcId]: data }));
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeyiTamamla(borc, secim) {
    if (!odemeTutari || Number(odemeTutari) <= 0) {
      throw new Error('Lütfen geçerli bir ödeme tutarı girin.');
    }
    await api.post(`/borclar/${borc.id}/odeme`, { tarih: secim.odeme_tarihi, tutar: Number(odemeTutari), ...secim });
    setOdemeAcikId(null);
    setOdemeTutari('');
    bakiyeyiGetir(borc.id);
  }

  const gosterilecekListe = filtreCariId ? liste.filter((b) => String(b.cari_id) === String(filtreCariId)) : liste;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni borç kaydı'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Tip">
              <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="ORTAKTAN_ALINAN">Ortaktan Alınan</option>
                <option value="DISARIDAN_ALINAN">Dışarıdan Alınan</option>
                <option value="ORTAGA_VERILEN">Ortağa Verilen</option>
              </select>
            </Alan>
            <Alan etiket="Cari">
              <AramaliSecici secenekler={cariler} deger={form.cari_id} onDegistir={(v) => setForm((f) => ({ ...f, cari_id: v }))} etiketFn={(c) => c.unvan} />
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
              <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
            </Alan>
            <DovizKarsiligiGosterge tutar={form.tutar} paraBirimi={form.para_birimi} />
            <Alan etiket="Alınma tarihi">
              <input required type="date" value={form.alinma_tarihi} onChange={(e) => setForm((f) => ({ ...f, alinma_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Kaydet</Buton></div>
          </form>
        </Kart>
      )}
      <Kart style={{ marginBottom: 12 }}>
        <Alan etiket="Cariye göre filtrele">
          <AramaliSecici secenekler={cariler} deger={filtreCariId} onDegistir={setFiltreCariId} etiketFn={(c) => c.unvan} bosMetin="Tümü / yazarak arayın..." />
        </Alan>
      </Kart>
      <Kart style={{ padding: 0 }}>
        {gosterilecekListe.length === 0 ? <BosDurum baslik="Kayıt bulunamadı" /> : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                <SiraliBaslik alanAdi="tip" siralama={siralama}>Tip</SiraliBaslik>
                <SiraliBaslik alanAdi="_cari_unvan" siralama={siralama}>Cari</SiraliBaslik>
                <SiraliBaslik alanAdi="tutar" siralama={siralama}>Toplam Borç</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>TL Karşılığı</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Kalan Bakiye</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }} />
              </tr>
            </thead>
            <tbody>
              {siralama.sirala(gosterilecekListe, (item, alan) => (alan === '_cari_unvan' ? (cariHaritasi[item.cari_id] || '') : item[alan])).map((b) => (
                <Fragment key={b.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)', background: odemeAcikId === b.id ? 'var(--zemin)' : 'transparent' }}>
                    {(() => {
                      const acKapat = () => { setOdemeAcikId((mevcut) => (mevcut === b.id ? null : b.id)); setOdemeTutari(''); };
                      return (
                        <>
                          <td onClick={acKapat} style={{ padding: '10px 16px', cursor: 'pointer' }}>
                            {BORC_TIP_METIN[b.tip]}
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--lacivert)' }}>{odemeAcikId === b.id ? '▲ kapat' : '▼ ödeme ekle'}</span>
                          </td>
                          <td onClick={acKapat} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: 'pointer' }}>{cariGoster(b.cari_id, cariHaritasi)}</td>
                          <td onClick={acKapat} style={{ padding: '10px 16px', cursor: 'pointer' }}>{paraFormat(b.tutar, b.para_birimi)}</td>
                          <td onClick={acKapat} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: 'pointer' }}>{tlKarsiligiGoster(b.tutar, b.para_birimi, kurlar)}</td>
                        </>
                      );
                    })()}
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                      {bakiyeler[b.id] ? paraFormat(bakiyeler[b.id].kalan_bakiye, b.para_birimi)
                        : <button onClick={() => bakiyeyiGetir(b.id)} style={eylemChipStili('lacivert')}>Göster</button>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <button
                        onClick={() => setDuzenlenenBorcId((mevcut) => (mevcut === b.id ? null : b.id))}
                        style={eylemChipStili('notr')}
                      >
                        {duzenlenenBorcId === b.id ? 'Kapat' : 'Düzenle'}
                      </button>
                    </td>
                  </tr>
                  {duzenlenenBorcId === b.id && (
                    <BorcDuzenleFormu
                      borc={b}
                      cariler={cariler}
                      onKaydedildi={() => { setDuzenlenenBorcId(null); yukle(); }}
                      onVazgec={() => setDuzenlenenBorcId(null)}
                    />
                  )}
                  {odemeAcikId === b.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: '0 16px 10px' }}>
                        <div style={{ marginBottom: 8 }}>
                          <Alan etiket="Ödeme tutarı">
                            <input
                              type="number" step="0.01" value={odemeTutari}
                              onChange={(e) => setOdemeTutari(e.target.value)}
                              style={{ ...girdiStili, maxWidth: 200 }}
                            />
                          </Alan>
                        </div>
                        <OdemeFormu
                          tutar={odemeTutari}
                          paraBirimi={b.para_birimi}
                          aksiyonMetni="Ödemeyi tamamla"
                          onOde={(secim) => odemeyiTamamla(b, secim)}
                          onVazgec={() => setOdemeAcikId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}
