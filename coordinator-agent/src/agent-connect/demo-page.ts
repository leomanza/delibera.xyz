/**
 * demo-page.ts — self-contained treasury-agent UI for the Agent Connect demo.
 * Served by the coordinator. Talks only to /agent-connect/demo/* — no keys in
 * the browser.
 *
 * Transparency goals: every step renders its API receipt (endpoint,
 * idempotency key, status lifecycle incl. UNCERTAIN, provider, correlation id,
 * explorer link). The owner's NEP-413 signature is shown, not hidden. The 403
 * bite shows its full anatomy. Final screen is a copyable evidence receipt.
 */

export const DEMO_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Confidential Second Opinion — a wallet that can only buy a second opinion</title>
<style>
  :root { color-scheme: dark; --bg:#0b0d10; --panel:#131619; --panel2:#16191d; --line:#262b31; --ink:#e8e6e1; --mut:#9a968c; --dim:#6e6a62; --acc:#c8f560; --priv:#a78bfa; --bad:#ff6b6b; --amb:#ffc861; }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.5 ui-sans-serif, system-ui, sans-serif; background:var(--bg); color:var(--ink); }
  a { color:var(--acc); text-decoration:none; } a:hover { text-decoration:underline; }
  .wrap { display:grid; grid-template-columns: 1fr 340px; gap:20px; max-width:1120px; margin:0 auto; padding:28px 18px 90px; }
  @media (max-width: 980px){ .wrap { grid-template-columns: 1fr; } .rail { position:static; } }
  h1 { font-size:20px; font-weight:650; margin:0 0 2px; letter-spacing:-.2px; }
  .sub { color:var(--mut); margin:0 0 14px; font-size:13px; }
  .bar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
  .chip { border:1px solid var(--line); border-radius:99px; padding:3px 10px; font-size:11px; color:var(--mut); background:var(--panel); }
  .chip.ok { color:var(--acc); border-color:#3d4a24; }
  .chip.warn { color:var(--amb); border-color:#4a3d1c; }
  .roles { display:flex; gap:8px; margin-bottom:18px; }
  .role { flex:1; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:8px 10px; font-size:12px; }
  .role b { display:block; font-size:10px; letter-spacing:1px; color:var(--dim); text-transform:uppercase; }
  .steps { display:flex; gap:6px; margin:0 0 16px; }
  .st { flex:1; text-align:center; font-size:11px; color:var(--dim); border:1px solid var(--line); border-radius:8px; padding:6px 4px; background:var(--panel); }
  .st.on { color:var(--acc); border-color:#3d4a24; }
  .st.done { color:var(--ink); border-color:#3a3d44; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin:0 0 12px; }
  .card h3 { margin:0 0 8px; font-size:14px; }
  .muted { color:var(--mut); font-size:12.5px; }
  .dim { color:var(--dim); font-size:12px; }
  button { font:inherit; background:var(--acc); color:#10130a; border:0; border-radius:9px; padding:9px 15px; font-weight:650; cursor:pointer; }
  button.ghost { background:transparent; color:var(--ink); border:1px solid #3a3d44; font-weight:500; }
  button:disabled { opacity:.4; cursor:wait; }
  textarea { width:100%; min-height:88px; background:var(--panel2); color:var(--ink); border:1px solid var(--line); border-radius:10px; padding:11px; resize:vertical; font:inherit; }
  .row { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
  .preset { font-size:11.5px; }
  .trace { border:1px solid var(--line); border-radius:10px; background:var(--panel2); padding:10px 12px; margin:10px 0; font-size:12px; }
  .trace .api { display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-family:ui-monospace, monospace; font-size:11.5px; }
  .m { color:#0c0d10; background:var(--acc); border-radius:5px; padding:1px 6px; font-weight:700; }
  .path { color:var(--ink); word-break:break-all; }
  .keyrow { color:var(--dim); font-family:ui-monospace, monospace; font-size:11px; margin-top:4px; word-break:break-all; }
  .statuses { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; }
  .stat { font-family:ui-monospace, monospace; font-size:10.5px; border:1px solid var(--line); border-radius:6px; padding:2px 8px; color:var(--mut); }
  .stat.SUCCESS, .stat.APPLIED, .stat.PROVIDER_POLICY_SYNCED { color:var(--acc); border-color:#3d4a24; }
  .stat.UNCERTAIN { color:var(--amb); border-color:#4a3d1c; }
  .mono { font-family:ui-monospace, monospace; font-size:11px; color:var(--mut); word-break:break-all; }
  .pill { display:inline-block; border:1px solid #3a3d44; border-radius:99px; padding:1px 8px; font-size:10.5px; color:var(--mut); }
  .pill.priv { color:var(--priv); border-color:#3b2f55; }
  .pill.src { color:var(--amb); border-color:#4a3d1c; }
  .lanes { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:10px; }
  .tierset { border:1px solid var(--line); border-radius:10px; background:var(--panel2); padding:9px 11px; margin:8px 0; font-size:12px; }
  .tierset label { display:block; margin-top:6px; cursor:pointer; }
  .tierset input { accent-color:var(--acc); margin-right:6px; }
  .ok { color:var(--acc); }
  .lane { border:1px solid var(--line); border-radius:10px; padding:9px 10px; font-size:12px; background:var(--panel2); }
  .lane .who { font-family:ui-monospace, monospace; font-size:10px; color:var(--dim); word-break:break-all; }
  .vote { font-weight:700; margin-top:2px; }
  .vote.approved { color:var(--acc); } .vote.rejected { color:var(--bad); }
  .ok { color:var(--acc); } .bad { color:var(--bad); }
  .spin { color:var(--acc); font-size:15px; letter-spacing:3px; }
  .rail { position:sticky; top:16px; align-self:start; }
  .railcard { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:12px; }
  .railcard h4 { margin:0 0 6px; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:var(--dim); }
  .kv { display:grid; grid-template-columns:auto 1fr; gap:3px 10px; font-size:12px; }
  .kv .k { color:var(--dim); }
  .dst { font-size:11.5px; margin:2px 0; padding-left:10px; border-left:2px solid var(--line); }
  .dst.fresh { border-color:var(--acc); }
  .sigbox { border:1px dashed #4a3d1c; border-radius:10px; padding:10px 12px; margin:10px 0; font-family:ui-monospace,monospace; font-size:11px; color:var(--amb); white-space:pre-wrap; word-break:break-all; }
  .copy { border:1px solid #3a3d44; background:transparent; color:var(--mut); border-radius:6px; font-size:10px; padding:2px 7px; cursor:pointer; margin-left:6px; }
  .copy:hover { color:var(--ink); }
</style>
</head>
<body>
<div class="wrap">
  <main id="main">
    <h1>Agents buy their own second opinions — privately.</h1>
    <p class="sub">Confidential Second Opinion — a wallet whose only autonomous power is buying a second opinion, on NEAR Agent Connect. A wallet whose only autonomous power is buying a confidential verdict from a 3-juror AI council; everything else waits for the owner's signature. Receipts on-chain, opinions sealed. Verifiable receipts on the right.</p>
    <div class="bar" id="chips"><span class="chip">booting…</span></div>
    <div class="roles" id="roles"></div>
    <div class="steps" id="steps">
      <div class="st on" id="st1">1 · Request</div>
      <div class="st" id="st2">2 · Buy verdict</div>
      <div class="st" id="st3">3 · Verdict</div>
      <div class="st" id="st4">4 · Owner gate</div>
      <div class="st" id="st5">5 · Receipt</div>
    </div>
    <div id="app"></div>
  </main>
  <aside class="rail">
    <div class="railcard" id="policyCard"><h4>Owner-signed policy</h4><div class="muted">…</div></div>
    <div class="railcard" id="balCard"><h4>Agent wallet</h4><div class="muted">…</div></div>
    <div class="railcard" id="evCard"><h4>Verifiable receipts</h4><div class="muted">—</div></div>
    <!-- honesty card (removed at user request) — badges data still served by /demo/session -->
  </aside>
</div>
<script>
var $=function(i){ return document.getElementById(i); };
var esc=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var COPYSTORE=[];
function copyText(i){ var t=COPYSTORE[i]; if(t&&navigator.clipboard) navigator.clipboard.writeText(t); }
function stash(t){ COPYSTORE.push(t); return COPYSTORE.length-1; }

var S={ sessionId:null, mode:null, events:[], verdict:null, policy:null, balances:null, agent:null, vendors:null, presets:[] };
function setStep(n){ for(var i=1;i<=5;i++){ var el=$('st'+i); if(!el) continue; el.className='st'+(i===n?' on':(i<n?' done':'')); } }
async function api(path,opts){
  var r=await fetch('/second-opinion'+path,opts);
  var b=await r.json().catch(function(){ return {}; });
  if(!r.ok&&r.status!==202&&r.status!==409){
    var msg=(b.errors&&b.errors[0]&&b.errors[0].code)||b.error||b.message||String(r.status);
    throw new Error(msg);
  }
  return b;
}

function trace(ev){
  var a=ev.api||{};
  var out='<div class="trace"><div class="api"><span class="m">'+esc(a.method||'GET')+'</span><span class="path">'+esc(a.path||'')+'</span>';
  if(a.idempotencyKey) out+='<span class="pill">Idem-Key</span>';
  if(ev.provider) out+='<span class="pill">provider · '+esc(ev.provider)+'</span>';
  var idx=stash(JSON.stringify(ev,null,2));
  out+=' <button class="copy" onclick="copyText('+idx+')">copy</button></div>';
  if(a.idempotencyKey) out+='<div class="keyrow">Idempotency-Key: '+esc(a.idempotencyKey)+'</div>';
  var sts=ev.statuses||[];
  if(sts.length){ out+='<div class="statuses">'; for(var i=0;i<sts.length;i++){ var s=sts[i]; out+='<span class="stat '+esc(s.status)+'">'+esc(s.status)+(s.label?' · '+esc(s.label):'')+' · '+esc(String(s.at||'').slice(0,19))+'</span>'; } out+='</div>'; }
  if(ev.correlationId){ var ci=stash(ev.correlationId); out+='<div class="keyrow">correlation_id: '+esc(ev.correlationId)+' <button class="copy" onclick="copyText('+ci+')">copy</button></div>'; }
  if(ev.intentHash) out+='<div class="keyrow">intent_hash: '+esc(ev.intentHash)+'</div>';
  if(ev.explorer) out+='<div class="keyrow">verify: <a href="'+esc(ev.explorer)+'" target="_blank">'+esc(ev.explorer.replace('https://',''))+'</a></div>';
  if(ev.code && ev.code!=='uncertain') out+='<div class="keyrow">'+esc(ev.code)+'</div>';
  if(ev.layer) out+='<div class="keyrow">layer: '+esc(ev.layer)+'</div>';
  if(ev.note) out+='<div class="muted" style="margin-top:6px">'+esc(ev.note)+'</div>';
  return out+'</div>';
}

function renderRail(){
  var p=S.policy||{};
  var list=(p.destinations&&p.destinations.list)||[];
  if(p.destinationsAdded&&S.vendors) list=list.concat(S.vendors);
  var dst='';
  for(var i=0;i<(list.length||0);i++){
    var d=list[i];
    var addr=esc(typeof d==='string'?d:(d.address||String(d)));
    var isConf=!(typeof d==='string')&&d.confidential!==false&&d.confidential!==undefined;
    var confPill=typeof d==='string'?' <span class="pill">non-confidential vendor</span>':(isConf?' <span class="pill priv">confidential</span>':' <span class="pill">non-confidential vendor</span>');
    dst+='<div class="dst">'+addr+confPill+'</div>';
  }
  var cap=(p.limits&&p.limits.per_transaction)?(p.limits.per_transaction[Object.keys(p.limits.per_transaction)[0]]):null;
  var daily=(p.usage&&p.usage.budget&&p.usage.budget.daily)?p.usage.budget.daily:null;
  var dl=daily?Number(daily.limitUsd!=null?daily.limitUsd:(daily.limit_usd!=null?daily.limit_usd:daily.limit)):NaN;
  var ds=daily?Number(daily.spentUsd!=null?daily.spentUsd:(daily.spent_usd!=null?daily.spent_usd:daily.spent)):NaN;
  $('policyCard').innerHTML='<h4>Owner-signed policy</h4><div class="kv">'
    +'<span class="k">revision</span><span>'+esc(p.revision||'—')+' <span class="pill">hash '+(p.policy_hash?esc(String(p.policy_hash).slice(0,10))+'…':'—')+'</span></span>'
    +'<span class="k">status</span><span>'+esc(p.status||'—')+(p.provider_policy_synced===true?' <span class="stat PROVIDER_POLICY_SYNCED">synced</span>':'')+'</span>'
    +'<span class="k">asset</span><span>USDC '+esc((((p.assets||[])[0])||'').replace('nep141:','').slice(0,10))+'…</span>'
    +'<span class="k">per-tx cap</span><span>'+(cap!=null&&isFinite(Number(cap))?'$'+(Number(cap)/1e6).toFixed(2):'—')+'</span>'
    +'<span class="k">daily budget</span><span>'+(isFinite(dl)?('$'+dl.toFixed(2)+' · spent $'+ds.toFixed(4)):'—')+'</span>'
    +'<span class="k">actions</span><span>'+esc((p.actions||['transfer']).join(', '))+(p.confidential?' <span class="pill priv">confidential</span>':'')+'</span>'
    +'</div><div class="muted" style="margin-top:6px">destinations ('+(p.destinations&&p.destinations.mode||'only')+'): '+dst+'</div>';
  var b=S.balances||{};
  var publicBal=(b.public&&b.public[0])||null, confBal=(b.confidential&&b.confidential[0])||null;
  $('balCard').innerHTML='<h4>Agent wallet</h4><div class="kv">'
    +'<span class="k">public USDC</span><span>'+(publicBal?('$'+(Number(publicBal.balance_raw||0)/1e6).toFixed(2)):'—')+'</span>'
    +'<span class="k">confidential</span><span>'+(confBal?('$'+(Number(confBal.balance_raw||0)/1e6).toFixed(2)):'$0.00')+' <span class="pill priv">invisible on-chain</span></span>'
    +'<span class="k">account</span><span class="mono">'+esc(String((S.agent&&S.agent.nearAccountId)||'').slice(0,18))+'…</span>'
    +'</div>';
  var evs=S.events.filter(function(e){ return e.explorer||e.correlationId; }).slice(-5);
  var list2=evs.map(function(e){ return '<div class="muted" style="margin:2px 0">· <span class="mono">'+esc(String(e.correlationId||'').slice(0,22))+'…</span> '+(e.explorer?('<a target="_blank" href="'+esc(e.explorer)+'">explorer</a>'):'')+'</div>'; }).join('');
  $('evCard').innerHTML='<h4>Verifiable receipts</h4>'+(list2||'<div class="dim">none yet — they appear as the agent moves</div>');
  // honesty card removed — badges still available at /demo/session
  // $('badges').innerHTML=(S.badges||[]).map(function(t){ var s=(t&&t.chip)||t; return '<div style="margin:4px 0">'+esc(s)+'</div>'; }).join('');
}

async function boot(){
  var d=await api('/demo/session',{method:'POST'});
  S.sessionId=d.sessionId; S.mode=d.mode; S.badges=d.badges; S.presets=d.presets||[]; S.balances=d.balances; S.agent=d.agent;
  S.policy=d.policy||{};
  var chips=(d.badges||[]);
  var modeLabel=(d.mode==='live')?'LIVE':((d.mode==='replay')?'fixtures':'mock');
  $('chips').innerHTML='<span class="chip '+((d.mode==='live')?'ok':'')+'">'+esc(modeLabel)+'</span>'
    +(d.mode==='replay'?'<span class="dim" style="font-size:10.5px">full real run: restart the server without AGENT_CONNECT_FIXTURES</span>':'');
  var roles='';
  for(var j=0;j<(d.roles||[]).length;j++){ roles+='<div class="role"><b>'+esc(d.roles[j].role)+'</b>'+esc(d.roles[j].who)+'</div>'; }
  $('roles').innerHTML=roles;
  renderRail(); setStep(1);
  var presets='';
  for(var k=0;k<S.presets.length;k++){ presets+='<button class="ghost preset" data-p="'+S.presets[k].id+'">'+esc(S.presets[k].label)+'</button>'; }
  $('app').innerHTML='<div class="card"><h3>Request a spend</h3>'
    +'<p class="muted">This demo stages a treasury desk (Roles: Requestor agent · Council · Finance) — the same gate fits procurement, payout clearances, security triage, milestone grants. Write the proposal; the agent buys the private verdict itself — its only autonomous spend.</p>'
    +'<div class="tierset"><b>Verdict disclosure</b> <span class="dim">(jurors see the mode before voting)</span><br>'
    +'<label><input type="radio" name="disc" value="attested" checked> <b>attested</b> · tally + per-juror vote &amp; reasoning released to the owner (hash-verified on-chain)</label>'
    +'<label><input type="radio" name="disc" value="sealed"> <b>sealed</b> · tally + on-chain commitments only (DIDs + result hashes pre-date the tally)</label></div>'
    +'<textarea id="proposal" placeholder="grant milestone payout / contractor invoice / anonymous transfer…"></textarea>'
    +'<div class="row">'+presets+'<button id="go">Ask the council ($0.01)</button></div></div>';
  var btns=document.querySelectorAll('button[data-p]');
  for(var m=0;m<btns.length;m++){ (function(btn){
    btn.addEventListener('click',function(){
      var id=btn.getAttribute('data-p');
      for(var n=0;n<S.presets.length;n++){
        if(String(S.presets[n].id)===id){ $('proposal').value=S.presets[n].text==null?S.presets[n]:S.presets[n].text; return; }
      }
    });
  })(btns[m]); }
  $('go').addEventListener('click',function(){ propose($('proposal').value); });
}

async function propose(proposal){
  if(!proposal||proposal.length<10){ alert('write the proposal (min 10 chars)'); return; }
  var disc='attested';
  var rs=document.querySelectorAll('input[name="disc"]');
  for(var z=0;z<rs.length;z++){ if(rs[z].checked) disc=rs[z].value; }
  S.disclosure=disc;
  var go=$('go'); go.disabled=true; go.textContent='Buying verdict…';
  var d=await api('/demo/'+S.sessionId+'/propose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({proposal:proposal,disclosure:disc})});
  S.events=d.events||[];
  setStep(2); renderRail();
  var trs='';
  for(var i=0;i<S.events.length;i++){ var e=S.events[i]; if(e.phase==='shield'||e.phase==='transfer') trs+=trace(e); }
  $('app').innerHTML='<div class="card"><h3>Buying the verdict — the agent\\'s own money</h3>'+trs
    +'<div class="lanes"><div class="lane">Juror 1<div class="dim">privately judging…</div></div><div class="lane">Juror 2<div class="dim">privately judging…</div></div><div class="lane">Juror 3<div class="dim">privately judging…</div></div></div>'
    +'<p class="muted" style="margin-top:8px"><span class="pill src">'+esc(disc)+'</span> <span class="spin">●</span> '+(disc==='sealed'?'opinions stay sealed — the tally and per-juror hash commitments get published':'only the aggregate tally gets published — juror reasoning is released to the owner, never to the chain')+'</p></div>';
  pollVerdict();
}

async function pollVerdict(){
  var dots=0;
  for(;;){
    await new Promise(function(r){ setTimeout(r,2000); });
    var r;
    try{ r=await api('/demo/'+S.sessionId+'/verdict'); }
    catch(e){ continue; }
    if(r.state==='deliberating'){ dots++; var sp=document.querySelector('.spin'); if(sp) sp.textContent='●'.repeat(1+dots%3); continue; }
    showVerdict(r); return;
  }
}

function showVerdict(v){
  S.verdict=v; setStep(3); renderRail();
  var ok=(v.decision==='Approved');
  var sealed=(v.disclosure==='sealed');
  var j='';
  var ju=v.jurors||[];
  for(var i=0;i<ju.length;i++){ var x=ju[i];
    j+='<div class="lane"><div class="dim">'+esc(x.name||('Juror '+(i+1)))+'</div>'
      +(sealed?'<span class="pill src">sealed</span>':'<div class="vote '+(x.vote==='Approved'?'approved':'rejected')+'">'+esc(x.vote||'—')+'</div>')
      +(x.did?'<div class="who">'+esc(String(x.did).slice(0,28))+'…</div>':'')
      +(x.resultHash?'<div class="who">resultHash '+esc(String(x.resultHash).slice(0,18))+'…'+(sealed?'':' <span class="ok">✓ committed pre-tally</span>')+'</div>':'')
      +'<div class="muted" style="margin-top:5px">'+esc(x.reasoning||'')+'</div></div>';
  }
  var verSem=sealed
    ?'<p class="dim">what this proves: the council existed (3 distinct DIDs), each juror\\'s commitment landed BEFORE the tally, and the tally settled on-chain. Opinions stay sealed — unsealing later only happens with juror consent.</p>'
    :'<p class="dim">the chain holds the juror DIDs and result hashes; the reasoning was released only to the owner\\'s app — and sha256(released vote+reasoning) matches each on-chain result hash.</p>';
  $('app').innerHTML='<div class="card"><h3 class="'+(ok?'ok':'bad')+'">'+esc(v.decision)+' · '+esc(v.approved)+'–'+esc(v.rejected)+'</h3>'
    +'<p class="muted">purchased as <b>'+esc(v.disclosure||'attested')+'</b> · settled on-chain · <a href="'+esc(v.explorer||'#')+'" target="_blank">'+esc(v.settledOn||'coordinator.agents-coordinator.testnet')+'</a> · proposal #'+esc(String(v.proposalId))+' · settled at '+esc((v.settledAt||'').slice(0,19)||'')+'</p>'
    +verSem
    +'<div class="lanes">'+j+'</div><div class="row">'
    +(ok?'<button id="ratify">Ratify with one signature</button>':'<button id="force" class="ghost">Try the spend anyway (the bite)</button>')
    +'</div></div>';
  if(ok) { var rb=$('ratify'); rb&&rb.addEventListener('click',function(){ ratify(); }); }
  else { var fb=$('force'); fb&&fb.addEventListener('click',function(){ bite(fb); }); }
}

async function ratify(){
  var b=$('ratify'); b.disabled=true; b.textContent='Owner signing…';
  var d=await api('/demo/'+S.sessionId+'/ratify',{method:'POST'});
  S.events=d.events||S.events; S.ratified=true;
  S.vendors=(d.policy&&d.policy.destinationsAdded)||['ac-owner.delibera.near'];
  setStep(4); renderRail();
  var msg=(d.signature&&d.signature.message)?d.signature.message:null;
  $('app').innerHTML='<div class="card"><h3 class="ok">Owner signed the policy change (NEP-413)</h3>'
    +(msg?'<div class="sigbox">PAYLOAD THE WALLET SIGNS:\\n'+esc(msg)+'\\n\\nstandard: '+esc((d.signature&&d.signature.standard)||'nep413')+' · tag 2147484061 · sha256\\n'+(S.mode==='live'?'signed with the demo owner key (server-held here; the product signs in the browser)':'signed by the demo owner key (product signs in the browser)')+'</div>':'')
    +'<p class="muted">revision → <b>'+esc((d.policy&&d.policy.revision)||'next')+'</b> · destination added: '+esc((S.vendors||[]).join(', '))+'</p>'
    +'<p class="dim">One signature binds the vendor. No human pressed "pay" — the wallet simply allowed the deal.</p>'
    +'<div class="row"><button id="pay">Pay the vendor ($0.01)</button></div></div>';
  var pb=$('pay'); if(pb) pb.addEventListener('click',function(){ payVendor(pb); });
}

async function payVendor(btn){
  btn.disabled=true; btn.textContent='Paying…';
  var vs=S.events.filter(function(e){ return e.phase==='transfer'&&/vendor/i.test(e.title); });
  var last=vs[vs.length-1]||{};
  async function renderSchedule(){
    var html='';
    for(var i=0;i<vs.length;i++) html+=trace(vs[i]);
    if(last.code==='uncertain'){
      $('app').innerHTML='<div class="card">'+html+'<p class="muted amb" style="color:var(--amb)"><b>UNCERTAIN — maybe executed.</b> Polling the SAME correlation_id; never resubmitting…</p></div>';
      await new Promise(function(r){ setTimeout(r,2600); });
      vs=S.events.filter(function(e){ return e.phase==='transfer'&&/vendor|resolved/i.test(e.title); });
      html=''; for(var i2=0;i2<vs.length;i2++) html+=trace(vs[i2]);
    }
    setStep(5);
    var evIdx=stash(JSON.stringify({disclosure:S.disclosure||'attested',events:S.events.filter(function(e){ return e.correlationId; })},null,2));
    $('app').innerHTML='<div class="card"><h3 class="ok">Paid — confidential receipt</h3>'+html
      +'<p class="muted">verdict purchased as <b>'+esc(S.disclosure||'attested')+'</b> · ✔ settled. The verdict was bought autonomously; the vendor was paid only after the verdict + the owner signature. This is the receipt your auditor sees instead of the chain.</p>'
      +'<div class="row"><button class="copy" onclick="copyText('+evIdx+')">Copy evidence JSON</button>'
      +'<a class="ghost preset" target="_blank" href="'+esc('https://nearblocks.io/address/'+((S.agent&&S.agent.nearAccountId)||""))+'">'+esc('agent wallet on explorer')+'</a>'
      +'</div></div>';
  }
  await renderSchedule();
}

async function bite(btn){
  btn.disabled=true;
  var d=await api('/demo/'+S.sessionId+'/force-spend',{method:'POST'});
  S.events=d.events||S.events; renderRail();
  var ev=null;
  for(var i=S.events.length-1;i>=0;i--){ if(S.events[i].phase==='refusal'){ ev=S.events[i]; break; } }
  setStep(5);
  var evIdx=stash(JSON.stringify(ev,null,2));
  $('app').innerHTML='<div class="card"><h3 class="bad">The wallet refused — 403 before dispatch</h3>'
    +(ev?trace(ev):'<div class="muted">'+esc(d.message||d.code||'403')+'</div>')
    +'<p class="muted">No signature was given. <b>Nothing moved anywhere.</b> The verdict\\'s "no" and the owner\\'s rule are the same wall — the agent cannot buy its way past a rejected verdict.</p>'
    +(d.receipt?'<div class="sigbox">'+esc(d.receipt.code)+'</div>':'')
    +'<div class="row"><button class="copy" onclick="copyText('+evIdx+')">Copy refusal evidence</button></div></div>';
}

boot().catch(function(e){ $('app').innerHTML='<div class="card bad">boot failed: '+esc(e&&e.message||e)+'</div>'; });
</script>
</body>
</html>`;
