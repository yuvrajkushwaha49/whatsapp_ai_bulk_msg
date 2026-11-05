const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const consoleErrors = [];
  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@acmeretail.com', password: 'Password123!' })
  }).then(r => r.json());

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 950, deviceScaleFactor: 1.5 }
  });

  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('http://localhost:5173/login');
  await page.evaluate((tok, usr, biz) => {
    localStorage.setItem('cf_token', tok);
    localStorage.setItem('cf_user', JSON.stringify(usr));
    localStorage.setItem('cf_business', JSON.stringify(biz));
  }, loginRes.data.token, loginRes.data.user, loginRes.data.business);

  // 1. Desktop View
  await page.goto('http://localhost:5173/templates', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({
    path: 'C:/Users/aa/.gemini/antigravity/brain/4e736c4e-8cf8-4b59-968e-6b4e08c302e1/templates_aisensy_desktop.png',
    fullPage: false
  });
  console.log('Saved templates_aisensy_desktop.png');

  // Check stat card positions (to confirm all 5 are on line 1)
  const statCardYPositions = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.template-stat-card'));
    return cards.map(c => Math.round(c.getBoundingClientRect().top));
  });
  console.log('Stat card Y positions:', statCardYPositions);
  const allSameY = statCardYPositions.every(y => y === statCardYPositions[0]);
  console.log('Are all 5 stat cards on the exact same horizontal row?', allSameY);

  // 2. Click Quick Test button on first card
  const testBtns = await page.$$('.template-item-card button.btn-success');
  console.log('Found Quick Test buttons:', testBtns.length);
  if (testBtns.length > 0) {
    await testBtns[0].click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({
      path: 'C:/Users/aa/.gemini/antigravity/brain/4e736c4e-8cf8-4b59-968e-6b4e08c302e1/templates_quick_test_modal.png',
      fullPage: false
    });
    console.log('Saved templates_quick_test_modal.png');

    // Close modal
    const closeBtn = await page.$('.modal .btn-close');
    if (closeBtn) await closeBtn.click();
    await new Promise(r => setTimeout(r, 600));
  }

  // 3. Switch to Table View
  const viewToggleBtns = await page.$$('.btn-group button');
  if (viewToggleBtns.length > 1) {
    await viewToggleBtns[1].click(); // Table view button
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({
      path: 'C:/Users/aa/.gemini/antigravity/brain/4e736c4e-8cf8-4b59-968e-6b4e08c302e1/templates_table_view_polished.png',
      fullPage: false
    });
    console.log('Saved templates_table_view_polished.png');

    // Switch back to Grid View
    await viewToggleBtns[0].click();
    await new Promise(r => setTimeout(r, 800));
  }

  // 4. Mobile Viewport (412x915)
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: 'C:/Users/aa/.gemini/antigravity/brain/4e736c4e-8cf8-4b59-968e-6b4e08c302e1/templates_aisensy_mobile.png',
    fullPage: false
  });
  console.log('Saved templates_aisensy_mobile.png');

  console.log('Console Errors count:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }

  await browser.close();
})();

