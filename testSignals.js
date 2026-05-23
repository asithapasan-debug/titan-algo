const fs = require('fs');
const https = require('https');

const B = 'https://fapi.binance.com';
async function fj(u) {
  return new Promise((resolve, reject) => {
    https.get(u, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}
async function fCoins() {
  const d = await fj(B + '/fapi/v1/ticker/24hr');
  return d.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'))
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)).slice(0, 20);
}
async function fC(sym, iv, lim = 200) {
  const u = B + '/fapi/v1/klines?symbol=' + sym + '&interval=' + iv + '&limit=' + lim;
  const d = await fj(u);
  return d.map(x => ({ t: new Date(x[0]), o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: +x[5] }));
}
async function fFR(s) {
  try { return +(await fj(B + '/fapi/v1/premiumIndex?symbol=' + s)).lastFundingRate; } catch { return null; }
}

function calcEMA(p, n) { const k = 2 / (n + 1), r = [p[0]]; for (let i = 1; i < p.length; i++) r.push(p[i] * k + r[i - 1] * (1 - k)); return r }
function calcRSI(p, n = 14) {
  if (p.length < n + 1) return p.map(() => 50); const g = [], l = []; for (let i = 1; i < p.length; i++) { const d = p[i] - p[i - 1]; g.push(d > 0 ? d : 0); l.push(d < 0 ? -d : 0) } let ag = g.slice(0, n).reduce((a, b) => a + b) / n, al = l.slice(0, n).reduce((a, b) => a + b) / n; const r = new Array(n).fill(null); r.push(100 - 100 / (1 + ag / (al || 1e-10))); for (let i = n; i < g.length; i++) { ag = (ag * (n - 1) + g[i]) / n; al = (al * (n - 1) + l[i]) / n; r.push(100 - 100 / (1 + ag / (al || 1e-10))) } return r
}
function calcMACD(p) { const f = calcEMA(p, 12), s = calcEMA(p, 26), ml = f.map((v, i) => v - s[i]), sl = calcEMA(ml.slice(25), 9), fsl = [...new Array(25).fill(null), ...sl]; return { ml, sl: fsl, h: ml.map((v, i) => fsl[i] != null ? v - fsl[i] : null) } }
function calcBB(p, n = 20, m = 2) { const u = [], mi = [], lo = []; for (let i = 0; i < p.length; i++) { if (i < n - 1) { u.push(null); mi.push(null); lo.push(null); continue } const sl = p.slice(i - n + 1, i + 1), mn = sl.reduce((a, b) => a + b) / n, sd = Math.sqrt(sl.reduce((a, b) => a + (b - mn) ** 2, 0) / n); u.push(mn + m * sd); mi.push(mn); lo.push(mn - m * sd) } return { u, m: mi, l: lo } }
function calcATR(cs, n = 14) { const tr = cs.map((c, i) => { if (!i) return c.h - c.l; const p = cs[i - 1]; return Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)) }); if (tr.length < n) return tr; let a = tr.slice(0, n).reduce((x, y) => x + y) / n; const r = new Array(n - 1).fill(null); r.push(a); for (let i = n; i < tr.length; i++) { a = (a * (n - 1) + tr[i]) / n; r.push(a) } return r }
function calcCVD(cs) { const r = [0]; for (let i = 1; i < cs.length; i++) { const c = cs[i], rng = (c.h - c.l) || 1e-10; r.push(r[r.length - 1] + c.v * (2 * (c.c - c.l) / rng - 1)) } return r }
function detectStruct(cs) { if (cs.length < 20) return 'ranging'; const rc = cs.slice(-20), h1 = Math.max(...rc.slice(0, 10).map(c => c.h)), h2 = Math.max(...rc.slice(10).map(c => c.h)), l1 = Math.min(...rc.slice(0, 10).map(c => c.l)), l2 = Math.min(...rc.slice(10).map(c => c.l)); if (h2 > h1 && l2 > l1) return 'uptrend'; if (h2 < h1 && l2 < l1) return 'downtrend'; return 'ranging' }
function detectPats(cs) { if (cs.length < 2) return []; const c = cs[cs.length - 1], p = cs[cs.length - 2], bd = Math.abs(c.c - c.o), rng = (c.h - c.l) || 1e-10, uw = c.h - Math.max(c.o, c.c), lw = Math.min(c.o, c.c) - c.l, r = []; if (bd < rng * .1) r.push('Doji'); if (c.c > c.o && p.c < p.o && c.o <= p.c && c.c >= p.o) r.push('Bullish Engulfing'); if (c.c < c.o && p.c > p.o && c.o >= p.c && c.c <= p.o) r.push('Bearish Engulfing'); if (lw > bd * 2 && lw > uw * 2 && bd > 0) r.push('Bullish Pin Bar'); if (uw > bd * 2 && uw > lw * 2 && bd > 0) r.push('Bearish Pin Bar'); return r }
function findSR(cs, lb = 30) { const rc = cs.slice(-lb); return { res: Math.max(...rc.map(c => c.h)), sup: Math.min(...rc.map(c => c.l)) } }

function genSig(primary, htf1, htf2, fr, tf, sym) {
  if (primary.length < 30) return null;
  const cl = primary.map(c => c.c), n = cl.length - 1, pr = cl[n];
  const e9 = calcEMA(cl, 9), e21 = calcEMA(cl, 21), rs = calcRSI(cl), mc = calcMACD(cl), bbs = calcBB(cl), at = calcATR(primary), cv = calcCVD(primary);
  const st = detectStruct(primary), pt = detectPats(primary), SR = findSR(primary);
  const vols = primary.map(c => c.v), avv = vols.slice(-20).reduce((a, b) => a + b) / 20, cuv = vols[n];
  
  if (cuv < avv * 1.2) return { failReason: 'NO VOLUME SPIKE' }; // Log fail reason
  
  const clH1 = htf1.map(c => c.c), eH1 = calcEMA(clH1, 21), bH1 = clH1[clH1.length - 1] > eH1[eH1.length - 1];
  const clH2 = htf2.map(c => c.c), eH2 = calcEMA(clH2, 21), bH2 = clH2[clH2.length - 1] > eH2[eH2.length - 1];
  const crs = rs[n], cml = mc.ml[n], pml = mc.ml[n - 1], csl = mc.sl[n], psl = mc.sl[n - 1];
  const cbu = bbs.u[n], cbl = bbs.l[n], cat = at[n] || (pr * .005), ccv = cv[n], pcv = cv[Math.max(0, n - 5)];
  let ls = 0, ss = 0; const lr = [], sr2 = [];
  const h1l = tf === '5m' ? '15m' : '1h', h2l = tf === '5m' ? '1h' : '4h';
  if (e9[n] > e21[n]) { ls += 1; lr.push('EMA9 above EMA21') } else { ss += 1; sr2.push('EMA9 below EMA21') }
  if (crs != null) { if (crs > 45 && crs < 65) { ls += 1; lr.push('RSI ' + crs.toFixed(0) + ' bullish zone') } else if (crs < 30) { ls += 1; lr.push('RSI ' + crs.toFixed(0) + ' oversold') }; if (crs > 35 && crs < 55) { ss += 1; sr2.push('RSI ' + crs.toFixed(0) + ' bearish zone') } else if (crs > 70) { ss += 1; sr2.push('RSI ' + crs.toFixed(0) + ' overbought') } }
  if (cml != null && csl != null && pml != null && psl != null) { if (cml > csl && pml <= psl) { ls += 1; lr.push('MACD bullish crossover') } else if (cml > csl) ls += .5; if (cml < csl && pml >= psl) { ss += 1; sr2.push('MACD bearish crossover') } else if (cml < csl) ss += .5 }
  if (cbl != null) { if (pr <= cbl) { ls += 1; lr.push('Price at lower BB') } else if (pr < (cbl + (cbu - cbl) * .35)) ls += .5; if (pr >= cbu) { ss += 1; sr2.push('Price at upper BB') } else if (pr > (cbl + (cbu - cbl) * .65)) ss += .5 }
  if (cuv > avv * 1.5) { ls += 1; ss += 1; lr.push('Volume spike 1.5x'); sr2.push('Volume spike 1.5x') }
  if (bH1) { ls += 1; lr.push(h1l + ' trend bullish') } else { ss += 1; sr2.push(h1l + ' trend bearish') }
  if (bH2) { ls += 1; lr.push(h2l + ' trend bullish') } else { ss += 1; sr2.push(h2l + ' trend bearish') }
  if (st === 'uptrend') { ls += 1; lr.push('Structure uptrend') } else if (st === 'downtrend') { ss += 1; sr2.push('Structure downtrend') }
  const bp = pt.find(p => p.includes('Bullish')), dp = pt.find(p => p.includes('Bearish'));
  if (bp) { ls += 1; lr.push(bp) } if (dp) { ss += 1; sr2.push(dp) }
  if (ccv > pcv) { ls += 1; lr.push('CVD rising — buy pressure') } else { ss += 1; sr2.push('CVD falling — sell pressure') }
  if (fr != null) { if (fr < -0.0001) { ls += 1; lr.push('Negative funding ' + (fr * 100).toFixed(4) + '%') } else if (fr > 0.0001) { ss += 1; sr2.push('Positive funding ' + (fr * 100).toFixed(4) + '%') } }
  const srng = (SR.res - SR.sup) * .05;
  if (Math.abs(pr - SR.sup) <= srng) { ls += 1; lr.push('Price near support') }
  if (Math.abs(pr - SR.res) <= srng) { ss += 1; sr2.push('Price near resistance') }
  
  const il = ls >= ss, sc = Math.round(Math.max(ls, ss)), reasons = il ? lr : sr2;
  
  if (il && (!bH1 || (tf === '15m' && !bH2))) return { failReason: 'HTF TREND LONG BLOCKED', sc, il };
  if (!il && (bH1 || (tf === '15m' && bH2))) return { failReason: 'HTF TREND SHORT BLOCKED', sc, il };

  let str = 'WEAK'; if (sc >= 10) str = 'STRONG'; else if (sc >= 6) str = 'MEDIUM';
  const atrM = sym === 'BTCUSDT' ? 1.5 : 2.2;
  const sl2 = il ? pr - cat * atrM : pr + cat * atrM, tp1 = il ? pr + cat * atrM : pr - cat * atrM, tp2 = il ? pr + cat * (atrM * 2) : pr - cat * (atrM * 2);
  const candleTime = primary[primary.length - 1].t.getTime();
  const sigId = sym + '_' + tf + '_' + candleTime;
  return { id: sigId, sym: sym, tf, dir: il ? 'LONG' : 'SHORT', str, sc, mx: 13, entry: pr, sl: sl2, tp1, tp2, rr: Math.abs(tp1 - pr) / Math.abs(sl2 - pr), reasons, ts: candleTime, out: 'PENDING', rsi: crs, e9v: e9[n], e21v: e21[n], st, h1lbl: h1l, h2lbl: h2l, h1: bH1 ? 'BULL' : 'BEAR', h2: bH2 ? 'BULL' : 'BEAR', fr, bbu: cbu, bbl: cbl, cat, avgVol: avv, curVol: cuv };
}

async function runTest() {
  const coins = await fCoins();
  let sigs5 = 0, sigs15 = 0;
  let fails5 = {}, fails15 = {};
  
  for (const c of coins) {
    const sym = c.symbol;
    const [c5, c15, c1h, c4h, fr] = await Promise.all([
      fC(sym, '5m', 200),
      fC(sym, '15m', 200),
      fC(sym, '1h', 100),
      fC(sym, '4h', 50),
      fFR(sym)
    ]);
    
    // Evaluate across last 10 candles
    for(let offset=10; offset>=0; offset--) {
      const bC5 = c5.slice(0, c5.length - offset);
      const bC15 = c15.filter(x => x.t.getTime() <= bC5[bC5.length-1].t.getTime());
      const bC1h = c1h.filter(x => x.t.getTime() <= bC5[bC5.length-1].t.getTime());
      const bC4h = c4h.filter(x => x.t.getTime() <= bC5[bC5.length-1].t.getTime());
      
      const s5 = genSig(bC5, bC15, bC1h, fr, '5m', sym);
      if (s5 && s5.id) {
         if (s5.sc >= 5) sigs5++;
      } else if (s5 && s5.failReason) {
         fails5[s5.failReason] = (fails5[s5.failReason] || 0) + 1;
      }
      
      const s15 = genSig(bC15, bC1h, bC4h, fr, '15m', sym);
      if (s15 && s15.id) {
         if (s15.sc >= 5) sigs15++;
      } else if (s15 && s15.failReason) {
         fails15[s15.failReason] = (fails15[s15.failReason] || 0) + 1;
      }
    }
  }
  
  console.log('5m Signals generated:', sigs5);
  console.log('5m Failures:', fails5);
  console.log('15m Signals generated:', sigs15);
  console.log('15m Failures:', fails15);
}

runTest();
