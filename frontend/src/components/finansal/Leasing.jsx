import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar, ozelOnayIste, geriAlBildirimGoster } from '../../api/client';
import {
  Kart, Buton, Etiket, Alan, girdiStili, HataMesaji, paraFormat, eylemChipStili, ParaGirdisi,
} from '../Ortak';
import AramaliSecici from '../AramaliSecici';
import {
  tarihFormat, useSiralama, SiraliBaslik, useCariler, useUrunTanimlari, useUrunSecenekleri,
  useKurlar, tlKarsiligiGoster, DovizKarsiligiGosterge, OdemeFormu,
} from './Ortak';

function bosLeasingKalemi() {
  return { stok_karti_id: '', miktar: 1, birim_fiyat: '', stok_seri_no_idleri: [] };
}

function bosLeasingFormu() {
  return {
    sozlesme_no: '', leasing_firmasi_cari_id: '', para_birimi: 'TRY',
    taksit_sayisi: 12, baslangic_tarihi: new Date().toISOString().slice(0, 10),
    kalemler: [bosLeasingKalemi()],
  };
}

export default function LeasingSekmesi() {
  const [liste, setListe] = useState([]);
  const cariler = useCariler();
  const urunTanimlari = useUrunTanimlari();
  const tumUrunSecenekleri = useUrunSecenekleri();
  const kurlar = useKurlar();
  const siralama = useSiralama();
  const [filtreCariId, setFiltreCariId] = useState('');
  const [hata, setHata] = useState(null);
  const [seciliPlan, setSeciliPlan] = useState(null);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState(bosLeasingFormu());
  const [odemeAcikTaksitId, setOdemeAcikTaksitId] = useState(null);
  const [odemePlaniHaritasi, setOdemePlaniHaritasi] = useState({});

  function yukle() {
    api.get('/leasing-sozlesmeleri').then((r) => {
      setListe(r.data);
      Promise.all(
        r.data.map((l) => api.get(`/leasing-sozlesmeleri/${l.id}/odeme-plani`).then((res) => [l.id, res.data]).catch(() => [l.id, null]))
      ).then((sonuclar) => {
        const harita = {};
        sonuclar.forEach(([id, taksitler]) => {
          if (!taksitler) return;
          const odenen = taksitler.filter((t) => t.odendi_mi).reduce((acc, t) => acc + Number(t.tutar), 0);
          const toplam = taksitler.reduce((acc, t) => acc + Number(t.tutar), 0);
          harita[id] = { toplam, odenen, kalan: toplam - odenen };
        });
        setOdemePlaniHaritasi(harita);
      });
    }).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  function kalemGuncelle(i, alan, deger) {
    setForm((f) => ({
      ...f,
      kalemler: f.kalemler.map((k, idx) => (idx === i ? { ...k, [alan]: deger } : k)),
    }));
  }
  function kalemEkle() {
    setForm((f) => ({ ...f, kalemler: [...f.kalemler, bosLeasingKalemi()] }));
  }
  function kalemSil(i) {
    setForm((f) => ({ ...f, kalemler: f.kalemler.filter((_, idx) => idx !== i) }));
  }
  function kalemSeriSecimDegistir(i, seriId) {
    setForm((f) => ({
      ...f,
      kalemler: f.kalemler.map((k, idx) => {
        if (idx !== i) return k;
        const mevcut = k.stok_seri_no_idleri || [];
        const yeni = mevcut.includes(seriId) ? mevcut.filter((x) => x !== seriId) : [...mevcut, seriId];
        return { ...k, stok_seri_no_idleri: yeni };
      }),
    }));
  }
  const formToplamTutar = form.kalemler.reduce((acc, k) => acc + (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0), 0);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    if (form.kalemler.some((k) => !k.stok_karti_id || !k.birim_fiyat)) {
      setHata('Lütfen her kalem için ürün ve birim fiyat girin.');
      return;
    }
    try {
      await api.post('/leasing-sozlesmeleri', {
        sozlesme_no: form.sozlesme_no,
        leasing_firmasi_cari_id: Number(form.leasing_firmasi_cari_id),
        para_birimi: form.para_birimi,
        taksit_sayisi: Number(form.taksit_sayisi),
        baslangic_tarihi: form.baslangic_tarihi,
        kalemler: form.kalemler.map((k) => ({
          stok_karti_id: Number(k.stok_karti_id), miktar: Number(k.miktar), birim_fiyat: Number(k.birim_fiyat),
          stok_seri_no_idleri: (k.stok_seri_no_idleri || []).map(Number),
        })),
      });
      setFormAcik(false);
      setForm(bosLeasingFormu());
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function sozlesmeSil(id) {
    if (!(await ozelOnayIste('Bu leasing sözleşmesini silmek istediğinize emin misiniz?'))) return;
    try {
      await api.delete(`/leasing-sozlesmeleri/${id}`);
      if (seciliPlan?.id === id) setSeciliPlan(null);
      yukle();
      geriAlBildirimGoster('Leasing sözleşmesi silindi.', async () => {
        await api.put(`/leasing-sozlesmeleri/${id}/geri-getir`);
        yukle();
      });
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function planiGoster(id) {
    try {
      const { data } = await api.get(`/leasing-sozlesmeleri/${id}/odeme-plani`);
      setSeciliPlan({ id, taksitler: data });
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeyiTamamla(odeme, secim) {
    await api.put(`/leasing-odemeleri/${odeme.id}/ode`, secim);
    setOdemeAcikTaksitId(null);
    planiGoster(seciliPlan.id);
  }

  async function odemeyiGeriAl(odemeId) {
    if (!(await ozelOnayIste('Bu ödemeyi geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.'))) return;
    try {
      await api.put(`/leasing-odemeleri/${odemeId}/odemeyi-geri-al`);
      planiGoster(seciliPlan.id);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  const seciliSozlesme = liste.find((l) => l.id === seciliPlan?.id);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni leasing sözleşmesi'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Alan etiket="Sözleşme no">
                <input required value={form.sozlesme_no} onChange={(e) => setForm((f) => ({ ...f, sozlesme_no: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Leasing şirketi (cari)">
                <AramaliSecici secenekler={cariler} deger={form.leasing_firmasi_cari_id} onDegistir={(v) => setForm((f) => ({ ...f, leasing_firmasi_cari_id: v }))} etiketFn={(c) => c.unvan} />
              </Alan>
              <Alan etiket="Para birimi">
                <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </Alan>
              <Alan etiket="Taksit sayısı">
                <input required type="number" min="1" value={form.taksit_sayisi} onChange={(e) => setForm((f) => ({ ...f, taksit_sayisi: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Başlangıç tarihi">
                <input required type="date" value={form.baslangic_tarihi} onChange={(e) => setForm((f) => ({ ...f, baslangic_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ürün kalemleri (birden fazla ürün türü ekleyebilirsiniz)</div>
            <table style={{ width: '100%', marginBottom: 8 }}>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Ürün', 'Adet', 'Birim Fiyat', 'Satır Toplamı', ''].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.kalemler.map((k, i) => {
                  const satirToplam = (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0);
                  const eslesenUrunler = k.stok_karti_id
                    ? tumUrunSecenekleri.filter((u) => String(u.stok_karti_id) === String(k.stok_karti_id))
                    : [];
                  return (
                    <Fragment key={i}>
                      <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                        <td style={{ padding: 6 }}>
                          <select required value={k.stok_karti_id} onChange={(e) => kalemGuncelle(i, 'stok_karti_id', e.target.value)} style={girdiStili}>
                            <option value="">Seçin...</option>
                            {urunTanimlari.map((u) => <option key={u.id} value={u.id}>{u.marka} {u.model}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: 6 }}>
                          <input required type="number" min="1" value={k.miktar} onChange={(e) => kalemGuncelle(i, 'miktar', e.target.value)} style={{ ...girdiStili, width: 80 }} />
                        </td>
                        <td style={{ padding: 6 }}>
                          <ParaGirdisi required value={k.birim_fiyat} onChange={(v) => kalemGuncelle(i, 'birim_fiyat', v)} style={{ width: 130 }} />
                        </td>
                        <td style={{ padding: 6, fontSize: 13, fontWeight: 500 }}>{paraFormat(satirToplam, form.para_birimi)}</td>
                        <td style={{ padding: 6 }}>
                          {form.kalemler.length > 1 && (
                            <button type="button" onClick={() => kalemSil(i)} style={eylemChipStili('kirmizi')}>Sil</button>
                          )}
                        </td>
                      </tr>
                      {k.stok_karti_id && (
                        <tr>
                          <td colSpan={5} style={{ padding: '4px 6px 10px', background: 'var(--zemin)' }}>
                            <div style={{ fontSize: 11.5, color: 'var(--metin-ikincil)', marginBottom: 4 }}>
                              Seri numaraları (opsiyonel — hangi spesifik ürün(ler) bu kaleme dahil, {(k.stok_seri_no_idleri || []).length}/{k.miktar} seçili):
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              {eslesenUrunler.length === 0 ? (
                                <span style={{ fontSize: 12, color: 'var(--metin-soluk)' }}>Bu üründen uygun stok bulunamadı.</span>
                              ) : eslesenUrunler.map((u) => (
                                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                  <input
                                    type="checkbox"
                                    checked={(k.stok_seri_no_idleri || []).includes(u.id)}
                                    onChange={() => kalemSeriSecimDegistir(i, u.id)}
                                  />
                                  {u.etiket}
                                </label>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <button type="button" onClick={kalemEkle} style={eylemChipStili('lacivert')}>+ Kalem ekle</button>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Genel toplam: {paraFormat(formToplamTutar, form.para_birimi)}
              </div>
            </div>
            <DovizKarsiligiGosterge tutar={formToplamTutar} paraBirimi={form.para_birimi} />
            <div style={{ marginTop: 12 }}><Buton type="submit">Sözleşmeyi oluştur</Buton></div>
          </form>
        </Kart>
      )}
      <Kart style={{ marginBottom: 12 }}>
        <Alan etiket="Leasing firmasına göre filtrele">
          <AramaliSecici secenekler={cariler} deger={filtreCariId} onDegistir={setFiltreCariId} etiketFn={(c) => c.unvan} bosMetin="Tümü / yazarak arayın..." />
        </Alan>
      </Kart>
      <Kart style={{ padding: 0, marginBottom: 16 }}>
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              <SiraliBaslik alanAdi="sozlesme_no" siralama={siralama}>Sözleşme No</SiraliBaslik>
              <SiraliBaslik alanAdi="leasing_firmasi_unvan" siralama={siralama}>Leasing Firması</SiraliBaslik>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Ürünler</th>
              <SiraliBaslik alanAdi="toplam_tutar" siralama={siralama}>Toplam Tutar</SiraliBaslik>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>TL Karşılığı</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Ödenen</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Kalan</th>
              <SiraliBaslik alanAdi="taksit_sayisi" siralama={siralama}>Taksit Sayısı</SiraliBaslik>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {siralama.sirala(
              filtreCariId ? liste.filter((l) => String(l.leasing_firmasi_cari_id) === String(filtreCariId)) : liste,
              (item, alan) => item[alan]
            ).map((l) => (
              <tr key={l.id} style={{ borderTop: '1px solid var(--kenarlik)', background: seciliPlan?.id === l.id ? 'var(--zemin)' : 'transparent' }}>
                <td onClick={() => planiGoster(l.id)} style={{ padding: '10px 16px', fontWeight: 500, cursor: 'pointer' }}>{l.sozlesme_no || `#${l.id}`}</td>
                <td onClick={() => planiGoster(l.id)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: 'pointer' }}>{l.leasing_firmasi_unvan || `#${l.leasing_firmasi_cari_id}`}</td>
                <td onClick={() => planiGoster(l.id)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: 'pointer' }}>
                  {(l.kalemler || []).map((k) => (
                    `${k.miktar}x ${k.urun_adi || '#' + k.stok_karti_id}${(k.seri_numaralari || []).length > 0 ? ` (${k.seri_numaralari.join(', ')})` : ''}`
                  )).join(' · ') || '—'}
                </td>
                <td onClick={() => planiGoster(l.id)} style={{ padding: '10px 16px', cursor: 'pointer' }}>{paraFormat(l.toplam_tutar, l.para_birimi)}</td>
                <td onClick={() => planiGoster(l.id)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: 'pointer' }}>{tlKarsiligiGoster(l.toplam_tutar, l.para_birimi, kurlar)}</td>
                <td onClick={() => planiGoster(l.id)} style={{ padding: '10px 16px', color: 'var(--yesil)', cursor: 'pointer' }}>
                  {odemePlaniHaritasi[l.id] ? paraFormat(odemePlaniHaritasi[l.id].odenen, l.para_birimi) : '—'}
                </td>
                <td onClick={() => planiGoster(l.id)} style={{ padding: '10px 16px', fontWeight: 600, color: odemePlaniHaritasi[l.id] && odemePlaniHaritasi[l.id].kalan > 0 ? 'var(--kirmizi)' : 'var(--yesil)', cursor: 'pointer' }}>
                  {odemePlaniHaritasi[l.id] ? paraFormat(odemePlaniHaritasi[l.id].kalan, l.para_birimi) : '—'}
                </td>
                <td onClick={() => planiGoster(l.id)} style={{ padding: '10px 16px', cursor: 'pointer' }}>
                  {l.taksit_sayisi}
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--lacivert)' }}>
                    {seciliPlan?.id === l.id ? '▲ detayı gizle' : '▼ ödeme planını gör'}
                  </span>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <button onClick={() => sozlesmeSil(l.id)} style={eylemChipStili('kirmizi')}>Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Kart>
      {seciliPlan && (
        <Kart style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--kenarlik)' }}>
            Ödeme planı (sözleşme #{seciliPlan.id})
          </div>
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Taksit No', 'Vade', 'Tutar', 'Durum', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seciliPlan.taksitler.map((t) => (
                <Fragment key={t.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '8px 16px' }}>{t.taksit_no}</td>
                    <td style={{ padding: '8px 16px' }}>{tarihFormat(t.vade_tarihi)}</td>
                    <td style={{ padding: '8px 16px' }}>{paraFormat(t.tutar, seciliSozlesme?.para_birimi)}</td>
                    <td style={{ padding: '8px 16px' }}><Etiket ton={t.odendi_mi ? 'yesil' : 'amber'}>{t.odendi_mi ? 'Ödendi' : 'Bekliyor'}</Etiket></td>
                    <td style={{ padding: '8px 16px' }}>
                      {t.odendi_mi ? (
                        <button onClick={() => odemeyiGeriAl(t.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                      ) : (
                        <button
                          onClick={() => setOdemeAcikTaksitId((mevcut) => (mevcut === t.id ? null : t.id))}
                          style={eylemChipStili('lacivert')}
                        >
                          {odemeAcikTaksitId === t.id ? 'Kapat' : 'Öde'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {odemeAcikTaksitId === t.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: '0 16px 10px' }}>
                        <OdemeFormu
                          tutar={t.tutar}
                          paraBirimi={seciliSozlesme?.para_birimi || 'TRY'}
                          aksiyonMetni="Taksidi öde"
                          onOde={(secim) => odemeyiTamamla(t, secim)}
                          onVazgec={() => setOdemeAcikTaksitId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Kart>
      )}
    </div>
  );
}
