const ST={
  coins:[],coin:'BTCUSDT',
  c5:[],c15:[],c1h:[],c4h:[],c1d:[],
  curSig5:null,curSig15:null,curSig1h:null,
  sigs5:[],sigs15:[],sigs1h:[],
  activeTF:'5m',
  view:'chart',refreshing:false,
  lastCT5:null,lastCT15:null,lastCT1h:null,
  fr:null,oi:null
};
const notifiedSigs=new Set(),notifiedOutcomes=new Set();
let audioEnabled=true,notifEnabled=false;

// ── AUDIO ─────────────────────────────────────────────────────────────────────
let audioCtx=null;
function getAC(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx}
function beep(freqs,dur=0.13,vol=0.25){if(!audioEnabled)return;try{const ctx=getAC();freqs.forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.setValueAtTime(f,ctx.currentTime+i*dur);g.gain.setValueAtTime(vol,ctx.currentTime+i*dur);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*dur+dur*.9);o.start(ctx.currentTime+i*dur);o.stop(ctx.currentTime+i*dur+dur)})}catch(e){}}
function playLong5(){beep([440,550,660],0.12,0.28)}
function playShort5(){beep([660,550,440],0.12,0.28)}
function playLong15(){beep([330,440,550,660],0.15,0.32)}
function playShort15(){beep([660,550,440,330],0.15,0.32)}
function playTP(){beep([523,659,784,1047],0.1,0.25)}
function playSL(){beep([300,250],0.2,0.25)}
function toggleAudio(){audioEnabled=!audioEnabled;const b=document.getElementById('btn-audio');b.textContent=audioEnabled?'🔔 Audio':'🔕 Audio';b.classList.toggle('on',audioEnabled);if(audioEnabled)try{getAC().resume()}catch{}}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
async function reqNotifPerm(){if(!('Notification' in window)){showToast('⚠ Not supported','#f6465d');return}const p=await Notification.requestPermission();notifEnabled=(p==='granted');const b=document.getElementById('btn-notif');b.classList.toggle('on',notifEnabled);b.textContent=notifEnabled?'🖥 On':'🖥 Notify';document.getElementById('notif-banner').style.display='none';showToast(notifEnabled?'✅ Notifications enabled':'⚠ Notifications blocked','#0ecb81')}
function sendDN(title,body,tag){if(!notifEnabled||Notification.permission!=='granted')return;try{const n=new Notification(title,{body,tag});n.onclick=()=>{window.focus();n.close()};setTimeout(()=>n.close(),8000)}catch(e){}}

// ── TOASTS ────────────────────────────────────────────────────────────────────
function rmToast(el){el.classList.add('hide');setTimeout(()=>{if(el.parentNode)el.parentNode.removeChild(el)},400)}
function showToast(msg,col='#f0b90b',dur=5000){const w=document.getElementById('toast-wrap');const d=document.createElement('div');d.className='toast';d.style.borderLeft='3px solid '+col;d.innerHTML='<div style="font-size:11px;color:'+col+'">'+msg+'</div>';d.onclick=()=>rmToast(d);w.appendChild(d);setTimeout(()=>rmToast(d),dur)}
function showSigToast(s){
  const w=document.getElementById('toast-wrap');const d=document.createElement('div');d.className='toast';
  const isL=s.dir==='LONG',col=s.str==='STRONG'?'#f0b90b':isL?'#0ecb81':'#f6465d',tfCol=s.tf==='15m'?'#9d71ff':'#1890ff';
  d.style.borderLeft='3px solid '+col;
  d.innerHTML=`<div class="t-head"><div class="t-icon" style="color:${col}">${isL?'▲':'▼'}</div><div class="t-title" style="color:${col}">${s.dir} — ${s.str}</div><span style="font-size:9px;padding:1px 5px;border-radius:2px;background:rgba(255,255,255,.1);color:${tfCol}">${s.tf}</span><span class="t-close" onclick="this.parentNode.parentNode.remove()">✕</span></div>
  <div class="t-body"><b>${s.sym.replace('USDT','')}</b> &nbsp;Score: <b style="color:${col}">${s.sc}/${s.mx}</b><br>${new Date(s.ts).toLocaleTimeString()}</div>
  <div class="t-lvls"><div class="t-lrow"><span style="color:var(--mu)">Entry</span><span>${fp(s.entry)}</span></div><div class="t-lrow"><span style="color:var(--re)">SL</span><span style="color:var(--re)">${fp(s.sl)}</span></div><div class="t-lrow"><span style="color:#52c41a">TP1</span><span style="color:#52c41a">${fp(s.tp1)}</span></div><div class="t-lrow"><span style="color:var(--gr)">TP2</span><span style="color:var(--gr)">${fp(s.tp2)}</span></div></div>`;
  w.appendChild(d);setTimeout(()=>rmToast(d),14000);
}
function showOutcomeToast(s){const w=document.getElementById('toast-wrap');const d=document.createElement('div');d.className='toast';const m={TP2_HIT:{i:'🎯',t:'TP2 Hit!',c:'#f0b90b'},TP1_HIT:{i:'✅',t:'TP1 Hit!',c:'#0ecb81'},SL_HIT:{i:'🛑',t:'SL Hit',c:'#f6465d'}};const{i,t,c}=m[s.out]||{i:'ℹ',t:s.out,c:'#848e9c'};d.style.borderLeft='3px solid '+c;d.innerHTML=`<div class="t-head"><div class="t-icon">${i}</div><div class="t-title" style="color:${c}">${t}</div><span style="font-size:9px;color:#848e9c">${s.tf}</span><span class="t-close" onclick="this.parentNode.parentNode.remove()">✕</span></div><div class="t-body"><b>${s.sym.replace('USDT','')}</b> ${s.dir} | Entry: <b>${fp(s.entry)}</b></div>`;w.appendChild(d);setTimeout(()=>rmToast(d),10000)}

function notifyNewSig(s){
  if(notifiedSigs.has(s.id))return;notifiedSigs.add(s.id);
  showSigToast(s);
  if(s.tf==='15m'||s.tf==='1h'){s.dir==='LONG'?playLong15():playShort15()}else{s.dir==='LONG'?playLong5():playShort5()}
  sendDN(s.tf+' '+(s.dir==='LONG'?'▲':'▼')+' '+s.dir+' '+s.str+' — '+s.sym.replace('USDT',''),'Entry: '+fp(s.entry)+' | SL: '+fp(s.sl)+' | TP: '+fp(s.tp1)+'\nScore: '+s.sc+'/'+s.mx,'sig_'+s.id);
  flashTitle(s.tf+' '+(s.dir==='LONG'?'▲':'▼')+' '+s.dir+' '+s.sym.replace('USDT',''));
}
function notifyOutcome(s){
  if(notifiedOutcomes.has(s.id))return;
  notifiedOutcomes.add(s.id);
  showOutcomeToast(s);
  s.out==='SL_HIT'?playSL():playTP();
  const m={TP2_HIT:'🎯 TP2',TP1_HIT:'✅ TP1',SL_HIT:'🛑 SL'};
  sendDN((m[s.out]||s.out)+' — '+s.sym.replace('USDT',''),s.tf+' '+s.dir+' | '+fp(s.entry),'out_'+s.id);
}
let flashTmr=null;
function flashTitle(msg){if(flashTmr)clearInterval(flashTmr);let on=true,n=0;flashTmr=setInterval(()=>{document.title=on?'🔔 '+msg:'Futures Signal Analyzer';on=!on;if(++n>12){clearInterval(flashTmr);document.title='Futures Signal Analyzer';flashTmr=null}},600)}

// ── STORAGE ───────────────────────────────────────────────────────────────────
function saveSig(s){}
function loadSigs(tf){return[]}
function chkOut(sigs,candles){}
function clearSigs(){}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function fp(p){if(!p&&p!==0)return'—';if(p>=10000)return p.toFixed(1);if(p>=1000)return p.toFixed(2);if(p>=1)return p.toFixed(4);return p.toFixed(6)}
function fv(v){if(v>=1e9)return(v/1e9).toFixed(2)+'B';if(v>=1e6)return(v/1e6).toFixed(2)+'M';if(v>=1e3)return(v/1e3).toFixed(1)+'K';return v.toFixed(0)}
function sigColor(s){if(s.out==='TP2_HIT')return'#f0b90b';if(s.out==='TP1_HIT')return'#0ecb81';if(s.out==='SL_HIT')return'#f6465d';if(s.str==='STRONG')return'#f0b90b';return s.dir==='LONG'?'#0ecb81':'#f6465d'}
function closestCandle(cs,ts2){let best=cs[0];for(const c of cs)if(Math.abs(c.t.getTime()-ts2)<Math.abs(best.t.getTime()-ts2))best=c;return best}

// ── UI UPDATES ──────────────────────────────────────────────────────────────
function updActivePanel(){
  const all=[...ST.sigs5,...ST.sigs15,...ST.sigs1h].filter(s=>s.out==='PENDING').sort((a,b)=>new Date(b.ts)-new Date(a.ts)).slice(0,6);
  const el=document.getElementById('active-sigs-list');
  if(!all.length){el.innerHTML='<div style="font-size:10px;color:var(--mu)">No active trades</div>';return}
  el.innerHTML=all.map(s=>{const isL=s.dir==='LONG',col=isL?'#0ecb81':'#f6465d',tfCol=s.tf==='15m'?'#9d71ff':(s.tf==='1h'?'#f0b90b':'#1890ff');return`<div class="asig" style="border-left-color:${col}"><div class="asig-head"><span class="asig-dir" style="color:${col}">${isL?'▲':'▼'} <span style="color:var(--tx)">${s.sym.replace('USDT','')}</span> ${s.dir}</span><span class="asig-tf" style="color:${tfCol}">${s.tf} · ${s.str} · ${s.sc}/${s.mx}</span></div><div class="asig-row"><span style="color:var(--mu)">Entry</span><span>${fp(s.entry)}</span></div><div class="asig-row"><span style="color:var(--re)">SL</span><span style="color:var(--re)">${fp(s.sl)}</span></div><div class="asig-row"><span style="color:#52c41a">TP1</span><span style="color:#52c41a">${fp(s.tp1)}</span></div><div class="asig-row"><span style="color:var(--gr)">TP2</span><span style="color:var(--gr)">${fp(s.tp2)}</span></div></div>`}).join('');
}

function updSigPanel(s){
  if(!s)return;
  if(s.sc<=4){
    document.getElementById('waiting-state').style.display='block';
    document.getElementById('sig-active').style.display='none';
    document.getElementById('conf-panel').style.display='none';
    document.getElementById('wt-score').textContent=s.sc+'/13';
    document.getElementById('wt-score').style.color=s.sc>=4?'rgba(240,185,11,.4)':'rgba(132,142,156,.3)';
    document.getElementById('wt-fill').style.width=(s.sc/13*100)+'%';
    document.getElementById('wt-fill').style.background='var(--bd)';
    updIndicators(s);
    return;
  }
  document.getElementById('waiting-state').style.display='none';
  document.getElementById('sig-active').style.display='block';
  document.getElementById('conf-panel').style.display='block';

  const c=s.dir==='LONG'?'#0ecb81':'#f6465d';
  const tfCol=s.tf==='15m'?'#9d71ff':(s.tf==='1h'?'#f0b90b':'#1890ff');
  document.getElementById('sig-tf-label').innerHTML='<span style="color:'+tfCol+'">'+s.tf+'</span> Signal';
  document.getElementById('sdir').innerHTML='<span style="color:'+c+'">'+(s.dir==='LONG'?'▲':'▼')+' '+s.dir+'</span>';
  const se=document.getElementById('sstr');
  const scm={STRONG:['#f0b90b','rgba(240,185,11,.15)'],MEDIUM:['#1890ff','rgba(24,144,255,.15)']};
  const[tc,bg]=scm[s.str]||['#1890ff','rgba(24,144,255,.15)'];
  se.style.background=bg;se.style.color=tc;se.textContent=s.str;
  document.getElementById('stxt').textContent=s.sc+'/'+s.mx;
  document.getElementById('scfill').style.width=(s.sc/s.mx*100)+'%';
  document.getElementById('scfill').style.background=s.str==='STRONG'?'#f0b90b':'#1890ff';
  document.getElementById('se').textContent=fp(s.entry);
  document.getElementById('ssl').textContent=fp(s.sl);
  document.getElementById('st1').textContent=fp(s.tp1);
  document.getElementById('st2').textContent=fp(s.tp2);
  document.getElementById('srr').textContent=s.rr.toFixed(2)+':1';
  document.getElementById('rlist').innerHTML=s.reasons.map(r=>'<li>'+r+'</li>').join('');
  updIndicators(s);
}

function updIndicators(s){
  if(!s)return;
  const rsic=s.rsi>70?'#f6465d':s.rsi<30?'#0ecb81':'#eaecef';
  document.getElementById('i-rsi').innerHTML='<span style="color:'+rsic+'">'+(s.rsi?s.rsi.toFixed(1):'—')+(s.rsi>70?' OB':s.rsi<30?' OS':'')+'</span>';
  document.getElementById('i-ema').innerHTML='<span style="color:'+(s.e9v>s.e21v?'#0ecb81':'#f6465d')+'">'+(s.e9v>s.e21v?'▲ Bullish':'▼ Bearish')+'</span>';
  document.getElementById('i-atr').textContent=fp(s.cat||0);
  const bbmid=s.bbl!=null&&s.bbu!=null?(s.bbl+s.bbu)/2:null;
  document.getElementById('i-bb').innerHTML=bbmid?'<span style="color:'+(s.entry>bbmid?'#f6465d':'#0ecb81')+'">'+(s.entry>bbmid?'Upper half':'Lower half')+'</span>':'—';
  document.getElementById('i-vol').innerHTML=s.curVol>s.avgVol*1.5?'<span style="color:#f0b90b">Spike ↑</span>':'<span style="color:#848e9c">Normal</span>';
  document.getElementById('ifr').innerHTML=s.fr!=null?'<span style="color:'+(s.fr<0?'#0ecb81':'#f6465d')+'">'+(s.fr*100).toFixed(4)+'%</span>':'—';
  document.getElementById('ist').innerHTML='<span style="color:'+(s.st==='uptrend'?'#0ecb81':s.st==='downtrend'?'#f6465d':'#848e9c')+'">'+s.st+'</span>';
  document.getElementById('i15').innerHTML='<span style="color:'+(s.h1==='BULL'?'#0ecb81':'#f6465d')+'">'+s.h1lbl+': '+s.h1+'</span>';
  document.getElementById('i1h').innerHTML='<span style="color:'+(s.h2==='BULL'?'#0ecb81':'#f6465d')+'">'+s.h2lbl+': '+s.h2+'</span>';
}

function updHdr(){document.getElementById('ctabs').innerHTML=ST.coins.map(c=>{const p=parseFloat(c.priceChangePercent);return'<button id="ctab-'+c.symbol+'" class="ctab '+(c.symbol===ST.coin?'act':'')+'" onclick="selCoin(\''+c.symbol+'\')">'+c.symbol.replace('USDT','')+' <span class="pct" style="font-size:9px;color:'+(p>=0?'#0ecb81':'#f6465d')+'">'+(p>=0?'+':'')+p.toFixed(2)+'%</span></button>'}).join('')}
function updPx(){if(!ST.c5.length)return;const l=ST.c5[ST.c5.length-1],pv=ST.c5[ST.c5.length-2];const pr=l.c,ch=pv?((pr-pv.c)/pv.c*100):0;document.getElementById('lp').style.color=pr>=(pv?pv.c:pr)?'#0ecb81':'#f6465d';document.getElementById('lp').textContent=fp(pr);document.getElementById('pc').style.color=ch>=0?'#0ecb81':'#f6465d';document.getElementById('pc').textContent=(ch>=0?'+':'')+ch.toFixed(3)+'%'}

function renRep(){
  const tfFilt = document.getElementById('rep-tf') ? document.getElementById('rep-tf').value : 'all';
  let all = [];
  if (tfFilt === 'all') all = [...ST.sigs5,...ST.sigs15,...ST.sigs1h];
  else if (tfFilt === '5m') all = [...ST.sigs5];
  else if (tfFilt === '15m') all = [...ST.sigs15];
  else if (tfFilt === '1h') all = [...ST.sigs1h];

  const res=all.filter(s=>s.out==='TP1_HIT'||s.out==='TP2_HIT'||s.out==='SL_HIT');
  const ws=res.filter(s=>s.out==='TP1_HIT'||s.out==='TP2_HIT');
  const wr=res.length?(ws.length/res.length*100):0;

  const cards = [
    {l:'Closed Trades',v:res.length,c:'#eaecef'},
    {l:'Win Rate',v:wr.toFixed(1)+'%',c:wr>=50?'#0ecb81':'#f6465d'},
    {l:'Pending',v:all.filter(s=>s.out==='PENDING').length,c:'#1890ff'},
    {l:'TP Hits',v:ws.length,c:'#0ecb81'},
    {l:'SL Hits',v:res.filter(s=>s.out==='SL_HIT').length,c:'#f6465d'}
  ];
  document.getElementById('sgrid').innerHTML=cards.map(s=>'<div class="scard"><div class="sv2" style="color:'+s.c+'">'+s.v+'</div><div class="sl2">'+s.l+'</div></div>').join('');

  const rows=[];
  const tfs = tfFilt === 'all' ? ['5m','15m','1h'] : [tfFilt];
  tfs.forEach(tf=>{
    ['STRONG','MEDIUM'].forEach(str=>{
      const g=res.filter(s=>s.tf===tf&&s.str===str),gw=g.filter(s=>s.out!=='SL_HIT'),gwr=g.length?(gw.length/g.length*100):0,avg=g.length?(g.reduce((a,s)=>a+s.sc,0)/g.length):0,tc=tf==='15m'?'#9d71ff':(tf==='1h'?'#f0b90b':'#1890ff'),sc=str==='STRONG'?'#f0b90b':'#1890ff';
      if(g.length > 0 || tfFilt === 'all') rows.push('<div class="bkr"><span style="color:'+tc+'">'+tf+'</span><span style="color:'+sc+'">'+str+'</span><span>'+g.length+'</span><span style="color:'+(gwr>=60?'#0ecb81':'#f6465d')+'">'+(g.length?gwr.toFixed(1)+'%':'—')+'</span><span>'+(g.length?avg.toFixed(1):'—')+'</span></div>');
    })
  });
  document.getElementById('bkbody').innerHTML=rows.join('');
  const ol={TP2_HIT:['🎯 TP2','bdt2'],TP1_HIT:['✅ TP1','bdt1'],SL_HIT:['🛑 SL','bdsl'],PENDING:['⏳ PENDING','bdpd'],EXPIRED:['⌛ EXP','bdpd']};
  document.getElementById('hbody').innerHTML=all.sort((a,b)=>new Date(b.ts)-new Date(a.ts)).slice(0,100).map(s=>{const[ot,oc]=ol[s.out]||['—',''];const d=new Date(s.ts);const tstr=(d.getMonth()+1)+'/'+d.getDate()+' '+d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');const tfCol=s.tf==='15m'?'#9d71ff':(s.tf==='1h'?'#f0b90b':'#1890ff');return'<div class="tr"><span style="color:#848e9c">'+tstr+'</span><span style="color:'+tfCol+'">'+s.tf+'</span><span>'+s.sym.replace('USDT','')+'</span><span class="'+(s.dir==='LONG'?'bdl':'bds')+'">'+s.dir+'</span><span>'+fp(s.entry)+'</span><span><span style="color:#f6465d">'+fp(s.sl)+'</span>→<span style="color:var(--gr)">'+fp(s.tp1)+'</span></span><span>'+s.sc+'/13</span><span class="'+oc+'">'+ot+'</span></div>'}).join('')||'<div style="padding:14px;text-align:center;color:#848e9c;font-size:11px">No signals yet</div>';
}

function expCSV(){if(![...ST.sigs5,...ST.sigs15,...ST.sigs1h].length){alert('No signals yet.');return}const hd=['Time','TF','Symbol','Direction','Strength','Score','Entry','SL','TP1','TP2','RR','RSI','Structure','HTF1','HTF2','FundingRate','Outcome'];const rw=[...ST.sigs5,...ST.sigs15,...ST.sigs1h].sort((a,b)=>new Date(b.ts)-new Date(a.ts)).map(s=>[s.ts,s.tf,s.sym,s.dir,s.str,s.sc,s.entry,s.sl,s.tp1,s.tp2,s.rr?s.rr.toFixed(2):'',s.rsi?s.rsi.toFixed(1):'',s.st,s.h1,s.h2,s.fr!=null?(s.fr*100).toFixed(4)+'%':'',s.out]);const u=URL.createObjectURL(new Blob([[hd,...rw].map(r=>r.join(',')).join('\n')],{type:'text/csv'}));const a=document.createElement('a');a.href=u;a.download='signals_'+new Date().toISOString().split('T')[0]+'.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u)}

function setTF(tf){ST.activeTF=tf;document.getElementById('tf5btn').classList.toggle('act',tf==='5m');document.getElementById('tf15btn').classList.toggle('act',tf==='15m');document.getElementById('tf1hbtn').classList.toggle('act',tf==='1h');document.getElementById('tf-info').innerHTML=(tf==='5m'?'5m chart · 15m+1h confirm':(tf==='15m'?'15m chart · 1h+4h confirm':'1h chart · 4h+1d confirm'))+' &nbsp;|&nbsp; Min score: <b style="color:var(--ye)">5/13</b>';const sig=tf==='5m'?ST.curSig5:(tf==='15m'?ST.curSig15:ST.curSig1h);if(sig)updSigPanel(sig);}
function swV(v){ST.view=v;document.getElementById('cview').style.display=v==='chart'?'flex':'none';document.getElementById('rview').style.display=v==='report'?'block':'none';document.getElementById('bview').style.display=v==='backtest'?'block':'none';document.querySelectorAll('.nbtn').forEach((b,i)=>b.classList.toggle('act',(i===0&&v==='chart')||(i===1&&v==='report')||(i===2&&v==='backtest')));if(v==='report')renRep();}
function selCoin(s){if(s===ST.coin)return;ST.coin=s;ST.c5=[];ST.c15=[];ST.c1h=[];ST.curSig5=null;ST.curSig15=null;ST.curSig1h=null;document.getElementById('loading').style.display='flex';document.querySelectorAll('.ctab').forEach(t=>t.classList.toggle('act',t.textContent.trim().startsWith(s.replace('USDT',''))));initDataFetch()}

// ── WEBSOCKET INTEGRATION ───────────────────────────────────────────────────
let ws=null;
let lastRenderTime=0;
let wsLastMsgTime=0;

function connectWS() {
  if(ws) ws.close();
  const lowerSym = ST.coin.toLowerCase();
  let streams = `${lowerSym}@kline_5m/${lowerSym}@kline_15m/${lowerSym}@kline_1h/${lowerSym}@kline_4h/${lowerSym}@kline_1d/${lowerSym}@markPrice@1s`;
  ws = new WebSocket(`wss://fstream.binance.com/stream?streams=${streams}`);
  
  ws.onopen = () => {
    document.getElementById('stxt2').textContent='● Live (WS)';
    document.getElementById('sdot').style.background='#0ecb81';
  };
  
  ws.onmessage = (event) => {
    wsLastMsgTime = Date.now();
    const data = JSON.parse(event.data);
    if (!data.data) return;
    
    if (data.data.e === 'markPriceUpdate') {
      ST.fr = parseFloat(data.data.r);
      const frEl = document.getElementById('ifr');
      if (frEl && ST.fr != null) {
        frEl.innerHTML = '<span style="color:'+(ST.fr<0?'#0ecb81':'#f6465d')+'">'+(ST.fr*100).toFixed(4)+'%</span>';
      }
      return;
    }
    
    if (!data.data.k) return;
    
    const k = data.data.k;
    const interval = k.i;
    const sym = k.s;
    const candle = { t: new Date(k.t), o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v };
    
    
    let arr = null;
    if (interval === '5m') arr = ST.c5;
    if (interval === '15m') arr = ST.c15;
    if (interval === '1h') arr = ST.c1h;
    if (interval === '4h') arr = ST.c4h;
    if (interval === '1d') arr = ST.c1d;
    
    if (arr && arr.length > 0) {
      const last = arr[arr.length - 1];
      if (last.t.getTime() === candle.t.getTime()) {
        arr[arr.length - 1] = candle; // Update current candle
      } else if (candle.t.getTime() > last.t.getTime()) {
        arr.push(candle); // New candle
        if (arr.length > 200) arr.shift(); // Keep 200
      }
    }
    
    // Throttle UI updates to ~2 times per second max to avoid lag
    const now = Date.now();
    if (now - lastRenderTime > 500) {
      lastRenderTime = now;
      processDataUpdate();
    }
  };
  
  ws.onclose = () => {
    document.getElementById('stxt2').textContent='⚠ WS Disconnected';
    document.getElementById('sdot').style.background='#f6465d';
    setTimeout(connectWS, 3000); // Reconnect
  };
}

function processDataUpdate() {
  try {
    if(!ST.c5.length || !ST.c15.length || !ST.c1h.length || !ST.c4h.length) return;

    const sig5=genSig(ST.c5,ST.c15,ST.c1h,ST.c1d,ST.fr,'5m',ST.coin);
    if(sig5){ ST.curSig5=sig5; }

    const sig15=genSig(ST.c15,ST.c1h,ST.c4h,ST.c1d,ST.fr,'15m',ST.coin);
    if(sig15){ ST.curSig15=sig15; }

    const sig1h=genSig(ST.c1h,ST.c4h,ST.c1d,ST.c1d,ST.fr,'1h',ST.coin);
    if(sig1h){ ST.curSig1h=sig1h; }

    const activeSig=ST.activeTF==='5m'?ST.curSig5:(ST.activeTF==='15m'?ST.curSig15:ST.curSig1h);
    if(activeSig)updSigPanel(activeSig);
    updActivePanel();

    document.getElementById('loading').style.display='none';
    updPx();

    const now=new Date();
    document.getElementById('ssym').textContent=ST.coin;
    document.getElementById('sref').textContent='Updated '+now.toLocaleTimeString() + (Date.now()-wsLastMsgTime>5000?' (REST)':'');
    document.getElementById('s5cnt').textContent='5m: '+ST.sigs5.length;
    document.getElementById('s15cnt').textContent='15m: '+ST.sigs15.length;
    document.getElementById('s1hcnt').textContent='1h: '+ST.sigs1h.length;
    if(ST.view==='report')renRep();
  } catch(e) {
    document.getElementById('stxt2').textContent='⚠ JS Error: ' + e.message;
    document.getElementById('sdot').style.background='#f6465d';
    console.error(e);
  }
}

async function initDataFetch() {
  ST.refreshing=true;
  try {
    const lastSig5 = ST.sigs5.find(s => s.sym === ST.coin);
    ST.lastCT5 = lastSig5 ? lastSig5.ts : null;
    const lastSig15 = ST.sigs15.find(s => s.sym === ST.coin);
    ST.lastCT15 = lastSig15 ? lastSig15.ts : null;
    const lastSig1h = ST.sigs1h.find(s => s.sym === ST.coin);
    ST.lastCT1h = lastSig1h ? lastSig1h.ts : null;

    const[c5,c15,c1h,c4h,c1d]=await Promise.all([fC(ST.coin,'5m',200),fC(ST.coin,'15m',200),fC(ST.coin,'1h',200),fC(ST.coin,'4h',100),fC(ST.coin,'1d',50)]);
    ST.c5=c5;ST.c15=c15;ST.c1h=c1h;ST.c4h=c4h;ST.c1d=c1d;
    const[fr,oi]=await Promise.all([fFR(ST.coin),fOI(ST.coin)]);
    ST.fr=fr;ST.oi=oi;
    if(oi!=null)document.getElementById('ioi').textContent=fv(oi);
    
    processDataUpdate();
    connectWS();
    
    // Fallback Poller: If WS goes silent for >4s, fetch manually
    setInterval(async () => {
      if (Date.now() - wsLastMsgTime < 4000) return;
      try {
        const[c5,c15]=await Promise.all([fC(ST.coin,'5m',2),fC(ST.coin,'15m',2)]);
        const syncArr = (arr, newCandles) => {
          for(const candle of newCandles) {
            const last = arr[arr.length - 1];
            if (last.t.getTime() === candle.t.getTime()) arr[arr.length - 1] = candle;
            else if (candle.t.getTime() > last.t.getTime()) { arr.push(candle); if(arr.length>200) arr.shift(); }
          }
        };
        syncArr(ST.c5, c5); syncArr(ST.c15, c15);
        processDataUpdate();
      } catch(e) {}
    }, 2000);
    
  } catch(err) {
    console.error(err);
    document.getElementById('stxt2').textContent='⚠ '+err.message;
    document.getElementById('sdot').style.background='#f6465d';
    document.getElementById('loading').style.display='flex';
    document.getElementById('loading').innerHTML='<div style="text-align:center"><div style="color:#f6465d;font-size:14px;margin-bottom:8px">⚠ Connection Error</div><div style="color:#848e9c;font-size:12px;margin-bottom:14px">'+err.message+'</div><button onclick="initDataFetch()" style="background:#2b3139;border:1px solid #48535f;color:#eaecef;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">🔄 Retry</button></div>';
  } finally {
    ST.refreshing=false;
  }
}

// ── GLOBAL WEBSOCKET ──────────────────────────────────────────────────────────
let globalWs = null;
function connectGlobalWS() {
  if (globalWs) globalWs.close();
  globalWs = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');
  globalWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (!Array.isArray(data)) return;
    for (const t of data) {
      const coinIndex = ST.coins.findIndex(c => c.symbol === t.s);
      if (coinIndex !== -1) {
        ST.coins[coinIndex].priceChangePercent = t.P;
        ST.coins[coinIndex].quoteVolume = t.q;
        const tab = document.getElementById('ctab-' + t.s);
        if (tab) {
          const p = parseFloat(t.P);
          const pctEl = tab.querySelector('.pct');
          if (pctEl) {
            pctEl.textContent = (p >= 0 ? '+' : '') + p.toFixed(2) + '%';
            pctEl.style.color = p >= 0 ? '#0ecb81' : '#f6465d';
          }
        }
      }
    }
  };
  globalWs.onclose = () => setTimeout(connectGlobalWS, 5000);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init(){
  document.getElementById('loading').style.display='flex';
  document.getElementById('loading').innerHTML='<div class="spin"></div><span style="font-size:12px">Connecting to Binance…</span>';
  try{
    ST.sigs5=loadSigs('5m');ST.sigs15=loadSigs('15m');ST.sigs1h=loadSigs('1h');
    ST.sigs5.forEach(s=>notifiedSigs.add(s.id));
    ST.sigs15.forEach(s=>notifiedSigs.add(s.id));
    ST.sigs1h.forEach(s=>notifiedSigs.add(s.id));
    ST.sigs5.filter(s=>s.out!=='PENDING').forEach(s=>notifiedOutcomes.add(s.id));
    ST.sigs15.filter(s=>s.out!=='PENDING').forEach(s=>notifiedOutcomes.add(s.id));
    ST.sigs1h.filter(s=>s.out!=='PENDING').forEach(s=>notifiedOutcomes.add(s.id));
    if('Notification' in window&&Notification.permission==='default')document.getElementById('notif-banner').style.display='flex';
    else if(Notification.permission==='granted'){notifEnabled=true;document.getElementById('btn-notif').classList.add('on');document.getElementById('btn-notif').textContent='🖥 On'}
    const coins=await fCoins();
    ST.coins=coins;ST.coin=coins[0]?.symbol||'BTCUSDT';
    updHdr();
    await initDataFetch();
    connectGlobalWS();
    
    // Periodically re-sort the top coins header list
    setInterval(() => {
      ST.coins.sort((a,b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
      updHdr();
    }, 30000);
    
    // Poll for Open Interest (not available via WS)
    setInterval(async () => {
      try {
        const oi = await fOI(ST.coin);
        ST.oi = oi;
        if(oi!=null) document.getElementById('ioi').textContent = fv(oi);
      } catch(e) {}
    }, 10000);
    
    // Backend Poller for active state (Viewer Mode)
    setInterval(async () => {
      try {
        const res = await fetch('/api/state');
        if(!res.ok) return;
        const state = await res.json();
        const checkNew = (oldS, newS) => {
            newS.forEach(ns => {
                const os = oldS.find(s => s.id === ns.id);
                if (!os) notifyNewSig(ns);
                else if (os.out !== ns.out) notifyOutcome(ns);
            });
        };
        checkNew(ST.sigs5, state.sigs5);
        checkNew(ST.sigs15, state.sigs15);
        checkNew(ST.sigs1h, state.sigs1h);
        
        ST.sigs5 = state.sigs5;
        ST.sigs15 = state.sigs15;
        ST.sigs1h = state.sigs1h;
        updActivePanel();
        if(ST.view==='report')renRep();
      } catch(e) {}
    }, 3000);

  }catch(err){
    document.getElementById('loading').innerHTML='<div style="text-align:center"><div style="color:#f6465d;font-size:14px;margin-bottom:8px">⚠ Failed</div><div style="color:#848e9c;font-size:12px;margin-bottom:14px">'+err.message+'</div><button onclick="init()" style="background:#2b3139;border:1px solid #48535f;color:#eaecef;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">🔄 Retry</button></div>';
  }
}
window.addEventListener('load',init);
