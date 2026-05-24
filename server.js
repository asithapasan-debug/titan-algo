require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const Engine = require('./server_engine.js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_5M = process.env.TELEGRAM_CHAT_ID_5M;
const CHAT_15M = process.env.TELEGRAM_CHAT_ID_15M;
const CHAT_1H = process.env.TELEGRAM_CHAT_ID_1H;

function getChatId(tf) {
    if (tf === '5m') return CHAT_5M;
    if (tf === '15m') return CHAT_15M;
    if (tf === '1h') return CHAT_1H;
    return null;
}

let bot = null;
if (TELEGRAM_TOKEN && TELEGRAM_TOKEN !== 'YOUR_TOKEN_HERE') {
    bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
    console.log('Telegram Bot initialized.');
} else {
    console.warn('WARNING: TELEGRAM_TOKEN is not set in .env. Telegram integration is disabled.');
}

async function handleNewSignal(sig) {
    console.log(`[BACKEND] Generated ${sig.dir} signal for ${sig.sym} (Score: ${sig.sc}/23) [${sig.tf}]`);
    const chatId = getChatId(sig.tf);
    if (bot && chatId && !chatId.includes('YOUR_')) {
        const isL = sig.dir === 'LONG';
        const icon = isL ? '🟢' : '🔴';
        const action = isL ? 'LONG' : 'SHORT';
        
        const message = `
${icon} <b>TITAN ALGO SIGNAL</b> ${icon}

<b>Pair:</b> #${sig.sym.replace('USDT', '')}
<b>Direction:</b> ${action}
<b>Timeframe:</b> ${sig.tf}
<b>Signal Strength:</b> ${sig.str} (${sig.sc}/23)

<b>🎯 ENTRY ZONE:</b> ${sig.entry}

<b>🛡️ STOP LOSS:</b> ${sig.sl}

<b>💰 TAKE PROFIT 1:</b> ${sig.tp1}
<b>💰 TAKE PROFIT 2:</b> ${sig.tp2}

<b>📊 Confluence Reasons:</b>
${sig.reasons.map(r => `• ${r.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`).join('\n')}

<i>⚠️ Disclaimer: Trading involves risk. Use strict bankroll management (max 1-2% risk per trade). We recommend 5x-10x leverage max for this setup.</i>
`.trim();

        try {
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            console.log(`Signal broadcasted to Telegram successfully (${sig.tf})!`);
        } catch (e) {
            console.error('Failed to send Telegram signal:', e.message);
        }
    }
}

async function handleOutcome(sig) {
    console.log(`[BACKEND] Outcome ${sig.out} for ${sig.sym} [${sig.tf}]`);
    const chatId = getChatId(sig.tf);
    if (bot && chatId && !chatId.includes('YOUR_')) {
        const m = {
            TP2_HIT: { i: '🎯', t: 'TAKE PROFIT 2 HIT' },
            TP1_HIT: { i: '✅', t: 'TAKE PROFIT 1 HIT' },
            SL_HIT: { i: '🛑', t: 'STOP LOSS HIT' }
        };
        const hit = m[sig.out] || { i: 'ℹ', t: sig.out };
        
        const message = `
${hit.i} <b>${hit.t}</b> ${hit.i}

<b>Pair:</b> #${sig.sym.replace('USDT', '')}
<b>Direction:</b> ${sig.dir}
<b>Entry Price:</b> ${sig.entry}
<b>Closed At:</b> ${sig.out === 'SL_HIT' ? sig.sl : (sig.out === 'TP1_HIT' ? sig.tp1 : sig.tp2)}

<i>This outcome has been logged in our daily performance tracker! 📈</i>
`.trim();

        try {
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            console.log(`Outcome broadcasted to Telegram successfully (${sig.tf})!`);
        } catch (e) {
            console.error('Failed to send Telegram outcome:', e.message);
        }
    }
    
    if (sig.out === 'TP1_HIT' || sig.out === 'TP2_HIT') {
        Engine.updateStats(1, 0, 1);
    } else if (sig.out === 'SL_HIT') {
        Engine.updateStats(0, 1, -1);
    }
}

app.get('/api/state', (req, res) => {
    res.json(Engine.getState());
});

app.get('/api/clear-now-1234', (req, res) => {
    Engine.DB.sigs5 = [];
    Engine.DB.sigs15 = [];
    Engine.DB.sigs1h = [];
    Engine.DB.stats = { today: { wins: 0, losses: 0, pnl: 0, reported: false }, date: new Date().toISOString().split('T')[0] };
    Engine.saveDB();
    res.send("Successfully wiped all data!");
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(`⚡ Titan Algo Engine & Web Server started on port ${PORT}`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
    console.log(`========================================`);
    
    // Start the background trading engine
    Engine.start(handleNewSignal, handleOutcome);
});

// Daily Recap Broadcast loop (Checks every minute)
setInterval(async () => {
    const now = new Date();
    const stats = Engine.getState().stats;
    if (now.getHours() === 23 && now.getMinutes() === 50 && stats && !stats.today.reported) {
        const total = stats.today.wins + stats.today.losses;
        if (total > 0) {
            const wr = ((stats.today.wins / total) * 100).toFixed(1);
            const msg = `
⚡ <b>TITAN ALGO DAILY RECAP</b> ⚡

<b>Total Trades:</b> ${total}
<b>Wins:</b> ${stats.today.wins} ✅
<b>Losses:</b> ${stats.today.losses} ❌
<b>Win Rate:</b> ${wr}%

<b>Estimated Net PnL:</b> ${stats.today.pnl > 0 ? '+' : ''}${stats.today.pnl.toFixed(2)} Risk Units

<i>Stay disciplined and see you tomorrow! 🚀</i>
            `.trim();
            if (bot) {
                const channels = [CHAT_5M, CHAT_15M, CHAT_1H].filter(Boolean).map(c => c.trim()).filter(c => !c.includes('YOUR_'));
                const uniqueChannels = [...new Set(channels)];
                for (let c of uniqueChannels) {
                    try { await bot.sendMessage(c, msg, { parse_mode: 'HTML' }); } catch(e){}
                }
            }
        }
        stats.today.reported = true;
        Engine.saveDB();
    }
}, 60000);
