const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { getChromeExecutablePath } = require('./utils');

const SESSION_FILE = path.join(__dirname, '..', '.session.json');

async function getAuthenticatedBrowser(credentials, baseUrl = 'https://moodle.modern-academy.edu.eg') {
    const executablePath = getChromeExecutablePath();
    const launchOptions = {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    };

    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Attempt restoring session cookies
    if (fs.existsSync(SESSION_FILE)) {
        try {
            const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            await page.setCookie(...cookies);
        } catch (e) {
            // Ignore corrupted session file
        }
    }

    console.log(`Checking session at ${baseUrl}...`);
    await page.goto(`${baseUrl}/my/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    if (page.url().includes('login')) {
        console.log('Session expired or not found. Performing login...');
        const { username, password } = credentials;

        if (!username || !password) {
            await browser.close();
            throw new Error('Missing credentials. Please supply LMS_USERNAME and LMS_PASSWORD via .env or CLI.');
        }

        await page.goto(`${baseUrl}/login/index.php`, { waitUntil: 'domcontentloaded' });
        await page.focus('#username');
        await page.type('#username', username);

        await page.focus('#password');
        await page.type('#password', password);

        await Promise.all([
            page.click('#loginbtn'),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 })
        ]);

        if (page.url().includes('login/index.php')) {
            const errorMsg = await page.evaluate(() => {
                return document.querySelector('.alert-danger, #loginerrormessage, .errormessage')?.innerText.trim();
            });
            await browser.close();
            throw new Error(`Login failed: ${errorMsg || 'Invalid credentials or login rejected.'}`);
        }

        console.log('Login successful! Saving session cache...');
        const currentCookies = await page.cookies();
        fs.writeFileSync(SESSION_FILE, JSON.stringify(currentCookies, null, 2), 'utf8');
    } else {
        console.log('Active session restored successfully.');
    }

    const cookies = await page.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    return { browser, page, cookieHeader, baseUrl };
}

module.exports = {
    getAuthenticatedBrowser,
    SESSION_FILE
};
