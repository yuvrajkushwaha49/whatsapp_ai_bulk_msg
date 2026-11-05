const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = path.resolve(__dirname, '../screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('1. Fetching auth token directly to ensure reliable session...');
  const loginRes = await fetch('http://[::1]:5174/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@acmeretail.com', password: 'Password123!' })
  }).then(r => r.json());

  if (!loginRes.success || !loginRes.data?.token) {
    throw new Error('Failed to get auth token from backend');
  }
  const token = loginRes.data.token;
  const user = loginRes.data.user;
  const business = loginRes.data.business;
  console.log(`Auth success for: ${user.name} (${user.email}), business: ${business.name}`);

  console.log('2. Launching Chrome (Headless)...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--window-size=1440,1080'
    ],
    defaultViewport: {
      width: 1440,
      height: 1080,
      deviceScaleFactor: 2 // High-res / retina
    }
  });

  const page = await browser.newPage();
  
  const consoleLogs = [];
  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text() };
    consoleLogs.push(entry);
    console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    const entry = { type: 'error', text: err.toString() };
    consoleLogs.push(entry);
    console.error(`[PAGE ERROR] ${err.toString()}`);
  });
  page.on('requestfailed', req => {
    const entry = { type: 'failed_request', url: req.url(), error: req.failure()?.errorText };
    consoleLogs.push(entry);
    console.warn(`[REQUEST FAILED] ${req.url()} (${req.failure()?.errorText})`);
  });

  try {
    console.log('3. Navigating to login page first to initialize local storage domain...');
    await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle2' });

    // Inject credentials into localStorage
    await page.evaluate((tok, usr, biz) => {
      localStorage.setItem('cf_token', tok);
      localStorage.setItem('cf_user', JSON.stringify(usr));
      localStorage.setItem('cf_business', JSON.stringify(biz));
    }, token, user, business);

    console.log('4. Navigating to http://localhost:5174/contacts/6 ...');
    await page.goto('http://localhost:5174/contacts/6', { waitUntil: 'networkidle2' });

    // Wait for contact detail elements to load
    await page.waitForSelector('.nav-tabs', { timeout: 15000 });
    console.log('Contact Detail loaded successfully!');

    // Wait 2.5s for charts and re-render animations to settle
    await new Promise(r => setTimeout(r, 2500));

    // Get tab buttons
    const tabButtons = await page.$$('.nav-tabs button.nav-link');
    console.log(`Discovered ${tabButtons.length} tab navigation items.`);

    // ========================================================
    // TAB 1: CRM Profile Overview
    // ========================================================
    console.log('--- CAPTURING TAB 1: CRM Profile Overview ---');
    await tabButtons[0].click();
    await new Promise(r => setTimeout(r, 1500));
    const tab1ScreenshotPath = path.join(screenshotsDir, 'tab1_crm_profile_overview.png');
    await page.screenshot({ path: tab1ScreenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${tab1ScreenshotPath}`);

    // Inspect Tab 1 DOM & metrics
    const tab1Metrics = await page.evaluate(() => {
      const pageHeader = document.querySelector('.page-header, .d-flex.justify-content-between.align-items-start');
      const cards = Array.from(document.querySelectorAll('.cf-card, .card'));
      const charts = Array.from(document.querySelectorAll('.recharts-responsive-container, svg.recharts-surface'));
      const badges = Array.from(document.querySelectorAll('.badge'));

      return {
        chartsFound: charts.length,
        chartDimensions: charts.map(c => ({
          tag: c.tagName,
          width: c.clientWidth || c.getAttribute('width'),
          height: c.clientHeight || c.getAttribute('height')
        })),
        cardsCount: cards.length,
        cardPaddings: cards.slice(0, 6).map(c => ({
          classes: c.className,
          padding: window.getComputedStyle(c).padding,
          borderRadius: window.getComputedStyle(c).borderRadius,
          boxShadow: window.getComputedStyle(c).boxShadow
        })),
        badges: badges.map(b => ({
          text: b.innerText.trim(),
          bg: window.getComputedStyle(b).backgroundColor,
          color: window.getComputedStyle(b).color,
          fontSize: window.getComputedStyle(b).fontSize
        }))
      };
    });

    // ========================================================
    // TAB 2: Campaign Broadcasts (2)
    // ========================================================
    console.log('--- CAPTURING TAB 2: Campaign Broadcasts ---');
    await tabButtons[1].click();
    await new Promise(r => setTimeout(r, 1500));
    const tab2ScreenshotPath = path.join(screenshotsDir, 'tab2_campaign_broadcasts.png');
    await page.screenshot({ path: tab2ScreenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${tab2ScreenshotPath}`);

    const tab2Metrics = await page.evaluate(() => {
      const table = document.querySelector('table');
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return {
        tablePresent: !!table,
        rowsCount: rows.length,
        tableHeaders: Array.from(document.querySelectorAll('table th')).map(th => th.innerText.trim()),
        rowSamples: rows.map(r => Array.from(r.querySelectorAll('td')).map(td => td.innerText.trim()))
      };
    });

    // ========================================================
    // TAB 3: Consent Audit Trail (4)
    // ========================================================
    console.log('--- CAPTURING TAB 3: Consent Audit Trail ---');
    await tabButtons[2].click();
    await new Promise(r => setTimeout(r, 1500));
    const tab3ScreenshotPath = path.join(screenshotsDir, 'tab3_consent_audit_trail.png');
    await page.screenshot({ path: tab3ScreenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${tab3ScreenshotPath}`);

    const tab3Metrics = await page.evaluate(() => {
      const table = document.querySelector('table');
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return {
        tablePresent: !!table,
        rowsCount: rows.length,
        tableHeaders: Array.from(document.querySelectorAll('table th')).map(th => th.innerText.trim()),
        rowSamples: rows.map(r => Array.from(r.querySelectorAll('td')).map(td => td.innerText.trim()))
      };
    });

    // Global Visual QA styling check
    const globalStyles = await page.evaluate(() => {
      const body = document.body;
      const bStyle = window.getComputedStyle(body);
      const navLink = document.querySelector('.nav-link.active');
      const nlStyle = navLink ? window.getComputedStyle(navLink) : {};

      const h1 = document.querySelector('h1, h2, h3, h4');
      const hStyle = h1 ? window.getComputedStyle(h1) : {};

      const primaryBtn = document.querySelector('.btn-primary, .btn-success');
      const btnStyle = primaryBtn ? window.getComputedStyle(primaryBtn) : {};

      return {
        body: {
          fontFamily: bStyle.fontFamily,
          fontSize: bStyle.fontSize,
          backgroundColor: bStyle.backgroundColor,
          color: bStyle.color
        },
        headings: {
          tag: h1 ? h1.tagName : null,
          text: h1 ? h1.innerText.trim() : null,
          fontSize: hStyle.fontSize,
          fontWeight: hStyle.fontWeight,
          fontFamily: hStyle.fontFamily,
          color: hStyle.color
        },
        activeTab: {
          color: nlStyle.color,
          borderBottom: nlStyle.borderBottom,
          fontWeight: nlStyle.fontWeight,
          padding: nlStyle.padding
        },
        brandButtons: {
          bg: btnStyle.backgroundColor,
          color: btnStyle.color,
          borderRadius: btnStyle.borderRadius,
          padding: btnStyle.padding
        }
      };
    });

    const fullReport = {
      screenshots: {
        tab1: tab1ScreenshotPath,
        tab2: tab2ScreenshotPath,
        tab3: tab3ScreenshotPath
      },
      globalStyles,
      tab1Metrics,
      tab2Metrics,
      tab3Metrics,
      consoleLogs
    };

    const reportPath = path.join(screenshotsDir, 'visual_qa_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
    console.log(`Visual QA report saved to ${reportPath}`);

  } catch (err) {
    console.error('QA Test execution failed:', err);
    throw err;
  } finally {
    await browser.close();
    console.log('Browser closed cleanly.');
  }
})();
