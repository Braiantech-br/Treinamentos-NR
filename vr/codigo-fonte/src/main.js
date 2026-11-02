// Mestre do Levantamento — v2 (WebXR · Meta Quest 2 / PC)
// Braian Tech · treinamento de levantamento seguro de cargas (NR-17)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import galpaoGLB from '../assets/galpao.glb';
import workerGLB from '../assets/trabalhador.glb';
import fontBold from '../assets/Poppins-Bold.ttf';
import fontSemi from '../assets/Poppins-SemiBold.ttf';
import fontReg from '../assets/Poppins-Regular.ttf';

// ================================================================== configuração
const QS = new URLSearchParams(location.search);
const CONFIG = {
  webhookUrl: QS.get('webhook') || '',   // ?webhook=URL (ex.: n8n) recebe cada partida
  livre: QS.has('livre'),                // ?livre libera todas as fases
  caixas: 3,
};
const SETORES = ['Produção', 'Expedição', 'Manutenção', 'Administrativo', 'Outro'];
const COR = { ink: '#0e1116', amarelo: '#f5c400', verde: '#22c55e', vermelho: '#ff4040', laranja: '#ff9f1a', cinza: '#96a0af', branco: '#ffffff', suave: '#cdd4de', apagado: '#8a93a0' };
const NOTA = { bom: 100, atencao: 60, ruim: 20 };
const CRIT_LEVANTAR = [
  { id: 'coluna', nome: 'Coluna reta', curto: 'Coluna', peso: 0.30 },
  { id: 'joelhos', nome: 'Joelhos flexionados', curto: 'Joelhos', peso: 0.25 },
  { id: 'perto', nome: 'Carga junto ao corpo', curto: 'Carga perto', peso: 0.20 },
  { id: 'torcao', nome: 'Girar com os pés', curto: 'Giro', peso: 0.15 },
  { id: 'ritmo', nome: 'Sem trancos', curto: 'Ritmo', peso: 0.10 },
];
const FASES = [
  {
    n: 1, nome: 'Do chão para a bancada', curto: 'Chão → bancada', kg: 12, criterios: CRIT_LEVANTAR,
    dicas: {
      coluna: 'Mantenha a coluna reta e o olhar para a frente ao pegar a carga.',
      joelhos: 'Desça dobrando os joelhos. Quem faz a força são as pernas.',
      perto: 'Traga a caixa para junto do corpo, na altura da cintura.',
      torcao: 'Para mudar de direção, dê passos e gire com os pés.',
      ritmo: 'Levante com movimento contínuo, sem trancos.',
    },
    passos: ['Pegue a caixa do chão com as duas mãos', 'Leve até a área verde da bancada, à direita', 'Solte a caixa em cima da bancada'],
  },
  {
    n: 2, nome: 'Da bancada para o chão', curto: 'Bancada → chão', kg: 12, criterios: CRIT_LEVANTAR,
    dicas: {
      coluna: 'Ao depositar no chão, mantenha a coluna reta e o olhar para a frente.',
      joelhos: 'Para baixar a carga, agache dobrando os joelhos.',
      perto: 'Mantenha a caixa junto ao corpo enquanto anda e desce.',
      torcao: 'Para mudar de direção, dê passos e gire com os pés.',
      ritmo: 'Desça a carga devagar e só solte quando ela encostar no chão.',
    },
    passos: ['Pegue a caixa da bancada à sua frente', 'Leve até a área amarela no chão, à direita', 'Agache e apoie a caixa no chão antes de soltar'],
  },
  {
    n: 3, nome: 'Carga pesada', curto: 'Carga pesada', kg: 28,
    criterios: [
      { id: 'decisao', nome: 'Decisão segura', curto: 'Decisão', peso: 0.35 },
      { id: 'postura', nome: 'Tronco ereto', curto: 'Postura', peso: 0.25 },
      { id: 'empurrar', nome: 'Empurrar, não puxar', curto: 'Empurrar', peso: 0.20 },
      { id: 'controle', nome: 'Controle e velocidade', curto: 'Controle', peso: 0.20 },
    ],
    dicas: {
      decisao: 'Antes de levantar, avalie a carga. Se for pesada, use meios técnicos ou peça ajuda.',
      postura: 'Mantenha o tronco ereto e os braços perto do corpo ao empurrar.',
      empurrar: 'Empurre o carrinho à sua frente. Puxar sobrecarrega a coluna e os ombros.',
      controle: 'Ande devagar, com o carrinho sob controle.',
    },
    passos: ['Leve o carrinho até a caixa pesada', 'A caixa sobe no carrinho', 'Empurre até a área verde'],
  },
];
const PASSOS_DEMO = [ // tempos do clipe (s) — os mesmos do vídeo, menos 13 s
  [0.0, 'Antes: avalie o peso, o tamanho e a pega', 'Antes de levantar, avalie o peso, o tamanho e a pega da carga.'],
  [1.0, '1 · Afaste os pés na largura dos ombros', 'Passo um. Afaste os pés na largura dos ombros.'],
  [3.5, '2 · Agache dobrando os joelhos, coluna reta', 'Passo dois. Agache dobrando os joelhos, com a coluna reta.'],
  [7.0, '3 · Segure firme com as duas mãos', 'Passo três. Segure firme, com as duas mãos.'],
  [9.5, '4 · Levante com a força das pernas', 'Passo quatro. Levante com a força das pernas.'],
  [13.0, '5 · Carga junto ao corpo, na altura da cintura', 'Passo cinco. Carga junto ao corpo, na altura da cintura.'],
  [15.0, '6 · Para mudar de direção, gire com os pés', 'Passo seis. Para mudar de direção, gire com os pés.'],
  [19.2, '7 · Deposite a carga com controle', 'Passo sete. Deposite a carga com controle. Se for no chão, agache do mesmo jeito.'],
];
const MARCAS_DEMO = [ // [início, fim, osso, texto, deslocamento do rótulo]
  [1.8, 3.5, 'pes', 'Base firme', [0.0, 0.45, 0.5]],
  [4.6, 14.8, 'chest', 'Coluna reta', [0.0, 0.45, -0.45]],
  [5.6, 9.4, 'shinL', 'Joelhos flexionados', [0.0, -0.05, 0.55]],
  [7.6, 14.8, 'box', 'Carga junto ao corpo', [0.0, 0.55, 0.55]],
  [15.5, 18.5, 'pes', 'Os pés giram, o tronco acompanha', [0.0, 0.5, 0.55]],
  [20.0, 23.5, 'box', 'Carga apoiada', [0.0, 0.5, 0.45]],
];
const DURACAO_DEMO = 23.5;

// ================================================================== base
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FUNDO = new THREE.Color('#9aa3ad');
scene.background = FUNDO;
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 60);
camera.position.set(0, 1.65, 0);
scene.add(camera);
scene.add(new THREE.HemisphereLight('#ffffff', '#5b5f66', 2.2));
const sun = new THREE.DirectionalLight('#fff4e0', 1.6);
sun.position.set(3, 6, 2);
scene.add(sun);

const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const agoraS = () => performance.now() / 1000;
const horiz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ================================================================== armazenamento local
const LS = {
  ler(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
};
const CHAVE_RES = 'mestre-levantamento-resultados-v2';
const prefs = LS.ler('mestre-levantamento-prefs', { musica: true, narracao: true, tutorialVisto: false, iniciais: 'AAA' });
const salvarPrefs = () => LS.gravar('mestre-levantamento-prefs', prefs);
const resultadosSalvos = () => LS.ler(CHAVE_RES, []);
function registrarResultado(reg) { const r = resultadosSalvos(); r.push(reg); LS.gravar(CHAVE_RES, r.slice(-2000)); }
function atualizarRegistro(id, campos) { const r = resultadosSalvos(); const x = r.find(q => q.id === id); if (x) Object.assign(x, campos); LS.gravar(CHAVE_RES, r); }
const melhorDaFase = n => resultadosSalvos().filter(r => r.fase === n).reduce((m, r) => Math.max(m, r.nota), -1);
const faseLiberada = n => CONFIG.livre || n === 1 || melhorDaFase(n - 1) >= 0;
const estrelasDe = nota => (nota >= 85 ? 3 : nota >= 65 ? 2 : nota >= 0 ? 1 : 0);

// ================================================================== fontes e áudio
async function carregarFontes() {
  for (const [buf, w] of [[fontBold, '700'], [fontSemi, '600'], [fontReg, '400']]) {
    const f = new FontFace('Poppins', buf, { weight: w }); await f.load(); document.fonts.add(f);
  }
}
let actx = null, mestre = null;
function audio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    mestre = actx.createGain(); mestre.gain.value = 1; mestre.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tom(freq, dur = 0.25, tipo = 'sine', vol = 0.18, quando = 0, destino = null) {
  try {
    const a = audio(), t = a.currentTime + quando;
    const o = a.createOscillator(), g = a.createGain();
    o.type = tipo; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(destino || mestre); o.start(t); o.stop(t + dur + 0.05);
  } catch (e) { /* sem áudio */ }
}
const som = {
  clique: () => tom(900, 0.08, 'sine', 0.12),
  ok: () => { tom(880, 0.5); tom(1318, 0.6, 'sine', 0.14, 0.09); },
  alerta: () => { tom(150, 0.12, 'square', 0.06); tom(150, 0.12, 'square', 0.06, 0.16); },
  fim: () => [523, 659, 784, 1046].forEach((f, i) => tom(f, 0.7, 'triangle', 0.14, i * 0.12)),
  passo: n => tom(620 + n * 70, 0.35, 'sine', 0.08),
};

// trilha de fundo + ambiente do galpão (sintetizados, sem arquivos)
const musica = {
  ligada: false, proxima: 0, passo: 0, timer: null, bus: null, amb: null,
  iniciar() {
    if (this.ligada) return;
    const a = audio(); this.ligada = true;
    this.bus = a.createGain(); this.bus.gain.value = 0.0; this.bus.connect(mestre);
    this.bus.gain.linearRampToValueAtTime(0.55, a.currentTime + 2);
    // ambiente: zumbido grave de galpão
    const n = a.createBufferSource(), buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), d = buf.getChannelData(0);
    let ult = 0; for (let i = 0; i < d.length; i++) { ult = (ult + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = ult * 3; }
    n.buffer = buf; n.loop = true;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    this.amb = a.createGain(); this.amb.gain.value = 0.05;
    n.connect(lp).connect(this.amb).connect(this.bus); n.start();
    this.proxima = a.currentTime + 0.1; this.passo = 0;
    this.timer = setInterval(() => this.agendar(), 120);
  },
  parar() {
    if (!this.ligada) return;
    this.ligada = false; clearInterval(this.timer);
    const a = audio(); this.bus.gain.linearRampToValueAtTime(0, a.currentTime + 0.6);
    const b = this.bus; setTimeout(() => b.disconnect(), 800);
  },
  agendar() {
    const a = audio(), batida = 60 / 96 / 2; // colcheias a 96 BPM
    const acordes = [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]]; // Am F C G
    while (this.proxima < a.currentTime + 0.4) {
      const t = this.proxima, s = this.passo, ac = acordes[Math.floor(s / 16) % 4];
      const mtof = m => 440 * 2 ** ((m - 69) / 12);
      const nota = ac[[0, 1, 2, 1][s % 4]] + 12;
      this.voz(mtof(nota), t, 0.55, 'triangle', s % 2 ? 0.035 : 0.05);
      if (s % 16 === 0) for (const m of ac) this.voz(mtof(m), t, batida * 16, 'sawtooth', 0.012, 900);
      if (s % 16 === 0) this.voz(mtof(ac[0] - 24), t, batida * 15, 'sine', 0.07);
      if (s % 64 === 40 && Math.random() < 0.5) { this.voz(1050, t, 0.18, 'square', 0.006, 3000); this.voz(1050, t + 0.35, 0.18, 'square', 0.006, 3000); }
      this.proxima += batida; this.passo++;
    }
  },
  voz(f, t, dur, tipo, vol, corte = 2400) {
    const a = audio(), o = a.createOscillator(), g = a.createGain(), lp = a.createBiquadFilter();
    o.type = tipo; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = corte;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02 + dur * 0.1, 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.bus); o.start(t); o.stop(t + dur + 0.05);
  },
};

// narração em português (usa a voz do aparelho, se existir)
const narrador = {
  voz: null,
  preparar() {
    if (!('speechSynthesis' in window)) return;
    const pegar = () => { this.voz = speechSynthesis.getVoices().find(v => /^pt(-|_)?BR/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^pt/i.test(v.lang)) || null; };
    pegar(); speechSynthesis.onvoiceschanged = pegar;
  },
  falar(txt) {
    if (!prefs.narracao || !this.voz) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.voice = this.voz; u.lang = this.voz.lang; u.rate = 1.05; speechSynthesis.speak(u); } catch (e) { /* sem voz */ }
  },
  calar() { try { speechSynthesis.cancel(); } catch (e) { /* */ } },
};

// ================================================================== painéis (texto em canvas)
class Painel {
  constructor(larguraM, alturaM, pxPorM = 850) {
    this.w = Math.round(larguraM * pxPorM); this.h = Math.round(alturaM * pxPorM);
    this.canvas = document.createElement('canvas'); this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(larguraM, alturaM), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    this.mesh.renderOrder = 10;
    this.botoes = []; this.hover = null; this.desenhar = () => {};
  }
  atualizar() { const c = this.ctx; c.clearRect(0, 0, this.w, this.h); this.botoes = []; this.desenhar(c, this); this.tex.needsUpdate = true; }
  fundo(c, cor = COR.amarelo) { rrect(c, 0, 0, this.w, this.h, 36, 'rgba(14,17,22,0.9)'); rrect(c, 0, 0, 14, this.h, 7, cor); }
  botao(c, id, x, y, w, h, texto, { ativo = false, cor = COR.amarelo, desab = false } = {}) {
    const hov = this.hover === id && !desab;
    rrect(c, x, y, w, h, Math.min(h / 2, 40), ativo ? cor : hov ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)');
    if (!ativo) { c.strokeStyle = hov ? cor : desab ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.32)'; c.lineWidth = 4; rrectPath(c, x + 2, y + 2, w - 4, h - 4, Math.min(h / 2, 40) - 2); c.stroke(); }
    let fs = Math.round(Math.min(h * 0.4, 34)); c.font = `600 ${fs}px Poppins`;
    while (fs > 16 && c.measureText(texto).width > w - 36) { fs -= 1; c.font = `600 ${fs}px Poppins`; }
    texto_(c, texto, x + w / 2, y + h / 2 + 2, `600 ${fs}px Poppins`, ativo ? COR.ink : desab ? 'rgba(255,255,255,0.3)' : COR.branco, 'center', 'middle');
    if (!desab) this.botoes.push({ id, x, y, w, h });
  }
  botaoEm(uv) { const px = uv.x * this.w, py = (1 - uv.y) * this.h; return this.botoes.find(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)?.id ?? null; }
}
function rrectPath(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function rrect(c, x, y, w, h, r, fill) { rrectPath(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); }
function texto_(c, s, x, y, font, cor, align = 'left', base = 'alphabetic') { c.font = font; c.fillStyle = cor; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y); }
function quebrar(c, s, largura, font) {
  c.font = font; const linhas = []; let l = '';
  for (const p of s.split(' ')) { const t = l ? l + ' ' + p : p; if (c.measureText(t).width > largura && l) { linhas.push(l); l = p; } else l = t; }
  if (l) linhas.push(l); return linhas;
}
function paragrafo(c, s, x, y, largura, font, cor, entre) { const ls = quebrar(c, s, largura, font); ls.forEach((l, i) => texto_(c, l, x, y + i * entre, font, cor)); return y + ls.length * entre; }
function estrelas(c, x, y, n, tam) {
  for (let i = 0; i < 3; i++) {
    const cx = x + i * tam * 1.25; c.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? tam * 0.22 : tam * 0.5, a = -Math.PI / 2 + k * Math.PI / 5; c.lineTo(cx + r * Math.cos(a), y + r * Math.sin(a)); }
    c.closePath(); c.fillStyle = i < n ? COR.amarelo : 'rgba(255,255,255,0.18)'; c.fill();
  }
}
function bolinha(c, x, y, r, cor) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = cor; c.fill(); }
const corDe = cls => (cls === 'bom' ? COR.verde : cls === 'atencao' ? COR.laranja : cls === 'ruim' ? COR.vermelho : 'rgba(255,255,255,0.18)');
const corNota = n => (n >= 85 ? COR.verde : n >= 55 ? COR.laranja : COR.vermelho);

// rótulo pequeno (pílula) para o mundo 3D
function rotulo(txt, cor = COR.verde, alturaM = 0.1, sempreVisivel = true) {
  const c0 = document.createElement('canvas').getContext('2d'); c0.font = '700 44px Poppins';
  const larg = c0.measureText(txt).width + 70, px = 440;
  const p = new Painel(larg / px, alturaM * 0 + 70 / px, px);
  p.desenhar = c => { rrect(c, 0, 0, p.w, p.h, p.h / 2, cor); texto_(c, txt, p.w / 2, p.h / 2 + 3, '700 44px Poppins', COR.branco, 'center', 'middle'); };
  p.atualizar(); p.mesh.material.depthTest = !sempreVisivel; p.mesh.renderOrder = sempreVisivel ? 30 : 5; return p.mesh;
}

// ================================================================== texturas e utilidades 3D
function texturaCaixa(kg, pesado = false) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const c = cv.getContext('2d');
  c.fillStyle = '#c4935d'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${90 + Math.random() * 60},${60 + Math.random() * 30},20,${Math.random() * 0.08})`; c.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 30, 1); }
  c.fillStyle = pesado ? 'rgba(200,40,40,0.95)' : 'rgba(150,105,55,0.9)'; c.fillRect(0, 112, 256, 32);
  if (pesado) { c.fillStyle = '#c62828'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText('PESADO', 128, 70); }
  c.fillStyle = 'rgba(40,30,20,0.9)'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText(`${kg} kg`, 128, 205);
  c.strokeStyle = 'rgba(40,30,20,0.85)'; c.lineWidth = 4; c.strokeRect(80, 172, 96, 46);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texturaSombra() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const c = cv.getContext('2d');
  const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
}
const SOMBRA = texturaSombra();
function sombra(raio) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(raio * 2, raio * 2), new THREE.MeshBasicMaterial({ map: SOMBRA, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.004; return m;
}
function zonaChao(larg, prof, cor) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.PlaneGeometry(larg, prof), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.28, depthWrite: false }));
  base.rotation.x = -Math.PI / 2; base.position.y = 0.005; g.add(base);
  const borda = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => new THREE.Vector3(x * larg / 2, 0.008, z * prof / 2))), new THREE.LineBasicMaterial({ color: cor }));
  g.add(borda); g.userData.base = base; return g;
}
const COR_MATERIAL = { Pallet: '#b88a57', Caixas: '#c4935d', Caixas2: '#d7ad78', Parede: '#a3a8b0', Concreto: '#8d9196', Papelao: '#c4935d' };
function simplificarMateriais(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const conv = m => {
      const nm = new THREE.MeshLambertMaterial({ color: COR_MATERIAL[m.name] ? new THREE.Color(COR_MATERIAL[m.name]) : m.color.clone(), map: m.map || null, name: m.name });
      if (m.name === 'Luminaria') { nm.emissive = new THREE.Color('#fff2d0'); nm.emissiveIntensity = 1; }
      return nm;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
}
const yawDe = d => Math.atan2(-d.x, -d.z);               // direção horizontal → yaw (frente = -Z)
const dirDe = yaw => new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));

// ================================================================== mundo: galpão + instrutor
const mundo = new THREE.Group(); scene.add(mundo);
let galpao = null, instrutor = null, mixer = null, acao = null, bancadaModelo = null, rotuloInstrutor = null;
const ossos = {};
const linhaColuna = new THREE.Group();
const marcasDemo = [];

async function carregarCena() {
  const loader = new GLTFLoader();
  const parse = buf => new Promise((ok, err) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', ok, err));
  const [g, w] = await Promise.all([parse(galpaoGLB), parse(workerGLB)]);
  simplificarMateriais(g.scene); simplificarMateriais(w.scene);
  galpao = g.scene; mundo.add(galpao);
  bancadaModelo = galpao.getObjectByName('Bancada');

  instrutor = w.scene;
  instrutor.traverse(o => { if (o.isMesh) o.frustumCulled = false; if (o.isBone) ossos[o.name] = o; });
  mundo.add(instrutor); instrutor.add(sombra(0.45));
  const clip = w.animations[0];
  const vistos = new Set(); // o GLTFLoader compartilha o mesmo array de tempos entre trilhas
  for (const tr of clip.tracks) { if (vistos.has(tr.times)) continue; vistos.add(tr.times); for (let i = 0; i < tr.times.length; i++) tr.times[i] -= 13.0; }
  clip.resetDuration();
  mixer = new THREE.AnimationMixer(instrutor);
  acao = mixer.clipAction(clip); acao.setLoop(THREE.LoopOnce, 1); acao.clampWhenFinished = true;
  acao.play(); acao.paused = true; mixer.setTime(0);

  rotuloInstrutor = rotulo('INSTRUTOR', 'rgba(34,197,94,0.95)', 0.1, false); rotuloInstrutor.position.set(0, 2.1, 0); instrutor.add(rotuloInstrutor);

  // linha verde da coluna (igual ao vídeo)
  const matL = new THREE.MeshBasicMaterial({ color: COR.verde, depthTest: false, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 8), matL); s.renderOrder = 25; linhaColuna.add(s); }
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), matL); s.renderOrder = 26; linhaColuna.add(s); }
  scene.add(linhaColuna); linhaColuna.visible = false;
  // marcações (callouts)
  for (const [ini, fim, osso, txt, off] of MARCAS_DEMO) {
    const lab = rotulo(txt, 'rgba(34,197,94,0.95)');
    const ponto = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), matL); ponto.renderOrder = 26;
    const lin = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: COR.verde, depthTest: false }));
    lin.renderOrder = 26;
    const grupo = new THREE.Group(); grupo.add(lab, ponto, lin); grupo.visible = false; scene.add(grupo);
    marcasDemo.push({ ini, fim, osso, off: new THREE.Vector3(...off), lab, ponto, lin, grupo });
  }

  // posiciona o galpão: jogador na origem olhando para -Z, vendo o instrutor quase de perfil a ~2,3 m
  const jogadorLocal = new THREE.Vector2(2.3, 0.45); // (x, z) no galpão (o instrutor olha para +Z)
  const dir = new THREE.Vector2(-jogadorLocal.x, -jogadorLocal.y).normalize();
  mundo.rotation.y = Math.PI - Math.atan2(dir.x, dir.y);
  const pj = new THREE.Vector3(jogadorLocal.x, 0, jogadorLocal.y).applyAxisAngle(new THREE.Vector3(0, 1, 0), mundo.rotation.y);
  mundo.position.set(-pj.x, 0, -pj.z);
}

function atualizarDemoVisual(t) {
  const P = n => ossos[n].getWorldPosition(new THREE.Vector3());
  const cadeia = ['hips', 'spine', 'chest', 'neck', 'head'].map(P);
  cadeia[4].y += 0.06;
  const segs = linhaColuna.children;
  for (let i = 0; i < 4; i++) {
    const a = cadeia[i], b = cadeia[i + 1], s = segs[i];
    s.position.copy(a).add(b).multiplyScalar(0.5); s.scale.set(1, a.distanceTo(b), 1);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpV.subVectors(b, a).normalize());
  }
  for (let i = 0; i < 5; i++) segs[4 + i].position.copy(cadeia[i]);
  linhaColuna.visible = t > 4.4 && t < 23.5;
  const cam = pose.cabeca;
  for (const m of marcasDemo) {
    const vis = t >= m.ini && t <= m.fim; m.grupo.visible = vis; if (!vis) continue;
    const anc = m.osso === 'pes' ? P('footL').add(P('footR')).multiplyScalar(0.5) : P(m.osso);
    // rótulo deslocado para o lado do jogador
    const paraJog = new THREE.Vector3(cam.x - anc.x, 0, cam.z - anc.z).normalize();
    const lado = new THREE.Vector3(-paraJog.z, 0, paraJog.x);
    const pos = anc.clone().addScaledVector(lado, m.off.z).addScaledVector(paraJog, 0.15); pos.y += m.off.y;
    m.lab.position.copy(pos); m.lab.lookAt(cam.x, pos.y, cam.z);
    m.ponto.position.copy(anc);
    m.lin.geometry.setFromPoints([anc, pos]);
  }
}
function esconderDemoVisual() { linhaColuna.visible = false; marcasDemo.forEach(m => { m.grupo.visible = false; }); }

// ================================================================== elementos das fases
const fase = new THREE.Group(); scene.add(fase);
const TAM_CAIXA = new THREE.Vector3(0.40, 0.28, 0.30);
const TAM_PESADA = new THREE.Vector3(0.55, 0.42, 0.45);
const matCaixa = new THREE.MeshLambertMaterial({ map: texturaCaixa(12) });
const matPesada = new THREE.MeshLambertMaterial({ map: texturaCaixa(28, true) });
const marcaChao = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.31, 40), new THREE.MeshBasicMaterial({ color: COR.amarelo, transparent: true, opacity: 0.9 }));
marcaChao.rotation.x = -Math.PI / 2;

function criarBancada(eixoLongo) {
  // devolve um grupo com a bancada do galpão, base no chão, centrada, lado comprido ao longo de eixoLongo
  const banc = bancadaModelo.clone(); banc.visible = true; banc.position.set(0, 0, 0);
  const inner = new THREE.Group(); inner.add(banc);
  let bb = new THREE.Box3().setFromObject(inner);
  if (bb.max.z - bb.min.z > bb.max.x - bb.min.x) { inner.rotation.y = Math.PI / 2; bb = new THREE.Box3().setFromObject(inner); }
  banc.position.x -= (bb.min.x + bb.max.x) / 2; banc.position.y -= bb.min.y; banc.position.z -= (bb.min.z + bb.max.z) / 2;
  if (inner.rotation.y) { // a translação foi aplicada no espaço do banc; recalcula
    banc.position.set(0, 0, 0); bb = new THREE.Box3().setFromObject(inner);
    inner.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  }
  bb = new THREE.Box3().setFromObject(inner);
  const holder = new THREE.Group(); holder.add(inner);
  holder.rotation.y = Math.atan2(-eixoLongo.z, eixoLongo.x);
  holder.userData = { topo: bb.max.y, longo: bb.max.x - bb.min.x, curto: bb.max.z - bb.min.z };
  return holder;
}
function criarCaixa(tam, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(tam.x, tam.y, tam.z), mat);
  m.userData.tam = tam; const s = sombra(Math.max(tam.x, tam.z) * 0.8); fase.add(s); m.userData.sombra = s;
  fase.add(m); return m;
}
function criarCarrinho() {
  const g = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: '#2b3a55' }), amarelo = new THREE.MeshLambertMaterial({ color: COR.amarelo }), preto = new THREE.MeshLambertMaterial({ color: '#1b1d22' });
  const plat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.72), amarelo); plat.position.set(0, 0.16, 0); g.add(plat);
  for (const [x, z] of [[-0.26, -0.3], [0.26, -0.3], [-0.26, 0.3], [0.26, 0.3]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 16), preto); r.rotation.z = Math.PI / 2; r.position.set(x, 0.065, z); g.add(r);
  }
  for (const x of [-0.27, 0.27]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.85, 0.035), metal); p.position.set(x, 0.6, 0.36); g.add(p); }
  const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.6, 12), preto); barra.rotation.z = Math.PI / 2; barra.position.set(0, 1.0, 0.36); g.add(barra);
  g.add(Object.assign(sombra(0.5), {}));
  g.userData.pega = new THREE.Vector3(0, 1.0, 0.36); // local: alça atrás (+Z); a frente do carrinho é -Z
  return g;
}

// ================================================================== controles, mãos e PC
const fabricaControle = new XRControllerModelFactory();
const fabricaMao = new XRHandModelFactory();
const maos = [0, 1].map(i => {
  const grip = renderer.xr.getControllerGrip(i);
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.11), new THREE.MeshLambertMaterial({ color: '#2a2f38' }));
  grip.add(corpo);
  let modelo = null; try { modelo = fabricaControle.createControllerModel(grip); grip.add(modelo); } catch (e) { /* sem modelos */ }
  scene.add(grip);
  const hand = renderer.xr.getHand(i);
  try { hand.add(fabricaMao.createHandModel(hand, 'boxes')); } catch (e) { /* sem mãos */ }
  scene.add(hand);
  const ray = renderer.xr.getController(i);
  const linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: COR.amarelo }));
  linha.scale.z = 3; ray.add(linha); scene.add(ray);
  const mao = { i, grip, ray, linha, hand, modelo, corpo, apertando: false, fonte: null };
  grip.addEventListener('connected', e => { mao.fonte = e.data; });
  grip.addEventListener('disconnected', () => { mao.fonte = null; });
  grip.addEventListener('squeezestart', () => { mao.apertando = true; });
  grip.addEventListener('squeezeend', () => { mao.apertando = false; });
  ray.addEventListener('selectstart', () => clicar(ray));
  return mao;
});
function vibrar(intens = 0.6, ms = 120) { for (const m of maos) m.fonte?.gamepad?.hapticActuators?.[0]?.pulse?.(intens, ms); }
function maoFechada(hand) {
  const j = hand.joints; if (!j || !j.wrist) return false;
  const w = j.wrist.position; let s = 0, n = 0;
  for (const k of ['index-finger-tip', 'middle-finger-tip', 'ring-finger-tip']) if (j[k]) { s += j[k].position.distanceTo(w); n++; }
  return n === 3 && s / n < 0.105;
}

const pc = { yaw: 0, pitch: 0, agachado: false, alturaOlho: 1.65, teclas: {}, segurando: false };
const maoPC = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshLambertMaterial({ color: '#e0a060' })); scene.add(m); return m; });
const mira = document.createElement('div');
mira.style.cssText = 'position:fixed;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:50%;border:2px solid #f5c400;pointer-events:none';
document.body.appendChild(mira);
renderer.domElement.addEventListener('click', () => {
  audio(); if (prefs.musica) musica.iniciar();
  if (renderer.xr.isPresenting) return;
  if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.(); else clicar(camera);
});
document.addEventListener('mousemove', e => { if (document.pointerLockElement !== renderer.domElement) return; pc.yaw -= e.movementX * 0.0025; pc.pitch = clamp(pc.pitch - e.movementY * 0.0025, -1.45, 1.45); });
addEventListener('keydown', e => {
  pc.teclas[e.code] = true;
  if (e.code === 'KeyC') pc.agachado = !pc.agachado;
  if (e.code === 'KeyE') pc.segurando = !pc.segurando;
  if (e.code === 'Space') pularDemo();
});
addEventListener('keyup', e => { pc.teclas[e.code] = false; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// simulação (testes automáticos)
const sim = { ativo: false, cabeca: new THREE.Vector3(0, 1.65, 0), yaw: 0, pitch: 0, maos: [new THREE.Vector3(), new THREE.Vector3()], aperto: false };
window.__sim = sim;
window.__roteiro = keys => new Promise(ok => {
  const t0 = agoraS(), L = lerp;
  const aplicar = (a, b, u) => {
    sim.cabeca.set(L(a.cab[0], b.cab[0], u), L(a.cab[1], b.cab[1], u), L(a.cab[2], b.cab[2], u));
    sim.yaw = L(a.yaw, b.yaw, u); sim.pitch = L(a.pitch, b.pitch, u);
    for (let k = 0; k < 2; k++) sim.maos[k].set(L(a.maos[k][0], b.maos[k][0], u), L(a.maos[k][1], b.maos[k][1], u), L(a.maos[k][2], b.maos[k][2], u));
    sim.aperto = u < 1 ? a.aperto : b.aperto;
  };
  const passo = () => {
    const t = agoraS() - t0, i = keys.findIndex(k => k.t > t);
    if (i === -1) { const k = keys.at(-1); aplicar(k, k, 0); ok(); return; }
    const a = keys[Math.max(0, i - 1)], b = keys[i]; aplicar(a, b, i === 0 ? 1 : (t - a.t) / (b.t - a.t)); requestAnimationFrame(passo);
  };
  passo();
});

// ================================================================== pose (cabeça + mãos)
const pose = { cabeca: new THREE.Vector3(), frenteH: new THREE.Vector3(0, 0, -1), yaw: 0, pitch: 0, maos: [new THREE.Vector3(), new THREE.Vector3()], aperto: [false, false] };
function lerPose(dt) {
  if (sim.ativo) {
    pose.cabeca.copy(sim.cabeca); pose.yaw = sim.yaw; pose.pitch = sim.pitch; pose.frenteH.copy(dirDe(sim.yaw));
    pose.maos[0].copy(sim.maos[0]); pose.maos[1].copy(sim.maos[1]); pose.aperto[0] = pose.aperto[1] = sim.aperto;
    camera.position.copy(sim.cabeca); camera.rotation.set(-sim.pitch, sim.yaw, 0, 'YXZ');
    return;
  }
  if (renderer.xr.isPresenting) {
    const xc = renderer.xr.getCamera();
    xc.getWorldPosition(pose.cabeca); xc.getWorldQuaternion(tmpQ);
    const f = tmpV.set(0, 0, -1).applyQuaternion(tmpQ), up = tmpV2.set(0, 1, 0).applyQuaternion(tmpQ);
    pose.pitch = Math.asin(clamp(-f.y, -1, 1));
    const fh = new THREE.Vector3(f.x, 0, f.z); if (fh.length() < 0.35) fh.set(up.x, 0, up.z);
    pose.frenteH.copy(fh.normalize()); pose.yaw = yawDe(pose.frenteH);
    maos.forEach((m, k) => {
      if (m.fonte?.hand && m.hand.joints?.wrist) { // rastreamento de mãos: pega com a mão fechada
        const j = m.hand.joints['middle-finger-metacarpal'] || m.hand.joints.wrist; j.getWorldPosition(pose.maos[k]);
        pose.aperto[k] = maoFechada(m.hand);
      } else { m.grip.getWorldPosition(pose.maos[k]); pose.aperto[k] = m.apertando; }
    });
    return;
  }
  const v = 2.0 * dt, f = dirDe(pc.yaw), r = new THREE.Vector3(-f.z, 0, f.x);
  if (pc.teclas.KeyW) camera.position.addScaledVector(f, v);
  if (pc.teclas.KeyS) camera.position.addScaledVector(f, -v);
  if (pc.teclas.KeyD) camera.position.addScaledVector(r, v);
  if (pc.teclas.KeyA) camera.position.addScaledVector(r, -v);
  pc.alturaOlho = lerp(pc.alturaOlho, pc.agachado ? 0.62 : 1.65, clamp(dt * 3));
  camera.position.y = pc.alturaOlho; camera.rotation.set(pc.pitch, pc.yaw, 0, 'YXZ');
  pose.cabeca.copy(camera.position); pose.pitch = -pc.pitch; pose.yaw = pc.yaw; pose.frenteH.copy(f);
  const alt = pc.agachado ? -0.42 : -0.5, dist = pc.segurando ? 0.32 : 0.36;
  [-1, 1].forEach((s, k) => { pose.maos[k].copy(camera.position).addScaledVector(f, dist).addScaledVector(r, s * 0.2); pose.maos[k].y = camera.position.y + alt; maoPC[k].position.copy(pose.maos[k]); pose.aperto[k] = pc.segurando; });
}

// ================================================================== painéis do jogo e HUD
const painel = new Painel(1.5, 1.0, 850); scene.add(painel.mesh);
const hud = new Painel(0.9, 0.16, 700); hud.mesh.material.depthTest = false; hud.mesh.renderOrder = 40;
camera.add(hud.mesh); hud.mesh.position.set(0, -0.28, -1.0); hud.mesh.visible = false;
let hudTexto = '', hudCor = COR.vermelho, hudAte = 0;
hud.desenhar = c => {
  rrect(c, 0, 0, hud.w, hud.h, hud.h / 2, hudCor === COR.verde ? 'rgba(34,197,94,0.95)' : hudCor === COR.laranja ? 'rgba(255,159,26,0.95)' : 'rgba(230,50,50,0.95)');
  texto_(c, hudTexto, hud.w / 2, hud.h / 2 + 3, '700 40px Poppins', COR.branco, 'center', 'middle');
};
function dica(txt, cor = COR.vermelho, seg = 1.8, alertar = true) {
  if (txt !== hudTexto || hudCor !== cor) { hudTexto = txt; hudCor = cor; hud.atualizar(); if (alertar) { som.alerta(); vibrar(0.7, 140); } }
  hudAte = agoraS() + seg; hud.mesh.visible = true;
}
// medidor de postura ao vivo (preso à visão, no alto)
const medidor = new Painel(0.92, 0.08, 900); medidor.mesh.material.depthTest = false; medidor.mesh.renderOrder = 40;
camera.add(medidor.mesh); medidor.mesh.position.set(0, 0.26, -1.0); medidor.mesh.visible = false;
let vivo = {}, vivoChave = '';
medidor.desenhar = c => {
  rrect(c, 0, 0, medidor.w, medidor.h, medidor.h / 2, 'rgba(14,17,22,0.78)');
  const cr = FASES[jogo.fase - 1].criterios, larg = (medidor.w - 40) / cr.length;
  cr.forEach((k, i) => { const x = 20 + i * larg; bolinha(c, x + 18, medidor.h / 2, 11, corDe(vivo[k.id])); texto_(c, k.curto, x + 36, medidor.h / 2 + 2, '600 21px Poppins', vivo[k.id] ? COR.branco : COR.apagado, 'left', 'middle'); });
};
function marcarVivo(id, cls) { vivo[id] = cls; }

function posicionarPainel(pos, olharPara) { painel.mesh.position.copy(pos); painel.mesh.lookAt(olharPara.x, pos.y, olharPara.z); }
function painelAFrente(dist = 1.35, lado = 0, altura = 1.45) {
  const f = pose.frenteH, esq = new THREE.Vector3(f.z, 0, -f.x);
  const pp = pose.cabeca.clone().addScaledVector(f, dist).addScaledVector(esq, lado); pp.y = altura; posicionarPainel(pp, pose.cabeca);
}

// ================================================================== estado do jogo
const jogo = {
  estado: 'carregando', setor: null, fase: 1, h0: 1.65, calibrado: false, calibAmostras: [], calibInicio: 0, aposCalibrar: 'lobby',
  caixaAtual: 0, resultados: [], demoT: 0, ultimoPasso: -1, demoVista: false, ultimoRegistro: null, iniciais: (prefs.iniciais || 'AAA').split(''),
  abaRanking: 1, modo: 'vr', decisao: null, retornoDemo: 'jogar',
};
window.__jogo = jogo;

function irPara(estado) {
  jogo.estado = estado;
  const t = agoraS();
  hud.mesh.visible = false;
  medidor.mesh.visible = estado === 'jogar';
  if (estado !== 'demo') { esconderDemoVisual(); narrador.calar(); }
  const mostrarGalpao = jogo.modo !== 'mr';
  galpao.visible = mostrarGalpao;
  if (['lobby', 'tutorial', 'calibrar', 'ranking', 'iniciais', 'intro3'].includes(estado)) {
    instrutor.visible = estado !== 'intro3'; fase.visible = false; bancadaModelo.visible = mostrarGalpao; acao.paused = true; mixer.setTime(0);
    posicionarPainel(new THREE.Vector3(0, 1.45, -1.3), new THREE.Vector3(0, 1.45, 0));
  }
  if (estado === 'lobby') painel.desenhar = desenharLobby;
  else if (estado === 'tutorial') painel.desenhar = desenharTutorial;
  else if (estado === 'calibrar') { jogo.calibAmostras = []; jogo.calibInicio = t; painel.desenhar = desenharCalibrar; }
  else if (estado === 'ranking') painel.desenhar = desenharRanking;
  else if (estado === 'iniciais') painel.desenhar = desenharIniciais;
  else if (estado === 'intro3') painel.desenhar = desenharIntro3;
  else if (estado === 'demo') {
    instrutor.visible = true; fase.visible = false; bancadaModelo.visible = mostrarGalpao;
    acao.reset(); acao.play(); acao.paused = false; jogo.demoT = 0; jogo.ultimoPasso = -1;
    posicionarPainel(new THREE.Vector3(-1.1, 1.55, -1.3), new THREE.Vector3(0, 1.55, 0.2));
    painel.desenhar = desenharDemo;
  } else if (estado === 'jogar') {
    instrutor.visible = false; fase.visible = true; bancadaModelo.visible = true;
    jogo.caixaAtual = 0; jogo.resultados = []; vivo = {}; vivoChave = '';
    if (jogo.fase !== 3) painelAFrente(1.5, 0.75, 1.5);
    montarFase(jogo.fase, pose.cabeca.clone(), pose.yaw);
    bancadaModelo.visible = false;
    painel.desenhar = jogo.fase === 3 ? desenharFase3 : desenharJogar;
    medidor.atualizar();
  } else if (estado === 'resultado') {
    painelAFrente(1.3, 0, 1.45);
    painel.desenhar = desenharResultado;
    som.fim(); salvarPartida();
  }
  painel.atualizar();
}

function clicar(origem) {
  const ray = new THREE.Raycaster();
  if (origem === camera) ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  else { origem.updateMatrixWorld(); ray.ray.origin.setFromMatrixPosition(origem.matrixWorld); ray.ray.direction.set(0, 0, -1).applyQuaternion(origem.getWorldQuaternion(tmpQ)); }
  const hit = ray.intersectObject(painel.mesh)[0]; if (!hit) return;
  const id = painel.botaoEm(hit.uv); if (!id) return;
  som.clique(); vibrar(0.3, 40); acaoBotao(id);
}
function comecarFase(n) {
  jogo.fase = n;
  if (!prefs.tutorialVisto) { irPara('tutorial'); return; }
  if (!jogo.calibrado) { jogo.aposCalibrar = 'fase'; irPara('calibrar'); return; }
  if (n === 3) { irPara('intro3'); return; }
  if (!jogo.demoVista) { jogo.retornoDemo = 'jogar'; irPara('demo'); return; }
  irPara('jogar');
}
function acaoBotao(id) {
  audio(); if (prefs.musica) musica.iniciar();
  if (id.startsWith('setor:')) { jogo.setor = id.slice(6); painel.atualizar(); return; }
  if (id.startsWith('fase:')) { const n = +id.slice(5); if (faseLiberada(n)) { jogo.fase = n; painel.atualizar(); } return; }
  if (id === 'comecar') { comecarFase(jogo.fase); return; }
  if (id === 'tutorial') { irPara('tutorial'); return; }
  if (id === 'entendi') { prefs.tutorialVisto = true; salvarPrefs(); if (jogo.setor) comecarFase(jogo.fase); else irPara('lobby'); return; }
  if (id === 'recalibrar') { jogo.aposCalibrar = 'lobby'; irPara('calibrar'); return; }
  if (id === 'musica') { prefs.musica = !prefs.musica; salvarPrefs(); prefs.musica ? musica.iniciar() : musica.parar(); painel.atualizar(); return; }
  if (id === 'narracao') { prefs.narracao = !prefs.narracao; salvarPrefs(); if (!prefs.narracao) narrador.calar(); painel.atualizar(); return; }
  if (id === 'ranking') { jogo.abaRanking = jogo.fase; irPara('ranking'); return; }
  if (id.startsWith('aba:')) { jogo.abaRanking = id.slice(4) === 'setores' ? 'setores' : +id.slice(4); painel.atualizar(); return; }
  if (id === 'csv') { exportarCSV(); return; }
  if (id === 'pular') { pularDemo(); return; }
  if (id === 'denovo') { irPara(jogo.fase === 3 ? 'intro3' : 'jogar'); return; }
  if (id === 'proxima') { comecarFase(jogo.fase + 1); return; }
  if (id === 'demo') { jogo.retornoDemo = 'resultado'; irPara('demo'); return; }
  if (id === 'inicio' || id === 'voltar') { irPara('lobby'); return; }
  if (id === 'salvarRanking') { irPara('iniciais'); return; }
  if (/^l[0-2][+-]$/.test(id)) {
    const k = +id[1], A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', i = A.indexOf(jogo.iniciais[k]);
    jogo.iniciais[k] = A[(i + (id[2] === '+' ? 1 : 25)) % 26]; painel.atualizar(); return;
  }
  if (id === 'confirmarIniciais') {
    const ini = jogo.iniciais.join(''); prefs.iniciais = ini; salvarPrefs();
    if (jogo.ultimoRegistro) atualizarRegistro(jogo.ultimoRegistro.id, { iniciais: ini });
    jogo.abaRanking = jogo.fase; irPara('ranking'); return;
  }
  if (id === 'iniciar3') { irPara('jogar'); return; }
  if (id.startsWith('dec:')) { decidirFase3(id.slice(4)); return; }
  if (id === 'continuar3') { f3.etapa = 'carrinho'; painel.desenhar = desenharFase3; painelFase3(); painel.atualizar(); return; }
}
window.__clicar = acaoBotao;
function pularDemo() { if (jogo.estado === 'demo') { jogo.demoVista = true; irPara(jogo.retornoDemo); } }

function atualizarHover() {
  let alvoId = null; const ray = new THREE.Raycaster();
  const fontes = renderer.xr.isPresenting ? maos.map(m => m.ray) : [camera];
  for (const o of fontes) {
    if (o === camera) ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    else { ray.ray.origin.setFromMatrixPosition(o.matrixWorld); ray.ray.direction.set(0, 0, -1).applyQuaternion(o.getWorldQuaternion(tmpQ)); }
    const hit = painel.mesh.visible ? ray.intersectObject(painel.mesh)[0] : null;
    if (o !== camera) { const m = maos.find(mm => mm.ray === o); m.linha.scale.z = hit ? hit.distance : 3; m.linha.visible = !!hit || !['jogar'].includes(jogo.estado); }
    if (hit) alvoId = painel.botaoEm(hit.uv) || alvoId;
  }
  if (alvoId !== painel.hover) { painel.hover = alvoId; painel.atualizar(); }
}

// ================================================================== telas
const W = 1275;
function cabecalho(c, tag, titulo, corTag = COR.amarelo) {
  texto_(c, tag, 70, 88, '700 28px Poppins', corTag);
  texto_(c, titulo, 66, 160, '700 60px Poppins', COR.branco);
}
function desenharLobby(c, p) {
  p.fundo(c);
  texto_(c, 'TREINAMENTO DE ERGONOMIA · BRAIAN TECH', 70, 80, '700 26px Poppins', COR.amarelo);
  texto_(c, 'Mestre do Levantamento', 66, 148, '700 60px Poppins', COR.branco);
  texto_(c, '1. Seu setor', 70, 214, '600 28px Poppins', COR.suave);
  SETORES.forEach((s, i) => p.botao(c, 'setor:' + s, 70 + i * 228, 232, 214, 62, s, { ativo: jogo.setor === s }));
  texto_(c, '2. Escolha a fase', 70, 352, '600 28px Poppins', COR.suave);
  FASES.forEach((F, i) => {
    const x = 70 + i * 385, y = 372, w = 365, h = 190, lib = faseLiberada(F.n), sel = jogo.fase === F.n, hov = p.hover === 'fase:' + F.n;
    rrect(c, x, y, w, h, 24, sel ? 'rgba(245,196,0,0.16)' : hov ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)');
    c.strokeStyle = sel ? COR.amarelo : 'rgba(255,255,255,0.18)'; c.lineWidth = sel ? 5 : 3; rrectPath(c, x + 2, y + 2, w - 4, h - 4, 22); c.stroke();
    texto_(c, `FASE ${F.n}`, x + 26, y + 46, '700 24px Poppins', lib ? COR.amarelo : COR.apagado);
    texto_(c, F.curto, x + 26, y + 92, '700 36px Poppins', lib ? COR.branco : COR.apagado);
    texto_(c, `Caixa de ${F.kg} kg`, x + 26, y + 130, '400 24px Poppins', lib ? COR.suave : COR.apagado);
    if (lib) { const m = melhorDaFase(F.n); estrelas(c, x + 44, y + 160, estrelasDe(m), 34); if (m >= 0) texto_(c, `${m}`, x + w - 26, y + 168, '600 26px Poppins', COR.suave, 'right'); }
    else texto_(c, 'Conclua a fase anterior', x + 26, y + 168, '400 22px Poppins', COR.apagado);
    p.botoes.push({ id: 'fase:' + F.n, x, y, w, h });
  });
  const ok = !!jogo.setor;
  p.botao(c, ok ? 'comecar' : 'x', 70, 600, 420, 84, ok ? `Começar a fase ${jogo.fase}` : 'Escolha o seu setor', { ativo: ok, desab: !ok });
  p.botao(c, 'ranking', 510, 600, 220, 84, 'Ranking');
  p.botao(c, 'tutorial', 750, 600, 220, 84, 'Tutorial');
  p.botao(c, 'recalibrar', 990, 600, 215, 84, 'Recalibrar');
  p.botao(c, 'musica', 70, 712, 260, 64, `Música: ${prefs.musica ? 'sim' : 'não'}`);
  p.botao(c, 'narracao', 350, 712, 300, 64, `Narração: ${prefs.narracao ? 'sim' : 'não'}`);
  if (!renderer.xr.isPresenting) p.botao(c, 'csv', 670, 712, 330, 64, 'Relatório (CSV)');
  texto_(c, renderer.xr.isPresenting ? 'Aponte e aperte o gatilho para escolher.' : 'PC: clique para mirar · WASD anda · C agacha · E segura · espaço pula', 70, 812, '400 24px Poppins', COR.apagado);
}
function desenharTutorial(c, p) {
  p.fundo(c);
  cabecalho(c, 'ANTES DE COMEÇAR', 'Como jogar');
  // controle Touch desenhado
  const cx = 300, cy = 470;
  c.save(); c.translate(cx, cy);
  rrect(c, -70, -40, 140, 260, 60, '#2a2f38');
  c.beginPath(); c.ellipse(0, -90, 115, 95, 0, 0, Math.PI * 2); c.lineWidth = 22; c.strokeStyle = '#2a2f38'; c.stroke();
  bolinha(c, -24, 10, 18, '#5b6270'); bolinha(c, 26, 46, 18, '#5b6270'); bolinha(c, -20, 70, 16, '#3c424d');
  rrect(c, 52, 30, 22, 90, 10, COR.amarelo);    // grip
  rrect(c, -10, -52, 44, 26, 10, COR.verde);     // gatilho
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 3;
  const seta = (x1, y1, x2, y2) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  seta(cx + 34, cy - 40, 520, 300); seta(cx + 74, cy + 75, 520, 450); seta(cx + 26, cy + 46, 520, 600);
  const item = (y, cor, t1, t2) => { bolinha(c, 540, y - 10, 14, cor); texto_(c, t1, 570, y, '700 34px Poppins', COR.branco); texto_(c, t2, 570, y + 42, '400 26px Poppins', COR.suave); };
  item(300, COR.verde, 'Gatilho (indicador)', 'Aponte para o painel e aperte para escolher.');
  item(450, COR.amarelo, 'Botão lateral (grip) nas duas mãos', 'Segura a caixa. Soltar = largar a caixa.');
  item(600, '#5b6270', 'Botão B ou Y', 'Pula a demonstração do instrutor.');
  texto_(c, 'Sem controles? Use as mãos: feche a mão para segurar.', 70, 718, '400 26px Poppins', COR.suave);
  texto_(c, 'Libere um espaço de 2 × 2 m: você vai agachar e andar.', 70, 758, '400 26px Poppins', COR.suave);
  p.botao(c, 'entendi', W - 330, 690, 260, 84, 'Entendi', { ativo: true });
}
function desenharCalibrar(c, p) {
  p.fundo(c);
  const t = agoraS() - jogo.calibInicio, falta = Math.max(0, 3 - t);
  cabecalho(c, 'CALIBRAÇÃO', 'Fique em pé, reto');
  texto_(c, 'Olhe para a frente. Medimos sua altura para avaliar a postura.', 70, 230, '400 32px Poppins', COR.suave);
  texto_(c, falta > 0 ? String(Math.ceil(falta)) : 'Pronto!', W / 2, 560, '700 200px Poppins', COR.amarelo, 'center');
}
function desenharDemo(c, p) {
  p.fundo(c, COR.verde);
  texto_(c, 'ASSISTA AO INSTRUTOR', 70, 88, '700 28px Poppins', COR.verde);
  texto_(c, 'Jeito certo, passo a passo', 66, 156, '700 54px Poppins', COR.branco);
  const passo = PASSOS_DEMO.filter(s => jogo.demoT >= s[0]).at(-1);
  quebrar(c, passo[1], W - 140, '600 48px Poppins').forEach((l, i) => texto_(c, l, 70, 290 + i * 64, '600 48px Poppins', COR.amarelo));
  for (let i = 0; i < 7; i++) {
    const x = 96 + i * 100, y = 500, feito = jogo.demoT >= PASSOS_DEMO[i + 1][0];
    bolinha(c, x, y, 32, feito ? COR.verde : 'rgba(255,255,255,0.12)');
    texto_(c, String(i + 1), x, y + 2, '700 30px Poppins', feito ? COR.ink : COR.cinza, 'center', 'middle');
  }
  rrect(c, 70, 580, W - 140, 14, 7, 'rgba(255,255,255,0.15)');
  rrect(c, 70, 580, (W - 140) * clamp(jogo.demoT / DURACAO_DEMO), 14, 7, COR.verde);
  p.botao(c, 'pular', 70, 660, 520, 84, renderer.xr.isPresenting ? 'Pular demonstração (B)' : 'Pular (barra de espaço)');
}
function desenharJogar(c, p) {
  const F = FASES[jogo.fase - 1];
  p.fundo(c);
  texto_(c, `FASE ${F.n} · ${F.nome.toUpperCase()}`, 70, 88, '700 28px Poppins', COR.amarelo);
  texto_(c, `Caixa ${Math.min(jogo.caixaAtual + 1, CONFIG.caixas)} de ${CONFIG.caixas}`, 66, 168, '700 66px Poppins', COR.branco);
  F.passos.forEach((l, i) => {
    bolinha(c, 94, 252 + i * 74, 24, COR.amarelo);
    texto_(c, String(i + 1), 94, 254 + i * 74, '700 26px Poppins', COR.ink, 'center', 'middle');
    texto_(c, l, 136, 263 + i * 74, '400 32px Poppins', COR.branco);
  });
  const ult = jogo.resultados.at(-1);
  if (ult) {
    texto_(c, `Caixa ${jogo.resultados.length}: ${Math.round(ult.total)} pontos`, 70, 540, '600 36px Poppins', COR.branco);
    F.criterios.forEach((cr, i) => {
      const x = 70 + (i % 3) * 400, y = 580 + Math.floor(i / 3) * 60;
      bolinha(c, x + 14, y + 20, 14, corNota(ult.notas[cr.id])); texto_(c, cr.nome, x + 40, y + 30, '400 28px Poppins', COR.suave);
    });
  }
}
function desenharIntro3(c, p) {
  p.fundo(c, COR.vermelho);
  cabecalho(c, 'FASE 3 · CARGA PESADA', 'Avalie antes de levantar', COR.vermelho);
  paragrafo(c, 'Nesta fase você encontra uma caixa de 28 kg. Antes de pegar, decida a forma mais segura de transportá-la. Depois, faça o transporte do jeito certo.', 70, 250, W - 140, '400 34px Poppins', COR.suave, 50);
  paragrafo(c, 'A NR-17 (item 17.5.4) pede meios técnicos facilitadores, como carrinhos, para reduzir o esforço no transporte manual de cargas.', 70, 440, W - 140, '400 30px Poppins', COR.apagado, 44);
  p.botao(c, 'iniciar3', 70, 650, 360, 90, 'Começar', { ativo: true });
  p.botao(c, 'voltar', 450, 650, 240, 90, 'Voltar');
}
function desenharFase3(c, p) {
  p.fundo(c, f3.etapa === 'decidir' ? COR.vermelho : COR.amarelo);
  if (f3.etapa === 'decidir') {
    cabecalho(c, 'FASE 3 · DECISÃO', 'Esta caixa pesa 28 kg', COR.vermelho);
    texto_(c, 'O que você faz?', 70, 240, '600 40px Poppins', COR.suave);
    p.botao(c, 'dec:sozinho', 70, 300, 1135, 100, 'Levanto sozinho, com cuidado');
    p.botao(c, 'dec:colega', 70, 425, 1135, 100, 'Chamo um colega para levantar comigo');
    p.botao(c, 'dec:carrinho', 70, 550, 1135, 100, 'Uso o carrinho de carga');
  } else if (f3.etapa === 'feedback') {
    const d = DECISOES[f3.decisao];
    cabecalho(c, 'FASE 3 · DECISÃO', d.titulo, d.cor);
    paragrafo(c, d.texto, 70, 250, W - 140, '400 34px Poppins', COR.suave, 50);
    p.botao(c, 'continuar3', 70, 650, 420, 90, 'Usar o carrinho', { ativo: true });
  } else {
    texto_(c, 'FASE 3 · CARGA PESADA', 70, 88, '700 28px Poppins', COR.amarelo);
    texto_(c, f3.etapa === 'carregado' ? 'Empurre até a área verde' : 'Leve o carrinho até a caixa', 66, 160, '700 54px Poppins', COR.branco);
    FASES[2].passos.forEach((l, i) => {
      const feito = (i === 0 && f3.etapa === 'carregado') || (i === 1 && f3.etapa === 'carregado');
      bolinha(c, 94, 252 + i * 74, 24, feito ? COR.verde : COR.amarelo);
      texto_(c, feito ? '✓' : String(i + 1), 94, 254 + i * 74, '700 26px Poppins', COR.ink, 'center', 'middle');
      texto_(c, l, 136, 263 + i * 74, '400 32px Poppins', COR.branco);
    });
    texto_(c, 'Segure a alça com as duas mãos (grip) e ande empurrando.', 70, 520, '400 30px Poppins', COR.suave);
    texto_(c, 'Tronco ereto, braços perto do corpo, sem puxar.', 70, 566, '400 30px Poppins', COR.suave);
  }
}
function desenharResultado(c, p) {
  const F = FASES[jogo.fase - 1], tot = mediaFinal();
  p.fundo(c);
  texto_(c, `RESULTADO · FASE ${F.n} · ${F.nome.toUpperCase()}`, 70, 88, '700 28px Poppins', COR.amarelo);
  texto_(c, `${Math.round(tot.total)}`, 66, 210, '700 124px Poppins', COR.branco);
  texto_(c, '/ 100', 66 + c.measureText(`${Math.round(tot.total)}`).width + 20, 210, '400 40px Poppins', COR.apagado);
  estrelas(c, 560, 160, estrelasDe(tot.total), 74);
  F.criterios.forEach((cr, i) => {
    const y = 262 + i * 62, n = tot.notas[cr.id];
    texto_(c, cr.nome, 70, y + 30, '400 30px Poppins', COR.branco);
    rrect(c, 470, y + 8, 620, 28, 14, 'rgba(255,255,255,0.12)');
    rrect(c, 470, y + 8, Math.max(28, 620 * n / 100), 28, 14, corNota(n));
    texto_(c, String(Math.round(n)), 1200, y + 32, '600 30px Poppins', COR.branco, 'right');
  });
  const pior = F.criterios.reduce((a, b) => (tot.notas[b.id] < tot.notas[a.id] ? b : a));
  const dicaTxt = tot.notas[pior.id] >= 85 ? 'Excelente! Você fez do jeito certo.' : 'Dica: ' + F.dicas[pior.id];
  paragrafo(c, dicaTxt, 70, 600, W - 140, '600 30px Poppins', COR.amarelo, 40);
  const prox = F.n < 3;
  p.botao(c, 'salvarRanking', 70, 700, 300, 84, 'Salvar no ranking', { ativo: true });
  p.botao(c, 'denovo', 390, 700, 250, 84, 'Jogar de novo');
  if (prox) p.botao(c, 'proxima', 660, 700, 270, 84, 'Próxima fase');
  else if (F.n !== 3) p.botao(c, 'demo', 660, 700, 270, 84, 'Ver instrutor');
  p.botao(c, 'inicio', 950, 700, 255, 84, 'Início');
}
function desenharIniciais(c, p) {
  p.fundo(c);
  cabecalho(c, 'RANKING', 'Suas iniciais');
  texto_(c, `Setor: ${jogo.setor || '—'} · Fase ${jogo.fase} · ${jogo.ultimoRegistro ? jogo.ultimoRegistro.nota : ''} pontos`, 70, 230, '400 30px Poppins', COR.suave);
  for (let k = 0; k < 3; k++) {
    const x = 330 + k * 220;
    p.botao(c, `l${k}+`, x, 270, 160, 80, '▲');
    rrect(c, x, 370, 160, 170, 24, 'rgba(255,255,255,0.1)');
    texto_(c, jogo.iniciais[k], x + 80, 460, '700 120px Poppins', COR.amarelo, 'center', 'middle');
    p.botao(c, `l${k}-`, x, 560, 160, 80, '▼');
  }
  p.botao(c, 'confirmarIniciais', 70, 700, 380, 84, 'Salvar', { ativo: true });
  p.botao(c, 'inicio', 470, 700, 260, 84, 'Pular');
}
function desenharRanking(c, p) {
  p.fundo(c);
  cabecalho(c, 'RANKING NESTE APARELHO', jogo.abaRanking === 'setores' ? 'Média por setor' : `Top 10 · Fase ${jogo.abaRanking}`);
  [1, 2, 3].forEach((n, i) => p.botao(c, 'aba:' + n, 70 + i * 190, 200, 170, 60, `Fase ${n}`, { ativo: jogo.abaRanking === n }));
  p.botao(c, 'aba:setores', 640, 200, 220, 60, 'Setores', { ativo: jogo.abaRanking === 'setores' });
  const regs = resultadosSalvos();
  c.font = '400 28px Poppins';
  if (jogo.abaRanking === 'setores') {
    texto_(c, 'Setor', 90, 315, '600 26px Poppins', COR.apagado); texto_(c, 'Partidas', 620, 315, '600 26px Poppins', COR.apagado); texto_(c, 'Média', 1180, 315, '600 26px Poppins', COR.apagado, 'right');
    SETORES.forEach((s, i) => {
      const rs = regs.filter(r => r.setor === s), m = rs.length ? rs.reduce((a, r) => a + r.nota, 0) / rs.length : null, y = 365 + i * 58;
      texto_(c, s, 90, y, '600 32px Poppins', COR.branco); texto_(c, String(rs.length), 620, y, '400 32px Poppins', COR.suave);
      texto_(c, m === null ? '—' : String(Math.round(m)), 1180, y, '700 32px Poppins', m === null ? COR.apagado : corNota(m), 'right');
    });
  } else {
    const top = regs.filter(r => r.fase === jogo.abaRanking).sort((a, b) => b.nota - a.nota || a.data.localeCompare(b.data)).slice(0, 10);
    if (!top.length) texto_(c, 'Ninguém jogou esta fase ainda.', 90, 360, '400 32px Poppins', COR.suave);
    top.forEach((r, i) => {
      const y = 320 + i * 42;
      texto_(c, `${i + 1}º`, 90, y, '700 28px Poppins', i < 3 ? COR.amarelo : COR.suave);
      texto_(c, r.iniciais || '---', 170, y, '700 28px Poppins', COR.branco);
      texto_(c, r.setor || '—', 300, y, '400 28px Poppins', COR.suave);
      texto_(c, new Date(r.data).toLocaleDateString('pt-BR'), 760, y, '400 26px Poppins', COR.apagado);
      texto_(c, String(r.nota), 1180, y, '700 28px Poppins', corNota(r.nota), 'right');
    });
  }
  p.botao(c, 'voltar', 70, 750, 260, 74, 'Voltar');
}

// ================================================================== montagem das fases
let av = null;  // estado da caixa/tarefa atual
let F12 = null; // geometria das fases 1 e 2
const f3 = { etapa: 'decidir', decisao: null };
const DECISOES = {
  sozinho: { nota: 0, cor: COR.vermelho, titulo: 'Não é seguro', texto: 'Uma caixa de 28 kg é pesada demais para levantar sozinho com segurança. Quando existe um meio técnico, como o carrinho, use-o (NR-17, item 17.5.4).' },
  colega: { nota: 60, cor: COR.laranja, titulo: 'Melhor, mas não o ideal', texto: 'Levantar em dupla divide o peso, mas aqui existe um carrinho de carga disponível. Ele é a opção mais segura e evita o esforço de levantar.' },
  carrinho: { nota: 100, cor: COR.verde, titulo: 'Isso mesmo!', texto: 'Usar meios técnicos é a forma mais segura de mover cargas pesadas (NR-17, item 17.5.4). Agora leve o carrinho até a caixa.' },
};

function montarFase(n, cab, yaw) {
  fase.clear();
  const frente = dirDe(yaw), direita = new THREE.Vector3(-frente.z, 0, frente.x), esquerda = direita.clone().negate();
  const base = new THREE.Vector3(cab.x, 0, cab.z);
  F12 = { frente, direita, yaw, base };
  if (n === 1) {
    const banc = criarBancada(frente); const { topo, curto, longo } = banc.userData;
    const pb = base.clone().addScaledVector(direita, 0.75 + curto / 2); banc.position.copy(pb); fase.add(banc);
    const s = sombra(longo * 0.65); s.position.set(pb.x, 0.004, pb.z); fase.add(s);
    const alvo = new THREE.Mesh(new THREE.PlaneGeometry(curto * 0.9, longo * 0.9), new THREE.MeshBasicMaterial({ color: COR.verde, transparent: true, opacity: 0.35, depthWrite: false }));
    alvo.rotation.set(-Math.PI / 2, 0, yaw); alvo.position.set(pb.x, topo + 0.004, pb.z); fase.add(alvo);
    Object.assign(F12, { posCaixa: base.clone().addScaledVector(frente, 0.45), banc: { centro: pb, topo, eixoLongo: frente, meioLongo: longo / 2, meioCurto: curto / 2, passo: Math.min(0.44, Math.max(0, (longo - 0.42) / 2)) } });
    marcaChao.position.set(F12.posCaixa.x, 0.006, F12.posCaixa.z); fase.add(marcaChao);
  } else if (n === 2) {
    const banc = criarBancada(direita); const { topo, curto, longo } = banc.userData;
    const pb = base.clone().addScaledVector(frente, 0.5 + curto / 2); banc.position.copy(pb); fase.add(banc);
    const s = sombra(longo * 0.65); s.position.set(pb.x, 0.004, pb.z); fase.add(s);
    const zc = base.clone().addScaledVector(direita, 1.0).addScaledVector(frente, 0.15);
    const zona = zonaChao(0.7, 0.6, COR.amarelo); zona.position.copy(zc); zona.rotation.y = yaw; fase.add(zona);
    Object.assign(F12, { banc: { centro: pb, topo, eixoLongo: direita, meioLongo: longo / 2, meioCurto: curto / 2 }, zona: { centro: zc, meioF: 0.35, meioD: 0.3 }, posCaixa: pb.clone().addScaledVector(frente, -0.05) });
  } else {
    montarFase3(base, frente, direita, esquerda, yaw);
    return;
  }
  iniciarCaixa();
}

function iniciarCaixa() {
  const cx = criarCaixa(TAM_CAIXA, matCaixa);
  const p = F12.posCaixa;
  if (jogo.fase === 1) { cx.position.set(p.x, TAM_CAIXA.y / 2, p.z); cx.userData.estado = 'chao'; }
  else { cx.position.set(p.x, F12.banc.topo + TAM_CAIXA.y / 2, p.z); cx.userData.estado = 'bancada'; cx.userData.sombra.visible = false; }
  cx.rotation.y = F12.yaw;
  cx.userData.sombra.position.set(cx.position.x, 0.004, cx.position.z);
  av = {
    caixa: cx, segurando: false, quedas: 0, fora: 0, p0: null, pega: null, solta: null, levantando: false, vMax: 0, vDesce: 0, ultimaY: null,
    dists: [], amostrasGiro: [], torcoes: 0, ultimoGiro: 0, alertaDescida: 0, giroAte: 0, histY: [],
  };
}

function classificar(v, bom, atencao, menorMelhor = true) {
  if (menorMelhor) return v <= bom ? 'bom' : v <= atencao ? 'atencao' : 'ruim';
  return v >= bom ? 'bom' : v >= atencao ? 'atencao' : 'ruim';
}
const piorCls = (...cs) => (cs.includes('ruim') ? 'ruim' : cs.includes('atencao') ? 'atencao' : 'bom');
function velocidade(hist, agora, valor, janela = 0.25) {
  hist.push([agora, valor]); while (hist.length > 2 && agora - hist[0][0] > janela) hist.shift();
  const [t0, v0] = hist[0]; return agora - t0 > 0.05 ? (valor - v0) / (agora - t0) : 0;
}
const deslocFrente = (p0, cab) => (p0 ? new THREE.Vector3(cab.x - p0.x, 0, cab.z - p0.z).dot(pose.frenteH) : 0);

// ---------------------------------------------------------------- fases 1 e 2 (levantamento)
function avaliarLevantamento(dt, agora) {
  if (!av) return;
  const h0 = jogo.h0, cab = pose.cabeca, cx = av.caixa, tam = cx.userData.tam;
  const emPe = cab.y > 0.88 * h0;
  if (emPe) av.p0 = cab.clone();
  const vy = velocidade(av.histY, agora, cab.y);
  if (av.levantando) av.vMax = Math.max(av.vMax, vy);
  const mid = new THREE.Vector3().addVectors(pose.maos[0], pose.maos[1]).multiplyScalar(0.5);
  const perto = m => m.distanceTo(cx.position) < Math.max(tam.x, tam.z) * 0.5 + 0.16;
  const baixo = cab.y < 0.82 * h0;
  const desloc = deslocFrente(av.p0, cab);
  // indicadores ao vivo de coluna e joelhos quando está abaixado
  if (baixo) {
    marcarVivo('coluna', classificar(pose.pitch * 57.3, 45, 62));
    marcarVivo('joelhos', classificar(desloc, 0.22, 0.35));
  } else { marcarVivo('coluna', null); marcarVivo('joelhos', null); }
  marcarVivo('torcao', agora < av.giroAte ? 'ruim' : av.segurando ? 'bom' : null);

  if (!av.segurando) {
    marcarVivo('perto', null); marcarVivo('ritmo', null);
    const dCaixa = horiz(cx.position, cab);
    if (cx.userData.estado === 'chao' && dCaixa < 1.0 && baixo && agora - av.alertaDescida > 2.2) {
      if (pose.pitch * 57.3 > 62) { dica('Olhe para a frente · coluna reta'); av.alertaDescida = agora; }
      else if (desloc > 0.32) { dica('Dobre os joelhos, não a coluna'); av.alertaDescida = agora; }
    }
    const pegavel = cx.userData.estado === 'chao' || cx.userData.estado === 'bancada';
    if (pegavel && pose.aperto[0] && pose.aperto[1] && perto(pose.maos[0]) && perto(pose.maos[1])) {
      const doChao = cx.userData.estado === 'chao';
      av.segurando = true; cx.userData.estado = 'mao'; cx.userData.sombra.visible = true;
      const f = new THREE.Vector3(cx.position.x - cab.x, 0, cx.position.z - cab.z).dot(pose.frenteH);
      if (doChao && (jogo.fase === 1 || !av.pega)) av.pega = { pitch: pose.pitch * 57.3, frente: f, desloc, queda: (h0 - cab.y) / h0, t: agora, doChao };
      if (!av.pega) av.pega = { pitch: 0, frente: 0.3, desloc: 0, queda: 0, t: agora, doChao };
      av.tPega = agora; av.levantando = doChao; av.vMax = 0; av.dists = []; av.amostrasGiro = []; av.vDesce = 0;
      som.clique(); vibrar(0.4, 60);
    } else if (pegavel && pose.aperto[0] !== pose.aperto[1] && (perto(pose.maos[0]) || perto(pose.maos[1])) && agora - av.alertaDescida > 2) {
      dica('Segure com as duas mãos', COR.laranja); av.alertaDescida = agora;
    }
  } else {
    cx.position.lerp(mid, clamp(dt * 30));
    const lado = new THREE.Vector3().subVectors(pose.maos[1], pose.maos[0]); lado.y = 0;
    if (lado.length() > 0.1) cx.rotation.y = Math.atan2(-lado.z, lado.x);
    cx.userData.sombra.position.set(cx.position.x, 0.004, cx.position.z);
    if (av.levantando && emPe) av.levantando = false;
    const d = horiz(mid, cab);
    if (agora - av.tPega > 0.4 && !av.levantando && cx.position.y > 0.45) {
      av.dists.push(d);
      marcarVivo('perto', classificar(d, 0.40, 0.52));
      if (d > 0.52 && agora - av.alertaDescida > 2.2) { dica('Traga a caixa para perto do corpo'); av.alertaDescida = agora; }
    }
    // descendo com a caixa (fase 2)
    if (jogo.fase === 2 && cx.position.y < 0.7) av.vDesce = Math.max(av.vDesce, -vy);
    const vAtual = Math.abs(vy);
    marcarVivo('ritmo', classificar(vAtual, 1.2, 1.6));
    // torção
    av.amostrasGiro.push({ t: agora, yaw: pose.yaw, x: cab.x, z: cab.z });
    while (av.amostrasGiro.length && agora - av.amostrasGiro[0].t > 1.0) av.amostrasGiro.shift();
    const a0 = av.amostrasGiro[0];
    if (a0 && agora - av.ultimoGiro > 1.4) {
      let dy = pose.yaw - a0.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      if (Math.abs(dy) > 50 / 57.3 && Math.hypot(cab.x - a0.x, cab.z - a0.z) < 0.12) {
        av.torcoes++; av.ultimoGiro = agora; av.amostrasGiro = []; av.giroAte = agora + 2; dica('Gire com os pés, não o tronco');
      }
    }
    if (!pose.aperto[0] || !pose.aperto[1]) soltarCaixa(cab, desloc);
  }
  if (cx.userData.estado === 'caindo') {
    cx.position.y = Math.max(tam.y / 2, cx.position.y - dt * 3);
    if (cx.position.y <= tam.y / 2 + 1e-3) cx.userData.estado = 'chao';
  }
}

function soltarCaixa(cab, desloc) {
  const cx = av.caixa, tam = cx.userData.tam, b = F12.banc;
  av.segurando = false;
  const fundoCaixa = cx.position.y - tam.y / 2;
  const relB = new THREE.Vector3(cx.position.x - b.centro.x, 0, cx.position.z - b.centro.z);
  const eixoCurto = new THREE.Vector3(-b.eixoLongo.z, 0, b.eixoLongo.x);
  const sobreBancada = Math.abs(relB.dot(eixoCurto)) < b.meioCurto + 0.12 && Math.abs(relB.dot(b.eixoLongo)) < b.meioLongo + 0.05 && fundoCaixa > b.topo - 0.15;
  if (sobreBancada) {
    cx.position.set(b.centro.x, b.topo + tam.y / 2, b.centro.z);
    cx.rotation.y = F12.yaw; cx.userData.sombra.visible = false;
    if (jogo.fase === 1) { cx.position.addScaledVector(b.eixoLongo, (jogo.caixaAtual - 1) * b.passo); cx.userData.estado = 'entregue'; finalizarCaixa(); }
    else { cx.position.copy(F12.posCaixa).setY(b.topo + tam.y / 2); cx.userData.estado = 'bancada'; }
    return;
  }
  if (jogo.fase === 2 && F12.zona) {
    const z = F12.zona, rel = new THREE.Vector3(cx.position.x - z.centro.x, 0, cx.position.z - z.centro.z);
    const naZona = Math.abs(rel.dot(F12.frente)) < z.meioF + 0.1 && Math.abs(rel.dot(F12.direita)) < z.meioD + 0.1;
    if (naZona || fundoCaixa < 0.22) {
      if (naZona) { // na área: conta como depositada (soltar de cima pesa no critério "sem trancos")
        const f = new THREE.Vector3(cx.position.x - cab.x, 0, cx.position.z - cab.z).dot(pose.frenteH);
        av.solta = { pitch: pose.pitch * 57.3, frente: f, desloc, queda: (jogo.h0 - cab.y) / jogo.h0, altura: Math.max(0, fundoCaixa) };
        cx.userData.estado = 'entregue';
        if (fundoCaixa > 0.22) dica('Soltou de cima! Apoie a caixa no chão.', COR.laranja);
        finalizarCaixa();
        // abre espaço na zona: a caixa vai para a pilha ao lado
        const k = jogo.caixaAtual - 1;
        const destino = z.centro.clone().addScaledVector(F12.direita, 0.62).addScaledVector(F12.frente, (k - 1) * 0.36);
        const pousada = new THREE.Vector3(cx.position.x, tam.y / 2, cx.position.z);
        animarPara(cx, pousada, Math.min(0.4, 0.1 + fundoCaixa * 0.6));
        setTimeout(() => animarPara(cx, new THREE.Vector3(destino.x, tam.y / 2, destino.z), 0.6), 700);
        return;
      }
      av.fora++; cx.position.y = tam.y / 2; cx.userData.estado = 'chao'; dica('Fora da área amarela. Pegue de novo.', COR.laranja); return;
    }
  }
  av.quedas++; cx.userData.estado = 'caindo'; dica('Você soltou a caixa! Pegue de novo.', COR.laranja);
}
const animacoes = [];
function animarPara(obj, destino, dur) { animacoes.push({ obj, de: obj.position.clone(), para: destino, t0: agoraS(), dur }); }

function finalizarCaixa() {
  const ref = jogo.fase === 1 ? av.pega : (av.solta || av.pega);
  const coluna = piorCls(classificar(ref.pitch, 45, 62), classificar(ref.frente, 0.15, 0.05, false));
  const joelhos = ref.desloc <= 0.22 && ref.queda >= 0.25 ? 'bom' : ref.desloc <= 0.35 ? 'atencao' : 'ruim';
  const dm = av.dists.length ? av.dists.reduce((a, b) => a + b, 0) / av.dists.length : 0.35;
  const perto = classificar(dm, 0.40, 0.52);
  const torcao = av.torcoes === 0 ? 'bom' : av.torcoes === 1 ? 'atencao' : 'ruim';
  const quedas = av.quedas + (jogo.fase === 2 ? av.fora * 0.5 : 0);
  const ritmo = jogo.fase === 1
    ? piorCls(classificar(av.vMax, 1.2, 1.6), quedas === 0 ? 'bom' : quedas <= 1 ? 'atencao' : 'ruim')
    : piorCls(classificar(av.vDesce, 1.2, 1.6), classificar(ref.altura ?? 0, 0.10, 0.20), quedas === 0 ? 'bom' : quedas <= 1 ? 'atencao' : 'ruim');
  const cls = { coluna, joelhos, perto, torcao, ritmo };
  const notas = Object.fromEntries(Object.entries(cls).map(([k, v]) => [k, NOTA[v]]));
  const total = CRIT_LEVANTAR.reduce((s, cr) => s + cr.peso * notas[cr.id], 0);
  jogo.resultados.push({ notas, cls, total, medidas: { ...ref, distMedia: dm, vMax: av.vMax, vDesce: av.vDesce, torcoes: av.torcoes, quedas: av.quedas, fora: av.fora } });
  som.ok(); vibrar(0.5, 80);
  dica(total >= 85 ? 'Muito bem! Caixa entregue.' : 'Caixa entregue', total >= 85 ? COR.verde : COR.laranja, 1.6, false);
  jogo.caixaAtual++;
  if (jogo.caixaAtual >= CONFIG.caixas) { av = null; setTimeout(() => irPara('resultado'), 1400); }
  else iniciarCaixa();
  painel.atualizar();
}

// ---------------------------------------------------------------- fase 3 (carga pesada + carrinho)
function montarFase3(base, frente, direita, esquerda, yaw) {
  Object.assign(f3, { etapa: 'decidir', decisao: null, segurando: false, puxoes: 0, tempoPuxando: 0, tempoRuim: 0, tempoEmpurrando: 0, vMax: 0, ultimaPos: null, alerta: 0, tentouLevantar: 0, velAte: 0 });
  const caixa = criarCaixa(TAM_PESADA, matPesada);
  const pc0 = base.clone().addScaledVector(frente, 1.0);
  caixa.position.set(pc0.x, TAM_PESADA.y / 2, pc0.z); caixa.rotation.y = yaw; caixa.userData.sombra.position.set(pc0.x, 0.004, pc0.z);
  const carrinho = criarCarrinho();
  const pcar = base.clone().addScaledVector(esquerda, 0.85).addScaledVector(frente, 0.25);
  carrinho.position.copy(pcar); carrinho.rotation.y = yaw; fase.add(carrinho);
  const destino = pc0.clone().addScaledVector(direita, 1.35).addScaledVector(frente, -0.2);
  const zona = new THREE.Mesh(new THREE.CircleGeometry(0.5, 40), new THREE.MeshBasicMaterial({ color: COR.verde, transparent: true, opacity: 0.3, depthWrite: false }));
  zona.rotation.x = -Math.PI / 2; zona.position.set(destino.x, 0.006, destino.z); fase.add(zona);
  const anel = new THREE.Mesh(new THREE.RingGeometry(0.47, 0.52, 48), new THREE.MeshBasicMaterial({ color: COR.verde }));
  anel.rotation.x = -Math.PI / 2; anel.position.set(destino.x, 0.007, destino.z); fase.add(anel);
  const rot = rotulo('28 kg', 'rgba(220,40,40,0.95)', 0.1, false); rot.position.set(pc0.x, TAM_PESADA.y + 0.35, pc0.z); fase.add(rot);
  Object.assign(f3, { caixa, carrinho, destino, rotuloPeso: rot, carregado: false, yawCarrinho: yaw });
  // painel de decisão acima da caixa
  painelAFrente(1.6, 0, 1.55);
}
function painelFase3() {
  const f = F12.frente, esq = new THREE.Vector3(f.z, 0, -f.x);
  const pp = F12.base.clone().addScaledVector(f, 1.7).addScaledVector(esq, 1.0); pp.y = 1.6; posicionarPainel(pp, pose.cabeca);
}
function decidirFase3(qual) {
  if (f3.etapa !== 'decidir') return;
  f3.decisao = qual; f3.etapa = 'feedback';
  if (qual === 'carrinho') som.ok(); else som.alerta();
  painel.atualizar();
}
function avaliarFase3(dt, agora) {
  if (f3.etapa === 'decidir' || f3.etapa === 'feedback' || f3.etapa === 'fim') return;
  const cab = pose.cabeca, car = f3.carrinho, h0 = jogo.h0;
  car.updateMatrixWorld();
  const pega = car.localToWorld(car.userData.pega.clone());
  const mid = new THREE.Vector3().addVectors(pose.maos[0], pose.maos[1]).multiplyScalar(0.5);
  // tentou levantar a caixa pesada com as mãos
  if (!f3.carregado && pose.aperto[0] && pose.aperto[1] && pose.maos[0].distanceTo(f3.caixa.position) < 0.5 && pose.maos[1].distanceTo(f3.caixa.position) < 0.5 && agora - f3.alerta > 2.5) {
    f3.tentouLevantar++; f3.alerta = agora; dica('Pesado demais! Use o carrinho.');
  }
  if (!f3.segurando) {
    marcarVivo('postura', null); marcarVivo('empurrar', null); marcarVivo('controle', null);
    if (pose.aperto[0] && pose.aperto[1] && pose.maos[0].distanceTo(pega) < 0.35 && pose.maos[1].distanceTo(pega) < 0.35) {
      f3.segurando = true; f3.histP = []; som.clique(); vibrar(0.4, 60);
    }
    return;
  }
  if (!pose.aperto[0] || !pose.aperto[1]) { f3.segurando = false; return; }
  // o carrinho fica à frente da pessoa: a alça acompanha as mãos
  const dirC = new THREE.Vector3(mid.x - cab.x, 0, mid.z - cab.z);
  if (dirC.length() > 0.12) {
    dirC.normalize();
    let alvoYaw = yawDe(dirC), dy = alvoYaw - f3.yawCarrinho; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    f3.yawCarrinho += dy * clamp(dt * 6);
  }
  const fwd = dirDe(f3.yawCarrinho);
  const alvo = new THREE.Vector3(mid.x, 0, mid.z).addScaledVector(fwd, 0.36);
  car.position.lerp(alvo, clamp(dt * 10)); car.rotation.y = f3.yawCarrinho;
  // medidas
  f3.histP.push([agora, car.position.clone()]); while (f3.histP.length > 2 && agora - f3.histP[0][0] > 0.3) f3.histP.shift();
  const [tp0, pp0] = f3.histP[0]; const v = agora - tp0 > 0.05 ? car.position.clone().sub(pp0).divideScalar(agora - tp0) : new THREE.Vector3(); v.y = 0;
  const vel = v.length(), vFrente = v.dot(fwd);
  if (vel > 0.15) f3.tempoEmpurrando += dt;
  f3.vMax = Math.max(f3.vMax, vel);
  const curvado = cab.y < 0.82 * h0 || pose.pitch * 57.3 > 45 || horiz(mid, cab) > 0.62;
  if (vel > 0.1 && curvado) f3.tempoRuim += dt;
  marcarVivo('postura', curvado ? 'ruim' : 'bom');
  if (vFrente < -0.2) { f3.tempoPuxando += dt; if (f3.tempoPuxando > 0.5) { f3.puxoes++; f3.tempoPuxando = 0; if (agora - f3.alerta > 2) { f3.alerta = agora; dica('Empurre o carrinho, não puxe'); } } }
  else f3.tempoPuxando = Math.max(0, f3.tempoPuxando - dt);
  marcarVivo('empurrar', vFrente < -0.2 ? 'ruim' : 'bom');
  if (vel > 1.6) { f3.velAte = agora + 1.5; if (agora - f3.alerta > 2) { f3.alerta = agora; dica('Devagar, com controle', COR.laranja); } }
  marcarVivo('controle', agora < f3.velAte ? 'ruim' : classificar(vel, 1.2, 1.6));
  if (curvado && vel > 0.1 && agora - f3.alerta > 2.5) { f3.alerta = agora; dica('Tronco ereto ao empurrar', COR.laranja); }
  // carregar a caixa quando o carrinho chega nela
  if (!f3.carregado && horiz(car.position, f3.caixa.position) < 0.62) {
    f3.carregado = true; f3.etapa = 'carregado';
    car.attach(f3.caixa); f3.caixa.position.set(0, 0.185 + TAM_PESADA.y / 2, -0.02); f3.caixa.rotation.set(0, 0, 0);
    f3.caixa.userData.sombra.visible = false; f3.rotuloPeso.visible = false;
    som.ok(); dica('Caixa no carrinho! Empurre até a área verde.', COR.verde, 2.2, false); painel.atualizar();
  }
  if (f3.carregado && horiz(car.position, f3.destino) < 0.45) {
    f3.etapa = 'fim'; f3.segurando = false; finalizarFase3();
  }
}
function finalizarFase3() {
  const decisao = DECISOES[f3.decisao]?.nota ?? 0;
  const frac = f3.tempoEmpurrando > 0 ? f3.tempoRuim / f3.tempoEmpurrando : 0;
  const postura = classificar(frac, 0.1, 0.3);
  const empurrar = f3.puxoes === 0 ? 'bom' : f3.puxoes === 1 ? 'atencao' : 'ruim';
  const controle = piorCls(classificar(f3.vMax, 1.8, 2.4), f3.tentouLevantar === 0 ? 'bom' : 'atencao');
  const notas = { decisao, postura: NOTA[postura], empurrar: NOTA[empurrar], controle: NOTA[controle] };
  const total = FASES[2].criterios.reduce((s, cr) => s + cr.peso * notas[cr.id], 0);
  jogo.resultados.push({ notas, cls: { postura, empurrar, controle }, total, medidas: { decisao: f3.decisao, fracCurvado: frac, puxoes: f3.puxoes, vMax: f3.vMax, tentouLevantar: f3.tentouLevantar } });
  som.ok(); dica('Carga entregue com segurança!', COR.verde, 1.6, false);
  setTimeout(() => irPara('resultado'), 1400);
}

function avaliar(dt, agora) {
  if (jogo.estado !== 'jogar') return;
  if (jogo.fase === 3) avaliarFase3(dt, agora); else avaliarLevantamento(dt, agora);
  const chave = JSON.stringify(vivo);
  if (chave !== vivoChave && agora - (jogo._tm || 0) > 0.15) { vivoChave = chave; jogo._tm = agora; medidor.atualizar(); }
}

// ================================================================== resultados, ranking e relatório
function mediaFinal() {
  const r = jogo.resultados, n = Math.max(r.length, 1), cr = FASES[jogo.fase - 1].criterios;
  return { notas: Object.fromEntries(cr.map(c => [c.id, r.reduce((s, x) => s + x.notas[c.id], 0) / n])), total: r.reduce((s, x) => s + x.total, 0) / n };
}
function salvarPartida() {
  const tot = mediaFinal();
  const reg = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), data: new Date().toISOString(), setor: jogo.setor, fase: jogo.fase, nota: Math.round(tot.total), criterios: Object.fromEntries(Object.entries(tot.notas).map(([k, v]) => [k, Math.round(v)])), iniciais: '---' };
  jogo.ultimoRegistro = reg; registrarResultado(reg);
  if (CONFIG.webhookUrl) fetch(CONFIG.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jogo: 'mestre-do-levantamento', ...reg, detalhes: jogo.resultados }) }).catch(() => {});
}
function exportarCSV() {
  const regs = resultadosSalvos();
  const cols = ['coluna', 'joelhos', 'perto', 'torcao', 'ritmo', 'decisao', 'postura', 'empurrar', 'controle'];
  const linhas = [['data', 'setor', 'iniciais', 'fase', 'nota', ...cols].join(';')];
  for (const r of regs) linhas.push([new Date(r.data).toLocaleString('pt-BR'), r.setor, r.iniciais, r.fase, r.nota, ...cols.map(k => r.criterios?.[k] ?? '')].join(';'));
  const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `relatorio-mestre-do-levantamento-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
window.__csv = () => resultadosSalvos();

// ================================================================== entrar no VR / realidade misturada
function botoesXR() {
  const caixa = document.createElement('div');
  caixa.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:12px;z-index:9;flex-wrap:wrap;justify-content:center';
  document.body.appendChild(caixa);
  const novo = (txt, cor) => { const b = document.createElement('button'); b.textContent = txt; b.style.cssText = `padding:16px 30px;border:0;border-radius:40px;background:${cor};color:#0e1116;font:700 19px Poppins,sans-serif;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.35)`; caixa.appendChild(b); return b; };
  if (!('xr' in navigator)) { const b = novo('Modo PC (VR não disponível neste navegador)', '#f5c400'); b.disabled = true; b.style.opacity = 0.85; return; }
  let sessao = null;
  const entrar = async (modo, botao, texto) => {
    audio(); if (prefs.musica) musica.iniciar();
    if (sessao) { sessao.end(); return; }
    const feats = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] };
    sessao = await navigator.xr.requestSession(modo === 'mr' ? 'immersive-ar' : 'immersive-vr', feats);
    jogo.modo = modo;
    scene.background = modo === 'mr' ? null : FUNDO; renderer.setClearAlpha(modo === 'mr' ? 0 : 1);
    sessao.addEventListener('end', () => { sessao = null; botao.textContent = texto; jogo.modo = 'vr'; scene.background = FUNDO; galpao.visible = true; irPara('lobby'); });
    await renderer.xr.setSession(sessao);
    botao.textContent = 'Sair';
    if (renderer.xr.setFoveation) renderer.xr.setFoveation(1);
    irPara('lobby');
  };
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    if (!ok) { const b = novo('Modo PC (abra no navegador do Quest para VR)', '#f5c400'); b.disabled = true; b.style.opacity = 0.85; return; }
    const bvr = novo('Entrar no VR', '#f5c400'); bvr.onclick = () => entrar('vr', bvr, 'Entrar no VR');
    navigator.xr.isSessionSupported('immersive-ar').then(okAr => {
      if (!okAr) return;
      const bmr = novo('Realidade misturada', '#22c55e'); bmr.onclick = () => entrar('mr', bmr, 'Realidade misturada');
    }).catch(() => {});
  }).catch(() => {});
}

// ================================================================== laço principal
const relogio = new THREE.Clock();
let bAntes = false;
function quadro() {
  const dt = Math.min(relogio.getDelta(), sim.ativo ? 0.25 : 0.05), agora = agoraS();
  lerPose(dt);
  const vr = renderer.xr.isPresenting;
  maoPC.forEach(m => { m.visible = !vr && !sim.ativo && jogo.estado === 'jogar'; });
  maos.forEach(m => {
    const temMao = !!m.fonte?.hand;
    m.ray.visible = vr; m.grip.visible = vr && !temMao;
    m.corpo.visible = !(m.modelo && m.modelo.children.length);
  });
  mira.style.display = vr ? 'none' : 'block';

  let b = false; for (const m of maos) b = b || !!m.fonte?.gamepad?.buttons?.[5]?.pressed;
  if (b && !bAntes) pularDemo(); bAntes = b;

  if (jogo.estado === 'calibrar') {
    const t = agora - jogo.calibInicio;
    if (t > 2.0) jogo.calibAmostras.push(pose.cabeca.y);
    if (Math.floor(t * 4) !== jogo._tc) { jogo._tc = Math.floor(t * 4); painel.atualizar(); }
    if (t > 3.2) {
      const a = jogo.calibAmostras; jogo.h0 = clamp(a.length ? a.reduce((s, x) => s + x, 0) / a.length : 1.65, 1.2, 2.05); jogo.calibrado = true;
      if (jogo.aposCalibrar === 'fase') comecarFase(jogo.fase); else irPara('lobby');
    }
  }
  if (jogo.estado === 'demo') {
    jogo.demoT += dt; mixer.update(dt); atualizarDemoVisual(jogo.demoT);
    const passo = PASSOS_DEMO.filter(s => jogo.demoT >= s[0]).length;
    if (passo !== jogo.ultimoPasso) { jogo.ultimoPasso = passo; painel.atualizar(); if (passo > 1) som.passo(passo); narrador.falar(PASSOS_DEMO[passo - 1][2]); }
    else if (Math.floor(jogo.demoT * 2) !== jogo._td) { jogo._td = Math.floor(jogo.demoT * 2); painel.atualizar(); }
    if (jogo.demoT > DURACAO_DEMO + 1.5) { jogo.demoVista = true; irPara(jogo.retornoDemo); }
  }
  if (rotuloInstrutor) rotuloInstrutor.lookAt(pose.cabeca.x, rotuloInstrutor.getWorldPosition(tmpV2).y, pose.cabeca.z);
  if (f3.rotuloPeso && f3.rotuloPeso.parent) f3.rotuloPeso.lookAt(pose.cabeca.x, f3.rotuloPeso.position.y, pose.cabeca.z);
  avaliar(dt, agora);
  for (let i = animacoes.length - 1; i >= 0; i--) {
    const a = animacoes[i], u = clamp((agora - a.t0) / a.dur);
    a.obj.position.lerpVectors(a.de, a.para, u * u * (3 - 2 * u)); if (a.obj.userData.sombra) a.obj.userData.sombra.position.set(a.obj.position.x, 0.004, a.obj.position.z);
    if (u >= 1) animacoes.splice(i, 1);
  }
  if (hud.mesh.visible && agora > hudAte) hud.mesh.visible = false;
  if (jogo.estado !== 'carregando') atualizarHover();
  marcaChao.material.opacity = 0.55 + 0.4 * Math.sin(agora * 4);
  renderer.render(scene, camera);
}

// ================================================================== início
(async function iniciar() {
  const aviso = document.getElementById('carregando');
  await carregarFontes();
  await carregarCena();
  narrador.preparar();
  aviso?.remove();
  botoesXR();
  lerPose(0);
  irPara('lobby');
  renderer.setAnimationLoop(quadro);
  window.__dbg = { painel, mundo, mixer, f3, fase };
  window.__fase = () => ({ F12, f3 });
  window.__av = () => av;
  window.__pronto = true;
})().catch(e => {
  const el = document.getElementById('carregando');
  if (el) el.textContent = 'Erro ao carregar: ' + e.message;
  console.error(e);
});
