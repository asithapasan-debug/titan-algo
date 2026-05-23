const Screener = {
  active: false,
  interval: null,
  batchSize: 5,
  idx: 0,
  coins: [],
  
  toggle() {
    this.active = !this.active;
    const btn = document.getElementById('btn-screener');
    if (btn) {
      btn.classList.toggle('on', this.active);
      btn.textContent = this.active ? '🔍 Screener: ON' : '🔍 Screener: OFF';
    }
    
    if (this.active) {
      this.idx = 0;
      this.loop();
      showToast('Background Screener Started', '#0ecb81');
    } else {
      if (this.interval) clearTimeout(this.interval);
      showToast('Background Screener Stopped', '#848e9c');
    }
  },
  
  async loop() {
    if (!this.active) return;
    
    // Refresh the list of coins (top 20, excluding the currently active coin to avoid double processing)
    this.coins = ST.coins.map(c => c.symbol).filter(s => s !== ST.coin).slice(0, 19);
    
    if (this.coins.length === 0) {
      this.interval = setTimeout(() => this.loop(), 5000);
      return;
    }
    
    // Fetch and process each coin in the batch concurrently
    const batch = this.coins.slice(this.idx, this.idx + this.batchSize);
    this.idx += this.batchSize;
    if (this.idx >= this.coins.length) this.idx = 0;
    
    await Promise.all(batch.map(sym => this.scanCoin(sym)));
    
    // Wait 15 seconds before scanning the next batch
    this.interval = setTimeout(() => this.loop(), 15000);
  },
  
  async scanCoin(sym) {
    try {
      const [c5, c15, c1h, c4h, c1d, fr] = await Promise.all([
        fC(sym, '5m', 200),
        fC(sym, '15m', 200),
        fC(sym, '1h', 200),
        fC(sym, '4h', 100),
        fC(sym, '1d', 50),
        fFR(sym)
      ]);
      
      let updated = false;
      
      const pSigs5 = ST.sigs5.filter(s => s.sym === sym && s.out === 'PENDING');
      if (pSigs5.length > 0 && chkOut(pSigs5, c5)) { updated = true; }
      
      const pSigs15 = ST.sigs15.filter(s => s.sym === sym && s.out === 'PENDING');
      if (pSigs15.length > 0 && chkOut(pSigs15, c15)) { updated = true; }
      
      const pSigs1h = ST.sigs1h.filter(s => s.sym === sym && s.out === 'PENDING');
      if (pSigs1h.length > 0 && chkOut(pSigs1h, c1h)) { updated = true; }
      
      // Check 5m timeframe
      const sig5 = genSig(c5, c15, c1h, c1d, fr, '5m', sym);
      if (sig5 && sig5.sc >= 10) {
        if (!localStorage.getItem('fsa_5m_' + sig5.id)) {
          saveSig(sig5);
          ST.sigs5.unshift(sig5);
          notifyNewSig(sig5);
          updated = true;
        }
      }
      
      // Check 15m timeframe
      const sig15 = genSig(c15, c1h, c4h, c1d, fr, '15m', sym);
      if (sig15 && sig15.sc >= 10) {
        if (!localStorage.getItem('fsa_15m_' + sig15.id)) {
          saveSig(sig15);
          ST.sigs15.unshift(sig15);
          notifyNewSig(sig15);
          updated = true;
        }
      }
      
      // Check 1h timeframe
      const sig1h = genSig(c1h, c4h, c1d, c1d, fr, '1h', sym);
      if (sig1h && sig1h.sc >= 10) {
        if (!localStorage.getItem('fsa_1h_' + sig1h.id)) {
          saveSig(sig1h);
          ST.sigs1h.unshift(sig1h);
          notifyNewSig(sig1h);
          updated = true;
        }
      }
      
      if (updated) {
        updActivePanel();
        if (ST.view === 'report') renRep();
      }
      
    } catch (e) {
      // Silently ignore individual coin fetch errors in background
    }
  }
};
