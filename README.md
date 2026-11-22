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
   - See [Google Drive setup](#google-drive-setup) to use a shared text file and the Google-hosted editor. The old Redis setup is available for deployments that already use it.
   - Visible public tabs refresh only the schedule every five minutes. The server permits one active admin session and releases it on sign-out or after five minutes without activity. Demo credentials apply only when shared storage is absent on the testing preview and local launcher.
   - If using `ADMIN_PASSWORD_HASH`, set it to the lowercase hex salt and scrypt hash separated by a colon. The salt is 16 random bytes and scrypt derives 64 bytes using Node.js defaults.
   - In demo mode, the `testing` preview and local launcher start with `schedules.txt`. After the first save, they use the schedule saved in your browser. **Preview** opens the public schedule in a new tab and updates it when you save edits.

## Google Drive setup

1. Upload the repository's schedules.txt as a private text file in Google Drive. Give each admin's Google account Editor access to that file. Copy the file ID from the URL. Keep the file shared only with those accounts.
2. In Google Apps Script, create two standalone projects, CSE E Admin and CSE E Public Feed. In both projects, open Project Settings and add the SCHEDULE_FILE_ID script property.
3. In CSE E Admin, add the EDITOR_EMAILS script property with comma-separated Google email addresses and PUBLIC_SITE_URL with the HTTPS student site URL. Paste google-drive/Code.gs into the project's Code.gs. Run node google-drive/build-admin.cjs locally, create an HTML file named Admin in the Apps Script project, and paste the contents of google-drive/Admin.html into it.
4. Deploy CSE E Admin as a Web app. Choose Execute as User accessing the web app and require a Google account. Copy its /exec URL. Each editor signs in and grants Drive access. The script checks the Google account against EDITOR_EMAILS before giving that user access.
5. In CSE E Public Feed, paste google-drive/PublicFeed.gs as its Code.gs. Deploy it as a separate Web app. Choose Execute as Me and access Anyone. Copy its /exec URL. This project serves the schedule and has no write endpoint.
6. Put the public feed URL in feedUrl and the admin deployment URL in editorUrl in site-config.js. Push that change normally. Neither URL is a credential. The site will show the Drive schedule, and /admin will open the Google editor. No Vercel environment variables are needed for this setup.
7. Check the student site in a signed-out browser. Save a deadline in the Google editor, then test the website's Refresh button. Confirm that a second editor is blocked while the first editing session is active.

Rebuild and redeploy the Admin HTML after changing the shared UI. When using a different Drive file for a preview, configure separate Apps Script projects so demo changes stay separate.

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
