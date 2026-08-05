"""
Uygulama giris noktasi.
Calistirmak icin: uvicorn app.main:app --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, sirketler, cari, stok, siparis, banka, finansal, diger, raporlama, yetki, akreditif, virman, harcama_turu, kaynak_detay, yedek_parca, arama, demirbas, tedarikci_fatura

app = FastAPI(
    title="Kinetik ERP API",
    version="0.1.0",
    description="İthalat ön muhasebe ve stok yönetim sistemi. Cari, stok, sipariş, "
                 "banka/kasa, çek, leasing, kiralama, bakım, personel ve raporlama "
                 "modüllerini kapsar.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "https://kinetik-erp.vercel.app",
    "https://kinetik-gp468ej7p-kinetikerp.vercel.app",
    "http://localhost:5173",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(sirketler.router)
app.include_router(cari.router)
app.include_router(stok.router)
app.include_router(siparis.router)
app.include_router(banka.router)
app.include_router(finansal.router)
app.include_router(diger.router)
app.include_router(raporlama.router)
app.include_router(yetki.router)
app.include_router(akreditif.router)
app.include_router(akreditif.dagitim_router)
app.include_router(akreditif.taksit_router)
app.include_router(akreditif.kalem_router)
app.include_router(virman.router)
app.include_router(harcama_turu.router)
app.include_router(kaynak_detay.router)
app.include_router(kaynak_detay.bekleyen_router)
app.include_router(yedek_parca.router)
app.include_router(arama.router)
app.include_router(demirbas.router)
app.include_router(tedarikci_fatura.router)


@app.get("/")
def saglik_kontrolu():
    return {"durum": "ayakta", "servis": "ithalat-erp-api"}
