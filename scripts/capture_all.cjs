const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = path.resolve(__dirname, '../screenshots');

  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@acmeretail.com', password: 'Password123!' })
  }).then(r => r.json());

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {
      width: 1440,
      height: 1100, // Large enough so full page fits comfortably without triggering Recharts resize
      deviceScaleFactor: 2
    }
  });

  const page = await browser.newPage();
  
  // Set auth credentials
  await page.goto('http://localhost:5174/login');
  await page.evaluate((tok, usr, biz) => {
    localStorage.setItem('cf_token', tok);
    localStorage.setItem('cf_user', JSON.stringify(usr));
    localStorage.setItem('cf_business', JSON.stringify(biz));
  }, loginRes.data.token, loginRes.data.user, loginRes.data.business);

  await page.goto('http://localhost:5174/contacts/6', { waitUntil: 'networkidle2' });
  await page.waitForSelector('.nav-tabs', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 2200));

  const tabButtons = await page.$$('.nav-tabs button.nav-link');

  // Tab 1: Overview
  await tabButtons[0].click();
  await new Promise(r => setTimeout(r, 2000));
  const tab1Path = path.join(screenshotsDir, 'tab1_crm_profile_overview.png');
  await page.screenshot({ path: tab1Path, fullPage: false });
  console.log('Saved Tab 1 screenshot');

  // Tab 2: Campaigns
  await tabButtons[1].click();
  await new Promise(r => setTimeout(r, 1200));
  const tab2Path = path.join(screenshotsDir, 'tab2_campaign_broadcasts.png');
  await page.screenshot({ path: tab2Path, fullPage: false });
  console.log('Saved Tab 2 screenshot');

  // Tab 3: Consent
  await tabButtons[2].click();
  await new Promise(r => setTimeout(r, 1200));
  const tab3Path = path.join(screenshotsDir, 'tab3_consent_audit_trail.png');
  await page.screenshot({ path: tab3Path, fullPage: false });
  console.log('Saved Tab 3 screenshot');

  await browser.close();
  console.log('Done!');
})();
