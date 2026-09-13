const $ = id => document.getElementById(id);
let currentPlayer = '';

function fmtGp(n){
  const v = Number(n||0);
  return new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(v)+' gp';
}
function fmtTime(ms){
  let s=Math.floor(Number(ms||0)/1000);const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);const sec=s%60;
  return [h,m,sec].map((x,i)=>i===0?String(x):String(x).padStart(2,'0')).join(':');
}
function renderXp(xpGained={},xpPerHour={}){
  const rows=Object.keys(xpGained).filter(k=>Number(xpGained[k])>0).sort((a,b)=>Number(xpGained[b])-Number(xpGained[a]));
  $('xpTable').innerHTML = rows.length ? rows.map(k=>`<div class="row"><span>${k}</span><span>+${Number(xpGained[k]).toLocaleString()}</span><span class="muted">${Number(xpPerHour[k]||0).toLocaleString()}/hr</span></div>`).join('') : '<div class="muted">No XP gained yet.</div>';
}
function render(s){
  if(!s)return;
  $('elapsed').textContent=fmtTime(s.elapsedMs);
  $('loot').textContent=fmtGp(s.lootGp);
  $('supplies').textContent=fmtGp(s.estimatedSupplyGp);
  $('net').textContent=fmtGp(s.netGp);
  $('gph').textContent=fmtGp(s.profitPerHourGp);
  $('kills').textContent=Number(s.npcLootEvents||0).toLocaleString();
  renderXp(s.xpGained,s.xpPerHour);
  $('latest').textContent=JSON.stringify({type:s.type,event:s.event||null,timestamp:s.timestamp},null,2);
}
async function refresh(){
  try{
    const r=await fetch('/api/live',{cache:'no-store'});const data=await r.json();
    $('status').textContent='Live';
    const players=(data.sessions||[]).map(x=>x.rsn).filter(Boolean);
    const select=$('playerSelect');
    if(!currentPlayer && players.length) currentPlayer=players[0];
    select.innerHTML=players.length?players.map(p=>`<option ${p===currentPlayer?'selected':''}>${p}</option>`).join(''):'<option>No active players</option>';
    const s=(data.sessions||[]).find(x=>x.rsn===currentPlayer)||(data.sessions||[])[0];
    if(s){currentPlayer=s.rsn;render(s)}
  }catch(e){$('status').textContent='Offline'}
}
$('playerSelect').addEventListener('change',e=>{currentPlayer=e.target.value;refresh()});
$('refreshBtn').addEventListener('click',refresh);
refresh();setInterval(refresh,2000);
