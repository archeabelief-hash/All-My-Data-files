const skills = ["attack","strength","defence","hitpoints","ranged","prayer","magic","slayer"];
const defaults = {attack:1,strength:1,defence:1,hitpoints:10,ranged:1,prayer:1,magic:1,slayer:1};
let player = {...defaults};

const activities = {
  "anti-pk": ["Revenants"],
  "pk": ["Singles PK / Anti-PK"],
  "pvm": ["King Black Dragon","Crazy Archaeologist","Chaos Fanatic","Scorpia","Barrows"]
};

const targets = {
  "Revenants": {
    mode:"anti-pk",
    requirements:[],
    notes:["Revenant caves are Wilderness content. Build for both damage and survival.","Normal teleports are restricted by Wilderness level; carry an escape method appropriate to where you fight."],
    gear:[
      {slot:"Weapon",choices:[
        {name:"Webweaver bow",req:{ranged:70},why:"Excellent Revenant weapon and still usable immediately against a PKer."},
        {name:"Rune crossbow",req:{ranged:61},why:"Cheap one-handed fallback that supports enchanted bolts."}
      ]},
      {slot:"KO switch",choices:[{name:"Dark bow",req:{ranged:60},why:"Simple one-switch ranged finisher with dragon arrows."}]},
      {slot:"Neck",choices:[{name:"Amulet of fury",req:{},why:"Balanced offensive and defensive stats for anti-PK survival."},{name:"Amulet of glory",req:{},why:"Cheaper alternative with useful Wilderness teleport utility when usable."}]},
      {slot:"Body",choices:[{name:"Black d'hide body",req:{ranged:70,defence:40},why:"Strong ranged accuracy and magic defence for low cost."}]},
      {slot:"Legs",choices:[{name:"Black d'hide chaps",req:{ranged:70},why:"Cheap ranged offence and magic defence."}]},
      {slot:"Ring",choices:[{name:"Lightbearer",req:{},why:"Doubles natural special-attack regeneration rate, useful when relying on specs."},{name:"Ring of recoil",req:{},why:"Cheap passive damage while tanking."}]}
    ],
    inventory:[
      {name:"Looting bag",qty:1,why:"Keeps loot out of the main inventory."},
      {name:"Ranging potion",qty:1,why:"No self-damage; easier to maintain a safe HP buffer than a divine potion."},
      {name:"Prayer potion",qty:2,why:"Immediate prayer restoration during sustained fights."},
      {name:"Super restore",qty:1,why:"Restores Prayer and drained combat stats."},
      {name:"Marlin",qty:5,why:"24 HP single-bite healing; high emergency healing per slot."},
      {name:"Cooked karambwan",qty:6,why:"18 HP combo food for fast burst healing."},
      {name:"Anglerfish",qty:2,why:"Pre-eat/overheal when your HP level allows an effective boost."},
      {name:"Manta ray",qty:5,why:"Reliable 22 HP standard food."},
      {name:"Teleport / escape item",qty:1,why:"Choose based on your Wilderness level and route."},
      {name:"Dragon arrows",qty:50,why:"Ammo for Dark bow finisher."}
    ]
  },
  "Singles PK / Anti-PK": {
    mode:"pk", requirements:[],
    notes:["Single-way combat rewards clean prayer switching, combo eating, and simple KO timing."],
    gear:[
      {slot:"Main ranged weapon",choices:[{name:"Webweaver bow",req:{ranged:70},why:"Fast pressure with minimal switching."},{name:"Magic shortbow (i)",req:{ranged:50},why:"Cheap pressure weapon with a useful spec."}]},
      {slot:"Finisher",choices:[{name:"Dark bow",req:{ranged:60},why:"Heavy ranged burst from a single switch."}]},
      {slot:"Ring",choices:[{name:"Lightbearer",req:{},why:"Faster special-attack regeneration."}]}
    ],
    inventory:[
      {name:"Ranging potion",qty:1,why:"Offensive boost without divine self-damage."},
      {name:"Prayer potion",qty:2,why:"Keep overheads active."},
      {name:"Super restore",qty:1,why:"Recover drained stats and Prayer."},
      {name:"Marlin",qty:6,why:"24 HP main food."},
      {name:"Cooked karambwan",qty:7,why:"Fast combo healing."},
      {name:"Manta ray",qty:5,why:"Reliable standard food."},
      {name:"Escape teleport",qty:1,why:"Do not rely on one that fails at your Wilderness level."}
    ]
  },
  "King Black Dragon": {
    mode:"pvm", requirements:[],
    notes:["The KBD lair itself is not Wilderness PvP, but reaching it crosses the Wilderness.","Bring dragonfire protection appropriate to your setup."],
    gear:[
      {slot:"Weapon",choices:[{name:"Dragon crossbow",req:{ranged:64},why:"Solid ranged bossing option if owned."},{name:"Rune crossbow",req:{ranged:61},why:"Cheap reliable option."}]},
      {slot:"Shield",choices:[{name:"Anti-dragon shield",req:{},why:"Core dragonfire protection option."}]}
    ],
    inventory:[
      {name:"Antifire potion",qty:1,why:"Dragonfire mitigation."},
      {name:"Ranging potion",qty:1,why:"Damage/accuracy boost."},
      {name:"Prayer potion",qty:2,why:"Prayer sustain."},
      {name:"High-healing food",qty:16,why:"Fill remaining space after teleports and supplies."}
    ]
  },
  "Crazy Archaeologist": {mode:"pvm",requirements:[],notes:["Wilderness boss: keep risk controlled and preserve an escape route."],gear:[{slot:"Style",choices:[{name:"Ranged setup",req:{ranged:50},why:"Simple low-risk option."}]}],inventory:[{name:"Prayer potion",qty:2,why:"Sustain protection prayer."},{name:"High-healing food",qty:18,why:"Tank boss damage and possible PK pressure."}]},
  "Chaos Fanatic": {mode:"pvm",requirements:[],notes:["Wilderness boss: travel and escape planning matter as much as DPS."],gear:[{slot:"Style",choices:[{name:"Ranged setup",req:{ranged:50},why:"Practical low-risk option."}]}],inventory:[{name:"Prayer potion",qty:2,why:"Sustain prayer."},{name:"High-healing food",qty:18,why:"Survival reserve."}]},
  "Scorpia": {mode:"pvm",requirements:[],notes:["Deep Wilderness boss. Escape options are limited; prioritize low risk and route knowledge."],gear:[{slot:"Style",choices:[{name:"Magic setup",req:{magic:60},why:"Commonly useful against Scorpia; exact spell choice depends on unlocks."}]}],inventory:[{name:"Prayer potion",qty:3,why:"Longer prayer sustain."},{name:"High-healing food",qty:16,why:"Boss plus PK survival."}]},
  "Barrows": {mode:"pvm",requirements:["Priest in Peril to access Morytania"],notes:["Quest access matters more than raw stats here. Check spell/weapon requirements before gearing."],gear:[{slot:"Main style",choices:[{name:"Magic setup",req:{magic:50},why:"Most brothers have low Magic defence."},{name:"Ranged switch",req:{ranged:50},why:"Useful for Ahrim depending on your stats."}]}],inventory:[{name:"Prayer potion",qty:2,why:"Prayer sustain depending on route."},{name:"Food",qty:12,why:"General sustain."}]}
};

function meets(req){return Object.entries(req||{}).every(([k,v]) => (player[k]||1) >= v)}
function reqText(req){const e=Object.entries(req||{}); return e.length?e.map(([k,v])=>`${k[0].toUpperCase()+k.slice(1)} ${v}`).join(", "):"No stat requirement"}

function init(){
  const manual=document.getElementById('manualStats');
  skills.forEach(s=>{const l=document.createElement('label');l.textContent=s[0].toUpperCase()+s.slice(1);const i=document.createElement('input');i.type='number';i.min=1;i.max=99;i.value=player[s];i.id=`stat-${s}`;i.addEventListener('change',()=>{player[s]=Math.max(1,Math.min(99,Number(i.value)||1));renderPlayer()});l.appendChild(i);manual.appendChild(l)});
  document.getElementById('mode').addEventListener('change',loadTargets);
  document.getElementById('lookupBtn').addEventListener('click',lookup);
  document.getElementById('buildBtn').addEventListener('click',build);
  loadTargets();
}

function loadTargets(){const mode=document.getElementById('mode').value;const sel=document.getElementById('target');sel.innerHTML='';activities[mode].forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;sel.appendChild(o)})}

async function lookup(){
  const username=document.getElementById('username').value.trim();
  const status=document.getElementById('lookupStatus');
  if(!username){status.textContent='Enter a RuneScape name first.';return}
  status.textContent='Looking up stats…';
  try{
    const r=await fetch(`https://api.wiseoldman.net/v2/players/${encodeURIComponent(username)}`);
    if(!r.ok) throw new Error('not tracked');
    const data=await r.json();
    const snap=data.latestSnapshot||data.latest_snapshot||data;
    const sk=(snap.data&&snap.data.skills)||snap.skills||{};
    skills.forEach(s=>{const raw=sk[s];const lvl=raw?.level ?? raw?.metric?.level; if(Number.isFinite(lvl)) player[s]=lvl});
    syncInputs(); renderPlayer(username); status.textContent='Stats loaded. Review manual stats if anything looks stale.';
  }catch(e){
    status.textContent='Could not pull a current profile. Enter/correct stats manually and the builder will still work.';
    renderPlayer(username);
  }
}

function syncInputs(){skills.forEach(s=>{const el=document.getElementById(`stat-${s}`);if(el)el.value=player[s]})}
function renderPlayer(name){const card=document.getElementById('playerCard');card.classList.remove('hidden');card.innerHTML=`<h2>${name||document.getElementById('username').value||'Player'}</h2><div class="statline">${skills.map(s=>`<span class="pill">${s}: <b>${player[s]}</b></span>`).join('')}</div>`}

function choose(choiceSet){return choiceSet.find(c=>meets(c.req))||choiceSet[choiceSet.length-1]}
function build(){
  skills.forEach(s=>{const el=document.getElementById(`stat-${s}`);if(el)player[s]=Math.max(1,Math.min(99,Number(el.value)||1))});
  renderPlayer();
  const targetName=document.getElementById('target').value;const t=targets[targetName];const results=document.getElementById('results');results.classList.remove('hidden');
  const gear=t.gear.map(g=>{const c=choose(g.choices);const ok=meets(c.req);return `<div class="item"><b>${g.slot}: ${c.name}</b><small>${c.why}</small><div class="${ok?'req-ok':'req-bad'}">${ok?'✓':'✕'} ${reqText(c.req)}</div></div>`}).join('');
  const inv=t.inventory.map(i=>`<div class="item"><b>${i.qty}× ${i.name}</b><small>${i.why}</small></div>`).join('');
  const reqs=(t.requirements||[]).length?t.requirements.map(r=>`<li>${r}</li>`).join(''):'<li>No quest requirement recorded for this target in the current dataset.</li>';
  results.innerHTML=`<section class="cards"><div class="panel card"><h3>Recommended gear</h3><div class="gear-grid">${gear}</div></div><div class="panel card"><h3>Inventory core</h3><div class="inv-grid">${inv}</div></div></section><section class="panel"><h3>Access & requirements</h3><ul>${reqs}</ul><h3>Fight notes</h3>${t.notes.map(n=>`<p class="warning">${n}</p>`).join('')}<p><b>Important:</b> this is a requirements-aware community planner, not a death-risk calculator yet. Always check the in-game Items Kept on Death interface before entering the Wilderness.</p></section>`;
}

init();
