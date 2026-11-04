const $ = id => document.getElementById(id);
const fmt = v => v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const brl = v => 'R$ ' + fmt(v);
const pct = (v,d=2) => v.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:4}) + '%';
const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
function num(s){ s = String(s||'').trim(); if(!s) return 0; if(s.includes(',')) s = s.replace(/\./g,'').replace(',','.'); const n = parseFloat(s); return isNaN(n)?0:n; }
const digits = s => String(s).replace(/\D/g,'');
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

const DATA = window.ICMS_DADOS.subanexo, PARAM = window.ICMS_DADOS.param, PMPF = window.ICMS_DADOS.pmpf;
const ALQ_INT = +PARAM.aliquota_interna || 17;
const SEG_PP = DATA.s.findIndex(s=>/PORTA A PORTA/i.test(s[1]));
const usaItem = x => x.seg!==SEG_PP || (document.getElementById('portaPorta')||{}).checked;
const ITENS = DATA.r.map((r,i)=>({i, seg:r[0], item:r[1], cest:r[2], ncm:r[3], ncmD:r[3].map(digits), mva:r[4], mvaTxt:r[5], desc:r[6], disp:DATA.d[r[7]], key:norm(r[6]+' '+r[2]+' '+r[3].join(' '))}));
const SEGS = DATA.s.map(s=>({tab:s[0], nome:s[1], sub:s[2]}));
$('nItens').textContent = ITENS.length + ' itens';
/* ---------- parâmetros e PMPF vindos de dados/*.json ---------- */
$('ad').value = String(ALQ_INT);
$('pFec').value = fmt(+PARAM.fecomp || 0);
const dataBR = s => s ? String(s).slice(0,10).split('-').reverse().join('/') : '—';
$('baseInfo').textContent = 'Base atualizada em ' + dataBR(DATA.atualizado_em) + ' · PMPF ' + dataBR(PMPF.vigencia_inicio);
$('fonteInfo').textContent = (DATA.fonte || 'Subanexo I ao Anexo III do RICMS/MS') + ', atualizado em ' + dataBR(DATA.atualizado_em) + ', Tabelas II a XXIX, ' + ITENS.length + ' itens vigentes. PMPF: ' + (PMPF.ato||'—') + ', vigência a partir de ' + dataBR(PMPF.vigencia_inicio) + '. Alíquota interna padrão ' + ALQ_INT + '%, FECOMP ' + fmt(+PARAM.fecomp||0) + '%. Redações anteriores (“redação vigente até…”) não foram incluídas.';
(function(){
  const sel = $('pmpfSel');
  (PMPF.itens||[]).forEach((it,k)=>{ const o=document.createElement('option'); o.value=k; o.textContent = it.produto + ' · R$ ' + it.valor.toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4}) + '/' + it.unidade; sel.appendChild(o); });
  $('pmpfAto').textContent = PMPF.ato ? PMPF.ato + ' · UF ' + (PMPF.uf||'MS') + ' · vigência a partir de ' + dataBR(PMPF.vigencia_inicio) : '';
  sel.onchange = ()=>{ const it = (PMPF.itens||[])[+sel.value]; if(it){ $('pUnit').value = it.valor.toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4}); $('qtdLbl').textContent = 'Quantidade (' + it.unidade + ')'; } calc(); };
})();
SEGS.forEach((s,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent = s.tab.replace(/^Tabela /i,'') + ' · ' + s.nome.charAt(0)+s.nome.slice(1).toLowerCase() + (s.sub? ' ('+ (s.sub.includes('não signat')?'UF não signatária': s.sub.includes('signat')?'UF signatária': s.sub.includes('industrial')?'remetente industrial/importador':'remetente distribuidor/atacadista') +')':''); $('fseg').appendChild(o); });

const st = { op:'inter', ai:12, mvaSrc:'tab', sel:null, lista:[], manual:false };

/* ---------- busca ---------- */
function buscar(){
  const q = $('q').value.trim(), fs = $('fseg').value;
  let res = ITENS.filter(x => fs==='' || x.seg==+fs);
  let info = '', naoST = null, autoSel = false;
  if(q){
    const qd = digits(q), isCest = /^\d{2}\.?\d{3}\.?\d{2}$/.test(q.replace(/\s/g,'')) && q.includes('.');
    if(isCest){ res = res.filter(x => digits(x.cest)===qd); info='Busca por CEST'; }
    else if(qd.length>=2 && qd.length===q.replace(/[\s.\-]/g,'').length){
      const casa = x => usaItem(x) && (qd.length>=8 ? x.ncmD.some(n => qd.startsWith(n)) : (x.ncmD.some(n => qd.startsWith(n) || n.startsWith(qd)) || digits(x.cest).startsWith(qd)));
      if(qd.length>=8 && !ITENS.some(casa)) naoST = q;
      res = res.filter(casa);
      res.sort((a,b)=> Math.max(...b.ncmD.filter(n=>qd.startsWith(n)).map(n=>n.length),0) - Math.max(...a.ncmD.filter(n=>qd.startsWith(n)).map(n=>n.length),0));
      info = 'Busca por NCM: posições da tabela que abrangem o código informado aparecem primeiro. Confira a descrição: o NCM sozinho não enquadra o item.';
      autoSel = qd.length>=8 && res.length===1;
    } else {
      const ts = norm(q).split(/\s+/).filter(Boolean);
      res = res.filter(x => ts.every(t => x.key.includes(t))); info='Busca por descrição';
    }
  } else if(fs===''){ info = 'Digite um NCM, CEST ou parte da descrição, ou escolha um segmento.'; res = []; }
  $('qinfo').textContent = info + (res.length? ' · ' + res.length + ' resultado(s)' + (res.length>80?' (mostrando 80)':'') : (q||fs!==''?' · nenhum item encontrado':''));
  const box = $('results'); box.innerHTML='';
  res.slice(0,80).forEach(x=>{
    const b = document.createElement('button'); b.type='button'; b.setAttribute('role','option'); b.setAttribute('aria-selected', st.sel===x?'true':'false');
    const s = SEGS[x.seg];
    b.innerHTML = '<div class="rmeta"><span>CEST '+x.cest+'</span><span>NCM '+x.ncm.join(' · ')+'</span><span class="pill">'+s.tab+' item '+x.item+'</span>'+(x.mva?'<span>MVA int. '+fmt(x.mva[0])+'%</span>':'<span>'+esc(x.mvaTxt||'')+'</span>')+'</div><div class="rdesc"></div>';
    b.querySelector('.rdesc').textContent = x.desc;
    b.onclick = ()=>{ selecionar(x); buscar(); };
    box.appendChild(b);
  });
  box.hidden = !res.length;
  st.naoST = naoST;
  $('naoSTBox').hidden = !naoST;
  if(naoST) $('naoSTncm').textContent = 'NCM ' + naoST + ' não consta no Subanexo I ao Anexo III do RICMS/MS (relação de mercadorias sujeitas à ST).';
  const shown = res.slice(0,80);
  if(st.sel && !shown.includes(st.sel)){ st.sel=null; $('selBox').innerHTML=''; $('adHint').textContent=''; }
  if(autoSel && st.sel!==res[0]){ selecionar(res[0]); return buscar(); }
  calc();
}
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function aliqImplicita(x){
  if(!x || !x.mva) return null;
  const v = 1 - (1+x.mva[0]/100)*0.96/(1+x.mva[1]/100);
  const r = Math.round(v*100);
  return [7,12,17,20,25,28,30].includes(r) && Math.abs(v*100-r)<0.3 ? r : null;
}
function selecionar(x){
  st.sel = x;
  const s = SEGS[x.seg];
  const col = st.op==='interna'?0:({4:1,7:2,12:3})[st.ai];
  let h = '<div class="rmeta"><span class="pill">'+esc(s.tab)+' · item '+esc(x.item)+'</span><span>CEST '+x.cest+'</span><span>NCM '+esc(x.ncm.join(' · '))+'</span></div>';
  h += '<div class="d"><b>'+esc(s.nome)+'</b>'+(s.sub?' · '+esc(s.sub):'')+'<br>'+esc(x.desc)+'</div>';
  if(x.mva){
    h += '<div class="tw"><table class="mv"><thead><tr><th>Oper. interna</th><th>Alíq. 4%</th><th>Alíq. 7%</th><th>Alíq. 12%</th></tr></thead><tbody><tr>'+x.mva.map((m,k)=>'<td class="'+(k===col?'on':'')+'">'+fmt(m)+'%</td>').join('')+'</tr></tbody></table></div>';
  } else {
    h += '<div class="warn">Sem MVA na tabela: '+esc(x.mvaTxt||'—')+'. Use PMPF ou o percentual do ato indicado.</div>';
  }
  h += '<div class="hint" style="margin-top:6px">Dispositivo legal: '+esc(x.disp||'—')+'</div>';
  h += '<div class="btns"><button type="button" class="btn ghost" id="unsel">Remover seleção</button></div>';
  $('selBox').innerHTML = '<div class="sel">'+h+'</div>';
  $('unsel').onclick = ()=>{ st.sel=null; $('selBox').innerHTML=''; buscar(); calc(); };
  if(!x.mva && $('metodo').value==='mva'){ $('metodo').value='pmpf'; syncMetodo(); }
  if(x.mva && st.mvaSrc==='man'){ setSeg('mvaSrc','tab'); st.mvaSrc='tab'; syncMva(); }
  const ai = aliqImplicita(x);
  $('adHint').textContent = ai ? 'A tabela deste item foi ajustada com alíquota interna de '+ai+'% (cálculo a partir das colunas). Confirme a alíquota aplicável no RICMS/MS.' : '';
  if(ai && num($('ad').value)!==ai){ $('ad').value = String(ai); }
  calc();
}

/* ---------- controles ---------- */
function setSeg(id,v){ document.querySelectorAll('#'+id+' button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.v===String(v)?'true':'false')); }
function bindSeg(id,fn){ document.querySelectorAll('#'+id+' button').forEach(b=>b.onclick=()=>{ setSeg(id,b.dataset.v); fn(b.dataset.v); }); }
bindSeg('opSeg', v=>{ st.op=v; $('aliqInterBox').hidden = v!=='inter'; $('ap').value = v==='inter'? String(st.ai) : $('ad').value; refreshSel(); calc(); });
bindSeg('aiSeg', v=>{ st.ai=+v; if(st.op==='inter') $('ap').value=v; refreshSel(); calc(); });
bindSeg('mvaSrc', v=>{ st.mvaSrc=v; syncMva(); calc(); });
bindSeg('modoSeg', v=>{
  st.manual = v==='man';
  $('tabBox').hidden = st.manual; $('manInfo').hidden = !st.manual;
  document.querySelector('#mvaSrc button[data-v=tab]').disabled = st.manual;
  if(st.manual){ st.mvaSrc='man'; setSeg('mvaSrc','man'); }
  else if(st.sel && st.sel.mva){ st.mvaSrc='tab'; setSeg('mvaSrc','tab'); }
  syncMva(); calc();
});
function refreshSel(){ if(st.sel) selecionar(st.sel); }
function syncMva(){ $('mvaManBox').hidden = st.mvaSrc!=='man'; }
function syncMetodo(){ const m=$('metodo').value; $('mvaBox').hidden = m!=='mva'; $('precoBox').hidden = m==='mva'; $('pmpfBox').hidden = m!=='pmpf'; }
$('metodo').onchange = ()=>{ syncMetodo(); calc(); };
$('fecomp').onchange = ()=>{ $('fecompBox').hidden = !$('fecomp').checked; calc(); };
$('q').oninput = buscar; $('fseg').onchange = buscar;
$('portaPorta').onchange = ()=>{ buscar(); if(typeof lote!=='undefined'){ lote.forEach(resolver); renderLote(); } if(typeof xmlLinhas!=='undefined'){ xmlLinhas.forEach(definirItemXml); renderXml(); } };
document.querySelectorAll('main input:not(#q), main select:not(#fseg):not(#metodo)').forEach(el=>el.addEventListener('input',calc));
document.querySelectorAll('input.num').forEach(el=>el.addEventListener('blur',()=>{ if(el.value.trim()==='' && el.id==='icmsInf') return; if(['qtd','ad','ap','pUnit'].includes(el.id)) return; el.value = fmt(num(el.value)); }));

/* ---------- cálculo ---------- */
let ultimo = null;
function calc(){
  const gate = $('gate');
  if(!st.sel && !st.manual){
    gate.hidden = false;
    gate.className = st.naoST ? 'block ts' : 'block';
    gate.textContent = st.naoST ? 'PRODUTO TRIBUTADO - Sem incidência de ICMS Substituição Tributária (NCM ' + st.naoST + ')' : 'Selecione no item 1 uma mercadoria do Subanexo I. O cálculo só é feito para produtos sujeitos à substituição tributária.';
    $('alerts').innerHTML=''; $('resTab').innerHTML=''; $('memo').textContent=''; $('memo').hidden=true;
    $('tot').textContent = st.naoST ? 'Sem ICMS-ST' : '—'; $('totSub').textContent='';
    $('addList').disabled = true; $('copyOne').disabled = true; ultimo = null;
    return;
  }
  gate.hidden = true; $('memo').hidden=false; $('addList').disabled = false; $('copyOne').disabled = false;
  const alerts = [];
  if(st.manual) alerts.push('Cálculo manual: enquadramento na ST e MVA não conferidos com o Subanexo I.');
  const sel = st.manual ? null : st.sel;
  const ad = num($('ad').value)/100;
  const ap = (st.op==='inter'? st.ai : num($('ap').value))/100;
  const vProd=num($('vProd').value), vIPI=num($('vIPI').value), vFr=num($('vFrete').value), vSeg=num($('vSeg').value), vOut=num($('vOutras').value), vDesc=num($('vDesc').value);
  const redST=num($('redST').value)/100, redP=num($('redP').value)/100;
  const metodo=$('metodo').value;
  const valorOp = vProd + vIPI + vFr + vSeg + vOut - vDesc;
  let bcPropria = vProd + vFr + vSeg + vOut - vDesc + ($('ipiProp').checked? vIPI:0);
  bcPropria = r2(bcPropria*(1-redP));
  let mva=null, mvaOrig=null, mvaFonte='', bcBruta;
  const memo=[];
  if(metodo==='mva'){
    if(st.mvaSrc==='tab'){
      if(!sel){ alerts.push('Selecione a mercadoria no Subanexo I ou use “MVA informada”.'); }
      else if(!sel.mva){ alerts.push('Item sem MVA na tabela. Use outro método de base.'); }
      else { const col = st.op==='interna'?0:({4:1,7:2,12:3})[st.ai]; mva = sel.mva[col]/100; mvaFonte = 'Subanexo I, '+SEGS[sel.seg].tab+', item '+sel.item+', coluna '+(col===0?'oper. interna':'alíq. '+st.ai+'%')+' (já ajustada)'; }
    } else {
      mvaOrig = num($('mvaO').value)/100;
      if(st.op==='inter' && $('ajustar').checked){
        if(ad<=ap) alerts.push('Alíquota interna menor ou igual à interestadual: o art. 9º-A não ajusta a MVA nesse caso. Usada a MVA original.');
        mva = ad>ap ? (1+mvaOrig)*(1-ap)/(1-ad) - 1 : mvaOrig;
        mvaFonte = 'MVA ajustada (art. 9º-A): [(1+'+pct(mvaOrig*100)+')×(1−'+pct(ap*100,0)+')÷(1−'+pct(ad*100,0)+')]−1';
      } else { mva = mvaOrig; mvaFonte='MVA informada, sem ajuste'; }
    }
    bcBruta = mva===null? 0 : valorOp*(1+mva);
    memo.push('Valor da operação = '+fmt(vProd)+' + IPI '+fmt(vIPI)+' + frete '+fmt(vFr)+' + seguro '+fmt(vSeg)+' + outras '+fmt(vOut)+' − desconto '+fmt(vDesc)+' = '+fmt(valorOp));
    if(mva!==null) memo.push('MVA aplicada = '+pct(mva*100,4)+'  ('+mvaFonte+')', 'BC-ST = '+fmt(valorOp)+' × (1 + '+pct(mva*100,4)+') = '+fmt(r2(bcBruta)));
  } else {
    const pu=num($('pUnit').value), q=num($('qtd').value);
    bcBruta = pu*q;
    const nome = {fixado:'Preço final fixado (art. 3º, I)',pmpf:'PMPF (art. 3º, II)',sugerido:'Preço sugerido (art. 3º, III)'}[metodo];
    memo.push(nome+': '+pu.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4})+' × '+q.toLocaleString('pt-BR')+' = '+fmt(bcBruta));
    if(!pu) alerts.push('Informe o preço unitário de referência.');
    if(metodo==='pmpf') alerts.push('Verifique o parágrafo único do art. 3º (comparação com o VRP). PMPF carregado: '+(PMPF.ato||'—')+'.');
  }
  const bcST = r2(bcBruta*(1-redST));
  if(redST) memo.push('Redução da BC-ST (art. 7º) '+pct(redST*100)+': '+fmt(r2(bcBruta))+' × (1 − '+pct(redST*100)+') = '+fmt(bcST));
  const icmsTot = r2(bcST*ad);
  const infStr = $('icmsInf').value.trim();
  const icmsProp = infStr? num(infStr) : r2(bcPropria*ap);
  memo.push('ICMS presumido = '+fmt(bcST)+' × '+pct(ad*100,0)+' = '+fmt(icmsTot));
  memo.push(infStr? 'ICMS próprio (informado) = '+fmt(icmsProp) : 'ICMS próprio = BC própria '+fmt(bcPropria)+' × '+pct(ap*100,0)+' = '+fmt(icmsProp)+(redP?' (BC própria reduzida em '+pct(redP*100)+')':''));
  let icmsST = r2(icmsTot - icmsProp);
  if(icmsST<0){ alerts.push('ICMS próprio maior que o presumido: ICMS-ST zerado.'); icmsST=0; }
  memo.push('ICMS-ST = '+fmt(icmsTot)+' − '+fmt(icmsProp)+' = '+fmt(icmsST));
  let fec=0;
  if($('fecomp').checked){
    const pf=num($('pFec').value)/100;
    const fecProp = st.op==='interna'? r2(bcPropria*pf) : 0;
    fec = Math.max(0, r2(bcST*pf - fecProp));
    memo.push('FECOMP-ST = '+fmt(bcST)+' × '+pct(pf*100)+(fecProp?' − FECOMP próprio '+fmt(fecProp):'')+' = '+fmt(fec));
    alerts.push('FECOMP: confirme se a mercadoria está sujeita ao adicional e a forma de cálculo vigente.');
  }
  if(st.op==='inter' && ad<=ap && metodo==='mva') {}
  if(sel && sel.seg===2) alerts.push('Tabela III-B: remetente de UF não signatária dos Protocolos ICMS 14/2006 e 15/2006.');
  const rows = [
    ['Mercadoria', sel? sel.cest+' · '+sel.desc : (st.manual?'Cálculo manual (sem consulta ao Subanexo I)':'—')],
    ['Operação', st.op==='inter'?'Entrada interestadual em MS · alíquota '+st.ai+'%':'Operação interna em MS'],
    ['Valor da operação (base IV)', brl(r2(valorOp))],
    ['MVA aplicada', mva===null? '—' : pct(mva*100,4)],
    ['Base de cálculo ST', brl(bcST)],
    ['ICMS presumido ('+pct(ad*100,0)+')', brl(icmsTot)],
    ['(−) ICMS próprio', brl(icmsProp)],
    ['ICMS-ST', brl(icmsST)],
  ];
  if($('fecomp').checked) rows.push(['FECOMP-ST', brl(fec)]);
  $('resTab').innerHTML = rows.map(r=>'<tr><td>'+esc(r[0])+'</td><td class="n">'+esc(r[1])+'</td></tr>').join('');
  $('resTab').querySelectorAll('tr')[0].lastChild.style.whiteSpace='normal';
  $('resTab').querySelectorAll('tr')[0].lastChild.style.textAlign='left';
  $('tot').textContent = brl(r2(icmsST+fec));
  $('totSub').textContent = fec? 'ICMS-ST '+brl(icmsST)+' + FECOMP '+brl(fec) : '';
  $('alerts').innerHTML = alerts.map(a=>'<div class="warn">'+esc(a)+'</div>').join('');
  $('memo').textContent = memo.join('\n');
  ultimo = { sel:sel, aliq: st.op==='inter'? st.ai+'%':'interna', ad:ad*100, metodo, valorOp:r2(valorOp), mva, bcST, icmsTot, icmsProp, icmsST, fec, memo:memo.join('\n') };
}

/* ---------- lista da nota ---------- */
function renderLista(){
  const tb=$('lista');
  if(!st.lista.length){ tb.innerHTML='<tr><td colspan="10" class="empty">Nenhum item adicionado. Calcule um item e clique em “Adicionar à nota”.</td></tr>'; $('listaTot').innerHTML=''; return; }
  tb.innerHTML = st.lista.map((x,i)=>'<tr><td>'+(i+1)+'</td><td style="white-space:nowrap">'+esc(x.sel? x.sel.cest+'<br>'+x.sel.ncm.join(' '):'—').replace('&lt;br&gt;','<br>')+'</td><td>'+esc(x.sel?x.sel.desc:'Cálculo manual')+'</td><td class="n">'+esc(x.aliq)+'</td><td class="n">'+(x.mva===null?'—':pct(x.mva*100))+'</td><td class="n">'+fmt(x.bcST)+'</td><td class="n">'+fmt(x.icmsProp)+'</td><td class="n">'+fmt(x.icmsST)+'</td><td class="n">'+fmt(x.fec)+'</td><td class="noprint"><button class="x" type="button" data-i="'+i+'" aria-label="Remover item '+(i+1)+'">✕</button></td></tr>').join('');
  tb.querySelectorAll('button.x').forEach(b=>b.onclick=()=>{ st.lista.splice(+b.dataset.i,1); renderLista(); });
  const s=k=>st.lista.reduce((a,x)=>a+x[k],0);
  $('listaTot').innerHTML='<tr><td colspan="5"><b>Total</b></td><td class="n"><b>'+fmt(s('bcST'))+'</b></td><td class="n"><b>'+fmt(s('icmsProp'))+'</b></td><td class="n"><b>'+fmt(s('icmsST'))+'</b></td><td class="n"><b>'+fmt(s('fec'))+'</b></td><td class="noprint"></td></tr><tr><td colspan="7"><b>Total a recolher (ICMS-ST + FECOMP)</b></td><td colspan="2" class="n"><b>'+brl(r2(s('icmsST')+s('fec')))+'</b></td><td class="noprint"></td></tr>';
}
$('addList').onclick = ()=>{ if(ultimo){ st.lista.push({...ultimo}); renderLista(); flash('Item adicionado à nota.'); } };
$('clearAll').onclick = ()=>{ st.lista=[]; renderLista(); };
function flash(t){ $('copyMsg').textContent=t; setTimeout(()=>$('copyMsg').textContent='',2500); }
async function copiar(t){ try{ await navigator.clipboard.writeText(t); flash('Copiado.'); } catch(e){ const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy'); flash('Copiado.');}catch(_){flash('Selecione o texto e copie manualmente.');} ta.remove(); } }
$('copyOne').onclick = ()=>{ if(ultimo) copiar('ICMS-ST MS — '+(ultimo.sel? ultimo.sel.cest+' '+ultimo.sel.desc:'item')+'\n'+ultimo.memo+'\nTotal a recolher: '+brl(r2(ultimo.icmsST+ultimo.fec))); };
$('copyAll').onclick = ()=>{
  if(!st.lista.length) return flash('A lista está vazia.');
  const L=['ICMS-ST MS'+($('cli').value?' — '+$('cli').value:'')+($('nf').value?' — '+$('nf').value:'')];
  st.lista.forEach((x,i)=>L.push((i+1)+') '+(x.sel?x.sel.cest+' '+x.sel.desc.slice(0,60):'item')+' | alíq '+x.aliq+' | MVA '+(x.mva===null?'—':pct(x.mva*100))+' | BC-ST '+fmt(x.bcST)+' | ICMS próprio '+fmt(x.icmsProp)+' | ICMS-ST '+fmt(x.icmsST)+(x.fec?' | FECOMP '+fmt(x.fec):'')));
  const t=st.lista.reduce((a,x)=>a+x.icmsST+x.fec,0); L.push('Total a recolher: '+brl(r2(t)));
  copiar(L.join('\n'));
};

/* ---------- estado inicial: exemplo ---------- */
$('q').value = '4011.10.00';
buscar();
const ex = ITENS.find(x=>x.cest==='16.001.00');
if(ex){ selecionar(ex); buscar(); }
renderLista();

/* ---------- vários NCMs ---------- */
const lote = [];
function matchNCM(qd){
  if(qd.length<8) return [];
  const len = x => Math.max(...x.ncmD.filter(n=>qd.startsWith(n)).map(n=>n.length),0);
  return ITENS.filter(x => usaItem(x) && x.ncmD.some(n => qd.startsWith(n))).sort((a,b)=>len(b)-len(a));
}
function novaLinha(o={}){
  const L = { ncm:o.ncm||'', ai:o.ai|| (st.op==='interna'?'int':String(st.ai)), v:o.v||0, ipi:o.ipi||0, desp:o.desp||0, desc:o.desc||0, ad:null, pick:null, cands:[] };
  resolver(L); return L;
}
function resolver(L){
  const qd = digits(L.ncm);
  L.cands = matchNCM(qd);
  if(!L.cands.includes(L.pick)) L.pick = L.cands.length===1 ? L.cands[0] : null;
  L.ad = L.pick ? (aliqImplicita(L.pick) || ALQ_INT) : (L.ad||ALQ_INT);
}
function calcLinha(L){
  const qd = digits(L.ncm);
  if(qd.length<8) return {status:'incompleto'};
  if(L.pick==='TRIB' || (!L.cands.length && !L.pick)) return {status:'trib'};
  if(!L.pick) return {status:'escolher'};
  if(!L.pick.mva) return {status:'semmva'};
  const col = L.ai==='int'?0:({4:1,7:2,12:3})[L.ai];
  const mva = L.pick.mva[col]/100, ad = L.ad/100, ap = L.ai==='int'? ad : (+L.ai)/100;
  const valorOp = L.v + L.ipi + L.desp - L.desc, bcProp = L.v + L.desp - L.desc;
  const bcST = r2(valorOp*(1+mva)), icmsTot = r2(bcST*ad), prop = (L.propInf!=null ? L.propInf : r2(bcProp*ap));
  return {status:'ok', mva, bcST, prop, st: Math.max(0, r2(icmsTot-prop))};
}
const cellNum = (i,k,v) => '<input class="num w-v" data-i="'+i+'" data-k="'+k+'" value="'+fmt(v)+'" aria-label="'+k+' linha '+(i+1)+'">';
function renderLote(){
  const tb = $('loteBody');
  if(!lote.length){ tb.innerHTML='<tr><td colspan="14" class="empty">Nenhuma linha. Clique em “Adicionar linha” ou cole uma lista.</td></tr>'; $('loteTot').innerHTML=''; return; }
  tb.innerHTML = lote.map((L,i)=>{
    let pick;
    if(digits(L.ncm).length<8) pick = '<span class="tag">Informe o NCM com 8 dígitos</span>';
    else if(!L.cands.length) pick = '<span class="trib">PRODUTO TRIBUTADO - Sem incidência de ICMS Substituição Tributária</span>';
    else if(L.cands.length===1) pick = '<div style="font-size:12.5px">'+esc(L.pick.desc.length>80?L.pick.desc.slice(0,80)+'…':L.pick.desc)+'</div><div class="tag">CEST '+L.pick.cest+' · '+esc(SEGS[L.pick.seg].tab)+' item '+esc(L.pick.item)+'</div>';
    else pick = '<select class="pick" data-i="'+i+'" data-k="pick" aria-label="Item ST da linha '+(i+1)+'"><option value="">Escolha o item ('+L.cands.length+' opções)…</option>'+L.cands.map(c=>'<option value="'+c.i+'"'+(L.pick===c?' selected':'')+'>'+c.cest+' · '+esc(SEGS[c.seg].tab.replace('Tabela ',''))+' · '+esc(c.desc.slice(0,90))+'</option>').join('')+'</select>';
    const ai = '<select class="w-s" data-i="'+i+'" data-k="ai" aria-label="Origem linha '+(i+1)+'">'+[['4','4%'],['7','7%'],['12','12%'],['int','Interna']].map(([v,t])=>'<option value="'+v+'"'+(L.ai===v?' selected':'')+'>'+t+'</option>').join('')+'</select>';
    return '<tr data-row="'+i+'"><td>'+(i+1)+'</td><td><input class="w-ncm" data-i="'+i+'" data-k="ncm" value="'+esc(L.ncm)+'" placeholder="00000000" aria-label="NCM linha '+(i+1)+'"></td><td style="min-width:180px;max-width:230px">'+pick+'</td><td>'+ai+'</td><td>'+cellNum(i,'v',L.v)+'</td><td>'+cellNum(i,'ipi',L.ipi)+'</td><td>'+cellNum(i,'desp',L.desp)+'</td><td>'+cellNum(i,'desc',L.desc)+'</td><td><input class="num w-s" data-i="'+i+'" data-k="ad" value="'+L.ad+'" aria-label="Alíquota interna linha '+(i+1)+'"></td><td class="n o-mva"></td><td class="n o-bc"></td><td class="n o-prop"></td><td class="n o-st"></td><td class="noprint"><button class="x" type="button" data-del="'+i+'" aria-label="Remover linha '+(i+1)+'">✕</button></td></tr>';
  }).join('');
  tb.querySelectorAll('input,select').forEach(el=>{
    const i=+el.dataset.i, k=el.dataset.k;
    if(k==='ncm'){ el.addEventListener('change',()=>{ lote[i].ncm=el.value.trim(); resolver(lote[i]); renderLote(); }); }
    else if(k==='pick'){ el.addEventListener('change',()=>{ lote[i].pick = el.value===''?null:ITENS[+el.value]; lote[i].ad = lote[i].pick?(aliqImplicita(lote[i].pick)||ALQ_INT):lote[i].ad; renderLote(); }); }
    else if(k==='ai'){ el.addEventListener('change',()=>{ lote[i].ai=el.value; atualizarLote(); }); }
    else { el.addEventListener('input',()=>{ lote[i][k]=num(el.value); atualizarLote(); }); if(k!=='ad') el.addEventListener('blur',()=>{ el.value=fmt(num(el.value)); }); }
  });
  tb.querySelectorAll('button[data-del]').forEach(b=>b.onclick=()=>{ lote.splice(+b.dataset.del,1); renderLote(); });
  atualizarLote();
}
function atualizarLote(){
  let tBC=0,tP=0,tS=0,nOk=0,nTrib=0,nPend=0;
  lote.forEach((L,i)=>{
    const tr = $('loteBody').querySelector('tr[data-row="'+i+'"]'); if(!tr) return;
    const r = calcLinha(L); L.res = r;
    const set=(c,t)=>tr.querySelector(c).textContent=t;
    if(r.status==='ok'){ set('.o-mva',pct(r.mva*100)); set('.o-bc',fmt(r.bcST)); set('.o-prop',fmt(r.prop)); set('.o-st',fmt(r.st)); tBC+=r.bcST; tP+=r.prop; tS+=r.st; nOk++; }
    else { const t = {trib:'Sem ICMS-ST',escolher:'Escolha o item',semmva:'Sem MVA (use PMPF)',incompleto:'—'}[r.status]; set('.o-mva','—'); set('.o-bc','—'); set('.o-prop','—'); set('.o-st',t); if(r.status==='trib') nTrib++; else nPend++; }
  });
  $('loteTot').innerHTML = lote.length ? '<tr><td colspan="10"><b>Total</b> <span class="tag">· '+nOk+' calculado(s) · '+nTrib+' tributado(s) sem ST'+(nPend?' · '+nPend+' pendente(s)':'')+'</span></td><td class="n"><b>'+fmt(r2(tBC))+'</b></td><td class="n"><b>'+fmt(r2(tP))+'</b></td><td class="n"><b>'+brl(r2(tS))+'</b></td><td class="noprint"></td></tr>' : '';
}
$('loteAdd').onclick = ()=>{ lote.push(novaLinha()); renderLote(); const ins=$('loteBody').querySelectorAll('input.w-ncm'); ins[ins.length-1].focus(); };
$('loteClear').onclick = ()=>{ lote.length=0; renderLote(); };
$('lotePaste').onclick = ()=>{
  const linhas = $('loteTxt').value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  let n=0;
  linhas.forEach(l=>{
    const c = l.split(/\t|;/).map(x=>x.trim());
    if(digits(c[0]).length<8) return;
    let ai = (c[2]||'').toLowerCase().replace('%','');
    ai = ai.startsWith('int') ? 'int' : (['4','7','12'].includes(ai) ? ai : undefined);
    lote.push(novaLinha({ncm:c[0], v:num(c[1]), ai, ipi:num(c[3]), desp:num(c[4]), desc:num(c[5])})); n++;
  });
  $('loteMsg').textContent = n+' linha(s) incluída(s)'+(linhas.length>n?' · '+(linhas.length-n)+' ignorada(s) (NCM sem 8 dígitos)':'')+'.';
  if(n) $('loteTxt').value='';
  renderLote();
};
$('loteCopy').onclick = async ()=>{
  if(!lote.length) return;
  const L = ['NCM\tCEST\tDescrição\tOrigem\tMercadoria\tIPI\tFrete/desp.\tDesconto\tAlíq. int.\tMVA\tBC-ST\tICMS próprio\tICMS-ST'];
  lote.forEach(x=>{ const r=x.res||{}; L.push([x.ncm, x.pick?x.pick.cest:'', x.pick?x.pick.desc:(r.status==='trib'?'PRODUTO TRIBUTADO - Sem incidência de ICMS Substituição Tributária':''), x.ai==='int'?'Interna':x.ai+'%', fmt(x.v), fmt(x.ipi), fmt(x.desp), fmt(x.desc), x.ad+'%', r.status==='ok'?pct(r.mva*100):'', r.status==='ok'?fmt(r.bcST):'', r.status==='ok'?fmt(r.prop):'', r.status==='ok'?fmt(r.st):''].join('\t')); });
  const t = lote.reduce((a,x)=>a+(x.res&&x.res.status==='ok'?x.res.st:0),0); L.push('\t\t\t\t\t\t\t\t\t\t\tTotal ICMS-ST\t'+fmt(r2(t)));
  const txt=L.join('\n');
  try{ await navigator.clipboard.writeText(txt); $('loteMsg2').textContent='Copiado. Cole no Excel.'; }
  catch(e){ const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy'); $('loteMsg2').textContent='Copiado. Cole no Excel.';}catch(_){ $('loteMsg2').textContent='Não foi possível copiar.'; } ta.remove(); }
  setTimeout(()=>$('loteMsg2').textContent='',3000);
};
/* exemplo inicial */
[{ncm:'8708.99.90',v:1000,ai:'12'},{ncm:'2203.00.00',v:500,ai:'7'},{ncm:'1006.30.21',v:300,ai:'12'}].forEach(o=>lote.push(novaLinha(o)));
renderLote();
/* ---------- importação de XML ---------- */
const xmlLinhas = []; const xmlNotas = [];
const SUL_SUDESTE = ['SP','RJ','MG','PR','SC','RS'];
const tx = (el,tag) => { const n = el && el.getElementsByTagName(tag)[0]; return n ? n.textContent.trim() : ''; };
const nx = (el,tag) => { const v = tx(el,tag); return v ? parseFloat(v) : 0; };
function lerXML(texto, nomeArq){
  const doc = new DOMParser().parseFromString(texto,'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error(nomeArq+': XML inválido.');
  const inf = doc.getElementsByTagName('infNFe')[0];
  if(!inf) throw new Error(nomeArq+': não é um XML de NF-e (sem infNFe).');
  const ide = inf.getElementsByTagName('ide')[0], emit = inf.getElementsByTagName('emit')[0], dest = inf.getElementsByTagName('dest')[0];
  const nota = { arq:nomeArq, nNF:tx(ide,'nNF'), serie:tx(ide,'serie'), dhEmi:(tx(ide,'dhEmi')||tx(ide,'dEmi')).slice(0,10), emit:tx(emit,'xNome'), emitCNPJ:tx(emit,'CNPJ')||tx(emit,'CPF'), ufEmit:tx(emit.getElementsByTagName('enderEmit')[0],'UF'), crt:tx(emit,'CRT'), dest:tx(dest,'xNome'), ufDest: dest? tx(dest.getElementsByTagName('enderDest')[0],'UF') : '', chave:(inf.getAttribute('Id')||'').replace(/^NFe/,''), vST: nx(inf.getElementsByTagName('ICMSTot')[0],'vST'), vNF: nx(inf.getElementsByTagName('ICMSTot')[0],'vNF'), natOp:tx(ide,'natOp'), tpNF:tx(ide,'tpNF'), finNFe:tx(ide,'finNFe'), indIEDest:tx(dest,'indIEDest') };
  nota.ufOrig = nota.tpNF==='0' ? (nota.ufDest || nota.ufEmit) : nota.ufEmit;
  nota.ufDestino = nota.tpNF==='0' ? nota.ufEmit : nota.ufDest;
  nota.bloq = nota.finNFe==='4' ? 'Devolução' : (nota.finNFe==='3' ? 'NF de ajuste' : (nota.tpNF==='1' && nota.indIEDest==='9' && nota.ufEmit==='MS' ? 'Venda a não contribuinte' : null));
  nota.avisos = [];
  if(nota.finNFe==='4') nota.avisos.push('NF de devolução: não gera ICMS-ST a recolher; trate o estorno ou o ressarcimento do imposto da entrada original.');
  if(nota.finNFe==='3') nota.avisos.push('NF de ajuste: sem cálculo de ST.');
  if(nota.tpNF==='0' && nota.finNFe!=='4') nota.avisos.push('NF de entrada emitida pelo próprio destinatário: a origem considerada é a UF do remetente ('+(nota.ufDest||'—')+').');
  if(nota.bloq==='Venda a não contribuinte') nota.avisos.push('Saída de MS para consumidor final (não contribuinte): a ST já deve ter sido recolhida na entrada da mercadoria.');
  if(nota.ufDestino && nota.ufDestino!=='MS') nota.avisos.push('Mercadoria não destinada a MS: a ST de MS não se aplica.');
  if(xmlNotas.some(n=>n.chave && n.chave===nota.chave)) throw new Error('NF '+nota.nNF+' já importada.');
  xmlNotas.push(nota);
  [...inf.getElementsByTagName('det')].forEach(det=>{
    const prod = det.getElementsByTagName('prod')[0], imp = det.getElementsByTagName('imposto')[0];
    const icmsG = imp && imp.getElementsByTagName('ICMS')[0], g = icmsG && icmsG.firstElementChild;
    const ipi = imp && imp.getElementsByTagName('IPITrib')[0];
    const orig = tx(g,'orig'), cst = tx(g,'CST') || tx(g,'CSOSN'), pICMS = nx(g,'pICMS');
    let ai, aiFonte;
    if(nota.ufOrig==='MS'){ ai='int'; aiFonte='remetente de MS'; }
    else if([4,7,12].includes(Math.round(pICMS*100)/100) ){ ai=String(pICMS); aiFonte='pICMS do XML'; }
    else if(['1','2','3','8'].includes(orig)){ ai='4'; aiFonte='origem estrangeira ('+orig+')'; }
    else { ai = SUL_SUDESTE.includes(nota.ufOrig)?'7':'12'; aiFonte='UF do remetente ('+nota.ufOrig+')'; }
    const L = novaLinha({ ncm:tx(prod,'NCM'), ai, v:nx(prod,'vProd'), ipi:nx(ipi,'vIPI'), desp: r2(nx(prod,'vFrete')+nx(prod,'vSeg')+nx(prod,'vOutro')), desc:nx(prod,'vDesc') });
    Object.assign(L, { nota, nItem:det.getAttribute('nItem'), cProd:tx(prod,'cProd'), xProd:tx(prod,'xProd'), cestXml:tx(prod,'CEST'), cfop:tx(prod,'CFOP'), cst: orig+cst, aiFonte, vICMS:nx(g,'vICMS'), vICMSST:nx(g,'vICMSST'), pMVAST:tx(g,'pMVAST') });
    definirItemXml(L);
    xmlLinhas.push(L);
  });
  return nota;
}
function definirItemXml(L){
  L.cands = matchNCM(digits(L.ncm));
  const cd = digits(L.cestXml);
  L.cestSit = '';
  if(cd){
    const c = ITENS.find(x => digits(x.cest)===cd && usaItem(x));
    if(c){ if(!L.cands.includes(c)) L.cands.unshift(c); L.pick = c; L.cestSit = 'ok'; }
    else { L.pick = L.cands.length ? 'TRIB' : null; L.cestSit = 'fora'; }
  } else {
    L.pick = L.cands.length===1 ? L.cands[0] : null; L.cestSit = L.cands.length ? 'sem' : '';
  }
  L.ad = (L.pick && L.pick!=='TRIB') ? (aliqImplicita(L.pick)||ALQ_INT) : ALQ_INT;
}
function propXml(L){ L.propInf = ($('xmlUsaVicms').checked && L.vICMS>0) ? L.vICMS : null; }
function renderXml(){
  const tb = $('xmlBody');
  $('xmlHead').innerHTML = xmlNotas.map(n=>'<div class="nfhead"><span><b>NF '+esc(n.nNF)+'</b> série '+esc(n.serie)+' · '+esc(n.dhEmi.split('-').reverse().join('/'))+'</span><span>Emitente: '+esc(n.emit)+' ('+esc(n.ufEmit)+')'+(n.crt==='1'?' · Simples Nacional':'')+'</span><span>Destinatário: '+esc(n.dest||'—')+' ('+esc(n.ufDest||'—')+')</span><span>Valor da NF '+brl(n.vNF)+' · ST destacada '+brl(n.vST)+'</span><span>'+esc(n.natOp)+' · '+(n.tpNF==='0'?'entrada':'saída')+'</span>'+n.avisos.map(a=>'<span class="trib" style="flex-basis:100%">'+esc(a)+'</span>').join('')+'</div>').join('');
  if(!xmlLinhas.length){ tb.innerHTML='<tr><td colspan="14" class="empty">Nenhum XML importado.</td></tr>'; $('xmlTot').innerHTML=''; return; }
  tb.innerHTML = xmlLinhas.map((L,i)=>{
    let item;
    if(!L.cands.length) item = '<span class="trib">PRODUTO TRIBUTADO - Sem incidência de ICMS Substituição Tributária</span>';
    else {
      item = '<select class="pick" data-x="'+i+'" data-k="pick" aria-label="Item ST do produto '+(i+1)+'"><option value=""'+(!L.pick?' selected':'')+'>Escolha o item ('+L.cands.length+')…</option><option value="TRIB"'+(L.pick==='TRIB'?' selected':'')+'>Não se enquadra · produto tributado</option>'+L.cands.map(c=>'<option value="'+c.i+'"'+(L.pick===c?' selected':'')+'>'+c.cest+' · '+esc(SEGS[c.seg].tab.replace('Tabela ',''))+' · '+esc(c.desc.slice(0,80))+'</option>').join('')+'</select>';
      if(L.pick==='TRIB') item += '<div class="trib">PRODUTO TRIBUTADO - Sem incidência de ICMS Substituição Tributária</div>';
      if(L.cestSit==='ok' && L.pick && L.pick!=='TRIB' && digits(L.pick.cest)===digits(L.cestXml)) item += '<div class="tag ok-t">CEST da NF confere com a tabela</div>';
      else if(L.cestSit==='fora') item += '<div class="tag warn-t">CEST '+esc(L.cestXml)+' da NF não consta no Subanexo I</div>';
      else if(L.cestSit==='sem' && L.pick && L.pick!=='TRIB') item += '<div class="tag warn-t">NF sem CEST: confirme se a descrição se aplica</div>';
    }
    const ai = '<select class="w-s" data-x="'+i+'" data-k="ai" title="'+esc(L.aiFonte)+'" aria-label="Origem item '+(i+1)+'">'+[['4','4%'],['7','7%'],['12','12%'],['int','Interna']].map(([v,t])=>'<option value="'+v+'"'+(L.ai===v?' selected':'')+'>'+t+'</option>').join('')+'</select>';
    return '<tr data-row="'+i+'"><td>'+L.nItem+'</td><td>'+esc(L.nota.nNF)+'</td><td style="min-width:160px;max-width:240px"><div style="font-size:12.5px">'+esc(L.xProd)+'</div><div class="tag">Cód. '+esc(L.cProd)+(L.cestXml?' · CEST NF '+esc(L.cestXml):'')+'</div></td><td style="min-width:150px">'+esc(L.ncm)+'<br>'+item+'</td><td class="tag">'+esc(L.cst)+' · '+esc(L.cfop)+'</td><td>'+ai+'</td><td class="n">'+fmt(r2(L.v+L.ipi+L.desp-L.desc))+'</td><td><input class="num w-s" data-x="'+i+'" data-k="ad" value="'+L.ad+'" aria-label="Alíquota interna item '+(i+1)+'"></td><td class="n o-mva"></td><td class="n o-bc"></td><td class="n o-prop"></td><td class="n o-st"></td><td class="n">'+fmt(L.vICMSST)+'</td><td class="n o-dif"></td></tr>';
  }).join('');
  tb.querySelectorAll('[data-x]').forEach(el=>{
    const L = xmlLinhas[+el.dataset.x], k = el.dataset.k;
    if(k==='pick') el.addEventListener('change',()=>{ if(L.cestSit==='sem') L.cestSit='manual'; L.pick = el.value===''?null:(el.value==='TRIB'?'TRIB':ITENS[+el.value]); if(L.pick && L.pick!=='TRIB') L.ad = aliqImplicita(L.pick)||ALQ_INT; renderXml(); });
    else if(k==='ai') el.addEventListener('change',()=>{ L.ai = el.value; atualizarXml(); });
    else el.addEventListener('input',()=>{ L.ad = num(el.value); atualizarXml(); });
  });
  atualizarXml();
}
function atualizarXml(){
  let tBC=0,tP=0,tS=0,tNF=0,tDif=0,tConf=0,nOk=0,nTrib=0,nPend=0,nConf=0;
  xmlLinhas.forEach((L,i)=>{
    const tr = $('xmlBody').querySelector('tr[data-row="'+i+'"]'); if(!tr) return;
    propXml(L); const r0 = calcLinha(L), r = (L.nota.bloq && r0.status!=='trib') ? {status:'bloq'} : r0; L.res = r;
    const set=(c,t,cls)=>{ const e=tr.querySelector(c); e.textContent=t; e.className='n '+c.slice(1)+(cls?' '+cls:''); };
    tNF += L.vICMSST;
    if(r.status==='ok'){ let dif = r2(r.st - L.vICMSST); if(Math.abs(dif)<0.015) dif = 0; if(L.cestSit==='sem'){ nConf++; if(dif>0) tConf+=dif; } L.dif = dif; set('.o-mva',pct(r.mva*100)); set('.o-bc',fmt(r.bcST)); set('.o-prop',fmt(r.prop)); set('.o-st',fmt(r.st)); set('.o-dif',fmt(dif), dif>0.009?'neg':(dif<-0.009?'pos':'')); tBC+=r.bcST; tP+=r.prop; tS+=r.st; if(dif>0 && L.cestSit!=='sem') tDif+=dif; nOk++; }
    else { L.dif=null; const t={trib:'Sem ICMS-ST',escolher:'Escolha o item',semmva:'Sem MVA (PMPF)',incompleto:'NCM inválido',bloq:(L.nota.bloq||'')+': sem cálculo'}[r.status]; set('.o-mva','—'); set('.o-bc','—'); set('.o-prop','—'); set('.o-st',t); set('.o-dif','—'); if(r.status==='trib') nTrib++; else if(r.status!=='bloq') nPend++; }
  });
  $('xmlTot').innerHTML = '<tr><td colspan="9"><b>Total</b> <span class="tag">· '+nOk+' calculado(s)'+(nConf?' (dos quais '+nConf+' sem CEST na NF, a confirmar)':'')+' · '+nTrib+' tributado(s) sem ST'+(nPend?' · '+nPend+' para escolher o item':'')+'</span></td><td class="n"><b>'+fmt(r2(tBC))+'</b></td><td class="n"><b>'+fmt(r2(tP))+'</b></td><td class="n"><b>'+fmt(r2(tS))+'</b></td><td class="n"><b>'+fmt(r2(tNF))+'</b></td><td class="n"></td></tr><tr><td colspan="13"><b>Diferença a recolher</b> <span class="tag">(linhas com item confirmado em que o ST calculado é maior que o destacado na NF)</span></td><td class="n"><b>'+brl(r2(tDif))+'</b></td></tr>'+(nConf?'<tr><td colspan="13" class="warn-t"><b>A confirmar</b> <span class="tag">('+nConf+' item(ns) sem CEST na NF: escolha o item ou “Não se enquadra” para incluir ou excluir)</span></td><td class="n warn-t"><b>'+brl(r2(tConf))+'</b></td></tr>':'');
}
async function importar(files){
  const msgs=[]; let n=0;
  for(const f of files){
    try{ const t = await f.text(); lerXML(t, f.name); n++; } catch(e){ msgs.push(e.message); }
  }
  $('xmlMsg').textContent = (n? n+' nota(s) importada(s). ':'') + msgs.join(' ');
  renderXml();
}
$('xmlFile').addEventListener('change', e=>{ importar([...e.target.files]); e.target.value=''; });
const drop = $('xmlDrop');
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e=>{ const fs=[...e.dataTransfer.files].filter(f=>/\.xml$/i.test(f.name)||/xml/.test(f.type)); if(fs.length) importar(fs); });
$('xmlUsaVicms').addEventListener('change', atualizarXml);
$('xmlClear').onclick = ()=>{ xmlLinhas.length=0; xmlNotas.length=0; $('xmlMsg').textContent=''; renderXml(); };
$('xmlCopy').onclick = async ()=>{
  if(!xmlLinhas.length) return;
  const T=['NF\tItem\tCódigo\tProduto\tNCM\tCEST\tCST\tCFOP\tOrigem\tValor op.\tAlíq. int.\tMVA\tBC-ST\tICMS próprio\tST calculado\tST na NF\tDiferença'];
  xmlLinhas.forEach(L=>{ const r=L.res||{}, ok=r.status==='ok'; T.push([L.nota.nNF,L.nItem,L.cProd,L.xProd,L.ncm,L.pick?L.pick.cest:(r.status==='trib'?'PRODUTO TRIBUTADO - Sem incidência de ICMS Substituição Tributária':''),L.cst,L.cfop,L.ai==='int'?'Interna':L.ai+'%',fmt(r2(L.v+L.ipi+L.desp-L.desc)),L.ad+'%',ok?pct(r.mva*100):'',ok?fmt(r.bcST):'',ok?fmt(r.prop):'',ok?fmt(r.st):'',fmt(L.vICMSST),ok?fmt(L.dif):''].join('\t')); });
  const txt=T.join('\n');
  try{ await navigator.clipboard.writeText(txt); $('xmlMsg').textContent='Copiado. Cole no Excel.'; }
  catch(e){ const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy'); $('xmlMsg').textContent='Copiado. Cole no Excel.';}catch(_){ $('xmlMsg').textContent='Não foi possível copiar.'; } ta.remove(); }
};
/* ---------- abas ---------- */
const TABS = ['xml','consulta','itens'];
function abrirAba(t){
  if(!TABS.includes(t)) t='xml';
  TABS.forEach(x=>{ $('tab-'+x).hidden = x!==t; $('tb-'+x).setAttribute('aria-selected', x===t?'true':'false'); $('tb-'+x).tabIndex = x===t?0:-1; });
  try{ localStorage.setItem('icmsst-aba', t); }catch(e){}
}
document.querySelectorAll('.tabs button').forEach((b,i,all)=>{
  b.addEventListener('click',()=>abrirAba(b.dataset.tab));
  b.addEventListener('keydown',e=>{ if(e.key==='ArrowRight'||e.key==='ArrowLeft'){ const n=all[(i+(e.key==='ArrowRight'?1:all.length-1))%all.length]; n.focus(); abrirAba(n.dataset.tab); } });
});
(function(){ let t = (location.hash||'').slice(1); if(!TABS.includes(t)){ try{ t = localStorage.getItem('icmsst-aba'); }catch(e){} } abrirAba(t||'xml'); })();

/* ---------- Excel (.xlsx) sem bibliotecas ---------- */
const CRC_T = (()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
function crc32(u){ let c=0xFFFFFFFF; for(let i=0;i<u.length;i++) c = CRC_T[(c^u[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function zip(files){
  const enc=new TextEncoder(), parts=[], central=[]; let off=0;
  const u16=v=>[v&255,(v>>>8)&255], u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
  for(const [name,txt] of files){
    const nm=enc.encode(name), data=enc.encode(txt), crc=crc32(data);
    const head=[...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),...u16(0)];
    parts.push(new Uint8Array(head),nm,data);
    central.push([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)], nm);
    off += head.length+nm.length+data.length;
  }
  let cSize=0; const cParts=[]; for(let i=0;i<central.length;i+=2){ const a=new Uint8Array(central[i]); cParts.push(a,central[i+1]); cSize+=a.length+central[i+1].length; }
  const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cSize),...u32(off),...u16(0)]);
  return new Blob([...parts,...cParts,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
const xe = v => String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
function colL(i){ let s=''; i++; while(i>0){ const m=(i-1)%26; s=String.fromCharCode(65+m)+s; i=Math.floor((i-1)/26); } return s; }
/* sheet = {name, title?, sub?, cols:[{h, w, t:'s'|'n'|'p'|'i'}], rows:[[...]], total?:[...]}  t: s texto, n moeda, p percentual (valor em %), i inteiro */
function xlsx(sheets){
  const files=[];
  files.push(['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>']);
  files.push(['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
  files.push(['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>'<sheet name="'+xe(s.name.slice(0,31))+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>']);
  files.push(['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>']);
  /* estilos: 0 normal | 1 cabeçalho | 2 moeda | 3 % | 4 total texto | 5 total moeda | 6 título | 7 subtítulo | 8 inteiro | 9 texto com quebra */
  files.push(['xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.00##&quot;%&quot;"/></numFmts><fonts count="5"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF1F3864"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF5B6578"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7EEFB"/></patternFill></fill></fills><borders count="2"><border/><border><top style="thin"><color rgb="FF1F3864"/></top></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="2" applyFont="1" applyFill="1" numFmtId="0" borderId="0" xfId="0"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="164" applyNumberFormat="1" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="165" applyNumberFormat="1" fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="2" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" numFmtId="0" xfId="0"/><xf numFmtId="164" fontId="2" fillId="3" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" xfId="0"/><xf fontId="3" applyFont="1" numFmtId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="4" applyFont="1" numFmtId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="1" applyNumberFormat="1" fontId="0" fillId="0" borderId="0" xfId="0"/><xf applyAlignment="1" numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']);
  sheets.forEach((sh,si)=>{
    const rows=[]; let r=1;
    const cell=(c,v,style,t)=>{ const ref=colL(c)+r; if(v===null||v===undefined||v==='') return style?'<c r="'+ref+'" s="'+style+'"/>':''; if(t==='n'&&typeof v==='number'&&isFinite(v)) return '<c r="'+ref+'" s="'+style+'"><v>'+(Math.round(v*1e6)/1e6)+'</v></c>'; return '<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xe(v)+'</t></is></c>'; };
    if(sh.title){ rows.push('<row r="'+r+'">'+cell(0,sh.title,6,'s')+'</row>'); r++; }
    (sh.sub||[]).forEach(t=>{ rows.push('<row r="'+r+'">'+cell(0,t,7,'s')+'</row>'); r++; });
    if(sh.title||sh.sub) r++;
    const hr=r; rows.push('<row r="'+r+'" ht="28" customHeight="1">'+sh.cols.map((c,i)=>cell(i,c.h,1,'s')).join('')+'</row>'); r++;
    const sty=t=>({n:2,p:3,i:8,w:9}[t]||0);
    sh.rows.forEach(row=>{ rows.push('<row r="'+r+'">'+row.map((v,i)=>{ const t=sh.cols[i].t; return cell(i,v,sty(t),(t==='n'||t==='p'||t==='i')?'n':'s'); }).join('')+'</row>'); r++; });
    if(sh.total){ rows.push('<row r="'+r+'">'+sh.total.map((v,i)=>cell(i,v,typeof v==='number'?5:4,typeof v==='number'?'n':'s')).join('')+'</row>'); r++; }
    (sh.after||[]).forEach(t=>{ r++; rows.push('<row r="'+r+'">'+t.map((v,i)=>cell(i,v,typeof v==='number'?5:4,typeof v==='number'?'n':'s')).join('')+'</row>'); });
    const cols='<cols>'+sh.cols.map((c,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(c.w||12)+'" customWidth="1"/>').join('')+'</cols>';
    const last=colL(sh.cols.length-1);
    files.push(['xl/worksheets/sheet'+(si+1)+'.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="'+hr+'" topLeftCell="A'+(hr+1)+'" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+cols+'<sheetData>'+rows.join('')+'</sheetData>'+(sh.rows.length?'<autoFilter ref="A'+hr+':'+last+(hr+sh.rows.length)+'"/>':'')+'</worksheet>']);
  });
  return zip(files);
}
const DL = (window.claude && window.claude.use) ? window.claude.use('downloads').catch(()=>null) : Promise.resolve(null);
async function baixar(nome, blob, msgEl){
  const msg = t=>{ if(msgEl){ msgEl.textContent=t; setTimeout(()=>{ if(msgEl.textContent===t) msgEl.textContent=''; },4000); } };
  const dl = await DL;
  if(dl){
    try{ await dl.save({filename:nome, data:blob}); msg('Planilha salva: '+nome); }
    catch(e){ msg(e && e.code==='declined' ? 'Download cancelado.' : 'Não foi possível baixar aqui ('+(e&&e.code||'erro')+').'); }
    return;
  }
  try{
    const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000); msg('Planilha gerada: '+nome);
  }catch(e){ msg('O navegador bloqueou o download.'); }
}
const hoje = ()=>{ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const sanit = s => String(s||'').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60);
const N = v => (typeof v==='number' && isFinite(v)) ? r2(v) : null;
const tabRef = x => x ? SEGS[x.seg].tab+' · item '+x.item : '';
const FONTE = 'Fonte: Subanexo I ao Anexo III do RICMS/MS (Dec. 9.203/1998). Cálculo de apoio — conferir antes de recolher.';

/* aba 1: XML */
$('xlsxXml').onclick = ()=>{
  if(!xmlLinhas.length){ $('xmlMsg').textContent='Importe um XML antes de baixar.'; return; }
  const sit = L => { const r=L.res||{}; return ({ok:L.cestSit==='sem'?'Calculado (sem CEST na NF, a confirmar)':'Calculado',trib:'PRODUTO TRIBUTADO - Sem incidência de ICMS Substituição Tributária',escolher:'Escolher item',semmva:'Sem MVA (usar PMPF)',incompleto:'NCM inválido',bloq:(L.nota.bloq||'')+' - sem cálculo'})[r.status]||''; };
  const rows = xmlLinhas.map(L=>{ const r=L.res||{}, ok=r.status==='ok', it=(L.pick&&L.pick!=='TRIB')?L.pick:null;
    return [L.nota.nNF, L.nota.serie, L.nota.dhEmi.split('-').reverse().join('/'), L.nota.emit, L.nota.ufOrig, +L.nItem, L.cProd, L.xProd, L.ncm, L.cestXml, it?it.cest:'', tabRef(it), sit(L), L.cst, L.cfop, L.ai==='int'?'Interna':L.ai+'%', N(L.v), N(L.ipi), N(L.desp), N(L.desc), N(L.v+L.ipi+L.desp-L.desc), ok?L.ad:null, ok?r.mva*100:null, ok?r.bcST:null, ok?r.prop:null, ok?r.st:null, N(L.vICMSST), ok?L.dif:null]; });
  const sum = k => r2(xmlLinhas.reduce((a,L)=>a+((L.res&&L.res.status==='ok')?(k==='dif'?Math.max(0,L.cestSit==='sem'?0:L.dif):L.res[k]):0),0));
  const tNF = r2(xmlLinhas.reduce((a,L)=>a+L.vICMSST,0));
  const cols=[{h:'NF',w:9},{h:'Série',w:6},{h:'Emissão',w:11},{h:'Emitente',w:30},{h:'UF origem',w:8},{h:'Item',w:6,t:'i'},{h:'Código',w:11},{h:'Produto',w:38},{h:'NCM',w:11},{h:'CEST NF',w:10},{h:'CEST tabela',w:11},{h:'Subanexo I',w:20},{h:'Situação',w:34},{h:'CST/CSOSN',w:9},{h:'CFOP',w:7},{h:'Alíq. origem',w:9},{h:'Mercadoria',w:12,t:'n'},{h:'IPI',w:10,t:'n'},{h:'Frete/seg./outras',w:12,t:'n'},{h:'Desconto',w:10,t:'n'},{h:'Valor da operação',w:13,t:'n'},{h:'Alíq. interna %',w:9,t:'p'},{h:'MVA %',w:9,t:'p'},{h:'BC-ST',w:12,t:'n'},{h:'ICMS próprio',w:12,t:'n'},{h:'ST calculado',w:12,t:'n'},{h:'ST na NF',w:12,t:'n'},{h:'Diferença',w:12,t:'n'}];
  const total = cols.map(()=>''); total[0]='Total'; total[23]=sum('bcST'); total[24]=sum('prop'); total[25]=sum('st'); total[26]=tNF;
  const notas = xmlNotas.map(n=>{ const ls=xmlLinhas.filter(L=>L.nota===n); const s=k=>r2(ls.reduce((a,L)=>a+((L.res&&L.res.status==='ok')?L.res[k]:0),0)); const d=r2(ls.reduce((a,L)=>a+((L.res&&L.res.status==='ok'&&L.cestSit!=='sem'&&L.dif>0)?L.dif:0),0)); const c=r2(ls.reduce((a,L)=>a+((L.res&&L.res.status==='ok'&&L.cestSit==='sem'&&L.dif>0)?L.dif:0),0));
    return [n.nNF,n.serie,n.dhEmi.split('-').reverse().join('/'),n.chave,n.emit,n.ufEmit,n.dest,n.ufDest,n.natOp,N(n.vNF),ls.length,ls.filter(L=>L.res&&L.res.status==='ok').length,s('st'),N(n.vST),d,c,n.avisos.join(' ')]; });
  const wb = xlsx([
    {name:'Itens', title:'Cálculo de ICMS-ST por XML · MS', sub:['Gerado em '+new Date().toLocaleString('pt-BR')+' · '+xmlNotas.length+' nota(s)', FONTE], cols, rows, total,
     after:[['Diferença a recolher (itens confirmados)', ...Array(26).fill(''), sum('dif')]]},
    {name:'Notas', title:'Resumo por nota', cols:[{h:'NF',w:9},{h:'Série',w:6},{h:'Emissão',w:11},{h:'Chave de acesso',w:46},{h:'Emitente',w:32},{h:'UF emit.',w:7},{h:'Destinatário',w:32},{h:'UF dest.',w:7},{h:'Natureza',w:28},{h:'Valor da NF',w:13,t:'n'},{h:'Itens',w:6,t:'i'},{h:'Itens calculados',w:9,t:'i'},{h:'ST calculado',w:13,t:'n'},{h:'ST na NF',w:13,t:'n'},{h:'Diferença a recolher',w:14,t:'n'},{h:'A confirmar (sem CEST)',w:14,t:'n'},{h:'Avisos',w:60}], rows:notas}
  ]);
  const nome = 'ICMS-ST XML '+(xmlNotas.length===1?'NF '+xmlNotas[0].nNF:xmlNotas.length+' notas')+' '+hoje()+'.xlsx';
  baixar(nome, wb, $('xmlMsg'));
};

/* aba 2: consulta */
$('xlsxNota').onclick = ()=>{
  const itens = st.lista.length ? st.lista : (ultimo ? [ultimo] : []);
  if(!itens.length){ $('notaMsg').textContent='Calcule um item antes de baixar.'; return; }
  const cols=[{h:'#',w:5,t:'i'},{h:'CEST',w:11},{h:'NCM',w:16},{h:'Descrição',w:50},{h:'Subanexo I',w:20},{h:'Operação',w:14},{h:'Valor da operação',w:13,t:'n'},{h:'Alíq. interna %',w:9,t:'p'},{h:'MVA %',w:9,t:'p'},{h:'BC-ST',w:12,t:'n'},{h:'ICMS presumido',w:12,t:'n'},{h:'ICMS próprio',w:12,t:'n'},{h:'ICMS-ST',w:12,t:'n'},{h:'FECOMP',w:10,t:'n'},{h:'Total a recolher',w:13,t:'n'}];
  const rows = itens.map((x,i)=>[i+1, x.sel?x.sel.cest:'', x.sel?x.sel.ncm.join(' / '):'', x.sel?x.sel.desc:'Cálculo manual', tabRef(x.sel), x.aliq==='interna'?'Interna MS':'Interestadual '+x.aliq, N(x.valorOp), N(x.ad), x.mva===null?null:x.mva*100, x.bcST, N(x.icmsTot), x.icmsProp, x.icmsST, x.fec, r2(x.icmsST+x.fec)]);
  const s=k=>r2(itens.reduce((a,x)=>a+(x[k]||0),0));
  const total=cols.map(()=>''); total[0]='Total'; total[9]=s('bcST'); total[10]=s('icmsTot'); total[11]=s('icmsProp'); total[12]=s('icmsST'); total[13]=s('fec'); total[14]=r2(s('icmsST')+s('fec'));
  const memo=[]; itens.forEach((x,i)=>{ memo.push([(i+1)+') '+(x.sel?x.sel.cest+' · '+x.sel.desc:'Cálculo manual')]); x.memo.split('\n').forEach(l=>memo.push(['    '+l])); memo.push(['']); });
  const sub=[[$('cli').value,$('nf').value].filter(Boolean).join(' · ')||'', 'Gerado em '+new Date().toLocaleString('pt-BR'), FONTE].filter(Boolean);
  const wb = xlsx([{name:'Itens', title:'Cálculo de ICMS-ST · consulta', sub, cols, rows, total},{name:'Memória de cálculo', title:'Memória de cálculo', cols:[{h:'Detalhe',w:120}], rows:memo}]);
  baixar('ICMS-ST consulta '+(sanit($('nf').value||$('cli').value)?sanit($('nf').value||$('cli').value)+' ':'')+hoje()+'.xlsx', wb, $('notaMsg'));
};

/* aba 3: vários itens */
$('xlsxLote').onclick = ()=>{
  if(!lote.length){ $('loteMsg2').textContent='Adicione linhas antes de baixar.'; return; }
  const sit = r => ({ok:'Calculado',trib:'PRODUTO TRIBUTADO - Sem incidência de ICMS Substituição Tributária',escolher:'Escolher item',semmva:'Sem MVA (usar PMPF)',incompleto:'NCM incompleto'})[r.status]||'';
  const cols=[{h:'#',w:5,t:'i'},{h:'NCM',w:12},{h:'CEST',w:11},{h:'Descrição (Subanexo I)',w:50},{h:'Subanexo I',w:20},{h:'Situação',w:34},{h:'Alíq. origem',w:10},{h:'Mercadoria',w:12,t:'n'},{h:'IPI',w:10,t:'n'},{h:'Frete/desp.',w:11,t:'n'},{h:'Desconto',w:10,t:'n'},{h:'Valor da operação',w:13,t:'n'},{h:'Alíq. interna %',w:9,t:'p'},{h:'MVA %',w:9,t:'p'},{h:'BC-ST',w:12,t:'n'},{h:'ICMS próprio',w:12,t:'n'},{h:'ICMS-ST',w:12,t:'n'}];
  const rows = lote.map((L,i)=>{ const r=L.res||calcLinha(L), ok=r.status==='ok', it=(L.pick&&L.pick!=='TRIB')?L.pick:null; return [i+1, L.ncm, it?it.cest:'', it?it.desc:'', tabRef(it), sit(r), L.ai==='int'?'Interna':L.ai+'%', N(L.v), N(L.ipi), N(L.desp), N(L.desc), N(L.v+L.ipi+L.desp-L.desc), ok?L.ad:null, ok?r.mva*100:null, ok?r.bcST:null, ok?r.prop:null, ok?r.st:null]; });
  const s=k=>r2(lote.reduce((a,L)=>a+((L.res&&L.res.status==='ok')?L.res[k]:0),0));
  const total=cols.map(()=>''); total[0]='Total'; total[14]=s('bcST'); total[15]=s('prop'); total[16]=s('st');
  baixar('ICMS-ST varios itens '+hoje()+'.xlsx', xlsx([{name:'Itens', title:'Cálculo de ICMS-ST · vários itens', sub:['Gerado em '+new Date().toLocaleString('pt-BR'), FONTE], cols, rows, total}]), $('loteMsg2'));
};
