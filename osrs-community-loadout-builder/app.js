const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => Number.isFinite(Number(n)) ? Intl.NumberFormat('en-US',{notation:Math.abs(Number(n))>=1000000?'compact':'standard',maximumFractionDigits:2}).format(Number(n)) : '—';
const gp = n => Number.isFinite(Number(n)) ? `${fmt(Number(n))} gp` : '—';
const pct = n => !Number.isFinite(Number(n)) ? '—' : `${n>=0?'+':''}${n.toFixed(2)}%`;
const esc = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

// ---------- navigation ----------
function showTab(name){
  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  $$('.tab-page').forEach(p=>p.classList.toggle('active',p.id===`tab-${name}`));
  if(name==='market' && !market.loaded) loadMarket();
  if(name==='tracker') pollTracker();
  window.scrollTo({top:0,behavior:'smooth'});
}
$$('.tab').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
$$('.jump').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.target)));

// ---------- GE market ----------
const MARKET_BASE='https://prices.runescape.wiki/api/v1/osrs';
const market={mapping:[],latest:{},m5:{},h1:{},rows:[],loaded:false,selected:null,watch:new Set(JSON.parse(localStorage.getItem('esog-watchlist')||'[]'))};

async function marketFetch(path){
  const r=await fetch(`${MARKET_BASE}/${path}`,{headers:{'Accept':'application/json'}});
  if(!r.ok) throw new Error(`market ${r.status}`);
  return r.json();
}
async function loadMarket(){
  $('#marketStatus').innerHTML='<i></i> Updating';
  try{
    const [mapping,latest,m5,h1]=await Promise.all([marketFetch('mapping'),marketFetch('latest'),marketFetch('5m'),marketFetch('1h')]);
    market.mapping=mapping; market.latest=latest.data||{}; market.m5=m5.data||{}; market.h1=h1.data||{};
    market.rows=mapping.map(item=>{
      const id=String(item.id), l=market.latest[id]||{}, a=market.m5[id]||{}, h=market.h1[id]||{};
      const price=l.high ?? l.low ?? a.avgHighPrice ?? a.avgLowPrice ?? 0;
      const p5=changePct(a.avgLowPrice,a.avgHighPrice);
      const p1=changePct(h.avgLowPrice,h.avgHighPrice);
      const volume=(a.highPriceVolume||0)+(a.lowPriceVolume||0);
      return {...item,price,p5,p1,volume,latest:l,m5:a,h1:h};
    }).filter(x=>x.price>0);
    market.loaded=true;
    $('#trackedItems').textContent=fmt(market.rows.length);
    $('#leaderCount').textContent=fmt(market.rows.filter(x=>x.volume>0).length);
    $('#marketRefresh').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    $('#marketStatus').innerHTML='<i></i> Live prices';
    renderMarket(); renderWatchlist();
  }catch(e){
    $('#marketRows').innerHTML='<tr><td colspan="6" class="empty">Market feed unavailable right now. The app will retry when refreshed.</td></tr>';
    $('#marketStatus').textContent='Market offline';
  }
}
function changePct(low,high){if(!low||!high)return NaN; return ((high-low)/low)*100}
function renderMarket(){
  const q=$('#marketSearch').value.trim().toLowerCase(); const sort=$('#marketSort').value;
  let rows=market.rows.filter(x=>!q||x.name.toLowerCase().includes(q));
  const sorter={volume:(a,b)=>b.volume-a.volume,gain:(a,b)=>(b.p5||-999)-(a.p5||-999),loss:(a,b)=>(a.p5||999)-(b.p5||999),price:(a,b)=>b.price-a.price}[sort];
  rows.sort(sorter); rows=rows.slice(0,250);
  $('#marketRows').innerHTML=rows.map(x=>`<tr data-id="${x.id}"><td><span class="item-name">${esc(x.name)}</span><span class="item-id">#${x.id}</span></td><td>${gp(x.price)}</td><td class="${x.p5>=0?'pos':'neg'}">${pct(x.p5)}</td><td class="${x.p1>=0?'pos':'neg'}">${pct(x.p1)}</td><td>${fmt(x.volume)}</td><td><button class="star-btn ${market.watch.has(x.id)?'on':''}" data-star="${x.id}">★</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No matching items.</td></tr>';
  $$('#marketRows tr[data-id]').forEach(r=>r.addEventListener('click',e=>{if(e.target.dataset.star)return; openItem(r.dataset.id)}));
  $$('[data-star]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleWatch(b.dataset.star)}));
}
function toggleWatch(id){market.watch.has(id)?market.watch.delete(id):market.watch.add(id);localStorage.setItem('esog-watchlist',JSON.stringify([...market.watch]));renderMarket();renderWatchlist()}
function renderWatchlist(){
  const items=[...market.watch].map(id=>market.rows.find(x=>String(x.id)===String(id))).filter(Boolean);
  $('#watchlist').innerHTML=items.length?items.map(x=>`<div class="watch-item" data-watch-open="${x.id}"><b>${esc(x.name)}</b><span>${gp(x.price)} · <span class="${x.p5>=0?'pos':'neg'}">${pct(x.p5)}</span></span></div>`).join(''):'<div class="empty">Star items from the market to pin them here.</div>';
  $$('[data-watch-open]').forEach(x=>x.addEventListener('click',()=>openItem(x.dataset.watchOpen)));
}
async function openItem(id){
  const x=market.rows.find(r=>String(r.id)===String(id)); if(!x)return; market.selected=x;
  $('#itemDetail').innerHTML=`<div class="detail-title"><div><small class="eyebrow">GRAND EXCHANGE</small><h2>${esc(x.name)}</h2></div><button class="star-btn ${market.watch.has(x.id)?'on':''}" id="detailStar">★</button></div><div class="detail-price">${gp(x.price)}</div><div class="detail-sub">Buy limit ${x.limit?fmt(x.limit):'—'} · High alch ${x.highalch?gp(x.highalch):'—'}</div><canvas id="priceChart" class="detail-chart" width="600" height="220"></canvas><div class="detail-stats"><div class="detail-stat"><small>5m move</small><b class="${x.p5>=0?'pos':'neg'}">${pct(x.p5)}</b></div><div class="detail-stat"><small>1h move</small><b class="${x.p1>=0?'pos':'neg'}">${pct(x.p1)}</b></div><div class="detail-stat"><small>5m volume</small><b>${fmt(x.volume)}</b></div><div class="detail-stat"><small>Store value</small><b>${gp(x.value)}</b></div></div>`;
  $('#detailStar').onclick=()=>toggleWatch(x.id);
  try{const ts=await marketFetch(`timeseries?timestep=5m&id=${x.id}`);drawChart($('#priceChart'),(ts.data||[]).slice(-72).map(p=>p.avgHighPrice||p.avgLowPrice).filter(Boolean));}catch{drawChart($('#priceChart'),[])}
}
function drawChart(canvas,vals){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h); if(vals.length<2){c.fillStyle='#718178';c.font='24px sans-serif';c.fillText('Chart loading / unavailable',28,h/2);return}
  const min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;c.beginPath(); vals.forEach((v,i)=>{const x=16+i*(w-32)/(vals.length-1),y=h-18-(v-min)*(h-36)/range;i?c.lineTo(x,y):c.moveTo(x,y)});c.strokeStyle='#61d48b';c.lineWidth=4;c.stroke();
}
$('#marketSearch').addEventListener('input',renderMarket); $('#marketSort').addEventListener('change',renderMarket); $('#refreshMarket').addEventListener('click',loadMarket);

// ---------- tracker ----------
let trackerEndpoint=localStorage.getItem('esog-tracker-endpoint')||'http://127.0.0.1:8765';
$('#trackerEndpoint').value=trackerEndpoint;
$('#saveTrackerEndpoint').addEventListener('click',()=>{trackerEndpoint=$('#trackerEndpoint').value.trim().replace(/\/$/,'');localStorage.setItem('esog-tracker-endpoint',trackerEndpoint);pollTracker()});
async function pollTracker(){
  try{
    const r=await fetch(`${trackerEndpoint}/api/live`,{cache:'no-store'}); if(!r.ok)throw new Error(); const data=await r.json(); const s=(data.sessions||[])[0];
    $('#trackerStatus').textContent=s?`${s.rsn||'Tracker'} live`:'Tracker connected'; $('#trackerConnectionMessage').textContent=s?`Receiving ${s.rsn}'s current session.`:'Server connected. Waiting for RuneLite telemetry.';
    if(s) renderSession(s);
  }catch{$('#trackerStatus').textContent='Tracker offline';$('#trackerConnectionMessage').textContent='Could not reach companion server. Start it on the gaming PC and use that PC’s LAN address on your phone.'}
}
function renderSession(s){
  const xpHr=s.xpPerHour??s.xp_per_hour, gpHr=s.profitPerHour??s.profit_per_hour, loot=s.lootValue??s.loot_value, supplies=s.supplyCost??s.supply_cost, profit=s.netProfit??s.net_profit, xp=s.xpGained??s.xp_gained;
  $('#trackerXpHr').textContent=fmt(xpHr); $('#trackerXpGain').textContent=`XP gained ${fmt(xp)}`; $('#trackerGpHr').textContent=gp(gpHr); $('#trackerProfit').textContent=`Net ${gp(profit)}`; $('#trackerLoot').textContent=gp(loot); $('#trackerSupplies').textContent=`Supplies ${gp(supplies)}`;
  $('#homeXpHr').textContent=fmt(xpHr); $('#homeGpHr').textContent=gp(gpHr); $('#homeLoot').textContent=gp(loot); $('#homeSession').textContent=s.sessionDuration||s.duration||'Live';
  const details=[['Player',s.rsn],['Activity',s.activity||s.source||'Live session'],['Kills',s.kills],['XP gained',fmt(xp)],['Gross loot',gp(loot)],['Supply cost',gp(supplies)],['Net profit',gp(profit)],['Updated',s.receivedAt?new Date(s.receivedAt).toLocaleTimeString():'now']];
  $('#sessionDetails').innerHTML=details.filter(x=>x[1]!=null).map(x=>`<div class="detail-line"><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('');
  const drops=s.recentLoot||s.recent_loot||s.items||[]; $('#recentLoot').innerHTML=Array.isArray(drops)&&drops.length?drops.slice(-12).reverse().map(d=>`<div class="loot-line"><span>${esc(d.name||d.itemName||'Drop')} ×${d.quantity||d.qty||1}</span><b>${gp(d.value||d.geValue)}</b></div>`).join(''):'<div class="empty">Waiting for item drops.</div>';
}
setInterval(()=>{if($('#tab-tracker').classList.contains('active'))pollTracker()},2500);

// ---------- player + loadouts ----------
const skills=['attack','strength','defence','hitpoints','ranged','prayer','magic','slayer'];
const defaults={attack:1,strength:1,defence:1,hitpoints:10,ranged:1,prayer:1,magic:1,slayer:1}; let player={...defaults};
const activities={'anti-pk':['Revenants'],'pk':['Singles PK / Anti-PK'],'pvm':['King Black Dragon','Crazy Archaeologist','Chaos Fanatic','Scorpia','Barrows']};
const targets={
'Revenants':{requirements:[],notes:['Wilderness content: build for damage, survival and an escape route.'],gear:[{slot:'Weapon',choices:[{name:'Webweaver bow',req:{ranged:70},why:'Strong Revenant weapon and immediate anti-PK pressure.'},{name:'Rune crossbow',req:{ranged:61},why:'Low-cost fallback with enchanted bolt support.'}]},{slot:'KO switch',choices:[{name:'Dark bow',req:{ranged:60},why:'Simple ranged finisher.'}]},{slot:'Neck',choices:[{name:'Amulet of fury',req:{},why:'Balanced offence and defence.'}]},{slot:'Body',choices:[{name:"Black d'hide body",req:{ranged:70,defence:40},why:'Low-cost ranged and magic defence.'}]},{slot:'Ring',choices:[{name:'Lightbearer',req:{},why:'Faster special-attack regeneration.'}]}],inventory:[{name:'Looting bag',qty:1,why:'Loot storage.'},{name:'Ranging potion',qty:1,why:'Ranged boost.'},{name:'Prayer potion',qty:2,why:'Prayer sustain.'},{name:'Super restore',qty:1,why:'Restore drained stats and Prayer.'},{name:'High-healing food',qty:10,why:'Main sustain.'},{name:'Cooked karambwan',qty:7,why:'Combo healing.'},{name:'Escape teleport',qty:1,why:'Match it to Wilderness level.'}]},
'Singles PK / Anti-PK':{requirements:[],notes:['Single-way combat rewards prayer switching, combo eating and clean KO timing.'],gear:[{slot:'Main weapon',choices:[{name:'Webweaver bow',req:{ranged:70},why:'Fast ranged pressure.'},{name:'Magic shortbow (i)',req:{ranged:50},why:'Cheap pressure weapon.'}]},{slot:'Finisher',choices:[{name:'Dark bow',req:{ranged:60},why:'Ranged burst.'}]},{slot:'Ring',choices:[{name:'Lightbearer',req:{},why:'Faster spec regeneration.'}]}],inventory:[{name:'Ranging potion',qty:1,why:'Offensive boost.'},{name:'Prayer potion',qty:2,why:'Overheads.'},{name:'Super restore',qty:1,why:'Stat recovery.'},{name:'High-healing food',qty:11,why:'Sustain.'},{name:'Cooked karambwan',qty:8,why:'Combo healing.'},{name:'Escape teleport',qty:1,why:'Emergency escape.'}]},
'King Black Dragon':{requirements:[],notes:['The lair is safe from PvP, but the route crosses Wilderness. Bring dragonfire protection.'],gear:[{slot:'Weapon',choices:[{name:'Dragon crossbow',req:{ranged:64},why:'Solid ranged bossing.'},{name:'Rune crossbow',req:{ranged:61},why:'Cheap reliable option.'}]},{slot:'Shield',choices:[{name:'Anti-dragon shield',req:{},why:'Dragonfire protection.'}]}],inventory:[{name:'Antifire potion',qty:1,why:'Dragonfire mitigation.'},{name:'Ranging potion',qty:1,why:'Damage/accuracy.'},{name:'Prayer potion',qty:2,why:'Prayer sustain.'},{name:'High-healing food',qty:16,why:'Trip sustain.'}]},
'Crazy Archaeologist':{requirements:[],notes:['Wilderness boss: preserve an escape route.'],gear:[{slot:'Style',choices:[{name:'Ranged setup',req:{ranged:50},why:'Practical low-risk option.'}]}],inventory:[{name:'Prayer potion',qty:2,why:'Prayer.'},{name:'High-healing food',qty:18,why:'Survival.'}]},
'Chaos Fanatic':{requirements:[],notes:['Wilderness boss: route and escape planning matter.'],gear:[{slot:'Style',choices:[{name:'Ranged setup',req:{ranged:50},why:'Practical option.'}]}],inventory:[{name:'Prayer potion',qty:2,why:'Prayer.'},{name:'High-healing food',qty:18,why:'Survival.'}]},
'Scorpia':{requirements:[],notes:['Deep Wilderness boss: control risk and escape planning.'],gear:[{slot:'Style',choices:[{name:'Magic setup',req:{magic:60},why:'Useful style; exact spell depends on unlocks.'}]}],inventory:[{name:'Prayer potion',qty:3,why:'Prayer.'},{name:'High-healing food',qty:16,why:'Survival.'}]},
'Barrows':{requirements:['Priest in Peril to access Morytania'],notes:['Check quest access and weapon/spell requirements before gearing.'],gear:[{slot:'Main style',choices:[{name:'Magic setup',req:{magic:50},why:'Most brothers have low Magic defence.'},{name:'Ranged switch',req:{ranged:50},why:'Useful for Ahrim depending on stats.'}]}],inventory:[{name:'Prayer potion',qty:2,why:'Prayer.'},{name:'Food',qty:12,why:'General sustain.'}]}
};
function initPlayer(){const m=$('#manualStats');skills.forEach(s=>{const l=document.createElement('label');l.textContent=s[0].toUpperCase()+s.slice(1);const i=document.createElement('input');i.type='number';i.min=1;i.max=99;i.value=player[s];i.id=`stat-${s}`;i.onchange=()=>{player[s]=Math.max(1,Math.min(99,Number(i.value)||1));renderPlayer()};l.appendChild(i);m.appendChild(l)});$('#mode').onchange=loadTargets;$('#lookupBtn').onclick=lookup;$('#buildBtn').onclick=build;loadTargets()}
function loadTargets(){const sel=$('#target');sel.innerHTML='';activities[$('#mode').value].forEach(t=>sel.add(new Option(t,t)))}
async function lookup(){const username=$('#username').value.trim();if(!username){$('#lookupStatus').textContent='Enter a RuneScape name first.';return}$('#lookupStatus').textContent='Pulling player data…';try{const r=await fetch(`https://api.wiseoldman.net/v2/players/${encodeURIComponent(username)}`);if(!r.ok)throw 0;const data=await r.json(),snap=data.latestSnapshot||data.latest_snapshot||data,sk=(snap.data&&snap.data.skills)||snap.skills||{};skills.forEach(s=>{const raw=sk[s],lvl=raw?.level??raw?.metric?.level;if(Number.isFinite(lvl))player[s]=lvl});skills.forEach(s=>{const e=$(`#stat-${s}`);if(e)e.value=player[s]});renderPlayer(username);$('#lookupStatus').textContent='Profile loaded. Manual fields can override stale values.'}catch{renderPlayer(username);$('#lookupStatus').textContent='Live profile lookup failed. Manual stats are still available.'}}
function renderPlayer(name){const c=$('#playerCard');c.classList.remove('hidden');c.innerHTML=`<div class="panel-head"><div><small>PLAYER</small><h3>${esc(name||$('#username').value||'Player')}</h3></div></div><div class="statline">${skills.map(s=>`<span class="pill">${s} <b>${player[s]}</b></span>`).join('')}</div>`}
function meets(req){return Object.entries(req||{}).every(([k,v])=>(player[k]||1)>=v)}function reqText(req){const a=Object.entries(req||{});return a.length?a.map(([k,v])=>`${k[0].toUpperCase()+k.slice(1)} ${v}`).join(', '):'No stat requirement'}function choose(set){return set.find(c=>meets(c.req))||set[set.length-1]}
function build(){skills.forEach(s=>{const e=$(`#stat-${s}`);if(e)player[s]=Math.max(1,Math.min(99,Number(e.value)||1))});const t=targets[$('#target').value],r=$('#results');r.classList.remove('hidden');const gear=t.gear.map(g=>{const c=choose(g.choices),ok=meets(c.req);return `<div class="item"><b>${esc(g.slot)}: ${esc(c.name)}</b><small>${esc(c.why)}</small><div class="${ok?'req-ok':'req-bad'}">${ok?'✓':'✕'} ${esc(reqText(c.req))}</div></div>`}).join('');const inv=t.inventory.map(i=>`<div class="item"><b>${i.qty}× ${esc(i.name)}</b><small>${esc(i.why)}</small></div>`).join('');r.innerHTML=`<section class="cards"><div class="panel"><div class="panel-head"><div><small>GEAR</small><h3>Recommended setup</h3></div></div><div class="gear-grid">${gear}</div></div><div class="panel"><div class="panel-head"><div><small>INVENTORY</small><h3>Trip core</h3></div></div><div class="inv-grid">${inv}</div></div></section><section class="panel"><div class="panel-head"><div><small>ACCESS</small><h3>Requirements & notes</h3></div></div><ul>${(t.requirements||[]).length?t.requirements.map(x=>`<li>${esc(x)}</li>`).join(''):'<li>No quest requirement recorded in the current dataset.</li>'}</ul>${t.notes.map(n=>`<p class="warning">${esc(n)}</p>`).join('')}<p class="muted">Always verify Items Kept on Death before entering the Wilderness.</p></section>`}

initPlayer();
