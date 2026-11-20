# CSE_E_Important_Dates

Official academic schedule and important dates portal for **CSE - Section E**.

## 📌 Overview

1. **View Website (`index.html`)**:
   - Strictly read-only portal.
   - Displays 6 columns:
     - **Serial Number** (`#`)
     - **Name**
     - **Subject**
     - **Due Date**
     - **Due Time**
     - **Duration**
   - Automatically synchronizes with [schedules.txt](file:///c:/Users/Samarth%20Kamble/Desktop/TimeTAble/CSE_E_Important_Dates/schedules.txt) directly in this folder.
   - **Smart Expiration & Ordering**:
     - Automatically hides schedules that are older than 1 day (>24 hours).
     - Places schedules that ended recently (within the last 24 hours) at the **bottom** with an overdue tag.
     - Arranges upcoming schedules in chronological order by **Due Date and Time**.
   - Includes live IST clock, search, subject filtering, and sorting.

2. **Schedule Text Editor (`editor.html`)**:
   - Lightweight offline editor to add, edit, re-order, and manage schedules.
   - One-click **"Save & Download schedules.txt"** to export the updated text file.
   - Import existing text or CSV files.

3. **Admin deadline editor (`/admin`)**:
   - Open `/admin` directly on the Vercel preview for `testing`. The public homepage has no admin link.
   - On the `testing` preview, sign in with `admin` for both fields. No custom environment variables are required. Edits are saved in the current browser and appear on the public preview in that browser.
   - Shared saves require a separately configured deployment with the credentials and GitHub token from `.env.example`. Shared saves commit to `schedules.txt` on `testing`.
   - The editor starts with the published Google Sheet. After the first save, the preview uses the saved schedule. Further edits to the sheet do not sync to the preview.

---

## 📄 Data Format (`schedules.txt`)

The schedule data is stored in a clean, human-readable text file:
```text
# Format: Serial Number | Name | Subject | Due Date | Due Time | Duration
1 | Math Assignment | Math | 2026-10-18 | 10:00 AM | 2 Hours
2 | Math Quiz | Math | 2026-10-15 | 11:59 PM | 30 Minutes
3 | Operating system CIE 1 Quiz | OS | 2026-10-14 | 02:00 PM | 1 Hour
```

---

## 🚀 Offline Git Workflow

### Option A: Edit directly in Notepad
1. Open [schedules.txt](file:///c:/Users/Samarth%20Kamble/Desktop/TimeTAble/CSE_E_Important_Dates/schedules.txt) in Notepad or any text editor offline.
2. Edit or add lines using the format: `Serial Number | Name | Subject | Due Date | Due Time | Duration`.
3. Save the file.
4. Commit and push to Git:
   ```bash
   git add schedules.txt
   git commit -m "Update schedules"
   git push origin main
   ```

### Option B: Using the Web Editor (`editor.html`)
1. Open [editor.html](file:///c:/Users/Samarth%20Kamble/Desktop/TimeTAble/CSE_E_Important_Dates/editor.html) in your browser.
2. Add or update schedule entries using the quick-add bar or edit buttons.
3. Click **"Save & Download schedules.txt"** and replace `schedules.txt` in this folder.
4. Commit and push to Git:
   ```bash
   git add schedules.txt
   git commit -m "Update schedules"
   git push origin main
   ```
