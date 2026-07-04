"""
Uygulama giris noktasi.
Calistirmak icin: uvicorn app.main:app --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, sirketler, cari, stok, siparis, banka, finansal, diger, raporlama, yetki, akreditif, virman, harcama_turu

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
app.include_router(akreditif.kalem_router)
app.include_router(virman.router)

@app.get("/")
def saglik_kontrolu():
    return {"durum": "ayakta", "servis": "ithalat-erp-api"}
