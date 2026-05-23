const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
    page.on('requestfailed', request => console.log('BROWSER_REQ_FAILED:', request.url(), request.failure().errorText));

    const fileUrl = 'file:///' + path.resolve('../index.html').replace(/\\/g, '/');
    console.log('Loading', fileUrl);
    
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });
    
    console.log('Page loaded. Waiting 5 seconds for WS data...');
    await new Promise(r => setTimeout(r, 5000));
    
    await browser.close();
  } catch (e) {
    console.error('TEST SCRIPT ERROR:', e);
  }
})();
