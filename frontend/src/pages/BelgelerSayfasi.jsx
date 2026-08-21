import { useEffect, useState } from 'react';
import { api, hataMesajiCikar } from '../api/client';
import { Kart, SayfaBasligi, HataMesaji, BosDurum, BelgeYoneticisi } from '../components/Ortak';

export default function BelgelerSayfasi() {
  const [siparisler, setSiparisler] = useState([]);
  const [stokKartlari, setStokKartlari] = useState([]);
  const [urunlerHaritasi, setUrunlerHaritasi] = useState({}); // siparis_id -> urunler[]
  const [acikSiparisId, setAcikSiparisId] = useState(null);
  const [belgeAcikUrunId, setBelgeAcikUrunId] = useState(null);
  const [hata, setHata] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    api.get('/siparisler')
      .then((r) => {
        const siralanmis = [...r.data].sort((a, b) => (b.siparis_tarihi || '').localeCompare(a.siparis_tarihi || ''));
        setSiparisler(siralanmis);
      })
      .catch((e) => setHata(hataMesajiCikar(e)))
      .finally(() => setYukleniyor(false));
    api.get('/stok-kartlari').then((r) => setStokKartlari(r.data)).catch(() => {});
  }, []);

  // Bir siparis acildiginda (her seferinde) urunlerini TAZE cekiyoruz -
  // boylece sipariste sonradan yapilan degisiklikler (urun adi/seri no
  // duzeltmesi, yeni teslim alinan urun vb.) her acilista GUNCEL gorunur,
  // eski (statik) bir kopya kalmaz.
  function siparisAcKapat(siparisId) {
    if (acikSiparisId === siparisId) {
      setAcikSiparisId(null);
      return;
    }
    setAcikSiparisId(siparisId);
    setBelgeAcikUrunId(null);
    api.get('/stok-seri-no', { params: { siparis_id: siparisId } })
      .then((r) => setUrunlerHaritasi((h) => ({ ...h, [siparisId]: r.data })))
      .catch((e) => setHata(hataMesajiCikar(e)));
  }

  function urunEtiketi(u) {
    const kart = stokKartlari.find((k) => k.id === u.stok_karti_id);
    const urunAdi = kart ? `${kart.marka || ''} ${kart.model || ''}`.trim() : '';
    return `${urunAdi ? urunAdi + ' — ' : ''}${u.seri_no}`;
  }

  return (
    <div>
      <SayfaBasligi
        baslik="Belgeler"
        aciklama="Siparişlerinize ve teslim alınmış ürünlerinize ait tüm evrakları tek yerden yönetin"
      />
      <HataMesaji>{hata}</HataMesaji>

      {yukleniyor ? (
        <div style={{ color: 'var(--metin-soluk)', padding: 20 }}>Yükleniyor...</div>
      ) : siparisler.length === 0 ? (
        <BosDurum baslik="Henüz sipariş yok" aciklama="Bir sipariş oluşturduğunuzda burada görünecek." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {siparisler.map((s) => (
            <Kart key={s.id} style={{ padding: 0 }}>
              <button
                type="button"
                onClick={() => siparisAcKapat(s.id)}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.siparis_no}</div>
                  <div style={{ fontSize: 12, color: 'var(--metin-ikincil)', marginTop: 2 }}>
                    {s.siparis_tarihi} · {s.kaynak === 'ITHALAT' ? 'İthalat' : 'Yurtiçi'} · {s.durum}
                  </div>
                </div>
                <span style={{ fontSize: 16, color: 'var(--metin-soluk)', flexShrink: 0 }}>{acikSiparisId === s.id ? '▲' : '▼'}</span>
              </button>

              {acikSiparisId === s.id && (
                <div style={{ padding: '0 18px 18px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--metin-ikincil)', marginBottom: 6 }}>
                    Siparişin genel evrakları (proforma, konişmento, gümrük beyannamesi vb.)
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <BelgeYoneticisi kaynakTablo="SIPARIS" kaynakId={s.id} />
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--metin-ikincil)', marginBottom: 6 }}>
                    Ürünler — birine tıklayıp kendi evraklarını yönetin
                  </div>
                  {!urunlerHaritasi[s.id] ? (
                    <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)' }}>Ürünler yükleniyor...</div>
                  ) : urunlerHaritasi[s.id].length === 0 ? (
                    <div style={{ fontSize: 12.5, color: 'var(--metin-soluk)' }}>Bu siparişe ait teslim alınmış ürün yok.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {urunlerHaritasi[s.id].map((u) => (
                        <div key={u.id}>
                          <button
                            type="button"
                            onClick={() => setBelgeAcikUrunId((mevcut) => (mevcut === u.id ? null : u.id))}
                            style={{
                              width: '100%', textAlign: 'left', background: 'var(--zemin)', border: '1px solid var(--kenarlik)',
                              borderRadius: 7, padding: '9px 14px', cursor: 'pointer', display: 'flex',
                              justifyContent: 'space-between', alignItems: 'center', fontSize: 13,
                            }}
                          >
                            <span>{urunEtiketi(u)}</span>
                            <span style={{ fontSize: 11.5, color: 'var(--lacivert)', fontWeight: 500 }}>
                              {belgeAcikUrunId === u.id ? 'Kapat' : 'Belge Ekle / Görüntüle'}
                            </span>
                          </button>
                          {belgeAcikUrunId === u.id && (
                            <div style={{ marginTop: 6 }}>
                              <BelgeYoneticisi kaynakTablo="STOK_SERI_NO" kaynakId={u.id} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Kart>
          ))}
        </div>
      )}
    </div>
  );
}
