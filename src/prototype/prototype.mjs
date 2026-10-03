// M2 interface demonstration. Deliberately separate from the production engine
// and saves; the seeded fixture is a visual probe, not an approved price model.
import {createLeaderboard} from './leaderboard.mjs';
const root = document.querySelector('#app');
const CAPACITY = 15;
const DIFFICULTIES = [
  {id: 'easy', name: '轻松', cash: 30e6, label: '3000万美元', note: '更充足的周转资金'},
  {id: 'standard', name: '标准', cash: 10e6, label: '1000万美元', note: '在资金与机会间取舍'},
  {id: 'challenge', name: '挑战', cash: 5e6, label: '500万美元', note: '从小额交易起步'},
];
let selectedDifficulty = 'standard', selectedTeam = null, nickname = '';
let data, game = null, tab = 'market', search = '', filter = 'ALL', timer;
const leaderboard = createLeaderboard(() => !game ? null : ({
  name: game.nickname, difficultyId: game.difficultyId, day: game.day,
  assets: totalReference(), ended: game.ended,
}));
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const money = n => n == null ? '待核实' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : '$' + (n / 1e3).toFixed(0) + 'K';
const signed = n => (n < 0 ? '−' : '+') + money(Math.abs(n));
const percent = n => (n < 0 ? '−' : '+') + Math.abs(n * 100).toFixed(1) + '%';
const tone = n => n < 0 ? 'down' : 'up';
const initials = name => name.split(' ').map(x => x[0]).slice(0, 2).join('');
const bucket = p => p.position.includes('C') ? 'C' : p.position.includes('G') ? 'G' : 'F';
const byId = id => data.players.find(p => p.id === id);
const teamById = id => data.teams.find(t => t.id === id);
function random(key) {
  let n = 2166136261;
  for (const c of key) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}
function notify(message) {
  const element = document.querySelector('#toast');
  element.textContent = message; element.classList.add('show');
  clearTimeout(timer); timer = setTimeout(() => element.classList.remove('show'), 3800);
}
function createDemo(teamId, difficultyId) {
  const difficulty = DIFFICULTIES.find(d => d.id === difficultyId) ?? DIFFICULTIES[1];
  game = {day: 1, teamId, difficultyId: difficulty.id, initialCash: difficulty.cash,
    cash: difficulty.cash, nickname: nickname.trim() || '我', holdings: [], realized: 0, transactions: 0,
    owners: Object.fromEntries(data.players.map(p => [p.id, p.teamId])),
    daily: {}, visits: {}, ended: false, arrival: 'start'};
  newDay(); visit(); tab = 'market'; search = ''; filter = 'ALL'; render();
}
function newDay() {
  const factors = {}, previous = game.daily[game.day - 1];
  for (const p of data.players) {
    if (!previous) {
      factors[p.id] = .65 + random('start:' + p.id) * .8;
    } else {
      const tier = random(`tier:${p.id}:${game.day}`);
      const magnitude = random(`size:${p.id}:${game.day}`);
      const change = tier < .72 ? .05 + magnitude * .1 : tier < .95 ? .15 + magnitude * .1 : .25 + magnitude * .15;
      const old = previous.factors[p.id];
      const downChance = old > 1.9 ? .6 : old < .5 ? .4 : .5;
      const sign = random(`direction:${p.id}:${game.day}`) < downChance ? -1 : 1;
      factors[p.id] = clamp(old * (1 + sign * change), .3, 2.5);
    }
  }
  const counts = Object.fromEntries(data.teams.map(t => [t.id, {G: 0, F: 0, C: 0}]));
  for (const p of data.players) if (counts[game.owners[p.id]]) counts[game.owners[p.id]][bucket(p)]++;
  const average = Object.fromEntries(['G', 'F', 'C'].map(pos => [pos, data.teams.reduce((n,t) => n + counts[t.id][pos], 0) / data.teams.length]));
  const demand = Object.fromEntries(data.teams.map(t => [t.id, Object.fromEntries(['G', 'F', 'C'].map(pos => [pos, clamp((average[pos] - counts[t.id][pos]) * .03, -.15, .15)]))]));
  game.daily[game.day] = {factors, demand};
}
function quote(p, teamId = game.teamId, day = game.day) {
  if (!p.salaryUsd) return null;
  const daily = game.daily[day];
  return Math.round(p.salaryUsd * clamp(daily.factors[p.id] * (1 + daily.demand[teamId][bucket(p)]), .3, 2.5));
}
function visit() {
  game.visits[game.teamId] = {day: game.day, prices: Object.fromEntries(data.players.map(p => [p.id, quote(p)])),
    local: data.players.filter(p => game.owners[p.id] === game.teamId).map(p => p.id)};
}
function totalLocal() {
  return game.cash + game.holdings.reduce((sum, h) => sum + quote(byId(h.id)), 0);
}
function totalReference() {
  return game.cash + game.holdings.reduce((sum,h) => sum + Math.round(byId(h.id).salaryUsd * game.daily[game.day].factors[h.id]), 0);
}
function playerHeader(p) {
  return `<div class="player-head"><span class="avatar">${esc(initials(p.name))}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.position)} · ${esc(teamById(p.teamId).abbr)} 初始归属</p></div></div>`;
}
function setup() {
  const difficulty = DIFFICULTIES.find(d => d.id === selectedDifficulty);
  selectedTeam ??= data.teams.find(t => t.abbr === 'ATL').id;
  root.innerHTML = `<section class="setup"><div><span class="eyebrow">BUY LOW. FIND YOUR NEXT DEAL.</span><h1>下一站，<br>你的球员值多少？</h1><p class="lead">选好你的启动资金，走访30支球队。买入、持有、转卖，在每天变化的报价里寻找机会。</p><div class="rule-pills"><span>最多持有 ${CAPACITY} 人</span><span>移动耗时 1 天</span><span>第 30 天结算</span></div></div><div class="setup-card"><span class="eyebrow">CURRENT ROSTER / 2026–27</span><h2>选好起点，开始经营。</h2><div class="field-label" id="difficulty-label">游戏难度 · 初始资金</div><div class="difficulty-options" role="group" aria-labelledby="difficulty-label">${DIFFICULTIES.map(d => `<button type="button" data-difficulty="${d.id}" aria-pressed="${d.id === selectedDifficulty}" class="difficulty-option ${d.id === selectedDifficulty ? 'selected' : ''}"><span>${d.name}</span><strong>${d.label.replace('万美元','万')}</strong><small>美元</small></button>`).join('')}</div><p class="difficulty-note">${difficulty.note} · 三档均有${CAPACITY}个背包栏，行情规则一致。</p><label for="nickname">玩家昵称（可选）</label><input id="nickname" class="nickname-input" maxlength="12" placeholder="填写你的排行榜昵称" value="${esc(nickname)}"><p class="nickname-note">当前原型仅在本页展示，未上传昵称或成绩。</p><label for="start-team">开局球队</label><select id="start-team">${data.teams.map(t => `<option value="${esc(t.id)}" ${t.id === selectedTeam ? 'selected' : ''}>${esc(t.name)} · ${esc(t.abbr)}</option>`).join('')}</select><div class="sample-line"><span>初始现金</span><strong id="initial-cash">$${difficulty.cash.toLocaleString('en-US')}</strong><span>模拟报价区间</span><strong>工资基准的 30%～250%</strong><small>工资是起点，市场报价每天变化。</small></div><button class="primary wide" data-start>${difficulty.name}难度 · 开始试玩 →</button><p class="small-note">30队 · 620名球员 · 616名可确定本季基本工资。戴维斯已在奇才名单。本轮评审行情变化与交易反馈，演示报价不代表真实估值。</p></div></section>`;
}
function header() {
  const team = teamById(game.teamId), profit = totalLocal() - game.initialCash;
  const difficulty = DIFFICULTIES.find(d => d.id === game.difficultyId);
  return `<section class="hero"><div><span class="eyebrow">${esc(team.abbr)} / LOCAL MARKET</span><h2>${esc(team.name)}</h2><p>${difficulty.name}难度 · 当前球队报价可见</p></div><div class="day"><strong>${game.day}<span> / 30 天</span></strong><div class="day-track"><i style="width:${game.day / 30 * 100}%"></i></div></div></section><section class="stats"><div class="stat"><label>可用现金</label><strong id="cash">${money(game.cash)}</strong><small>初始 ${money(game.initialCash)}</small></div><div class="stat"><label>持有球员</label><strong id="capacity">${game.holdings.length} / ${CAPACITY}</strong><small>已交易 ${game.transactions} 笔</small></div><div class="stat"><label>当地总盈亏</label><strong class="${tone(profit)}">${signed(profit)}</strong><small>持仓按当地卖价计</small></div></section><section class="arrival" aria-live="polite"><span class="check">✓</span><div><h3>${game.arrival === 'start' ? '第1天报价已就绪' : `第${game.day}天 · 到达${esc(team.name)}，报价已刷新`}</h3><p>${game.arrival === 'start' ? '当天价格固定。买卖后，移动到下一队推进一天。' : '行情承接昨日变化，球队需求按昨日交易后的阵容重算。'}</p></div>${game.holdings.length ? '<button data-tab="warehouse">查看持仓卖价 →</button>' : ''}</section><nav class="tabs" aria-label="游戏页面">${[['market','当地市场'],['warehouse','我的仓库'],['map','球队地图']].map(([id,name]) => `<button data-tab="${id}" class="${tab === id ? 'active' : ''}" aria-current="${tab === id ? 'page' : 'false'}">${name}${id === 'warehouse' ? `<small>${game.holdings.length}</small>` : ''}</button>`).join('')}</nav>`;
}
function card(p) {
  const price = quote(p), ratio = price == null ? null : price / p.salaryUsd;
  const previous = game.day > 1 ? quote(p, game.teamId, game.day - 1) : null;
  const change = previous ? (price - previous) / previous : null;
  const disabled = price == null || game.cash < price || game.holdings.length >= CAPACITY;
  const reason = price == null ? '工资待核实' : game.holdings.length >= CAPACITY ? '仓库已满' : game.cash < price ? '现金不足' : '买入球员';
  return `<article class="card" data-player-card="${esc(p.id)}">${playerHeader(p)}<div class="salary-row"><span>本季基本工资</span><span>${money(p.salaryUsd)}</span></div><div class="quote-row"><strong>${money(price)}</strong>${change == null ? '<span class="change muted">开局报价</span>' : `<span class="change ${tone(change)}">${percent(change)}</span>`}</div><p class="quote-caption">${price == null ? '当前合同工资未确认，暂不可交易' : change == null ? '今日当地买入价 · 模拟行情' : '今日当地买入价 · 较昨日当地报价'}</p>${ratio == null ? '<div class="ratio">保留官方名单，等待价格核实</div>' : `<div class="ratio"><span>工资 ${ratio.toFixed(2)} 倍</span><div class="track"><i style="left:${(ratio - .3) / 2.2 * 100}%"></i></div></div>`}<div class="buy-row"><span>买卖不消耗天数</span><button data-buy="${esc(p.id)}" ${disabled ? 'disabled' : 'class="primary"'}>${reason}</button></div></article>`;
}
function market() {
  let players = data.players.filter(p => game.owners[p.id] === game.teamId && p.name.toLowerCase().includes(search.toLowerCase()) && (filter === 'ALL' || bucket(p) === filter));
  if (filter === 'affordable') players = data.players.filter(p => game.owners[p.id] === game.teamId && p.salaryUsd && quote(p) <= game.cash && p.name.toLowerCase().includes(search.toLowerCase()));
  players.sort((a, b) => {
    const affordable = p => p.salaryUsd && quote(p) <= game.cash;
    return Number(affordable(b)) - Number(affordable(a)) || (quote(b) ?? -1) - (quote(a) ?? -1);
  });
  return `<section><div class="section-head"><div><h3>今天的交易机会</h3><p>全队挂牌 · 当日报价固定</p></div><label class="sr-only" for="search">搜索球员姓名</label><input id="search" class="search" type="search" placeholder="搜索球员姓名" value="${esc(search)}"></div><div class="filters">${[['ALL','全部'],['affordable','买得起'],['G','后卫'],['F','前锋'],['C','中锋']].map(([id, name]) => `<button data-filter="${id}" class="${filter === id ? 'active' : ''}">${name}</button>`).join('')}<span class="count">${players.length} 名球员</span></div>${players.length ? `<div class="grid">${players.map(card).join('')}</div>` : '<div class="empty"><h3>没有匹配的球员</h3><p>更换搜索或筛选条件，或者去其他球队看看。</p></div>'}</section>`;
}
function warehouse() {
  const rows = game.holdings.map(h => {
    const p = byId(h.id), price = quote(p), profit = price - h.cost;
    return `<article class="holding" data-holding="${esc(p.id)}">${playerHeader(p)}<div class="holding-price"><div><label>购入成本</label><strong>${money(h.cost)}</strong><small>第${h.day}天 · ${esc(teamById(h.teamId).abbr)}</small></div><div><label>当地卖价</label><strong>${money(price)}</strong><small>第${game.day}天 · ${esc(teamById(game.teamId).abbr)}</small></div><div><label>卖出盈亏</label><strong class="${tone(profit)}">${signed(profit)}</strong><small>${percent(profit / h.cost)}</small></div></div><button class="primary" data-sell="${esc(p.id)}">卖给当地球队</button></article>`;
  });
  return `<div class="section-head"><div><h3>你的球员，今天值多少？</h3><p>购入成本固定；卖价随日期与目的地变化。</p></div></div>${rows.length ? `<div class="holdings">${rows.join('')}</div><p class="warehouse-note">卖出后资金立即到账，球员进入当地球队。交易不耗天数，对球队需求的影响在下一天体现。</p>` : '<div class="empty"><h3>仓库还是空的</h3><p>先买入一名球员，再移动到另一支球队，比较新卖价。</p><button class="primary" data-tab="market">去市场买入 →</button></div>'}`;
}
function map() {
  return `<div class="section-head"><div><h3>下一站，去哪里？</h3><p>每次移动推进一天 · 抵达后才知道最新报价</p></div></div>${game.day === 30 ? '<div class="warning">已到第30天，仍可在当地交易；完成后结算本局。</div>' : ''}<div class="grid">${data.teams.map(t => {
    const current = t.id === game.teamId, history = game.visits[t.id];
    const knownIds = history ? [...new Set([...game.holdings.map(h => h.id), ...history.local])] : [];
    return `<article class="card team-card ${current ? 'current' : ''}"><div class="team-top"><div class="team-code" style="--team-color:#${esc(t.color)}">${esc(t.abbr)}</div><div><h3>${esc(t.name)}</h3><span class="history">${current ? '你在这里' : history ? '已访问' : '尚未访问'}</span></div></div><div class="history">${history ? `上次报价：第${history.day}天${!current && history.day < game.day ? ' · 已过期' : ''}` : '最新价格未知'}</div>${history ? `<details><summary>查看${current ? '本次到访' : '历史'}报价</summary><div class="old-quotes">${knownIds.map(id => `<span>${esc(byId(id).name)}${game.holdings.some(h => h.id === id) ? ' · 持有' : ''}</span><strong>${money(history.prices[id])}</strong>`).join('')}</div><p>保存的是到访时的报价和名单，不能保证现在仍相同。</p></details>` : '<p class="history">需要亲自到访才能获取报价。</p>'}<button data-move="${esc(t.id)}" ${current || game.day === 30 ? 'disabled' : ''}>${current ? '当前球队' : `前往 · 第${game.day + 1}天 →`}</button></article>`;
  }).join('')}</div>`;
}
function result() {
  const inventory = game.holdings.reduce((n, h) => n + Math.round(byId(h.id).salaryUsd * game.daily[game.day].factors[h.id]), 0);
  const assets = game.cash + inventory, profit = assets - game.initialCash;
  const difficulty = DIFFICULTIES.find(d => d.id === game.difficultyId);
  return `<section class="result"><span class="eyebrow">DEMO ROUND COMPLETE</span><h1>这一局，你的眼光值多少？</h1><p>${difficulty.name}难度 · 初始${money(game.initialCash)} · 第${game.day}天结束</p><div class="big">${money(assets)}</div><strong id="result-profit" class="${tone(profit)}">总收益 ${signed(profit)} · ${percent(profit / game.initialCash)}</strong><div class="stats"><div class="stat"><label>剩余现金</label><strong>${money(game.cash)}</strong></div><div class="stat"><label>持仓参考价值</label><strong>${money(inventory)}</strong></div><div class="stat"><label>已实现盈亏</label><strong class="${tone(game.realized)}">${signed(game.realized)}</strong></div><div class="stat"><label>交易次数</label><strong>${game.transactions}</strong></div></div><p>持仓按当日统一模拟行情计价，结算不含球队需求溢价。<br>演示参数待调整，正式规则与存档尚未接入。</p><button class="result-board-button leaderboard-link" data-open-board>查看进行中排行榜 →</button><p class="result-board-note">本局结束后退出进行中榜单，结算成绩不混入该榜。</p><button class="primary" data-restart>重新试玩 →</button></section>`;
}
function render() {
  leaderboard.update();
  if (!game) return setup();
  if (game.ended) {root.innerHTML = result(); return;}
  root.innerHTML = header() + (tab === 'market' ? market() : tab === 'warehouse' ? warehouse() : map()) + `<div class="endbar"><p>每日模拟行情 · 报价范围为本季基本工资的30%～250%<br>本轮仅评审界面与交易反馈</p><div><button data-restart>重新试玩</button> <button data-finish>${game.day === 30 ? '结算本局' : '提前结算'}</button></div></div>`;
}
root.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.hasAttribute('data-open-board')) {leaderboard.open(); return;}
  if (button.dataset.difficulty) {
    selectedTeam = document.querySelector('#start-team').value;
    selectedDifficulty = button.dataset.difficulty; setup();
    document.querySelector(`[data-difficulty="${selectedDifficulty}"]`).focus(); return;
  }
  if (button.hasAttribute('data-start')) return createDemo(document.querySelector('#start-team').value, selectedDifficulty);
  if (button.hasAttribute('data-restart')) {
    if (!game?.ended && !confirm('重新试玩会清除本页演示进度，继续吗？')) return;
    game = null; leaderboard.update(); return setup();
  }
  if (button.dataset.tab) {tab = button.dataset.tab; search = ''; filter = 'ALL'; render(); return;}
  if (button.dataset.filter) {filter = button.dataset.filter; render(); return;}
  if (button.dataset.buy) {
    const p = byId(button.dataset.buy), cost = quote(p);
    if (game.owners[p.id] !== game.teamId || cost == null || cost > game.cash || game.holdings.length >= CAPACITY) return;
    game.cash -= cost; game.owners[p.id] = 'warehouse';
    game.holdings.push({id: p.id, cost, day: game.day, teamId: game.teamId}); game.transactions++;
    render(); notify(`已买入 ${p.name} · ${money(cost)}，球员进入仓库`); return;
  }
  if (button.dataset.sell) {
    const h = game.holdings.find(x => x.id === button.dataset.sell); if (!h) return;
    const price = quote(byId(h.id)), profit = price - h.cost;
    game.cash += price; game.realized += profit; game.owners[h.id] = game.teamId;
    game.holdings = game.holdings.filter(x => x.id !== h.id); game.transactions++;
    render(); notify(`卖出到账 ${money(price)} · 本笔盈亏 ${signed(profit)}`); return;
  }
  if (button.dataset.move) {
    if (button.dataset.move === game.teamId || game.day >= 30) return;
    game.day++; game.teamId = button.dataset.move; newDay(); visit(); game.arrival = 'move';
    tab = game.holdings.length ? 'warehouse' : 'market'; search = ''; filter = 'ALL';
    render(); window.scrollTo({top: 0, behavior: 'smooth'}); notify(`第${game.day}天 · 已到达${teamById(game.teamId).name}，当地报价已刷新`); return;
  }
  if (button.hasAttribute('data-finish')) {
    if (!confirm('按当前模拟行情结算并结束这局演示？')) return;
    game.ended = true; render();
  }
});
root.addEventListener('input', event => {
  if (event.target.id === 'nickname') {nickname = event.target.value; return;}
  if (event.target.id !== 'search') return;
  const at = event.target.selectionStart; search = event.target.value; render();
  const input = document.querySelector('#search'); input.focus();
  try {input.setSelectionRange(at, at);} catch {}
});
root.addEventListener('change', event => {
  if (event.target.id === 'start-team') selectedTeam = event.target.value;
});
document.querySelector('#help').addEventListener('click', () => document.querySelector('#help-dialog').showModal());
document.querySelector('#open-leaderboard').addEventListener('click', () => leaderboard.open());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.querySelector('#help-dialog').close()));
try {
  const response = await fetch(new URL('./roster.json', import.meta.url));
  if (!response.ok) throw new Error(`名单读取失败：HTTP ${response.status}`);
  data = await response.json();
  data.teams.sort((a, b) => a.englishName.localeCompare(b.englishName, 'en'));
  setup();
} catch (error) {
  root.innerHTML = `<div class="empty"><h3>原型暂未打开</h3><p>${esc(error.message)}</p></div>`;
}
