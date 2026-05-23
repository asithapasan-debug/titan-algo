require('dotenv').config();
const mongoose = require('mongoose');
const { fC, fCoins, fFR, fOI } = require('./js/api.js');
const { calcEMA, calcRSI, calcMACD, calcBB, calcATR, calcCVD, detectStruct, detectPats, findPivots, detectGeometric, findSR, calcADX, calcVWAP, findOBs } = require('./js/indicators.js');
const { genSig } = require('./js/signalEngine.js');

// Inject globals for signalEngine which was written for browser
global.calcEMA = calcEMA;
global.calcRSI = calcRSI;
global.calcMACD = calcMACD;
global.calcBB = calcBB;
global.calcATR = calcATR;
global.calcCVD = calcCVD;
global.detectStruct = detectStruct;
global.detectPats = detectPats;
global.findPivots = findPivots;
global.detectGeometric = detectGeometric;
global.findSR = findSR;
global.calcADX = calcADX;
global.calcVWAP = calcVWAP;
global.findOBs = findOBs;

const appStateSchema = new mongoose.Schema({
    id: { type: String, default: 'main' },
    sigs5: { type: Array, default: [] },
    sigs15: { type: Array, default: [] },
    sigs1h: { type: Array, default: [] },
    coins: { type: Array, default: [] },
    stats: { type: Object, default: null }
});
const AppState = mongoose.model('AppState', appStateSchema);

const Engine = {
    active: false,
    onNewSignal: null,
    onOutcome: null,
    DB: {
        sigs5: [], sigs15: [], sigs1h: [],
        coins: [],
        stats: null
    },
    
    async start(onSig, onOut) {
        this.onNewSignal = onSig;
        this.onOutcome = onOut;
        
        // Init Stats with local date
        const dInit = new Date();
        const initDateStr = dInit.getFullYear() + '-' + String(dInit.getMonth()+1).padStart(2,'0') + '-' + String(dInit.getDate()).padStart(2,'0');
        this.DB.stats = { today: { wins: 0, losses: 0, pnl: 0, reported: false }, date: initDateStr };

        if (!process.env.MONGO_URI) {
            console.error("CRITICAL: MONGO_URI is missing in .env. Engine cannot start.");
            return;
        }

        try {
            await mongoose.connect(process.env.MONGO_URI);
            console.log("✅ Successfully connected to MongoDB Atlas");
            
            let doc = await AppState.findOne({ id: 'main' });
            if (!doc) {
                doc = new AppState({ id: 'main', stats: this.DB.stats });
                await doc.save();
            } else {
                this.DB.sigs5 = doc.sigs5 || [];
                this.DB.sigs15 = doc.sigs15 || [];
                this.DB.sigs1h = doc.sigs1h || [];
                if (doc.stats && doc.stats.date) {
                    this.DB.stats = doc.stats;
                }
            }
            this.active = true;
        } catch (e) {
            console.error("❌ MongoDB Connection Error:", e.message);
            return;
        }
        
        try {
            this.DB.coins = await fCoins();
            await this.saveDB();
        } catch(e) {
            console.error("❌ INITIAL COIN FETCH FAILED:", e.message);
        }
        
        setInterval(async () => {
            try {
                this.DB.coins = await fCoins();
                await this.saveDB();
            } catch(e){
                console.error("❌ INTERVAL COIN FETCH FAILED:", e.message);
            }
        }, 30 * 60 * 1000);
        
        this.loop();
    },
    
    async saveDB() {
        try {
            await AppState.findOneAndUpdate(
                { id: 'main' },
                { $set: { 
                    sigs5: this.DB.sigs5, 
                    sigs15: this.DB.sigs15, 
                    sigs1h: this.DB.sigs1h, 
                    coins: this.DB.coins, 
                    stats: this.DB.stats 
                }},
                { upsert: true }
            );
        } catch (e) {
            console.error("Failed to save to MongoDB", e.message);
        }
    },
    
    updateStats(win, loss, pnlChange) {
        const d = new Date();
        const todayStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        
        if (this.DB.stats.date !== todayStr) {
            this.DB.stats = { today: { wins: 0, losses: 0, pnl: 0, reported: false }, date: todayStr };
        }
        
        this.DB.stats.today.wins += win;
        this.DB.stats.today.losses += loss;
        this.DB.stats.today.pnl += pnlChange;
        
        // Fire and forget save
        this.saveDB();
    },
    
    async loop() {
        if (!this.active) return;
        
        const symbols = this.DB.coins.map(c => c.symbol).slice(0, 20);
        if (symbols.length === 0) {
            setTimeout(() => this.loop(), 5000);
            return;
        }
        
        for (const sym of symbols) {
            try {
                await this.scanCoin(sym);
            } catch (e) {
                console.error(`❌ SCAN FAILED FOR ${sym}:`, e.message);
            }
            await new Promise(r => setTimeout(r, 500));
        }
        
        setTimeout(() => this.loop(), 15000);
    },
    
    async scanCoin(sym) {
        const [c5, c15, c1h, c4h, c1d, fr] = await Promise.all([
            fC(sym, '5m', 200),
            fC(sym, '15m', 200),
            fC(sym, '1h', 200),
            fC(sym, '4h', 100),
            fC(sym, '1d', 50),
            fFR(sym)
        ]);
        
        this.checkOutcomes(this.DB.sigs5.filter(s => s.sym === sym && s.out === 'PENDING'), c5);
        this.checkOutcomes(this.DB.sigs15.filter(s => s.sym === sym && s.out === 'PENDING'), c15);
        this.checkOutcomes(this.DB.sigs1h.filter(s => s.sym === sym && s.out === 'PENDING'), c1h);
        
        const now = Date.now();
        const purgeOld = (arr) => arr.filter(s => (now - new Date(s.ts).getTime()) < 7*24*60*60*1000);
        this.DB.sigs5 = purgeOld(this.DB.sigs5);
        this.DB.sigs15 = purgeOld(this.DB.sigs15);
        this.DB.sigs1h = purgeOld(this.DB.sigs1h);

        const sig5 = genSig(c5, c15, c1h, c1d, fr, '5m', sym);
        if (sig5 && sig5.sc >= 10 && !this.DB.sigs5.find(s => s.id === sig5.id)) {
            this.DB.sigs5.unshift(sig5);
            if (this.onNewSignal) this.onNewSignal(sig5);
        }
        
        const sig15 = genSig(c15, c1h, c4h, c1d, fr, '15m', sym);
        if (sig15 && sig15.sc >= 10 && !this.DB.sigs15.find(s => s.id === sig15.id)) {
            this.DB.sigs15.unshift(sig15);
            if (this.onNewSignal) this.onNewSignal(sig15);
        }
        
        const sig1h = genSig(c1h, c4h, c1d, c1d, fr, '1h', sym);
        if (sig1h && sig1h.sc >= 10 && !this.DB.sigs1h.find(s => s.id === sig1h.id)) {
            this.DB.sigs1h.unshift(sig1h);
            if (this.onNewSignal) this.onNewSignal(sig1h);
        }
        
        this.saveDB();
    },
    
    checkOutcomes(sigs, candles) {
        if (!candles.length) return;
        const oldT = candles[0].t.getTime();
        for (const s of sigs) {
            const st2 = new Date(s.ts).getTime();
            if (st2 < oldT) {
                s.out = 'EXPIRED';
                if (this.onOutcome) this.onOutcome(s);
                continue;
            }
            let out = 'PENDING';
            for (const c of candles) {
                const ct = c.t.getTime();
                if (ct < st2) continue;
                if (ct === st2) {
                    if (s.dir === 'LONG') {
                        if (c.c <= s.sl) { out = 'SL_HIT'; break; }
                        if (c.c >= s.tp2) { out = 'TP2_HIT'; break; }
                        if (c.c >= s.tp1) { out = 'TP1_HIT'; break; }
                    } else {
                        if (c.c >= s.sl) { out = 'SL_HIT'; break; }
                        if (c.c <= s.tp2) { out = 'TP2_HIT'; break; }
                        if (c.c <= s.tp1) { out = 'TP1_HIT'; break; }
                    }
                } else {
                    if (s.dir === 'LONG') {
                        if (c.l <= s.sl) { out = 'SL_HIT'; break; }
                        if (c.h >= s.tp2) { out = 'TP2_HIT'; break; }
                        if (c.h >= s.tp1) { out = 'TP1_HIT'; break; }
                    } else {
                        if (c.h >= s.sl) { out = 'SL_HIT'; break; }
                        if (c.l <= s.tp2) { out = 'TP2_HIT'; break; }
                        if (c.l <= s.tp1) { out = 'TP1_HIT'; break; }
                    }
                }
            }
            if (out !== 'PENDING') {
                s.out = out;
                if (this.onOutcome) this.onOutcome(s);
            }
        }
    },
    
    getState() {
        return this.DB;
    }
};

module.exports = Engine;
