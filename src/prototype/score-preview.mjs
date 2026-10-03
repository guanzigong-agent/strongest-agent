// M4 flow preview: no real game, persistence, account, or score upload.
const root=document.querySelector('#score-preview');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+(n/1e6).toFixed(2)+'M';
const levels=[{id:'easy',name:'轻松',cash:30e6},{id:'standard',name:'标准',cash:10e6},{id:'challenge',name:'挑战',cash:5e6}];
const names=['风城猎手','禁区生意人','底薪淘金客','三分账本','转会观察员','板凳投资人'];
let teams=[],difficultyId='standard',teamId='1',nickname='',phase='setup',selected='standard',submission='pending',run=null,request=0;
const scores=new Map();
const level=id=>levels.find(d=>d.id===id);
const percent=(assets,id)=>'+'+((assets/level(id).cash-1)*100).toFixed(1)+'%';
function rows(){
 const list=[1.7,1.42,1.12,1.04,.97,.84].map((multiple,i)=>({id:`demo-${selected}-${i}`,name:`演示·${names[i]}`,assets:Math.round(level(selected).cash*multiple),day:30,demo:true}));
 const own=scores.get(selected);
 if(own)list.push({...own,id:'me',me:true});
 return list.sort((a,b)=>b.assets-a.assets||a.id.localeCompare(b.id));
}
function setup(){
 const difficulty=level(difficultyId);
 return `<section class="setup"><div class="score-intro"><span class="eyebrow">YOUR NAME. YOUR RECORD.</span><h1>留下名字，<br>让成绩有个归属。</h1><p class="lead">开局先填写游戏内昵称。结算后自动提交成绩，按难度分别排行。</p><div class="rule-pills"><span>轻松 / 标准 / 挑战</span><span>30天经营</span><span>结算自动入榜</span></div><p class="score-field-note">本次预览直接展示一份模拟的第30天结算，用于确认起名、提交和查看名次的操作。</p></div><form class="setup-card score-form" id="score-form" novalidate><span class="eyebrow">PLAYER PROFILE</span><h2>你想用什么名字上榜？</h2><label for="score-nickname">玩家昵称 <span class="up">必填</span></label><input id="score-nickname" maxlength="12" autocomplete="nickname" placeholder="例如：底薪淘金客" value="${esc(nickname)}" aria-describedby="score-name-note score-name-error"><p id="score-name-note" class="score-field-note">1～12个字，排行榜用这个名字展示成绩。</p><p id="score-name-error" class="score-name-error" role="alert"></p><div class="field-label">游戏难度 · 初始资金</div><div class="difficulty-options">${levels.map(d=>`<button type="button" data-preview-difficulty="${d.id}" aria-pressed="${d.id===difficultyId}" class="difficulty-option ${d.id===difficultyId?'selected':''}"><span>${d.name}</span><strong>${d.cash/1e4}万</strong><small>美元</small></button>`).join('')}</div><label for="score-team">开局球队</label><select id="score-team">${teams.map(t=>`<option value="${esc(t.id)}" ${t.id===teamId?'selected':''}>${esc(t.name)} · ${esc(t.abbr)}</option>`).join('')}</select><div class="sample-line"><span>初始现金</span><strong>${money(difficulty.cash)}</strong><small>各难度均可持有15人。</small></div><button type="submit" class="primary wide" data-preview-finish>查看结算演示 →</button><p class="score-field-note">本页不会开始正式游戏，也不会上传昵称或成绩。</p></form></section>`;
}
function result(){
 const difficulty=level(run.difficultyId),profit=run.assets-difficulty.cash;
 const list=rows(),rank=list.findIndex(r=>r.me)+1;
 const state=submission==='pending'?['正在提交成绩…','展示自动提交过程，当前没有发送任何网络请求。']:submission==='error'?['演示：提交失败','保留本局结算结果，重试后再展示入榜。']:['演示：成绩已显示在本页榜单',`${difficulty.name}排行榜第${rank}名。真实云端保存尚未接入，刷新本页会清空。`];
 return `<section class="result"><span class="eyebrow">SETTLEMENT PREVIEW / DAY 30</span><h1>${esc(run.name)}，<br>这一局值得留下。</h1><div class="score-context"><span>${difficulty.name}难度</span><span>初始${money(difficulty.cash)}</span><span>第30天结算</span></div><div class="big">${money(run.assets)}</div><strong class="up">净收益 +${money(profit)} · ${percent(run.assets,run.difficultyId)}</strong><div class="score-submit ${submission}" role="status"><strong>${state[0]}</strong><p>${state[1]}</p>${submission==='error'?'<button class="primary" data-preview-retry>重试提交（演示）</button>':''}</div><div class="score-actions"><button class="primary" data-preview-view ${submission==='success'?'':'disabled'}>查看${difficulty.name}排行榜 →</button><button data-preview-new>重新预览</button></div><p class="score-result-note">本局选${difficulty.name}难度，结算成绩保留在${difficulty.name}榜；其他难度不混排。</p><details class="score-demo-controls"><summary>演示提交异常</summary><div><button data-preview-fail>模拟提交失败</button><button data-preview-recover>恢复成功演示</button></div></details></section>`;
}
function board(){
 const list=rows(),own=list.findIndex(r=>r.me),my=list[own];
 return `<section class="score-panel"><div class="board-heading"><div><span class="eyebrow">YOUR RECORD / YOUR RANK</span><h2>${level(selected).name}排行榜</h2></div></div><div class="board-demo">M4界面预览 · 模拟玩家与本页演示成绩 · 尚未连接真实排行榜</div><div class="board-tabs">${levels.map(d=>`<button data-preview-board-difficulty="${d.id}" class="${selected===d.id?'selected':''}" aria-pressed="${selected===d.id}">${d.name}<small>初始${d.cash/1e4}万美元</small></button>`).join('')}</div><div class="board-columns"><span>排名 / 玩家</span><span>总资产</span></div><div class="board-list">${list.map((r,i)=>`<article class="board-row ${r.me?'is-me':''}" data-score-player="${r.id}"><div class="rank ${i<3?'top-rank':''}">${i+1}</div><div class="board-player"><strong>${esc(r.name)}${r.me?' <em>你</em>':''}</strong><small>已结算 · 第30天 · ${r.me?'本页演示成绩':'模拟玩家'}</small></div><div class="board-score"><strong>${money(r.assets)}</strong><small class="${r.assets>=level(selected).cash?'up':'down'}">${r.assets>=level(selected).cash?'+':'−'}${Math.abs((r.assets/level(selected).cash-1)*100).toFixed(1)}%</small></div></article>`).join('')}</div><div class="my-ranking">${my?`<span>我的成绩排名 <strong id="preview-rank">#${own+1}</strong></span><strong>${money(my.assets)}</strong>`:'<span>该难度暂无你的本页演示成绩。</span>'}</div><p class="board-rule">本局成绩只进入所选难度的榜，结算后保留记录。按总资产排序，不同难度分别排行。</p><div class="score-board-back"><p>本页成绩不会保存到公共排行榜。</p><button data-preview-back>${run?'返回结算':'返回起名'}</button></div></section>`;
}
function render(){
 document.querySelectorAll('[data-step]').forEach(el=>el.classList.toggle('active',el.dataset.step===phase));
 root.innerHTML=phase==='setup'?setup():phase==='result'?result():board();
}
async function submit(){
 const current=++request;submission='pending';render();
 await new Promise(resolve=>setTimeout(resolve,500));
 if(current!==request)return;
 scores.set(run.difficultyId,{...run});
 submission='success';selected=run.difficultyId;render();
}
root.addEventListener('input',event=>{if(event.target.id==='score-nickname')nickname=event.target.value;});
root.addEventListener('change',event=>{if(event.target.id==='score-team')teamId=event.target.value;});
root.addEventListener('submit',event=>{
 event.preventDefault();nickname=document.querySelector('#score-nickname').value.trim();
 if(!nickname){document.querySelector('#score-name-error').textContent='先起一个玩家昵称，再查看结算。';document.querySelector('#score-nickname').setAttribute('aria-invalid','true');document.querySelector('#score-nickname').focus();return;}
 run={name:nickname,difficultyId,assets:Math.round(level(difficultyId).cash*1.38),day:30};phase='result';selected=difficultyId;submit();
});
root.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||button.disabled)return;
 if(button.dataset.previewDifficulty){difficultyId=button.dataset.previewDifficulty;render();return;}
 if(button.dataset.previewBoardDifficulty){selected=button.dataset.previewBoardDifficulty;render();return;}
 if(button.hasAttribute('data-preview-view')){selected=run.difficultyId;phase='board';render();return;}
 if(button.hasAttribute('data-preview-new')){request++;run=null;phase='setup';render();return;}
 if(button.hasAttribute('data-preview-back')){phase=run?'result':'setup';render();return;}
 if(button.hasAttribute('data-preview-fail')){request++;scores.delete(run.difficultyId);submission='error';render();return;}
 if(button.hasAttribute('data-preview-retry')||button.hasAttribute('data-preview-recover'))submit();
});
document.querySelector('#preview-board').addEventListener('click',()=>{phase='board';selected=run?.difficultyId??difficultyId;render();});
try{
 const response=await fetch(new URL('./roster.json',import.meta.url));if(!response.ok)throw Error('球队名单读取失败');
 teams=(await response.json()).teams.sort((a,b)=>a.englishName.localeCompare(b.englishName,'en'));render();
}catch(error){root.innerHTML=`<div class="empty">${esc(error.message)}</div>`;}
