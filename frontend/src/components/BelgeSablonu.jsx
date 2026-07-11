import { useState } from 'react';

function bosKalem() {
  return { aciklama: '', miktar: 1, birimFiyat: '', kdvOrani: 0 };
}

// Siparis, Proforma ve Fatura icin ortak, TAMAMEN DUZENLENEBILIR ve
// yazdirmaya hazir belge PANELI. Liste satirinin altinda ACILIR (ayri bir
// sayfaya gidilmez) - boylece veri zaten elde oldugu icin ekstra bir API
// cagrisina/ID cozumlemesine gerek kalmaz. Kullanici sirket logosunu,
// kalemleri (aciklama - orn. sasi no eklemek icin -, miktar, fiyat),
// notlari serbestce degistirebilir; toplamlar degisikliklere gore anlik
// yeniden hesaplanir. "Yazdir / PDF olarak kaydet" ile tarayicinin
// yazdirma penceresi acilir (orada "PDF olarak kaydet" secilebilir).
export default function BelgeSablonu({
  onKapat, belgeBasligi, belgeNo, tarih, sirketAdi, logoUrl,
  karsiTarafBaslik, karsiTarafAdi, ekBilgiler,
  kalemlerBaslangic, paraBirimi, fiyatGoster = true,
  notlar, notlarDegistir, notKaydediliyor, notuKaydet,
  altYazi,
}) {
  const [kalemler, setKalemler] = useState(kalemlerBaslangic);
  const [logoHata, setLogoHata] = useState(false);

  function kalemGuncelle(i, alan, deger) {
    setKalemler((liste) => liste.map((k, idx) => (idx === i ? { ...k, [alan]: deger } : k)));
  }
  function kalemEkle() {
    setKalemler((liste) => [...liste, bosKalem()]);
  }
  function kalemSil(i) {
    setKalemler((liste) => liste.filter((_, idx) => idx !== i));
  }

  const satirlar = kalemler.map((k) => {
    const satirTutar = (Number(k.miktar) || 0) * (Number(k.birimFiyat) || 0);
    const kdvTutar = satirTutar * ((Number(k.kdvOrani) || 0) / 100);
    return { ...k, satirTutar, kdvTutar };
  });
  const araToplam = satirlar.reduce((acc, s) => acc + s.satirTutar, 0);
  const kdvToplam = satirlar.reduce((acc, s) => acc + s.kdvTutar, 0);
  const genelToplam = araToplam + kdvToplam;
  const sayiFormat = (n) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div id="belge-yazdirma-alani">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #belge-yazdirma-alani, #belge-yazdirma-alani * { visibility: visible; }
          #belge-yazdirma-alani { position: absolute; left: 0; top: 0; width: 100%; }
          input, textarea { border: none !important; background: transparent !important; }
        }
        .belge-tablo { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .belge-tablo th, .belge-tablo td { border: 1px solid #ddd; padding: 6px 8px; font-size: 13px; text-align: left; }
        .belge-tablo th { background: #f5f5f5; }
        .belge-girdi { width: 100%; border: 1px solid transparent; background: transparent; font-size: 13px; font-family: inherit; padding: 2px 4px; border-radius: 4px; }
        .belge-girdi:hover, .belge-girdi:focus { border-color: #ccc; background: #fafafa; outline: none; }
        .belge-notlar { width: 100%; min-height: 90px; border: 1px solid #ccc; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; box-sizing: border-box; }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#888' }}>
          Kalemlerin/açıklamaların üzerine tıklayıp doğrudan düzenleyebilirsiniz (örn. şasi no eklemek için).
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {notuKaydet && (
            <button
              onClick={notuKaydet}
              disabled={notKaydediliyor}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #1c3d6e', background: 'white', color: '#1c3d6e', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}
            >
              {notKaydediliyor ? 'Kaydediliyor...' : 'Notu Kaydet'}
            </button>
          )}
          <button
            onClick={() => window.print()}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1c3d6e', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}
          >
            Yazdır / PDF olarak kaydet
          </button>
          {onKapat && (
            <button onClick={onKapat} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontSize: 12.5 }}>
              Kapat
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', background: 'white', padding: 40, fontFamily: 'Arial, sans-serif', color: '#1a1a1a', border: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {logoUrl && !logoHata && (
              <img
                src={logoUrl}
                alt="Logo"
                onError={() => setLogoHata(true)}
                style={{ maxHeight: 56, maxWidth: 140, objectFit: 'contain' }}
              />
            )}
            <div style={{ fontSize: 20, fontWeight: 700 }}>{sirketAdi}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{belgeBasligi}</div>
            <div style={{ fontSize: 13, color: '#555' }}>No: {belgeNo}</div>
            <div style={{ fontSize: 13, color: '#555' }}>Tarih: {tarih}</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 2 }}>{karsiTarafBaslik}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{karsiTarafAdi}</div>
        </div>

        {ekBilgiler && ekBilgiler.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16, fontSize: 13 }}>
            {ekBilgiler.map(([k, v]) => (
              <div key={k}><span style={{ color: '#777' }}>{k}:</span> {v || '—'}</div>
            ))}
          </div>
        )}

        <table className="belge-tablo">
          <thead>
            <tr>
              <th>Açıklama</th>
              <th style={{ width: 70 }}>Miktar</th>
              {fiyatGoster && <th style={{ width: 120 }}>Birim Fiyat</th>}
              {fiyatGoster && <th style={{ width: 100 }}>Tutar</th>}
              <th className="no-print" style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s, i) => (
              <tr key={i}>
                <td>
                  <input className="belge-girdi" value={s.aciklama} onChange={(e) => kalemGuncelle(i, 'aciklama', e.target.value)} placeholder="Açıklama, şasi no vb." />
                </td>
                <td>
                  <input className="belge-girdi" type="number" value={s.miktar} onChange={(e) => kalemGuncelle(i, 'miktar', e.target.value)} />
                </td>
                {fiyatGoster && (
                  <td>
                    <input className="belge-girdi" type="number" step="0.01" value={s.birimFiyat} onChange={(e) => kalemGuncelle(i, 'birimFiyat', e.target.value)} />
                  </td>
                )}
                {fiyatGoster && <td>{sayiFormat(s.satirTutar)} {paraBirimi}</td>}
                <td className="no-print">
                  <button type="button" onClick={() => kalemSil(i)} style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 12 }}>
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={kalemEkle} className="no-print" style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontSize: 12.5 }}>
          + Satır ekle
        </button>

        {fiyatGoster && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <div style={{ minWidth: 240, fontSize: 13.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>Ara Toplam</span><span>{sayiFormat(araToplam)} {paraBirimi}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>KDV</span><span>{sayiFormat(kdvToplam)} {paraBirimi}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: 700, borderTop: '1px solid #ccc' }}>
                <span>Genel Toplam</span><span>{sayiFormat(genelToplam)} {paraBirimi}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 4 }}>Notlar</div>
          <textarea
            className="belge-notlar"
            value={notlar}
            onChange={(e) => notlarDegistir(e.target.value)}
            placeholder="Ek not, şart veya açıklama ekleyin..."
          />
        </div>

        {altYazi && <div style={{ marginTop: 24, fontSize: 11, color: '#999' }}>{altYazi}</div>}
      </div>
    </div>
  );
}
