// Mestre do Levantamento — Fase 1 (WebXR · Meta Quest 2 / PC)
// Braian Tech · treinamento de levantamento seguro de cargas
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import galpaoGLB from '../assets/galpao.glb';
import workerGLB from '../assets/trabalhador.glb';
import fontBold from '../assets/Poppins-Bold.ttf';
import fontSemi from '../assets/Poppins-SemiBold.ttf';
import fontReg from '../assets/Poppins-Regular.ttf';

// ------------------------------------------------------------------ configuração
const CONFIG = {
  webhookUrl: new URLSearchParams(location.search).get('webhook') || '', // opcional: ?webhook=URL (ex.: n8n) recebe as pontuações
  caixas: 3,
  pesoCaixaKg: 12,
};
const SETORES = ['Produção', 'Expedição', 'Manutenção', 'Administrativo', 'Outro'];
const COR = { ink: '#0e1116', amarelo: '#f5c400', verde: '#22c55e', vermelho: '#ff4040', laranja: '#ff9f1a', cinza: '#96a0af', branco: '#ffffff' };
const NOTA = { bom: 100, atencao: 60, ruim: 20 };
const CRITERIOS = [
  { id: 'coluna', nome: 'Coluna reta', peso: 0.30 },
  { id: 'joelhos', nome: 'Joelhos flexionados', peso: 0.25 },
  { id: 'perto', nome: 'Carga junto ao corpo', peso: 0.20 },
  { id: 'torcao', nome: 'Girar com os pés', peso: 0.15 },
  { id: 'ritmo', nome: 'Sem trancos', peso: 0.10 },
];
const DICAS = {
  coluna: 'Mantenha a coluna reta e o olhar para a frente ao pegar a carga.',
  joelhos: 'Desça dobrando os joelhos. Quem faz a força são as pernas.',
  perto: 'Traga a caixa para junto do corpo, na altura da cintura.',
  torcao: 'Para mudar de direção, dê passos e gire com os pés.',
  ritmo: 'Levante com movimento contínuo, sem trancos.',
};
const PASSOS_DEMO = [ // tempos do clipe (s) — os mesmos do vídeo, menos 13 s
  [0.0, 'Antes: avalie o peso, o tamanho e a pega'],
  [1.0, '1 · Afaste os pés na largura dos ombros'],
  [3.5, '2 · Agache dobrando os joelhos, coluna reta'],
  [7.0, '3 · Segure firme com as duas mãos'],
  [9.5, '4 · Levante com a força das pernas'],
  [13.0, '5 · Carga junto ao corpo, na altura da cintura'],
  [15.0, '6 · Para mudar de direção, gire com os pés'],
  [19.2, '7 · Deposite a carga com controle'],
];

// ------------------------------------------------------------------ base
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9aa3ad');
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

// ------------------------------------------------------------------ fontes e áudio
async function carregarFontes() {
  const lista = [[fontBold, '700'], [fontSemi, '600'], [fontReg, '400']];
  for (const [buf, w] of lista) {
    const f = new FontFace('Poppins', buf, { weight: w });
    await f.load();
    document.fonts.add(f);
  }
}

let actx = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tom(freq, dur = 0.25, tipo = 'sine', vol = 0.18, quando = 0) {
  try {
    const a = audio(), t = a.currentTime + quando;
    const o = a.createOscillator(), g = a.createGain();
    o.type = tipo; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  } catch (e) { /* sem áudio */ }
}
const som = {
  clique: () => tom(900, 0.08, 'sine', 0.12),
  ok: () => { tom(880, 0.5); tom(1318, 0.6, 'sine', 0.14, 0.09); },
  alerta: () => { tom(150, 0.12, 'square', 0.06); tom(150, 0.12, 'square', 0.06, 0.16); },
  fim: () => [523, 659, 784, 1046].forEach((f, i) => tom(f, 0.7, 'triangle', 0.14, i * 0.12)),
};

// ------------------------------------------------------------------ painéis (texto em canvas)
class Painel {
  constructor(larguraM, alturaM, pxPorM = 600) {
    this.w = Math.round(larguraM * pxPorM); this.h = Math.round(alturaM * pxPorM);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(larguraM, alturaM),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    this.mesh.renderOrder = 10;
    this.mesh.userData.painel = this;
    this.botoes = [];
    this.hover = null;
    this.desenhar = () => {};
  }
  atualizar() {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    this.botoes = [];
    this.desenhar(c, this);
    this.tex.needsUpdate = true;
  }
  fundo(c) {
    rrect(c, 0, 0, this.w, this.h, 36, 'rgba(14,17,22,0.88)');
    c.fillStyle = COR.amarelo; rrect(c, 0, 0, 14, this.h, 7, COR.amarelo);
  }
  botao(c, id, x, y, w, h, texto, { ativo = false, cor = COR.amarelo } = {}) {
    const hov = this.hover === id;
    rrect(c, x, y, w, h, h / 2, ativo ? cor : hov ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)');
    if (!ativo) { c.strokeStyle = hov ? cor : 'rgba(255,255,255,0.35)'; c.lineWidth = 4; rrectPath(c, x + 2, y + 2, w - 4, h - 4, h / 2 - 2); c.stroke(); }
    texto_(c, texto, x + w / 2, y + h / 2 + 2, `600 ${Math.round(h * 0.42)}px Poppins`, ativo ? COR.ink : COR.branco, 'center', 'middle');
    this.botoes.push({ id, x, y, w, h });
  }
  botaoEm(uv) {
    const px = uv.x * this.w, py = (1 - uv.y) * this.h;
    return this.botoes.find(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)?.id ?? null;
  }
}
function rrectPath(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function rrect(c, x, y, w, h, r, fill) { rrectPath(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); }
function texto_(c, s, x, y, font, cor, align = 'left', base = 'alphabetic') {
  c.font = font; c.fillStyle = cor; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y);
}
function quebrar(c, s, largura, font) {
  c.font = font; const pal = s.split(' '); const linhas = []; let l = '';
  for (const p of pal) { const t = l ? l + ' ' + p : p; if (c.measureText(t).width > largura && l) { linhas.push(l); l = p; } else l = t; }
  if (l) linhas.push(l); return linhas;
}
function estrelas(c, x, y, n, tam) {
  for (let i = 0; i < 3; i++) {
    const cx = x + i * tam * 1.25, cy = y;
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? tam * 0.22 : tam * 0.5, a = -Math.PI / 2 + k * Math.PI / 5;
      c.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    c.closePath(); c.fillStyle = i < n ? COR.amarelo : 'rgba(255,255,255,0.18)'; c.fill();
  }
}

// ------------------------------------------------------------------ texturas simples
function texturaPapelao() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const c = cv.getContext('2d');
  c.fillStyle = '#c4935d'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${90 + Math.random() * 60},${60 + Math.random() * 30},20,${Math.random() * 0.08})`; c.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 30, 1); }
  c.fillStyle = 'rgba(150,105,55,0.9)'; c.fillRect(0, 112, 256, 32); // fita
  c.fillStyle = 'rgba(40,30,20,0.85)'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText(`${CONFIG.pesoCaixaKg} kg`, 128, 205);
  c.strokeStyle = 'rgba(40,30,20,0.85)'; c.lineWidth = 4; c.strokeRect(84, 172, 88, 46);
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

// cores para materiais procedurais do Blender que não vêm no GLB
const COR_MATERIAL = {
  Pallet: '#b88a57', Caixas: '#c4935d', Caixas2: '#d7ad78', Parede: '#a3a8b0', Concreto: '#8d9196', Papelao: '#c4935d',
};
function simplificarMateriais(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const conv = m => {
      const cor = COR_MATERIAL[m.name] ? new THREE.Color(COR_MATERIAL[m.name]) : m.color.clone();
      const nm = new THREE.MeshLambertMaterial({ color: cor, map: m.map || null, name: m.name });
      if (m.name === 'Luminaria') { nm.emissive = new THREE.Color('#fff2d0'); nm.emissiveIntensity = 1; }
      return nm;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
}

// ------------------------------------------------------------------ mundo
const mundo = new THREE.Group(); // galpão + instrutor (coordenadas do Blender)
scene.add(mundo);
let instrutor = null, mixer = null, acao = null, bancadaModelo = null, rotuloInstrutor = null;
const DURACAO_DEMO = 23.5;

async function carregarCena() {
  const loader = new GLTFLoader();
  const parse = buf => new Promise((ok, err) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', ok, err));
  const [g, w] = await Promise.all([parse(galpaoGLB), parse(workerGLB)]);
  simplificarMateriais(g.scene); simplificarMateriais(w.scene);
  mundo.add(g.scene);
  bancadaModelo = g.scene.getObjectByName('Bancada');

  instrutor = w.scene;
  instrutor.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  mundo.add(instrutor);
  const s = sombra(0.45); instrutor.add(s);
  const clip = w.animations[0];
  const vistos = new Set(); // o GLTFLoader compartilha o mesmo array de tempos entre trilhas
  for (const tr of clip.tracks) { if (vistos.has(tr.times)) continue; vistos.add(tr.times); for (let i = 0; i < tr.times.length; i++) tr.times[i] -= 13.0; }
  clip.resetDuration();
  window.__dbg = { clip, instrutor };
  mixer = new THREE.AnimationMixer(instrutor);
  acao = mixer.clipAction(clip);
  acao.setLoop(THREE.LoopOnce, 1); acao.clampWhenFinished = true;
  acao.play(); acao.paused = true; mixer.setTime(0); window.__dbg.mixer = mixer; window.__dbg.mundo = mundo;

  // rótulo "Instrutor"
  const p = new Painel(0.62, 0.14, 500);
  p.desenhar = c => { rrect(c, 0, 0, p.w, p.h, p.h / 2, 'rgba(34,197,94,0.92)'); texto_(c, 'INSTRUTOR', p.w / 2, p.h / 2 + 3, '700 34px Poppins', COR.branco, 'center', 'middle'); };
  p.atualizar(); rotuloInstrutor = p.mesh; rotuloInstrutor.position.set(0, 2.1, 0); instrutor.add(rotuloInstrutor);

  // posiciona o galpão: jogador na origem olhando para -Z, vendo o instrutor de perfil a ~2,3 m
  const jogadorLocal = new THREE.Vector2(2.3, 0.45); // (x, z) no galpão: quase de perfil, para ver bem a coluna (ele olha para +Z)
  const dir = new THREE.Vector2(-jogadorLocal.x, -jogadorLocal.y).normalize();
  const ang = Math.atan2(dir.x, dir.y);       // direção local até o instrutor
  mundo.rotation.y = Math.PI - ang;           // gira para que ela aponte para -Z no mundo
  const pj = new THREE.Vector3(jogadorLocal.x, 0, jogadorLocal.y).applyAxisAngle(new THREE.Vector3(0, 1, 0), mundo.rotation.y);
  mundo.position.set(-pj.x, 0, -pj.z);
}

// ------------------------------------------------------------------ elementos da fase
const fase = new THREE.Group(); scene.add(fase);
let bancada = null, topoBancada = 0.8, areaBancada = null;
const caixas = [];
const marcaChao = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.31, 40), new THREE.MeshBasicMaterial({ color: COR.amarelo, transparent: true, opacity: 0.9 }));
marcaChao.rotation.x = -Math.PI / 2; marcaChao.position.y = 0.006;
const alvo = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), new THREE.MeshBasicMaterial({ color: COR.verde, transparent: true, opacity: 0.35, depthWrite: false }));
alvo.rotation.x = -Math.PI / 2;
const TAM_CAIXA = new THREE.Vector3(0.40, 0.28, 0.30);
const matCaixa = new THREE.MeshLambertMaterial({ map: texturaPapelao() });

function montarFase(cabeca, yawFrente) {
  fase.clear(); caixas.length = 0;
  const frente = new THREE.Vector3(-Math.sin(yawFrente), 0, -Math.cos(yawFrente));
  const direita = new THREE.Vector3(-frente.z, 0, frente.x);
  const base = new THREE.Vector3(cabeca.x, 0, cabeca.z);
  // caixa no chão, 0,45 m à frente
  const pc = base.clone().addScaledVector(frente, 0.45);
  fase.userData.posCaixa = pc; fase.userData.yaw = yawFrente;
  marcaChao.position.set(pc.x, 0.006, pc.z); fase.add(marcaChao);
  // bancada (a mesma do galpão), 1,05 m à direita: obriga a girar com os pés
  const banc = bancadaModelo.clone();
  banc.visible = true; banc.position.set(0, 0, 0);
  const holder = new THREE.Group(); holder.add(banc);
  const bb = new THREE.Box3().setFromObject(holder);
  banc.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  topoBancada = bb.max.y - bb.min.y;
  const larg = bb.max.x - bb.min.x, prof = bb.max.z - bb.min.z;
  const longo = Math.max(larg, prof), curto = Math.min(larg, prof);
  const pb = base.clone().addScaledVector(direita, 0.75 + curto / 2);
  holder.position.copy(pb);
  holder.rotation.y = yawFrente + (larg >= prof ? Math.PI / 2 : 0); // lado comprido virado para o jogador
  fase.add(holder);
  const s = sombra(longo * 0.65); s.position.set(pb.x, 0.004, pb.z); fase.add(s);
  areaBancada = { centro: pb, meioCurto: curto / 2, meioLongo: longo / 2, direita: direita.clone(), frente: frente.clone(),
    passo: Math.min(0.44, Math.max(0, (longo - 0.42) / 2)) };
  alvo.geometry.dispose(); alvo.geometry = new THREE.PlaneGeometry(curto * 0.9, longo * 0.9);
  alvo.position.set(pb.x, topoBancada + 0.004, pb.z); alvo.rotation.set(-Math.PI / 2, 0, yawFrente); fase.add(alvo);
}

function novaCaixa(i) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(TAM_CAIXA.x, TAM_CAIXA.y, TAM_CAIXA.z), matCaixa);
  const p = fase.userData.posCaixa;
  m.position.set(p.x, TAM_CAIXA.y / 2, p.z);
  m.rotation.y = fase.userData.yaw;
  const s = sombra(0.32); s.position.set(p.x, 0.004, p.z); fase.add(s); m.userData.sombra = s;
  m.userData.estado = 'chao'; m.userData.indice = i;
  fase.add(m); caixas.push(m); return m;
}

// ------------------------------------------------------------------ controles (VR) e mãos virtuais (PC)
const maos = [0, 1].map(i => {
  const grip = renderer.xr.getControllerGrip(i);
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.11), new THREE.MeshLambertMaterial({ color: '#2a2f38' }));
  const anel = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 24), new THREE.MeshLambertMaterial({ color: '#2a2f38' }));
  anel.position.set(0, 0.025, -0.05); anel.rotation.x = Math.PI / 3;
  grip.add(corpo, anel); scene.add(grip);
  const ray = renderer.xr.getController(i);
  const linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: COR.amarelo }));
  linha.scale.z = 3; ray.add(linha); scene.add(ray);
  const mao = { i, grip, ray, linha, apertando: false, fonte: null, pos: new THREE.Vector3(), corpo };
  grip.addEventListener('connected', e => { mao.fonte = e.data; });
  grip.addEventListener('disconnected', () => { mao.fonte = null; });
  grip.addEventListener('squeezestart', () => { mao.apertando = true; });
  grip.addEventListener('squeezeend', () => { mao.apertando = false; });
  ray.addEventListener('selectstart', () => clicar(ray));
  return mao;
});
function vibrar(intens = 0.6, ms = 120) {
  for (const m of maos) m.fonte?.gamepad?.hapticActuators?.[0]?.pulse?.(intens, ms);
}

// PC: mouse + teclado
const pc = { yaw: 0, pitch: 0, agachado: false, alturaOlho: 1.65, teclas: {}, segurando: false };
const maoPC = [new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshLambertMaterial({ color: '#e0a060' })),
  new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshLambertMaterial({ color: '#e0a060' }))];
maoPC.forEach(m => scene.add(m));
const mira = document.createElement('div');
mira.style.cssText = 'position:fixed;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:50%;border:2px solid #f5c400;pointer-events:none';
document.body.appendChild(mira);
renderer.domElement.addEventListener('click', () => {
  audio();
  if (renderer.xr.isPresenting) return;
  if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
  else clicar(camera);
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== renderer.domElement) return;
  pc.yaw -= e.movementX * 0.0025; pc.pitch = clamp(pc.pitch - e.movementY * 0.0025, -1.45, 1.45);
});
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
// roteiro de poses interpolado no tempo (só para testes)
window.__roteiro = (keys) => new Promise(ok => {
  const t0 = performance.now() / 1000;
  const L = (a, b, u) => a + (b - a) * u;
  const passo = () => {
    const t = performance.now() / 1000 - t0;
    let i = keys.findIndex(k => k.t > t);
    if (i === -1) { const k = keys.at(-1); aplicar(k, k, 0); ok(); return; }
    const a = keys[Math.max(0, i - 1)], b = keys[i], u = i === 0 ? 1 : (t - a.t) / (b.t - a.t);
    aplicar(a, b, u); requestAnimationFrame(passo);
  };
  const aplicar = (a, b, u) => {
    sim.cabeca.set(L(a.cab[0], b.cab[0], u), L(a.cab[1], b.cab[1], u), L(a.cab[2], b.cab[2], u));
    sim.yaw = L(a.yaw, b.yaw, u); sim.pitch = L(a.pitch, b.pitch, u);
    for (let k = 0; k < 2; k++) sim.maos[k].set(L(a.maos[k][0], b.maos[k][0], u), L(a.maos[k][1], b.maos[k][1], u), L(a.maos[k][2], b.maos[k][2], u));
    sim.aperto = u < 1 ? a.aperto : b.aperto;
  };
  passo();
});
window.__fase = () => ({ area: areaBancada, topo: topoBancada, caixa: fase.userData.posCaixa });

// ------------------------------------------------------------------ leitura de pose (cabeça + mãos)
const pose = { cabeca: new THREE.Vector3(), frenteH: new THREE.Vector3(0, 0, -1), yaw: 0, pitch: 0, maos: [new THREE.Vector3(), new THREE.Vector3()], aperto: [false, false] };
function lerPose(dt) {
  if (sim.ativo) {
    pose.cabeca.copy(sim.cabeca); pose.yaw = sim.yaw; pose.pitch = sim.pitch;
    pose.frenteH.set(-Math.sin(sim.yaw), 0, -Math.cos(sim.yaw));
    pose.maos[0].copy(sim.maos[0]); pose.maos[1].copy(sim.maos[1]); pose.aperto[0] = pose.aperto[1] = sim.aperto;
    camera.position.copy(sim.cabeca); camera.rotation.set(-sim.pitch, sim.yaw, 0, 'YXZ');
    return;
  }
  if (renderer.xr.isPresenting) {
    const xc = renderer.xr.getCamera();
    xc.getWorldPosition(pose.cabeca); xc.getWorldQuaternion(tmpQ);
    const f = tmpV.set(0, 0, -1).applyQuaternion(tmpQ), up = tmpV2.set(0, 1, 0).applyQuaternion(tmpQ);
    pose.pitch = Math.asin(clamp(-f.y, -1, 1));
    const fh = new THREE.Vector3(f.x, 0, f.z);
    if (fh.length() < 0.35) fh.set(up.x, 0, up.z); // olhando para baixo: usa o "topo" da cabeça
    pose.frenteH.copy(fh.normalize());
    pose.yaw = Math.atan2(-pose.frenteH.x, -pose.frenteH.z);
    maos.forEach((m, k) => { m.grip.getWorldPosition(pose.maos[k]); pose.aperto[k] = m.apertando; });
    return;
  }
  // PC
  const v = 2.0 * dt, f = new THREE.Vector3(-Math.sin(pc.yaw), 0, -Math.cos(pc.yaw)), r = new THREE.Vector3(-f.z, 0, f.x);
  if (pc.teclas.KeyW) camera.position.addScaledVector(f, v);
  if (pc.teclas.KeyS) camera.position.addScaledVector(f, -v);
  if (pc.teclas.KeyD) camera.position.addScaledVector(r, v);
  if (pc.teclas.KeyA) camera.position.addScaledVector(r, -v);
  pc.alturaOlho = lerp(pc.alturaOlho, pc.agachado ? 0.62 : 1.65, clamp(dt * 3));
  camera.position.y = pc.alturaOlho;
  camera.rotation.set(pc.pitch, pc.yaw, 0, 'YXZ');
  pose.cabeca.copy(camera.position); pose.pitch = -pc.pitch; pose.yaw = pc.yaw; pose.frenteH.copy(f);
  const alt = pc.agachado ? -0.42 : -0.5, dist = pc.segurando ? 0.32 : 0.36;
  [-1, 1].forEach((s, k) => {
    pose.maos[k].copy(camera.position).addScaledVector(f, dist).addScaledVector(r, s * 0.2);
    pose.maos[k].y = camera.position.y + alt;
    maoPC[k].position.copy(pose.maos[k]);
    pose.aperto[k] = pc.segurando;
  });
}

// ------------------------------------------------------------------ painéis do jogo
const painel = new Painel(1.3, 0.9, 850);
scene.add(painel.mesh);
const hud = new Painel(0.9, 0.16, 700); // dica presa à frente da cabeça
hud.mesh.material.depthTest = false; hud.mesh.renderOrder = 20;
camera.add(hud.mesh); hud.mesh.position.set(0, -0.28, -1.0); hud.mesh.visible = false;
let hudTexto = '', hudCor = COR.vermelho, hudAte = 0;
hud.desenhar = c => {
  rrect(c, 0, 0, hud.w, hud.h, hud.h / 2, hudCor === COR.verde ? 'rgba(34,197,94,0.95)' : hudCor === COR.laranja ? 'rgba(255,159,26,0.95)' : 'rgba(230,50,50,0.95)');
  texto_(c, hudTexto, hud.w / 2, hud.h / 2 + 3, '700 40px Poppins', COR.branco, 'center', 'middle');
};
function dica(txt, cor = COR.vermelho, seg = 1.8, alertar = true) {
  if (txt !== hudTexto || hudCor !== cor) { hudTexto = txt; hudCor = cor; hud.atualizar(); if (alertar) { som.alerta(); vibrar(0.7, 140); } }
  hudAte = performance.now() / 1000 + seg; hud.mesh.visible = true;
}

function posicionarPainel(pos, olharPara) {
  painel.mesh.position.copy(pos);
  painel.mesh.lookAt(olharPara.x, pos.y, olharPara.z);
}

// ------------------------------------------------------------------ estado do jogo
const jogo = {
  estado: 'carregando', setor: null, h0: 1.65, calibAmostras: [], calibInicio: 0,
  caixaAtual: 0, resultados: [], demoT: 0, ultimoPasso: -1,
};
window.__jogo = jogo;

function irPara(estado) {
  jogo.estado = estado;
  const t = performance.now() / 1000;
  if (estado === 'lobby') {
    instrutor.visible = true; fase.visible = false; bancadaModelo.visible = true; acao.paused = true; mixer.setTime(0);
    posicionarPainel(new THREE.Vector3(0, 1.45, -1.25), new THREE.Vector3(0, 1.45, 0));
    painel.desenhar = desenharLobby;
  } else if (estado === 'calibrar') {
    jogo.calibAmostras = []; jogo.calibInicio = t; painel.desenhar = desenharCalibrar;
  } else if (estado === 'demo') {
    instrutor.visible = true; fase.visible = false; bancadaModelo.visible = true;
    acao.reset(); acao.play(); acao.paused = false; jogo.demoT = 0; jogo.ultimoPasso = -1;
    posicionarPainel(new THREE.Vector3(-1.05, 1.55, -1.35), new THREE.Vector3(0, 1.55, 0.2));
    painel.desenhar = desenharDemo;
  } else if (estado === 'jogar') {
    instrutor.visible = false; fase.visible = true;
    bancadaModelo.visible = true;
    montarFase(pose.cabeca, pose.yaw);
    bancadaModelo.visible = false; // só a bancada do jogador aparece durante a fase
    jogo.caixaAtual = 0; jogo.resultados = [];
    iniciarCaixa();
    const f = pose.frenteH, esq = new THREE.Vector3(f.z, 0, -f.x);
    const pp = pose.cabeca.clone().addScaledVector(f, 1.5).addScaledVector(esq, 0.75); pp.y = 1.5;
    posicionarPainel(pp, pose.cabeca);
    painel.desenhar = desenharJogar;
  } else if (estado === 'resultado') {
    const f = pose.frenteH, pp = pose.cabeca.clone().addScaledVector(f, 1.3); pp.y = 1.45;
    posicionarPainel(pp, pose.cabeca);
    painel.desenhar = desenharResultado;
    som.fim(); enviarPontuacao();
  }
  painel.atualizar();
}

function clicar(origem) {
  const ray = new THREE.Raycaster();
  if (origem === camera) ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  else { origem.updateMatrixWorld(); ray.ray.origin.setFromMatrixPosition(origem.matrixWorld); ray.ray.direction.set(0, 0, -1).applyQuaternion(origem.getWorldQuaternion(tmpQ)); }
  const hit = ray.intersectObject(painel.mesh)[0];
  if (!hit) return;
  const id = painel.botaoEm(hit.uv);
  if (!id) return;
  som.clique(); vibrar(0.3, 40);
  acaoBotao(id);
}
function acaoBotao(id) {
  if (id.startsWith('setor:')) { jogo.setor = id.slice(6); painel.atualizar(); return; }
  if (id === 'comecar') { audio(); irPara('calibrar'); return; }
  if (id === 'pular') { pularDemo(); return; }
  if (id === 'denovo') { irPara('jogar'); return; }
  if (id === 'demo') { irPara('demo'); return; }
  if (id === 'inicio') { irPara('lobby'); return; }
}
window.__clicar = acaoBotao;
function pularDemo() { if (jogo.estado === 'demo') irPara('jogar'); }

function atualizarHover() {
  let alvoId = null;
  const ray = new THREE.Raycaster();
  const fontes = renderer.xr.isPresenting ? maos.map(m => m.ray) : [camera];
  for (const o of fontes) {
    if (o === camera) ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    else { ray.ray.origin.setFromMatrixPosition(o.matrixWorld); ray.ray.direction.set(0, 0, -1).applyQuaternion(o.getWorldQuaternion(tmpQ)); }
    const hit = ray.intersectObject(painel.mesh)[0];
    if (o !== camera) { const m = maos.find(mm => mm.ray === o); m.linha.scale.z = hit ? hit.distance : 3; m.linha.visible = jogo.estado !== 'jogar' || !!hit; }
    if (hit) alvoId = painel.botaoEm(hit.uv) || alvoId;
  }
  if (alvoId !== painel.hover) { painel.hover = alvoId; painel.atualizar(); }
}

// ------------------------------------------------------------------ telas
function desenharLobby(c, p) {
  p.fundo(c);
  texto_(c, 'TREINAMENTO DE ERGONOMIA · BRAIAN TECH', 70, 92, '700 28px Poppins', COR.amarelo);
  texto_(c, 'Mestre do Levantamento', 66, 168, '700 64px Poppins', COR.branco);
  texto_(c, 'Fase 1 · Do chão para a bancada', 70, 222, '400 32px Poppins', '#cdd4de');
  texto_(c, 'Escolha seu setor', 70, 300, '600 30px Poppins', COR.branco);
  SETORES.forEach((s, i) => {
    const x = 70 + (i % 3) * 225, y = 322 + Math.floor(i / 3) * 84;
    p.botao(c, 'setor:' + s, x, y, 210, 66, s, { ativo: jogo.setor === s });
  });
  const ok = !!jogo.setor;
  p.botao(c, ok ? 'comecar' : 'x', 70, 520, 400, 80, ok ? 'Começar' : 'Escolha o setor', { ativo: ok });
  const linhas = ['Libere um espaço de 2 × 2 m ao seu redor.', 'Use os botões laterais (grip) para segurar a caixa.', renderer.xr.isPresenting ? 'Aponte e aperte o gatilho para escolher.' : 'PC: clique, WASD anda, C agacha, E segura.'];
  linhas.forEach((l, i) => texto_(c, l, 70, 660 + i * 42, '400 26px Poppins', '#aeb7c4'));
}
function desenharCalibrar(c, p) {
  p.fundo(c);
  const t = performance.now() / 1000 - jogo.calibInicio, falta = Math.max(0, 3 - t);
  texto_(c, 'Calibração', 70, 140, '700 60px Poppins', COR.branco);
  texto_(c, 'Fique em pé, reto, olhando para a frente.', 70, 210, '400 34px Poppins', '#cdd4de');
  texto_(c, falta > 0 ? String(Math.ceil(falta)) : 'Pronto!', p.w / 2, 470, '700 180px Poppins', COR.amarelo, 'center');
  texto_(c, 'Medimos sua altura para avaliar a postura.', 70, 700, '400 28px Poppins', '#aeb7c4');
}
function desenharDemo(c, p) {
  p.fundo(c);
  texto_(c, 'ASSISTA AO INSTRUTOR', 70, 92, '700 28px Poppins', COR.verde);
  texto_(c, 'Jeito certo, passo a passo', 66, 160, '700 52px Poppins', COR.branco);
  const passo = PASSOS_DEMO.filter(s => jogo.demoT >= s[0]).at(-1);
  const linhas = quebrar(c, passo[1], p.w - 140, '600 44px Poppins');
  linhas.forEach((l, i) => texto_(c, l, 70, 290 + i * 60, '600 44px Poppins', COR.amarelo));
  // passos
  for (let i = 0; i < 7; i++) {
    const x = 90 + i * 92, y = 480, feito = jogo.demoT >= PASSOS_DEMO[i + 1][0];
    c.beginPath(); c.arc(x, y, 28, 0, Math.PI * 2); c.fillStyle = feito ? COR.verde : 'rgba(255,255,255,0.12)'; c.fill();
    texto_(c, String(i + 1), x, y + 2, '700 28px Poppins', feito ? COR.ink : COR.cinza, 'center', 'middle');
  }
  rrect(c, 70, 560, p.w - 140, 14, 7, 'rgba(255,255,255,0.15)');
  rrect(c, 70, 560, (p.w - 140) * clamp(jogo.demoT / DURACAO_DEMO), 14, 7, COR.verde);
  p.botao(c, 'pular', 70, 630, 460, 76, renderer.xr.isPresenting ? 'Pular demonstração (B)' : 'Pular (barra de espaço)');
}
function desenharJogar(c, p) {
  p.fundo(c);
  texto_(c, 'SUA VEZ', 70, 92, '700 28px Poppins', COR.amarelo);
  texto_(c, `Caixa ${Math.min(jogo.caixaAtual + 1, CONFIG.caixas)} de ${CONFIG.caixas}`, 66, 168, '700 64px Poppins', COR.branco);
  const passos = ['Pegue a caixa do chão com as duas mãos', 'Leve até a área verde da bancada, à sua direita', 'Solte a caixa em cima da bancada'];
  passos.forEach((l, i) => {
    c.beginPath(); c.arc(92, 248 + i * 70, 22, 0, Math.PI * 2); c.fillStyle = COR.amarelo; c.fill();
    texto_(c, String(i + 1), 92, 250 + i * 70, '700 24px Poppins', COR.ink, 'center', 'middle');
    texto_(c, l, 130, 258 + i * 70, '400 30px Poppins', COR.branco);
  });
  const ult = jogo.resultados.at(-1);
  if (ult) {
    texto_(c, `Caixa ${jogo.resultados.length}: ${Math.round(ult.total)} pontos`, 70, 520, '600 34px Poppins', COR.branco);
    CRITERIOS.forEach((cr, i) => {
      const n = ult.notas[cr.id], cor = n >= 100 ? COR.verde : n >= 60 ? COR.laranja : COR.vermelho;
      const x = 70 + (i % 3) * 390, y = 560 + Math.floor(i / 3) * 56;
      c.beginPath(); c.arc(x + 14, y + 20, 13, 0, Math.PI * 2); c.fillStyle = cor; c.fill();
      texto_(c, cr.nome, x + 38, y + 30, '400 26px Poppins', '#cdd4de');
    });
  }
}
function desenharResultado(c, p) {
  p.fundo(c);
  const tot = mediaFinal();
  texto_(c, 'RESULTADO · FASE 1', 70, 92, '700 28px Poppins', COR.amarelo);
  texto_(c, `${Math.round(tot.total)}`, 66, 210, '700 120px Poppins', COR.branco);
  texto_(c, '/ 100', 66 + c.measureText(`${Math.round(tot.total)}`).width + 20, 210, '400 40px Poppins', '#aeb7c4');
  estrelas(c, 520, 160, tot.total >= 85 ? 3 : tot.total >= 65 ? 2 : 1, 70);
  CRITERIOS.forEach((cr, i) => {
    const y = 270 + i * 62, n = tot.notas[cr.id], cor = n >= 85 ? COR.verde : n >= 55 ? COR.laranja : COR.vermelho;
    texto_(c, cr.nome, 70, y + 30, '400 28px Poppins', COR.branco);
    rrect(c, 420, y + 8, 520, 26, 13, 'rgba(255,255,255,0.12)');
    rrect(c, 420, y + 8, Math.max(26, 520 * n / 100), 26, 13, cor);
    texto_(c, String(Math.round(n)), 1000, y + 30, '600 28px Poppins', COR.branco, 'right');
  });
  const pior = CRITERIOS.reduce((a, b) => (tot.notas[b.id] < tot.notas[a.id] ? b : a));
  const dicaTxt = tot.notas[pior.id] >= 85 ? 'Excelente! Você levantou do jeito certo.' : 'Dica: ' + DICAS[pior.id];
  quebrar(c, dicaTxt, p.w - 140, '600 28px Poppins').forEach((l, i) => texto_(c, l, 70, 610 + i * 38, '600 28px Poppins', COR.amarelo));
  p.botao(c, 'denovo', 70, 700, 330, 74, 'Jogar de novo', { ativo: true });
  p.botao(c, 'demo', 420, 700, 330, 74, 'Ver o instrutor');
  p.botao(c, 'inicio', 770, 700, 240, 74, 'Início');
}

// ------------------------------------------------------------------ avaliação da postura
let av = null; // avaliação da caixa atual
function iniciarCaixa() {
  const cx = novaCaixa(jogo.caixaAtual);
  av = {
    caixa: cx, segurando: false, quedas: 0, t0: performance.now() / 1000,
    p0: null, // posição da cabeça na última vez que estava em pé
    pega: null, levantando: false, vMax: 0, ultimaY: null,
    dists: [], amostrasGiro: [], torcoes: 0, ultimoGiro: 0, alertaDescida: 0,
  };
}

function classificar(v, bom, atencao, menorMelhor = true) {
  if (menorMelhor) return v <= bom ? 'bom' : v <= atencao ? 'atencao' : 'ruim';
  return v >= bom ? 'bom' : v >= atencao ? 'atencao' : 'ruim';
}
const pior = (...cs) => (cs.includes('ruim') ? 'ruim' : cs.includes('atencao') ? 'atencao' : 'bom');

function avaliar(dt, agora) {
  if (!av || jogo.estado !== 'jogar') return;
  const h0 = jogo.h0, cab = pose.cabeca, cx = av.caixa;
  const emPe = cab.y > 0.88 * h0;
  if (emPe && !av.segurando) av.p0 = cab.clone();

  // velocidade vertical da cabeça
  if (av.ultimaY !== null) {
    const vy = (cab.y - av.ultimaY) / Math.max(dt, 1e-3);
    if (av.levantando) av.vMax = Math.max(av.vMax, vy);
  }
  av.ultimaY = cab.y;

  const mid = tmpV.copy(pose.maos[0]).add(pose.maos[1]).multiplyScalar(0.5);
  const perto = (m) => m.distanceTo(cx.position) < 0.34;

  if (!av.segurando) {
    // descendo para pegar: dicas ao vivo
    const dCaixa = Math.hypot(cx.position.x - cab.x, cx.position.z - cab.z);
    if (cx.userData.estado === 'chao' && dCaixa < 1.0 && cab.y < 0.8 * h0 && agora - av.alertaDescida > 2.2) {
      const desloc = av.p0 ? new THREE.Vector3(cab.x - av.p0.x, 0, cab.z - av.p0.z).dot(pose.frenteH) : 0;
      if (pose.pitch * 57.3 > 62) { dica('Olhe para a frente · coluna reta'); av.alertaDescida = agora; }
      else if (desloc > 0.32) { dica('Dobre os joelhos, não a coluna'); av.alertaDescida = agora; }
    }
    // pegar com as duas mãos
    if (cx.userData.estado === 'chao' && pose.aperto[0] && pose.aperto[1] && perto(pose.maos[0]) && perto(pose.maos[1])) {
      av.segurando = true; cx.userData.estado = 'mao';
      const f = new THREE.Vector3(cx.position.x - cab.x, 0, cx.position.z - cab.z).dot(pose.frenteH);
      const desloc = av.p0 ? new THREE.Vector3(cab.x - av.p0.x, 0, cab.z - av.p0.z).dot(pose.frenteH) : 0;
      av.pega = { pitch: pose.pitch * 57.3, frente: f, desloc, queda: (h0 - cab.y) / h0, t: agora };
      av.levantando = true; av.vMax = 0; av.dists = []; av.amostrasGiro = [];
      som.clique(); vibrar(0.4, 60);
    } else if (cx.userData.estado === 'chao' && (pose.aperto[0] !== pose.aperto[1]) && (perto(pose.maos[0]) || perto(pose.maos[1])) && agora - av.alertaDescida > 2) {
      dica('Segure com as duas mãos', COR.laranja); av.alertaDescida = agora;
    }
  } else {
    // carregando: a caixa acompanha as mãos
    const alvoPos = mid.clone();
    cx.position.lerp(alvoPos, clamp(dt * 18));
    const lado = new THREE.Vector3().subVectors(pose.maos[1], pose.maos[0]); lado.y = 0;
    if (lado.length() > 0.1) cx.rotation.y = Math.atan2(-lado.z, lado.x);
    cx.userData.sombra.position.set(cx.position.x, 0.004, cx.position.z);
    if (av.levantando && cab.y > 0.88 * h0) av.levantando = false;
    if (agora - av.pega.t > 0.4 && !av.levantando) {
      const d = Math.hypot(mid.x - cab.x, mid.z - cab.z);
      av.dists.push(d);
      if (d > 0.52 && agora - av.alertaDescida > 2.2) { dica('Traga a caixa para perto do corpo'); av.alertaDescida = agora; }
    }
    // torção: girou o tronco sem dar passos
    av.amostrasGiro.push({ t: agora, yaw: pose.yaw, x: cab.x, z: cab.z });
    while (av.amostrasGiro.length && agora - av.amostrasGiro[0].t > 1.0) av.amostrasGiro.shift();
    const a0 = av.amostrasGiro[0];
    if (a0 && agora - av.ultimoGiro > 1.4) {
      let dy = pose.yaw - a0.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      const passo = Math.hypot(cab.x - a0.x, cab.z - a0.z);
      if (Math.abs(dy) > 50 / 57.3 && passo < 0.12) {
        av.torcoes++; av.ultimoGiro = agora; av.amostrasGiro = [];
        dica('Gire com os pés, não o tronco');
      }
    }
    // soltou
    if (!pose.aperto[0] || !pose.aperto[1]) {
      av.segurando = false;
      const nb = areaBancada;
      const rel = new THREE.Vector3(cx.position.x - nb.centro.x, 0, cx.position.z - nb.centro.z);
      const naBancada = Math.abs(rel.dot(nb.direita)) < nb.meioCurto + 0.12 && Math.abs(rel.dot(nb.frente)) < nb.meioLongo + 0.05
        && cx.position.y - TAM_CAIXA.y / 2 > topoBancada - 0.15;
      if (naBancada) {
        cx.position.set(nb.centro.x, topoBancada + TAM_CAIXA.y / 2, nb.centro.z);
        cx.position.addScaledVector(nb.frente, (jogo.caixaAtual - 1) * nb.passo);
        cx.rotation.y = fase.userData.yaw;
        cx.userData.estado = 'bancada'; cx.userData.sombra.visible = false;
        finalizarCaixa();
      } else {
        av.quedas++; cx.userData.estado = 'caindo'; dica('Você soltou a caixa! Pegue de novo.', COR.laranja);
      }
    }
  }
  if (cx.userData.estado === 'caindo') {
    cx.position.y = Math.max(TAM_CAIXA.y / 2, cx.position.y - dt * 3);
    if (cx.position.y <= TAM_CAIXA.y / 2 + 1e-3) cx.userData.estado = 'chao';
  }
}

function finalizarCaixa() {
  const pg = av.pega;
  const coluna = pior(classificar(pg.pitch, 45, 62), classificar(pg.frente, 0.15, 0.05, false));
  const joelhos = pg.desloc <= 0.22 && pg.queda >= 0.25 ? 'bom' : pg.desloc <= 0.35 ? 'atencao' : 'ruim';
  const dm = av.dists.length ? av.dists.reduce((a, b) => a + b, 0) / av.dists.length : 0.35;
  const perto = classificar(dm, 0.40, 0.52);
  const torcao = av.torcoes === 0 ? 'bom' : av.torcoes === 1 ? 'atencao' : 'ruim';
  const ritmo = pior(classificar(av.vMax, 1.2, 1.6), av.quedas === 0 ? 'bom' : av.quedas === 1 ? 'atencao' : 'ruim');
  const cls = { coluna, joelhos, perto, torcao, ritmo };
  const notas = Object.fromEntries(Object.entries(cls).map(([k, v]) => [k, NOTA[v]]));
  const total = CRITERIOS.reduce((s, cr) => s + cr.peso * notas[cr.id], 0);
  jogo.resultados.push({ notas, cls, total, medidas: { ...pg, distMedia: dm, vMax: av.vMax, torcoes: av.torcoes, quedas: av.quedas } });
  som.ok(); vibrar(0.5, 80);
  dica(total >= 85 ? 'Muito bem! Caixa entregue.' : 'Caixa entregue', total >= 85 ? COR.verde : COR.laranja, 1.6, false);
  jogo.caixaAtual++;
  if (jogo.caixaAtual >= CONFIG.caixas) { setTimeout(() => irPara('resultado'), 1400); av = null; }
  else iniciarCaixa();
  painel.atualizar();
}

function mediaFinal() {
  const r = jogo.resultados, n = Math.max(r.length, 1);
  const notas = Object.fromEntries(CRITERIOS.map(cr => [cr.id, r.reduce((s, x) => s + x.notas[cr.id], 0) / n]));
  return { notas, total: r.reduce((s, x) => s + x.total, 0) / n };
}

function enviarPontuacao() {
  if (!CONFIG.webhookUrl) return;
  const tot = mediaFinal();
  fetch(CONFIG.webhookUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jogo: 'mestre-do-levantamento', fase: 1, setor: jogo.setor, pontuacao: Math.round(tot.total), criterios: tot.notas, caixas: jogo.resultados, data: new Date().toISOString() }),
  }).catch(() => {});
}

// ------------------------------------------------------------------ botão "Entrar no VR"
function botaoVR() {
  const b = document.createElement('button');
  b.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:16px 34px;border:0;border-radius:40px;background:#f5c400;color:#0e1116;font:700 20px Poppins,sans-serif;cursor:pointer;z-index:9;box-shadow:0 6px 24px rgba(0,0,0,.35)';
  document.body.appendChild(b);
  if (!('xr' in navigator)) { b.textContent = 'Modo PC (VR não disponível neste navegador)'; b.disabled = true; b.style.opacity = 0.8; return; }
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    if (!ok) { b.textContent = 'Modo PC (abra no navegador do Quest para VR)'; b.disabled = true; b.style.opacity = 0.8; return; }
    b.textContent = 'Entrar no VR';
    let sessao = null;
    b.onclick = async () => {
      audio();
      if (sessao) { sessao.end(); return; }
      sessao = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      sessao.addEventListener('end', () => { sessao = null; b.textContent = 'Entrar no VR'; });
      await renderer.xr.setSession(sessao);
      b.textContent = 'Sair do VR';
      if (renderer.xr.setFoveation) renderer.xr.setFoveation(1);
      irPara('lobby');
    };
  });
}

// ------------------------------------------------------------------ laço principal
const relogio = new THREE.Clock();
let bAntes = false;
function quadro() {
  const dt = Math.min(relogio.getDelta(), sim.ativo ? 0.25 : 0.05), agora = performance.now() / 1000;
  lerPose(dt);
  const vr = renderer.xr.isPresenting;
  maoPC.forEach(m => { m.visible = !vr && jogo.estado === 'jogar'; });
  maos.forEach(m => { m.ray.visible = vr; m.grip.visible = vr; });
  mira.style.display = vr ? 'none' : 'block';

  // botão B/Y para pular a demonstração
  let b = false; for (const m of maos) b = b || !!m.fonte?.gamepad?.buttons?.[5]?.pressed;
  if (b && !bAntes) pularDemo(); bAntes = b;

  if (jogo.estado === 'calibrar') {
    const t = agora - jogo.calibInicio;
    if (t > 2.0) jogo.calibAmostras.push(pose.cabeca.y);
    if (Math.floor(t * 4) !== jogo._tc) { jogo._tc = Math.floor(t * 4); painel.atualizar(); }
    if (t > 3.2) {
      const a = jogo.calibAmostras; const m = a.length ? a.reduce((s, x) => s + x, 0) / a.length : 1.65;
      jogo.h0 = clamp(m, 1.2, 2.05);
      irPara('demo');
    }
  }
  if (jogo.estado === 'demo') {
    jogo.demoT += dt; mixer.update(dt);
    const passo = PASSOS_DEMO.filter(s => jogo.demoT >= s[0]).length;
    if (passo !== jogo.ultimoPasso) { jogo.ultimoPasso = passo; painel.atualizar(); if (passo > 1) tom(660 + passo * 60, 0.3, 'sine', 0.08); }
    else if (Math.floor(jogo.demoT * 2) !== jogo._td) { jogo._td = Math.floor(jogo.demoT * 2); painel.atualizar(); }
    if (jogo.demoT > DURACAO_DEMO + 1.5) irPara('jogar');
  }
  if (rotuloInstrutor) rotuloInstrutor.lookAt(pose.cabeca.x, rotuloInstrutor.getWorldPosition(tmpV2).y, pose.cabeca.z);
  avaliar(dt, agora);
  if (hud.mesh.visible && agora > hudAte) hud.mesh.visible = false;
  if (jogo.estado !== 'carregando') atualizarHover();
  // anel do chão pisca enquanto a caixa está no chão
  marcaChao.material.opacity = 0.55 + 0.4 * Math.sin(agora * 4);
  renderer.render(scene, camera);
}

// ------------------------------------------------------------------ início
(async function iniciar() {
  const aviso = document.getElementById('carregando');
  await carregarFontes();
  await carregarCena();
  aviso?.remove();
  botaoVR();
  lerPose(0);
  irPara('lobby');
  renderer.setAnimationLoop(quadro);
  window.__dbg.painel = painel;
  window.__pronto = true;
})().catch(e => {
  const el = document.getElementById('carregando');
  if (el) el.textContent = 'Erro ao carregar: ' + e.message;
  console.error(e);
});
