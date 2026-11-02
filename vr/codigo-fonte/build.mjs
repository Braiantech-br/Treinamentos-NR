import * as esbuild from 'esbuild';
import fs from 'fs';
const r = await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'esm', write: false,
  loader: { '.glb': 'binary', '.ttf': 'binary' }, target: ['chrome100'] });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mestre do Levantamento</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#0e1116}
#carregando{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#f5c400;font:600 22px sans-serif;background:#0e1116;z-index:10}</style>
</head><body><div id="carregando">Carregando o galpão…</div>
<script type="module">${js}</script></body></html>`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('ok', (html.length / 1e6).toFixed(2), 'MB');
