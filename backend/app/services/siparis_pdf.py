# -*- coding: utf-8 -*-
"""
Siparis PDF uretim servisi. Daha once hazirlanan siparis_formu_olustur.py
scriptinin mantigini, gercek veritabani kayitlarindan calisacak sekilde
buraya tasiyoruz. Router bu modulun build_pdf() fonksiyonunu cagirir.
"""
import os
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle, Paragraph,
                                 Spacer, HRFlowable)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_FONT_KAYITLI = False


def _fontlari_kaydet():
    global _FONT_KAYITLI
    if _FONT_KAYITLI:
        return
    yol = "/usr/share/fonts/truetype/dejavu"
    pdfmetrics.registerFont(TTFont('DejaVu', f'{yol}/DejaVuSans.ttf'))
    pdfmetrics.registerFont(TTFont('DejaVu-Bold', f'{yol}/DejaVuSans-Bold.ttf'))
    _FONT_KAYITLI = True


LACIVERT = colors.HexColor("#1B2A4A")
GRI = colors.HexColor("#F2F3F5")
KOYU_GRI = colors.HexColor("#5A5F6A")
CIZGI_GRI = colors.HexColor("#D7DAE0")


def build_pdf(siparis: dict, ic_kullanim: bool = True) -> bytes:
    """
    siparis sozlugu sunlari icermeli:
    sirket_unvan, sirket_adres, sirket_tel, sirket_email, sirket_vergi_no,
    siparis_no, siparis_tarihi, kaynak, durum,
    tedarikci_unvan, tedarikci_vergi_no, tedarikci_adres, tedarikci_tel,
    cikis_limani, varis_limani, para_birimi,
    urunler: [{marka_model, seri_no, miktar, birim_fiyat, birim_agirlik_kg}],
    notlar
    """
    _fontlari_kaydet()
    styles = getSampleStyleSheet()
    styles['Normal'].fontName = 'DejaVu'

    style_baslik = ParagraphStyle('baslik', parent=styles['Heading1'], fontSize=18,
                                   textColor=LACIVERT, alignment=TA_RIGHT, fontName='DejaVu-Bold')
    style_alt_baslik = ParagraphStyle('alt_baslik', parent=styles['Normal'], fontSize=9,
                                       textColor=KOYU_GRI, alignment=TA_RIGHT, fontName='DejaVu')
    style_sirket = ParagraphStyle('sirket', parent=styles['Normal'], fontSize=10,
                                   textColor=LACIVERT, leading=14, fontName='DejaVu')
    style_section = ParagraphStyle('section', parent=styles['Normal'], fontSize=10,
                                    textColor=colors.white, fontName='DejaVu-Bold')
    style_label = ParagraphStyle('label', parent=styles['Normal'], fontSize=8,
                                  textColor=KOYU_GRI, fontName='DejaVu')
    style_value = ParagraphStyle('value', parent=styles['Normal'], fontSize=10,
                                  textColor=colors.black, fontName='DejaVu-Bold')
    style_hucre = ParagraphStyle('hucre', parent=styles['Normal'], fontSize=8.5,
                                  fontName='DejaVu', leading=10)
    style_notlar = ParagraphStyle('notlar', parent=styles['Normal'], fontSize=9,
                                   textColor=colors.black, leading=13, fontName='DejaVu')

    def alan(label, deger):
        return [Paragraph(label.upper(), style_label), Paragraph(str(deger or '-'), style_value)]

    def section_baslik(text):
        t = Table([[Paragraph(text, style_section)]], colWidths=[170 * mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LACIVERT),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        return t

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=15 * mm, bottomMargin=15 * mm,
                             leftMargin=20 * mm, rightMargin=20 * mm)
    story = []

    sirket_html = (
        f"<b>{siparis['sirket_unvan']}</b><br/>{siparis.get('sirket_adres') or ''}<br/>"
        f"Tel: {siparis.get('sirket_tel') or '-'} &nbsp;|&nbsp; {siparis.get('sirket_email') or ''}<br/>"
        f"Vergi No: {siparis.get('sirket_vergi_no') or '-'}"
    )
    nusha_etiketi = "ŞİRKET İÇİ NÜSHA — Maliyet Detayı Dahil" if ic_kullanim else "TEDARİKÇİ NÜSHASI"
    baslik_cell = [
        Paragraph("SİPARİŞ FORMU", style_baslik), Spacer(1, 4),
        Paragraph(f"Sipariş No: <b>{siparis['siparis_no']}</b>", style_alt_baslik),
        Paragraph(f"Tarih: {siparis['siparis_tarihi']}", style_alt_baslik),
        Paragraph(f"Tür: {siparis['kaynak']}", style_alt_baslik),
        Paragraph(f"Durum: {siparis['durum']}", style_alt_baslik),
        Spacer(1, 3), Paragraph(f"<i>{nusha_etiketi}</i>", style_alt_baslik),
    ]
    header_table = Table([[[Paragraph(sirket_html, style_sirket)], baslik_cell]], colWidths=[100 * mm, 70 * mm])
    header_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    story.append(header_table)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.2, color=LACIVERT))
    story.append(Spacer(1, 10))

    story.append(section_baslik("TEDARİKÇİ / SATICI BİLGİLERİ"))
    story.append(Spacer(1, 4))
    tedarikci_rows = [
        [alan("Unvan", siparis.get('tedarikci_unvan')), alan("Vergi No", siparis.get('tedarikci_vergi_no'))],
        [alan("Adres", siparis.get('tedarikci_adres')), alan("Telefon", siparis.get('tedarikci_tel'))],
    ]
    t = Table(tedarikci_rows, colWidths=[85 * mm, 85 * mm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'DejaVu'),
        ('BACKGROUND', (0, 0), (-1, -1), GRI), ('BOX', (0, 0), (-1, -1), 0.5, CIZGI_GRI),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, CIZGI_GRI),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))

    if siparis.get('kaynak') == 'İTHALAT':
        story.append(section_baslik("SEVKİYAT BİLGİLERİ"))
        story.append(Spacer(1, 4))
        sevk_rows = [[alan("Çıkış Limanı", siparis.get('cikis_limani')), alan("Varış Limanı", siparis.get('varis_limani'))]]
        t = Table(sevk_rows, colWidths=[85 * mm, 85 * mm])
        t.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'DejaVu'),
            ('BOX', (0, 0), (-1, -1), 0.5, CIZGI_GRI), ('INNERGRID', (0, 0), (-1, -1), 0.5, CIZGI_GRI),
            ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(t)
        story.append(Spacer(1, 12))

    story.append(section_baslik("SİPARİŞ EDİLEN ÜRÜNLER"))
    story.append(Spacer(1, 4))
    urun_basliklar = ["#", "Marka / Model", "Şasi / Seri No", "Miktar", "Birim Fiyat", "Toplam"]
    urun_data = [urun_basliklar]
    for i, u in enumerate(siparis['urunler'], 1):
        urun_data.append([
            str(i), Paragraph(u.get('marka_model') or '-', style_hucre), u.get('seri_no') or '-',
            str(u['miktar']), f"{u['birim_fiyat']:,.2f} {siparis['para_birimi']}",
            f"{u['miktar'] * u['birim_fiyat']:,.2f} {siparis['para_birimi']}",
        ])
    toplam = sum(u['miktar'] * u['birim_fiyat'] for u in siparis['urunler'])
    urun_data.append(["", "", "", "", "GENEL TOPLAM", f"{toplam:,.2f} {siparis['para_birimi']}"])

    t = Table(urun_data, colWidths=[8 * mm, 55 * mm, 35 * mm, 17 * mm, 27 * mm, 28 * mm], repeatRows=1)
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'DejaVu'),
        ('BACKGROUND', (0, 0), (-1, 0), LACIVERT), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, 0), 8), ('FONTNAME', (0, 0), (-1, 0), 'DejaVu-Bold'),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5), ('GRID', (0, 0), (-1, -2), 0.5, CIZGI_GRI),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'), ('ALIGN', (3, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5), ('SPAN', (0, -1), (3, -1)),
        ('BACKGROUND', (0, -1), (-1, -1), GRI), ('FONTNAME', (4, -1), (-1, -1), 'DejaVu-Bold'),
        ('LINEABOVE', (0, -1), (-1, -1), 1, LACIVERT),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, GRI]),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))

    if siparis.get('notlar'):
        story.append(section_baslik("NOTLAR"))
        story.append(Spacer(1, 4))
        notlar_table = Table([[Paragraph(siparis['notlar'], style_notlar)]], colWidths=[170 * mm], rowHeights=[20 * mm])
        notlar_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.5, CIZGI_GRI), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(notlar_table)

    doc.build(story)
    return buffer.getvalue()
