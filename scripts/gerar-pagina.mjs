#!/usr/bin/env node
/*
 * Gera a página única da Calculadora ICMS-ST MS (um só arquivo HTML, com os dados embutidos),
 * no mesmo formato da página original. É este arquivo que é publicado como Artifact no claude.ai.
 * Uso: node scripts/gerar-pagina.mjs  →  icms-st-ms/Calculadora_ICMS-ST_MS.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = join(dirname(fileURLToPath(import.meta.url)), '..', 'icms-st-ms');
const ler = f => readFileSync(join(base, f), 'utf8');
const dados = {
  subanexo: JSON.parse(ler('dados/subanexo1.json')),
  param: JSON.parse(ler('dados/parametros.json')),
  pmpf: JSON.parse(ler('dados/pmpf.json')),
};
let html = ler('index.html');
const ini = html.indexOf('<div id="carregando"'), fim = html.indexOf('</script>', ini) + '</script>'.length;
if (ini < 0 || fim < ini) throw new Error('Bloco de carregamento não encontrado em index.html');
const json = JSON.stringify(dados).replace(/</g, '\\u003c');
const app = ler('app.js').replace(/<\/script/gi, '<\\/script');
html = html.slice(0, ini) + '<script>\nwindow.ICMS_DADOS = ' + json + ';\n' + app + '</script>' + html.slice(fim);
// Formato do Artifact do claude.ai: o próprio claude.ai coloca doctype/head/body; o arquivo traz só o conteúdo.
html = html.replace(/^<!doctype html>[\s\S]*?<\/style>\s*/i, '')
           .replace(/<\/head><body>\s*/i, '')
           .replace(/\s*<\/body><\/html>\s*$/i, '\n')
           .replace(/<meta name="description"[^>]*>/, '<meta name="claude:viewport-fit-sides" content="cover">');
if (!html.startsWith('<title>')) throw new Error('A página gerada deveria começar pelo <title>');
writeFileSync(join(base, 'Calculadora_ICMS-ST_MS.html'), html);
console.log('Gerado icms-st-ms/Calculadora_ICMS-ST_MS.html (' + Math.round(html.length / 1024) + ' KB)');
