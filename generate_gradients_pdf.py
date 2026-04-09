from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color, white, HexColor

def hex_to_color(hex_str):
    hex_str = hex_str.lstrip('#')
    r = int(hex_str[0:2], 16) / 255.0
    g = int(hex_str[2:4], 16) / 255.0
    b = int(hex_str[4:6], 16) / 255.0
    return Color(r, g, b)

def draw_gradient_rect(c, x, y, w, h, colors, steps=100):
    strip_w = w / steps
    for i in range(steps):
        t = i / (steps - 1)
        n = len(colors) - 1
        seg = min(int(t * n), n - 1)
        local_t = (t * n) - seg
        c1 = colors[seg]
        c2 = colors[min(seg + 1, n)]
        r = c1.red + (c2.red - c1.red) * local_t
        g = c1.green + (c2.green - c1.green) * local_t
        b = c1.blue + (c2.blue - c1.blue) * local_t
        c.setFillColor(Color(r, g, b))
        c.rect(x + i * strip_w, y, strip_w + 1, h, fill=1, stroke=0)

def draw_sample_row(c, x, y, w):
    c.setFillColor(Color(0.04, 0.06, 0.08, 0.55))
    c.roundRect(x + 10, y, w - 20, 28, 6, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 20, y + 9, "#48592")
    c.setFont("Helvetica", 9)
    c.drawString(x + 80, y + 9, "20/03/2026")
    c.drawString(x + 170, y + 9, "Maria Aparecida")
    c.drawString(x + 300, y + 9, "Administrativo")
    c.setFillColor(Color(0.98, 0.75, 0.14, 0.3))
    c.roundRect(x + w - 110, y + 4, 80, 20, 4, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(x + w - 70, y + 10, "Pendente")

gradients = [
    {"name": "Opcao 1 - Emerald Bright", "desc": "Esmeralda -> Verde Claro",
     "colors": ["#2d8f5e", "#45c98a", "#80e8b4", "#b0f5d0"]},
    {"name": "Opcao 2 - Green Vitality", "desc": "Verde Medio -> Menta",
     "colors": ["#1a6b40", "#38a865", "#60d090", "#95e8b8"]},
    {"name": "Opcao 3 - Teal Fresh", "desc": "Teal -> Menta Suave",
     "colors": ["#1a8a5c", "#3db880", "#6de0aa", "#a5f0cc"]},
    {"name": "Opcao 4 - Clinical Hope", "desc": "Verde Cirurgico -> Esperanca",
     "colors": ["#2d6a4f", "#52b788", "#7dd8a8", "#a8eac8"]},
    {"name": "Opcao 5 - Sage Garden", "desc": "Sage -> Verde Pastel",
     "colors": ["#3a8a6a", "#5cb88a", "#88d8aa", "#b8f0cc"]},
    {"name": "Opcao 6 - Ocean Health", "desc": "Teal Oceano -> Turquesa Clara",
     "colors": ["#1a7a6a", "#35b09a", "#60d8c0", "#95f0dd"]},
    {"name": "Opcao 7 - Green Breath", "desc": "Verde -> Menta -> Quase Branco (5 tons)",
     "colors": ["#2e7d52", "#50b87a", "#78d8a0", "#a8f0c4", "#d0fce0"]},
    {"name": "Opcao 8 - Pharmacy Green", "desc": "Verde Farmacia -> Menta",
     "colors": ["#20805a", "#40b080", "#68d8a5", "#98f0c8"]},
    {"name": "Opcao 9 - SUS Palette", "desc": "Verde SUS -> Sage -> Menta Pastel (5 tons)",
     "colors": ["#40916c", "#60b88a", "#88d8aa", "#b0f0cc", "#d5fce5"]},
    {"name": "Opcao 10 - Aqua Medical", "desc": "Teal -> Agua Viva -> Cristal (5 tons)",
     "colors": ["#1a8a70", "#3dbba0", "#68e0c0", "#a0f5dd", "#c8ffee"]},
    {"name": "Opcao 11 - Nature Pure", "desc": "Verde Folha -> Verde Pastel (5 tons)",
     "colors": ["#3a7a3a", "#5aaa5a", "#80d080", "#a8e8a8", "#d0f8d0"]},
    {"name": "Opcao 12 - Jade Mint", "desc": "Jade -> Menta -> Quase Branco (5 tons)",
     "colors": ["#2a8868", "#48b890", "#70d8b0", "#a0f0d0", "#c8ffe8"]},
]

output_path = r"C:\Users\adoni\OneDrive\Área de Trabalho\SGI-HECC-main\SGI-HECC-main\opcoes-degrade-verdes-v2.pdf"
page_w, page_h = landscape(A4)
c = canvas.Canvas(output_path, pagesize=landscape(A4))

# Title page
c.setFillColor(HexColor("#2d6a4f"))
c.rect(0, 0, page_w, page_h, fill=1, stroke=0)
c.setFillColor(white)
c.setFont("Helvetica-Bold", 32)
c.drawCentredString(page_w / 2, page_h / 2 + 50, "Opcoes de Degrade Verde")
c.setFont("Helvetica", 18)
c.drawCentredString(page_w / 2, page_h / 2 + 10, "Painel TV - SGI-HECC")
c.setFont("Helvetica", 13)
c.setFillColor(Color(0.85, 1, 0.9))
c.drawCentredString(page_w / 2, page_h / 2 - 25, "Hospital Estadual Costa dos Coqueiros - FESF-SUS")
c.setFillColor(Color(0.7, 0.9, 0.8))
c.setFont("Helvetica", 11)
c.drawCentredString(page_w / 2, page_h / 2 - 55, "12 variacoes de verde para ambiente hospitalar")
c.drawCentredString(page_w / 2, page_h / 2 - 75, "Saude | Calma | Seguranca | Tranquilidade")
c.showPage()

for i in range(0, len(gradients), 2):
    c.setFillColor(HexColor("#111111"))
    c.rect(0, 0, page_w, page_h, fill=1, stroke=0)

    for j in range(2):
        idx = i + j
        if idx >= len(gradients):
            break
        g = gradients[idx]
        colors = [hex_to_color(h) for h in g["colors"]]

        card_x = 30
        card_w = page_w - 60
        card_h = 230
        card_y = page_h - 50 - (j * (card_h + 30)) - card_h

        draw_gradient_rect(c, card_x, card_y, card_w, card_h, colors)

        c.setStrokeColor(Color(1, 1, 1, 0.2))
        c.setLineWidth(1.5)
        c.roundRect(card_x, card_y, card_w, card_h, 12, fill=0, stroke=1)

        c.setFillColor(Color(1, 1, 1, 0.8))
        c.setFont("Helvetica-Bold", 11)
        c.drawString(card_x + 20, card_y + card_h - 30, g["name"].upper())

        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 22)
        c.drawString(card_x + 20, card_y + card_h - 62, g["desc"])

        c.setFillColor(Color(1, 1, 1, 0.5))
        c.setFont("Courier", 9)
        c.drawString(card_x + 20, card_y + card_h - 85, "Cores: " + "  ->  ".join(g["colors"]))

        draw_sample_row(c, card_x, card_y + 15, card_w)

    c.showPage()

c.save()
print(f"PDF gerado: {output_path}")
