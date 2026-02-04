# CLAUDE.md - AI Assistant Guide for touka-survey

## Project Overview

**Touka Survey (糖化アンケート作成ツール)** is a React-based web application for managing and distributing medical surveys related to glycated hemoglobin (HbA1c) testing for dental clinics in Japan.

**Live URL**: https://touka-survey.vercel.app

### Core Functionality
- Create and print paper surveys with QR codes pre-filled with clinic names
- Manage a list of medical facilities (hospitals/dental clinics)
- Automatic synchronization with Google Forms and Google Sheets
- Generate pre-filled survey links for digital distribution

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 19.2.0 |
| Build Tool | Vite | 7.2.4 |
| Styling | Tailwind CSS | via CDN |
| Icons | Lucide React | 0.562.0 |
| Backend | Google Apps Script | - |
| Database | Google Sheets | - |
| Forms | Google Forms | - |
| Hosting | Vercel | CI/CD |
| Linting | ESLint | 9.39.1 |

## Project Structure

```
/home/user/touka-survey/
├── src/
│   ├── SurveyEditor.jsx      # Main React component (all UI and logic)
│   ├── App.jsx               # App wrapper component
│   ├── main.jsx              # React entry point
│   ├── App.css               # App styling
│   ├── index.css             # Global styles
│   └── assets/               # Static assets
├── public/
│   └── vite.svg              # Favicon
├── docs/
│   └── images/               # Documentation images
├── Code.gs                   # Google Apps Script backend
├── index.html                # HTML template (loads Tailwind via CDN)
├── package.json              # Dependencies
├── vite.config.js            # Vite build config
├── eslint.config.js          # ESLint configuration
├── README.md                 # User documentation (Japanese)
└── CLAUDE.md                 # This file
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

The system uses a 3-layer architecture:

```
┌─────────────────────────────────────┐
│    Frontend (React on Vercel)       │
│    - SurveyEditor.jsx               │
│    - QR code generation             │
│    - Print functionality            │
└──────────────┬──────────────────────┘
               │ JSONP API calls
               ▼
┌─────────────────────────────────────┐
│  Google Apps Script Web App         │
│  - Code.gs                          │
│  - CRUD operations                  │
│  - Form synchronization             │
└──────────────┬──────────────────────┘
               │ Read/Write
               ▼
┌─────────────────────────────────────┐
│  Google Workspace                   │
│  - Sheets: Hospital list data       │
│  - Forms: Survey questionnaire      │
└─────────────────────────────────────┘
```

## Key Files and Their Roles

### `src/SurveyEditor.jsx` (Main Component - ~1,067 lines)
The monolithic component containing all application logic:

**State Management:**
- `hospitalList` - List of medical facilities from Google Sheets
- `selectedHospital` - Currently selected hospital for survey
- `formBaseUrl` / `entryId` - Google Form configuration
- `showSettings` - UI toggle for settings panel
- `isLoading` / `isSyncing` - Loading states
- `error` / `successMessage` - User feedback

**Key Functions:**
- `callApi()` - JSONP-based API communication (CORS workaround)
- `fetchHospitalList()` - Load hospitals from backend
- `addHospital()` / `deleteHospital()` / `updateHospital()` - CRUD operations
- `generateQRCode()` - QR code URL generation via QR Server API
- `handlePrint()` - Print functionality trigger

**UI Sections:**
- Header with controls (settings, print button)
- Hospital selection dropdown
- Settings panel (hospital list management)
- Two-page print preview (survey + drinking options reference)

### `Code.gs` (Backend - ~427 lines)
Google Apps Script deployed as Web App:

**Configuration Constants:**
```javascript
SPREADSHEET_ID = '1znspyaI-wj70aBkDfOPPrmYjPSSn3mFELW6VNfOSIbM'
HOSPITAL_LIST_SHEET_NAME = '医療機関リスト'
RESPONSE_SHEET_NAME = 'フォームの回答 1'
HOSPITAL_QUESTION_TITLE = '1. 受診中の歯科医院を選んでください。'
```

**API Endpoints (via `doGet`):**
- `getHospitalList` - Fetch hospitals from Sheets
- `addHospital` - Add new hospital and sync Form
- `deleteHospital` - Remove hospital and sync Form
- `updateHospital` - Update hospital name and sync Form
- `getFormInfo` - Get Form URL and Entry ID

**Important Functions:**
- `syncHospitalListOnly()` - Syncs hospital choices to Google Form
- `rebuildFullForm()` - Reconstructs entire Form structure

## Important IDs and URLs

| Component | Value |
|-----------|-------|
| Apps Script API | `https://script.google.com/a/macros/devine.co.jp/s/AKfycbzQCrKRX7nJgryTPsP2Aceh4_Ofyef2Ez2iBmHUGBYF3K15XYZk-5Na8XDIlLCqlAGtVQ/exec` |
| Google Form | `https://docs.google.com/forms/d/e/1FAIpQLSfK29rSSrvSjt7onYIO5gDCLDhtj776z-EhKfTxf2gUlGPBlQ/viewform` |
| Hospital Entry ID | `482936188` |
| Spreadsheet ID | `1znspyaI-wj70aBkDfOPPrmYjPSSn3mFELW6VNfOSIbM` |
| QR Code API | `https://api.qrserver.com/v1/create-qr-code/` |

## Code Conventions

### JavaScript/React
- ES6+ syntax with React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`)
- Single monolithic component approach (SurveyEditor.jsx)
- Japanese comments for user-facing strings and documentation
- JSONP for API calls to avoid CORS issues with Google Apps Script

### Styling
- Tailwind CSS classes (loaded via CDN in index.html)
- Print-specific styles using CSS `@media print`
- Inline styles in JSX when dynamic values needed

### State Management
- Local React state (no external state management)
- Loading/syncing flags for async operations
- Error and success message state with auto-clear timeouts

### ESLint Configuration
- Flat config format (ESLint v9+)
- Unused variables ignored if they start with uppercase or underscore
- React hooks and refresh plugins enabled

## Common Development Tasks

### Adding a New Hospital Field
1. Update `src/SurveyEditor.jsx`:
   - Add new state variable
   - Add UI input in settings panel
   - Wire up to API call if needed
2. Update `Code.gs`:
   - Modify relevant functions
   - Update Google Sheets structure if needed
3. Redeploy Apps Script Web App

### Modifying Print Layout
1. Edit the print preview sections in `SurveyEditor.jsx`
2. Two pages exist:
   - Page 1: Main survey form (lines ~652-942)
   - Page 2: Drinking options reference (lines ~944-1060)
3. Use `print:` prefix for print-specific Tailwind classes
4. Test with browser's print preview

### Updating Google Form Structure
1. Modify `rebuildFullForm()` in `Code.gs`
2. Run the function from Apps Script editor
3. Update `HOSPITAL_QUESTION_TITLE` if question text changes
4. Update `entryId` in frontend if Entry ID changes

### API Communication Pattern
Frontend uses JSONP to communicate with Apps Script:
```javascript
const callApi = (params) => {
  // Creates script tag with callback
  // Callback receives JSON response
  // 30 second timeout
}
```

## Deployment

### Frontend (Automatic via Vercel)
1. Commit and push to GitHub (`hashimoto-hiroyuki/touka-survey`)
2. Vercel automatically builds and deploys
3. Live in 1-2 minutes at https://touka-survey.vercel.app

### Backend (Manual via Google Apps Script)
1. Open the Apps Script project in Google Apps Script Editor
2. Make changes to `Code.gs`
3. Deploy as Web App:
   - Execute as: "Me"
   - Access: "Anyone"
4. Update `API_URL` in `SurveyEditor.jsx` if deployment URL changes

## Testing Checklist

When making changes, verify:
- [ ] Hospital list loads correctly
- [ ] Add/Edit/Delete hospital works
- [ ] Google Form choices sync properly
- [ ] QR code generates with correct prefilled URL
- [ ] Print preview displays correctly (both pages)
- [ ] Print output matches preview
- [ ] URL copy function works
- [ ] Error states display appropriately

## Language Notes

- **UI Text**: Japanese (日本語)
- **Code Comments**: Mix of Japanese and English
- **Variable Names**: English
- **User Documentation (README.md)**: Japanese

## Troubleshooting

### CORS Issues
The app uses JSONP to avoid CORS issues with Google Apps Script. If API calls fail:
1. Check that Apps Script Web App is deployed with "Anyone" access
2. Verify the `API_URL` in `SurveyEditor.jsx` matches the deployment

### Google Form Not Syncing
1. Run `syncHospitalListOnly()` manually in Apps Script
2. Check `HOSPITAL_QUESTION_TITLE` matches the actual form question
3. Verify the form is linked to the correct spreadsheet

### Print Issues
1. Ensure hospital is selected (print button disabled otherwise)
2. Check print preview before printing
3. Use "Save as PDF" option for digital copies

## File Size Reference

- `SurveyEditor.jsx`: ~1,067 lines (main application code)
- `Code.gs`: ~427 lines (backend API)
- `README.md`: ~546 lines (user documentation)

---

*Last updated: 2026-02-04*
