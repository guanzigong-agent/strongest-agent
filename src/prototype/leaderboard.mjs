// UI fixture only: no server requests, player accounts, or shared score storage.
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '$' + (n / 1e6).toFixed(2) + 'M';
const exact = n => '$' + Math.round(n).toLocaleString('en-US');
const DIFFICULTIES = [
  {id:'easy', name:'轻松', initialCash:30e6},
  {id:'standard', name:'标准', initialCash:10e6},
  {id:'challenge', name:'挑战', initialCash:5e6},
];
const NAMES = ['风城猎手','禁区生意人','底薪淘金客','三分账本','转会观察员','板凳投资人'];
export function createLeaderboard(getCurrentRun) {
  const dialog = document.createElement('dialog');
  dialog.id = 'leaderboard-dialog'; dialog.className = 'leaderboard-dialog';
  dialog.setAttribute('aria-labelledby', 'leaderboard-title'); document.body.append(dialog);
  let selected = 'standard', status = 'ready', round = 0, updated = new Date(), version = 0;
  const rows = DIFFICULTIES.flatMap(d => [1.7,1.42,1.12,1.04,.97,.84].map((multiplier, i) => ({
    id:`demo-${d.id}-${i}`, difficultyId:d.id, name:`演示·${NAMES[i]}`, assets:Math.round(d.initialCash * multiplier), day:[24,19,14,9,6,3][i],
  })));
  function currentRows() {
    const current = getCurrentRun();
    const list = rows.filter(r => r.difficultyId === selected).map(r => ({...r}));
    if (current && !current.ended && current.difficultyId === selected) list.push({...current, id:'me', isMe:true});
    return list.sort((a,b) => b.assets - a.assets || a.id.localeCompare(b.id));
  }
  function render() {
    const current = getCurrentRun(), list = currentRows();
    const difficulty = DIFFICULTIES.find(d => d.id === selected);
    const myIndex = list.findIndex(r => r.isMe), me = list[myIndex];
    const time = new Intl.DateTimeFormat('zh-CN', {hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Shanghai',hour12:false}).format(updated);
    const state = status === 'loading' ? '正在刷新演示…' : status === 'error' ? '演示连接中断 · 保留上次榜单' : `本页更新 ${time} · 演示数据`;
    dialog.innerHTML = `<div class="board-heading"><div><span class="eyebrow">LIVE ASSET RANKINGS</span><h2 id="leaderboard-title">实时资产榜</h2></div><button class="close" data-board-close aria-label="关闭排行榜">×</button></div><div class="board-demo">模拟玩家与本页当前局 · 未连接线上排行榜</div><div class="board-tabs" role="group" aria-label="排行榜难度">${DIFFICULTIES.map(d => `<button data-board-difficulty="${d.id}" aria-pressed="${d.id === selected}" class="${d.id === selected ? 'selected' : ''}">${d.name}<small>初始${d.initialCash / 1e4}万美元</small></button>`).join('')}</div><div class="board-status ${status === 'error' ? 'down' : 'muted'}" role="status"><span>${state}</span><button data-board-refresh ${status === 'loading' ? 'disabled' : ''}>${status === 'error' ? '重试演示' : '刷新演示'}</button></div><div class="board-columns"><span>排名 / 玩家</span><span>当前总资产</span></div><div class="board-list">${list.map((r,i) => `<article class="board-row ${r.isMe ? 'is-me' : ''}" data-board-player="${r.id}" data-assets="${r.assets}"><div class="rank ${i < 3 ? 'top-rank' : ''}">${i + 1}</div><div class="board-player"><strong>${esc(r.name)}${r.isMe ? ' <em>你</em>' : ''}</strong><small>第${r.day} / 30天${r.isMe ? ' · 当前局' : ' · 模拟玩家'}</small></div><div class="board-score"><strong title="${exact(r.assets)}">${money(r.assets)}</strong><small class="${r.assets >= difficulty.initialCash ? 'up' : 'down'}">${r.assets >= difficulty.initialCash ? '+' : '−'}${Math.abs((r.assets / difficulty.initialCash - 1) * 100).toFixed(1)}%</small></div></article>`).join('')}</div><div class="my-ranking">${me ? `<span>我的当前排名 <strong id="my-rank">#${myIndex + 1}</strong></span><strong id="my-board-assets">${money(me.assets)}</strong>` : `<span>${!current ? '开局后，查看你的实时资产与排名。' : current.ended ? '本局已结束，不参加进行中资产榜。' : `你正在${DIFFICULTIES.find(d => d.id === current.difficultyId).name}难度，请切换查看自己的排名。`}</span>`}</div><p class="board-rule">按现金＋持仓统一参考价值排序。买卖或移动后更新当前局；游戏天数同时展示。三个难度各自排行。</p><details class="board-demo-controls"><summary>原型演示选项</summary><p>模拟其他玩家资产变动和断线反馈，仅用于界面评审。</p><div><button data-board-other ${status === 'loading' ? 'disabled' : ''}>演示其他玩家更新</button><button data-board-error>演示连接失败</button></div></details>`;
  }
  async function refresh(updateOthers = false) {
    const request = ++version; status = 'loading'; render();
    await new Promise(resolve => setTimeout(resolve, 350));
    if (request !== version) return;
    if (updateOthers) {
      round++;
      for (const [i,r] of rows.entries()) r.assets = Math.round(r.assets * (i % 2 === round % 2 ? 1.015 : .985));
    }
    status = 'ready'; updated = new Date(); render();
  }
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.hasAttribute('data-board-close')) {dialog.close(); return;}
    if (button.dataset.boardDifficulty) {selected = button.dataset.boardDifficulty; render(); return;}
    if (button.hasAttribute('data-board-error')) {version++; status = 'error'; render(); return;}
    if (button.hasAttribute('data-board-refresh')) {refresh(); return;}
    if (button.hasAttribute('data-board-other')) refresh(true);
  });
  return {
    open() {selected = getCurrentRun()?.difficultyId ?? selected; render(); if (!dialog.open) dialog.showModal();},
    update() {updated = new Date(); if (dialog.open) render();},
  };
}
