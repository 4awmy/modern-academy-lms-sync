#!/usr/bin/env node

require('dotenv').config();
const path = require('path');
const { discoverCourses } = require('./src/discover');
const { syncCourse } = require('./src/sync');

function printUsage() {
    console.log(`
Modern Academy LMS Sync (CLI)
Automate downloading and organizing course materials from Moodle.

Usage:
  node index.js discover
      Discover and list all enrolled courses and their IDs.

  node index.js sync <course_id_or_url> [destination_directory]
      Sync all lectures, sections/sheets, assignments, and submissions for a course.

Options / Environment:
  --user <username>       LMS student ID (or set LMS_USERNAME in .env)
  --pass <password>       LMS password (or set LMS_PASSWORD in .env)
  --url <base_url>        LMS base URL (default: https://moodle.modern-academy.edu.eg)

Examples:
  node index.js discover
  node index.js sync 2021 ./Temp/ezz
  node index.js sync "https://moodle.modern-academy.edu.eg/mod/assign/view.php?id=22012" "C:\\path\\to\\folder"
`);
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        printUsage();
        process.exit(0);
    }

    const command = args[0];

    // Parse options
    let user = process.env.LMS_USERNAME;
    let pass = process.env.LMS_PASSWORD;
    let baseUrl = process.env.LMS_BASE_URL || 'https://moodle.modern-academy.edu.eg';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--user' && args[i + 1]) user = args[++i];
        if (args[i] === '--pass' && args[i + 1]) pass = args[++i];
        if (args[i] === '--url' && args[i + 1]) baseUrl = args[++i];
    }

    const credentials = { username: user, password: pass };

    if (command === 'discover') {
        try {
            const courses = await discoverCourses(credentials, baseUrl);
            console.log('\n================ ENROLLED COURSES ================');
            courses.forEach(c => {
                console.log(`ID: ${c.id.padEnd(6)} | ${c.name}`);
                console.log(`         URL: ${c.url}`);
            });
            console.log('==================================================');
        } catch (e) {
            console.error('\nError during discovery:', e.message);
            process.exit(1);
        }
    } else if (command === 'sync') {
        const targetInput = args[1];
        if (!targetInput) {
            console.error('Error: Please provide a course ID or course/activity URL to sync.');
            printUsage();
            process.exit(1);
        }

        const rawDest = args[2] || process.env.DEFAULT_SYNC_DIR || path.join(process.cwd(), 'downloads');
        const outputDir = path.resolve(rawDest);

        try {
            const result = await syncCourse(targetInput, outputDir, credentials, baseUrl);
            console.log('\n================ LMS SYNC COMPLETE ================');
            console.log(`Course:      ${result.courseTitle}`);
            console.log(`Destination: ${result.outputDir}`);
            console.log(`Total Files: ${result.syncLog.length}`);
            result.syncLog.forEach(item => {
                console.log(`  - [${item.category}] ${item.filename} (${(item.size / 1024).toFixed(1)} KB)`);
            });
            console.log('====================================================');
        } catch (e) {
            console.error('\nSync failed:', e.message);
            process.exit(1);
        }
    } else {
        console.error(`Unknown command: "${command}"`);
        printUsage();
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
