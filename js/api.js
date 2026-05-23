const B='https://fapi.binance.com';
async function fj(u){const r=await fetch(u);if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
async function fCoins(){const d=await fj(B+'/fapi/v1/ticker/24hr');return d.filter(t=>t.symbol.endsWith('USDT')&&!t.symbol.includes('_')).sort((a,b)=>parseFloat(b.quoteVolume)-parseFloat(a.quoteVolume)).slice(0,20)}
async function fC(sym,iv,lim=200,et=null){const u=B+'/fapi/v1/klines?symbol='+sym+'&interval='+iv+'&limit='+lim+(et?'&endTime='+et:'');const d=await fj(u);return d.map(x=>({t:new Date(x[0]),o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5]}))}
async function fFR(s){try{return +(await fj(B+'/fapi/v1/premiumIndex?symbol='+s)).lastFundingRate}catch{return null}}
async function fOI(s){try{return +(await fj(B+'/fapi/v1/openInterest?symbol='+s)).openInterest}catch{return null}}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fC, fCoins, fFR, fOI };
}
