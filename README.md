# modern-academy-lms-sync

> Automated scraper and study synchronizer for Modern Academy Moodle LMS (`moodle.modern-academy.edu.eg`).

Organizes university course materials into a clean, standardized folder hierarchy sorted chronologically by week and categorized by resource type.

---

## ✨ Features

- **Automated Authentication**: Headless login with persistent session cookie caching in `.session.json`.
- **Course Discovery**: Auto-detects all enrolled courses and their unique Moodle IDs from your student dashboard.
- **Flexible Targets**: Accepts a numerical Course ID (e.g. `2021`), a course URL, or an activity/assignment URL (resolving the parent course automatically).
- **Chronological Standardized Naming**: Automatically applies `Week XX - [Resource Name]` prefix for clean sorting.
- **Intelligent Categorization**:
  - `Lectures/`: Lecture slides and theory presentations.
  - `Sections/`: Practical section sheets, lab tutorials, and exercise sheets.
  - `Assignments/Questions/`: Assignment briefs, instructions, problem statements, and prompt attachments.
  - `Assignments/Answers/`: Your existing student submissions and solutions.
- **Fast Resilient Downloads**: Uses authenticated streaming downloads with browser-like headers and redirects handling.

---

## 📁 Output Folder Structure

When you sync a course, files are structured like this:

```
<Destination Directory>/
├── Lectures/
│   ├── Week 01 - Lecture 1 - Chapter 1.pdf
│   ├── Week 02 - Lecture 2 - Chapter 2.pdf
│   ├── Week 03 - Lecture 3 - Chapter 2.pdf
│   ├── Week 04 - Lecture 1 - Chapter 3.pdf
│   ├── Week 04 - Lecture 2 - Chapter 3.pdf
│   └── Week 05 - Lecture 3 - Chapter 3.pdf
├── Sections/
│   ├── Week 01 - Sheet 1 - Chapter 1.pdf
│   ├── Week 02 - Sheet 2 - Chapter 2.pdf
│   └── Week 03 - Sheet 3 - Chapter 2.pdf
└── Assignments/
    ├── Questions/
    │   ├── Week 01 - Assignment 1 - Details.txt
    │   ├── Week 02 - Assignment 2 - Details.txt
    │   ├── Week 03 - Assignment 3 - Chapter 2 - Details.txt
    │   ├── Week 04 - Assignment 4 - Details.txt
    │   └── Week 05 - Assignment 5 - Details.txt
    └── Answers/
        ├── Week 01 - Assignment 1 - Submission - 1 Screenshot.pdf
        ├── Week 02 - Assignment 2 - Submission - WhatsApp Image.pdf
        └── Week 04 - Assignment 4 - Submission - Photo.pdf
```

---

## 🚀 Quick Start

### 1. Installation

```bash
git clone https://github.com/4awmy/modern-academy-lms-sync.git
cd modern-academy-lms-sync
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your student credentials:

```ini
LMS_USERNAME=4240009
LMS_PASSWORD=your_password
LMS_BASE_URL=https://moodle.modern-academy.edu.eg
```

---

## 💻 Usage

### Discover Enrolled Courses

List all courses and their IDs:

```bash
node index.js discover
```

### Synchronize a Course

Sync by Course ID:

```bash
node index.js sync 2021 ./downloads/ENGn311
```

Sync by direct Course or Assignment URL:

```bash
node index.js sync "https://moodle.modern-academy.edu.eg/mod/assign/view.php?id=22012&action=editsubmission" "C:\Users\username\Desktop\Temp\ezz"
```

Pass credentials via CLI flags directly:

```bash
node index.js sync 2021 ./output --user 4240009 --pass 104597
```

---

## 🛠️ CLI Reference

```
Usage:
  node index.js discover
      Discover and list all enrolled courses and their IDs.

  node index.js sync <course_id_or_url> [destination_directory]
      Sync all lectures, sections/sheets, assignments, and submissions for a course.

Options / Flags:
  --user <username>       LMS student ID (or LMS_USERNAME in .env)
  --pass <password>       LMS password (or LMS_PASSWORD in .env)
  --url <base_url>        LMS base URL (default: https://moodle.modern-academy.edu.eg)
  -h, --help              Show help screen
```

---

## 📄 License

MIT © [Omar Hossam (4awmy)](https://github.com/4awmy)
