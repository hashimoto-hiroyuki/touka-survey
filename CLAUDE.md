# CLAUDE.md - AI Assistant Guide for touka-survey

## Project Overview

**Touka Survey (糖化アンケート作成ツール)** is a React-based web application for managing and distributing medical surveys related to glycated hemoglobin (HbA1c) testing for dental clinics in Japan.

**Live URL**: https://touka-survey.vercel.app

### Core Functionality
- Create and print paper surveys with QR codes pre-filled with clinic names
- Manage a list of medical facilities (hospitals/dental clinics)
- Automatic synchronization with Google Forms and Google Sheets
- Generate pre-filled survey links for digital distribution
- Automatic JSON export of survey responses to Google Drive

## Technology Stack

| Layer | Technology | Version/Notes |
|-------|-----------|---------------|
| Frontend Framework | React | 19.2.0 |
| Build Tool | Vite | 7.2.4 |
| Styling | Tailwind CSS | via CDN (index.html) |
| Icons | Lucide React | 0.562.0 |
| Backend | Google Apps Script | Web App (JSONP) |
| Database | Google Sheets | 2 sheets |
| Forms | Google Forms | Auto-sync |
| Hosting | Vercel | CI/CD from GitHub |
| Linting | ESLint | 9.39.1 (flat config) |
| QR Code | QR Server API | External service |

## Project Structure

```
touka-survey/
├── src/
│   ├── SurveyEditor.jsx      # Main React component (~1,070 lines)
│   ├── App.jsx               # App wrapper component
│   ├── main.jsx              # React entry point
│   ├── App.css               # App styling
│   ├── index.css             # Global styles
│   └── assets/               # Static assets
├── public/
│   └── vite.svg              # Favicon
├── docs/
│   └── images/               # Documentation images (screenshots)
├── Code.gs                   # Google Apps Script backend (~585 lines)
├── index.html                # HTML template (loads Tailwind via CDN)
├── package.json              # Dependencies
├── package-lock.json         # Lock file
├── vite.config.js            # Vite build config
├── eslint.config.js          # ESLint configuration (flat config)
├── README.md                 # User documentation (Japanese)
├── CLAUDE.md                 # This file
└── .gitignore                # Git ignore rules
```

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (usually localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

## Architecture Overview

### System Architecture (3-Layer)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        データ管理層                                   │
├─────────────────────────────────────────────────────────────────────┤
│  [スプレッドシート①]                [スプレッドシート②]               │
│   医療機関リスト                     フォーム回答データ                │
│   └─ Apps Scriptと連携               └─ 回答が自動保存                │
└─────────────────────────────────────────────────────────────────────┘
                    │                           ↑
                    ↓                           │
┌─────────────────────────────────────────────────────────────────────┐
│                        サーバー層                                    │
├─────────────────────────────────────────────────────────────────────┤
│  [Google Apps Script]  ← Web App（JSONP対応）                        │
│   ├─ 医療機関リスト取得/追加/編集/削除                                │
│   ├─ Googleフォームの選択肢を自動同期                                 │
│   └─ JSON自動保存（フォーム送信時トリガー）                           │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      フロントエンド層                                 │
├─────────────────────────────────────────────────────────────────────┤
│  [Googleフォーム]                   [Reactアプリ（Vercel）]          │
│   ├─ オンライン回答用                ├─ 紙アンケート印刷用            │
│   ├─ 回答→スプレッドシート②に保存    ├─ prefill URL自動生成          │
│   └─ 選択肢はApps Scriptと同期       ├─ QRコード生成                 │
│                                      └─ 医療機関リスト管理           │
└─────────────────────────────────────────────────────────────────────┘
```

### API Communication (JSONP)

Frontend uses JSONP to avoid CORS issues with Google Apps Script:

```
┌──────────────┐                      ┌──────────────────────┐
│  React App   │  ──── JSONP ────→   │  Google Apps Script  │
│  (Browser)   │  ←── callback() ──  │  (Web App)           │
└──────────────┘                      └──────────────────────┘
      ↓
  <script> tag injection
  callback function receives JSON response
  30 second timeout
```

### JSON Auto-Save Flow

```
フォーム送信 → onFormSubmit トリガー → buildJsonFromRow → saveJsonToGoogleDrive
                                           ↓
                                   アンケートJSON フォルダに保存
                                   (ファイル名: survey_{ID番号}.json)
```

## Survey Questions (全14問)

The paper survey contains 14 questions:

| # | Question | Type |
|---|----------|------|
| 1 | 名前（カタカナ） | Text input |
| 2 | 生年月日 | Date selection + "以降QRコードで回答" checkbox |
| 3 | 性別 | Multiple choice |
| 4 | 血液型 | Multiple choice |
| 5 | 身長・体重 | Number input |
| 6 | 糖尿病 | Multiple choice (duration) |
| 7 | 脂質異常症 | Multiple choice (duration) |
| 8 | 兄弟の糖尿病歴 | Yes/No |
| 9 | 両親の糖尿病歴 | Yes/No |
| 10 | 運動習慣 | Yes/No |
| 11 | お菓子・スイーツ | Frequency |
| 12 | 飲み物 | 有糖/無糖 |
| 13 | 飲酒習慣 | Detailed (種類/頻度/量) |
| 14 | 歯の抜去位置 | Doctor input |

**Note**: "以降、QRコードで回答" checkbox on Q2 allows patients to complete remaining questions via smartphone after filling basic info on paper.

## Key Files and Their Roles

### `src/SurveyEditor.jsx` (Main Component - ~1,070 lines)

**State Management:**
- `hospitalList` - List of medical facilities from Google Sheets
- `selectedHospital` - Currently selected hospital for survey
- `formBaseUrl` / `entryId` - Google Form configuration
- `showSettings` - UI toggle for settings panel
- `isLoading` / `isSyncing` - Loading states
- `error` / `successMessage` - User feedback

**Key Functions:**
- `callApi()` - JSONP-based API communication (lines 61-91)
- `fetchHospitalList()` - Load hospitals from backend (lines 94-111)
- `addHospital()` / `deleteHospital()` / `updateHospital()` - CRUD operations
- `generateQRCode()` - QR code URL generation via QR Server API (lines 253-256)
- `handlePrint()` - Print functionality trigger (lines 261-263)

**UI Sections:**
- Header with controls (settings, print button)
- Hospital selection dropdown
- QR code preview with URL copy
- Settings panel (hospital list management)
- Two-page print preview:
  - Page 1: Survey form (lines 652-946)
  - Page 2: Drinking options reference (lines 948-1064)

### `Code.gs` (Backend - ~585 lines)

**Configuration Constants:**
```javascript
SPREADSHEET_ID = '1znspyaI-wj70aBkDfOPPrmYjPSSn3mFELW6VNfOSIbM'
HOSPITAL_LIST_SHEET_NAME = '医療機関リスト'
RESPONSE_SHEET_NAME = 'フォームの回答 1'
HOSPITAL_QUESTION_TITLE = '1. 受診中の歯科医院を選んでください。'
JSON_FOLDER_NAME = 'アンケートJSON'
```

**API Endpoints (via `doGet`):**
| Action | Description |
|--------|-------------|
| `getHospitalList` | Fetch hospitals from Sheets |
| `addHospital` | Add new hospital and sync Form |
| `deleteHospital` | Remove hospital and sync Form |
| `updateHospital` | Update hospital name and sync Form |
| `getFormInfo` | Get Form URL and Entry ID |

**Important Functions:**
- `syncHospitalListOnly()` - Syncs hospital choices to Google Form (lines 162-184)
- `rebuildFullForm()` - Reconstructs entire Form structure (lines 187-349)
- `onFormSubmit()` - Trigger for JSON auto-save (lines 387-412)
- `saveJsonToGoogleDrive()` - Saves response as JSON file (lines 470-492)

## Important IDs and URLs

| Component | Value |
|-----------|-------|
| Apps Script API | `https://script.google.com/macros/s/AKfycbzQCrKRX7nJgryTPsP2Aceh4_Ofyef2Ez2iBmHUGBYF3K15XYZk-5Na8XDIlLCqlAGtVQ/exec` |
| Google Form | `https://docs.google.com/forms/d/e/1FAIpQLSfK29rSSrvSjt7onYIO5gDCLDhtj776z-EhKfTxf2gUlGPBlQ/viewform` |
| Hospital Entry ID | `482936188` |
| Spreadsheet ID | `1znspyaI-wj70aBkDfOPPrmYjPSSn3mFELW6VNfOSIbM` |
| QR Code API | `https://api.qrserver.com/v1/create-qr-code/` |

## Code Conventions

### JavaScript/React
- ES6+ syntax with React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`)
- Single monolithic component approach (SurveyEditor.jsx)
- Japanese comments for user-facing strings
- JSONP for API calls to avoid CORS issues

### Styling
- Tailwind CSS classes (loaded via CDN in index.html)
- Print-specific styles using CSS `@media print` and `print:` prefix
- A4 page size with 10mm margins for printing

### ESLint Configuration
- Flat config format (ESLint v9+)
- Unused variables ignored if they start with uppercase or underscore
- React hooks and refresh plugins enabled

## Common Development Tasks

### Adding a New Survey Question
1. **Googleフォーム**: Add the question directly
2. **SurveyEditor.jsx**: Add to print layout (Page 1, lines 652-946)
3. **Code.gs**: Update `rebuildFullForm()` if needed (lines 187-349)
4. **Apps Script デプロイ**: Redeploy if Code.gs changed
5. **GitHub**: Commit changes

### Modifying Print Layout
1. Edit print preview sections in `SurveyEditor.jsx`
2. Page 1: Main survey form (lines 652-946)
3. Page 2: Drinking options reference (lines 948-1064)
4. Use `print:` prefix for print-specific Tailwind classes
5. Test with browser's print preview (Ctrl+P)

### Updating Hospital List
The hospital list is managed via the Settings panel in the app:
1. Click "リスト追加" button
2. Add/Edit/Delete hospitals
3. Changes auto-sync to Google Sheets and Google Forms

### GAS Deployment Notes
When deploying Google Apps Script:
1. Open the Apps Script project
2. Deploy → New deployment → Web app
3. Settings:
   - Execute as: "Me"
   - Access: "Anyone" (全員)
4. If URL changes, update `API_URL` in `SurveyEditor.jsx` (line 5)

## Deployment

### Frontend (Automatic via Vercel)
```
GitHub Commit → Vercel detects → Auto build → Auto deploy
                                              ↓
                            https://touka-survey.vercel.app
                            (約1〜2分で反映)
```

### Backend (Manual via Google Apps Script)
1. Open Apps Script project in Google Apps Script Editor
2. Make changes to `Code.gs`
3. Deploy as Web App
4. Update `API_URL` in `SurveyEditor.jsx` if deployment URL changes

## Testing Checklist

When making changes, verify:
- [ ] Hospital list loads correctly
- [ ] Add/Edit/Delete hospital works
- [ ] Google Form choices sync properly
- [ ] QR code generates with correct prefilled URL
- [ ] Print preview displays correctly (both pages)
- [ ] Print output matches preview (A4 size)
- [ ] URL copy function works
- [ ] Error states display appropriately
- [ ] "以降、QRコードで回答" checkbox visible on Page 1

## Troubleshooting

### CORS Issues
The app uses JSONP to avoid CORS issues. If API calls fail:
1. Check that Apps Script Web App is deployed with "Anyone" access
2. Verify the `API_URL` in `SurveyEditor.jsx` matches the deployment
3. Check browser console for script loading errors

### Google Form Not Syncing
1. Run `syncHospitalListOnly()` manually in Apps Script
2. Check `HOSPITAL_QUESTION_TITLE` matches the actual form question
3. Verify the form is linked to the correct spreadsheet

### Print Issues
1. Ensure hospital is selected (print button disabled otherwise)
2. Check print preview before printing
3. Use "Save as PDF" option for digital copies
4. Verify A4 paper size is selected

### JSON Not Saving
1. Check `onFormSubmit` trigger is set up (`setupFormSubmitTrigger()`)
2. Verify `アンケートJSON` folder exists in Drive
3. Check `JSON作成済み` column in response sheet

## File Storage Locations

| Location | Files |
|----------|-------|
| **GitHub/Vercel** | SurveyEditor.jsx, Code.gs (backup), README.md, package.json, etc. |
| **Google Drive** | Google Form, Apps Script (本体), スプレッドシート①②, アンケートJSON |

> **Important**: Google Apps Script (Code.gs) exists in two places:
> - **Google Drive**: The actual running version - **edit here**
> - **GitHub**: Backup copy - sync after changes

## Language Notes

- **UI Text**: Japanese (日本語)
- **Code Comments**: Mix of Japanese and English
- **Variable Names**: English
- **User Documentation (README.md)**: Japanese

---

*Last updated: 2026-02-08*
