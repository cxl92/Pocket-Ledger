export type TransactionType = 'expense' | 'income' | 'transfer';

export type TabId = 'ledger' | 'stats' | 'accounts' | 'settings';

export type ThemePreference = 'system' | 'light' | 'dark';

export type AccountCategory = 'bank' | 'card' | 'cash' | 'digital';

export interface Account {
  id: string;
  name: string;
  opening: number;
  category: AccountCategory;
  sortOrder: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  amount: number;
  cat: string;
  acc: string;
  to: string;
  note: string;
  ts: number;
}

export interface LedgerSettings {
  currency: string;
  expenseCategories: string[];
  incomeCategories: string[];
}

export interface ImportSummary {
  added: number;
  skipped: string[];
}
