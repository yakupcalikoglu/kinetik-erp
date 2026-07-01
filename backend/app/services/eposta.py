"""
Resend uzerinden e-posta gonderme islemleri.
"""
import os
import resend

resend.api_key = os.getenv("RESEND_API_KEY")

GONDEREN_EPOSTA = os.getenv("GONDEREN_EPOSTA", "Kinetik ERP <onboarding@resend.dev>")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://kinetik-erp.vercel.app")


def sifre_sifirlama_epostasi_gonder(alici_email: str, token: str) -> None:
    sifirlama_linki = f"{FRONTEND_URL}/sifre-sifirla?token={token}"
    resend.Emails.send({
        "from": GONDEREN_EPOSTA,
        "to": [alici_email],
        "subject": "Kinetik ERP - Şifre Sıfırlama",
        "html": f"""
            <p>Merhaba,</p>
            <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın. Bu bağlantı 1 saat geçerlidir.</p>
            <p><a href="{sifirlama_linki}">Şifremi Sıfırla</a></p>
            <p>Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
        """,
    })
