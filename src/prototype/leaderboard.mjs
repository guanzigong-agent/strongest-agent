const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+(n/1e6).toFixed(2)+'M';
const tiers=[['easy','轻松',30e6],['standard','标准',10e6],['challenge','挑战',5e6]];
export function createLeaderboard(getCurrentRun,api,getVersions){
 const dialog=document.createElement('dialog');dialog.id='leaderboard-dialog';dialog.className='leaderboard-dialog';
 dialog.setAttribute('aria-labelledby','leaderboard-title');document.body.append(dialog);
 let selected='standard',status='idle',board=null,error='',requestId=0,interval;
 function render(){
  const me=getCurrentRun(),tier=tiers.find(t=>t[0]===selected),rows=board?.difficultyId===selected?board.rows:[];
  const mine=board?.difficultyId===selected?board.me:null;
  dialog.innerHTML=`<div class="board-heading"><div><span class="eyebrow">LIVE ASSET RANKINGS</span><h2 id="leaderboard-title">玩家资产榜</h2></div><button class="close" data-board-close aria-label="关闭排行榜">×</button></div><div class="board-demo">进行中更新资产 · 结算后保留成绩</div><div class="board-tabs" role="group" aria-label="排行榜难度">${tiers.map(t=>`<button data-board-difficulty="${t[0]}" aria-pressed="${t[0]===selected}" class="${t[0]===selected?'selected':''}">${t[1]}<small>初始${t[2]/1e4}万美元</small></button>`).join('')}</div><div class="board-status ${status==='error'?'down':'muted'}" role="status"><span>${status==='loading'?'正在读取排行榜…':status==='error'?esc(error)+' · 保留上次榜单':board?'已读取最新成绩 · 每10秒刷新':'等待连接'}</span><button data-board-refresh ${status==='loading'?'disabled':''}>${status==='error'?'重试':'刷新'}</button></div><div class="board-columns"><span>排名 / 玩家</span><span>总资产</span></div><div class="board-list">${rows.length?rows.map(r=>`<article class="board-row ${r.id===me?.id?'is-me':''}" data-board-player="${esc(r.id)}" ${r.id===me?.id?'data-board-me':''}><div class="rank ${r.rank<=3?'top-rank':''}">${r.rank}</div><div class="board-player"><strong>${esc(r.nickname)}${r.id===me?.id?' <em>你</em>':''}</strong><small>第${r.day} / 30天 · ${r.ended?'已结算':'进行中'}</small></div><div class="board-score"><strong title="$${r.assets.toLocaleString('en-US')}">${money(r.assets)}</strong><small class="${r.assets>=tier[2]?'up':'down'}">${r.assets>=tier[2]?'+':'−'}${Math.abs((r.assets/tier[2]-1)*100).toFixed(1)}%</small></div></article>`).join(''):`<p class="score-empty">${status==='loading'?'正在加载…':status==='error'?'暂时无法读取成绩，请重试。':'这个难度还没有成绩，来做第一位玩家。'}</p>`}</div><div class="my-ranking">${mine?`<span>我的排名 <strong id="my-rank">#${mine.rank}</strong></span><strong id="my-board-assets">${money(mine.assets)}</strong>`:`<span>${me&&me.difficultyId!==selected?'切换到本局难度查看自己的排名。':me?'本局尚未同步成功；可在结算页重试。':'起个名字，开局后加入排行榜。'}</span>`}</div><p class="board-rule">按现金＋持仓统一参考价值排序。每次买卖、移动后同步，每局成绩单独保留在所选难度。显示前50名及本局排名。</p>`;
 }
 async function refresh(){
  const id=++requestId,difficulty=selected;status='loading';render();
  try{
   if(!api)throw Error('线上成绩服务尚未配置');
   const me=getCurrentRun(),query=new URLSearchParams({difficulty});if(me)query.set('own',me.id);
   const response=await fetch(api+'/leaderboard?'+query,{signal:AbortSignal.timeout(10000)});
   const result=await response.json();if(!response.ok)throw Error(result.error??'读取失败');
   const versions=getVersions();
   if(result.rulesVersion!==versions.rulesVersion||result.rosterVersion!==versions.rosterVersion)throw Error('榜单规则或名单已更新，请刷新游戏后查看');
   if(id!==requestId)return;board=result;status='ready';
  }catch(e){if(id!==requestId)return;status='error';error=e.name==='TypeError'?'连接失败':e.message;}
  if(dialog.open)render();
 }
 dialog.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-board-close'))dialog.close();
  else if(b.dataset.boardDifficulty){selected=b.dataset.boardDifficulty;refresh();}
  else if(b.hasAttribute('data-board-refresh'))refresh();
 });
 dialog.addEventListener('close',()=>{clearInterval(interval);requestId++;});
 return{
  open(){selected=getCurrentRun()?.difficultyId??selected;render();if(!dialog.open)dialog.showModal();refresh();clearInterval(interval);interval=setInterval(()=>{if(!document.hidden)refresh();},10000);},
  update(){if(dialog.open)refresh();},
 };
}
