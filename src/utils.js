const fs = require('fs');
const path = require('path');

function getChromeExecutablePath() {
    const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser'
    ].filter(Boolean);

    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function sanitizeFilename(name) {
    if (!name) return 'unnamed';
    return name
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseContentDisposition(header) {
    if (!header) return null;
    const match = header.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    if (match) {
        return decodeURIComponent(match[1]);
    }
    return null;
}

async function downloadFile(url, cookieHeader) {
    const response = await fetch(url, {
        headers: {
            'Cookie': cookieHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        redirect: 'follow'
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} for URL: ${url}`);
    }

    const filename = parseContentDisposition(response.headers.get('content-disposition'));
    const contentType = response.headers.get('content-type');
    const buffer = Buffer.from(await response.arrayBuffer());

    return {
        buffer,
        filename,
        contentType,
        finalUrl: response.url
    };
}

function categorizeResource(title, filename = '') {
    const combined = `${title} ${filename}`.toLowerCase();

    if (combined.includes('cheat sheet') || combined.includes('cheatsheet')) {
        return 'Cheat Sheets';
    }
    if (combined.includes('exam') || combined.includes('midterm') || combined.includes('final') || combined.includes('quiz')) {
        return 'Exams';
    }
    if (combined.includes('sheet') || combined.includes('section') || combined.includes('lab') || combined.includes('tutorial')) {
        return 'Sections';
    }
    if (combined.includes('assignment') || combined.includes('task') || combined.includes('project')) {
        return 'Assignments';
    }
    if (combined.includes('note') || combined.includes('summary')) {
        return 'Notes';
    }
    return 'Lectures';
}

module.exports = {
    getChromeExecutablePath,
    sanitizeFilename,
    parseContentDisposition,
    downloadFile,
    categorizeResource
};
