# CSE_E_Important_Dates

Official academic schedule and important dates portal for **CSE - Section E**.

## 📌 Overview

1. **View Website (`index.html`)**:
   - Strictly read-only portal.
   - Displays only 5 columns:
     - **Serial Number**
     - **Name**
     - **Subject**
     - **Due Date**
     - **Duration**
   - Automatically synchronizes with [schedules.xlsx](file:///c:/Users/Samarth%20Kamble/Desktop/TimeTAble/CSE_E_Important_Dates/schedules.xlsx) directly in this folder.
   - Includes real-time IST clock, dynamic countdown badges (e.g. *In 3 days*, *Tomorrow*, *Overdue*), search, subject filters, and sorting.

2. **Excel Schedule Editor (`editor.html`)**:
   - Web interface to manage schedule entries offline.
   - Add new schedules, edit rows, reorder, auto-renumber serial numbers.
   - Single-click **"Save & Download schedules.xlsx"** to generate the updated Excel spreadsheet.
   - Import existing Excel files (`.xlsx`, `.xls`, `.csv`).

---

## 🚀 Offline Git Workflow

To update dates and display them on the live website:

### Option A: Using the Excel Editor Web Page
1. Open [editor.html](file:///c:/Users/Samarth%20Kamble/Desktop/TimeTAble/CSE_E_Important_Dates/editor.html) in your browser.
2. Add or update schedule entries using the quick-add bar or edit buttons.
3. Click **"Save & Download schedules.xlsx"** and save/replace `schedules.xlsx` in this folder.
4. Commit and push to Git:
   ```bash
   git add schedules.xlsx
   git commit -m "Update schedule dates"
   git push origin main
   ```
5. Done! The view page [index.html](file:///c:/Users/Samarth%20Kamble/Desktop/TimeTAble/CSE_E_Important_Dates/index.html) immediately displays your new dates.

### Option B: Editing Directly in Microsoft Excel
1. Open `schedules.xlsx` in Microsoft Excel or LibreOffice Calc.
2. Update the rows under the headers:
   - `Serial Number`
   - `Name`
   - `Subject`
   - `Due Date` (YYYY-MM-DD)
   - `Duration` (e.g., *2 Hours*, *1 Day*)
3. Save the file.
4. Push to Git:
   ```bash
   git add schedules.xlsx
   git commit -m "Update schedules"
   git push origin main
   ```
