const BT = {
  data: { '5m': [], '15m': [], '1h': [], '4h': [], '1d': [] },
  sym: 'BTCUSDT',
  tf: '5m',
  days: 7,
  minScore: 10,
  tpMult: 1.5,
  slMult: 1.5,
  running: false,
  
  async run() {
    if (this.running) return;
    this.running = true;
    const btn = document.getElementById('bt-run-btn');
    btn.textContent = 'Running...';
    btn.disabled = true;
    
    try {
      this.sym = document.getElementById('bt-sym').value.toUpperCase() || 'BTCUSDT';
      this.tf = document.getElementById('bt-tf').value || '5m';
      this.days = parseInt(document.getElementById('bt-days').value) || 7;
      this.minScore = parseInt(document.getElementById('bt-score').value) || 10;
      this.tpMult = parseFloat(document.getElementById('bt-tp').value) || 1.5;
      this.slMult = parseFloat(document.getElementById('bt-sl').value) || 1.5;
      
      document.getElementById('bt-prog').innerHTML = '<div class="spin" style="display:inline-block;vertical-align:middle;margin-right:8px;width:14px;height:14px"></div>Downloading historical data...';
      
      // Calculate how many candles we need for the requested days
      const mins = this.days * 24 * 60;
      // We also need extra padding at the start for indicators
      const fetchMins = mins + (35 * 24 * 60); // fetch 35 days of padding for 1D EMA
      
      if (this.tf === '5m') {
        this.data['5m'] = await this.fetchAll(this.sym, '5m', Math.ceil(fetchMins / 5));
        this.data['15m'] = await this.fetchAll(this.sym, '15m', Math.ceil(fetchMins / 15));
        this.data['1h'] = await this.fetchAll(this.sym, '1h', Math.ceil(fetchMins / 60));
        this.data['1d'] = await this.fetchAll(this.sym, '1d', Math.ceil(fetchMins / 1440));
      } else if (this.tf === '15m') {
        this.data['15m'] = await this.fetchAll(this.sym, '15m', Math.ceil(fetchMins / 15));
        this.data['1h'] = await this.fetchAll(this.sym, '1h', Math.ceil(fetchMins / 60));
        this.data['4h'] = await this.fetchAll(this.sym, '4h', Math.ceil(fetchMins / 240));
        this.data['1d'] = await this.fetchAll(this.sym, '1d', Math.ceil(fetchMins / 1440));
      } else if (this.tf === '1h') {
        this.data['1h'] = await this.fetchAll(this.sym, '1h', Math.ceil(fetchMins / 60));
        this.data['4h'] = await this.fetchAll(this.sym, '4h', Math.ceil(fetchMins / 240));
        this.data['1d'] = await this.fetchAll(this.sym, '1d', Math.ceil(fetchMins / 1440));
      }
      
      document.getElementById('bt-prog').innerHTML = '<div class="spin" style="display:inline-block;vertical-align:middle;margin-right:8px;width:14px;height:14px"></div>Simulating trades...';
      
      await new Promise(r => setTimeout(r, 100)); // allow UI update
      
      const results = this.simulate();
      this.renderResults(results);
      
    } catch (e) {
      document.getElementById('bt-prog').textContent = 'Error: ' + e.message;
    } finally {
      this.running = false;
      btn.textContent = 'Run Backtest';
      btn.disabled = false;
    }
  },
  
  async fetchAll(sym, tf, totalNeeded) {
    let all = [];
    let endTime = Date.now();
    const limit = 1000;
    
    while (all.length < totalNeeded) {
      const needed = Math.min(limit, totalNeeded - all.length);
      const batch = await fC(sym, tf, needed, endTime);
      if (batch.length === 0) break;
      
      all = batch.concat(all);
      endTime = batch[0].t.getTime() - 1;
      
      // Safety break to prevent infinite loops if API returns empty
      if (batch.length < 50) break; 
    }
    
    // Sort chronological just in case
    all.sort((a,b) => a.t.getTime() - b.t.getTime());
    return all.slice(-totalNeeded);
  },
  
  simulate() {
    const baseC = this.data[this.tf];
    const trades = [];
    let activeTrades = [];
    let equityCurve = [{ t: baseC[0].t, eq: 100 }];
    let curEq = 100;
    
    // We need at least 200 candles for indicators to warm up
    const targetStartTime = Date.now() - (this.days * 24 * 60 * 60 * 1000);
    const startIdx = Math.max(200, baseC.findIndex(c => c.t.getTime() >= targetStartTime));
    
    const dataHtf1 = this.tf === '5m' ? this.data['15m'] : (this.tf === '15m' ? this.data['1h'] : this.data['4h']);
    const dataHtf2 = this.tf === '5m' ? this.data['1h'] : (this.tf === '15m' ? this.data['4h'] : this.data['1d']);
    const dataMacro = this.data['1d'];
    let idxHtf1 = 0, idxHtf2 = 0, idxMacro = 0;
    
    for (let i = startIdx; i < baseC.length; i++) {
      const curCandle = baseC[i];
      const curTime = curCandle.t.getTime();
      
      // Update active trades (simulating Stop Loss / Take Profit hits)
      // Check for hits within the CURRENT 5m candle
      for (let j = activeTrades.length - 1; j >= 0; j--) {
        const t = activeTrades[j];
        let hit = null;
        
        if (t.dir === 'LONG') {
          if (curCandle.l <= t.sl) hit = 'SL';
          else if (curCandle.h >= t.tp) hit = 'TP';
        } else {
          if (curCandle.h >= t.sl) hit = 'SL';
          else if (curCandle.l <= t.tp) hit = 'TP';
        }
        
        if (hit) {
          const slDist = Math.abs(t.entry - t.origSl);
          const tpDist = Math.abs(t.tp - t.entry);
          const rr = tpDist / slDist;
          
          let pnlPct = 0;
          if (hit === 'TP') pnlPct = rr;
          else if (hit === 'SL') pnlPct = -1;
          
          curEq *= (1 + (pnlPct / 100)); // Compound growth
          
          t.exitTime = curCandle.t;
          t.outcome = hit;
          t.pnl = pnlPct;
          
          equityCurve.push({ t: curCandle.t, eq: curEq });
          trades.push(t);
          activeTrades.splice(j, 1);
        }
      }
      
      // Generate signals at the close of the current candle
      const curC = baseC.slice(i - 200, i + 1);
      
      while(idxHtf1 < dataHtf1.length && dataHtf1[idxHtf1].t.getTime() <= curTime) idxHtf1++;
      while(idxHtf2 < dataHtf2.length && dataHtf2[idxHtf2].t.getTime() <= curTime) idxHtf2++;
      while(idxMacro < dataMacro.length && dataMacro[idxMacro].t.getTime() <= curTime) idxMacro++;
      
      const htf1 = dataHtf1.slice(Math.max(0, idxHtf1 - 200), idxHtf1);
      const htf2 = dataHtf2.slice(Math.max(0, idxHtf2 - 100), idxHtf2);
      const macro = dataMacro.slice(Math.max(0, idxMacro - 50), idxMacro);
      
      // We pass custom SL/TP multipliers for backtest
      const sig = genSig(curC, htf1, htf2, macro, null, this.tf, this.sym, this.slMult, this.tpMult);
      
      if (sig && sig.sc >= this.minScore) {
        const entry = curCandle.c;
        const cat = sig.cat;
        const isL = sig.dir === 'LONG';
        const sl = isL ? entry - (cat * this.slMult) : entry + (cat * this.slMult);
        const tp = isL ? entry + (cat * this.tpMult) : entry - (cat * this.tpMult);
        
        // Prevent opening duplicate overlapping signals
        if (!activeTrades.find(x => x.dir === sig.dir)) {
          activeTrades.push({
            time: curCandle.t,
            dir: sig.dir,
            entry: entry,
            sl: sl,
            origSl: sl,
            tp: tp,
            score: sig.sc
          });
        }
      }
      
      // Log equity periodically to draw curve even if no trades close
      if (i % 50 === 0) {
          equityCurve.push({ t: curCandle.t, eq: curEq });
      }
    }
    
    // Close any remaining active trades at market price
    const lastCandle = baseC[baseC.length - 1];
    for (const t of activeTrades) {
        const pnl = t.dir === 'LONG' ? (lastCandle.c - t.entry) / t.entry : (t.entry - lastCandle.c) / t.entry;
        const slDist = Math.abs(t.entry - t.origSl) / t.entry;
        const pnlPct = (pnl / slDist); // in multiples of risk
        
        curEq *= (1 + (pnlPct / 100));
        t.exitTime = lastCandle.t;
        t.outcome = pnl > 0 ? 'TP (Close)' : 'SL (Close)';
        t.pnl = pnlPct;
        trades.push(t);
        equityCurve.push({ t: lastCandle.t, eq: curEq });
    }
    
    return { trades, equityCurve };
  },
  
  renderResults(res) {
    const { trades, equityCurve } = res;
    
    const total = trades.length;
    const wins = trades.filter(t => t.pnl > 0).length;
    const bes = trades.filter(t => t.pnl === 0).length;
    const losses = trades.filter(t => t.pnl < 0).length;
    const wr = total > 0 ? (wins / total * 100).toFixed(1) : 0;
    
    const finalEq = equityCurve[equityCurve.length - 1].eq;
    const netPnL = (finalEq - 100).toFixed(2);
    
    // Max Drawdown
    let maxEq = 100;
    let maxDd = 0;
    for(const pt of equityCurve) {
      if (pt.eq > maxEq) maxEq = pt.eq;
      const dd = (maxEq - pt.eq) / maxEq * 100;
      if (dd > maxDd) maxDd = dd;
    }
    
    document.getElementById('bt-prog').innerHTML = `<span style="color:#0ecb81">✓ Complete.</span> Simulated ${this.days} days.`;
    
    const metricsHtml = `
      <div class="scard"><div class="sv2">${total}</div><div class="sl2">Total Trades (${wins}W / ${losses}L)</div></div>
      <div class="scard"><div class="sv2" style="color:${wr >= 50 ? '#0ecb81' : '#f6465d'}">${wr}%</div><div class="sl2">Win Rate</div></div>
      <div class="scard"><div class="sv2" style="color:${netPnL >= 0 ? '#0ecb81' : '#f6465d'}">${netPnL > 0 ? '+' : ''}${netPnL}%</div><div class="sl2">Net PnL (Compounded)</div></div>
      <div class="scard"><div class="sv2" style="color:#f6465d">-${maxDd.toFixed(2)}%</div><div class="sl2">Max Drawdown</div></div>
    `;
    
    document.getElementById('bt-metrics').innerHTML = metricsHtml;
    
    // Render Equity Curve using Plotly
    const trace = {
      x: equityCurve.map(p => p.t),
      y: equityCurve.map(p => p.eq),
      type: 'scatter',
      mode: 'lines',
      line: { color: netPnL >= 0 ? '#0ecb81' : '#f6465d', width: 2 },
      fill: 'tozeroy',
      fillcolor: netPnL >= 0 ? 'rgba(14, 203, 129, 0.1)' : 'rgba(246, 70, 93, 0.1)'
    };
    
    const layout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      margin: { t: 20, r: 20, b: 30, l: 40 },
      xaxis: { showgrid: true, gridcolor: '#2b3139', tickfont: { color: '#848e9c' } },
      yaxis: { showgrid: true, gridcolor: '#2b3139', tickfont: { color: '#848e9c' } },
      showlegend: false
    };
    
    Plotly.newPlot('bt-chart', [trace], layout, {responsive: true});
    
    // Render Trade History
    const tbody = trades.slice().reverse().map(t => {
      const d = t.time;
      const tstr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      const isL = t.dir === 'LONG';
      const col = t.pnl > 0 ? '#0ecb81' : '#f6465d';
      return `<div class="tr"><span style="color:#848e9c">${tstr}</span><span>${this.sym}</span><span class="${isL?'bdl':'bds'}">${t.dir}</span><span>${fp(t.entry)}</span><span><span style="color:#f6465d">${fp(t.sl)}</span>→<span style="color:var(--gr)">${fp(t.tp)}</span></span><span>${t.score}/13</span><span style="color:${col}">${t.pnl>0?'+':''}${t.pnl.toFixed(2)}% (${t.outcome})</span></div>`;
    }).join('');
    
    document.getElementById('bt-history').innerHTML = tbody || '<div style="padding:14px;text-align:center;color:#848e9c;font-size:11px">No trades found matching criteria.</div>';
  }
};
