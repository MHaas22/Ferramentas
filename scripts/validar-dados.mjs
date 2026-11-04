#!/usr/bin/env node
/*
 * Valida os dados da Calculadora ICMS-ST MS antes de publicar.
 * Uso: node scripts/validar-dados.mjs [--comparar <pasta-com-dados-anteriores>]
 * Sai com código 1 se algo estiver errado, para que a publicação seja bloqueada.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'icms-st-ms', 'dados');
const args = process.argv.slice(2);
const iCmp = args.indexOf('--comparar');
const pastaAnterior = iCmp >= 0 ? args[iCmp + 1] : null;

const erros = [], avisos = [];
const erro = m => erros.push(m), aviso = m => avisos.push(m);
const ler = (pasta, nome) => {
  const p = join(pasta, nome);
  if (!existsSync(p)) { erro(`${nome}: arquivo não encontrado`); return null; }
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { erro(`${nome}: JSON inválido (${e.message})`); return null; }
};
const dataISO = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const ncmOk = s => /^\d{2}(\.?\d{2}){0,3}$|^\d{4}(\.\d{1,2}){0,2}$|^\d{2,8}$/.test(String(s).trim());
const cestOk = s => /^\d{2}\.\d{3}\.\d{2}$/.test(s);

/* ---------- subanexo1.json ---------- */
const sub = ler(raiz, 'subanexo1.json');
if (sub) {
  if (!dataISO(sub.atualizado_em)) erro('subanexo1.json: "atualizado_em" deve ser AAAA-MM-DD');
  if (!Array.isArray(sub.s) || !sub.s.length) erro('subanexo1.json: lista de tabelas "s" vazia');
  if (!Array.isArray(sub.d)) erro('subanexo1.json: lista de dispositivos "d" ausente');
  if (!Array.isArray(sub.r) || sub.r.length < 100) erro(`subanexo1.json: poucos itens em "r" (${sub.r?.length ?? 0})`);
  (sub.s || []).forEach((s, i) => { if (!Array.isArray(s) || s.length !== 3 || !/^Tabela /i.test(s[0]) || !s[1]) erro(`tabela s[${i}] mal formada: ${JSON.stringify(s)}`); });
  const cests = new Map();
  (sub.r || []).forEach((r, i) => {
    const id = `item r[${i}]`;
    if (!Array.isArray(r) || r.length !== 8) return erro(`${id}: deve ter 8 campos [tabela, item, CEST, NCMs, MVAs, textoMVA, descrição, dispositivo]`);
    const [seg, item, cest, ncms, mva, mvaTxt, desc, disp] = r;
    if (!Number.isInteger(seg) || seg < 0 || seg >= sub.s.length) erro(`${id}: índice de tabela inválido (${seg})`);
    if (!item) erro(`${id}: número do item vazio`);
    if (!cestOk(cest)) erro(`${id}: CEST inválido "${cest}"`);
    if (!Array.isArray(ncms)) erro(`${id} (CEST ${cest}): lista de NCM ausente`);
    else if (!ncms.length) { if (!/\.999\.00$/.test(cest)) erro(`${id} (CEST ${cest}): sem NCM`); }
    else ncms.forEach(n => {
      if (/[^\d.]/.test(String(n))) erro(`${id} (CEST ${cest}): NCM "${n}" com espaço ou texto; separe um código por posição da lista`);
      else if (!ncmOk(n)) aviso(`${id} (CEST ${cest}): NCM "${n}" em formato incomum; conferir na fonte`);
    });
    if (mva === null) { if (!mvaTxt) aviso(`${id} (CEST ${cest}): sem MVA e sem texto explicativo`); }
    else if (!Array.isArray(mva) || mva.length !== 4 || mva.some(v => typeof v !== 'number' || !isFinite(v) || v < 0 || v > 1000))
      erro(`${id} (CEST ${cest}): MVA deve ser [interna, 4%, 7%, 12%] com números entre 0 e 1000`);
    else if (!(mva[1] >= mva[2] && mva[2] >= mva[3])) aviso(`${id} (CEST ${cest}): MVA ajustada fora da ordem esperada (4% ≥ 7% ≥ 12%): ${mva.join(' / ')}`);
    if (!desc || String(desc).length < 3) erro(`${id} (CEST ${cest}): descrição vazia`);
    if (!Number.isInteger(disp) || disp < 0 || disp >= (sub.d || []).length) erro(`${id} (CEST ${cest}): índice de dispositivo inválido (${disp})`);
    const k = cest + '|' + seg;
    if (cests.has(k)) aviso(`CEST ${cest} repetido na mesma tabela (itens ${cests.get(k)} e ${i})`);
    cests.set(k, i);
  });
}

/* ---------- parametros.json ---------- */
const par = ler(raiz, 'parametros.json');
if (par) {
  if (!dataISO(par.atualizado_em)) erro('parametros.json: "atualizado_em" deve ser AAAA-MM-DD');
  if (typeof par.aliquota_interna !== 'number' || par.aliquota_interna < 7 || par.aliquota_interna > 35) erro(`parametros.json: alíquota interna fora do intervalo 7–35 (${par.aliquota_interna})`);
  if (typeof par.fecomp !== 'number' || par.fecomp < 0 || par.fecomp > 4) erro(`parametros.json: FECOMP fora do intervalo 0–4 (${par.fecomp})`);
}

/* ---------- pmpf.json ---------- */
const pm = ler(raiz, 'pmpf.json');
if (pm) {
  if (!pm.ato) erro('pmpf.json: "ato" vazio');
  if (!dataISO(pm.vigencia_inicio)) erro('pmpf.json: "vigencia_inicio" deve ser AAAA-MM-DD');
  if (!Array.isArray(pm.itens)) erro('pmpf.json: "itens" ausente');
  else pm.itens.forEach((it, i) => {
    if (!it.produto) erro(`pmpf.json itens[${i}]: produto vazio`);
    if (typeof it.valor !== 'number' || !(it.valor > 0 && it.valor < 100)) erro(`pmpf.json itens[${i}] (${it.produto}): valor fora do intervalo (0, 100) R$ — ${it.valor}`);
    if (!['litro', 'kg', 'm³'].includes(it.unidade)) erro(`pmpf.json itens[${i}] (${it.produto}): unidade deve ser litro, kg ou m³`);
  });
  if (dataISO(pm.vigencia_inicio) && (Date.now() - Date.parse(pm.vigencia_inicio)) / 864e5 > 45) aviso(`pmpf.json: vigência iniciada há mais de 45 dias (${pm.vigencia_inicio}); confira se saiu ato novo`);
}

/* ---------- comparação com a versão anterior (trava contra perda acidental de dados) ---------- */
if (pastaAnterior && sub) {
  const ant = existsSync(join(pastaAnterior, 'subanexo1.json')) ? JSON.parse(readFileSync(join(pastaAnterior, 'subanexo1.json'), 'utf8')) : null;
  if (ant) {
    const a = new Map(ant.r.map(r => [r[2] + '|' + r[0] + '|' + r[1], r])), n = new Map(sub.r.map(r => [r[2] + '|' + r[0] + '|' + r[1], r]));
    const saiu = [...a.keys()].filter(k => !n.has(k)), entrou = [...n.keys()].filter(k => !a.has(k));
    const mudouMva = [...n.keys()].filter(k => a.has(k) && JSON.stringify(a.get(k)[4]) !== JSON.stringify(n.get(k)[4]));
    console.log(`Comparação com a versão anterior: ${ant.r.length} → ${sub.r.length} itens · ${entrou.length} incluído(s) · ${saiu.length} excluído(s) · ${mudouMva.length} com MVA alterada`);
    if (saiu.length > Math.max(30, ant.r.length * 0.1)) erro(`Exclusão em massa: ${saiu.length} itens sumiram de uma vez. Provável erro de leitura da fonte; atualização bloqueada.`);
  }
}

avisos.forEach(m => console.log('AVISO  ' + m));
erros.forEach(m => console.log('ERRO   ' + m));
if (sub) console.log(`subanexo1.json: ${sub.r?.length} itens em ${sub.s?.length} tabelas · atualizado em ${sub.atualizado_em}`);
if (pm) console.log(`pmpf.json: ${pm.ato} · ${pm.itens?.length} produto(s) · vigência ${pm.vigencia_inicio}`);
if (par) console.log(`parametros.json: alíquota interna ${par.aliquota_interna}% · FECOMP ${par.fecomp}%`);
console.log(erros.length ? `\n${erros.length} erro(s). Corrija antes de publicar.` : '\nDados válidos.');
process.exit(erros.length ? 1 : 0);
