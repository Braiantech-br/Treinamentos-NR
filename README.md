# Treinamentos NR · Braian Tech

Materiais de treinamento em segurança do trabalho. O primeiro módulo é **Levantamento seguro de cargas** (ergonomia, NR-17), com vídeo de treinamento e um jogo em realidade virtual para a SIPAT.

## Conteúdo

| Pasta | O que tem |
| --- | --- |
| `index.html` | Página de apresentação (vídeo, jogo e normas), pronta para o GitHub Pages |
| `videos/` | Vídeo completo com som (53 s), versão sem som (44 s) e versão só com o jeito certo (31 s), todos em 1080p |
| `vr/mestre-do-levantamento/` | Jogo WebXR **Mestre do Levantamento v2** com 3 fases (arquivo único, roda no Meta Quest e no PC) |
| `vr/codigo-fonte/` | Código-fonte do jogo (three.js + esbuild) e os modelos 3D em GLB |
| `unity/` | Script `ErgonomiaVR.cs` e modelos FBX (trabalhador animado e galpão) para Unity + OpenXR |
| `blender/` | Cena `.blend` e os scripts que geram a animação, os textos e a trilha sonora; `versao-1/` tem a primeira animação |

## Jogo VR no Meta Quest

1. Ative o GitHub Pages: **Settings → Pages → Branch: `main` / pasta `/ (root)` → Save**.
2. Em cerca de 1 minuto o site fica em `https://braiantech-br.github.io/Treinamentos-NR/`.
3. No Quest, abra o **navegador do Quest**, entre nesse link, escolha **Jogo VR** e toque em **Entrar no VR** (ou **Realidade misturada**).

### Fases

| Fase | Tarefa | O que é avaliado |
| --- | --- | --- |
| 1 · Chão → bancada | Levar 3 caixas de 12 kg do chão até a bancada | Coluna reta, joelhos flexionados, carga junto ao corpo, girar com os pés, sem trancos |
| 2 · Bancada → chão | Levar 3 caixas da bancada e depositá-las no chão | Os mesmos critérios, medidos na hora de agachar e apoiar a caixa |
| 3 · Carga pesada | Decidir como mover uma caixa de 28 kg e levá-la com o carrinho | Decisão segura, tronco ereto, empurrar sem puxar, controle |

As fases são liberadas em sequência. Para um evento, use `?livre` no fim do link para liberar todas.

### Recursos

- **Demonstração** com o mesmo trabalhador do vídeo, linha verde da coluna e marcações (Base firme, Coluna reta, Joelhos flexionados…), com narração em português quando o aparelho tem voz pt-BR.
- **Indicadores ao vivo** no alto da visão e avisos com vibração do controle quando a postura sai do correto.
- **Tutorial dos controles**, calibração de altura e botão **Recalibrar**.
- **Ranking neste aparelho**: top 10 por fase com iniciais, e média por setor.
- **Relatório CSV** (no PC): todas as partidas com setor, fase, nota e critérios, para o SESMT.
- **Trilha sonora e ambiente** sintetizados, com botões para ligar/desligar música e narração.
- **Realidade misturada** (passthrough do Quest): o instrutor, as caixas e a bancada aparecem na sua sala.
- **Controles e mãos**: modelos reais dos controles Touch e rastreamento de mãos (feche a mão para segurar).

Controles: aponte e aperte o **gatilho** para os menus; segure com os **dois botões laterais (grip)**; **B/Y** pula a demonstração.
No PC: clique para mirar, **WASD** anda, **C** agacha, **E** segura, **espaço** pula a demonstração.

**Ranking central (opcional):** adicione `?webhook=URL` ao link do jogo para enviar cada partida (setor, fase, nota, critérios) a um webhook, por exemplo do n8n.

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
