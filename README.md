# Treinamentos NR · Braian Tech

Materiais de treinamento em segurança do trabalho. O primeiro módulo é **Levantamento seguro de cargas** (ergonomia, NR-17), com vídeo de treinamento e um jogo em realidade virtual para a SIPAT.

## Conteúdo

| Pasta | O que tem |
| --- | --- |
| `index.html` | Página de apresentação (vídeo, jogo e normas), pronta para o GitHub Pages |
| `videos/` | Vídeo completo com som (53 s), versão sem som (44 s) e versão só com o jeito certo (31 s), todos em 1080p |
| `vr/mestre-do-levantamento/` | Jogo WebXR **Mestre do Levantamento · Fase 1** (arquivo único, roda no Meta Quest e no PC) |
| `vr/codigo-fonte/` | Código-fonte do jogo (three.js + esbuild) e os modelos 3D em GLB |
| `unity/` | Script `ErgonomiaVR.cs` e modelos FBX (trabalhador animado e galpão) para Unity + OpenXR |
| `blender/` | Cena `.blend` e os scripts que geram a animação, os textos e a trilha sonora; `versao-1/` tem a primeira animação |

## Jogo VR no Meta Quest

1. Ative o GitHub Pages: **Settings → Pages → Branch: `main` / pasta `/ (root)` → Save**.
2. Em cerca de 1 minuto o site fica em `https://braiantech-br.github.io/Treinamentos-NR/`.
3. No Quest, abra o **navegador do Quest**, entre nesse link, escolha **Jogo VR** e toque em **Entrar no VR**.

Controles: aponte e aperte o **gatilho** para os menus; segure a caixa com os **dois botões laterais (grip)**; **B** pula a demonstração.
No PC: clique para mirar, **WASD** anda, **C** agacha, **E** segura a caixa.

**Ranking (opcional):** adicione `?webhook=URL` ao link do jogo para enviar setor, nota e critérios de cada partida a um webhook (por exemplo, do n8n).

> A postura é estimada pela posição da cabeça e das mãos (o Quest não rastreia a coluna). É uma ferramenta de treinamento, não uma avaliação ergonômica.

## Recompilar o jogo

```bash
cd vr/codigo-fonte
npm install
node build.mjs        # gera dist/index.html (arquivo único)
```

## Normas de referência

- **NR-17** · Ergonomia · item 17.5 e 17.5.5 (orientação sobre métodos de levantamento)
- **NR-1** · Gerenciamento de riscos ocupacionais (PGR e capacitação)
- **NR-11** · Transporte, movimentação, armazenagem e manuseio de materiais
- **ABNT NBR ISO 11228-1** · Movimentação manual · levantamento e transporte de cargas

Material de orientação: não substitui a AEP/AET nem as orientações do SESMT da empresa.

---
Braian Tech · Assistência Personalizada – Projetos e Robótica · [braiantech.com.br](https://www.braiantech.com.br) · [@braiantech](https://www.instagram.com/braiantech)
