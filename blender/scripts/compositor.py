"""
Compositor 2D — legendas, indicadores e cartelas em 1920x1080.
  python3 compositor.py --frames saida_pro/frames --anchors dados/anchors.json --out video_frames [--only 156,500]
"""
import json, math, os, sys
import qrcode
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont, ImageFilter

A = sys.argv
def arg(n, d=None): return A[A.index(n) + 1] if n in A else d
FRAMES = arg("--frames", "saida_pro/frames")
OUTD = arg("--out", "video_frames")
ONLY = [int(x) for x in arg("--only", "").split(",") if x]
FONTS = arg("--fonts", "/home/claude/fonts")
os.makedirs(OUTD, exist_ok=True)
D = json.load(open(arg("--anchors", "dados/anchors.json")))
FPS = D["fps"]
NORM0, SIG0, TEND = 41.6, 50.0, 53.0   # cartela de normas e assinatura (v2)
END = int(round(TEND * FPS))
ANC = {int(k): v for k, v in D["frames"].items()}

W, H, S = 1920, 1080, 2  # supersampling 2x para traços suaves
INK = (14, 17, 22)
WHITE = (255, 255, 255)
RED = (255, 64, 64)
GREEN = (34, 197, 94)
YELLOW = (245, 196, 0)
GRAY = (150, 160, 175)


@lru_cache(None)
def font(w, size):
    return ImageFont.truetype(os.path.join(FONTS, f"Poppins-{w}.ttf"), int(size * S))


def T(s): return int(round(s * FPS))
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease(u): return 1 - (1 - clamp(u)) ** 3
def ease_io(u): u = clamp(u); return u * u * (3 - 2 * u)


def window(t, a, b, fin=0.35, fout=0.3):
    """0..1 de visibilidade com entrada/saída suaves."""
    if t < a or t > b:
        return 0.0
    return min(ease((t - a) / fin), ease((b - t) / fout))


def rgba(c, a): return (*c, int(255 * clamp(a)))


# ------------------------------------------------------------------ primitivas
class Layer:
    def __init__(self):
        self.im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def rrect(self, x, y, w, h, r, fill):
        self.d.rounded_rectangle([x * S, y * S, (x + w) * S, (y + h) * S], r * S, fill=fill)

    def text(self, x, y, s, f, fill, anchor="la"):
        self.d.text((x * S, y * S), s, font=f, fill=fill, anchor=anchor)

    def tw(self, s, f): return self.d.textlength(s, font=f) / S

    def line(self, pts, fill, w):
        self.d.line([(px * S, py * S) for px, py in pts], fill=fill, width=int(w * S), joint="curve")
        for px, py in (pts[0], pts[-1]):
            self.circle(px, py, w / 2, fill)

    def circle(self, x, y, r, fill=None, outline=None, width=1):
        self.d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=fill, outline=outline,
                       width=int(width * S))

    def check(self, x, y, r, fill, w=None):
        w = w or r * 0.28
        self.line([(x - r * 0.45, y + r * 0.02), (x - r * 0.12, y + r * 0.35), (x + r * 0.5, y - r * 0.32)], fill, w)

    def cross(self, x, y, r, fill, w=None):
        w = w or r * 0.26
        k = r * 0.38
        self.line([(x - k, y - k), (x + k, y + k)], fill, w)
        self.line([(x - k, y + k), (x + k, y - k)], fill, w)


# ------------------------------------------------------------------ componentes
def brand(L, a):
    if a <= 0: return
    f = font("Bold", 22)
    tw = L.tw("BRAIAN TECH", f)
    x, y = W - 60 - tw, 52
    L.rrect(x - 22, y - 2, 8, 30, 2, rgba(YELLOW, a))
    L.text(x, y, "BRAIAN TECH", f, rgba(WHITE, 0.92 * a))


def pill(L, t, a0, a1, ok):
    a = window(t, a0, a1, 0.4, 0.25)
    if a <= 0: return
    pop = 0.85 + 0.15 * ease((t - a0) / 0.35)
    col = GREEN if ok else RED
    label = "JEITO CERTO" if ok else "JEITO ERRADO"
    f = font("ExtraBold", 30 * pop)
    tw = L.tw(label, f)
    x, y, h = 60, 42, 62 * pop
    L.rrect(x, y, tw + h + 34, h, h / 2, rgba(col, 0.96 * a))
    cx, cy, r = x + h / 2 + 4, y + h / 2, h * 0.36
    L.circle(cx, cy, r, fill=rgba(WHITE, a))
    (L.check if ok else L.cross)(cx, cy, r, rgba(col, a), w=r * 0.3)
    L.text(x + h + 14, y + h / 2 + 1, label, f, rgba(WHITE, a), "lm")


def caption(L, t, a0, a1, title, sub=None, badge=None, kind="ok"):
    a = window(t, a0, a1, 0.45, 0.25)
    if a <= 0: return
    dx = (1 - ease((t - a0) / 0.45)) * -40
    f1, f2 = font("SemiBold", 44), font("Regular", 29)
    w1 = L.tw(title, f1)
    w2 = L.tw(sub, f2) if sub else 0
    bw = 88 if badge is not None else 0
    pw = max(w1, w2) + bw + 70
    ph = 132 if sub else 104
    x, y = 60 + dx, H - 70 - ph
    L.rrect(x, y, pw, ph, 18, rgba(INK, 0.80 * a))
    accent = {"ok": YELLOW, "bad": RED, "info": GRAY}[kind]
    L.rrect(x, y, 8, ph, 4, rgba(accent, a))
    tx = x + 36
    if badge is not None:
        cx, cy = x + 36 + 30, y + ph / 2
        L.circle(cx, cy, 31, fill=rgba(accent, a))
        if badge == "x":
            L.cross(cx, cy, 31, rgba(WHITE, a))
        elif badge == "i":
            L.text(cx, cy + 2, "i", font("ExtraBold", 36), rgba(INK, a), "mm")
        else:
            L.text(cx, cy + 3, str(badge), font("ExtraBold", 36), rgba(INK, a), "mm")
        tx += bw
    if sub:
        L.text(tx, y + 24, title, f1, rgba(WHITE, a))
        L.text(tx, y + 82, sub, f2, rgba((205, 212, 222), a))
    else:
        L.text(tx, y + ph / 2 + 2, title, f1, rgba(WHITE, a), "lm")


def callout(L, t, a0, a1, pt, label, col, side=1, dy=-110, dxl=150):
    a = window(t, a0, a1, 0.4, 0.25)
    if a <= 0 or pt is None: return
    x, y = pt[0], pt[1]
    grow = ease((t - a0) / 0.4)
    # anel pulsante
    ph = ((t - a0) * 1.2) % 1.0
    L.circle(x, y, 14 + 22 * ph, outline=rgba(col, a * (1 - ph) * 0.8), width=3)
    L.circle(x, y, 11, fill=rgba(col, a))
    L.circle(x, y, 5, fill=rgba(WHITE, a))
    ex, ey = x + side * dxl * 0.45, y + dy
    lx = ex + side * dxl * 0.55 * grow
    L.line([(x, y), (x + (ex - x) * grow, y + (ey - y) * grow)] + ([(lx, ey)] if grow > 0.99 else []),
           rgba(col, a), 4)
    if grow > 0.6:
        f = font("Bold", 30)
        tw = L.tw(label, f)
        bx = lx if side > 0 else lx - tw - 40
        L.rrect(bx, ey - 28, tw + 40, 56, 28, rgba(col, a * clamp((grow - 0.6) / 0.4)))
        L.text(bx + 20, ey + 1, label, f, rgba(WHITE, a * clamp((grow - 0.6) / 0.4)), "lm")


def spine(L, t, a0, a1, pts, col, label=None, prog=True):
    a = window(t, a0, a1, 0.5, 0.3)
    if a <= 0: return
    pts = [(p[0], p[1]) for p in pts]
    if prog:  # desenha de baixo para cima
        u = ease((t - a0) / 0.6)
        total = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        lim, acc, out = total * u, 0, [pts[0]]
        for i in range(len(pts) - 1):
            d = math.dist(pts[i], pts[i + 1])
            if acc + d >= lim:
                k = (lim - acc) / d if d else 0
                out.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k))
                break
            out.append(pts[i + 1]); acc += d
        pts = out
    if len(pts) < 2: return
    L.line(pts, rgba(col, 0.22 * a), 22)
    L.line(pts, rgba(col, 0.35 * a), 14)
    L.line(pts, rgba(col, a), 7)
    for p in pts[:1] + pts[-1:]:
        L.circle(p[0], p[1], 9, fill=rgba(WHITE, a), outline=rgba(col, a), width=4)


def pulse(L, t, a0, a1, pt, col):
    a = window(t, a0, a1, 0.3, 0.3)
    if a <= 0: return
    for k in range(3):
        ph = ((t - a0) * 1.1 + k / 3) % 1.0
        L.circle(pt[0], pt[1], 20 + 70 * ph, fill=rgba(col, a * 0.35 * (1 - ph)))
    L.circle(pt[0], pt[1], 18, fill=rgba(col, 0.85 * a))


STEP_TIMES = [14.0, 16.5, 20.0, 22.5, 26.0, 28.0, 32.2, 36.5]


def stepper(L, t):
    a = window(t, 13.6, 36.5, 0.5, 0.3)
    if a <= 0: return
    n = 7
    gap, r = 62, 19
    total = gap * (n - 1)
    x0, y = W - 60 - total - r - 210, 73
    cur = sum(1 for s in STEP_TIMES[:-1] if t >= s)  # 0..7
    L.rrect(x0 - r - 22, y - r - 14, total + 2 * r + 44, 2 * r + 28, r + 14, rgba(INK, 0.6 * a))
    L.line([(x0, y), (x0 + total, y)], rgba(GRAY, 0.5 * a), 3)
    if cur > 1:
        L.line([(x0, y), (x0 + gap * (cur - 1), y)], rgba(GREEN, a), 4)
    f = font("Bold", 19)
    for i in range(n):
        cx = x0 + i * gap
        if i + 1 < cur:
            L.circle(cx, y, r, fill=rgba(GREEN, a)); L.check(cx, y, r, rgba(WHITE, a), w=r * 0.25)
        elif i + 1 == cur:
            L.circle(cx, y, r + 4, fill=rgba(YELLOW, a)); L.text(cx, y + 1, str(i + 1), f, rgba(INK, a), "mm")
        else:
            L.circle(cx, y, r, fill=rgba(INK, a), outline=rgba(GRAY, a), width=2)
            L.text(cx, y + 1, str(i + 1), f, rgba(GRAY, a), "mm")


# ------------------------------------------------------------------ fundos
@lru_cache(None)
def scene_img(f):
    p = os.path.join(FRAMES, f"f_{f:04d}.png")
    if not os.path.exists(p) and "--test" in A:  # só para testes: usa o último quadro disponível
        p = sorted(os.listdir(FRAMES))[-1]; p = os.path.join(FRAMES, p)
    return Image.open(p).convert("RGB").resize((W, H), Image.LANCZOS)


@lru_cache(None)
def blurred(f, dark=0.45):
    im = scene_img(f).filter(ImageFilter.GaussianBlur(18))
    return Image.blend(im, Image.new("RGB", (W, H), INK), dark)


def vignette(strength=0.55, side="left"):
    g = Image.new("L", (W, 1))
    for x in range(W):
        u = x / W if side == "left" else 1 - x / W
        g.putpixel((x, 0), int(255 * strength * clamp(1 - u * 1.6) ** 1.5))
    g = g.resize((W, H))
    return Image.merge("RGBA", (Image.new("L", (W, H), 10),) * 3 + (g,))


VIG = vignette()


def bottom_shade():
    g = Image.new("L", (1, H))
    for y in range(H):
        g.putpixel((0, y), int(170 * clamp((y - H * 0.6) / (H * 0.4)) ** 1.6))
    g = g.resize((W, H))
    return Image.merge("RGBA", (Image.new("L", (W, H), 10),) * 3 + (g,))


SHADE = bottom_shade()

NORMS = [
    ("NR-17", "Ergonomia", "17.5 Levantamento de cargas · 17.5.5 Orientação ao trabalhador"),
    ("NR-1", "Gerenciamento de riscos ocupacionais", "Riscos ergonômicos no PGR e capacitação dos trabalhadores"),
    ("NR-11", "Movimentação e armazenagem de materiais", "Transporte, movimentação, armazenagem e manuseio de materiais"),
    ("ABNT NBR ISO 11228-1", "Movimentação manual", "Ergonomia · Levantamento e transporte de cargas"),
]
QR_URLS = [
    ("https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes",
     "NR-1 · NR-11 · NR-17", "gov.br · Ministério do Trabalho"),
    ("https://www.normas.com.br/visualizar/abnt-nbr-nm/11914/abnt-nbriso11228-1-ergonomia-movimentacao-manual-parte-1-levantamento-e-transporte-de-cargas",
     "NBR ISO 11228-1", "Catálogo ABNT"),
]


def make_qr(url, size=264):
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_L, border=0)
    q.add_data(url); q.make(fit=True)
    m = q.get_matrix(); n = len(m)
    cell = size // n
    img = Image.new("RGBA", (n * cell, n * cell), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    for yy, row in enumerate(m):
        for xx, v in enumerate(row):
            if v: d.rectangle([xx * cell, yy * cell, xx * cell + cell - 1, yy * cell + cell - 1], fill=(10, 12, 16, 255))
    big = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    big.paste(img, ((size - n * cell) // 2, (size - n * cell) // 2))
    return big


QRS = [(make_qr(u), l1, l2) for u, l1, l2 in QR_URLS]


@lru_cache(None)
def norm_bg():
    im = Image.new("RGBA", (W, H), (10, 12, 16, 255))
    d = ImageDraw.Draw(im)
    for x in range(0, W, 60):
        d.line([(x, 0), (x, H)], fill=(20, 24, 31, 255), width=1)
    for y in range(0, H, 60):
        d.line([(0, y), (W, y)], fill=(20, 24, 31, 255), width=1)
    d.rectangle([1170, 0, W, H], fill=(14, 17, 23, 255))
    return im


SEG3D = [(T(a), T(b)) for a, b in D["seg3d"]]
def is3d(f): return any(a <= f <= b for a, b in SEG3D)


# ------------------------------------------------------------------ quadro
def frame(f):
    t = f / FPS
    an = ANC.get(f)
    # ---- fundo
    if is3d(f):
        base = scene_img(f).convert("RGBA")
        base.alpha_composite(SHADE)
    elif f < T(13.0):  # cartela de transição
        base = blurred(T(11.0)).convert("RGBA")
    else:  # regras de ouro / encerramento
        base = blurred(T(36.5), 0.55).convert("RGBA")
    L = Layer()
    over_qr = []

    # ---- ABERTURA 0–3.5
    if t < 3.6:
        va = window(t, 0.3, 3.0, 0.6, 0.55)
        vg = VIG.copy(); vg.putalpha(VIG.getchannel("A").point(lambda v: int(v * max(va, 0.0))))
        base.alpha_composite(vg)
        if va > 0:
            dy = (1 - ease((t - 0.3) / 0.6)) * 30
            L.rrect(80, 610 + dy, 90, 8, 4, rgba(YELLOW, va))
            L.text(80, 640 + dy, "TREINAMENTO DE ERGONOMIA", font("Bold", 28), rgba(YELLOW, va))
            L.text(76, 690 + dy, "Levantamento", font("ExtraBold", 96), rgba(WHITE, va))
            L.text(76, 800 + dy, "seguro de cargas", font("ExtraBold", 96), rgba(WHITE, va))
            L.text(80, 935 + dy, "Como levantar peso sem sobrecarregar a coluna", font("Regular", 34),
                   rgba((215, 222, 232), va))

    # ---- JEITO ERRADO 3.6–11
    if 3.5 < t < 11.2 and an:
        pill(L, t, 3.7, 11.0, ok=False)
        caption(L, t, 4.5, 7.4, "Curvar a coluna com as pernas esticadas", badge="x", kind="bad")
        caption(L, t, 7.4, 11.0, "Levantar com as costas, carga longe do corpo", badge="x", kind="bad")
        spine(L, t, 6.0, 11.0, an["back"], RED)
        mid = an["back"][2]
        callout(L, t, 6.3, 11.0, (mid[0], mid[1] - 8), "Coluna curvada", RED, side=1, dy=-120, dxl=170)
        callout(L, t, 6.6, 7.5, an["kneeL"], "Pernas esticadas", RED, side=1, dy=-60, dxl=190)
        callout(L, t, 7.9, 11.0, an["box"], "Carga longe do corpo", RED, side=-1, dy=-150, dxl=170)
        pulse(L, t, 8.5, 11.0, an["lumbar"], RED)
        callout(L, t, 8.7, 11.0, an["lumbar"], "Sobrecarga na lombar", RED, side=1, dy=110, dxl=180)

    # ---- TRANSIÇÃO 11–13
    if T(11.0) < f < T(13.0):
        a = window(t, 11.05, 12.95, 0.35, 0.3)
        r = 74 * (0.7 + 0.3 * ease((t - 11.05) / 0.4))
        cx, cy = W / 2, H / 2 - 70
        L.circle(cx, cy, r + 14, fill=rgba(GREEN, 0.25 * a))
        L.circle(cx, cy, r, fill=rgba(GREEN, a))
        L.check(cx, cy, r, rgba(WHITE, a), w=r * 0.2)
        L.text(W / 2, H / 2 + 60, "Agora, o jeito certo", font("ExtraBold", 72), rgba(WHITE, a), "mt")
        L.text(W / 2, H / 2 + 160, "Siga os 7 passos", font("Regular", 34), rgba((210, 218, 228), a), "mt")

    # ---- JEITO CERTO 13–36.5
    if 12.9 < t < 36.7 and an:
        pill(L, t, 13.1, 36.5, ok=True)
        stepper(L, t)
        caption(L, t, 13.2, 14.0, "Antes: avalie o peso, o tamanho e a pega", badge="i", kind="info")
        caption(L, t, 14.0, 16.5, "Afaste os pés na largura dos ombros", "Um pé levemente à frente, para ter equilíbrio", 1)
        caption(L, t, 16.5, 20.0, "Agache dobrando os joelhos", "Coluna reta e olhar para a frente", 2)
        caption(L, t, 20.0, 22.5, "Segure firme com as duas mãos", "Aproxime a carga do corpo", 3)
        caption(L, t, 22.5, 26.0, "Levante com a força das pernas", "Movimento contínuo, sem trancos", 4)
        caption(L, t, 26.0, 28.0, "Carga junto ao corpo", "Na altura da cintura", 5)
        caption(L, t, 28.0, 32.2, "Para mudar de direção, gire com os pés", "Nunca torça o tronco segurando a carga", 6)
        caption(L, t, 32.2, 36.5, "Deposite a carga com controle", "Se for no chão, agache do mesmo jeito", 7)
        fm = [(an["footL"][0] + an["footR"][0]) / 2, (an["footL"][1] + an["footR"][1]) / 2 + 10]
        km = [(an["kneeL"][0] + an["kneeR"][0]) / 2, (an["kneeL"][1] + an["kneeR"][1]) / 2]
        if fm[1] > 835:  # não deixar o ponto entrar na legenda de baixo: sobe pela canela
            k = clamp((fm[1] - 835) / max(fm[1] - km[1], 1))
            fm = [fm[0] + (km[0] - fm[0]) * k, fm[1] + (km[1] - fm[1]) * k]
        callout(L, t, 14.8, 16.5, fm, "Base firme", GREEN, side=1, dy=-110, dxl=190)
        spine(L, t, 17.6, 27.8, an["back"], GREEN)
        mid = an["back"][2]
        callout(L, t, 18.0, 27.8, (mid[0], mid[1] - 8), "Coluna reta", GREEN, side=1, dy=-120, dxl=170)
        callout(L, t, 18.6, 22.4, an["kneeL"], "Joelhos flexionados", GREEN, side=1, dy=70, dxl=200)
        callout(L, t, 20.6, 27.8, an["box"], "Carga junto ao corpo", GREEN, side=-1, dy=-170, dxl=170)
        callout(L, t, 28.5, 31.0, fm, "Os pés giram, o tronco acompanha", GREEN, side=1, dy=-120, dxl=190)
        spine(L, t, 32.6, 36.5, an["back"], GREEN)
        callout(L, t, 33.0, 36.5, an["box"], "Carga apoiada", GREEN, side=-1, dy=-140, dxl=150)

    # ---- REGRAS DE OURO 36.5–41.6
    if T(36.5) < f <= T(41.6):
        a = window(t, 36.55, 41.6, 0.4, 0.35)
        L.rrect(150, 150, 8, 70, 4, rgba(YELLOW, a))
        L.text(185, 147, "5 regras de ouro", font("ExtraBold", 64), rgba(WHITE, a))
        rules = [("Avalie a carga", "Se for pesada ou difícil, peça ajuda ou use equipamento"),
                 ("Coluna reta, joelhos flexionados", "Quem faz a força são as pernas"),
                 ("Carga sempre junto ao corpo", "Quanto mais longe, maior a sobrecarga na coluna"),
                 ("Sem trancos", "Levante e abaixe com movimento contínuo e controlado"),
                 ("Gire com os pés", "Nunca torça o tronco segurando peso")]
        for i, (r1, r2) in enumerate(rules):
            ai = a * ease((t - 36.9 - i * 0.35) / 0.4)
            if ai <= 0: continue
            y = 290 + i * 132
            dx = (1 - ai / max(a, 1e-3)) * -30
            L.circle(205 + dx, y + 42, 34, fill=rgba(YELLOW, ai))
            L.text(205 + dx, y + 45, str(i + 1), font("ExtraBold", 38), rgba(INK, ai), "mm")
            L.text(270 + dx, y + 2, r1, font("SemiBold", 42), rgba(WHITE, ai))
            L.text(270 + dx, y + 58, r2, font("Regular", 29), rgba((200, 208, 220), ai))

    # ---- NORMAS 41.6–50
    if T(NORM0) < f <= T(SIG0):
        a = window(t, NORM0 + 0.05, SIG0, 0.45, 0.4)
        base = norm_bg().copy()
        L.rrect(150, 118, 90, 8, 4, rgba(YELLOW, a))
        L.text(150, 142, "BASE NORMATIVA", font("Bold", 26), rgba(YELLOW, a))
        L.text(146, 182, "Normas de referência", font("ExtraBold", 64), rgba(WHITE, a))
        for i, (tag, r1, r2) in enumerate(NORMS):
            ai = a * ease((t - NORM0 - 0.35 - i * 0.3) / 0.45)
            if ai <= 0: continue
            y = 330 + i * 150
            dx = (1 - ai / max(a, 1e-3)) * -30
            ft = font("ExtraBold", 27)
            tw = L.tw(tag, ft)
            L.rrect(150 + dx, y, tw + 36, 46, 23, rgba(YELLOW, ai))
            L.text(150 + 18 + dx, y + 24, tag, ft, rgba(INK, ai), "lm")
            L.text(150 + tw + 56 + dx, y + 23, r1, font("SemiBold", 36), rgba(WHITE, ai), "lm")
            L.text(150 + dx, y + 66, r2, font("Regular", 27), rgba((196, 204, 216), ai))
        aq = a * ease((t - NORM0 - 1.2) / 0.5)
        if aq > 0:
            L.text(1540, 262, "Aponte a câmera do celular", font("SemiBold", 30), rgba(WHITE, aq), "mt")
            for k, (img, l1, l2) in enumerate(QRS):
                x = 1210 + k * 350
                y = 330
                L.rrect(x, y, 310, 310, 24, rgba(WHITE, aq))
                L.text(x + 155, y + 338, l1, font("Bold", 28), rgba(YELLOW, aq), "mt")
                L.text(x + 155, y + 378, l2, font("Regular", 23), rgba((196, 204, 216), aq), "mt")
            over_qr.append(aq)
        L.text(150, 990, "Material de orientação. Não substitui a AEP/AET nem as orientações do SESMT.",
               font("Regular", 23), rgba(GRAY, a))

    # ---- ASSINATURA 50–53
    if f > T(SIG0):
        a = window(t, SIG0 + 0.05, TEND, 0.45, 0.5)
        base = Image.new("RGBA", (W, H), (10, 12, 16, 255))
        L.rrect(W / 2 - 230, 400, 12, 120, 5, rgba(YELLOW, a))
        L.text(W / 2 - 195, 395, "BRAIAN", font("ExtraBold", 74), rgba(WHITE, a))
        L.text(W / 2 - 195, 465, "TECH", font("ExtraBold", 74), rgba(YELLOW, a))
        L.text(W / 2, 600, "Assistência Personalizada – Projetos e Robótica", font("Regular", 32),
               rgba((205, 212, 222), a), "mt")
        L.text(W / 2, 680, "www.braiantech.com.br   ·   @braiantech", font("SemiBold", 32), rgba(WHITE, a), "mt")
        L.text(W / 2, 950, "Animação produzida por Braian Tech", font("Regular", 22), rgba(GRAY, a), "mt")

    # ---- marca d'água
    if f <= T(SIG0):
        brand(L, window(t, 0.5, SIG0, 0.6, 0.3))

    over = L.im.resize((W, H), Image.LANCZOS)
    base.alpha_composite(over)
    if over_qr:  # QR colado sem reamostragem, módulos nítidos
        for k, (img, _, _) in enumerate(QRS):
            q = img.copy(); q.putalpha(int(255 * over_qr[0]))
            base.alpha_composite(q, (1210 + k * 350 + 23, 353))
    # fade de entrada/saída e cortes suaves
    k = 1.0
    k = min(k, ease(t / 0.5))
    k = min(k, clamp((TEND - t) / 0.5))
    for c in (11.0, 13.0, 36.5, NORM0, SIG0):  # mergulho rápido no preto nos cortes
        d = abs(t - c)
        if d < 0.17:
            k = min(k, 0.55 + 0.45 * d / 0.17)
    out = base.convert("RGB")
    if k < 1:
        out = Image.blend(Image.new("RGB", (W, H), (0, 0, 0)), out, k)
    return out


todo = ONLY or list(range(0, END + 1))
for f in todo:
    p = os.path.join(OUTD, f"v_{f:04d}.png")
    if not ONLY and os.path.exists(p):
        continue
    frame(f).save(p, compress_level=1)
    if is3d(f):
        scene_img.cache_clear()
print("OK", len(todo))
