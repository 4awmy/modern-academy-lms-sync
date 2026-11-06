const { getAuthenticatedBrowser } = require('./auth');

async function discoverCourses(credentials, baseUrl) {
    const { browser, page } = await getAuthenticatedBrowser(credentials, baseUrl);

    console.log('Discovering enrolled courses from dashboard...');
    await page.goto(`${baseUrl}/my/`, { waitUntil: 'domcontentloaded' });

    const courses = await page.evaluate(() => {
        const found = [];
        const links = document.querySelectorAll('a[href*="/course/view.php?id="]');
        links.forEach(a => {
            const rawText = a.innerText.trim();
            const href = a.href;
            const match = href.match(/id=(\d+)/);
            if (match && rawText) {
                const id = match[1];
                if (!found.find(c => c.id === id)) {
                    // Clean multi-line strings
                    const name = rawText.split('\n').map(s => s.trim()).filter(Boolean).join(' ');
                    found.push({ id, name, url: href });
                }
            }
        });
        return found;
    });

    await browser.close();
    return courses;
}

module.exports = {
    discoverCourses
};
