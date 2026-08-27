import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar, ozelOnayIste, ozelAlert } from '../../api/client';
import {
  Kart, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, eylemChipStili, ParaGirdisi,
} from '../Ortak';
import AramaliSecici from '../AramaliSecici';
import {
  tarihFormat, useCariler, useUrunTanimlari, useUrunSecenekleri, BasitTablo, OdemeFormu,
} from './Ortak';

function bosTaksitKalemi() {
  return { stok_karti_id: '', miktar: 1, birim_fiyat: '', stok_seri_no_idleri: [] };
}

export default function TaksitSekmesi() {
  const [hata, setHata] = useState(null);
  const cariler = useCariler();
  const urunTanimlari = useUrunTanimlari();
  const tumUrunSecenekleri = useUrunSecenekleri();
  const [vadesiGecenler, setVadesiGecenler] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({
    musteri_cari_id: '', pesinat: '0',
    taksit_sayisi: 6, baslangic_tarihi: new Date().toISOString().slice(0, 10),
    kalemler: [bosTaksitKalemi()],
  });
  const [olusanPlan, setOlusanPlan] = useState(null);
  const [taksitler, setTaksitler] = useState(null);
  const [odemeAcikTaksitId, setOdemeAcikTaksitId] = useState(null);
  const [tumPlanlar, setTumPlanlar] = useState([]);
  const [genisletilmisPlanId, setGenisletilmisPlanId] = useState(null);
  const [genisPlanTaksitleri, setGenisPlanTaksitleri] = useState(null);

  function vadesiGecenleriYukle() {
    api.get('/taksitler/vadesi-gecenler').then((r) => setVadesiGecenler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(vadesiGecenleriYukle, []);

  function tumPlanlariYukle() {
    api.get('/taksitli-satis-planlari').then((r) => setTumPlanlar(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(tumPlanlariYukle, []);

  const [odemeAcikGenisTaksitId, setOdemeAcikGenisTaksitId] = useState(null);

  async function genisPlanTaksitleriYenile(planId) {
    const { data } = await api.get(`/taksitli-satis-planlari/${planId}/taksitler`);
    setGenisPlanTaksitleri(data);
    tumPlanlariYukle();
  }

  async function genisPlanOdemeyiTamamla(taksit, planId, secim) {
    const { data: sonuc } = await api.put(`/taksit-detay/${taksit.id}/tahsil-et`, secim);
    setOdemeAcikGenisTaksitId(null);
    await genisPlanTaksitleriYenile(planId);
    vadesiGecenleriYukle();
    if (sonuc.guncellenen_taksitler.length > 1) {
      await ozelAlert(`Ödeme, taksit ${sonuc.guncellenen_taksitler[0].taksit_no}'dan ${sonuc.guncellenen_taksitler[sonuc.guncellenen_taksitler.length - 1].taksit_no}'a kadar ${sonuc.guncellenen_taksitler.length} takside otomatik olarak uygulandı.`);
    }
    if (sonuc.fazla_odeme_var_mi) {
      await ozelAlert(`Dikkat: Tüm taksitler kapandı ve ${paraFormat(sonuc.fazla_odeme_tutari)} fazla ödeme oldu. Bu fazlalık hiçbir taksite işlenmedi, lütfen kontrol edin.`);
    }
  }

  async function genisPlanTahsilatiGeriAl(taksitId, planId) {
    if (!(await ozelOnayIste('Bu tahsilatı geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek. Bu ödeme başka taksitlere de yansımışsa, onlar da birlikte geri alınacaktır.'))) return;
    try {
      const { data: sonuc } = await api.put(`/taksit-detay/${taksitId}/tahsilati-geri-al`);
      await genisPlanTaksitleriYenile(planId);
      vadesiGecenleriYukle();
      if (sonuc.etkilenen_taksit_sayisi > 1) {
        await ozelAlert(`${sonuc.etkilenen_taksit_sayisi} taksit birlikte geri alındı (aynı ödemeyle ilişkiliydiler).`);
      }
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  function planiGenisletVeyaKapat(planId) {
    if (genisletilmisPlanId === planId) {
      setGenisletilmisPlanId(null);
      setGenisPlanTaksitleri(null);
      return;
    }
    setGenisletilmisPlanId(planId);
    setGenisPlanTaksitleri(null);
    api.get(`/taksitli-satis-planlari/${planId}/taksitler`).then((r) => setGenisPlanTaksitleri(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }

  function kalemGuncelle(i, alan, deger) {
    setForm((f) => ({ ...f, kalemler: f.kalemler.map((k, idx) => (idx === i ? { ...k, [alan]: deger } : k)) }));
  }
  function kalemEkle() {
    setForm((f) => ({ ...f, kalemler: [...f.kalemler, bosTaksitKalemi()] }));
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
      const { data } = await api.post('/taksitli-satis-planlari', {
        musteri_cari_id: Number(form.musteri_cari_id),
        para_birimi: 'TRY',
        pesinat: Number(form.pesinat),
        taksit_sayisi: Number(form.taksit_sayisi),
        baslangic_tarihi: form.baslangic_tarihi,
        kalemler: form.kalemler.map((k) => ({
          stok_karti_id: Number(k.stok_karti_id), miktar: Number(k.miktar), birim_fiyat: Number(k.birim_fiyat),
          stok_seri_no_idleri: (k.stok_seri_no_idleri || []).map(Number),
        })),
      });
      setOlusanPlan(data);
      const { data: taksitVerisi } = await api.get(`/taksitli-satis-planlari/${data.id}/taksitler`);
      setTaksitler(taksitVerisi);
      setFormAcik(false);
      tumPlanlariYukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeyiTamamla(taksit, secim) {
    const { data: sonuc } = await api.put(`/taksit-detay/${taksit.id}/tahsil-et`, secim);
    setOdemeAcikTaksitId(null);
    const { data } = await api.get(`/taksitli-satis-planlari/${olusanPlan.id}/taksitler`);
    setTaksitler(data);
    vadesiGecenleriYukle();
    if (sonuc.guncellenen_taksitler.length > 1) {
      await ozelAlert(`Ödeme, taksit ${sonuc.guncellenen_taksitler[0].taksit_no}'dan ${sonuc.guncellenen_taksitler[sonuc.guncellenen_taksitler.length - 1].taksit_no}'a kadar ${sonuc.guncellenen_taksitler.length} takside otomatik olarak uygulandı.`);
    }
    if (sonuc.fazla_odeme_var_mi) {
      await ozelAlert(`Dikkat: Tüm taksitler kapandı ve ${paraFormat(sonuc.fazla_odeme_tutari)} fazla ödeme oldu. Bu fazlalık hiçbir taksite işlenmedi, lütfen kontrol edin.`);
    }
  }

  async function tahsilatiGeriAl(taksitId) {
    if (!(await ozelOnayIste('Bu tahsilatı geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek. Bu ödeme başka taksitlere de yansımışsa, onlar da birlikte geri alınacaktır.'))) return;
    try {
      const { data: sonuc } = await api.put(`/taksit-detay/${taksitId}/tahsilati-geri-al`);
      const { data } = await api.get(`/taksitli-satis-planlari/${olusanPlan.id}/taksitler`);
      setTaksitler(data);
      vadesiGecenleriYukle();
      if (sonuc.etkilenen_taksit_sayisi > 1) {
        await ozelAlert(`${sonuc.etkilenen_taksit_sayisi} taksit birlikte geri alındı (aynı ödemeyle ilişkiliydiler).`);
      }
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni taksitli satış'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      <Kart style={{ padding: 0, marginBottom: 16 }}>
        <div style={{ padding: '14px 16px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--kenarlik)' }}>
          Tüm Taksitli Satış Planları
        </div>
        {tumPlanlar.length === 0 ? (
          <BosDurum baslik="Henüz taksitli satış planı yok" />
        ) : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Müşteri', 'Ürün(ler)', 'Başlangıç', 'Taksit Sayısı', 'Toplam Tutar', 'Ödenen', 'Kalan', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tumPlanlar.map((p) => (
                <Fragment key={p.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{p.musteri_unvan || `#${p.musteri_cari_id}`}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>
                      {(p.kalemler || []).map((k) => (
                        `${k.miktar}x ${k.urun_adi || '#' + k.stok_karti_id}${(k.seri_numaralari || []).length > 0 ? ` (${k.seri_numaralari.join(', ')})` : ''}`
                      )).join(' · ') || '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{p.baslangic_tarihi}</td>
                    <td style={{ padding: '10px 16px' }}>{p.taksit_sayisi}</td>
                    <td style={{ padding: '10px 16px' }}>{paraFormat(p.toplam_tutar, p.para_birimi)}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--yesil)' }}>{paraFormat(p.toplam_odenen, p.para_birimi)}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: Number(p.kalan_bakiye) > 0 ? 'var(--kirmizi)' : 'var(--yesil)' }}>
                      {paraFormat(p.kalan_bakiye, p.para_birimi)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <button onClick={() => planiGenisletVeyaKapat(p.id)} style={eylemChipStili('lacivert')}>
                        {genisletilmisPlanId === p.id ? 'Kapat' : 'Taksitler'}
                      </button>
                    </td>
                  </tr>
                  {genisletilmisPlanId === p.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: '12px 16px', background: 'var(--zemin)' }}>
                        {!genisPlanTaksitleri ? (
                          <div style={{ color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
                        ) : (
                          <table>
                            <thead>
                              <tr>
                                {['Taksit No', 'Vade', 'Tutar', 'Kalan Bakiye', 'Durum', ''].map((b) => (
                                  <th key={b} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {genisPlanTaksitleri.map((t) => {
                                const kalanBakiye = t.tutar - (t.odenen_tutar || 0);
                                const kismenOdendi = !t.odendi_mi && Number(t.odenen_tutar || 0) > 0;
                                return (
                                  <Fragment key={t.id}>
                                    <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                                      <td style={{ padding: '6px 10px' }}>{t.taksit_no}</td>
                                      <td style={{ padding: '6px 10px', color: 'var(--metin-ikincil)' }}>{t.vade_tarihi}</td>
                                      <td style={{ padding: '6px 10px' }}>{paraFormat(t.tutar, p.para_birimi)}</td>
                                      <td style={{ padding: '6px 10px', color: kismenOdendi ? 'var(--kirmizi)' : 'var(--metin-ikincil)' }}>
                                        {t.odendi_mi ? '—' : paraFormat(kalanBakiye, p.para_birimi)}
                                      </td>
                                      <td style={{ padding: '6px 10px' }}>
                                        <Etiket ton={t.odendi_mi ? 'yesil' : kismenOdendi ? 'amber' : 'notr'}>
                                          {t.odendi_mi ? 'Ödendi' : kismenOdendi ? 'Kısmen Ödendi' : 'Bekliyor'}
                                        </Etiket>
                                      </td>
                                      <td style={{ padding: '6px 10px' }}>
                                        {t.odendi_mi || kismenOdendi ? (
                                          <button onClick={() => genisPlanTahsilatiGeriAl(t.id, p.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                                        ) : (
                                          <button
                                            onClick={() => setOdemeAcikGenisTaksitId((mevcut) => (mevcut === t.id ? null : t.id))}
                                            style={eylemChipStili('lacivert')}
                                          >
                                            {odemeAcikGenisTaksitId === t.id ? 'Kapat' : 'Tahsil et'}
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                    {odemeAcikGenisTaksitId === t.id && (
                                      <tr>
                                        <td colSpan={6} style={{ padding: '0 10px 10px' }}>
                                          <OdemeFormu
                                            tutar={kalanBakiye}
                                            paraBirimi={p.para_birimi}
                                            aksiyonMetni="Tahsilatı tamamla"
                                            tutarDuzenlenebilir
                                            tutarEtiketi={`Tahsil edilecek tutar — kalan bakiye: ${paraFormat(kalanBakiye, p.para_birimi)}`}
                                            onOde={(secim) => genisPlanOdemeyiTamamla(t, p.id, secim)}
                                            onVazgec={() => setOdemeAcikGenisTaksitId(null)}
                                          />
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Alan etiket="Müşteri">
                <AramaliSecici secenekler={cariler} deger={form.musteri_cari_id} onDegistir={(v) => setForm((f) => ({ ...f, musteri_cari_id: v }))} etiketFn={(c) => c.unvan} />
              </Alan>
              <Alan etiket="Peşinat (TL)">
                <ParaGirdisi value={form.pesinat} onChange={(v) => setForm((f) => ({ ...f, pesinat: v }))} />
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
                        <td style={{ padding: 6, fontSize: 13, fontWeight: 500 }}>{paraFormat(satirToplam)}</td>
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
                Toplam tutar: {paraFormat(formToplamTutar)} {form.pesinat ? `(Peşinat sonrası: ${paraFormat(formToplamTutar - Number(form.pesinat || 0))})` : ''}
              </div>
            </div>
            <Buton type="submit">Plan oluştur</Buton>
          </form>
        </Kart>
      )}
      {taksitler && (
        <Kart style={{ padding: 0, marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--kenarlik)' }}>
            Plan #{olusanPlan.id} — {olusanPlan.musteri_unvan || 'Müşteri'}
            {(olusanPlan.kalemler || []).length > 0 && ` — ${olusanPlan.kalemler.map((k) => `${k.miktar}x ${k.urun_adi || '#' + k.stok_karti_id}`).join(', ')}`}
          </div>
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                {['Taksit No', 'Vade', 'Tutar', 'Kalan Bakiye', 'Durum', ''].map((b) => (
                  <th key={b} style={{ textAlign: 'left', padding: '8px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taksitler.map((t) => {
                const kalanBakiye = t.tutar - (t.odenen_tutar || 0);
                const kismenOdendi = !t.odendi_mi && Number(t.odenen_tutar || 0) > 0;
                return (
                  <Fragment key={t.id}>
                    <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                      <td style={{ padding: '8px 16px' }}>{t.taksit_no}</td>
                      <td style={{ padding: '8px 16px' }}>{tarihFormat(t.vade_tarihi)}</td>
                      <td style={{ padding: '8px 16px' }}>{paraFormat(t.tutar)}</td>
                      <td style={{ padding: '8px 16px', color: kismenOdendi ? 'var(--kirmizi)' : 'var(--metin-ikincil)' }}>
                        {t.odendi_mi ? '—' : paraFormat(kalanBakiye)}
                      </td>
                      <td style={{ padding: '8px 16px' }}>
                        <Etiket ton={t.odendi_mi ? 'yesil' : kismenOdendi ? 'amber' : 'notr'}>
                          {t.odendi_mi ? 'Tahsil Edildi' : kismenOdendi ? 'Kısmen Ödendi' : 'Bekliyor'}
                        </Etiket>
                      </td>
                      <td style={{ padding: '8px 16px' }}>
                        {t.odendi_mi ? (
                          <button onClick={() => tahsilatiGeriAl(t.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setOdemeAcikTaksitId((mevcut) => (mevcut === t.id ? null : t.id))}
                              style={eylemChipStili('lacivert')}
                            >
                              {odemeAcikTaksitId === t.id ? 'Kapat' : 'Tahsil et'}
                            </button>
                            {kismenOdendi && (
                              <button onClick={() => tahsilatiGeriAl(t.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {odemeAcikTaksitId === t.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: '0 16px 10px' }}>
                          <OdemeFormu
                            tutar={kalanBakiye}
                            paraBirimi="TRY"
                            aksiyonMetni="Tahsilatı tamamla"
                            tutarDuzenlenebilir
                            tutarEtiketi={`Tahsil edilecek tutar (TL) — kalan bakiye: ${paraFormat(kalanBakiye)}`}
                            onOde={(secim) => odemeyiTamamla(t, secim)}
                            onVazgec={() => setOdemeAcikTaksitId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Kart>
      )}
      <Kart style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--kenarlik)' }}>
          Vadesi geçen taksitler (tüm planlar)
        </div>
        <BasitTablo
          basliklar={['Müşteri', 'Ürün', 'Taksit No', 'Vade', 'Tutar']}
          satirlar={vadesiGecenler}
          render={(t) => (
            <tr key={t.id} style={{ borderTop: '1px solid var(--kenarlik)' }}>
              <td style={{ padding: '10px 16px' }}>{t.musteri_unvan || '—'}</td>
              <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{t.urun_seri_no || '—'}</td>
              <td style={{ padding: '10px 16px' }}>{t.taksit_no}</td>
              <td style={{ padding: '10px 16px', color: 'var(--kirmizi)' }}>{tarihFormat(t.vade_tarihi)}</td>
              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{paraFormat(t.tutar)}</td>
            </tr>
          )}
        />
      </Kart>
    </div>
  );
}
