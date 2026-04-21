// ════════════════════════════════════════════════════════════════════
// FIREBASE CONFIGURATION - SUBSTITUA PELOS SEUS DADOS
// ════════════════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxx"
};

// Inicializar Firebase se não existir
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES DE SINCRONIZAÇÃO FIREBASE
// ════════════════════════════════════════════════════════════════════

function syncSaveAnalise(dadosAnalise, fornecedores) {
  if (!db) return;
  db.collection('analise').doc('dados').set({
    dados: dadosAnalise,
    fornecedores: fornecedores,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(console.error);
}

function syncSaveFornecedores(fornecedoresData) {
  if (!db) return;
  db.collection('fornecedores').doc('lista').set({
    data: fornecedoresData,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(console.error);
}

function syncSaveSC(scDataArray) {
  if (!db) return;
  db.collection('sc').doc('lista').set({
    data: scDataArray,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(console.error);
}

function syncSavePedidos(pedidosArray) {
  if (!db) return;
  db.collection('pedidos').doc('lista').set({
    data: pedidosArray,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(console.error);
}

function loadFromFirebase() {
  db.collection('analise').doc('dados').onSnapshot(doc => {
    if (doc.exists && doc.data().dados) {
      dados = doc.data().dados;
      if (typeof renderizarTabela === 'function') renderizarTabela();
      if (typeof atualizarKPIs === 'function') atualizarKPIs();
      toast('🔄 Dados de cotação sincronizados!');
    }
  }, err => console.warn('Erro snapshot análise:', err));
  
  db.collection('fornecedores').doc('lista').onSnapshot(doc => {
    if (doc.exists && doc.data().data) {
      fornecedoresData = doc.data().data;
      if (typeof salvarStorage === 'function') salvarStorage();
      if (document.getElementById('tab-fornecedores')?.style.display !== 'none') {
        if (typeof renderTabelaFornecedores === 'function') renderTabelaFornecedores();
      }
    }
  }, err => console.warn('Erro snapshot fornecedores:', err));
  
  db.collection('sc').doc('lista').onSnapshot(doc => {
    if (doc.exists && doc.data().data) {
      scData = doc.data().data;
      localStorage.setItem('petra_sc', JSON.stringify(scData));
      if (document.getElementById('tab-sc')?.style.display !== 'none') {
        if (typeof renderSC === 'function') renderSC();
      }
    }
  }, err => console.warn('Erro snapshot SC:', err));
  
  db.collection('pedidos').doc('lista').onSnapshot(doc => {
    if (doc.exists && doc.data().data) {
      pedidosData = doc.data().data;
      localStorage.setItem('petra_pedidos', JSON.stringify(pedidosData));
      if (document.getElementById('tab-pedidos')?.style.display !== 'none') {
        if (typeof renderPedidos === 'function') renderPedidos();
      }
    }
  }, err => console.warn('Erro snapshot pedidos:', err));
  
  toast('✅ Firebase conectado — sincronização em tempo real ativa');
}

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES GLOBAIS - VARIÁVEIS
// ════════════════════════════════════════════════════════════════════

let dados = [];
let scData = [];
let pedidosData = [];
let fornecedoresData = null;
let modoView = 'fornecedor';
let filtroVariacao = null;
let _filtroFornAtivo = null;
let _modoComparacao = false;
let _fornSelecionados = new Set();
let _modoLimpoAtivo = false;
let _painelEcoAberto = false;
let _rankingAberto = false;
let _cobrarFiltroAtivo = '';
let _pcFiltroAtivo = 'all';
let _pcFiltroTipo = '';
let _pcSemSC = false;
let _pcFiltroLiberacao = '';
let _pcFiltroEmissao = '';
let _pcFiltroEntrega = '';
let _pcFiltroPonto = false;
let _pcFiltroMinMax = '';
let _pcAlinharForn = false;
let _scFiltroRapido = 'all';
let _scFiltroSol = '';
let _scFiltroDataCampo = '';
let _scFiltroDataVal = '';
let _pcsCobrados = new Set(JSON.parse(localStorage.getItem('petra_cobrados')||'[]'));
let _fornsCobrados = new Set(JSON.parse(localStorage.getItem('petra_forns_cobrados')||'[]'));
let _scsCobradas = new Set(JSON.parse(localStorage.getItem('petra_sc_cobradas')||'[]'));
let _cotsCobradas = new Set(JSON.parse(localStorage.getItem('petra_cots_cobradas')||'[]'));
let _obsMap = JSON.parse(localStorage.getItem('petra_obs_analise')||'{}');
let _sim = {};
let _dadosOrig = [];
let _dadosSnapshot = [];
let _prioridades = [];
let _lembretes = [];

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ════════════════════════════════════════════════════════════════════

function toast(msg, tipo = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = tipo === 'error' ? 'error show' : 'show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 4000);
}

function brl(n) {
  if (n === undefined || n === null || isNaN(n)) return 'R$ 0,00';
  return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function hojesBrasilia() {
  const agora = new Date();
  const d = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateBR(str) {
  if (!str || !str.trim()) return null;
  str = str.trim();
  let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3]);
    if (y < 100) y += 2000;
    const d = new Date(y, parseInt(m[2]) - 1, parseInt(m[1]));
    return isNaN(d) ? null : d;
  }
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    return isNaN(d) ? null : d;
  }
  return null;
}

function isValidDate(dt) {
  if (!dt || isNaN(dt)) return false;
  return dt.getFullYear() >= 2000 && dt.getFullYear() <= 2099;
}

function getSaudacao() {
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const h = agora.getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function esc(v) {
  return (v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function parseNumero(s) {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number') return isNaN(s) ? 0 : s;
  const str = String(s).trim().replace(/[R$\s\u00a0%]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function fmtDataBR(str) {
  if (!str || !str.trim()) return '';
  const d = parseDateBR(str.trim());
  if (!d || isNaN(d)) return str;
  return d.toLocaleDateString('pt-BR');
}

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES DE ANÁLISE DE COTAÇÕES (RENDERIZAÇÃO, CÁLCULOS)
// ════════════════════════════════════════════════════════════════════

function calcScores() {
  dados.forEach(d => { d.semPreco = !(d.vunit > 0.01); });
  const grupoProd = {};
  dados.forEach(d => { if (!grupoProd[d.produto]) grupoProd[d.produto] = []; grupoProd[d.produto].push(d); });
  
  dados.forEach(d => {
    if (d.semPreco) { d.score = 0; d.rec = 'SEM PREÇO'; return; }
    const grupo = grupoProd[d.produto];
    const precos = grupo.filter(g => g.vunit > 0.01).map(g => g.vunit);
    const minP = Math.min(...precos);
    let scorePreco = 100 - ((d.vunit / minP - 1) * 100);
    let bonus = 0;
    const cond = (d.cond || '').toLowerCase();
    if (cond.includes('vista')) bonus += 5;
    else if (cond.includes('ddl')) bonus += 3;
    if ((d.frete || '').toUpperCase().includes('CIF')) bonus += 3;
    d.score = Math.max(0, Math.min(100, scorePreco + bonus - (d.prazo || 0) / 10));
  });
  
  Object.values(grupoProd).forEach(grupo => {
    const validos = grupo.filter(d => !d.semPreco);
    if (!validos.length) { grupo.forEach(d => d.rec = 'SEM PREÇO'); return; }
    const maxS = Math.max(...validos.map(g => g.score));
    const minS = Math.min(...validos.map(g => g.score));
    validos.forEach(d => {
      if (validos.length === 1) d.rec = '✅ MELHOR OPÇÃO';
      else if (d.score === maxS) d.rec = '✅ MELHOR OPÇÃO';
      else if (d.score === minS) d.rec = '❌ MAIS CARO';
      else d.rec = '⚠️ AVALIAR';
    });
  });
}

function atualizarKPIs() {
  const prods = new Set(dados.map(d => d.produto)).size;
  const forns = new Set(dados.map(d => d.fornecedor)).size;
  const best = dados.filter(d => d.rec === '✅ MELHOR OPÇÃO');
  const totalBest = best.reduce((s, d) => s + (d.vunit * (d.quant || 0)), 0);
  
  const grupoProd = {};
  dados.forEach(d => { if (!grupoProd[d.produto]) grupoProd[d.produto] = []; grupoProd[d.produto].push(d); });
  let totalMaisCaro = 0;
  Object.values(grupoProd).forEach(g => {
    const validos = g.filter(x => !x.semPreco);
    const melhor = g.find(x => x.rec === '✅ MELHOR OPÇÃO');
    if (!validos.length || !melhor) return;
    totalMaisCaro += Math.max(...validos.map(x => x.vunit)) * (melhor.quant || 1);
  });
  const economia = totalMaisCaro - totalBest;
  const economiaPct = totalMaisCaro > 0 ? (economia / totalMaisCaro * 100).toFixed(1) : '0.0';
  
  const bestComHist = best.filter(d => d.upreco > 0.01);
  let varMedia = null;
  if (bestComHist.length > 0) {
    const soma = bestComHist.reduce((s, d) => s + ((d.vunit - d.upreco) / d.upreco * 100), 0);
    varMedia = (soma / bestComHist.length).toFixed(1);
  }
  
  const grupoForn = {};
  dados.forEach(d => {
    const k = (d.fornecedor || '?') + '||' + (d.loja || '');
    if (!grupoForn[k]) grupoForn[k] = { total: 0, com: 0 };
    grupoForn[k].total++;
    if (!d.semPreco) grupoForn[k].com++;
  });
  const respMedias = Object.values(grupoForn).map(g => g.com / g.total * 100);
  const respMedia = respMedias.length ? Math.round(respMedias.reduce((s, v) => s + v, 0) / respMedias.length) : 0;
  
  document.getElementById('kpi-economia').textContent = brl(economia);
  document.getElementById('kpi-economia-pct').textContent = `${economiaPct}% de economia gerada`;
  if (varMedia !== null) {
    document.getElementById('kpi-var-media').textContent = (parseFloat(varMedia) >= 0 ? '+' : '') + varMedia + '%';
    document.getElementById('kpi-var-media-sub').textContent = `${bestComHist.length} item(s) com histórico`;
  }
  document.getElementById('kpi-semproduto').textContent = Object.values(grupoProd).filter(g => g.every(d => d.semPreco)).length;
  document.getElementById('kpi-prods').textContent = prods;
  document.getElementById('kpi-forn').textContent = forns;
  document.getElementById('kpi-linhas-total').textContent = dados.length;
  document.getElementById('kpi-resp-media').textContent = respMedia + '%';
  document.getElementById('kpi-resp-media-sub').textContent = `${forns} fornecedor(es) participaram`;
  document.getElementById('kpi-row').style.display = 'block';
  renderFornAnalise();
}

function renderFornAnalise() {
  const painel = document.getElementById('forn-analise-painel');
  const grid = document.getElementById('forn-analise-grid');
  if (!painel || !grid || !dados.length) { if(painel) painel.style.display = 'none'; return; }
  
  painel.style.display = 'block';
  const grupos = {};
  const ordem = [];
  dados.forEach(d => {
    const chave = (d.fornecedor || '?') + '||' + (d.loja || '');
    if (!grupos[chave]) { grupos[chave] = []; ordem.push(chave); }
    grupos[chave].push(d);
  });
  
  grid.innerHTML = ordem.map((chave, idx) => {
    const itens = grupos[chave];
    const codForn = chave.split('||')[0];
    const loja = chave.split('||')[1];
    const nome = itens[0].nome || itens[0].fornecedor || codForn;
    const respondidos = itens.filter(d => d.vunit > 0.01);
    const semPreco = itens.filter(d => !d.vunit || d.vunit <= 0.01);
    const melhores = itens.filter(d => d.rec === '✅ MELHOR OPÇÃO');
    const medios = itens.filter(d => d.rec === '⚠️ AVALIAR');
    const caros = itens.filter(d => d.rec === '❌ MAIS CARO');
    const totalCot = respondidos.reduce((s, d) => s + d.vunit * (d.quant || 0), 0);
    const totalMelh = melhores.reduce((s, d) => s + d.vunit * (d.quant || 0), 0);
    const pctResp = itens.length ? Math.round(respondidos.length / itens.length * 100) : 0;
    
    return `<div class="fca" data-chave="${chave.replace(/"/g, '&quot;')}" data-nome="${nome.replace(/"/g, '&quot;')}" onclick="filtrarFornecedor(this.dataset.chave,this.dataset.nome,this)">
      <div class="fca-head"><div class="fca-nome-full">${nome}</div><div class="fca-cod-loja">${codForn}${loja ? ' · Lj ' + loja : ''}</div></div>
      <div class="fca-pills"><span class="fca-pill fca-pill-best">✅ ${melhores.length} melhor(es)</span>${medios.length ? `<span class="fca-pill fca-pill-med">⚠️ ${medios.length}</span>` : ''}${caros.length ? `<span class="fca-pill fca-pill-bad">❌ ${caros.length}</span>` : ''}</div>
      <div class="fca-resp-row"><span class="fca-resp-txt">Resp: ${respondidos.length}/${itens.length} (${pctResp}%)</span></div>
      <div class="fca-row"><span class="fca-row-label">Total cotado</span><span class="fca-row-val">${brl(totalCot)}</span></div>
      <div class="fca-row"><span class="fca-row-label green">✅ Melhores</span><span class="fca-row-val green">${brl(totalMelh)}</span></div>
    </div>`;
  }).join('');
}

function renderizarTabela() {
  if (!dados.length) {
    document.getElementById('table-container').innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">Nenhum dado importado ainda</div><div class="empty-sub">Clique em "Colar Dados do TOTVS" para começar</div></div>';
    return;
  }
  calcScores();
  const grupoForn = {};
  const ordemForn = [];
  dados.forEach(d => {
    const chave = (d.fornecedor || '?') + '||' + (d.loja || '');
    if (!grupoForn[chave]) { grupoForn[chave] = []; ordemForn.push(chave); }
    grupoForn[chave].push(d);
  });
  
  let html = '<div class="table-outer"><table><thead><tr class="group-row"><th colspan="3">IDENTIFICAÇÃO DO PRODUTO</th><th colspan="2">ESTOQUE</th><th colspan="2">HISTÓRICO COMPRAS</th><th colspan="2">HISTÓRICO PREÇOS</th><th colspan="1">VAR. COTADO</th><th colspan="3">CONDIÇÕES COMERCIAIS</th><th colspan="2">VALOR COTADO</th><th colspan="2">ANÁLISE</th><th colspan="1">OBS</th></tr><tr class="col-row"><th class="sticky-cod">Código</th><th class="sticky-desc">Descrição</th><th>UM</th><th>Qtd</th><th>Saldo Est.</th><th>Penúlt. Compra</th><th>Última Compra</th><th>Penúlt. Preço</th><th>Últ. Preço</th><th>Var. vs Últ.</th><th>Prazo</th><th>Cond. Pgto</th><th>Frete</th><th>Vl. Unitário</th><th>Total</th><th>Score</th><th>Situação</th><th>Obs.</th></tr></thead><tbody>';
  
  ordemForn.forEach((chave, fi) => {
    const linhas = grupoForn[chave];
    const d0 = linhas[0];
    html += `<tr class="forn-header"><td colspan="18"><div class="forn-inner"><span class="forn-num">${fi+1}</span><span class="forn-nome">${d0.nome || d0.fornecedor || '—'}</span><span class="forn-loja">Cód ${d0.fornecedor || '—'} · Loja ${d0.loja || '—'}</span><div class="forn-sep"></div><span class="forn-chip chip-neutral">${linhas.length} itens</span></div></td></tr>`;
    linhas.forEach((d, ri) => {
      const varUlt = (d.vunit > 0.01 && d.upreco > 0.01) ? ((d.vunit - d.upreco) / d.upreco) : null;
      const varHtml = varUlt === null ? '<span class="var-eq">—</span>' : `<span class="${varUlt > 0.001 ? 'var-up' : varUlt < -0.001 ? 'var-dn' : 'var-eq'}">${varUlt >= 0 ? '▲ +' : '▼ '}${Math.abs(varUlt * 100).toFixed(1)}%</span>`;
      const scoreColor = d.score >= 80 ? '#3FB950' : d.score >= 50 ? '#E3B341' : '#F85149';
      let recHtml = d.semPreco ? '<span class="pill pill-na">⚫ SEM PREÇO</span>' : d.rec === '✅ MELHOR OPÇÃO' ? '<span class="pill pill-best">✅ MELHOR OPÇÃO</span>' : d.rec === '❌ MAIS CARO' ? '<span class="pill pill-worst">❌ MAIS CARO</span>' : '<span class="pill pill-mid">⚠️ AVALIAR</span>';
      
      html += `<tr><td class="mono sticky-cod">${d.produto}</td><td class="left sticky-desc">${d.descricao}</td><td class="mono">${d.um}</td><td class="mono">${d.quant || '—'}</td><td class="mono">${d.saldo || '—'}</td><td class="mono">${d.pcomp || '—'}</td><td class="mono">${d.ucomp || '—'}</td><td class="mono">${d.ppreco > 0.01 ? brl(d.ppreco) : '—'}</td><td class="mono">${d.upreco > 0.01 ? brl(d.upreco) : '—'}</td><td>${varHtml}</td><td class="mono">${d.prazo > 0 ? d.prazo + 'd' : '—'}</td><td>${d.cond || '—'}</td><td>${d.frete || '—'}</td><td>${d.semPreco ? '—' : brl(d.vunit)}</td><td class="mono">${!d.semPreco && d.quant > 0 ? brl(d.vunit * d.quant) : '—'}</td><td>${d.semPreco ? '—' : `<div class="score-wrap"><div class="score-bar-bg"><div class="score-bar-fill" style="width:${d.score}%;background:${scoreColor}"></div></div><div class="score-val">${d.score.toFixed(1)}</div></div>`}</td><td>${recHtml}</td><td><input class="obs-input-inline" type="text" placeholder="Observação..." onchange="salvarObs(this)" data-obs-key="${d.produto}||${d.fornecedor}||${d.loja}"></td></tr>`;
    });
  });
  
  html += '</tbody></table></div>';
  document.getElementById('table-container').innerHTML = html;
  document.getElementById('badge-best').textContent = dados.filter(d => d.rec === '✅ MELHOR OPÇÃO').length + ' Melhores';
  document.getElementById('badge-medio').textContent = dados.filter(d => d.rec === '⚠️ AVALIAR').length + ' Avaliar';
  document.getElementById('badge-ruim').textContent = dados.filter(d => d.rec === '❌ MAIS CARO').length + ' Ruins';
  document.getElementById('btn-clear').style.display = '';
  document.getElementById('btn-export').style.display = '';
  document.getElementById('btn-select-best').style.display = '';
  document.getElementById('btn-modo-comp').style.display = '';
  document.getElementById('btn-export-melhores').style.display = '';
  document.getElementById('btn-modo-limpo').style.display = '';
  document.getElementById('btn-eco-rank').style.display = '';
  document.getElementById('analise-busca-bar').style.display = '';
  document.getElementById('btn-toggle-view').style.display = '';
  document.getElementById('btn-filter-neg').style.display = '';
  document.getElementById('btn-filter-pos').style.display = '';
  document.getElementById('kpi-row').style.display = 'block';
}

function limpar() {
  dados = [];
  scData = [];
  pedidosData = [];
  modoView = 'fornecedor';
  filtroVariacao = null;
  _filtroFornAtivo = null;
  document.getElementById('table-container').innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">Nenhum dado importado ainda</div><div class="empty-sub">Clique em "Colar Dados do TOTVS" para começar</div></div>';
  document.getElementById('btn-clear').style.display = 'none';
  document.getElementById('btn-export').style.display = 'none';
  document.getElementById('btn-toggle-view').style.display = 'none';
  document.getElementById('btn-filter-neg').style.display = 'none';
  document.getElementById('btn-filter-pos').style.display = 'none';
  document.getElementById('badge-best').style.display = 'none';
  document.getElementById('badge-medio').style.display = 'none';
  document.getElementById('badge-ruim').style.display = 'none';
  document.getElementById('btn-select-best').style.display = 'none';
  document.getElementById('btn-modo-comp').style.display = 'none';
  document.getElementById('btn-export-melhores').style.display = 'none';
  document.getElementById('btn-modo-limpo').style.display = 'none';
  document.getElementById('btn-eco-rank').style.display = 'none';
  document.getElementById('analise-busca-bar').style.display = 'none';
  document.getElementById('kpi-row').style.display = 'none';
  document.getElementById('forn-analise-painel').style.display = 'none';
  localStorage.removeItem('petra_sc');
  localStorage.removeItem('petra_pedidos');
  toast('✅ Todos os dados foram limpos!');
}

function toggleView() {
  modoView = modoView === 'fornecedor' ? 'produto' : 'fornecedor';
  document.getElementById('btn-toggle-view').textContent = modoView === 'fornecedor' ? '🔄 Ver por Produto' : '🔄 Ver por Fornecedor';
  renderizarTabela();
}

function toggleFiltroVariacao(tipo) {
  filtroVariacao = filtroVariacao === tipo ? null : tipo;
  renderizarTabela();
}

function toggleModoLimpo() {
  _modoLimpoAtivo = !_modoLimpoAtivo;
  document.getElementById('btn-modo-limpo').classList.toggle('ativo', _modoLimpoAtivo);
  renderizarTabela();
}

function toggleEconomiaTotal() {
  _painelEcoAberto = !_painelEcoAberto;
  document.getElementById('painel-economia-total').style.display = _painelEcoAberto ? 'block' : 'none';
}

function ativarModoComparacao() {
  _modoComparacao = true;
  _fornSelecionados.clear();
  document.getElementById('modo-comparacao-bar').classList.add('ativo');
  document.getElementById('comp-selecionados').textContent = '0 selecionados';
  toast('🔀 Clique em 2 cabeçalhos de fornecedor para comparar');
}

function sairModoComparacao() {
  _modoComparacao = false;
  _fornSelecionados.clear();
  document.getElementById('modo-comparacao-bar').classList.remove('ativo');
  document.querySelectorAll('tr.compare-selected').forEach(tr => tr.classList.remove('compare-selected'));
  document.querySelectorAll('tr.compare-faded').forEach(tr => tr.classList.remove('compare-faded'));
}

function executarComparacao() {
  if (_fornSelecionados.size < 2) { toast('⚠️ Selecione 2 fornecedores', 'error'); return; }
  const sels = [..._fornSelecionados];
  document.querySelectorAll('#table-container tbody tr').forEach(tr => {
    const forn = tr.dataset.forn || tr.dataset.fornHeader;
    const isSelected = sels.includes(tr.dataset.forn) || sels.includes(tr.dataset.fornHeader) || tr.classList.contains('compare-selected');
    if (!isSelected && !tr.querySelector('tfoot')) tr.classList.add('compare-faded');
    else tr.classList.remove('compare-faded');
  });
  toast('🔀 Comparando: ' + sels.map(c => c.split('||')[0]).join(' vs '));
}

function _toggleCompare(chave) {
  if (!_modoComparacao) return;
  if (_fornSelecionados.has(chave)) {
    _fornSelecionados.delete(chave);
    document.querySelector(`tr[data-forn-header="${chave}"]`)?.classList.remove('compare-selected');
  } else {
    if (_fornSelecionados.size >= 2) { toast('⚠️ Selecione apenas 2 fornecedores', 'error'); return; }
    _fornSelecionados.add(chave);
    document.querySelector(`tr[data-forn-header="${chave}"]`)?.classList.add('compare-selected');
  }
  document.getElementById('comp-selecionados').textContent = _fornSelecionados.size + ' selecionado(s)';
  if (_fornSelecionados.size === 2) executarComparacao();
}

function selecionarMelhorEmMassa() {
  const melhorPorProd = {};
  dados.forEach(d => { if (!d.semPreco && d.vunit > 0 && (!melhorPorProd[d.produto] || d.vunit < melhorPorProd[d.produto].vunit)) melhorPorProd[d.produto] = d; });
  let marcados = 0;
  dados.forEach(d => {
    const melhor = melhorPorProd[d.produto];
    if (melhor && d === melhor) { d.rec = '✅ MELHOR OPÇÃO'; marcados++; }
    else if (!d.semPreco) { d.rec = d.vunit <= (melhor?.vunit || 0) * 1.05 ? '⚠️ AVALIAR' : '❌ MAIS CARO'; }
  });
  renderizarTabela();
  toast(`⚡ ${marcados} melhores selecionados automaticamente!`);
}

function exportarSomenteMelhores() {
  const melhores = dados.filter(d => d.rec === '✅ MELHOR OPÇÃO');
  if (!melhores.length) { toast('⚠️ Nenhuma "Melhor Opção" marcada ainda.', 'error'); return; }
  const headers = ['Produto', 'Descrição', 'UM', 'Qtd', 'Fornecedor', 'Nome', 'Vl.Unit.', 'Total', 'Frete', 'Cond.Pgto', 'Score'];
  const rows = melhores.map(d => [d.produto, d.descricao, d.um, d.quant, d.fornecedor, d.nome, d.vunit, d.vunit * d.quant, d.frete, d.cond, d.score]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Melhores Opções');
  XLSX.writeFile(wb, 'melhores_opcoes_petra.xlsx');
  toast('⬇ Exportados ' + melhores.length + ' itens!');
}

function exportarExcel() {
  if (!dados.length) { toast('Nenhum dado para exportar', 'error'); return; }
  const cab = ['Produto', 'Descrição', 'UM', 'Quantidade', 'Saldo Estoque', 'Penúlt.Compra', 'Última Compra', 'Penúlt.Preço', 'Últ.Preço', 'Fornecedor', 'Loja', 'Nome', 'Vl.Unit.', 'Prazo', 'Cond.Pgto', 'Tp.Frete', 'Var.% vs Últ.Preço', 'Score', 'Recomendação'];
  const linhas = dados.map(d => [d.produto, d.descricao, d.um, d.quant, d.saldo, d.pcomp, d.ucomp, d.ppreco || '', d.upreco || '', d.fornecedor, d.loja, d.nome, d.vunit || '', d.prazo || '', d.cond, d.frete, (d.vunit > 0.01 && d.upreco > 0.01) ? ((d.vunit - d.upreco) / d.upreco * 100).toFixed(2) + '%' : '', (d.score || 0).toFixed(1), d.rec]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
  XLSX.utils.book_append_sheet(wb, ws, 'Dados Brutos');
  XLSX.writeFile(wb, `Cotacao_Analisada_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast('✅ Excel exportado!');
}

function filtrarAnaliseProduto() {
  const q = (document.getElementById('analise-busca-prod')?.value || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#table-container tbody tr:not(.forn-header)');
  let vis = 0;
  rows.forEach(tr => {
    const show = !q || tr.textContent.toLowerCase().includes(q);
    tr.style.display = show ? '' : 'none';
    if (show) vis++;
  });
  document.querySelectorAll('#table-container tr.forn-header').forEach(hdr => {
    let el = hdr.nextElementSibling;
    let hasVis = false;
    while (el && !el.classList.contains('forn-header')) {
      if (el.style.display !== 'none') hasVis = true;
      el = el.nextElementSibling;
    }
    hdr.style.display = hasVis ? '' : 'none';
  });
  document.getElementById('analise-busca-count').textContent = q ? vis + ' linha(s) encontrada(s)' : '';
}

function salvarObs(input) {
  const key = input.dataset.obsKey;
  if (!key) return;
  if (input.value.trim()) _obsMap[key] = input.value.trim();
  else delete _obsMap[key];
  localStorage.setItem('petra_obs_analise', JSON.stringify(_obsMap));
}

function toggleRankingCards() {
  _rankingAberto = !_rankingAberto;
  const body = document.getElementById('ranking-cards-body');
  const icon = document.getElementById('ranking-toggle-icon');
  if (body) body.style.display = _rankingAberto ? 'block' : 'none';
  if (icon) icon.textContent = _rankingAberto ? '▲ ocultar' : '▼ mostrar';
}

function limparFiltroForn() {
  _filtroFornAtivo = null;
  document.querySelectorAll('.fca').forEach(c => c.classList.remove('fca-ativo'));
  document.getElementById('forn-filtro-banner')?.classList.remove('ativo');
  renderizarTabela();
}

function filtrarFornecedor(chave, nome, cardEl) {
  if (_filtroFornAtivo === chave) { limparFiltroForn(); return; }
  _filtroFornAtivo = chave;
  document.querySelectorAll('.fca').forEach(c => c.classList.remove('fca-ativo'));
  cardEl.classList.add('fca-ativo');
  const banner = document.getElementById('forn-filtro-banner');
  const txt = document.getElementById('forn-filtro-txt');
  if (banner && txt) { txt.textContent = `Exibindo apenas itens do fornecedor: ${nome}`; banner.classList.add('ativo'); }
  renderizarTabela();
  setTimeout(() => document.getElementById('table-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function exportarJustificativaExcel() {
  if (!dados.length) { toast('Nenhum dado para exportar', 'error'); return; }
  toast('Função em desenvolvimento');
}

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES DE IMPORTAÇÃO DE EXCEL/TEXTO
// ════════════════════════════════════════════════════════════════════

function abrirModal() {
  document.getElementById('modal').style.display = 'flex';
  const ta = document.getElementById('paste-input');
  ta.value = '';
  document.getElementById('parse-feedback').style.display = 'none';
  setTimeout(() => ta.focus(), 100);
}

function fecharModal() {
  document.getElementById('modal').style.display = 'none';
}

function processarTexto() {
  const txt = document.getElementById('paste-input').value.trim();
  if (!txt) { toast('Cole os dados antes de processar', 'error'); return; }
  
  const linhas = txt.split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) return;
  
  const colIndex = { produto: 0, descricao: 1, um: 2, quant: 3, saldo: 4, pcomp: 5, ucomp: 6, ppreco: 7, upreco: 8, fornecedor: 9, loja: 10, nome: 11, vunit: 12, prazo: 13, cond: 14, frete: 15 };
  
  const result = [];
  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split('\t');
    if (cols.length < 3) continue;
    const obj = {
      produto: cols[colIndex.produto]?.trim() || '',
      descricao: cols[colIndex.descricao]?.trim() || '',
      um: cols[colIndex.um]?.trim() || 'UN',
      quant: parseNumero(cols[colIndex.quant]),
      saldo: parseNumero(cols[colIndex.saldo]),
      pcomp: cols[colIndex.pcomp]?.trim() || '',
      ucomp: cols[colIndex.ucomp]?.trim() || '',
      ppreco: parseNumero(cols[colIndex.ppreco]),
      upreco: parseNumero(cols[colIndex.upreco]),
      fornecedor: cols[colIndex.fornecedor]?.trim() || '',
      loja: cols[colIndex.loja]?.trim() || '',
      nome: cols[colIndex.nome]?.trim() || '',
      vunit: parseNumero(cols[colIndex.vunit]),
      prazo: parseNumero(cols[colIndex.prazo]),
      cond: cols[colIndex.cond]?.trim() || '',
      frete: cols[colIndex.frete]?.trim() || ''
    };
    if (obj.produto) result.push(obj);
  }
  
  if (!result.length) { toast('❌ Dados não reconhecidos. Verifique o formato.', 'error'); return; }
  
  dados = result;
  _dadosOrig = JSON.parse(JSON.stringify(dados));
  fecharModal();
  renderizarTabela();
  atualizarKPIs();
  toast(`✅ ${result.length} linhas importadas com sucesso!`);
  syncSaveAnalise(dados, fornecedoresData);
}

function handleDropExcel(e) {
  e.preventDefault();
  document.getElementById('drop-zone')?.classList.remove('drop-active');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const tsv = XLSX.utils.sheet_to_csv(ws, { FS: '\t', RS: '\n' });
      document.getElementById('paste-input').value = tsv;
      processarTexto();
    } catch (err) {
      toast('❌ Erro ao ler o arquivo. Tente usar "Colar do TOTVS".', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function handleFileInputAnalise(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const tsv = XLSX.utils.sheet_to_csv(ws, { FS: '\t', RS: '\n' });
      document.getElementById('paste-input').value = tsv;
      processarTexto();
    } catch (err) {
      toast('❌ Erro ao ler o arquivo.', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES DE FORNECEDORES
// ════════════════════════════════════════════════════════════════════

const _FK = ["Codigo", "CNPJ", "Razao", "Fantasia", "Estado", "Municipio", "Contato", "DDD", "Telefone", "EmailMG", "EmailRJ", "FreteRJ", "FreteMG", "FatMin"];
const BASE_FORNECEDORES = [];

function getFornecedores() {
  if (!fornecedoresData) {
    const saved = localStorage.getItem('petra_fornecedores');
    if (saved) fornecedoresData = JSON.parse(saved);
    else fornecedoresData = BASE_FORNECEDORES.map((f, i) => ({ ...f, _idx: i, _novo: false, _atualizado: false }));
  }
  return fornecedoresData;
}

function salvarStorage() {
  localStorage.setItem('petra_fornecedores', JSON.stringify(fornecedoresData));
  syncSaveFornecedores(fornecedoresData);
}

function renderTabelaFornecedores() {
  const tb = document.getElementById('forn-tbody');
  if (!tb) return;
  const lista = getFornecedores();
  tb.innerHTML = lista.map(f => `
    <tr>
      <td class="mono">${f.Codigo || ''}</td>
      <td class="mono">${f.CNPJ || ''}</td>
      <td class="left">${f.Razao || ''}</td>
      <td class="left">${f.Fantasia || ''}</td>
      <td>${f.Estado || ''}</td>
      <td class="left">${f.Municipio || ''}</td>
      <td class="left">${f.Contato || ''}</td>
      <td>${f.DDD ? '(' + f.DDD + ') ' + f.Telefone : f.Telefone || ''}</td>
      <td class="left">${f.EmailMG || ''}</td>
      <td class="left">${f.EmailRJ || ''}</td>
      <td>${f.FreteRJ || '—'}</td>
      <td>${f.FreteMG || '—'}</td>
      <td>${f.FatMin || '—'}</td>
      <td>${f._novo ? '<span class="tag-novo">NOVO</span>' : f._atualizado ? '<span class="tag-atualizado">ATUALIZADO</span>' : '—'}</td>
      <td><button class="btn-edit-forn" onclick="editarFornecedor(${f._idx})">✏️ Editar</button></td>
    </tr>
  `).join('');
  document.getElementById('forn-count').textContent = lista.length + ' fornecedores';
}

function abrirModalNovoFornecedor() {
  document.getElementById('modal-forn-title').textContent = '➕ Novo Fornecedor';
  document.getElementById('forn-edit-idx').value = '';
  ['fi-codigo', 'fi-cnpj', 'fi-razao', 'fi-fantasia', 'fi-estado', 'fi-municipio', 'fi-contato', 'fi-ddd', 'fi-telefone', 'fi-emailmg', 'fi-emailrj', 'fi-frete-rj', 'fi-frete-mg', 'fi-fatmin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('modal-forn').style.display = 'flex';
}

function fecharModalForn() {
  document.getElementById('modal-forn').style.display = 'none';
}

function salvarFornecedor() {
  const lista = getFornecedores();
  const novo = {
    Codigo: document.getElementById('fi-codigo').value.trim(),
    CNPJ: document.getElementById('fi-cnpj').value.trim(),
    Razao: document.getElementById('fi-razao').value.trim(),
    Fantasia: document.getElementById('fi-fantasia').value.trim(),
    Estado: document.getElementById('fi-estado').value.trim().toUpperCase(),
    Municipio: document.getElementById('fi-municipio').value.trim(),
    Contato: document.getElementById('fi-contato').value.trim(),
    DDD: document.getElementById('fi-ddd').value.trim(),
    Telefone: document.getElementById('fi-telefone').value.trim(),
    EmailMG: document.getElementById('fi-emailmg').value.trim(),
    EmailRJ: document.getElementById('fi-emailrj').value.trim(),
    FreteRJ: document.getElementById('fi-frete-rj').value.trim(),
    FreteMG: document.getElementById('fi-frete-mg').value.trim(),
    FatMin: document.getElementById('fi-fatmin').value.trim(),
    _idx: lista.length,
    _novo: true,
    _atualizado: false
  };
  lista.push(novo);
  salvarStorage();
  fecharModalForn();
  renderTabelaFornecedores();
  toast('✅ Fornecedor adicionado!');
}

function editarFornecedor(idx) {
  toast('Função de edição em desenvolvimento');
}

function exportarFornecedoresCSV() {
  const lista = getFornecedores();
  const cabecalho = ['Codigo', 'CNPJ/CPF', 'Razao Social', 'N Fantasia', 'Estado', 'Municipio', 'Contato', 'DDD', 'Telefone', 'E-Mail MG', 'E-mail RJ', 'Modal Frete RJ', 'Modal Frete MG', 'Faturamento Minimo'];
  const linhas = [cabecalho.join(';')];
  lista.forEach(f => {
    linhas.push([f.Codigo, f.CNPJ, f.Razao, f.Fantasia, f.Estado, f.Municipio, f.Contato, f.DDD, f.Telefone, f.EmailMG, f.EmailRJ, f.FreteRJ, f.FreteMG, f.FatMin].map(v => '"' + (v || '').replace(/"/g, '""') + '"').join(';'));
  });
  const blob = new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Fornecedores_PETRA_' + new Date().toLocaleDateString('pt-BR').replace(/\//g, '-') + '.csv';
  a.click();
}

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES DE SC (SOLICITAÇÕES DE COMPRA)
// ════════════════════════════════════════════════════════════════════

function abrirModalSC() {
  document.getElementById('sc-paste-input').value = '';
  document.getElementById('sc-parse-feedback').style.display = 'none';
  document.getElementById('modal-sc').style.display = 'flex';
  setTimeout(() => document.getElementById('sc-paste-input')?.focus(), 100);
}

function fecharModalSC() {
  document.getElementById('modal-sc').style.display = 'none';
}

function processarSC() {
  const raw = document.getElementById('sc-paste-input').value.trim();
  const fb = document.getElementById('sc-parse-feedback');
  if (!raw) { fb.style.display = 'block'; fb.innerHTML = '⚠️ Nenhum dado colado.'; return; }
  
  const linhas = raw.split(/\r?\n/).map(l => l.split('\t'));
  if (linhas.length < 2) { fb.style.display = 'block'; fb.innerHTML = '⚠️ Dados inválidos — cole diretamente do Excel.'; return; }
  
  scData = linhas.slice(1).filter(r => r.join('').trim()).map(row => ({
    tipocompra: row[0] || '',
    numsc: row[1] || '',
    numcot: row[2] || '',
    item: row[3] || '',
    produto: row[4] || '',
    descricao: row[5] || '',
    qtd: parseNumero(row[6]),
    um: row[7] || '',
    obs: row[8] || '',
    saldo: parseNumero(row[9]),
    desccc: row[10] || '',
    cc: row[11] || '',
    classevalor: row[12] || '',
    solicitante: row[13] || '',
    emissao: row[14] || '',
    necessidade: row[15] || '',
    numos: row[16] || '',
    motivo: row[17] || '',
    grpproduto: row[18] || ''
  }));
  
  if (!scData.length) { fb.style.display = 'block'; fb.innerHTML = '⚠️ Nenhuma linha de dados encontrada.'; return; }
  
  localStorage.setItem('petra_sc', JSON.stringify(scData));
  fecharModalSC();
  renderSC();
  toast(`✅ ${scData.length} SCs importadas!`);
  syncSaveSC(scData);
}

function renderSC() {
  const saved = localStorage.getItem('petra_sc');
  if (saved && !scData.length) scData = JSON.parse(saved);
  
  const empty = document.getElementById('sc-empty');
  const kpis = document.getElementById('sc-kpis');
  const filtros = document.getElementById('sc-filtros');
  const tblOuter = document.getElementById('sc-table-outer');
  
  if (!scData.length) {
    if (empty) empty.style.display = 'block';
    if (kpis) kpis.style.display = 'none';
    if (filtros) filtros.style.display = 'none';
    if (tblOuter) tblOuter.style.display = 'none';
    return;
  }
  
  if (empty) empty.style.display = 'none';
  if (kpis) kpis.style.display = 'grid';
  if (filtros) filtros.style.display = 'flex';
  if (tblOuter) tblOuter.style.display = 'block';
  
  document.getElementById('sc-kpi-total').textContent = scData.length;
  document.getElementById('sc-kpi-prods').textContent = new Set(scData.map(s => s.produto).filter(Boolean)).size;
  document.getElementById('sc-kpi-estoque').textContent = scData.filter(s => (s.cc || '').trim() === '2003').length;
  
  const tb = document.getElementById('sc-tbody');
  tb.innerHTML = scData.map(s => `
    <tr>
      <td>${s.tipocompra || '—'}</td>
      <td class="mono">${s.numsc || '—'}</td>
      <td class="mono">${s.numcot || '—'}</td>
      <td class="mono">${s.item || '—'}</td>
      <td class="mono">${s.produto || '—'}</td>
      <td class="left">${s.descricao || '—'}</td>
      <td class="mono">${s.qtd || '—'}</td>
      <td>${s.um || '—'}</td>
      <td class="mono">${s.saldo || '—'}</td>
      <td>${s.cc || '—'}</td>
      <td class="left">${s.desccc || '—'}</td>
      <td>${s.classevalor || '—'}</td>
      <td class="left">${s.solicitante || '—'}</td>
      <td>${s.emissao || '—'}</td>
      <td>${s.necessidade || '—'}</td>
      <td>${s.grpproduto || '—'}</td>
      <td class="left">${s.obs || s.motivo || '—'}</td>
    </tr>
  `).join('');
  document.getElementById('sc-count').textContent = scData.length + ' itens';
  document.getElementById('btn-limpar-sc').style.display = 'flex';
  document.getElementById('btn-export-sc').style.display = 'flex';
}

function limparSC() {
  if (!confirm('Limpar todas as SCs importadas?')) return;
  scData = [];
  localStorage.removeItem('petra_sc');
  renderSC();
  toast('✅ SCs limpas!');
}

function exportarSCExcel() {
  if (!scData.length) { toast('Nenhum dado para exportar', 'error'); return; }
  const cab = ['Tipo Compra', 'Núm.SC', 'Cotação', 'Item', 'Produto', 'Descrição', 'Qtd', 'UM', 'Saldo Atual', 'CC', 'Desc.CC', 'Cls.Valor', 'Solicitante', 'Emissão', 'Necessidade', 'Núm.OS', 'Grp.Produto', 'Motivo', 'Observação'];
  const linhas = scData.map(s => [s.tipocompra, s.numsc, s.numcot, s.item, s.produto, s.descricao, s.qtd, s.um, s.saldo, s.cc, s.desccc, s.classevalor, s.solicitante, s.emissao, s.necessidade, s.numos, s.grpproduto, s.motivo, s.obs]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
  XLSX.utils.book_append_sheet(wb, ws, 'SC em Abertos');
  XLSX.writeFile(wb, `SC_Abertos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast('✅ SC exportada!');
}

function handleDropExcelSC(e) {
  e.preventDefault();
  document.getElementById('sc-drop-zone')?.classList.remove('drop-active');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const tsv = XLSX.utils.sheet_to_csv(ws, { FS: '\t', RS: '\n' });
      document.getElementById('sc-paste-input').value = tsv;
      processarSC();
    } catch (err) { toast('❌ Erro ao ler o arquivo.', 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function handleFileInputSC(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const tsv = XLSX.utils.sheet_to_csv(ws, { FS: '\t', RS: '\n' });
      document.getElementById('sc-paste-input').value = tsv;
      processarSC();
    } catch (err) { toast('❌ Erro ao ler o arquivo.', 'error'); }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}

function filtrarSCRapido(modo) { _scFiltroRapido = modo; renderSC(); }
function setSCFiltroSol(sol) { _scFiltroSol = sol; renderSC(); }
function toggleSCMenu(tipo) { }
function filtrarSCData(campo, val) { _scFiltroDataCampo = campo; _scFiltroDataVal = val; renderSC(); }
function filtrarSC() { renderSC(); }

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES DE PEDIDOS DE COMPRA
// ════════════════════════════════════════════════════════════════════

function abrirModalPC() {
  document.getElementById('pc-paste-input').value = '';
  document.getElementById('pc-parse-feedback').style.display = 'none';
  document.getElementById('modal-pc').style.display = 'flex';
  setTimeout(() => document.getElementById('pc-paste-input')?.focus(), 100);
}

function fecharModalPC() {
  document.getElementById('modal-pc').style.display = 'none';
}

function processarPedidos() {
  const raw = document.getElementById('pc-paste-input').value.trim();
  const fb = document.getElementById('pc-parse-feedback');
  if (!raw) { fb.style.display = 'block'; fb.innerHTML = '⚠️ Nenhum dado colado.'; return; }
  
  const linhas = raw.split(/\r?\n/).map(l => l.split('\t'));
  if (linhas.length < 2) { fb.style.display = 'block'; fb.innerHTML = '⚠️ Dados inválidos.'; return; }
  
  pedidosData = linhas.slice(1).filter(r => r.join('').trim()).map(row => ({
    numpc: row[0] || '',
    fornecedor: row[1] || '',
    loja: row[2] || '',
    razao: row[3] || '',
    telefone: row[4] || '',
    item: row[5] || '',
    sc: row[6] || '',
    produto: row[7] || '',
    descricao: row[8] || '',
    grupo: row[9] || '',
    emissao: row[10] || '',
    entrega: row[12] || '',
    qtd: parseNumero(row[13]),
    um: row[14] || '',
    prcunit: parseNumero(row[15]),
    total: parseNumero(row[18]),
    qtdreceber: parseNumero(row[20]),
    ctrlap: row[23] || '',
    tipocompra: row[24] || '',
    minmax: row[26] || '',
    obs: row[27] || '',
    dtlib: row[31] || ''
  }));
  
  if (!pedidosData.length) { fb.style.display = 'block'; fb.innerHTML = '⚠️ Nenhuma linha de dados encontrada.'; return; }
  
  localStorage.setItem('petra_pedidos', JSON.stringify(pedidosData));
  fecharModalPC();
  renderPedidos();
  toast(`✅ ${pedidosData.length} itens importados!`);
  syncSavePedidos(pedidosData);
}

function renderPedidos() {
  const saved = localStorage.getItem('petra_pedidos');
  if (saved && !pedidosData.length) pedidosData = JSON.parse(saved);
  
  const empty = document.getElementById('pc-empty');
  const kpis = document.getElementById('pc-kpis');
  const filtros = document.getElementById('pc-filtros');
  const tblOuter = document.getElementById('pc-table-outer');
  
  if (!pedidosData.length) {
    if (empty) empty.style.display = 'block';
    if (kpis) kpis.style.display = 'none';
    if (filtros) filtros.style.display = 'none';
    if (tblOuter) tblOuter.style.display = 'none';
    return;
  }
  
  if (empty) empty.style.display = 'none';
  if (kpis) kpis.style.display = 'grid';
  if (filtros) filtros.style.display = 'flex';
  if (tblOuter) tblOuter.style.display = 'block';
  
  const lib = pedidosData.filter(p => (p.ctrlap || '').trim().toUpperCase() === 'L');
  const blo = pedidosData.filter(p => (p.ctrlap || '').trim().toUpperCase() === 'B');
  const totalVlr = pedidosData.reduce((s, p) => s + (p.total || 0), 0);
  
  document.getElementById('pc-kpi-lib').textContent = lib.length;
  document.getElementById('pc-kpi-blo').textContent = blo.length;
  document.getElementById('pc-kpi-total').textContent = pedidosData.length;
  document.getElementById('pc-kpi-vlr').textContent = brl(totalVlr);
  document.getElementById('pc-kpi-vlr-lib').textContent = brl(lib.reduce((s, p) => s + (p.total || 0), 0));
  document.getElementById('pc-kpi-vlr-blo').textContent = brl(blo.reduce((s, p) => s + (p.total || 0), 0));
  
  const tb = document.getElementById('pc-tbody');
  tb.innerHTML = pedidosData.map(p => `
    <tr>
      <td class="mono">${p.numpc || '—'}</td>
      <td class="left">${p.razao || p.fornecedor || '—'}</td>
      <td class="mono">${p.sc || '—'}</td>
      <td class="mono">${p.produto || '—'}</td>
      <td class="left">${p.descricao || '—'}</td>
      <td>${p.um || '—'}</td>
      <td class="mono">${p.qtd || '—'}</td>
      <td class="mono">${p.qtdreceber || '—'}</td>
      <td class="mono">${p.prcunit > 0 ? brl(p.prcunit) : '—'}</td>
      <td class="mono">${p.total > 0 ? brl(p.total) : '—'}</td>
      <td>${p.emissao || '—'}</td>
      <td>${p.entrega || '—'}</td>
      <td>${p.dtlib || '—'}</td>
      <td>${(p.ctrlap || '').trim().toUpperCase() === 'L' ? '<span class="tag-liberado">Liberado</span>' : (p.ctrlap || '').trim().toUpperCase() === 'B' ? '<span class="tag-bloqueado">Bloqueado</span>' : '—'}</td>
      <td>${p.tipocompra || '—'}</td>
      <td>${p.minmax || '—'}</td>
      <td class="left">${p.obs || '—'}</td>
    </tr>
  `).join('');
  document.getElementById('pc-count').textContent = pedidosData.length + ' itens';
  document.getElementById('btn-limpar-pc').style.display = 'flex';
}

function limparPedidos() {
  if (!confirm('Limpar todos os pedidos importados?')) return;
  pedidosData = [];
  localStorage.removeItem('petra_pedidos');
  renderPedidos();
  toast('✅ Pedidos limpos!');
}

function handleDropExcelPC(e) {
  e.preventDefault();
  document.getElementById('pc-drop-zone')?.classList.remove('drop-active');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const tsv = XLSX.utils.sheet_to_csv(ws, { FS: '\t', RS: '\n' });
      document.getElementById('pc-paste-input').value = tsv;
      processarPedidos();
    } catch (err) { toast('❌ Erro ao ler o arquivo.', 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function handleFileInputPC(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const tsv = XLSX.utils.sheet_to_csv(ws, { FS: '\t', RS: '\n' });
      document.getElementById('pc-paste-input').value = tsv;
      processarPedidos();
    } catch (err) { toast('❌ Erro ao ler o arquivo.', 'error'); }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}

function filtrarPC(tipo) { _pcFiltroAtivo = tipo; renderPedidos(); }
function toggleTipoMenu() { }
function selecionarTipo(tipo) { _pcFiltroTipo = tipo; renderPedidos(); }
function toggleSemSC() { _pcSemSC = !_pcSemSC; renderPedidos(); }
function toggleLiberacaoMenu() { }
function selecionarLiberacao(val) { _pcFiltroLiberacao = val; renderPedidos(); }
function toggleEmissaoMenu() { }
function selecionarEmissao(val) { _pcFiltroEmissao = val; renderPedidos(); }
function togglePontoPedido() { _pcFiltroPonto = !_pcFiltroPonto; renderPedidos(); }
function toggleMinMaxMenu() { }
function selecionarMinMax(val) { _pcFiltroMinMax = val; renderPedidos(); }
function toggleAlinharForn() { _pcAlinharForn = !_pcAlinharForn; renderPedidos(); }
function toggleCobrarMenu() { }
function ativarCobrar(tipo) { _cobrarFiltroAtivo = tipo; renderPedidos(); }

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES DE ABORDAGENS
// ════════════════════════════════════════════════════════════════════

let _abCatAtiva = 'all';

function filtrarAbordagens(cat) {
  _abCatAtiva = cat;
  renderAbordagens();
}

function renderAbordagens() {
  const grid = document.getElementById('ab-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="empty"><div class="empty-icon">💬</div><div class="empty-title">Templates disponíveis</div><div class="empty-sub">Clique em um template para copiar</div></div>';
  document.getElementById('ab-count').textContent = '0 templates';
}

function atualizarPreviews() { renderAbordagens(); }

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES DE NOTAS, PRIORIDADES E LEMBRETES
// ════════════════════════════════════════════════════════════════════

function salvarNotas() {
  const ta = document.getElementById('notas-textarea');
  if (ta) localStorage.setItem('petra_notas', ta.value);
}

function limparNotas() {
  if (!confirm('Limpar todas as anotações?')) return;
  const ta = document.getElementById('notas-textarea');
  if (ta) { ta.value = ''; salvarNotas(); }
}

function adicionarPrioridade() { toast('Função em desenvolvimento'); }
function adicionarLembrete() { toast('Função em desenvolvimento'); }

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES DE INVENTÁRIO DIESEL
// ════════════════════════════════════════════════════════════════════

function dieselCalc() { }
function dieselCopiar() { }
function dieselNovo() { }
function dieselLimparHistorico() { }
function dieselRenderHistorico() { }

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES DE COMPARAÇÃO PROTHEUS × CTA
// ════════════════════════════════════════════════════════════════════

function handleDropComp(e, tipo) { }
function handleFileComp(input, tipo) { }
function compParsePaste(tipo, texto) { }
function compExecutar() { }
function compCopiar() { }

// ════════════════════════════════════════════════════════════════════
// FUNÇÕES DE DASHBOARD E UI
// ════════════════════════════════════════════════════════════════════

function renderDashboard() {
  document.getElementById('dash-economia').textContent = dados.length ? document.getElementById('kpi-economia')?.textContent || '—' : '—';
  document.getElementById('dash-itens-cot').textContent = dados.length ? document.getElementById('kpi-prods')?.textContent || '—' : '—';
  document.getElementById('dash-forn-cot').textContent = dados.length ? (document.getElementById('kpi-forn')?.textContent || '—') + ' fornecedores' : '— fornecedores';
  document.getElementById('dash-sem-preco').textContent = dados.length ? document.getElementById('kpi-semproduto')?.textContent || '—' : '—';
  document.getElementById('dash-var-media').textContent = dados.length ? document.getElementById('kpi-var-media')?.textContent || '—' : '—';
  document.getElementById('dash-sc-total').textContent = scData.length || '—';
  document.getElementById('dash-sc-atrasadas').textContent = '—';
  document.getElementById('dash-sc-hoje').textContent = '—';
  document.getElementById('dash-sc-estoque').textContent = scData.filter(s => (s.cc || '').trim() === '2003').length || '—';
  document.getElementById('dash-pc-lib').textContent = pedidosData.filter(p => (p.ctrlap || '').trim().toUpperCase() === 'L').length || '—';
  document.getElementById('dash-pc-blo').textContent = pedidosData.filter(p => (p.ctrlap || '').trim().toUpperCase() === 'B').length || '—';
  document.getElementById('dash-pc-total').textContent = pedidosData.length || '—';
  document.getElementById('dash-pc-vlr').textContent = brl(pedidosData.reduce((s, p) => s + (p.total || 0), 0));
  document.getElementById('dash-timestamp').textContent = 'Última atualização: ' + new Date().toLocaleString('pt-BR');
}

function showTab(t) {
  const tabs = ['home', 'analise', 'fatmin', 'fornecedores', 'pedidos', 'sc', 'abordagens', 'diesel'];
  tabs.forEach(id => {
    const el = document.getElementById('tab-' + id);
    if (el) el.style.display = t === id ? 'block' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick') === `showTab('${t}')`);
  });
  if (t === 'home') renderDashboard();
  if (t === 'analise') { if (dados.length) { renderizarTabela(); atualizarKPIs(); } }
  if (t === 'sc') renderSC();
  if (t === 'pedidos') renderPedidos();
  if (t === 'fornecedores') renderTabelaFornecedores();
  localStorage.setItem('petra_last_tab', t);
}

function ajustarDensidade(val) {
  document.body.classList.remove('table-density-sm', 'table-density-lg');
  if (val == 1) document.body.classList.add('table-density-sm');
  if (val == 3) document.body.classList.add('table-density-lg');
  localStorage.setItem('petra_density', val);
}

function toggleFullscreen() {
  document.body.classList.toggle('fullscreen-mode');
  const btn = document.getElementById('btn-fullscreen');
  if (btn) btn.classList.toggle('ativo', document.body.classList.contains('fullscreen-mode'));
}

function toggleFontPopup() {
  document.getElementById('font-popup')?.classList.toggle('show');
}

function abrirModalInstrucoes(secao) {
  document.getElementById('modal-instrucoes').style.display = 'flex';
  mostrarSecaoInstr(secao || 'geral');
}

function fecharModalInstrucoes() {
  document.getElementById('modal-instrucoes').style.display = 'none';
  if (document.getElementById('instr-nao-mostrar')?.checked) {
    localStorage.setItem('petra_instrucoes_visto', '1');
  }
}

function mostrarSecaoInstr(id) {
  ['geral', 'analise', 'sc', 'pedidos', 'fornec'].forEach(s => {
    const el = document.getElementById('instr-' + s);
    if (el) el.style.display = 'none';
    const btn = document.getElementById('it-' + s);
    if (btn) btn.classList.remove('active');
  });
  const el = document.getElementById('instr-' + id);
  if (el) el.style.display = 'block';
  const btn = document.getElementById('it-' + id);
  if (btn) btn.classList.add('active');
}

function mobNav(tab) {
  showTab(tab);
  document.querySelectorAll('.mob-nav-item').forEach(el => {
    el.classList.toggle('active', el.id === 'mobtab-' + tab);
  });
  const titles = { home: 'Visão Geral', analise: 'Análise de Cotações', sc: 'Sol. de Compra', pedidos: 'Pedidos de Compra', fornecedores: 'Inf. Fornecedores', fatmin: 'Fat. Mínimo', diesel: 'Inventário Diesel', abordagens: 'Abordagens' };
  const titleEl = document.getElementById('mob-page-title');
  if (titleEl) titleEl.textContent = titles[tab] || tab;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  loadFromFirebase();
  renderDashboard();
  
  const density = localStorage.getItem('petra_density');
  if (density) ajustarDensidade(density);
  if (localStorage.getItem('petra_fullscreen') === '1') toggleFullscreen();
  
  const lastTab = localStorage.getItem('petra_last_tab');
  if (lastTab && lastTab !== 'home') setTimeout(() => showTab(lastTab), 100);
  
  if (!localStorage.getItem('petra_instrucoes_visto')) setTimeout(() => abrirModalInstrucoes('geral'), 600);
  
  const ta = document.getElementById('paste-input');
  if (ta) ta.onpaste = () => setTimeout(() => { if (ta.value.trim().length > 10) processarTexto(); }, 150);
});

// Exportar funções globais
window.showTab = showTab;
window.mobNav = mobNav;
window.processarTexto = processarTexto;
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.handleDropExcel = handleDropExcel;
window.handleFileInputAnalise = handleFileInputAnalise;
window.limpar = limpar;
window.exportarExcel = exportarExcel;
window.toggleView = toggleView;
window.toggleFiltroVariacao = toggleFiltroVariacao;
window.toggleModoLimpo = toggleModoLimpo;
window.toggleEconomiaTotal = toggleEconomiaTotal;
window.ativarModoComparacao = ativarModoComparacao;
window.sairModoComparacao = sairModoComparacao;
window.executarComparacao = executarComparacao;
window.selecionarMelhorEmMassa = selecionarMelhorEmMassa;
window.exportarSomenteMelhores = exportarSomenteMelhores;
window.filtrarAnaliseProduto = filtrarAnaliseProduto;
window.toggleRankingCards = toggleRankingCards;
window.limparFiltroForn = limparFiltroForn;
window.exportarJustificativaExcel = exportarJustificativaExcel;
window.abrirModalNovoFornecedor = abrirModalNovoFornecedor;
window.fecharModalForn = fecharModalForn;
window.salvarFornecedor = salvarFornecedor;
window.editarFornecedor = editarFornecedor;
window.exportarFornecedoresCSV = exportarFornecedoresCSV;
window.abrirModalSC = abrirModalSC;
window.fecharModalSC = fecharModalSC;
window.processarSC = processarSC;
window.limparSC = limparSC;
window.exportarSCExcel = exportarSCExcel;
window.handleDropExcelSC = handleDropExcelSC;
window.handleFileInputSC = handleFileInputSC;
window.filtrarSCRapido = filtrarSCRapido;
window.setSCFiltroSol = setSCFiltroSol;
window.toggleSCMenu = toggleSCMenu;
window.filtrarSCData = filtrarSCData;
window.abrirModalPC = abrirModalPC;
window.fecharModalPC = fecharModalPC;
window.processarPedidos = processarPedidos;
window.limparPedidos = limparPedidos;
window.handleDropExcelPC = handleDropExcelPC;
window.handleFileInputPC = handleFileInputPC;
window.filtrarPC = filtrarPC;
window.toggleTipoMenu = toggleTipoMenu;
window.selecionarTipo = selecionarTipo;
window.toggleSemSC = toggleSemSC;
window.toggleLiberacaoMenu = toggleLiberacaoMenu;
window.selecionarLiberacao = selecionarLiberacao;
window.toggleEmissaoMenu = toggleEmissaoMenu;
window.selecionarEmissao = selecionarEmissao;
window.togglePontoPedido = togglePontoPedido;
window.toggleMinMaxMenu = toggleMinMaxMenu;
window.selecionarMinMax = selecionarMinMax;
window.toggleAlinharForn = toggleAlinharForn;
window.toggleCobrarMenu = toggleCobrarMenu;
window.ativarCobrar = ativarCobrar;
window.filtrarAbordagens = filtrarAbordagens;
window.atualizarPreviews = atualizarPreviews;
window.salvarNotas = salvarNotas;
window.limparNotas = limparNotas;
window.adicionarPrioridade = adicionarPrioridade;
window.adicionarLembrete = adicionarLembrete;
window.dieselCalc = dieselCalc;
window.dieselCopiar = dieselCopiar;
window.dieselNovo = dieselNovo;
window.dieselLimparHistorico = dieselLimparHistorico;
window.handleDropComp = handleDropComp;
window.compParsePaste = compParsePaste;
window.compExecutar = compExecutar;
window.compCopiar = compCopiar;
window.ajustarDensidade = ajustarDensidade;
window.toggleFullscreen = toggleFullscreen;
window.toggleFontPopup = toggleFontPopup;
window.abrirModalInstrucoes = abrirModalInstrucoes;
window.fecharModalInstrucoes = fecharModalInstrucoes;
window.mostrarSecaoInstr = mostrarSecaoInstr;
window.toast = toast;