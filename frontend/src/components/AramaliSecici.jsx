import { useState, useRef, useEffect } from 'react';

// Yazdikca filtrelenen aranabilir secim kutusu. Buyuk listelerde (cari,
// urun vb.) klasik <select>'in yerini alir - "oku" yazinca "Okuyan Soba"yi
// bulmak gibi. secenekler: [{id, ...}], etiketFn: (secenek) => gorunecek metin.
export default function AramaliSecici({ secenekler, deger, onDegistir, etiketFn, bosMetin = 'Seçin veya yazıp arayın...' }) {
  const [acik, setAcik] = useState(false);
  const [arama, setArama] = useState('');
  const kutuRef = useRef(null);

  useEffect(() => {
    function disariTikla(e) {
      if (kutuRef.current && !kutuRef.current.contains(e.target)) setAcik(false);
    }
    document.addEventListener('mousedown', disariTikla);
    return () => document.removeEventListener('mousedown', disariTikla);
  }, []);

  const seciliSecenek = secenekler.find((s) => String(s.id) === String(deger));
  const filtrelenmis = arama
    ? secenekler.filter((s) => etiketFn(s).toLowerCase().includes(arama.toLowerCase()))
    : secenekler;

  return (
    <div ref={kutuRef} style={{ position: 'relative' }}>
      <input
        value={acik ? arama : (seciliSecenek ? etiketFn(seciliSecenek) : '')}
        onChange={(e) => { setArama(e.target.value); setAcik(true); }}
        onFocus={() => { setArama(''); setAcik(true); }}
        placeholder={bosMetin}
        style={{
          width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--kenarlik)',
          fontSize: 13.5, boxSizing: 'border-box', background: 'white',
        }}
      />
      {acik && (
        <div style={{
          position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, background: 'white',
          border: '1px solid var(--kenarlik)', borderRadius: 8, maxHeight: 240, overflowY: 'auto',
          marginTop: 4, boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        }}>
          {filtrelenmis.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--metin-soluk)' }}>Sonuç bulunamadı</div>
          ) : (
            filtrelenmis.map((s) => (
              <div
                key={s.id}
                onMouseDown={() => { onDegistir(String(s.id)); setAcik(false); setArama(''); }}
                style={{ padding: '9px 12px', fontSize: 13.5, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--zemin)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
              >
                {etiketFn(s)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
