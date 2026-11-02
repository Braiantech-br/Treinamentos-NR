"""
Trilha + efeitos sincronizados com o vídeo v2 (53 s).  Saída: audio/trilha.wav (48 kHz estéreo)
Tudo sintetizado aqui (sem amostras de terceiros) — livre para uso comercial.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
DUR = 53.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
os.makedirs("audio", exist_ok=True)

music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
send = np.zeros((N, 2))  # envio para reverb


def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(n): return np.arange(n) / SR


def lp(x, fc, order=2): return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x, axis=0)
def hp(x, fc, order=2): return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x, axis=0)
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def add(buf, t0, sig, gain=1.0, pan=0.0, rev=0.0):
    i = int(t0 * SR)
    if i >= N: return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], 1) * np.sqrt(2)
    if i < 0:
        sig = sig[-i:]; i = 0
    n = min(len(sig), N - i)
    buf[i:i + n] += sig[:n] * gain
    if rev:
        send[i:i + n] += sig[:n] * gain * rev


def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n); e[:na] = np.linspace(0, 1, na)
    nd = min(nd, n - na); e[na:na + nd] = np.linspace(1, s, nd)
    if nr and n > nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e


# ------------------------------------------------------------------ instrumentos
def pad(notes, dur, cutoff=1600, bright=1.0):
    n = int(dur * SR); t = tt(n); out = np.zeros((n, 2))
    for m in notes:
        f = mtof(m)
        for ch, det in ((0, -0.08), (1, 0.08)):
            for d in (-1, 0, 1):
                ff = f * 2 ** ((d * 7 + det * 10) / 1200)
                ph = rng.random()
                out[:, ch] += 2 * ((t * ff + ph) % 1.0) - 1
    out = lp(out, cutoff * bright, 3) / (len(notes) * 3)
    return out * env_adsr(n, 0.45, 0.2, 0.9, 0.6)[:, None]


def pluck(m, dur=0.9, tone=1.0):
    n = int(dur * SR); t = tt(n); f = mtof(m); x = np.zeros(n)
    for k in range(1, 8):
        x += (1 / k ** 1.3) * np.sin(2 * np.pi * f * k * t + k) * np.exp(-t * (3.2 + k * 2.2 / tone))
    x *= np.minimum(1, t / 0.003)
    return x * 0.5


def bell(f, dur=1.6):
    n = int(dur * SR); t = tt(n)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t * 3.0)
         + 0.45 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 5)
         + 0.25 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 7)
         + 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 12))
    return x * np.minimum(1, t / 0.002) * 0.5


def bass_note(m, dur):
    n = int(dur * SR); t = tt(n); f = mtof(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    x = np.tanh(1.6 * x) * np.exp(-t * 2.2) * np.minimum(1, t / 0.004)
    rel = min(n, int(0.03 * SR)); x[-rel:] *= np.linspace(1, 0, rel)
    return x * 0.55


def kick(g=1.0):
    n = int(0.45 * SR); t = tt(n)
    f = 45 + 95 * np.exp(-t * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    x[:120] += rng.standard_normal(120) * 0.25 * np.linspace(1, 0, 120)
    return np.tanh(1.5 * x) * g


def snare(g=1.0):
    n = int(0.25 * SR); t = tt(n)
    nz = bp(rng.standard_normal(n), 1200, 7000) * np.exp(-t * 18)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return (nz * 0.9 + tone * 0.5) * g


def hat(g=1.0, open_=False):
    n = int((0.18 if open_ else 0.06) * SR); t = tt(n)
    return hp(rng.standard_normal(n), 7500, 4) * np.exp(-t * (14 if open_ else 60)) * g


def noise_sweep(dur, f0, f1, env, q=0.35):
    """ruído com banda móvel (whoosh / riser)"""
    n = int(dur * SR); x = rng.standard_normal(n)
    blocks = 64; out = np.zeros(n); edges = np.linspace(0, n, blocks + 1).astype(int)
    pad_n = 2048
    for b in range(blocks):
        u = (b + 0.5) / blocks
        fc = f0 * (f1 / f0) ** u
        lo, hi = max(40, fc * (1 - q)), min(SR / 2 - 100, fc * (1 + q))
        a, z = max(0, edges[b] - pad_n), min(n, edges[b + 1] + pad_n)
        y = bp(x[a:z], lo, hi)
        out[edges[b]:edges[b + 1]] = y[edges[b] - a: edges[b] - a + edges[b + 1] - edges[b]]
    e = env(np.linspace(0, 1, n))
    return out * e


# ------------------------------------------------------------------ música por seção
BPM = 104
BEAT = 60 / BPM
BAR = 4 * BEAT
C3, D3, E3, F3, G3, A2 = 48, 50, 52, 53, 55, 45

# acordes (baixo, notas do pad, arpejo)
CH = {
    "Am": (45, [57, 60, 64], [69, 72, 76, 72]),
    "F":  (41, [57, 60, 65], [65, 69, 72, 69]),
    "C":  (48, [55, 60, 64], [67, 72, 76, 72]),
    "G":  (43, [55, 59, 62], [67, 71, 74, 71]),
    "Dm": (50, [57, 62, 65], [69, 74, 77, 74]),
    "E":  (40, [56, 59, 64], [68, 71, 76, 71]),
}


def section(t0, t1, prog, drums="full", arp=True, cutoff=1800, pad_gain=0.22, arp_gain=0.16, bass=True,
            bass_mode="8th"):
    nbar = int(np.ceil((t1 - t0) / BAR))
    for b in range(nbar):
        tb = t0 + b * BAR
        if tb >= t1: break
        name = prog[b % len(prog)]
        root, pn, ar = CH[name]
        dur = min(BAR + 0.5, t1 - tb + 0.3)
        add(music, tb, pad(pn, dur, cutoff), pad_gain, rev=0.35)
        for s in range(8):
            ts = tb + s * BEAT / 2
            if ts >= t1: break
            if arp:
                m = ar[s % 4] + (12 if s in (3, 7) else 0)
                add(music, ts, pluck(m, 0.7), arp_gain * (1.0 if s % 2 == 0 else 0.75), pan=0.35 if s % 2 else -0.35, rev=0.3)
            if bass:
                if bass_mode == "8th":
                    add(music, ts, bass_note(root - 12 + 12, BEAT / 2 * 0.95), 0.32 if s % 2 else 0.4)
                elif bass_mode == "long" and s == 0:
                    add(music, ts, bass_note(root, min(BAR, t1 - ts)) * np.exp(-tt(int(min(BAR, t1 - ts) * SR)) * -1.8), 0.35)
        if drums == "full":
            for k in range(4):
                tk = tb + k * BEAT
                if tk >= t1: break
                add(music, tk, kick(), 0.40)
                if k in (1, 3): add(music, tk, snare(), 0.22, rev=0.25)
            for s in range(8):
                ts = tb + s * BEAT / 2
                if ts < t1: add(music, ts, hat(open_=(s % 2 == 1)), 0.07 if s % 2 else 0.05, pan=0.3)
        elif drums == "light":
            for s in range(8):
                ts = tb + s * BEAT / 2
                if ts < t1: add(music, ts, hat(), 0.05, pan=0.3)


# Abertura 0–3.6: pad + arpejo, sem bateria
section(0.0, 3.6, ["C", "G"], drums="none", arp=True, cutoff=1700, pad_gain=0.36, arp_gain=0.26, bass=False)

# Jeito errado 3.6–11: tenso, escuro, batimento cardíaco
section(3.6, 11.0, ["Am", "Am", "F", "E"], drums="none", arp=False, cutoff=700, pad_gain=0.22, bass=True,
        bass_mode="long")
for i, tb in enumerate(np.arange(3.9, 11.0, 0.86)):  # tum-tum
    g = 0.20 + 0.18 * min(1, i / 7)
    add(music, tb, lp(kick(), 400), g)
    add(music, tb + 0.2, lp(kick(), 400), g * 0.7)
for ts in np.arange(3.6, 11.0, BEAT):  # tique-taque abafado
    add(music, ts, hat(), 0.035, pan=0.4)

# Cartela 11–13: riser até o "drop"
add(sfx, 11.0, noise_sweep(2.0, 300, 7000, lambda u: u ** 2 * (u < 0.98)), 0.10, rev=0.2)
n = int(2.0 * SR); tr = tt(n)
add(music, 11.0, np.sin(2 * np.pi * np.cumsum(220 * 2 ** (tr / 2.0 * 1.0)) / SR) * (tr / 2.0) ** 2 * 0.25 * (tr < 1.97), 0.5, rev=0.3)
add(music, 11.0, pad([60, 64, 67], 2.1, 1200), 0.18, rev=0.4)

# Jeito certo 13–36.5: groove completo, otimista
section(13.0, 36.5, ["C", "G", "Am", "F"], drums="full", arp=True, cutoff=2200, pad_gain=0.18, arp_gain=0.15)
add(music, 13.0, hat(open_=True) * 3, 0.10, rev=0.3)  # crash suave no drop

# Regras de ouro 36.5–41.6: continua o groove
section(36.5, 41.6, ["F", "G", "C", "C"], drums="full", arp=True, cutoff=2400, pad_gain=0.18, arp_gain=0.15)

# Normas 41.6–50: calmo para leitura/QR
section(41.6, 50.0, ["Am", "F", "C", "G"], drums="light", arp=True, cutoff=1400, pad_gain=0.17, arp_gain=0.11,
        bass=True, bass_mode="long")

# Assinatura 50–53: acorde final
for m in (48, 55, 60, 64, 67, 72):
    add(music, 50.0, pluck(m, 3.0, tone=2.0), 0.16, pan=(m - 60) / 30, rev=0.5)
add(music, 50.0, pad([55, 60, 64, 72], 3.0, 2000), 0.22, rev=0.5)
add(music, 50.0, bass_note(36, 2.5) * np.exp(-tt(int(2.5 * SR)) * -1.5), 0.4)
add(music, 50.0, kick(), 0.5)

# ------------------------------------------------------------------ efeitos sonoros
def whoosh(t0, g=0.12, dur=0.7, up=True):
    f0, f1 = (400, 5000) if up else (5000, 400)
    add(sfx, t0 - dur * 0.6, noise_sweep(dur, f0, f1, lambda u: np.sin(np.pi * u) ** 2), g, rev=0.25)


def pop(t0, f=900, g=0.18, pan=0.0):
    n = int(0.06 * SR); t = tt(n)
    x = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-t * 80))) / SR) * np.exp(-t * 60)
    add(sfx, t0, x, g, pan, rev=0.15)


def buzzer(t0, g=0.12):
    for k in range(2):
        n = int(0.13 * SR); t = tt(n)
        x = np.sign(np.sin(2 * np.pi * 146 * t)) + np.sign(np.sin(2 * np.pi * 151 * t))
        x = lp(x * 0.5, 1800) * env_adsr(n, 0.005, 0.02, 0.9, 0.02)
        add(sfx, t0 + k * 0.17, x, g)


PENTA = [72, 74, 76, 79, 81, 84, 86, 88]

# abertura
whoosh(0.35, 0.10, 0.9)
add(sfx, 0.35, bell(mtof(84), 2.0), 0.08, rev=0.5)
for i, ts in enumerate((0.9, 1.0)): pop(ts, 700 + 200 * i, 0.06)

# jeito errado
buzzer(3.7)
for ts in (4.5, 7.4): whoosh(ts + 0.25, 0.05, 0.4)
for ts in (6.3, 6.6, 7.9, 8.7): pop(ts, 420, 0.12, pan=0.2)
add(sfx, 8.5, lp(kick(), 250), 0.35)  # impacto na lombar
add(sfx, 8.5, bp(rng.standard_normal(int(0.4 * SR)), 80, 300) * np.exp(-tt(int(0.4 * SR)) * 8), 0.3)

# transição
whoosh(11.05, 0.12, 0.8)
add(sfx, 11.2, bell(mtof(76), 1.8), 0.10, rev=0.5)
add(sfx, 11.32, bell(mtof(84), 1.8), 0.09, rev=0.5)

# jeito certo
pop(13.1, 1100, 0.14)
add(sfx, 13.15, bell(mtof(88), 1.2), 0.05, rev=0.4)
pop(13.2, 800, 0.08)  # legenda "antes"
STEPS = [14.0, 16.5, 20.0, 22.5, 26.0, 28.0, 32.2]
for i, ts in enumerate(STEPS):
    add(sfx, ts, bell(mtof(PENTA[i]), 1.3), 0.085, pan=0.25, rev=0.4)
    whoosh(ts + 0.25, 0.035, 0.35)
for ts in (14.8, 18.0, 18.6, 20.6, 28.5, 33.0): pop(ts, 1300, 0.10, pan=-0.2)

# regras de ouro
whoosh(36.55, 0.10, 0.7)
for i in range(5):
    ts = 36.9 + i * 0.35
    pop(ts, 900 + 90 * i, 0.12)
    add(sfx, ts, bell(mtof(PENTA[i] + 12), 0.8), 0.03, rev=0.3)

# normas
whoosh(41.65, 0.10, 0.7)
for i in range(4): pop(41.6 + 0.35 + i * 0.3, 850 + 80 * i, 0.10)
add(sfx, 42.8, bell(mtof(79), 1.6), 0.07, rev=0.5)
add(sfx, 42.9, bell(mtof(84), 1.6), 0.06, rev=0.5)

# assinatura
whoosh(50.05, 0.10, 0.8)
add(sfx, 50.0, bell(mtof(96), 2.5), 0.05, rev=0.6)

# ------------------------------------------------------------------ mix
nir = int(1.6 * SR); tir = tt(nir)
ir = np.stack([rng.standard_normal(nir), rng.standard_normal(nir)], 1) * np.exp(-tir * 3.2)[:, None]
ir = lp(ir, 5000); ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], 1)

# ducking da música quando entram efeitos importantes (leve)
mix = music * 0.9 + sfx + wet * 0.35
mix = hp(mix, 30)
t = tt(N)
fade = np.minimum(1, t / 0.4) * np.clip((DUR - t) / 1.2, 0, 1) ** 0.7
mix *= fade[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.abs(mix).max() / 0.89

import wave
pcm = (mix * 32767).astype(np.int16)
with wave.open("audio/trilha.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("ok", mix.shape)
