import { useEffect, useState, Fragment } from 'react';
import { api, hataMesajiCikar, ozelOnayIste, geriAlBildirimGoster } from '../../api/client';
import {
  Kart, Buton, Etiket, Alan, girdiStili, BosDurum, HataMesaji, paraFormat, eylemChipStili,
  ParaGirdisi, useTarihGruplama, YilBasligi, AyBasligi, DahaFazlaMenu,
} from '../Ortak';
import AramaliSecici from '../AramaliSecici';
import {
  tarihFormat, useSiralama, SiraliBaslik, useCariHaritasi, useCariler, useKurlar,
  tlKarsiligiGoster, cariGoster, DovizKarsiligiGosterge, OdemeFormu,
} from './Ortak';

const CEK_DURUM_TON = { PORTFOYDE: 'amber', CIRO_EDILDI: 'notr', TAHSIL_EDILDI: 'yesil', ODENDI: 'yesil', KARSILIKSIZ: 'kirmizi', IPTAL: 'kirmizi' };
const CEK_DURUM_METIN = { PORTFOYDE: 'Portföyde', CIRO_EDILDI: 'Ciro Edildi', TAHSIL_EDILDI: 'Tahsil Edildi', ODENDI: 'Ödendi', KARSILIKSIZ: 'Karşılıksız', IPTAL: 'İptal' };

function CekDuzenleFormu({ cek, cariler, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    tip: cek.tip, cek_no: cek.cek_no || '', banka_adi: cek.banka_adi || '',
    cari_id: cek.cari_id ? String(cek.cari_id) : '', tutar: cek.tutar, para_birimi: cek.para_birimi,
    vade_tarihi: cek.vade_tarihi, alinma_verilme_tarihi: cek.alinma_verilme_tarihi, notlar: cek.notlar || '', sifre: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/cekler/${cek.id}`, {
        ...form, cari_id: form.cari_id ? Number(form.cari_id) : null, tutar: Number(form.tutar),
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
      <td colSpan={9} style={{ padding: '0 16px 12px' }}>
        <div style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8 }}>
          <form onSubmit={kaydet}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Çeki düzenle</div>
            <HataMesaji>{hata}</HataMesaji>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Alan etiket="Tip">
                <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                  <option value="ALINAN">Alınan</option>
                  <option value="VERILEN">Verilen</option>
                </select>
              </Alan>
              <Alan etiket="Çek no">
                <input value={form.cek_no} onChange={(e) => setForm((f) => ({ ...f, cek_no: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Banka">
                <input value={form.banka_adi} onChange={(e) => setForm((f) => ({ ...f, banka_adi: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Cari">
                <AramaliSecici secenekler={cariler} deger={form.cari_id} onDegistir={(v) => setForm((f) => ({ ...f, cari_id: v }))} etiketFn={(c) => c.unvan} bosMetin="Cari yok / yazarak arayın..." />
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
              <Alan etiket="Vade tarihi">
                <input required type="date" value={form.vade_tarihi} onChange={(e) => setForm((f) => ({ ...f, vade_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Alınma/verilme tarihi">
                <input required type="date" value={form.alinma_verilme_tarihi} onChange={(e) => setForm((f) => ({ ...f, alinma_verilme_tarihi: e.target.value }))} style={girdiStili} />
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

function CiroFormu({ cek, cariler, onKaydedildi, onVazgec }) {
  const [form, setForm] = useState({
    ciro_edilen_cari_id: '', ciro_tarihi: new Date().toISOString().slice(0, 10), aciklama: '',
  });
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      await api.put(`/cekler/${cek.id}/durum`, {
        yeni_durum: 'CIRO_EDILDI',
        ciro_edilen_cari_id: Number(form.ciro_edilen_cari_id),
        ciro_tarihi: form.ciro_tarihi,
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
      <td colSpan={9} style={{ padding: '0 16px 12px' }}>
        <div style={{ padding: 14, background: 'var(--zemin)', borderRadius: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{cek.cek_no || `#${cek.id}`} — Çeki Ciro Et</div>
          <HataMesaji>{hata}</HataMesaji>
          <form onSubmit={kaydet} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220 }}>
              <Alan etiket="Ciro edilecek kişi/firma (cari)">
                <AramaliSecici secenekler={cariler} deger={form.ciro_edilen_cari_id} onDegistir={(v) => setForm((f) => ({ ...f, ciro_edilen_cari_id: v }))} etiketFn={(c) => c.unvan} />
              </Alan>
            </div>
            <div style={{ minWidth: 160 }}>
              <Alan etiket="Ciro tarihi">
                <input required type="date" value={form.ciro_tarihi} onChange={(e) => setForm((f) => ({ ...f, ciro_tarihi: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <div style={{ minWidth: 200 }}>
              <Alan etiket="Açıklama (opsiyonel)">
                <input value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} style={girdiStili} />
              </Alan>
            </div>
            <Buton type="submit" disabled={kaydediliyor || !form.ciro_edilen_cari_id}>{kaydediliyor ? 'Kaydediliyor...' : 'Ciroyu Onayla'}</Buton>
            <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
          </form>
        </div>
      </td>
    </tr>
  );
}

export default function CekSekmesi() {
  const [cekler, setCekler] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({ tip: 'ALINAN', cek_no: '', banka_adi: '', cari_id: '', tutar: '', para_birimi: 'TRY', vade_tarihi: '', alinma_verilme_tarihi: '' });
  const [hata, setHata] = useState(null);
  const [odemeAcikCekId, setOdemeAcikCekId] = useState(null);
  const [duzenlenenCekId, setDuzenlenenCekId] = useState(null);
  const cariHaritasi = useCariHaritasi();
  const cariler = useCariler();
  const kurlar = useKurlar();
  const [filtreCariId, setFiltreCariId] = useState('');
  const [filtreDurum, setFiltreDurum] = useState('');
  const [filtreBaslangic, setFiltreBaslangic] = useState('');
  const [filtreBitis, setFiltreBitis] = useState('');
  const siralama = useSiralama();

  function yukle() {
    api.get('/cekler').then((r) => setCekler(r.data)).catch((e) => setHata(hataMesajiCikar(e)));
  }
  useEffect(yukle, []);

  async function kaydet(e) {
    e.preventDefault();
    setHata(null);
    try {
      await api.post('/cekler', { ...form, cari_id: form.cari_id ? Number(form.cari_id) : null, tutar: Number(form.tutar) });
      setFormAcik(false);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  const [ciroAcikCekId, setCiroAcikCekId] = useState(null);

  async function odemeyiTamamla(cek, secim) {
    await api.put(`/cekler/${cek.id}/durum`, {
      yeni_durum: cek.tip === 'ALINAN' ? 'TAHSIL_EDILDI' : 'ODENDI',
      ...secim,
    });
    setOdemeAcikCekId(null);
    yukle();
  }

  async function cekDurumunuGeriAl(cekId) {
    if (!(await ozelOnayIste('Bu çekin durumunu "Portföyde"ye geri almak istediğinize emin misiniz? Oluşan Kasa/Banka hareketi silinecek.'))) return;
    try {
      await api.put(`/cekler/${cekId}/durumu-geri-al`);
      yukle();
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  async function cekSil(cekId) {
    if (!(await ozelOnayIste('Bu çeki silmek istediğinize emin misiniz?'))) return;
    try {
      await api.delete(`/cekler/${cekId}`);
      yukle();
      geriAlBildirimGoster('Çek silindi.', async () => {
        await api.put(`/cekler/${cekId}/geri-getir`);
        yukle();
      });
    } catch (err) { setHata(hataMesajiCikar(err)); }
  }

  const gosterilecekCekler = cekler.filter((c) => {
    if (filtreCariId && String(c.cari_id) !== String(filtreCariId)) return false;
    if (filtreDurum && c.durum !== filtreDurum) return false;
    if (filtreBaslangic && c.vade_tarihi < filtreBaslangic) return false;
    if (filtreBitis && c.vade_tarihi > filtreBitis) return false;
    return true;
  });
  const siraliCekler = siralama.sirala(gosterilecekCekler, (item, alan) => (alan === '_cari_unvan' ? (cariHaritasi[item.cari_id] || '') : item[alan]));
  const cekTarihGrup = useTarihGruplama(siraliCekler, 'vade_tarihi');

  const bugun = new Date().toISOString().slice(0, 10);
  const vadesiGecenler = cekler.filter((c) => c.durum === 'PORTFOYDE' && c.vade_tarihi < bugun);

  return (
    <div>
      {vadesiGecenler.length > 0 && (
        <Kart style={{ marginBottom: 12, background: 'var(--kirmizi-acik, #fde2e2)', border: '1px solid var(--kirmizi)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--kirmizi)', marginBottom: 6 }}>
            ⚠ {vadesiGecenler.length} çekin vadesi geçmiş, henüz {vadesiGecenler.some((c) => c.tip === 'ALINAN') ? 'tahsil/ödeme' : 'ödeme'} edilmemiş:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {vadesiGecenler.map((c) => (
              <div key={c.id} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {c.cek_no || `#${c.id}`} — {c.tip === 'ALINAN' ? 'Alınan' : 'Verilen'} — {cariHaritasi[c.cari_id] || '—'}
                </span>
                <span style={{ fontWeight: 600 }}>{tarihFormat(c.vade_tarihi)} — {paraFormat(c.tutar, c.para_birimi)}</span>
              </div>
            ))}
          </div>
        </Kart>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Buton onClick={() => setFormAcik((a) => !a)}>{formAcik ? 'Kapat' : '+ Yeni çek'}</Buton>
      </div>
      <HataMesaji>{hata}</HataMesaji>

      {formAcik && (
        <Kart style={{ marginBottom: 16 }}>
          <form onSubmit={kaydet} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Alan etiket="Tip">
              <select value={form.tip} onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))} style={girdiStili}>
                <option value="ALINAN">Alınan</option>
                <option value="VERILEN">Verilen</option>
              </select>
            </Alan>
            <Alan etiket="Çek no">
              <input value={form.cek_no} onChange={(e) => setForm((f) => ({ ...f, cek_no: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Banka">
              <input value={form.banka_adi} onChange={(e) => setForm((f) => ({ ...f, banka_adi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Cari (opsiyonel)">
              <AramaliSecici secenekler={cariler} deger={form.cari_id} onDegistir={(v) => setForm((f) => ({ ...f, cari_id: v }))} etiketFn={(c) => c.unvan} />
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
            <DovizKarsiligiGosterge tutar={form.tutar} paraBirimi={form.para_birimi} />
            <Alan etiket="Vade tarihi">
              <input required type="date" value={form.vade_tarihi} onChange={(e) => setForm((f) => ({ ...f, vade_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <Alan etiket="Alınma/verilme tarihi">
              <input required type="date" value={form.alinma_verilme_tarihi} onChange={(e) => setForm((f) => ({ ...f, alinma_verilme_tarihi: e.target.value }))} style={girdiStili} />
            </Alan>
            <div style={{ alignSelf: 'end' }}><Buton type="submit">Kaydet</Buton></div>
          </form>
        </Kart>
      )}

      <Kart style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          <Alan etiket="Cariye göre filtrele">
            <AramaliSecici secenekler={cariler} deger={filtreCariId} onDegistir={setFiltreCariId} etiketFn={(c) => c.unvan} bosMetin="Tümü / yazarak arayın..." />
          </Alan>
          <Alan etiket="Duruma göre filtrele">
            <select value={filtreDurum} onChange={(e) => setFiltreDurum(e.target.value)} style={girdiStili}>
              <option value="">Tümü</option>
              <option value="PORTFOYDE">Portföyde</option>
              <option value="CIRO_EDILDI">Ciro Edildi</option>
              <option value="TAHSIL_EDILDI">Tahsil Edildi</option>
              <option value="ODENDI">Ödendi</option>
              <option value="KARSILIKSIZ">Karşılıksız</option>
            </select>
          </Alan>
          <Alan etiket="Vade başlangıcı">
            <input type="date" value={filtreBaslangic} onChange={(e) => setFiltreBaslangic(e.target.value)} style={girdiStili} />
          </Alan>
          <Alan etiket="Vade bitişi">
            <input type="date" value={filtreBitis} onChange={(e) => setFiltreBitis(e.target.value)} style={girdiStili} />
          </Alan>
        </div>
      </Kart>

      <Kart style={{ padding: 0 }}>
        {gosterilecekCekler.length === 0 ? <BosDurum baslik="Kayıt bulunamadı" /> : (
          <table>
            <thead>
              <tr style={{ background: 'var(--zemin)' }}>
                <SiraliBaslik alanAdi="cek_no" siralama={siralama}>Çek No</SiraliBaslik>
                <SiraliBaslik alanAdi="tip" siralama={siralama}>Tip</SiraliBaslik>
                <SiraliBaslik alanAdi="banka_adi" siralama={siralama}>Banka</SiraliBaslik>
                <SiraliBaslik alanAdi="_cari_unvan" siralama={siralama}>Cari</SiraliBaslik>
                <SiraliBaslik alanAdi="tutar" siralama={siralama}>Tutar</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>TL Karşılığı</th>
                <SiraliBaslik alanAdi="vade_tarihi" siralama={siralama}>Vade</SiraliBaslik>
                <SiraliBaslik alanAdi="durum" siralama={siralama}>Durum</SiraliBaslik>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {cekTarihGrup.yillar.map((yil) => (
                <Fragment key={yil}>
                  <tr>
                    <td colSpan={9} style={{ padding: 0 }}>
                      <YilBasligi
                        yil={yil}
                        kayitSayisi={Object.values(cekTarihGrup.gruplar[yil]).flat().length}
                        acik={cekTarihGrup.acikYillar.has(yil)}
                        onTikla={() => cekTarihGrup.yilAcKapat(yil)}
                      />
                    </td>
                  </tr>
                  {cekTarihGrup.acikYillar.has(yil) && Object.keys(cekTarihGrup.gruplar[yil]).sort().reverse().map((ayAnahtari) => (
                    <Fragment key={ayAnahtari}>
                      <tr>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <AyBasligi
                            ayAnahtari={ayAnahtari}
                            kayitSayisi={cekTarihGrup.gruplar[yil][ayAnahtari].length}
                            acik={cekTarihGrup.acikAylar.has(ayAnahtari)}
                            onTikla={() => cekTarihGrup.ayAcKapat(ayAnahtari)}
                          />
                        </td>
                      </tr>
                      {cekTarihGrup.acikAylar.has(ayAnahtari) && cekTarihGrup.gruplar[yil][ayAnahtari].map((c) => (
                <Fragment key={c.id}>
                  <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: '10px 16px' }}>{c.cek_no || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>{c.tip === 'ALINAN' ? 'Alınan' : 'Verilen'}</td>
                    <td style={{ padding: '10px 16px' }}>{c.banka_adi || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{cariGoster(c.cari_id, cariHaritasi)}</td>
                    <td style={{ padding: '10px 16px' }}>{paraFormat(c.tutar, c.para_birimi)}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{tlKarsiligiGoster(c.tutar, c.para_birimi, kurlar)}</td>
                    <td style={{ padding: '10px 16px' }}>{tarihFormat(c.vade_tarihi)}</td>
                    <td style={{ padding: '10px 16px' }}><Etiket ton={CEK_DURUM_TON[c.durum]}>{CEK_DURUM_METIN[c.durum]}</Etiket></td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {c.durum === 'PORTFOYDE' && (
                          <>
                            <button
                              onClick={() => setOdemeAcikCekId((mevcut) => (mevcut === c.id ? null : c.id))}
                              style={eylemChipStili('yesil')}
                            >
                              {odemeAcikCekId === c.id ? 'Kapat' : (c.tip === 'ALINAN' ? 'Tahsil et' : 'Öde')}
                            </button>
                            <DahaFazlaMenu kompakt ogeler={[
                              { etiket: 'Düzenle', onClick: () => setDuzenlenenCekId((mevcut) => (mevcut === c.id ? null : c.id)) },
                              { etiket: 'Ciro et', onClick: () => setCiroAcikCekId((mevcut) => (mevcut === c.id ? null : c.id)) },
                              { etiket: 'Sil', onClick: () => cekSil(c.id) },
                            ]} />
                          </>
                        )}
                        {(c.durum === 'TAHSIL_EDILDI' || c.durum === 'ODENDI') && (
                          <button onClick={() => cekDurumunuGeriAl(c.id)} style={eylemChipStili('kirmizi')}>Geri Al</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {duzenlenenCekId === c.id && (
                    <CekDuzenleFormu
                      cek={c}
                      cariler={cariler}
                      onKaydedildi={() => { setDuzenlenenCekId(null); yukle(); }}
                      onVazgec={() => setDuzenlenenCekId(null)}
                    />
                  )}
                  {ciroAcikCekId === c.id && (
                    <CiroFormu
                      cek={c}
                      cariler={cariler}
                      onKaydedildi={() => { setCiroAcikCekId(null); yukle(); }}
                      onVazgec={() => setCiroAcikCekId(null)}
                    />
                  )}
                  {odemeAcikCekId === c.id && (
                    <tr>
                      <td colSpan={9} style={{ padding: '0 16px 12px' }}>
                        <OdemeFormu
                          tutar={c.tutar}
                          paraBirimi={c.para_birimi}
                          aksiyonMetni={c.tip === 'ALINAN' ? 'Tahsilatı tamamla' : 'Ödemeyi tamamla'}
                          onOde={(secim) => odemeyiTamamla(c, secim)}
                          onVazgec={() => setOdemeAcikCekId(null)}
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
