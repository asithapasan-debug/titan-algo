function genSig(primary,htf1,htf2,macro,fr,tf,sym=ST.coin, customSlM=null, customTpM=null){
  if(primary.length<30)return null;
  const cl=primary.map(c=>c.c),n=cl.length-1,pr=cl[n];
  const e9=calcEMA(cl,9),e21=calcEMA(cl,21),rs=calcRSI(cl),mc=calcMACD(cl),bbs=calcBB(cl),at=calcATR(primary),cv=calcCVD(primary);
  const st=detectStruct(primary),pt=detectPats(primary),SR=findSR(primary);
  const pivots=findPivots(primary),gp=detectGeometric(pivots);
  const vols=primary.map(c=>c.v),avv=vols.slice(-20).reduce((a,b)=>a+b)/20,cuv=vols[n];
  const clH1=htf1.map(c=>c.c),eH1=calcEMA(clH1,21),bH1=clH1[clH1.length-1]>eH1[eH1.length-1];
  const clH2=htf2.map(c=>c.c),eH2=calcEMA(clH2,21),bH2=clH2[clH2.length-1]>eH2[eH2.length-1];
  const clM=macro.map(c=>c.c),eM=calcEMA(clM,21),bM=clM[clM.length-1]>eM[eM.length-1];
  const crs=rs[n],cml=mc.ml[n],pml=mc.ml[n-1],csl=mc.sl[n],psl=mc.sl[n-1];
  const cbu=bbs.u[n],cbl=bbs.l[n],cat=at[n]||(pr*.005),ccv=cv[n],pcv=cv[Math.max(0,n-5)];
  const vwap=calcVWAP(primary),cVWAP=vwap[n];
  const obs=findOBs(primary,at);
  let ls=0,ss=0;const lr=[],sr2=[];
  const h1l=tf==='5m'?'15m':'1h',h2l=tf==='5m'?'1h':'4h';
  
  // Oscillators (Weighted low: max 1 pt)
  if(e9[n]>e21[n]){ls+=1;lr.push('EMA9 above EMA21')}else{ss+=1;sr2.push('EMA9 below EMA21')}
  if(crs!=null){if(crs>45&&crs<65){ls+=0.5;lr.push('RSI '+crs.toFixed(0)+' bullish')}else if(crs<30){ls+=1;lr.push('RSI '+crs.toFixed(0)+' oversold')};if(crs>35&&crs<55){ss+=0.5;sr2.push('RSI '+crs.toFixed(0)+' bearish')}else if(crs>70){ss+=1;sr2.push('RSI '+crs.toFixed(0)+' overbought')}}
  if(cml!=null&&csl!=null&&pml!=null&&psl!=null){if(cml>csl&&pml<=psl){ls+=1;lr.push('MACD bullish crossover')}else if(cml>csl)ls+=.5;if(cml<csl&&pml>=psl){ss+=1;sr2.push('MACD bearish crossover')}else if(cml<csl)ss+=.5}
  if(cbl!=null){if(pr<=cbl){ls+=0.5;lr.push('Price at lower BB')}else if(pr<(cbl+(cbu-cbl)*.35))ls+=.25;if(pr>=cbu){ss+=0.5;sr2.push('Price at upper BB')}else if(pr>(cbl+(cbu-cbl)*.65))ss+=.25}
  
  // Volume & Context (Weighted medium)
  if(cuv>avv*1.5){ls+=1;ss+=1;lr.push('Volume spike 1.5x');sr2.push('Volume spike 1.5x')}
  if(ccv>pcv){ls+=1;lr.push('CVD rising — buy pressure')}else{ss+=1;sr2.push('CVD falling — sell pressure')}
  if(fr!=null){if(fr<-0.0001){ls+=1;lr.push('Negative funding')}else if(fr>0.0001){ss+=1;sr2.push('Positive funding')}}
  const bp=pt.find(p=>p.includes('Bullish')||p==='Piercing Line'),dp=pt.find(p=>p.includes('Bearish')||p==='Dark Cloud Cover');
  if(bp){ls+=1;lr.push(bp)}if(dp){ss+=1;sr2.push(dp)}
  
  // Smart Money & Structure & HTF (Weighted high: 2-3 pts)
  if(bH1){ls+=3;lr.push(h1l+' trend bullish (+3)')}else{ss+=3;sr2.push(h1l+' trend bearish (+3)')}
  if(bH2){ls+=2;lr.push(h2l+' trend bullish (+2)')}else{ss+=2;sr2.push(h2l+' trend bearish (+2)')}
  if(st==='uptrend'){ls+=2;lr.push('Structure uptrend (+2)')}else if(st==='downtrend'){ss+=2;sr2.push('Structure downtrend (+2)')}
  const bgp=gp.find(p=>p==='Double Bottom'||p==='Inverse Head & Shoulders'),dgp=gp.find(p=>p==='Double Top'||p==='Head and Shoulders');
  if(bgp){ls+=2;lr.push(bgp+' (+2)')}if(dgp){ss+=2;sr2.push(dgp+' (+2)')}
  const srng=(SR.res-SR.sup)*.05;
  if(Math.abs(pr-SR.sup)<=srng){ls+=1.5;lr.push('Price near support')}
  if(Math.abs(pr-SR.res)<=srng){ss+=1.5;sr2.push('Price near resistance')}
  if(pr>cVWAP){ls+=2;lr.push('Price > VWAP (+2)')}else{ss+=2;sr2.push('Price < VWAP (+2)')}
  if(obs.bullish&&pr<=obs.bullish.top+(obs.bullish.top-obs.bullish.bot)*0.2&&pr>=obs.bullish.bot){ls+=3;lr.push('Tapping Bullish Order Block (+3)')}
  if(obs.bearish&&pr>=obs.bearish.bot-(obs.bearish.top-obs.bearish.bot)*0.2&&pr<=obs.bearish.top){ss+=3;sr2.push('Tapping Bearish Order Block (+3)')}
  
  const il=ls>=ss,sc=Math.round(Math.max(ls,ss)),reasons=il?lr:sr2;
  
  // Strict Rejections
  if(il && (!bH1 || ((tf==='15m' || tf==='1h') && !bH2))) return null;
  if(!il && (bH1 || ((tf==='15m' || tf==='1h') && bH2))) return null;
  // Macro Filter: Block trades against the 1-Day trend
  if(il && !bM) return null;
  if(!il && bM) return null;
  
  let str='WEAK';if(sc>=15)str='STRONG';else if(sc>=10)str='MEDIUM';
  let defM = tf==='1h' ? 2.5 : (tf==='15m' ? 2.0 : 1.5);
  if(sym!=='BTCUSDT') defM += 0.7;
  const slM = customSlM || defM;
  const tpM = customTpM || slM;
  
  const sl2=il?pr-cat*slM:pr+cat*slM;
  const tp1=il?pr+cat*tpM:pr-cat*tpM;
  const tp2=il?pr+cat*(tpM*1.5):pr-cat*(tpM*1.5);
  const tp3=il?pr+cat*(tpM*2.5):pr-cat*(tpM*2.5);
  const entryLow=il?pr-cat*0.3:pr;
  const entryHigh=il?pr:pr+cat*0.3;
  
  const candleTime = primary[primary.length-1].t.getTime();
  const sigId = sym + '_' + tf + '_' + candleTime;
  
  return{id:sigId,sym:sym,tf,dir:il?'LONG':'SHORT',str,sc,mx:23,entry:pr,entryLow,entryHigh,sl:sl2,tp1,tp2,tp3,rr:Math.abs(tp1-pr)/Math.abs(sl2-pr),reasons,ts:candleTime,out:'PENDING',rsi:crs,e9v:e9[n],e21v:e21[n],st,h1lbl:h1l,h2lbl:h2l,h1:bH1?'BULL':'BEAR',h2:bH2?'BULL':'BEAR',fr,bbu:cbu,bbl:cbl,cat,avgVol:avv,curVol:cuv,vwap:cVWAP};
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { genSig };
}
