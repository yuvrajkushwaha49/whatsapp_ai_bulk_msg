const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new'
  });
  const page = await browser.newPage();
  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@acmeretail.com', password: 'Password123!' })
  }).then(r => r.json());

  await page.goto('http://localhost:5174/login');
  await page.evaluate((tok, usr, biz) => {
    localStorage.setItem('cf_token', tok);
    localStorage.setItem('cf_user', JSON.stringify(usr));
    localStorage.setItem('cf_business', JSON.stringify(biz));
  }, loginRes.data.token, loginRes.data.user, loginRes.data.business);

  await page.goto('http://localhost:5174/contacts/6', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const el = await page.$('.cf-card');
  const cards = await page.$$('.cf-card');
  console.log(`Found ${cards.length} cards.`);
  if (cards[2]) {
    await cards[2].screenshot({ path: path.resolve(__dirname, '../screenshots/chart_donut.png') });
    console.log('Saved donut screenshot');
  }
  if (cards[3]) {
    await cards[3].screenshot({ path: path.resolve(__dirname, '../screenshots/chart_bar.png') });
    console.log('Saved bar screenshot');
  }
  await browser.close();
})();
