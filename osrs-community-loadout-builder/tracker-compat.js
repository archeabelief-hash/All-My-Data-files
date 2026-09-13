(function(){
  const fmtNum=n=>Number.isFinite(Number(n))?Intl.NumberFormat('en-US',{notation:Math.abs(Number(n))>=1000000?'compact':'standard',maximumFractionDigits:2}).format(Number(n)):'—';
  const gpNum=n=>Number.isFinite(Number(n))?`${fmtNum(Number(n))} gp`:'—';
  const escText=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const total=o=>o&&typeof o==='object'?Object.values(o).reduce((a,v)=>a+(Number(v)||0),0):(Number(o)||0);
  const duration=ms=>{ms=Number(ms)||0;const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);return h?`${h}h ${m}m`:`${m}m ${s}s`};
  const bestSkill=o=>{if(!o||typeof o!=='object')return ['—',0];return Object.entries(o).sort((a,b)=>(Number(b[1])||0)-(Number(a[1])||0))[0]||['—',0]};

  window.renderSession=function(s){
    const xpMap=s.xpGained||s.xp_gained||{};
    const xpHrMap=s.xpPerHour||s.xp_per_hour||{};
    const xp=total(xpMap);
    const [bestName,bestRate]=bestSkill(xpHrMap);
    const loot=s.lootGp??s.lootValue??s.loot_value;
    const supplies=s.estimatedSupplyGp??s.supplyCost??s.supply_cost;
    const profit=s.netGp??s.netProfit??s.net_profit;
    const gpHr=s.profitPerHourGp??s.profitPerHour??s.profit_per_hour;
    const elapsed=s.elapsedMs??s.elapsed_ms;

    const q=id=>document.getElementById(id);
    if(q('trackerXpHr'))q('trackerXpHr').textContent=fmtNum(bestRate);
    if(q('trackerXpGain'))q('trackerXpGain').textContent=`${bestName}: ${fmtNum((xpMap||{})[bestName]||0)} XP · total ${fmtNum(xp)}`;
    if(q('trackerGpHr'))q('trackerGpHr').textContent=gpNum(gpHr);
    if(q('trackerProfit'))q('trackerProfit').textContent=`Net ${gpNum(profit)}`;
    if(q('trackerLoot'))q('trackerLoot').textContent=gpNum(loot);
    if(q('trackerSupplies'))q('trackerSupplies').textContent=`Supplies ${gpNum(supplies)}`;
    if(q('homeXpHr'))q('homeXpHr').textContent=fmtNum(bestRate);
    if(q('homeGpHr'))q('homeGpHr').textContent=gpNum(gpHr);
    if(q('homeLoot'))q('homeLoot').textContent=gpNum(loot);
    if(q('homeSession'))q('homeSession').textContent=duration(elapsed);

    const details=[
      ['Player',s.rsn],['Session',duration(elapsed)],['Best XP/hr',`${bestName} · ${fmtNum(bestRate)}`],['Total XP',fmtNum(xp)],['Loot events',s.npcLootEvents],['PvP loot events',s.playerLootEvents],['Gross loot',gpNum(loot)],['Supply estimate',gpNum(supplies)],['Net profit',gpNum(profit)],['Profit/hr',gpNum(gpHr)],['Updated',s.receivedAt?new Date(s.receivedAt).toLocaleTimeString():'now']
    ];
    if(q('sessionDetails'))q('sessionDetails').innerHTML=details.filter(x=>x[1]!=null).map(x=>`<div class="detail-line"><span>${escText(x[0])}</span><b>${escText(x[1])}</b></div>`).join('');

    const e=s.event||{};
    let drops=[];
    if(s.type==='loot'&&e.items&&typeof e.items==='object')drops=Object.entries(e.items).map(([name,qty])=>({name,qty,value:e.valueGp}));
    if(q('recentLoot'))q('recentLoot').innerHTML=drops.length?drops.map(d=>`<div class="loot-line"><span>${escText(d.name)} ×${d.qty}</span><b>${gpNum(d.value)}</b></div>`).join(''):'<div class="empty">Waiting for the next loot event.</div>';
  };
})();
