let chartRev = 0;

function renChart(){
  chartRev++;
  const tf=ST.activeTF;
  const cs=tf==='5m'?ST.c5:ST.c15;
  const sigs=tf==='5m'?ST.sigs5:ST.sigs15;
  if(!cs.length)return;

  const n=cs.length-1;
  const ts=cs.map(c=>c.t.toISOString());
  const cl=cs.map(c=>c.c),vl=cs.map(c=>c.v);
  const e9v=calcEMA(cl,9),e21v=calcEMA(cl,21),bbv=calcBB(cl),rsv=calcRSI(cl),mcv=calcMACD(cl);
  const atrv=calcATR(cs),curATR=atrv[n]||(cl[n]*.003);
  const traces=[];

  traces.push({type:'candlestick',x:ts,open:cs.map(c=>c.o),high:cs.map(c=>c.h),low:cs.map(c=>c.l),close:cl,
    name:ST.coin,increasing:{line:{color:'#0ecb81',width:1},fillcolor:'#0ecb81'},
    decreasing:{line:{color:'#f6465d',width:1},fillcolor:'#f6465d'},
    xaxis:'x',yaxis:'y',showlegend:false,whiskerwidth:0});
  traces.push({type:'scatter',mode:'lines',x:ts,y:e9v,name:'EMA9',line:{color:'#f0b90b',width:1.5},xaxis:'x',yaxis:'y'});
  traces.push({type:'scatter',mode:'lines',x:ts,y:e21v,name:'EMA21',line:{color:'#1890ff',width:1.5},xaxis:'x',yaxis:'y'});
  traces.push({type:'scatter',mode:'lines',x:ts,y:bbv.u,name:'BB',line:{color:'rgba(157,113,255,.5)',width:1,dash:'dot'},xaxis:'x',yaxis:'y',showlegend:false});
  traces.push({type:'scatter',mode:'lines',x:ts,y:bbv.l,line:{color:'rgba(157,113,255,.5)',width:1,dash:'dot'},fill:'tonexty',fillcolor:'rgba(157,113,255,.05)',xaxis:'x',yaxis:'y',showlegend:false,name:'BB'});
  
  const sr=findSR(cs);
  traces.push({type:'scatter',mode:'lines',x:[ts[0],ts[ts.length-1]],y:[sr.res,sr.res],name:'Res',line:{color:'rgba(246,70,93,.4)',width:1,dash:'dash'},xaxis:'x',yaxis:'y',showlegend:false});
  traces.push({type:'scatter',mode:'lines',x:[ts[0],ts[ts.length-1]],y:[sr.sup,sr.sup],name:'Sup',line:{color:'rgba(14,203,129,.4)',width:1,dash:'dash'},xaxis:'x',yaxis:'y',showlegend:false});

  const chartStart=cs[0].t.getTime(),chartEnd=cs[cs.length-1].t.getTime();
  const visSigs=sigs.filter(s=>s.sym===ST.coin&&new Date(s.ts).getTime()>=chartStart&&new Date(s.ts).getTime()<=chartEnd);
  const longs=visSigs.filter(s=>s.dir==='LONG'),shorts=visSigs.filter(s=>s.dir==='SHORT');
  if(longs.length){const lx=[],ly=[],lc=[],lt=[];longs.forEach(s=>{const best=closestCandle(cs,new Date(s.ts).getTime());lx.push(new Date(s.ts).toISOString());ly.push(best.l-curATR*.45);lc.push(sigColor(s));lt.push('<b>▲ LONG '+s.str+'</b> ['+s.tf+'] '+s.sc+'/'+s.mx+'<br>Entry: '+fp(s.entry)+' | SL: '+fp(s.sl)+'<br>TP1: '+fp(s.tp1)+' | TP2: '+fp(s.tp2)+'<br>'+s.out.replace('_',' '))});traces.push({type:'scatter',mode:'markers',x:lx,y:ly,marker:{color:lc,size:11,symbol:'triangle-up',line:{color:'rgba(0,0,0,.4)',width:1}},text:lt,hoverinfo:'text',name:'↑ Long',xaxis:'x',yaxis:'y'})}
  if(shorts.length){const sx=[],sy=[],sc=[],st2=[];shorts.forEach(s=>{const best=closestCandle(cs,new Date(s.ts).getTime());sx.push(new Date(s.ts).toISOString());sy.push(best.h+curATR*.45);sc.push(sigColor(s));st2.push('<b>▼ SHORT '+s.str+'</b> ['+s.tf+'] '+s.sc+'/'+s.mx+'<br>Entry: '+fp(s.entry)+' | SL: '+fp(s.sl)+'<br>TP1: '+fp(s.tp1)+' | TP2: '+fp(s.tp2)+'<br>'+s.out.replace('_',' '))});traces.push({type:'scatter',mode:'markers',x:sx,y:sy,marker:{color:sc,size:11,symbol:'triangle-down',line:{color:'rgba(0,0,0,.4)',width:1}},text:st2,hoverinfo:'text',name:'↓ Short',xaxis:'x',yaxis:'y'})}

  traces.push({type:'bar',x:ts,y:vl,name:'Vol',marker:{color:cs.map(c=>c.c>=c.o?'rgba(14,203,129,.5)':'rgba(246,70,93,.5)')},xaxis:'x',yaxis:'y2',showlegend:false});
  traces.push({type:'scatter',mode:'lines',x:ts,y:rsv,name:'RSI',line:{color:'#9d71ff',width:1.5},xaxis:'x',yaxis:'y3',showlegend:false});
  [[70,'rgba(246,70,93,.4)'],[30,'rgba(14,203,129,.4)'],[50,'rgba(132,142,156,.25)']].forEach(([v,c])=>traces.push({type:'scatter',mode:'lines',x:[ts[0],ts[ts.length-1]],y:[v,v],line:{color:c,width:1,dash:'dot'},xaxis:'x',yaxis:'y3',showlegend:false}));
  traces.push({type:'bar',x:ts,y:mcv.h,name:'MACD',marker:{color:mcv.h.map(v=>v==null?'transparent':v>=0?'rgba(14,203,129,.7)':'rgba(246,70,93,.7)')},xaxis:'x',yaxis:'y4',showlegend:false});
  traces.push({type:'scatter',mode:'lines',x:ts,y:mcv.ml,name:'MACD',line:{color:'#1890ff',width:1},xaxis:'x',yaxis:'y4',showlegend:false});
  traces.push({type:'scatter',mode:'lines',x:ts,y:mcv.sl,name:'Sig',line:{color:'#f0b90b',width:1},xaxis:'x',yaxis:'y4',showlegend:false});

  const shapes=[],anns=[];
  const lastTs=ts[ts.length-1];
  const allSigsForCoin=sigs.filter(s=>s.sym===ST.coin);
  const pendingSigs=allSigsForCoin.filter(s=>s.out==='PENDING');
  const recentClosed=allSigsForCoin.filter(s=>s.out!=='PENDING').slice(0,3);

  [...pendingSigs,...recentClosed].forEach(s=>{
    if (!s.entry || !s.sl || !s.tp1) return;
    const sigTs=new Date(s.ts).toISOString();
    if(new Date(s.ts).getTime()<chartStart||new Date(s.ts).getTime()>chartEnd)return;
    const isPending=s.out==='PENDING';
    const isL=s.dir==='LONG';
    const alpha=isPending?0.9:0.35;

    let endTs=lastTs;
    if(!isPending){
      const afterCs=cs.filter(c=>c.t.getTime()>new Date(s.ts).getTime());
      for(const c of afterCs){
        const hitSL=(isL&&c.l<=s.sl)||(!isL&&c.h>=s.sl);
        const hitTP=(isL&&c.h>=s.tp1)||(!isL&&c.l<=s.tp1);
        if(hitSL||hitTP){endTs=c.t.toISOString();break}
      }
    }

    const entrCol=`rgba(${isL?'14,203,129':'246,70,93'},${alpha})`;
    shapes.push({type:'line',x0:sigTs,x1:endTs,y0:s.entry,y1:s.entry,line:{color:entrCol,width:isPending?2:1,dash:'dashdot'},xref:'x',yref:'y'});
    shapes.push({type:'line',x0:sigTs,x1:endTs,y0:s.sl,y1:s.sl,line:{color:`rgba(246,70,93,${alpha})`,width:isPending?1.5:1,dash:'dash'},xref:'x',yref:'y'});
    shapes.push({type:'line',x0:sigTs,x1:endTs,y0:s.tp1,y1:s.tp1,line:{color:`rgba(82,196,26,${alpha})`,width:isPending?1.5:1,dash:'dash'},xref:'x',yref:'y'});
    shapes.push({type:'line',x0:sigTs,x1:endTs,y0:s.tp2,y1:s.tp2,line:{color:`rgba(14,203,129,${alpha})`,width:isPending?1.5:1,dash:'dash'},xref:'x',yref:'y'});

    if(isPending){
      const tfMk=s.tf==='15m'?'●':'•';
      const ab={xref:'x',yref:'y',showarrow:false,xanchor:'left',font:{size:9}};
      anns.push({...ab,x:sigTs,y:s.entry,text:tfMk+' '+(isL?'▲L':'▼S')+' '+fp(s.entry),font:{color:isL?'#0ecb81':'#f6465d',size:9},bgcolor:'rgba(11,14,17,.9)',bordercolor:isL?'#0ecb81':'#f6465d',borderwidth:1});
      anns.push({xref:'x',yref:'y',showarrow:false,xanchor:'right',font:{color:'#f6465d',size:9},x:endTs,y:s.sl,text:'SL '+fp(s.sl),bgcolor:'rgba(11,14,17,.88)',bordercolor:'#f6465d',borderwidth:1});
      anns.push({xref:'x',yref:'y',showarrow:false,xanchor:'right',font:{color:'#52c41a',size:9},x:endTs,y:s.tp1,text:'TP1 '+fp(s.tp1),bgcolor:'rgba(11,14,17,.88)',bordercolor:'#52c41a',borderwidth:1});
      anns.push({xref:'x',yref:'y',showarrow:false,xanchor:'right',font:{color:'#0ecb81',size:9},x:endTs,y:s.tp2,text:'TP2 '+fp(s.tp2),bgcolor:'rgba(11,14,17,.88)',bordercolor:'#0ecb81',borderwidth:1});
    } else {
      const oc={TP2_HIT:'#f0b90b',TP1_HIT:'#52c41a',SL_HIT:'#f6465d'}[s.out]||'#848e9c';
      const ol={TP2_HIT:'TP2✓',TP1_HIT:'TP1✓',SL_HIT:'SL✗'}[s.out]||'?';
      anns.push({xref:'x',yref:'y',showarrow:false,xanchor:'right',x:endTs,y:s.entry,text:ol,font:{color:oc,size:9},bgcolor:'rgba(11,14,17,.85)',bordercolor:oc,borderwidth:1});
    }
  });

  const curPx = cl[n];
  const curCol = cs[n].c >= cs[n].o ? '#0ecb81' : '#f6465d';
  shapes.push({type:'line',x0:ts[0],x1:ts[ts.length-1],y0:curPx,y1:curPx,line:{color:curCol,width:1,dash:'dot'},xref:'x',yref:'y'});
  anns.push({xref:'paper',yref:'y',showarrow:false,xanchor:'left',x:1,y:curPx,text:' '+fp(curPx),font:{color:'#000',size:10},bgcolor:curCol,bordercolor:curCol,borderwidth:1});

  const layout={
    datarevision: chartRev,
    uirevision: 'true',
    paper_bgcolor:'#0b0e11',plot_bgcolor:'#0b0e11',
    font:{color:'#848e9c',size:10},
    margin:{l:10,r:70,t:8,b:20},
    xaxis:{
      autorange:true,
      type:'date',
      rangeslider:{visible:false},
      showgrid:true,gridcolor:'#1e2329',
      zeroline:false,
      showticklabels:true,tickfont:{size:9},
      tickformat:'%H:%M\n%d %b'
    },
    yaxis: {domain:[0.42,1.00],side:'right',showgrid:true,gridcolor:'#1e2329',zeroline:false,tickfont:{size:9},autorange:true,fixedrange:false},
    yaxis2:{domain:[0.29,0.40],side:'right',showgrid:false,zeroline:false,tickfont:{size:8},rangemode:'nonnegative',title:{text:'Vol',font:{size:8,color:'#848e9c'}}},
    yaxis3:{domain:[0.15,0.27],side:'right',range:[0,100],showgrid:false,zeroline:false,tickfont:{size:8},title:{text:'RSI',font:{size:8,color:'#848e9c'}}},
    yaxis4:{domain:[0.00,0.13],side:'right',showgrid:false,zeroline:true,zerolinecolor:'#2b3139',tickfont:{size:8},title:{text:'MACD',font:{size:8,color:'#848e9c'}}},
    showlegend:true,legend:{x:0,y:1.01,orientation:'h',font:{size:9},bgcolor:'rgba(0,0,0,0)'},
    shapes,annotations:anns,
    hovermode:'x unified',
    hoverlabel:{bgcolor:'#1e2329',bordercolor:'#2b3139',font:{color:'#eaecef',size:10},namelength:-1}
  };
  const cfg={displayModeBar:true,modeBarButtonsToRemove:['toImage','sendDataToCloud','select2d','lasso2d'],displaylogo:false,responsive:true,scrollZoom:true};
  const el=document.getElementById('chartdiv');
  if(el._hp){Plotly.react('chartdiv',traces,layout,cfg)}
  else{Plotly.newPlot('chartdiv',traces,layout,cfg);el._hp=true}
}
