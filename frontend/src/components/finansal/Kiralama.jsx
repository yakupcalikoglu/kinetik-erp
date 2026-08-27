import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar, ozelOnayIste, geriAlBildirimGoster } from '../../api/client';
import {
  Kart, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, eylemChipStili, ParaGirdisi,
} from '../Ortak';
import AramaliSecici from '../AramaliSecici';
import {
  tarihFormat, useSiralama, SiraliBaslik, useCariHaritasi, useCariler, useKurlar, tlKarsiligiGoster,
  cariGoster, useUrunTanimlari, useUrunSecenekleri, DovizKarsiligiGosterge, OdemeFormu,
} from './Ortak';

function bosKiralamaKalemi() {
  return { stok_karti_id: '', miktar: 1, birim_fiyat: '', stok_seri_no_idleri: [] };
}

function bosKiralamaFormu() {
  return {
    kiraci_cari_id: '', baslangic_tarihi: new Date().toISOString().slice(0, 10),
    bitis_tarihi: '', para_birimi: 'TRY', referans_kur: '1', depozito: '',
    kalemler: [bosKiralamaKalemi()],
  };
}

function KiralamaSonlandirmaFormu({ sozlesme, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    son_donem_tutari: '0', donem_basi: sozlesme.baslangic_tarihi || new Date().toISOString().slice(0, 10),
    donem_sonu: new Date().toISOString().slice(0, 10), odeme_yontemi: 'NAKIT', banka_hesap_id: '', aciklama: '',
  });
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
  }, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      const tutar = Number(form.son_donem_tutari || 0);
      await api.put(`/kiralama-sozlesmeleri/${sozlesme.id}/sonlandir`, {
        son_donem_tutari: tutar,
        donem_basi: form.donem_basi,
        donem_sonu: form.donem_sonu,
        odeme_yontemi: tutar > 0 ? form.odeme_yontemi : null,
        banka_hesap_id: tutar > 0 && form.odeme_yontemi === 'BANKA' ? Number(form.banka_hesap_id) : null,
        aciklama: form.aciklama || null,
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
      <td colSpan={8} style={{ padding: 0 }}>
        <div style={{ padding: 16, background: 'var(--kirmizi-acik, #fde2e2)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
            {sozlesme.sozlesme_no || `#${sozlesme.id}`} — Sözleşmeyi Sonlandır
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 10 }}>
            Ay tamamlanmadan sonlandırıyorsan, geçen günlere karşılık gelen orantılı kira bedelini burada gir —
            hem tahsilat kaydedilir hem sözleşme kapanır. Hiç ek tahsilat yoksa tutarı 0 bırakabilirsin.
          </div>
          <HataMesaji>{hata}</HataMesaji>
          <form onSubmit={kaydet} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 140 }}>
              <Alan etiket="Dönem başı">
                <input type="date" value={form.donem_basi} onChange={(e) => setForm((f) => ({ ...f, donem_basi: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <div style={{ minWidth: 140 }}>
              <Alan etiket="Dönem sonu (sonlandırma tarihi)">
                <input type="date" value={form.donem_sonu} onChange={(e) => setForm((f) => ({ ...f, donem_sonu: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <div style={{ minWidth: 160 }}>
              <Alan etiket={`Son dönem tahsilatı (${sozlesme.para_birimi}, 0 olabilir)`}>
                <ParaGirdisi value={form.son_donem_tutari} onChange={(v) => setForm((f) => ({ ...f, son_donem_tutari: v }))} />
              </Alan>
            </div>
            {Number(form.son_donem_tutari) > 0 && (
              <>
                <div style={{ minWidth: 140 }}>
                  <Alan etiket="Ödeme yöntemi">
                    <select value={form.odeme_yontemi} onChange={(e) => setForm((f) => ({ ...f, odeme_yontemi: e.target.value }))} style={girdiStili}>
                      <option value="NAKIT">Nakit (Ana Kasa)</option>
                      <option value="BANKA">Banka</option>
                    </select>
                  </Alan>
                </div>
                {form.odeme_yontemi === 'BANKA' && (
                  <div style={{ minWidth: 200 }}>
                    <Alan etiket="Banka hesabı">
                      <select required value={form.banka_hesap_id} onChange={(e) => setForm((f) => ({ ...f, banka_hesap_id: e.target.value }))} style={girdiStili}>
                        <option value="">Seçin...</option>
                        {bankaHesaplari.map((h) => <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>)}
                      </select>
                    </Alan>
                  </div>
                )}
              </>
            )}
            <div style={{ minWidth: 180 }}>
              <Alan etiket="Not (opsiyonel)">
                <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'İşleniyor...' : 'Sonlandırmayı Onayla'}</Buton>
            <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
          </form>
        </div>
      </td>
    </tr>
  );
}

export default function KiralamaSekmesi() {
  const kurlar = useKurlar();
  const siralama = useSiralama();
  const [filtreCariId, setFiltreCariId] = useState('');
  const [liste, setListe] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenSozlesme, setDuzenlenenSozlesme] = useState(null);
  const [form, setForm] = useState(bosKiralamaFormu());
  const [hata, setHata] = useState(null);
  const cariHaritasi = useCariHaritasi();
  const cariler = useCariler();
  const urunTanimlari = useUrunTanimlari();
  const tumUrunSecenekleri = useUrunSecenekleri();
  const [seciliSozlesme, setSeciliSozlesme] = useState(null);
  const [sonlandirmaAcikId, setSonlandirmaAcikId] = useState(null);
  const [odemeler, setOdemeler] = useState(null);
  const [odemeForm, setOdemeForm] = useState({ donem_basi: '', donem_sonu: '', tutar: '', aciklama: '' });
  const [odemeAcikId, setOdemeAcikId] = useState(null);

  function yukle() {
    api.get('/kiralama-sozlesmeleri').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  useEffect(() => {
    if (form.para_birimi === 'TRY') return;
    api.get(`/kur/${form.para_birimi}`).then((r) => setForm((f) => ({ ...f, referans_kur: String(r.data.kur) }))).catch(() => {});
  }, [form.para_birimi]); // eslint-disable-line

  function kalemGuncelle(i, alan, deger) {
    setForm((f) => ({ ...f, kalemler: f.kalemler.map((k, idx) => (idx === i ? { ...k, [alan]: deger } : k)) }));
  }
  function kalemEkle() {
    setForm((f) => ({ ...f, kalemler: [...f.kalemler, bosKiralamaKalemi()] }));
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
  const formAylikToplam = form.kalemler.reduce((acc, k) => acc + (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0), 0);

  function duzenlemeyeBasla(sozlesme) {
    setDuzenlenenSozlesme(sozlesme);
    setForm({
      kiraci_cari_id: String(sozlesme.kiraci_cari_id),
      baslangic_tarihi: sozlesme.baslangic_tarihi,
      bitis_tarihi: sozlesme.bitis_tarihi || '',
      para_birimi: sozlesme.para_birimi,
      referans_kur: sozlesme.referans_kur ? String(sozlesme.referans_kur) : '1',
      depozito: sozlesme.depozito || '',
      kalemler: (sozlesme.kalemler || []).length > 0
        ? sozlesme.kalemler.map((k) => ({
            stok_karti_id: String(k.stok_karti_id), miktar: k.miktar, birim_fiyat: k.birim_fiyat,
            stok_seri_no_idleri: k.stok_seri_no_idleri || [],
          }))
        : [bosKiralamaKalemi()],
      sifre: '',
    });
    setFormAcik(true);
  }

  function formuKapat() {
    setFormAcik(false);
    setDuzenlenenSozlesme(null);
    setForm(bosKiralamaFormu());
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    if (form.kalemler.some((k) => !k.stok_karti_id || !k.birim_fiyat)) {
      setHata('Lütfen her kalem için ürün ve birim fiyat girin.');
      return;
    }
    try {
      const govde = {
        kiraci_cari_id: Number(form.kiraci_cari_id),
        baslangic_tarihi: form.baslangic_tarihi,
        bitis_tarihi: form.bitis_tarihi || null,
        para_birimi: form.para_birimi,
        referans_kur: Number(form.referans_kur || 1),
        depozito: form.depozito ? Number(form.depozito) : 0,
        kalemler: form.kalemler.map((k) => ({
          stok_karti_id: Number(k.stok_karti_id), miktar: Number(k.miktar), birim_fiyat: Number(k.birim_fiyat),
          stok_seri_no_idleri: (k.stok_seri_no_idleri || []).map(Number),
        })),
      };
      if (duzenlenenSozlesme) {
        await api.put(`/kiralama-sozlesmeleri/${duzenlenenSozlesme.id}`, { ...govde, sifre: form.sifre });
      } else {
        await api.post('/kiralama-sozlesmeleri', govde);
      }
      formuKapat();
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeleriGoster(sozlesmeId) {
    try {
      const { data } = await api.get(`/kiralama-sozlesmeleri/${sozlesmeId}/odemeler`);
      setSeciliSozlesme(sozlesmeId);
      setOdemeler(data);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeEkle(e) {
    e.preventDefault();
    try {
      await api.post(`/kiralama-sozlesmeleri/${seciliSozlesme}/odemeler`, odemeForm);
      odemeleriGoster(seciliSozlesme);
      setOdemeForm({ donem_basi: '', donem_sonu: '', tutar: '', aciklama: '' });
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeyiTamamla(odeme, secim) {
    await api.put(`/kiralama-odemeleri/${odeme.id}/tahsil-et`, secim);
    setOdemeAcikId(null);
    odemeleriGoster(seciliSozlesme);
  }

  async function tahsilatiGeriAl(odemeId) {
    if (!(await ozelOnayIste('Bu tahsilatı geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.'))) return;
    try {
      await api.put(`/kiralama-odemeleri/${odemeId}/tahsilati-geri-al`);
      odemeleriGoster(seciliSozlesme);
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  const aktifSozlesme = liste.find((l) => l.id === seciliSozlesme);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => (formAcik ? formuKapat() : setFormAcik(true))}>{formAcik ? 'Kapat' : '+ Yeni kiralama'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
            {duzenlenenSozlesme ? 'Sözleşmeyi düzenle' : 'Yeni kiralama'}
          </div>
          {duzenlenenSozlesme && (
            <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 12 }}>
              Not: Bu değişiklikler geçmişte oluşturulmuş dönem ödemelerini etkilemez, sadece sözleşme bilgisini ve ileride eklenecek dönemlerin referans değerini günceller.
            </div>
          )}
          <form onSubmit={kaydet}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Alan etiket="Kiracı">
                <AramaliSecici secenekler={cariler} deger={form.kiraci_cari_id} onDegistir={(v) => setForm((f) => ({ ...f, kiraci_cari_id: v }))} etiketFn={(c) => c.unvan} />
              </Alan>
              <Alan etiket="Başlangıç tarihi">
                <input required type="date" value={form.baslangic_tarihi} onChange={(e) => setForm((f) => ({ ...f, baslangic_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Para birimi">
                <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </Alan>
              {form.para_birimi !== 'TRY' && (
                <Alan etiket={`Referans kur (${form.para_birimi} → TL) — raporlarda sabit kullanılır, elle değiştirilebilir`}>
                  <input type="number" step="0.0001" value={form.referans_kur} onChange={(e) => setForm((f) => ({ ...f, referans_kur: e.target.value }))} style={girdiStili} />
                </Alan>
              )}
              <Alan etiket="Depozito (opsiyonel)">
                <ParaGirdisi value={form.depozito} onChange={(v) => setForm((f) => ({ ...f, depozito: v }))} />
              </Alan>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ürün kalemleri (aylık kira, birden fazla ürün türü ekleyebilirsiniz)</div>
            <table style={{ width: '100%', marginBottom: 8 }}>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Ürün', 'Adet', 'Aylık Birim Fiyat', 'Satır Toplamı', ''].map((b) => (
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
                Aylık toplam: {paraFormat(formAylikToplam, form.para_birimi)}
              </div>
            </div>
            <DovizKarsiligiGosterge tutar={formAylikToplam} paraBirimi={form.para_birimi} />
            {duzenlenenSozlesme && (
              <Alan etiket="Şifreniz (onay için zorunlu)">
                <input required type="password" value={form.sifre || ''} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={{ ...girdiStili, maxWidth: 260 }} placeholder="Giriş şifreniz" />
              </Alan>
            )}
            <div style={{ marginTop: 12 }}><Buton type="submit">{duzenlenenSozlesme ? 'Değişiklikleri kaydet' : 'Kaydet'}</Buton></div>
          </form>
        </Kart>
      )}
      <Kart style={{ marginBottom: 12 }}>
        <Alan etiket="Kiracıya göre filtrele">
          <AramaliSecici secenekler={cariler} deger={filtreCariId} onDegistir={setFiltreCariId} etiketFn={(c) => c.unvan} bosMetin="Tümü / yazarak arayın..." />
        </Alan>
      </Kart>
      <Kart style={{ padding: 0, marginBottom: 16 }}>
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Ürünler</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>Sahiplik</th>
              <SiraliBaslik alanAdi="kiraci_unvan" siralama={siralama}>Kiracı</SiraliBaslik>
              <SiraliBaslik alanAdi="baslangic_tarihi" siralama={siralama}>Başlangıç</SiraliBaslik>
              <SiraliBaslik alanAdi="aylik_kira_tutari" siralama={siralama}>Aylık Kira</SiraliBaslik>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>TL Karşılığı</th>
              <SiraliBaslik alanAdi="durum" siralama={siralama}>Durum</SiraliBaslik>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }} />
            </tr>
          </thead>
          <tbody>
            {siralama.sirala(
              filtreCariId ? liste.filter((k) => String(k.kiraci_cari_id) === String(filtreCariId)) : liste,
              (item, alan) => (alan === 'kiraci_unvan' ? (item.kiraci_unvan || cariGoster(item.kiraci_cari_id, cariHaritasi)) : item[alan])
            ).map((k) => {
              const ozMalVar = (k.kalemler || []).some((kl) => kl.oz_mal_mi);
              const suresiDolmus = k.durum === 'AKTIF' && k.bitis_tarihi && k.bitis_tarihi < new Date().toISOString().slice(0, 10);
              return (
              <Fragment key={k.id}>
              <tr style={{ borderTop: '1px solid var(--kenarlik)', background: suresiDolmus ? 'var(--kirmizi-acik, #fde2e2)' : seciliSozlesme === k.id ? 'var(--zemin)' : 'transparent' }}>
                <td onClick={() => odemeleriGoster(k.id)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: 'pointer' }}>
                  {(k.kalemler || []).map((kl) => (
                    `${kl.miktar}x ${kl.urun_adi || '#' + kl.stok_karti_id}${(kl.seri_numaralari || []).length > 0 ? ` (${kl.seri_numaralari.join(', ')})` : ''}`
                  )).join(' · ') || '—'}
                  {suresiDolmus && (
                    <div style={{ fontSize: 11, color: 'var(--kirmizi)', fontWeight: 600, marginTop: 2 }}>
                      ⚠ Sözleşme süresi {tarihFormat(k.bitis_tarihi)}'de doldu — sonlandırmayı unutma
                    </div>
                  )}
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--lacivert)' }}>
                    {seciliSozlesme === k.id ? '▲ detayı gizle' : '▼ ödemeleri gör'}
                  </span>
                </td>
                <td onClick={() => odemeleriGoster(k.id)} style={{ padding: '10px 16px', cursor: 'pointer' }}>
                  <Etiket ton={ozMalVar ? 'amber' : 'notr'}>{ozMalVar ? 'Öz Mal' : 'Ticari'}</Etiket>
                </td>
                <td onClick={() => odemeleriGoster(k.id)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: 'pointer' }}>{k.kiraci_unvan || cariGoster(k.kiraci_cari_id, cariHaritasi)}</td>
                <td onClick={() => odemeleriGoster(k.id)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: 'pointer' }}>{tarihFormat(k.baslangic_tarihi)}</td>
                <td onClick={() => odemeleriGoster(k.id)} style={{ padding: '10px 16px', cursor: 'pointer' }}>{paraFormat(k.aylik_kira_tutari, k.para_birimi)}</td>
                <td onClick={() => odemeleriGoster(k.id)} style={{ padding: '10px 16px', color: 'var(--metin-ikincil)', cursor: 'pointer' }}>{tlKarsiligiGoster(k.aylik_kira_tutari, k.para_birimi, kurlar)}</td>
                <td onClick={() => odemeleriGoster(k.id)} style={{ padding: '10px 16px', cursor: 'pointer' }}>
                  {k.durum === 'AKTIF' ? (
                    <Etiket ton="yesil">Aktif</Etiket>
                  ) : (
                    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 5, fontSize: 12, fontWeight: 500, background: '#dbeafe', color: '#1d4ed8' }}>
                      Sona Erdi
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {k.durum === 'AKTIF' && (
                      <>
                        <button onClick={() => duzenlemeyeBasla(k)} style={eylemChipStili('lacivert')}>Düzenle</button>
                        <button
                          onClick={() => setSonlandirmaAcikId((mevcut) => (mevcut === k.id ? null : k.id))}
                          style={eylemChipStili('kirmizi')}
                        >
                          {sonlandirmaAcikId === k.id ? 'Kapat' : 'Sonlandır'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
              {sonlandirmaAcikId === k.id && (
                <KiralamaSonlandirmaFormu
                  sozlesme={k}
                  onKaydedildi={() => { setSonlandirmaAcikId(null); yukle(); }}
                  onVazgec={() => setSonlandirmaAcikId(null)}
                />
              )}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </Kart>
      {seciliSozlesme && (
        <Kart>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 12 }}>
            Sözleşme #{seciliSozlesme}{aktifSozlesme?.kiraci_unvan ? ` — ${aktifSozlesme.kiraci_unvan}` : ''} — kira ödemeleri
          </div>
          <form onSubmit={odemeEkle} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr auto', gap: 10, marginBottom: 14 }}>
            <Alan etiket="Dönem başı">
              <input required type="date" value={odemeForm.donem_basi} onChange={(e) => setOdemeForm((f) => ({ ...f, donem_basi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Dönem sonu">
              <input required type="date" value={odemeForm.donem_sonu} onChange={(e) => setOdemeForm((f) => ({ ...f, donem_sonu: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Tutar">
              <ParaGirdisi required value={odemeForm.tutar} onChange={(v) => setOdemeForm((f) => ({ ...f, tutar: v }))} />
            </Alan>
            <Alan etiket="Açıklama (opsiyonel)">
              <input value={odemeForm.aciklama} onChange={(e) => setOdemeForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Dönem ekle</Buton></div>
          </form>
          {odemeler && (
            odemeler.length === 0 ? <BosDurum baslik="Kayıt bulunamadı" /> : (
              <table>
                <thead>
                  <tr style={{ background: 'var(--zemin)' }}>
                    {['Dönem', 'Tutar', 'Açıklama', 'Durum', ''].map((b) => (
                      <th key={b} style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {odemeler.map((o) => (
                    <Fragment key={o.id}>
                      <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                        <td style={{ padding: '8px 0' }}>{tarihFormat(o.donem_basi)} → {tarihFormat(o.donem_sonu)}</td>
                        <td style={{ padding: '8px 0' }}>{paraFormat(o.tutar, aktifSozlesme?.para_birimi)}</td>
                        <td style={{ padding: '8px 0', color: 'var(--metin-ikincil)' }}>{o.aciklama || '—'}</td>
                        <td style={{ padding: '8px 0' }}><Etiket ton={o.odendi_mi ? 'yesil' : 'amber'}>{o.odendi_mi ? 'Tahsil Edildi' : 'Bekliyor'}</Etiket></td>
                        <td style={{ padding: '8px 0' }}>
                          {o.odendi_mi ? (
                            <button onClick={() => tahsilatiGeriAl(o.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                          ) : (
                            <button
                              onClick={() => setOdemeAcikId((mevcut) => (mevcut === o.id ? null : o.id))}
                              style={eylemChipStili('lacivert')}
                            >
                              {odemeAcikId === o.id ? 'Kapat' : 'Tahsil et'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {odemeAcikId === o.id && (
                        <tr>
                          <td colSpan={5} style={{ padding: '0 0 10px' }}>
                            <OdemeFormu
                              tutar={o.tutar}
                              paraBirimi={aktifSozlesme?.para_birimi || 'TRY'}
                              aksiyonMetni="Tahsilatı tamamla"
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
