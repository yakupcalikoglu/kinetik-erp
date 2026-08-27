import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar, ozelOnayIste, geriAlBildirimGoster } from '../../api/client';
import {
  Kart, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, eylemChipStili,
  ParaGirdisi, OtomatikTamamlamaGirdisi, useTarihGruplama, YilBasligi, AyBasligi, DahaFazlaMenu,
} from '../Ortak';
import { tarihFormat, useSiralama, SiraliBaslik, useHarcamaTurleri, HarcamaTurleriPaneli, OdemeFormu } from './Ortak';

const MALIYET_TIPLERI_STOK = {
  NAKLIYE: 'Nakliye', GUMRUK: 'Gümrük', ANTREPO: 'Antrepo', MILLILESTIRME: 'Millileştirme',
  LEASING: 'Leasing', DIGER: 'Diğer',
};

function bosSabitGiderFormu() {
  return { kategori: '', donem: new Date().toISOString().slice(0, 10), tutar: '', para_birimi: 'TRY', kur: '1', aciklama: '', sifre: '' };
}

function GiderSipariseDagitPaneli({ gider, onTamam, onVazgec }) {
  const [siparisler, setSiparisler] = useState([]);
  const [siparisId, setSiparisId] = useState('');
  const [urunSayisi, setUrunSayisi] = useState(null);
  const [maliyetTipi, setMaliyetTipi] = useState('DIGER');
  const [yontem, setYontem] = useState('ESIT');
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    api.get('/siparisler').then((r) => setSiparisler(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!siparisId) { setUrunSayisi(null); return; }
    api.get('/stok-seri-no', { params: { siparis_id: siparisId } })
      .then((r) => setUrunSayisi(r.data.length))
      .catch(() => setUrunSayisi(null));
  }, [siparisId]);

  async function dagit() {
    if (!siparisId) { setHata('Lütfen bir sipariş seçin.'); return; }
    setHata(null);
    setKaydediliyor(true);
    try {
      const { data: urunler } = await api.get('/stok-seri-no', { params: { siparis_id: siparisId } });
      if (urunler.length === 0) {
        setHata('Bu siparişe ait teslim alınmış ürün bulunamadı.');
        setKaydediliyor(false);
        return;
      }
      await api.post('/stok-seri-no/toplu-maliyet-dagit', {
        stok_seri_no_idleri: urunler.map((u) => u.id),
        tip: maliyetTipi,
        aciklama: gider.kategori ? `${gider.kategori} (Diğer Giderler'den dağıtıldı)` : "Diğer Giderler'den dağıtıldı",
        para_birimi: gider.para_birimi,
        toplam_tutar: Number(gider.tutar),
        kur: Number(gider.kur),
        tarih: gider.donem,
        yontem,
      });
      onTamam();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        "{gider.kategori}" giderini ({paraFormat(gider.tutar, gider.para_birimi)}) bir siparişin ürünlerine maliyet olarak dağıt
      </div>
      <HataMesaji>{hata}</HataMesaji>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Alan etiket="Sipariş">
          <select value={siparisId} onChange={(e) => setSiparisId(e.target.value)} style={girdiStili}>
            <option value="">Seçin...</option>
            {siparisler.map((s) => <option key={s.id} value={s.id}>{s.siparis_no}</option>)}
          </select>
          {siparisId && urunSayisi != null && (
            <div style={{ fontSize: 12, color: 'var(--metin-ikincil)', marginTop: 4 }}>
              Bu siparişte teslim alınmış {urunSayisi} ürün bulundu, tutar aralarında dağıtılacak.
            </div>
          )}
        </Alan>
        <Alan etiket="Maliyet tipi">
          <select value={maliyetTipi} onChange={(e) => setMaliyetTipi(e.target.value)} style={girdiStili}>
            {Object.entries(MALIYET_TIPLERI_STOK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Alan>
        <Alan etiket="Dağıtım yöntemi">
          <select value={yontem} onChange={(e) => setYontem(e.target.value)} style={girdiStili}>
            <option value="ESIT">Eşit dağıt</option>
            <option value="AGIRLIKLI">Satınalma maliyetine göre ağırlıklı dağıt</option>
          </select>
        </Alan>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Buton onClick={dagit} disabled={kaydediliyor || !siparisId}>{kaydediliyor ? 'Dağıtılıyor...' : 'Dağıt ve Kaydet'}</Buton>
        <Buton variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
      </div>
    </div>
  );
}

export default function SabitGiderSekmesi() {
  const [liste, setListe] = useState([]);
  const siralama = useSiralama();
  const [turlerTetik, setTurlerTetik] = useState(0);
  const harcamaTurleri = useHarcamaTurleri(turlerTetik);
  const [turlerPaneliAcik, setTurlerPaneliAcik] = useState(false);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenGider, setDuzenlenenGider] = useState(null);
  const [form, setForm] = useState(bosSabitGiderFormu());
  const [hata, setHata] = useState(null);
  const [odemeAcikId, setOdemeAcikId] = useState(null);
  const [dagitimAcikId, setDagitimAcikId] = useState(null);

  function yukle() {
    api.get('/sabit-giderler').then((r) => setListe(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  useEffect(() => {
    if (form.para_birimi !== 'TRY') {
      api.get(`/kur/${form.para_birimi}`).then((r) => setForm((f) => ({ ...f, kur: String(r.data.kur) }))).catch(() => {});
    }
  }, [form.para_birimi]);

  function duzenlemeyeBasla(g) {
    setDuzenlenenGider(g);
    setForm({ kategori: g.kategori || '', donem: g.donem, tutar: String(g.tutar), para_birimi: g.para_birimi, kur: String(g.kur), aciklama: g.aciklama || '', sifre: '' });
    setFormAcik(true);
  }

  function formuKapat() {
    setFormAcik(false);
    setDuzenlenenGider(null);
    setForm(bosSabitGiderFormu());
  }

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      if (duzenlenenGider) {
        await api.put(`/sabit-giderler/${duzenlenenGider.id}`, {
          sifre: form.sifre, kategori: form.kategori, donem: form.donem,
          tutar: Number(form.tutar), para_birimi: form.para_birimi, kur: Number(form.kur), aciklama: form.aciklama,
        });
      } else {
        await api.post('/sabit-giderler', {
          kategori: form.kategori, donem: form.donem, tutar: Number(form.tutar),
          para_birimi: form.para_birimi, kur: Number(form.kur), aciklama: form.aciklama,
        });
      }
      formuKapat();
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function odemeyiTamamla(gider, secim) {
    await api.put(`/sabit-giderler/${gider.id}/ode`, secim);
    setOdemeAcikId(null);
    yukle();
  }

  async function odemeyiGeriAl(giderId) {
    if (!(await ozelOnayIste('Bu ödemeyi geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.'))) return;
    try {
      await api.put(`/sabit-giderler/${giderId}/odemeyi-geri-al`);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function sil(giderId) {
    if (!(await ozelOnayIste('Bu gider kaydını silmek istediğinize emin misiniz?'))) return;
    try {
      await api.delete(`/sabit-giderler/${giderId}`);
      yukle();
      geriAlBildirimGoster('Gider kaydı silindi.', async () => {
        await api.put(`/sabit-giderler/${giderId}/geri-getir`);
        yukle();
      });
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  const siraliSabitGiderler = siralama.sirala(liste, (item, alan) => item[alan]);
  const sabitGiderTarihGrup = useTarihGruplama(siraliSabitGiderler, 'donem');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <Buton variant="ikincil" onClick={() => setTurlerPaneliAcik((a) => !a)}>
          {turlerPaneliAcik ? 'Türleri Kapat' : 'Harcama Türlerini Yönet'}
        </Buton>
        <Buton onClick={() => (formAcik ? formuKapat() : setFormAcik(true))}>{formAcik ? 'Kapat' : '+ Yeni gider'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {turlerPaneliAcik && (
        <HarcamaTurleriPaneli
          onKapat={() => setTurlerPaneliAcik(false)}
          onDegisti={() => setTurlerTetik((t) => t + 1)}
        />
      )}

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            {duzenlenenGider ? 'Gideri düzenle' : 'Yeni gider'}
          </div>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Kategori">
              <OtomatikTamamlamaGirdisi
                value={form.kategori}
                onChange={(v) => setForm((f) => ({ ...f, kategori: v }))}
                secenekler={harcamaTurleri}
                listeId="harcama-turleri-sabit-gider-kategori"
                placeholder="Yazmaya başlayın veya listeden seçin"
              />
            </Alan>
            <Alan etiket="Dönem">
              <input required type="date" value={form.donem} onChange={(e) => setForm((f) => ({ ...f, donem: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Para birimi">
              <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Alan>
            <Alan etiket="Tutar">
              <ParaGirdisi required value={form.tutar} onChange={(v) => setForm((f) => ({ ...f, tutar: v }))} />
            </Alan>
            {form.para_birimi !== 'TRY' ? (
              <Alan etiket={`Kur (${form.para_birimi} → TL)`}>
                <input type="number" step="0.0001" value={form.kur} onChange={(e) => setForm((f) => ({ ...f, kur: e.target.value }))} style={girdiStili} />
              </Alan>
            ) : <div />}
            <Alan etiket="Açıklama">
              <OtomatikTamamlamaGirdisi
                value={form.aciklama}
                onChange={(v) => setForm((f) => ({ ...f, aciklama: v }))}
                secenekler={harcamaTurleri}
                listeId="harcama-turleri-sabit-gider"
                placeholder="Yazmaya başlayın veya listeden seçin"
              />
            </Alan>
            {duzenlenenGider && (
              <Alan etiket="Şifreniz (onay için zorunlu)">
                <input required type="password" value={form.sifre} onChange={(e) => setForm((f) => ({ ...f, sifre: e.target.value }))} style={girdiStili} placeholder="Giriş şifreniz" />
              </Alan>
            )}
            <div style={{ alignSelf: 'end' }}>
              <Buton type="submit">{duzenlenenGider ? 'Değişiklikleri kaydet' : 'Kaydet'}</Buton>
            </div>
          </form>
        </Kart>
      )}

      <Kart style={{ padding: 0 }}>
        {liste.length === 0 ? <BosDurum baslik="Kayıt bulunamadı" /> : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                <SiraliBaslik alanAdi="kategori" siralama={siralama}>Kategori</SiraliBaslik>
                <SiraliBaslik alanAdi="donem" siralama={siralama}>Dönem</SiraliBaslik>
                <SiraliBaslik alanAdi="tutar" siralama={siralama}>Tutar</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>TL Karşılığı</th>
                <SiraliBaslik alanAdi="aciklama" siralama={siralama}>Açıklama</SiraliBaslik>
                <SiraliBaslik alanAdi="odendi_mi" siralama={siralama}>Durum</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }} />
              </tr>
            </thead>
            <tbody>
              {sabitGiderTarihGrup.yillar.map((yil) => (
                <Fragment key={yil}>
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <YilBasligi
                        yil={yil}
                        kayitSayisi={Object.values(sabitGiderTarihGrup.gruplar[yil]).flat().length}
                        acik={sabitGiderTarihGrup.acikYillar.has(yil)}
                        onTikla={() => sabitGiderTarihGrup.yilAcKapat(yil)}
                      />
                    </td>
                  </tr>
                  {sabitGiderTarihGrup.acikYillar.has(yil) && Object.keys(sabitGiderTarihGrup.gruplar[yil]).sort().reverse().map((ayAnahtari) => (
                    <Fragment key={ayAnahtari}>
                      <tr>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <AyBasligi
                            ayAnahtari={ayAnahtari}
                            kayitSayisi={sabitGiderTarihGrup.gruplar[yil][ayAnahtari].length}
                            acik={sabitGiderTarihGrup.acikAylar.has(ayAnahtari)}
                            onTikla={() => sabitGiderTarihGrup.ayAcKapat(ayAnahtari)}
                          />
                        </td>
                      </tr>
                      {sabitGiderTarihGrup.acikAylar.has(ayAnahtari) && sabitGiderTarihGrup.gruplar[yil][ayAnahtari].map((g) => (
                <Fragment key={g.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)', background: odemeAcikId === g.id ? 'var(--zemin)' : 'transparent' }}>
                    <td onClick={!g.odendi_mi ? () => setOdemeAcikId((mevcut) => (mevcut === g.id ? null : g.id)) : undefined} style={{ padding: '10px 16px', fontWeight: 500, cursor: !g.odendi_mi ? 'pointer' : 'default' }}>
                      {g.kategori || '—'}
                      {!g.odendi_mi && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--lacivert)' }}>{odemeAcikId === g.id ? '▲ kapat' : '▼ öde'}</span>}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{tarihFormat(g.donem)}</td>
                    <td style={{ padding: '10px 16px' }}>{paraFormat(g.tutar, g.para_birimi)}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{g.para_birimi !== 'TRY' ? paraFormat(g.tutar_try) : '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{g.aciklama || '—'}</td>
                    <td style={{ padding: '10px 16px' }}><Etiket ton={g.odendi_mi ? 'yesil' : 'amber'}>{g.odendi_mi ? 'Ödendi' : 'Bekliyor'}</Etiket></td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {g.odendi_mi ? (
                          <button onClick={() => odemeyiGeriAl(g.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                        ) : (
                          <>
                            <button onClick={() => duzenlemeyeBasla(g)} style={eylemChipStili('lacivert')}>Düzenle</button>
                            <DahaFazlaMenu kompakt ogeler={[
                              { etiket: 'Siparişe Dağıt', onClick: () => setDagitimAcikId((mevcut) => (mevcut === g.id ? null : g.id)) },
                              { etiket: 'Sil', onClick: () => sil(g.id) },
                            ]} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {odemeAcikId === g.id && (
                    <tr>
                      <td colSpan={7} style={{ padding: '0 16px 10px' }}>
                        <OdemeFormu
                          tutar={g.tutar_try}
                          paraBirimi="TRY"
                          onOde={(secim) => odemeyiTamamla(g, secim)}
                          onVazgec={() => setOdemeAcikId(null)}
                        />
                      </td>
                    </tr>
                  )}
                  {dagitimAcikId === g.id && (
                    <tr>
                      <td colSpan={7} style={{ padding: '0 16px 10px' }}>
                        <GiderSipariseDagitPaneli
                          gider={g}
                          onTamam={() => setDagitimAcikId(null)}
                          onVazgec={() => setDagitimAcikId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Kart>
    </div>
  );
}
