import { useEffect, useState, Fragment } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, Buton, Alan, girdiStili, HataMesaji, BosDurum, Etiket, paraFormat, eylemChipStili, Sekmeler, ParaGirdisi } from '../components/Ortak';
import BelgeSablonu from '../components/BelgeSablonu';
import AramaliSecici from '../components/AramaliSecici';

const API_TABAN_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function tarihFormat(iso) {
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return iso || '—';
  const [yil, ay, gun] = iso.slice(0, 10).split('-');
  if (!yil || !ay || !gun) return iso;
  return `${gun}/${ay}/${yil}`;
}

function useSiralama() {
  const [alan, setAlan] = useState(null);
  const [yon, setYon] = useState('asc');
  function tikla(yeniAlan) {
    if (alan === yeniAlan) setYon((y) => (y === 'asc' ? 'desc' : 'asc'));
    else { setAlan(yeniAlan); setYon('asc'); }
  }
  function sirala(liste, degerFn) {
    if (!alan) return liste;
    return [...liste].sort((a, b) => {
      const av = degerFn(a, alan);
      const bv = degerFn(b, alan);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') {
        return yon === 'asc' ? av.localeCompare(bv, 'tr') : bv.localeCompare(av, 'tr');
      }
      return yon === 'asc' ? av - bv : bv - av;
    });
  }
  return { alan, yon, tikla, sirala };
}

function SiraliBaslik({ children, alanAdi, siralama, style }) {
  const aktif = siralama.alan === alanAdi;
  return (
    <th
      onClick={() => siralama.tikla(alanAdi)}
      style={{
        textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)',
        fontWeight: 500, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style,
      }}
    >
      {children} {aktif ? (siralama.yon === 'asc' ? '▲' : '▼') : ''}
    </th>
  );
}

const ODEME_TIPLERI = [
  { deger: 'PESIN_NAKIT', etiket: 'Nakit' },
  { deger: 'PESIN_HAVALE', etiket: 'Havale/EFT' },
  { deger: 'PESIN_KART', etiket: 'Kredi Kartı' },
  { deger: 'TAKSITLI', etiket: 'Taksitli' },
  { deger: 'LEASINGLI', etiket: 'Leasing' },
  { deger: 'CEK', etiket: 'Çek' },
];

function ProformaTumunuSatisaCevirFormu({ proforma, onTamamlandi, onVazgec }) {
  const kalemler = (proforma.kalemler || []).filter((k) => k.stok_karti_id);
  const [urunSecenekleriMap, setUrunSecenekleriMap] = useState({});
  const [urunSecimleri, setUrunSecimleri] = useState({});
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [odemeTipi, setOdemeTipi] = useState('PESIN_NAKIT');
  const [leasingAltTip, setLeasingAltTip] = useState('PESIN');
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [bankaHesapId, setBankaHesapId] = useState('');
  const [taksitSayisi, setTaksitSayisi] = useState(3);
  const [pesinat, setPesinat] = useState('0');
  const [cekNo, setCekNo] = useState('');
  const [cekBankaAdi, setCekBankaAdi] = useState('');
  const [cekVadeTarihi, setCekVadeTarihi] = useState('');
  const [kur, setKur] = useState('1');
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    if (proforma.para_birimi !== 'TRY') {
      api.get(`/kur/${proforma.para_birimi}`).then((r) => setKur(String(r.data.kur))).catch(() => {});
    }
    kalemler.forEach((k) => {
      Promise.all([
        api.get('/stok-seri-no', { params: { durum: 'DEPODA', stok_karti_id: k.stok_karti_id } }),
        api.get('/stok-seri-no', { params: { durum: 'ANTREPODA', stok_karti_id: k.stok_karti_id } }),
      ]).then(([a, b]) => {
        const liste = [...a.data, ...b.data];
        setUrunSecenekleriMap((f) => ({ ...f, [k.id]: liste }));
        if (liste.length === 1) setUrunSecimleri((f) => ({ ...f, [k.id]: String(liste[0].id) }));
      }).catch(() => {});
    });
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
  }, []); // eslint-disable-line

  function kalemTutariHesapla(k) {
    // Proformanin kendi para biriminde (orn. USD) kalem tutari
    return Number(k.miktar) * Number(k.birim_fiyat) * (1 + Number(k.kdv_orani) / 100);
  }
  function kalemTutariTRY(k) {
    // Stok/Taksitli Satis gibi TL bekleyen alanlar icin kur ile TL karsiligi
    return kalemTutariHesapla(k) * (Number(kur) || 1);
  }
  const genelToplam = kalemler.reduce((acc, k) => acc + kalemTutariHesapla(k), 0);
  const genelToplamTRY = kalemler.reduce((acc, k) => acc + kalemTutariTRY(k), 0);
  const leasingTaksitli = odemeTipi === 'LEASINGLI' && leasingAltTip === 'TAKSITLI';
  const taksitliBenzeri = odemeTipi === 'TAKSITLI' || leasingTaksitli;
  const bankaGerekli = odemeTipi === 'PESIN_HAVALE' || odemeTipi === 'PESIN_KART' || (odemeTipi === 'LEASINGLI' && leasingAltTip === 'PESIN');

  async function tamamla(e) {
    e.preventDefault();
    setHata(null);
    for (const k of kalemler) {
      if (!urunSecimleri[k.id]) { setHata(`"${k.aciklama}" için satılacak ürün (seri no) seçilmeli.`); return; }
    }
    if (bankaGerekli && !bankaHesapId) { setHata('Lütfen banka hesabını seçin.'); return; }
    if (odemeTipi === 'CEK' && !cekVadeTarihi) { setHata('Lütfen çekin vade tarihini girin.'); return; }

    setKaydediliyor(true);
    try {
      if (odemeTipi === 'PESIN_NAKIT' || bankaGerekli) {
        for (const k of kalemler) {
          await api.post(`/stok-seri-no/${urunSecimleri[k.id]}/satis`, {
            musteri_cari_id: proforma.cari_id, satis_fiyati_try: kalemTutariTRY(k),
            satis_tarihi: tarih, odeme_yontemi: odemeTipi === 'PESIN_NAKIT' ? 'NAKIT' : 'BANKA',
            banka_hesap_id: bankaGerekli ? Number(bankaHesapId) : null,
          });
        }
      } else if (taksitliBenzeri) {
        await api.post('/taksitli-satis-planlari', {
          musteri_cari_id: proforma.cari_id, pesinat: Number(pesinat || 0),
          taksit_sayisi: Number(taksitSayisi), baslangic_tarihi: tarih, para_birimi: 'TRY',
          kalemler: kalemler.map((k) => ({
            stok_karti_id: k.stok_karti_id, miktar: k.miktar, birim_fiyat: kalemTutariTRY(k) / k.miktar,
          })),
        });
        for (const k of kalemler) {
          await api.put(`/stok-seri-no/${urunSecimleri[k.id]}/durum`, {
            durum: 'SATILDI', musteri_cari_id: proforma.cari_id,
            satis_fiyati_try: kalemTutariTRY(k), satis_tarihi: tarih,
          });
        }
      } else if (odemeTipi === 'CEK') {
        const { data: yeniCek } = await api.post('/cekler', {
          tip: 'ALINAN', cek_no: cekNo || null, banka_adi: cekBankaAdi || null,
          cari_id: proforma.cari_id, tutar: genelToplamTRY,
          vade_tarihi: cekVadeTarihi, alinma_verilme_tarihi: tarih,
        });
        for (const k of kalemler) {
          await api.put(`/stok-seri-no/${urunSecimleri[k.id]}/durum`, {
            durum: 'SATILDI', musteri_cari_id: proforma.cari_id,
            satis_fiyati_try: kalemTutariTRY(k), satis_tarihi: tarih,
          });
          await api.put(`/stok-seri-no/${urunSecimleri[k.id]}/satis-cek-baglantisi`, { cek_id: yeniCek.id });
        }
      }

      const { data: sonrakiNo } = await api.get('/faturalar/sonraki-no');
      await api.post(`/proforma-faturalar/${proforma.id}/faturaya-cevir`, null, { params: { fatura_no: sonrakiNo.fatura_no } });

      onTamamlandi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ padding: 14, background: 'var(--zemin)', border: '1px solid var(--kenarlik)', borderRadius: 8, marginTop: 10 }}>
      <form onSubmit={tamamla}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
          Proformadaki tüm ürünleri (toplam {kalemler.length} kalem) tek işlemde satışa çevir
        </div>
        <HataMesaji>{hata}</HataMesaji>

        {kalemler.map((k) => (
          <div key={k.id} style={{ marginBottom: 10 }}>
            <Alan etiket={`${k.aciklama} (${paraFormat(kalemTutariHesapla(k), proforma.para_birimi)}) — hangi ürün (seri no)?`}>
              <select
                required
                value={urunSecimleri[k.id] || ''}
                onChange={(e) => setUrunSecimleri((f) => ({ ...f, [k.id]: e.target.value }))}
                style={girdiStili}
              >
                <option value="">Seçin...</option>
                {(urunSecenekleriMap[k.id] || []).map((u) => <option key={u.id} value={u.id}>{u.seri_no}</option>)}
              </select>
              {urunSecenekleriMap[k.id] && urunSecenekleriMap[k.id].length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--kirmizi)', marginTop: 4 }}>
                  Bu ürün tanımından Depoda/Antrepoda hazır ürün yok.
                </div>
              )}
            </Alan>
          </div>
        ))}

        {proforma.para_birimi !== 'TRY' && (
          <Alan etiket={`Kur (${proforma.para_birimi} → TL) — stok ve tahsilat kayıtları TL cinsinden tutulur`}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" step="0.0001" value={kur} onChange={(e) => setKur(e.target.value)} style={{ ...girdiStili, width: 120 }} />
              <span style={{ fontSize: 12.5, color: 'var(--metin-ikincil)' }}>
                Toplam ≈ {paraFormat(genelToplamTRY)} (TL karşılığı)
              </span>
            </div>
          </Alan>
        )}

        <div style={{ marginBottom: 6 }}>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--metin-ikincil)', marginBottom: 6 }}>
            Ödeme Türü (toplam {paraFormat(genelToplam, proforma.para_birimi)}{proforma.para_birimi !== 'TRY' ? ` ≈ ${paraFormat(genelToplamTRY)}` : ''} için)
          </span>
          <Sekmeler sekmeler={ODEME_TIPLERI} aktif={odemeTipi} onDegistir={setOdemeTipi} />
        </div>

        {odemeTipi === 'LEASINGLI' && (
          <div style={{ margin: '10px 0' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setLeasingAltTip('PESIN')}
                style={eylemChipStili(leasingAltTip === 'PESIN' ? 'lacivert' : 'notr')}>
                Peşin (banka)
              </button>
              <button type="button" onClick={() => setLeasingAltTip('TAKSITLI')}
                style={eylemChipStili(leasingAltTip === 'TAKSITLI' ? 'lacivert' : 'notr')}>
                Taksitli (biz takip edeceğiz)
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
          <Alan etiket="Tarih">
            <input required type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={girdiStili} />
          </Alan>
          {bankaGerekli && (
            <Alan etiket="Banka Hesabı">
              <select required value={bankaHesapId} onChange={(e) => setBankaHesapId(e.target.value)} style={girdiStili}>
                <option value="">Seçin...</option>
                {bankaHesaplari.map((h) => (
                  <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                ))}
              </select>
            </Alan>
          )}
          {taksitliBenzeri && (
            <>
              <Alan etiket="Peşinat (TL)">
                <ParaGirdisi value={pesinat} onChange={(v) => setPesinat(v)} />
              </Alan>
              <Alan etiket="Taksit Sayısı">
                <input required type="number" min="2" value={taksitSayisi} onChange={(e) => setTaksitSayisi(e.target.value)} style={girdiStili} />
              </Alan>
            </>
          )}
          {odemeTipi === 'CEK' && (
            <>
              <Alan etiket="Çek No">
                <input value={cekNo} onChange={(e) => setCekNo(e.target.value)} style={girdiStili} />
              </Alan>
              <Alan etiket="Çekin Bankası">
                <input value={cekBankaAdi} onChange={(e) => setCekBankaAdi(e.target.value)} style={girdiStili} />
              </Alan>
              <Alan etiket="Vade Tarihi">
                <input required type="date" value={cekVadeTarihi} onChange={(e) => setCekVadeTarihi(e.target.value)} style={girdiStili} />
              </Alan>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Tamamlanıyor...' : 'Tümünü Satışa Çevir ve Faturayı Oluştur'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </div>
  );
}

function SatisaCevirFormu({ proforma, kalem, onTamamlandi, onVazgec }) {
  const [urunler, setUrunler] = useState([]);
  const [bankaHesaplari, setBankaHesaplari] = useState([]);
  const [urunId, setUrunId] = useState('');
  const [odemeTipi, setOdemeTipi] = useState('PESIN_NAKIT');
  const [leasingAltTip, setLeasingAltTip] = useState('PESIN'); // 'PESIN' | 'TAKSITLI' - sadece odemeTipi === 'LEASINGLI' iken kullanilir
  const [tutar, setTutar] = useState(String((Number(kalem.miktar) * Number(kalem.birim_fiyat) * (1 + Number(kalem.kdv_orani) / 100)).toFixed(2)));
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [bankaHesapId, setBankaHesapId] = useState('');
  const [taksitSayisi, setTaksitSayisi] = useState(3);
  const [pesinat, setPesinat] = useState('0');
  const [cekNo, setCekNo] = useState('');
  const [cekBankaAdi, setCekBankaAdi] = useState('');
  const [cekVadeTarihi, setCekVadeTarihi] = useState('');
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    // Proforma TL disi bir para biriminde ise (orn. USD), varsayilan tutari
    // gunun kuruyla TL karsiligina cevirerek doldur - aksi halde kullanici
    // "Tutar (TL)" alaninda yanlislikla dolar rakamini TL sanabilir.
    if (proforma.para_birimi !== 'TRY') {
      api.get(`/kur/${proforma.para_birimi}`).then((r) => {
        const kur = Number(r.data.kur) || 1;
        const hamTutar = Number(kalem.miktar) * Number(kalem.birim_fiyat) * (1 + Number(kalem.kdv_orani) / 100);
        setTutar((hamTutar * kur).toFixed(2));
      }).catch(() => {});
    }
    Promise.all([
      api.get('/stok-seri-no', { params: { durum: 'DEPODA', stok_karti_id: kalem.stok_karti_id } }),
      api.get('/stok-seri-no', { params: { durum: 'ANTREPODA', stok_karti_id: kalem.stok_karti_id } }),
    ]).then(([a, b]) => {
      const liste = [...a.data, ...b.data];
      setUrunler(liste);
      if (liste.length === 1) setUrunId(String(liste[0].id));
    }).catch((e) => setHata(hataMesajiCikar(e)));
    api.get('/banka-bakiyeleri').then((r) => setBankaHesaplari(r.data)).catch(() => {});
  }, [kalem.stok_karti_id]);

  const leasingTaksitli = odemeTipi === 'LEASINGLI' && leasingAltTip === 'TAKSITLI';
  const bankaGerekli = odemeTipi === 'PESIN_HAVALE' || odemeTipi === 'PESIN_KART' || (odemeTipi === 'LEASINGLI' && leasingAltTip === 'PESIN');

  async function satisiVeFaturayiTamamla(e) {
    e.preventDefault();
    setHata(null);
    if (!urunId) { setHata('Lütfen satılacak ürünü (seri no) seçin.'); return; }
    if (!tutar || Number(tutar) <= 0) { setHata('Lütfen geçerli bir tutar girin.'); return; }

    setKaydediliyor(true);
    try {
      if (odemeTipi === 'PESIN_NAKIT') {
        await api.post(`/stok-seri-no/${urunId}/satis`, {
          musteri_cari_id: proforma.cari_id, satis_fiyati_try: Number(tutar),
          satis_tarihi: tarih, odeme_yontemi: 'NAKIT', banka_hesap_id: null,
        });
      } else if (bankaGerekli) {
        if (!bankaHesapId) { setHata('Lütfen banka hesabını seçin.'); setKaydediliyor(false); return; }
        await api.post(`/stok-seri-no/${urunId}/satis`, {
          musteri_cari_id: proforma.cari_id, satis_fiyati_try: Number(tutar),
          satis_tarihi: tarih, odeme_yontemi: 'BANKA', banka_hesap_id: Number(bankaHesapId),
        });
      } else if (odemeTipi === 'TAKSITLI' || leasingTaksitli) {
        await api.post('/taksitli-satis-planlari', {
          musteri_cari_id: proforma.cari_id, pesinat: Number(pesinat || 0),
          taksit_sayisi: Number(taksitSayisi), baslangic_tarihi: tarih, para_birimi: 'TRY',
          kalemler: [{ stok_karti_id: kalem.stok_karti_id, miktar: 1, birim_fiyat: Number(tutar) }],
        });
        await api.put(`/stok-seri-no/${urunId}/durum`, {
          durum: 'SATILDI', musteri_cari_id: proforma.cari_id,
          satis_fiyati_try: Number(tutar), satis_tarihi: tarih,
        });
      } else if (odemeTipi === 'CEK') {
        if (!cekVadeTarihi) { setHata('Lütfen çekin vade tarihini girin.'); setKaydediliyor(false); return; }
        const { data: yeniCek } = await api.post('/cekler', {
          tip: 'ALINAN', cek_no: cekNo || null, banka_adi: cekBankaAdi || null,
          cari_id: proforma.cari_id, tutar: Number(tutar),
          vade_tarihi: cekVadeTarihi, alinma_verilme_tarihi: tarih,
        });
        await api.put(`/stok-seri-no/${urunId}/durum`, {
          durum: 'SATILDI', musteri_cari_id: proforma.cari_id,
          satis_fiyati_try: Number(tutar), satis_tarihi: tarih,
        });
        await api.put(`/stok-seri-no/${urunId}/satis-cek-baglantisi`, { cek_id: yeniCek.id });
      }

      const { data: sonrakiNo } = await api.get('/faturalar/sonraki-no');
      await api.post(`/proforma-faturalar/${proforma.id}/faturaya-cevir`, null, {
        params: { fatura_no: sonrakiNo.fatura_no },
      });

      onTamamlandi();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ padding: 14, background: 'var(--zemin)', border: '1px solid var(--kenarlik)', borderRadius: 8, marginTop: 10 }}>
      <form onSubmit={satisiVeFaturayiTamamla}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
          Satışa çevir — {kalem.aciklama}
        </div>
        <HataMesaji>{hata}</HataMesaji>

        <div style={{ marginBottom: 10 }}>
          <Alan etiket="Hangi ürün (seri no)?">
            <select required value={urunId} onChange={(e) => setUrunId(e.target.value)} style={girdiStili}>
              <option value="">Seçin...</option>
              {urunler.map((u) => <option key={u.id} value={u.id}>{u.seri_no}</option>)}
            </select>
            {urunler.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--kirmizi)', marginTop: 4 }}>
                Bu ürün tanımından Depoda/Antrepoda hazır ürün yok. Önce stok girişi yapılmalı.
              </div>
            )}
          </Alan>
        </div>

        <div style={{ marginBottom: 6 }}>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--metin-ikincil)', marginBottom: 6 }}>Ödeme Türü</span>
          <Sekmeler sekmeler={ODEME_TIPLERI} aktif={odemeTipi} onDegistir={setOdemeTipi} />
        </div>

        {odemeTipi === 'LEASINGLI' && (
          <div style={{ marginBottom: 10 }}>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--metin-ikincil)', marginBottom: 6 }}>Leasing nasıl tahsil edilsin?</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setLeasingAltTip('PESIN')}
                style={{ ...eylemChipStili(leasingAltTip === 'PESIN' ? 'lacivert' : 'notr') }}>
                Peşin (banka - leasing firması tek seferde ödedi)
              </button>
              <button type="button" onClick={() => setLeasingAltTip('TAKSITLI')}
                style={{ ...eylemChipStili(leasingAltTip === 'TAKSITLI' ? 'lacivert' : 'notr') }}>
                Taksitli (biz taksitleri takip edeceğiz)
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
          <Alan etiket="Tutar (TL)">
            <ParaGirdisi required value={tutar} onChange={(v) => setTutar(v)} />
          </Alan>
          <Alan etiket="Tarih">
            <input required type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={girdiStili} />
          </Alan>
          {bankaGerekli && (
            <Alan etiket="Banka Hesabı">
              <select required value={bankaHesapId} onChange={(e) => setBankaHesapId(e.target.value)} style={girdiStili}>
                <option value="">Seçin...</option>
                {bankaHesaplari.map((h) => (
                  <option key={h.banka_hesap_id} value={h.banka_hesap_id}>{h.banka_adi} — {h.hesap_adi || h.para_birimi}</option>
                ))}
              </select>
            </Alan>
          )}
          {(odemeTipi === 'TAKSITLI' || leasingTaksitli) && (
            <>
              <Alan etiket="Peşinat (TL)">
                <ParaGirdisi value={pesinat} onChange={(v) => setPesinat(v)} />
              </Alan>
              <Alan etiket="Taksit Sayısı">
                <input required type="number" min="2" value={taksitSayisi} onChange={(e) => setTaksitSayisi(e.target.value)} style={girdiStili} />
              </Alan>
            </>
          )}
          {odemeTipi === 'CEK' && (
            <>
              <Alan etiket="Çek No">
                <input value={cekNo} onChange={(e) => setCekNo(e.target.value)} style={girdiStili} />
              </Alan>
              <Alan etiket="Çekin Bankası">
                <input value={cekBankaAdi} onChange={(e) => setCekBankaAdi(e.target.value)} style={girdiStili} />
              </Alan>
              <Alan etiket="Vade Tarihi">
                <input required type="date" value={cekVadeTarihi} onChange={(e) => setCekVadeTarihi(e.target.value)} style={girdiStili} />
              </Alan>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Tamamlanıyor...' : 'Satışı ve faturayı tamamla'}</Buton>
          <Buton type="button" variant="ikincil" onClick={onVazgec}>Vazgeç</Buton>
        </div>
      </form>
    </div>
  );
}

function bosKalem() {
  return { stok_karti_id: '', aciklama: '', miktar: 1, birim_fiyat: '', kdv_orani: 20 };
}

function useCariler() {
  const [cariler, setCariler] = useState([]);
  useEffect(() => {
    api.get('/cariler').then((r) => setCariler(r.data)).catch(() => {});
  }, []);
  return cariler;
}

function useStokKartlari() {
  const [kartlar, setKartlar] = useState([]);
  useEffect(() => {
    api.get('/stok-kartlari').then((r) => setKartlar(r.data)).catch(() => {});
  }, []);
  return kartlar;
}

const DURUM_TON = { TASLAK: 'notr', ONAYLANDI: 'amber', FATURALASTI: 'yesil' };
const DURUM_METIN = { TASLAK: 'Taslak', ONAYLANDI: 'Onaylandı', FATURALASTI: 'Faturalaştı' };

function GecmisProformalar({ cariler, yenidenYukleTetik, onGoruntule }) {
  const { oturum } = useAuth();
  const [liste, setListe] = useState([]);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [belgeAcikId, setBelgeAcikId] = useState(null);
  const [belgeNotlari, setBelgeNotlari] = useState({});
  const siralama = useSiralama();

  function yukle() {
    setYukleniyor(true);
    api.get('/proforma-faturalar')
      .then((r) => setListe(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, [yenidenYukleTetik]); // eslint-disable-line

  function cariUnvani(id) {
    const c = cariler.find((x) => x.id === id);
    return c ? c.unvan : `#${id}`;
  }

  async function sil(proforma) {
    if (!window.confirm(`${proforma.proforma_no} numaralı proformayı silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/proforma-faturalar/${proforma.id}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <Kart style={{ padding: 0, marginTop: 20 }}>
      <div style={{ padding: '14px 16px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--kenarlik)' }}>
        Geçmiş proformalar
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {yukleniyor ? (
        <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <BosDurum baslik="Henüz proforma oluşturulmadı" />
      ) : (
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              <SiraliBaslik alanAdi="proforma_no" siralama={siralama}>Proforma No</SiraliBaslik>
              <SiraliBaslik alanAdi="_cari_unvan" siralama={siralama}>Cari</SiraliBaslik>
              <SiraliBaslik alanAdi="tarih" siralama={siralama}>Tarih</SiraliBaslik>
              <SiraliBaslik alanAdi="genel_toplam" siralama={siralama}>Genel Toplam</SiraliBaslik>
              <SiraliBaslik alanAdi="durum" siralama={siralama}>Durum</SiraliBaslik>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {siralama.sirala(liste, (item, alan) => (alan === '_cari_unvan' ? cariUnvani(item.cari_id) : item[alan])).map((p) => (
              <Fragment key={p.id}>
                <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{p.proforma_no}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{cariUnvani(p.cari_id)}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{tarihFormat(p.tarih)}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{paraFormat(p.genel_toplam, p.para_birimi)}</td>
                  <td style={{ padding: '10px 16px' }}><Etiket ton={DURUM_TON[p.durum]}>{DURUM_METIN[p.durum] || p.durum}</Etiket></td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => onGoruntule(p)} style={eylemChipStili('lacivert')}>Görüntüle</button>
                      <button onClick={() => setBelgeAcikId((mevcut) => (mevcut === p.id ? null : p.id))} style={eylemChipStili('lacivert')}>
                        {belgeAcikId === p.id ? 'Belgeyi Kapat' : 'Belge / Yazdır'}
                      </button>
                      {p.durum !== 'FATURALASTI' && (
                        <button onClick={() => sil(p)} style={eylemChipStili('kirmizi')}>Sil</button>
                      )}
                    </div>
                  </td>
                </tr>
                {belgeAcikId === p.id && (
                  <tr>
                    <td colSpan={6} style={{ padding: '12px 16px', background: 'var(--zemin)' }}>
                      <BelgeSablonu
                        onKapat={() => setBelgeAcikId(null)}
                        belgeBasligi="Proforma Fatura"
                        belgeNo={p.proforma_no}
                        tarihBaslangic={p.tarih}
                        sirketAdi={oturum?.sirketler?.find((sr) => sr.id === oturum.aktifSirketId)?.unvan || ''}
                        sirketId={oturum?.aktifSirketId}
                        logoUrl={oturum?.aktifSirketId ? `${API_TABAN_URL}/sirketler/${oturum.aktifSirketId}/logo` : null}
                        karsiTarafBaslik="Müşteri"
                        karsiTarafAdiBaslangic={cariUnvani(p.cari_id)}
                        ekBilgiler={[['Durum', DURUM_METIN[p.durum] || p.durum]]}
                        kalemlerBaslangic={(p.kalemler || []).map((k) => ({
                          aciklama: k.aciklama || '', miktar: k.miktar, birimFiyat: k.birim_fiyat, kdvOrani: k.kdv_orani,
                        }))}
                        paraBirimi={p.para_birimi}
                        notlar={belgeNotlari[p.id] ?? (p.notlar || '')}
                        notlarDegistir={(v) => setBelgeNotlari((f) => ({ ...f, [p.id]: v }))}
                        notKaydediliyor={false}
                        notuKaydet={async () => {
                          try {
                            await api.put(`/proforma-faturalar/${p.id}/notlar`, { notlar: belgeNotlari[p.id] ?? (p.notlar || '') });
                          } catch (err) { setHata(hataMesajiCikar(err)); }
                        }}
                        altYazi="Bu proforma teklif niteliğindedir, resmi fatura değildir. Kalem değişiklikleri sadece bu görünüm/yazdırma içindir."
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
  );
}

function GecmisFaturalar({ cariler, yenidenYukleTetik }) {
  const { oturum } = useAuth();
  const [liste, setListe] = useState([]);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [belgeAcikId, setBelgeAcikId] = useState(null);
  const [belgeNotlari, setBelgeNotlari] = useState({});
  const siralama = useSiralama();

  function yukle() {
    setYukleniyor(true);
    api.get('/faturalar')
      .then((r) => setListe(r.data))
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
  }
  useEffect(yukle, [yenidenYukleTetik]); // eslint-disable-line

  function cariUnvani(id) {
    const c = cariler.find((x) => x.id === id);
    return c ? c.unvan : `#${id}`;
  }

  async function iptalEt(fatura) {
    if (!window.confirm(`${fatura.fatura_no} numaralı faturayı iptal etmek istediğinize emin misiniz? Bağlı proforma tekrar faturalaştırılabilir hale gelecek.`)) return;
    try {
      await api.delete(`/faturalar/${fatura.id}`);
      yukle();
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  return (
    <Kart style={{ padding: 0, marginTop: 20 }}>
      <div style={{ padding: '14px 16px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid var(--kenarlik)' }}>
        Faturalar
      </div>
      <HataMesaji>{hata}</HataMesaji>
      {yukleniyor ? (
        <div style={{ padding: 20, color: 'var(--metin-soluk)' }}>Yükleniyor...</div>
      ) : liste.length === 0 ? (
        <BosDurum baslik="Henüz fatura oluşturulmadı" />
      ) : (
        <table>
          <thead>
            <tr style={{ background: 'var(--zemin)' }}>
              <SiraliBaslik alanAdi="fatura_no" siralama={siralama}>Fatura No</SiraliBaslik>
              <SiraliBaslik alanAdi="_cari_unvan" siralama={siralama}>Cari</SiraliBaslik>
              <SiraliBaslik alanAdi="tarih" siralama={siralama}>Tarih</SiraliBaslik>
              <SiraliBaslik alanAdi="genel_toplam" siralama={siralama}>Genel Toplam</SiraliBaslik>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--metin-ikincil)', fontWeight: 500 }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {siralama.sirala(liste, (item, alan) => (alan === '_cari_unvan' ? cariUnvani(item.cari_id) : item[alan])).map((f) => (
              <Fragment key={f.id}>
                <tr style={{ borderTop: '1px solid var(--kenarlik)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{f.fatura_no}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{cariUnvani(f.cari_id)}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--metin-ikincil)' }}>{tarihFormat(f.tarih)}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{paraFormat(f.genel_toplam, f.para_birimi)}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setBelgeAcikId((mevcut) => (mevcut === f.id ? null : f.id))} style={eylemChipStili('lacivert')}>
                        {belgeAcikId === f.id ? 'Belgeyi Kapat' : 'Belge / Yazdır'}
                      </button>
                      <button onClick={() => iptalEt(f)} style={eylemChipStili('kirmizi')}>İptal Et</button>
                    </div>
                  </td>
                </tr>
                {belgeAcikId === f.id && (
                  <tr>
                    <td colSpan={5} style={{ padding: '12px 16px', background: 'var(--zemin)' }}>
                      <BelgeSablonu
                        onKapat={() => setBelgeAcikId(null)}
                        belgeBasligi="Fatura"
                        belgeNo={f.fatura_no}
                        tarihBaslangic={f.tarih}
                        sirketAdi={oturum?.sirketler?.find((sr) => sr.id === oturum.aktifSirketId)?.unvan || ''}
                        sirketId={oturum?.aktifSirketId}
                        logoUrl={oturum?.aktifSirketId ? `${API_TABAN_URL}/sirketler/${oturum.aktifSirketId}/logo` : null}
                        karsiTarafBaslik="Müşteri"
                        karsiTarafAdiBaslangic={cariUnvani(f.cari_id)}
                        ekBilgiler={[['Ödeme durumu', f.odeme_durumu === 'ODENDI' ? 'Ödendi' : 'Ödenmedi']]}
                        kalemlerBaslangic={(f.kalemler || []).map((k) => ({
                          aciklama: k.aciklama || '', miktar: k.miktar, birimFiyat: k.birim_fiyat, kdvOrani: k.kdv_orani,
                        }))}
                        paraBirimi={f.para_birimi}
                        notlar={belgeNotlari[f.id] ?? (f.notlar || '')}
                        notlarDegistir={(v) => setBelgeNotlari((s) => ({ ...s, [f.id]: v }))}
                        notKaydediliyor={false}
                        notuKaydet={async () => {
                          try {
                            await api.put(`/faturalar/${f.id}/notlar`, { notlar: belgeNotlari[f.id] ?? (f.notlar || '') });
                          } catch (err) { setHata(hataMesajiCikar(err)); }
                        }}
                        altYazi="Kalem değişiklikleri sadece bu görünüm/yazdırma içindir."
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
  );
}

export default function ProformaFaturaSayfasi() {
  const cariler = useCariler();
  const stokKartlari = useStokKartlari();
  const [form, setForm] = useState({
    proforma_no: '', cari_id: '', tarih: new Date().toISOString().slice(0, 10), para_birimi: 'TRY', notlar: '',
  });
  const [kalemler, setKalemler] = useState([bosKalem()]);

  useEffect(() => {
    api.get('/proforma-faturalar/sonraki-no')
      .then((r) => setForm((f) => (f.proforma_no ? f : { ...f, proforma_no: r.data.proforma_no })))
      .catch(() => {});
  }, []);
  const [olusanProforma, setOlusanProforma] = useState(null);
  const [faturaNo, setFaturaNo] = useState('');
  const [olusanFatura, setOlusanFatura] = useState(null);
  const [hata, setHata] = useState(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [gecmisYenidenYukleTetik, setGecmisYenidenYukleTetik] = useState(0);
  const [satisaCevirAcikKalemId, setSatisaCevirAcikKalemId] = useState(null);

  function kalemGuncelle(i, alan, deger) {
    if (alan === 'stok_karti_id' && deger) {
      const kart = stokKartlari.find((s) => String(s.id) === String(deger));
      // Bu urun modelinin standart alt metni varsa, Notlar'a otomatik
      // onerelim (zaten eklenmemisse) - kullanici sonradan duzenleyebilir/silebilir.
      if (kart && kart.standart_alt_metin) {
        setForm((f) => {
          const mevcutSatirlar = (f.notlar || '').split('\n').filter(Boolean);
          if (mevcutSatirlar.includes(kart.standart_alt_metin)) return f;
          return { ...f, notlar: [...mevcutSatirlar, kart.standart_alt_metin].join('\n') };
        });
      }
    }
    setKalemler((liste) => liste.map((k, idx) => {
      if (idx !== i) return k;
      if (alan === 'stok_karti_id' && deger) {
        const kart = stokKartlari.find((s) => String(s.id) === String(deger));
        return {
          ...k,
          stok_karti_id: deger,
          aciklama: kart ? `${kart.marka} ${kart.model}` : k.aciklama,
        };
      }
      return { ...k, [alan]: deger };
    }));
  }

  const araToplam = kalemler.reduce((acc, k) => acc + (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0), 0);
  const kdvToplam = kalemler.reduce((acc, k) => acc + (Number(k.miktar) || 0) * (Number(k.birim_fiyat) || 0) * ((Number(k.kdv_orani) || 0) / 100), 0);

  async function proformaOlustur(e) {
    e.preventDefault();
    setHata(null);
    setKaydediliyor(true);
    try {
      const { data } = await api.post('/proforma-faturalar', {
        ...form,
        cari_id: Number(form.cari_id),
        kalemler: kalemler.map((k) => ({
          stok_karti_id: k.stok_karti_id ? Number(k.stok_karti_id) : null,
          aciklama: k.aciklama, miktar: Number(k.miktar), birim_fiyat: Number(k.birim_fiyat), kdv_orani: Number(k.kdv_orani),
        })),
      });
      setOlusanProforma(data);
      setGecmisYenidenYukleTetik((t) => t + 1);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    } finally {
      setKaydediliyor(false);
    }
  }

  async function faturayaCevir() {
    if (!faturaNo.trim()) {
      setHata('Fatura numarası girin.');
      return;
    }
    setHata(null);
    try {
      const { data } = await api.post(`/proforma-faturalar/${olusanProforma.id}/faturaya-cevir`, null, {
        params: { fatura_no: faturaNo },
      });
      setOlusanFatura(data);
      setOlusanProforma((p) => ({ ...p, durum: 'FATURALASTI' }));
      setGecmisYenidenYukleTetik((t) => t + 1);
    } catch (err) {
      setHata(hataMesajiCikar(err));
    }
  }

  function yeniProformaBaslat() {
    setOlusanProforma(null);
    setOlusanFatura(null);
    setFaturaNo('');
    setForm({ proforma_no: '', cari_id: '', tarih: new Date().toISOString().slice(0, 10), para_birimi: 'TRY', notlar: '' });
    setKalemler([bosKalem()]);
    api.get('/proforma-faturalar/sonraki-no')
      .then((r) => setForm((f) => ({ ...f, proforma_no: r.data.proforma_no })))
      .catch(() => {});
  }

  function gecmistenGoruntule(proforma) {
    setOlusanProforma(proforma);
    setOlusanFatura(null);
    setFaturaNo('');
  }

  return (
    <div>
      <SayfaBasligi baslik="Proforma / Fatura" aciklama="Proforma fatura oluştur, onaylandığında normal faturaya çevir" />
      <HataMesaji>{hata}</HataMesaji>

      {!olusanProforma ? (
        <form onSubmit={proformaOlustur}>
          <Kart style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <Alan etiket="Proforma no">
                <input required value={form.proforma_no} onChange={(e) => setForm((f) => ({ ...f, proforma_no: e.target.value }))}
                  placeholder="PRF-2026-001" style={girdiStili} />
              </Alan>
              <Alan etiket="Cari">
                <AramaliSecici secenekler={cariler} deger={form.cari_id} onDegistir={(v) => setForm((f) => ({ ...f, cari_id: v }))} etiketFn={(c) => c.unvan} />
              </Alan>
              <Alan etiket="Tarih">
                <input required type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} style={girdiStili} />
              </Alan>
              <Alan etiket="Para birimi">
                <select value={form.para_birimi} onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value }))} style={girdiStili}>
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </Alan>
            </div>
          </Kart>

          <Kart style={{ marginBottom: 16, padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--kenarlik)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: 14.5 }}>Kalemler</span>
              <Buton type="button" variant="ikincil" onClick={() => setKalemler((l) => [...l, bosKalem()])}>+ Kalem ekle</Buton>
            </div>
            <table>
              <thead>
                <tr style={{ background: 'var(--zemin)' }}>
                  {['Ürün (opsiyonel)', 'Açıklama', 'Miktar', 'Birim Fiyat', 'KDV %', ''].map((b) => (
                    <th key={b} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--metin-ikincil)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kalemler.map((k, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--kenarlik)' }}>
                    <td style={{ padding: 8 }}>
                      <select value={k.stok_karti_id} onChange={(e) => kalemGuncelle(i, 'stok_karti_id', e.target.value)} style={{ ...girdiStili, width: 320 }}>
                        <option value="">Seçin (ya da elle yazın)...</option>
                        {stokKartlari.map((s) => <option key={s.id} value={s.id}>{s.marka} {s.model}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 8 }}>
                      <input required value={k.aciklama} onChange={(e) => kalemGuncelle(i, 'aciklama', e.target.value)} style={{ ...girdiStili, width: 220 }} />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input type="number" min="1" value={k.miktar} onChange={(e) => kalemGuncelle(i, 'miktar', e.target.value)} style={{ ...girdiStili, width: 70 }} />
                    </td>
                    <td style={{ padding: 8 }}>
                      <ParaGirdisi required value={k.birim_fiyat} onChange={(v) => kalemGuncelle(i, 'birim_fiyat', v)} style={{ width: 130 }} />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input type="number" value={k.kdv_orani} onChange={(e) => kalemGuncelle(i, 'kdv_orani', e.target.value)} style={{ ...girdiStili, width: 70 }} />
                    </td>
                    <td style={{ padding: 8 }}>
                      {kalemler.length > 1 && (
                        <button type="button" onClick={() => setKalemler((l) => l.filter((_, idx) => idx !== i))} style={eylemChipStili('kirmizi')}>Sil</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--kenarlik)', textAlign: 'right', fontSize: 13.5 }}>
              <div>Ara toplam: {araToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.para_birimi}</div>
              <div>KDV: {kdvToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.para_birimi}</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Genel toplam: {(araToplam + kdvToplam).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {form.para_birimi}</div>
            </div>
          </Kart>

          <Buton type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Oluşturuluyor...' : 'Proforma oluştur'}</Buton>
        </form>
      ) : (
        <Kart>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>
              Proforma: {olusanProforma.proforma_no}
            </div>
            <Buton variant="ikincil" onClick={yeniProformaBaslat}>+ Yeni proforma</Buton>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--metin-ikincil)', marginBottom: 16 }}>
            Genel toplam: <strong>{Number(olusanProforma.genel_toplam).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {olusanProforma.para_birimi}</strong>
            {' '}— Durum: {DURUM_METIN[olusanProforma.durum] || olusanProforma.durum}
          </div>

          {olusanProforma.durum !== 'FATURALASTI' && !olusanFatura && (
            <>
              {(olusanProforma.kalemler || []).filter((k) => k.stok_karti_id).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    Anlaşma netleşti mi? İki şekilde satışa çevirebilirsiniz:
                  </div>

                  {(olusanProforma.kalemler || []).filter((k) => k.stok_karti_id).length > 1 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 6 }}>
                        Seçenek 1 — Tüm ürünleri birlikte, tek ödeme türüyle satışa çevir:
                      </div>
                      <button
                        onClick={() => setSatisaCevirAcikKalemId((mevcut) => (mevcut === 'TUMU' ? null : 'TUMU'))}
                        style={eylemChipStili('yesil')}
                      >
                        {satisaCevirAcikKalemId === 'TUMU' ? 'Kapat' : 'Tümünü Satışa Çevir'}
                      </button>
                      {satisaCevirAcikKalemId === 'TUMU' && (
                        <ProformaTumunuSatisaCevirFormu
                          proforma={olusanProforma}
                          onTamamlandi={() => {
                            setSatisaCevirAcikKalemId(null);
                            setOlusanProforma((p) => ({ ...p, durum: 'FATURALASTI' }));
                            setGecmisYenidenYukleTetik((t) => t + 1);
                          }}
                          onVazgec={() => setSatisaCevirAcikKalemId(null)}
                        />
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginBottom: 6 }}>
                    Seçenek 2 — Her ürünü ayrı ayrı, farklı ödeme türleriyle satışa çevir:
                  </div>
                  {olusanProforma.kalemler.filter((k) => k.stok_karti_id).map((k) => (
                    <div key={k.id} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--kenarlik)', borderRadius: 8 }}>
                        <div style={{ fontSize: 13 }}>{k.aciklama} — {paraFormat(k.miktar * k.birim_fiyat, olusanProforma.para_birimi)}</div>
                        <button
                          onClick={() => setSatisaCevirAcikKalemId((mevcut) => (mevcut === k.id ? null : k.id))}
                          style={eylemChipStili('lacivert')}
                        >
                          {satisaCevirAcikKalemId === k.id ? 'Kapat' : 'Bu Ürünü Satışa Çevir'}
                        </button>
                      </div>
                      {satisaCevirAcikKalemId === k.id && (
                        <SatisaCevirFormu
                          proforma={olusanProforma}
                          kalem={k}
                          onTamamlandi={() => {
                            setSatisaCevirAcikKalemId(null);
                            setOlusanProforma((p) => ({ ...p, durum: 'FATURALASTI' }));
                            setGecmisYenidenYukleTetik((t) => t + 1);
                          }}
                          onVazgec={() => setSatisaCevirAcikKalemId(null)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1, maxWidth: 240 }}>
                  <Alan etiket="Ya da manuel: Fatura no">
                    <input value={faturaNo} onChange={(e) => setFaturaNo(e.target.value)} placeholder="FT-2026-001" style={girdiStili} />
                  </Alan>
                </div>
                <Buton onClick={faturayaCevir} style={{ marginBottom: 14 }}>Faturaya çevir</Buton>
              </div>
            </>
          )}
          {olusanFatura && (
            <div style={{ background: 'var(--yesil-acik)', color: 'var(--yesil)', padding: '12px 16px', borderRadius: 8, fontSize: 13.5 }}>
              Fatura oluşturuldu: <strong>{olusanFatura.fatura_no}</strong>
            </div>
          )}
          {olusanProforma.durum === 'FATURALASTI' && !olusanFatura && (
            <div style={{ fontSize: 13, color: 'var(--metin-soluk)' }}>Bu proforma zaten faturalaştırılmış.</div>
          )}
        </Kart>
      )}

      <GecmisProformalar cariler={cariler} yenidenYukleTetik={gecmisYenidenYukleTetik} onGoruntule={gecmistenGoruntule} />
      <GecmisFaturalar cariler={cariler} yenidenYukleTetik={gecmisYenidenYukleTetik} />
    </div>
  );
}
