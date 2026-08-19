import { useState } from 'react';
import { Kart, SayfaBasligi, Etiket } from '../components/Ortak';

// Genisletilebilir bir yapi - ileride yeni rehberler buraya YENI bir obje
// olarak eklenir, sayfanin geri kalanina DOKUNMAYA gerek kalmaz.
const REHBERLER = [
  {
    baslik: 'Bir masraf/maliyet eklerken hangi sayfayı kullanmalıyım?',
    ozet: 'Nakliye, gümrük, sigorta gibi masrafları nereden gireceğinizi belirler.',
    icerik: (
      <div>
        <div style={{ fontSize: 13, color: 'var(--metin-ikincil)', marginBottom: 16 }}>
          Kural: <strong>aynı masrafı iki yerden birden girmeyin</strong> — çift sayım olur ve ürün maliyeti
          olduğundan yüksek görünür.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ border: '1px solid var(--kenarlik)', borderRadius: 10, padding: 16 }}>
            <Etiket ton="yesil">Faturam / dekontum var</Etiket>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10, marginBottom: 8 }}>
              Tedarikçi/Hizmet Faturaları
            </div>
            <ol style={{ fontSize: 13, color: 'var(--metin-ikincil)', paddingLeft: 18, margin: 0 }}>
              <li style={{ marginBottom: 4 }}>Sol menüden "Tedarikçi Faturaları"na gidin</li>
              <li style={{ marginBottom: 4 }}>"+ Yeni Fatura" ile firmayı ve tutarı kaydedin</li>
              <li style={{ marginBottom: 4 }}>"Öde" butonuna tıklayın</li>
              <li style={{ marginBottom: 4 }}>Sipariş seçin, hangi ürün(ler)e yansısın işaretleyin</li>
              <li>Banka/kasa hesabını seçip kaydedin</li>
            </ol>
            <div style={{ fontSize: 12, color: 'var(--yesil)', marginTop: 10, fontWeight: 500 }}>
              ✓ Banka/kasadan otomatik düşer, ürüne otomatik yansır
            </div>
          </div>
          <div style={{ border: '1px solid var(--kenarlik)', borderRadius: 10, padding: 16 }}>
            <Etiket ton="amber">Faturasız / nakit / istisna</Etiket>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10, marginBottom: 8 }}>
              Manuel Maliyet Ekle
            </div>
            <ol style={{ fontSize: 13, color: 'var(--metin-ikincil)', paddingLeft: 18, margin: 0 }}>
              <li style={{ marginBottom: 4 }}>Siparişler sayfasına gidin</li>
              <li style={{ marginBottom: 4 }}>İlgili siparişi açın, bir ürüne tıklayın</li>
              <li style={{ marginBottom: 4 }}>"Maliyet Ekle" (manuel) butonuna basın</li>
              <li>Tutarı ve türünü girip kaydedin</li>
            </ol>
            <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 10, fontWeight: 500 }}>
              ⚠ Banka/kasaya dokunmaz — sadece ürünün kayıtlı maliyetini günceller
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    baslik: 'Bir ürüne bugüne kadar hangi maliyetler eklenmiş, nasıl görürüm?',
    ozet: 'Bir ürünün tam maliyet geçmişini (tarih, tür, tutar, tedarikçi) görmek için.',
    icerik: (
      <div style={{ fontSize: 13.5, color: 'var(--metin-ikincil)' }}>
        Siparişler sayfasında, "Teslim Alınmış Ürünler" tablosundaki bir ürün satırının işlem sütununda
        <strong> "Geçmiş"</strong> butonuna tıklayın. O ürüne şimdiye kadar eklenmiş tüm maliyet kalemlerinin
        (tarih, tür, tutar, tedarikçi, ödendi mi) listesini görürsünüz.
      </div>
    ),
  },
  {
    baslik: 'Bir siparişteki birden fazla ürüne aynı anda maliyet nasıl dağıtırım?',
    ozet: 'Örn. bir konteynerdeki tüm ürünlere ortak nakliye masrafını paylaştırma.',
    icerik: (
      <div style={{ fontSize: 13.5, color: 'var(--metin-ikincil)' }}>
        Siparişler sayfasının üstündeki <strong>"+ Maliyet Ekle"</strong> butonunu kullanın. Açılan pencerede
        sırasıyla: sipariş seçin, hangi ürünlere yansısın işaretleyin (veya "Tümünü seç"), tutarı ve ödeme
        kaynağını girin, son olarak dağıtım yöntemini (ürün fiyatına oranlı ya da eşit) seçip kaydedin.
        Bu akış hem ürünlere maliyeti dağıtır hem banka/kasadan tek bir çıkış kaydeder.
      </div>
    ),
  },
  {
    baslik: 'Sildiğim bir kaydı geri alabilir miyim?',
    ozet: 'Cari, Stok, Sipariş ve Finansal Takip kayıtları için geri alma penceresi.',
    icerik: (
      <div style={{ fontSize: 13.5, color: 'var(--metin-ikincil)' }}>
        Evet. Bir kayıt sildiğinizde ekranın altında 8 saniyelik bir <strong>"Geri Al"</strong> bildirimi
        çıkar — bu süre içinde tıklarsanız kayıt aynen geri gelir. Bu süre geçtikten sonra da kayıt kalıcı
        olarak silinmez (Cariler, Stok, Sipariş, Yedek Parça, Öz Mal, Çek, Leasing, POS Taksit, Bakım, Sabit
        Gider için) — sadece listede görünmez olur, gerektiğinde teknik destekle geri getirilebilir.
      </div>
    ),
  },
];

export default function YardimSayfasi() {
  const [acikIndex, setAcikIndex] = useState(0);

  return (
    <div>
      <SayfaBasligi baslik="Yardım / Nasıl Yapılır" aciklama="Sık karşılaşılan sorular ve adım adım rehberler" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {REHBERLER.map((r, i) => (
          <Kart key={i} style={{ padding: 0 }}>
            <button
              onClick={() => setAcikIndex((mevcut) => (mevcut === i ? null : i))}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--metin-birincil)' }}>{r.baslik}</div>
                <div style={{ fontSize: 12.5, color: 'var(--metin-ikincil)', marginTop: 3 }}>{r.ozet}</div>
              </div>
              <span style={{ fontSize: 18, color: 'var(--metin-soluk)', flexShrink: 0 }}>{acikIndex === i ? '▲' : '▼'}</span>
            </button>
            {acikIndex === i && (
              <div style={{ padding: '0 20px 20px' }}>{r.icerik}</div>
            )}
          </Kart>
        ))}
      </div>
    </div>
  );
}
