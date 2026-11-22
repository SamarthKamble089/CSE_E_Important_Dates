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
     - Places recently ended schedules below upcoming schedules, with older expired schedules at the bottom.
     - Offers a toggle to hide expired schedules.
     - Arranges upcoming schedules in chronological order by **Due Date and Time**.
   - Includes live IST clock, search, subject filtering, and sorting.

2. **Schedule Text Editor (`editor.html`)**:
   - Lightweight offline editor to add, edit, re-order, and manage schedules.
   - One-click **"Save & Download schedules.txt"** to export the updated text file.
   - Import existing text or CSV files.

3. **Admin deadline editor (`/admin`)**:
   - Open `/admin` directly on the Vercel preview for `testing`. The public homepage has no admin link.
   - The `testing` preview and local launcher use the demo credentials `admin` / `admin`. The server stores a salted password hash in `api/_lib/preview-credentials.js`. The `testing` preview works without Vercel environment variables. Preview edits are saved in the current browser and appear on the public preview in that browser.
   - To enable shared editing, add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ADMIN_USERNAME`, `ADMIN_SESSION_SECRET`, and a private `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH`) to the Vercel environment serving students. Redeploy after setting the variables. Use a different Redis database for any preview that should have separate data.
   - A shared deployment starts from `schedules.txt` until the first shared save. The public page loads each save from Redis, and visible tabs check for updates every 30 seconds. The server permits one active admin session and releases it on sign-out or after five minutes without activity. Demo credentials apply only when shared storage is absent on the testing preview and local launcher.
   - If using `ADMIN_PASSWORD_HASH`, set it to the lowercase hex salt and scrypt hash separated by a colon. The salt is 16 random bytes and scrypt derives 64 bytes using Node.js defaults.
   - In demo mode, the `testing` preview and local launcher start with `schedules.txt`. After the first save, they use the schedule saved in your browser. **Preview** opens the public schedule in a new tab and updates it when you save edits.

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
