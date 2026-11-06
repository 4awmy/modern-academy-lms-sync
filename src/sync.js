const fs = require('fs');
const path = require('path');
const { getAuthenticatedBrowser } = require('./auth');
const { sanitizeFilename, downloadFile, categorizeResource } = require('./utils');

async function syncCourse(courseInput, outputDir, credentials, baseUrl) {
    const { browser, page, cookieHeader } = await getAuthenticatedBrowser(credentials, baseUrl);

    let targetCourseUrl = '';
    let courseId = '';

    // If input is an assignment or activity URL, resolve the course first
    if (typeof courseInput === 'string' && courseInput.startsWith('http')) {
        if (courseInput.includes('/course/view.php')) {
            targetCourseUrl = courseInput;
            const m = courseInput.match(/id=(\d+)/);
            if (m) courseId = m[1];
        } else {
            console.log(`Resolving course for activity URL: ${courseInput}`);
            await page.goto(courseInput, { waitUntil: 'domcontentloaded' });
            
            // Extract course link from breadcrumbs or course link
            const resolvedCourseUrl = await page.evaluate(() => {
                const courseLink = document.querySelector('.breadcrumb a[href*="/course/view.php?id="], a[href*="/course/view.php?id="]');
                return courseLink ? courseLink.href : null;
            });

            if (resolvedCourseUrl) {
                targetCourseUrl = resolvedCourseUrl;
                const m = resolvedCourseUrl.match(/id=(\d+)/);
                if (m) courseId = m[1];
                console.log(`Resolved Course URL: ${targetCourseUrl} (ID: ${courseId})`);
            } else {
                throw new Error(`Unable to determine parent course for: ${courseInput}`);
            }
        }
    } else {
        courseId = String(courseInput).trim();
        targetCourseUrl = `${baseUrl}/course/view.php?id=${courseId}`;
    }

    console.log(`\nNavigating to Course: ${targetCourseUrl}`);
    await page.goto(targetCourseUrl, { waitUntil: 'domcontentloaded' });

    const courseTitle = await page.evaluate(() => {
        return document.querySelector('.page-header-headings h1, h1')?.innerText.trim() || 'Course Materials';
    });
    console.log(`Course Name: "${courseTitle}"`);

    // Ensure output directories exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const lecturesDir = path.join(outputDir, 'Lectures');
    const sectionsDir = path.join(outputDir, 'Sections');
    const assignmentsDir = path.join(outputDir, 'Assignments');
    const assignQuestionsDir = path.join(assignmentsDir, 'Questions');
    const assignAnswersDir = path.join(assignmentsDir, 'Answers');

    [lecturesDir, sectionsDir, assignmentsDir, assignQuestionsDir, assignAnswersDir].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    // Extract sections & activities
    const sections = await page.evaluate(() => {
        const result = [];
        const secNodes = document.querySelectorAll('.course-section, .section.main, li.section');
        secNodes.forEach(sec => {
            const secTitle = sec.getAttribute('aria-label') || sec.querySelector('.sectionname, h3, .section-title')?.innerText.trim() || 'General';
            const items = [];
            sec.querySelectorAll('.activity-item, .activityinstance, .activity, .activity-name, li.activity').forEach(item => {
                const linkElem = item.querySelector('a');
                if (!linkElem) return;
                const link = linkElem.href;
                const text = (item.querySelector('.instancename, .activityname')?.innerText.trim() || item.innerText.trim()).split('\n')[0].trim();
                if (link && (link.includes('/mod/resource/') || link.includes('/mod/assign/'))) {
                    if (!items.find(i => i.link === link)) {
                        items.push({
                            text,
                            link,
                            type: link.includes('/mod/assign/') ? 'assign' : 'resource'
                        });
                    }
                }
            });
            if (items.length > 0) {
                result.push({ secTitle, items });
            }
        });
        return result;
    });

    console.log(`Found ${sections.length} course sections with items to sync.`);
    const syncLog = [];
    let weekCounter = 1;

    for (const sec of sections) {
        // Parse week number if present in section title
        const weekMatch = sec.secTitle.match(/week\s*(\d+)/i);
        const weekNum = weekMatch ? parseInt(weekMatch[1], 10) : weekCounter;
        const weekPrefix = `Week ${String(weekNum).padStart(2, '0')} - `;

        console.log(`\n📂 [${sec.secTitle}] -> Prefix: "${weekPrefix}"`);

        for (const item of sec.items) {
            const cleanItemText = item.text.replace(/[\r\n]+/g, ' ').trim();
            console.log(`   * [${item.type.toUpperCase()}] ${cleanItemText}`);

            if (item.type === 'resource') {
                try {
                    const download = await downloadFile(item.link, cookieHeader);
                    let origName = download.filename || `${cleanItemText}.pdf`;
                    origName = origName.replace(/^[0-9a-fA-F]{32}_/, '');

                    const category = categorizeResource(cleanItemText, origName);
                    const targetSubdir = category === 'Sections' ? sectionsDir : lecturesDir;
                    const ext = path.extname(origName) || '.pdf';
                    const finalName = sanitizeFilename(`${weekPrefix}${cleanItemText}${ext}`);
                    const finalPath = path.join(targetSubdir, finalName);

                    fs.writeFileSync(finalPath, download.buffer);
                    console.log(`     -> Saved: ${path.relative(outputDir, finalPath)} (${(download.buffer.length / 1024).toFixed(1)} KB)`);

                    syncLog.push({
                        category: category === 'Sections' ? 'Sections' : 'Lectures',
                        filename: finalName,
                        size: download.buffer.length
                    });
                } catch (err) {
                    console.error(`     -> Error syncing resource "${cleanItemText}": ${err.message}`);
                }
            } else if (item.type === 'assign') {
                try {
                    await page.goto(item.link, { waitUntil: 'domcontentloaded' });

                    const assignData = await page.evaluate(() => {
                        const title = document.querySelector('h1, h2')?.innerText.trim() || '';
                        const desc = document.querySelector('.activity-description, .intro, #intro')?.innerText.trim() || '';
                        const dates = Array.from(document.querySelectorAll('.submissionstatustable tr')).map(r => r.innerText.replace(/\s+/g, ' ').trim());

                        // Prompt attachments
                        const promptFiles = Array.from(document.querySelectorAll('.activity-description a, #intro a'))
                            .map(a => ({ name: a.innerText.trim(), href: a.href }))
                            .filter(a => a.href.includes('pluginfile.php'));

                        // Student submissions
                        const submittedFiles = Array.from(document.querySelectorAll('.submissionstatustable a'))
                            .map(a => ({ name: a.innerText.trim(), href: a.href }))
                            .filter(a => a.href.includes('pluginfile.php') && a.href.includes('assignsubmission_file'));

                        return { title, desc, dates, promptFiles, submittedFiles };
                    });

                    // Save Assignment Prompt details
                    const promptFileName = sanitizeFilename(`${weekPrefix}${cleanItemText} - Details.txt`);
                    const promptFilePath = path.join(assignQuestionsDir, promptFileName);

                    let promptContent = `Assignment: ${assignData.title || cleanItemText}\n`;
                    promptContent += `Course: ${courseTitle}\n`;
                    promptContent += `URL: ${item.link}\n`;
                    promptContent += `==================================================\n`;
                    promptContent += `Description / Instructions:\n${assignData.desc || 'No written description provided.'}\n`;
                    promptContent += `==================================================\n`;
                    promptContent += `Status & Dates:\n${assignData.dates.join('\n')}\n`;

                    fs.writeFileSync(promptFilePath, promptContent, 'utf8');
                    syncLog.push({
                        category: 'Assignments (Prompt)',
                        filename: promptFileName,
                        size: Buffer.byteLength(promptContent)
                    });

                    // Download prompt files
                    for (const pf of assignData.promptFiles) {
                        try {
                            const pfDownload = await downloadFile(pf.href, cookieHeader);
                            const name = sanitizeFilename(`${weekPrefix}${cleanItemText} - ${pf.name || pfDownload.filename || 'Brief.pdf'}`);
                            const pfPath = path.join(assignQuestionsDir, name);
                            fs.writeFileSync(pfPath, pfDownload.buffer);
                            syncLog.push({
                                category: 'Assignments (Prompt File)',
                                filename: name,
                                size: pfDownload.buffer.length
                            });
                        } catch (e) {
                            console.error(`     -> Error downloading assignment attachment: ${e.message}`);
                        }
                    }

                    // Download student submissions
                    for (const sf of assignData.submittedFiles) {
                        try {
                            const sfDownload = await downloadFile(sf.href, cookieHeader);
                            const name = sanitizeFilename(`${weekPrefix}${cleanItemText} - Submission - ${sf.name || sfDownload.filename || 'Submission.pdf'}`);
                            const sfPath = path.join(assignAnswersDir, name);
                            fs.writeFileSync(sfPath, sfDownload.buffer);
                            syncLog.push({
                                category: 'Assignments (Submission)',
                                filename: name,
                                size: sfDownload.buffer.length
                            });
                        } catch (e) {
                            console.error(`     -> Error downloading submitted answer: ${e.message}`);
                        }
                    }
                } catch (err) {
                    console.error(`     -> Error syncing assignment "${cleanItemText}": ${err.message}`);
                }
            }
        }
        weekCounter++;
    }

    await browser.close();
    return { courseTitle, outputDir, syncLog };
}

module.exports = {
    syncCourse
};
