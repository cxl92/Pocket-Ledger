# Pocket Ledger

**Track. Save. Grow.**

Pocket Ledger is a personal money manager for tracking expenses, income, and account transfers across multiple wallets and bank accounts, with monthly visual analytics, Excel/CSV/JSON import and export, and optional Google Sign-In cloud sync backed by Cloud Firestore.

## Features

- **Ledger**
  - Switch seamlessly between **Month** view (with previous/next month navigation and quick **This month** jump) and **All** months view.
  - Filter entries by type (`All`, `Expense`, `Income`, `Transfer`), account, or search keywords across categories, notes, and account names.
  - Day-grouped transaction feed with daily net totals and a live **Total across accounts** sidebar showing every configured account balance.
- **Stats**
  - Unified monthly **Expense breakdown** and **Income breakdown** showing **By account** (left) and **By category** (right) donut charts.
  - **Account activity** income-vs-expense comparison per account and an interactive **Six-month trend** chart.
- **Accounts**
  - Organizes all accounts by category (**Bank**, **Card**, **Cash**, **Digital**) with category subtotals and combined total balance.
  - Click any account to inspect its dedicated **Transaction Details** panel with its own **All** / **Month** selector, inflow/outflow summary, type filters, search, quick account editing, and per-account entry creation.
- **Settings**
  - **Accounts & Categories**: Add/edit accounts (with opening balance and category group) and customize expense and income category lists.
  - **Appearance & Currency**: Light, Dark, or System theme and custom currency symbol or code.
  - **Excel, CSV, and JSON Backups**:
    - **Export**: Download `.xlsx` workbook (`Entries` + `Accounts` sheets), `.csv`, or full `.json` backup.
    - **Import**: Upload `.xlsx`, `.xls`, `.csv`, or `.json` files (missing accounts and categories are created automatically).
    - **Template**: Download ready-to-fill **Excel** (`.xlsx` with `Entries` and `Guide` sheets) or **JSON** templates.
  - **Cloud Sync & Storage**: Works immediately offline using browser `localStorage`; sign in with Google to sync privately across devices with Firestore and merge pending local entries.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite, `lucide-react`
- **Spreadsheets & Backups**: `xlsx` (SheetJS)
- **Backend & Persistence**: Firebase Authentication (Google Sign-In) + Cloud Firestore + `localStorage` fallback
- **Security Validation**: `@firebase/eslint-plugin-security-rules`

## Project Structure

```text
src/
├── components/
│   ├── AccountModal.tsx        # Add/edit/delete account modal
│   ├── AccountsView.tsx        # Categorized accounts overview & per-account transaction details
│   ├── ImportResultModal.tsx   # Summary modal after Excel/JSON imports
│   ├── LedgerView.tsx          # Main transaction feed & all-accounts balance panel
│   ├── MonthSummaryBar.tsx     # Period selector (Month / All) and net/income/expense summary
│   ├── Navigation.tsx          # Top navigation bar, brand lockup, mobile nav & FAB
│   ├── SettingsView.tsx        # Accounts, categories, theme, currency, backups & cloud sync
│   ├── StatsView.tsx           # Account & category breakdowns and 6-month trend charts
│   └── TransactionModal.tsx    # Add/edit/delete expense, income, or transfer entry
├── hooks/
│   └── useLedgerStore.ts       # Dual localStorage + Firestore reactive state store
├── lib/
│   └── firebase.ts             # Firebase app, Auth, and Firestore initialization
├── types/
│   └── ledger.ts               # Core TypeScript interfaces
├── utils/
│   ├── exportImport.ts         # Excel (.xlsx), CSV, JSON export/import & templates
│   └── ledger.ts               # Precision money math, date helpers & sample generator
├── App.tsx                     # Root layout, modals, and tab routing
└── index.css                   # Tailwind v4 setup and typography tokens
```

## Firestore Data Model & Security

User data is owner-isolated under `/users/{userId}` as defined in `firebase-blueprint.json` and enforced by `firestore.rules`:

- `/users/{userId}` — `LedgerSettings` (`currency`, `expenseCategories`, `incomeCategories`)
- `/users/{userId}/accounts/{accountId}` — `Account` (`name`, `opening`, `category`, `sortOrder`)
- `/users/{userId}/transactions/{transactionId}` — `Transaction` (`type`, `date`, `amount`, `cat`, `acc`, `to`, `note`, `ts`)

All reads and writes require Firebase Authentication with `request.auth.uid == userId` and strict schema/field validation.

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install Dependencies

```bash
npm install
```

### Run Development Server

Runs Vite on port `3000`:

```bash
npm run dev
```

### Type Check & Build

```bash
npm run lint
npm run build
```

### Preview Production Build

```bash
npm run preview
```
