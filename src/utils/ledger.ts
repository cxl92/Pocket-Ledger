import type {
  Account,
  AccountCategory,
  LedgerSettings,
  Transaction,
} from '../types/ledger';

export const pad = (n: number): string => String(n).padStart(2, '0');

export const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const monthOf = (ds: string): string => ds.slice(0, 7);

export const shiftMonth = (m: string, n: number): string => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const monthLabel = (m: string): string => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
};

export const monthShort = (m: string): string => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'short' });
};

export const dayLabel = (ds: string): string => {
  const [y, mo, day] = ds.split('-').map(Number);
  const s = new Date(y, mo - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return ds === todayStr() ? `Today, ${s}` : s;
};

export const validDate = (y: number, m: number, d: number): string | null => {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return `${y}-${pad(m)}-${pad(d)}`;
};

export const c100 = (n: number | string): number => Math.round(Number(n) * 100) || 0;

const numberFormatter = new Intl.NumberFormat('en-MY', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatMoney = (cents: number, currency: string): string =>
  `${cents < 0 ? '-' : ''}${currency} ${numberFormatter.format(Math.abs(cents) / 100)}`;

export const formatCompact = (cents: number): string => {
  const v = Math.abs(cents) / 100;
  const prefix = cents < 0 ? '-' : '';
  if (v >= 1000) {
    return `${prefix}${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  }
  return `${prefix}${Math.round(v)}`;
};

export const newId = (prefix = 't'): string =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const normName = (s: string | null | undefined): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const sanitizeId = (id: string, fallbackPrefix = 'id'): string => {
  const cleaned = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  return cleaned.length > 0 ? cleaned : newId(fallbackPrefix);
};

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'F&B',
  'Grocery and household',
  'Transport',
  'Bill',
  'Education',
  'Sports',
  'Beauty',
  'Health',
  'Apparel',
  'Social Life',
  'Gift',
  'Petty cash',
  'FD/Saving',
  'Other',
];

export const DEFAULT_INCOME_CATEGORIES: string[] = [
  'Salary',
  'Bonus',
  'Allowance',
  'Interest',
  'Gift',
  'Other',
];

export const ACCOUNT_CATEGORIES: { id: AccountCategory; label: string }[] = [
  { id: 'bank', label: 'Bank' },
  { id: 'card', label: 'Card' },
  { id: 'cash', label: 'Cash' },
  { id: 'digital', label: 'Digital' },
];

export const isAccountCategory = (val: unknown): val is AccountCategory =>
  val === 'bank' || val === 'card' || val === 'cash' || val === 'digital';

export const inferAccountCategory = (name: string): AccountCategory => {
  const n = String(name || '').toLowerCase();
  if (/\bcash\b|petty/.test(n)) return 'cash';
  if (/card|visa|master|credit|debit|amex/.test(n)) return 'card';
  if (/ewallet|e-wallet|wallet|gxbank|tng|grab|boost|paypal|wise|revolut|digital|apple\s*pay/.test(n))
    return 'digital';
  return 'bank';
};

const DEFAULT_ACCOUNTS: { name: string; category: AccountCategory }[] = [
  { name: 'Maybank', category: 'bank' },
  { name: 'Pbe', category: 'bank' },
  { name: 'HL', category: 'bank' },
  { name: 'Uob', category: 'bank' },
  { name: 'Pbe Master', category: 'card' },
  { name: 'Pbe Visa', category: 'card' },
  { name: 'Cash', category: 'cash' },
  { name: 'Ewallet', category: 'digital' },
  { name: 'Gxbank', category: 'digital' },
];

export const createDefaultSettings = (): LedgerSettings => ({
  currency: 'RM',
  expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
  incomeCategories: [...DEFAULT_INCOME_CATEGORIES],
});

export const createDefaultAccounts = (): Account[] =>
  DEFAULT_ACCOUNTS.map((item, idx) => ({
    id: normName(item.name) || `acc${idx}`,
    name: item.name,
    opening: 0,
    category: item.category,
    sortOrder: idx,
  }));

export const compareTransactionsDesc = (a: Transaction, b: Transaction): number =>
  b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0);

export const computeTotals = (list: Transaction[]): { income: number; expense: number } => {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += c100(t.amount);
    else if (t.type === 'expense') expense += c100(t.amount);
  }
  return { income, expense };
};

export const computeAccountBalances = (
  accounts: Account[],
  transactions: Transaction[]
): Record<string, number> => {
  const balances: Record<string, number> = {};
  for (const a of accounts) {
    balances[a.id] = c100(a.opening);
  }
  for (const t of transactions) {
    const cents = c100(t.amount);
    if (t.type === 'income' && balances[t.acc] !== undefined) {
      balances[t.acc] += cents;
    } else if (t.type === 'expense' && balances[t.acc] !== undefined) {
      balances[t.acc] -= cents;
    } else if (t.type === 'transfer') {
      if (balances[t.acc] !== undefined) balances[t.acc] -= cents;
      if (balances[t.to] !== undefined) balances[t.to] += cents;
    }
  }
  return balances;
};

export const generateSampleTransactions = (accounts: Account[]): Transaction[] => {
  const now = new Date();
  const td = now.getDate();
  const currentMonth = todayStr().slice(0, 7);
  const findAcc = (...names: string[]): string => {
    for (const n of names) {
      const found = accounts.find((x) => normName(x.name) === n);
      if (found) return found.id;
    }
    return accounts[0]?.id ?? 'maybank';
  };

  const bank = findAcc('maybank', 'pbe', 'bank');
  const wallet = findAcc('ewallet', 'gxbank');
  const cash = findAcc('cash');
  const card = findAcc('pbemaster', 'pbevisa', 'uob');

  const items: Transaction[] = [];
  const add = (
    offset: number,
    day: number,
    type: Transaction['type'],
    cat: string,
    acc: string,
    amount: number,
    note: string,
    to = ''
  ) => {
    const m = shiftMonth(currentMonth, offset);
    const [y, mo] = m.split('-').map(Number);
    const dim = new Date(y, mo, 0).getDate();
    let d = Math.min(day, dim);
    if (offset === 0) d = Math.min(d, td);
    items.push({
      id: newId('t'),
      type,
      date: `${m}-${pad(d)}`,
      amount,
      cat,
      acc,
      to,
      note,
      ts: Date.now() + items.length,
    });
  };

  [-1, 0].forEach((offset) => {
    add(offset, 1, 'income', 'Salary', bank, 4800, 'Monthly salary');
    add(offset, 2, 'expense', 'Bill', bank, 1200, 'Room rent');
    add(offset, 3, 'transfer', '', bank, 300, 'Top up e-wallet', wallet);
    add(offset, 4, 'expense', 'F&B', wallet, 14.5, 'Lunch');
    add(offset, 6, 'expense', 'Transport', wallet, 22, 'Fuel');
    add(offset, 8, 'expense', 'Bill', card, 98.9, 'Internet & mobile');
    add(offset, 10, 'expense', 'F&B', cash, 9.8, 'Breakfast');
    add(offset, 12, 'expense', 'Grocery and household', wallet, 76.4, 'Weekly groceries');
    add(offset, 14, 'income', 'Bonus', cash, 250, 'Side project payout');
    add(offset, 16, 'expense', 'F&B', wallet, 38.2, 'Dinner with friends');
  });

  return items;
};
