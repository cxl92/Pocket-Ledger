import * as XLSX from 'xlsx';
import type { Account, ImportSummary, LedgerSettings, Transaction } from '../types/ledger';
import {
  compareTransactionsDesc,
  createDefaultAccounts,
  inferAccountCategory,
  isAccountCategory,
  newId,
  pad,
  sanitizeId,
  todayStr,
  validDate,
} from './ledger';

const XL_HEAD = ['Date', 'Type', 'Category', 'Account', 'To account', 'Amount', 'Note'];

const toExcelSerial = (ds: string): number => {
  const [y, m, d] = ds.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569;
};

const capFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const normKey = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const parseExcelDate = (v: unknown): string | null => {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const o = XLSX.SSF.parse_date_code(v);
    return o && o.y ? validDate(o.y, o.m, o.d) : null;
  }
  if (v instanceof Date) {
    return validDate(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return validDate(y, Number(m[2]), Number(m[1]));
  }
  return null;
};

const triggerDownload = (filename: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const buildEntriesSheet = (rows: (string | number)[][], widths: number[]): XLSX.WorkSheet => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  for (let r = 1; r < rows.length; r++) {
    const dCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (dCell && dCell.t === 'n') dCell.z = 'yyyy-mm-dd';
    const aCell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
    if (aCell && aCell.t === 'n') aCell.z = '#,##0.00';
  }
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  return ws;
};

const accountNameOf = (accounts: Account[], id: string): string =>
  accounts.find((a) => a.id === id)?.name ?? 'Unknown account';

export const exportXlsx = (accounts: Account[], transactions: Transaction[]): void => {
  const rows: (string | number)[][] = [[...XL_HEAD, 'ID']];
  transactions
    .slice()
    .sort(compareTransactionsDesc)
    .forEach((t) => {
      rows.push([
        toExcelSerial(t.date),
        capFirst(t.type),
        t.cat || '',
        accountNameOf(accounts, t.acc),
        t.type === 'transfer' ? accountNameOf(accounts, t.to) : '',
        Number(t.amount),
        t.note || '',
        t.id,
      ]);
    });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    buildEntriesSheet(rows, [12, 10, 18, 16, 16, 12, 34, 18]),
    'Entries'
  );

  const accRows: (string | number)[][] = [
    ['Account', 'Opening balance'],
    ...accounts.map((a) => [a.name, Number(a.opening) || 0]),
  ];
  const wa = XLSX.utils.aoa_to_sheet(accRows);
  wa['!cols'] = [{ wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wa, 'Accounts');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  triggerDownload(
    `pocket-ledger-${todayStr()}.xlsx`,
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  );
};

export const downloadTemplate = (
  accounts: Account[],
  settings: LedgerSettings
): void => {
  const d = toExcelSerial(todayStr());
  const firstAcc = accounts[0]?.name || 'Maybank';
  const secondAcc = accounts[1]?.name || firstAcc;

  const rows: (string | number)[][] = [
    XL_HEAD,
    [
      d,
      'Expense',
      settings.expenseCategories[0] || 'F&B',
      firstAcc,
      '',
      12.5,
      'Example: lunch (delete this row)',
    ],
    [
      d,
      'Income',
      settings.incomeCategories[0] || 'Salary',
      firstAcc,
      '',
      3000,
      'Example: salary (delete this row)',
    ],
    [
      d,
      'Transfer',
      '',
      firstAcc,
      secondAcc,
      200,
      'Example: move money between accounts (delete this row)',
    ],
  ];

  const guide = [
    ['How to fill in the Entries sheet', ''],
    ['', ''],
    ['Date', 'Any date, such as 2026-11-15. Text dates with slashes are read day first (e.g. 15/11/2026).'],
    ['Type', 'Expense, Income, or Transfer.'],
    ['Category', 'Leave empty for a Transfer. New categories are added automatically.'],
    ['Account', 'Account money leaves (expense/transfer) or enters (income). New accounts are created automatically.'],
    ['To account', 'Transfer only: destination account.'],
    ['Amount', 'Positive number without currency symbol.'],
    ['Note', 'Optional memo up to 120 characters.'],
    ['ID', 'Leave blank for new entries. Re-uploading an export with IDs updates matching entries.'],
    ['', ''],
    ['Your accounts', accounts.map((a) => a.name).join(', ')],
    ['Expense categories', settings.expenseCategories.join(', ')],
    ['Income categories', settings.incomeCategories.join(', ')],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    buildEntriesSheet(rows, [12, 10, 18, 16, 16, 12, 46]),
    'Entries'
  );
  const wg = XLSX.utils.aoa_to_sheet(guide);
  wg['!cols'] = [{ wch: 22 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wg, 'Guide');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  triggerDownload(
    'pocket-ledger-template.xlsx',
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  );
};

const csvCell = (v: unknown): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportCsv = (accounts: Account[], transactions: Transaction[]): void => {
  const rows: string[][] = [XL_HEAD];
  transactions
    .slice()
    .sort(compareTransactionsDesc)
    .forEach((t) => {
      rows.push([
        t.date,
        t.type,
        t.cat || '',
        accountNameOf(accounts, t.acc),
        t.type === 'transfer' ? accountNameOf(accounts, t.to) : '',
        Number(t.amount).toFixed(2),
        t.note || '',
      ]);
    });
  const text = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  triggerDownload(
    `pocket-ledger-${todayStr()}.csv`,
    new Blob([text], { type: 'text/csv;charset=utf-8' })
  );
};

export const exportJson = (
  settings: LedgerSettings,
  accounts: Account[],
  transactions: Transaction[]
): void => {
  const payload = {
    app: 'pocket-ledger',
    version: 2,
    exported: new Date().toISOString(),
    settings,
    accounts,
    tx: transactions,
  };
  triggerDownload(
    `pocket-ledger-${todayStr()}.json`,
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  );
};

export const downloadJsonTemplate = (
  accounts: Account[],
  settings: LedgerSettings
): void => {
  const d = todayStr();
  const firstAcc = accounts[0]?.id || 'maybank';
  const secondAcc = accounts[1]?.id || firstAcc;
  const now = Date.now();

  const sampleTx: Transaction[] = [
    {
      id: 'sample_exp_1',
      type: 'expense',
      date: d,
      amount: 12.5,
      cat: settings.expenseCategories[0] || 'F&B',
      acc: firstAcc,
      to: '',
      note: 'Example: lunch (replace or delete)',
      ts: now,
    },
    {
      id: 'sample_inc_1',
      type: 'income',
      date: d,
      amount: 3000,
      cat: settings.incomeCategories[0] || 'Salary',
      acc: firstAcc,
      to: '',
      note: 'Example: salary (replace or delete)',
      ts: now + 1,
    },
  ];

  if (secondAcc !== firstAcc) {
    sampleTx.push({
      id: 'sample_trf_1',
      type: 'transfer',
      date: d,
      amount: 200,
      cat: '',
      acc: firstAcc,
      to: secondAcc,
      note: 'Example: move money between accounts (replace or delete)',
      ts: now + 2,
    });
  }

  const payload = {
    app: 'pocket-ledger',
    version: 2,
    template: true,
    settings,
    accounts,
    tx: sampleTx,
  };

  triggerDownload(
    'pocket-ledger-template.json',
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  );
};

export interface ParsedImportPayload {
  summary: ImportSummary;
  nextSettings: LedgerSettings;
  nextAccounts: Account[];
  settingsChanged: boolean;
  accountsChanged: boolean;
  transactions: Transaction[];
}

export const parseExcelFile = async (
  file: File,
  currentSettings: LedgerSettings,
  currentAccounts: Account[]
): Promise<ParsedImportPayload> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sn = wb.SheetNames.find((n) => n.toLowerCase() === 'entries') || wb.SheetNames[0];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], {
    header: 1,
    raw: true,
    defval: '',
  });

  let headerRow = -1;
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const keys = aoa[i].map(normKey);
    if (keys.includes('date') && keys.includes('amount')) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) {
    throw new Error('No header row with Date and Amount columns was found. Try downloading the template.');
  }

  const alias: Record<string, string> = {
    date: 'date',
    type: 'type',
    category: 'cat',
    cat: 'cat',
    account: 'acc',
    from: 'acc',
    fromaccount: 'acc',
    toaccount: 'to',
    to: 'to',
    amount: 'amount',
    note: 'note',
    notes: 'note',
    description: 'note',
    memo: 'note',
    id: 'id',
  };

  const col: Record<string, number> = {};
  aoa[headerRow].forEach((h, i) => {
    const field = alias[normKey(h)];
    if (field && col[field] === undefined) col[field] = i;
  });

  const nextSettings: LedgerSettings = {
    currency: currentSettings.currency,
    expenseCategories: [...currentSettings.expenseCategories],
    incomeCategories: [...currentSettings.incomeCategories],
  };
  const nextAccounts: Account[] = currentAccounts.length
    ? currentAccounts.map((a) => ({ ...a }))
    : createDefaultAccounts();

  let settingsChanged = false;
  let accountsChanged = currentAccounts.length === 0;
  let seq = 0;

  const ensureAcc = (rawName: unknown): Account => {
    const name = String(rawName ?? '').trim().slice(0, 30);
    const existing = nextAccounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const acc: Account = {
      id: `a${Date.now().toString(36)}${seq++}`,
      name,
      opening: 0,
      category: inferAccountCategory(name),
      sortOrder: nextAccounts.length,
    };
    nextAccounts.push(acc);
    accountsChanged = true;
    return acc;
  };

  const wsAccName = wb.SheetNames.find((n) => n.toLowerCase() === 'accounts');
  if (wsAccName) {
    const accAoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wsAccName], {
      header: 1,
      raw: true,
      defval: '',
    });
    accAoa.slice(1).forEach((r) => {
      if (!String(r[0] ?? '').trim()) return;
      const a = ensureAcc(r[0]);
      const rawOpen = r[1];
      const openVal =
        typeof rawOpen === 'number'
          ? rawOpen
          : parseFloat(String(rawOpen ?? '').replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(openVal) && openVal !== a.opening) {
        a.opening = openVal;
        accountsChanged = true;
      }
    });
  }

  const transactions: Transaction[] = [];
  const skipped: string[] = [];

  for (let i = headerRow + 1; i < aoa.length; i++) {
    const row = aoa[i];
    const line = i + 1;
    const cell = (k: string): unknown => (col[k] === undefined ? '' : row[col[k]]);
    if (row.every((c) => String(c ?? '').trim() === '')) continue;

    const rawType = String(cell('type')).trim().toLowerCase();
    if (rawType !== 'expense' && rawType !== 'income' && rawType !== 'transfer') {
      skipped.push(`Row ${line}: type must be Expense, Income, or Transfer`);
      continue;
    }

    const date = parseExcelDate(cell('date'));
    if (!date) {
      skipped.push(`Row ${line}: date not recognised`);
      continue;
    }

    const rawAmt = cell('amount');
    const parsedAmt =
      typeof rawAmt === 'number'
        ? rawAmt
        : parseFloat(String(rawAmt ?? '').replace(/[^0-9.-]/g, ''));
    const amount = Math.round(parsedAmt * 100) / 100;
    if (!(amount > 0)) {
      skipped.push(`Row ${line}: amount must be a positive number`);
      continue;
    }

    const accName = String(cell('acc')).trim();
    if (!accName) {
      skipped.push(`Row ${line}: account is empty`);
      continue;
    }

    let toId = '';
    if (rawType === 'transfer') {
      const toName = String(cell('to')).trim();
      if (!toName) {
        skipped.push(`Row ${line}: transfer needs a To account`);
        continue;
      }
      if (toName.toLowerCase() === accName.toLowerCase()) {
        skipped.push(`Row ${line}: From and To accounts cannot be the same`);
        continue;
      }
      const fromAcc = ensureAcc(accName);
      toId = ensureAcc(toName).id;
      const rawId = String(cell('id')).trim();
      const id = /^[A-Za-z0-9_-]{1,128}$/.test(rawId) ? rawId : newId('t');
      transactions.push({
        id,
        type: 'transfer',
        date,
        amount,
        cat: '',
        acc: fromAcc.id,
        to: toId,
        note: String(cell('note')).trim().slice(0, 120),
        ts: Date.now() + transactions.length,
      });
      continue;
    }

    const acc = ensureAcc(accName);
    let cat = String(cell('cat')).trim().slice(0, 24) || 'Other';
    const catList =
      rawType === 'expense' ? nextSettings.expenseCategories : nextSettings.incomeCategories;
    const matchedCat = catList.find((c) => c.toLowerCase() === cat.toLowerCase());
    if (matchedCat) {
      cat = matchedCat;
    } else if (catList.length < 60) {
      catList.push(cat);
      settingsChanged = true;
    }

    const rawId = String(cell('id')).trim();
    const id = /^[A-Za-z0-9_-]{1,128}$/.test(rawId) ? rawId : newId('t');
    transactions.push({
      id,
      type: rawType,
      date,
      amount,
      cat,
      acc: acc.id,
      to: '',
      note: String(cell('note')).trim().slice(0, 120),
      ts: Date.now() + transactions.length,
    });
  }

  return {
    summary: { added: transactions.length, skipped },
    nextSettings,
    nextAccounts,
    settingsChanged,
    accountsChanged,
    transactions,
  };
};

export const parseJsonBackup = async (
  file: File,
  currentSettings: LedgerSettings,
  currentAccounts: Account[]
): Promise<ParsedImportPayload> => {
  const raw = JSON.parse(await file.text()) as {
    settings?: {
      currency?: unknown;
      expenseCategories?: unknown;
      incomeCategories?: unknown;
      cats?: { expense?: unknown; income?: unknown };
      accounts?: unknown[];
    };
    accounts?: unknown[];
    tx?: unknown[];
  };

  const nextSettings: LedgerSettings = {
    currency:
      typeof raw.settings?.currency === 'string' && raw.settings.currency.trim()
        ? raw.settings.currency.trim().slice(0, 6)
        : currentSettings.currency,
    expenseCategories: [...currentSettings.expenseCategories],
    incomeCategories: [...currentSettings.incomeCategories],
  };

  const expSrc = Array.isArray(raw.settings?.expenseCategories)
    ? raw.settings?.expenseCategories
    : Array.isArray(raw.settings?.cats?.expense)
      ? raw.settings?.cats?.expense
      : null;
  if (expSrc && expSrc.length > 0) {
    nextSettings.expenseCategories = expSrc
      .map((s) => String(s).trim().slice(0, 24))
      .filter(Boolean)
      .slice(0, 60);
  }

  const incSrc = Array.isArray(raw.settings?.incomeCategories)
    ? raw.settings?.incomeCategories
    : Array.isArray(raw.settings?.cats?.income)
      ? raw.settings?.cats?.income
      : null;
  if (incSrc && incSrc.length > 0) {
    nextSettings.incomeCategories = incSrc
      .map((s) => String(s).trim().slice(0, 24))
      .filter(Boolean)
      .slice(0, 60);
  }

  const accSrc = Array.isArray(raw.accounts)
    ? raw.accounts
    : Array.isArray(raw.settings?.accounts)
      ? raw.settings?.accounts
      : null;

  let nextAccounts = currentAccounts.map((a) => ({ ...a }));
  let accountsChanged = false;
  if (accSrc && accSrc.length > 0) {
    const parsedAccs: Account[] = [];
    accSrc.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const obj = item as Record<string, unknown>;
      const name = String(obj.name ?? '').trim().slice(0, 30);
      if (!name) return;
      parsedAccs.push({
        id: sanitizeId(String(obj.id ?? ''), 'a'),
        name,
        opening: Number(obj.opening) || 0,
        category: isAccountCategory(obj.category)
          ? obj.category
          : inferAccountCategory(name),
        sortOrder: Number(obj.sortOrder ?? idx) || idx,
      });
    });
    if (parsedAccs.length > 0) {
      nextAccounts = parsedAccs;
      accountsChanged = true;
    }
  }

  const fallbackAccId = nextAccounts[0]?.id ?? 'maybank';
  const transactions: Transaction[] = [];
  const skipped: string[] = [];

  (Array.isArray(raw.tx) ? raw.tx : []).forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const obj = item as Record<string, unknown>;
    const type = String(obj.type ?? '').toLowerCase();
    const amount = Math.round(Number(obj.amount) * 100) / 100;
    const dateStr = String(obj.date ?? '');
    if (
      (type !== 'expense' && type !== 'income' && type !== 'transfer') ||
      !(amount > 0) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ) {
      skipped.push(`Entry ${idx + 1}: invalid type, date, or amount`);
      return;
    }
    const acc = sanitizeId(String(obj.acc || fallbackAccId), 'a');
    let to = type === 'transfer' ? sanitizeId(String(obj.to || ''), 'a') : '';
    if (type === 'transfer' && (!to || to === acc)) {
      skipped.push(`Entry ${idx + 1}: transfer requires a different To account`);
      return;
    }
    transactions.push({
      id: sanitizeId(String(obj.id ?? ''), 't'),
      type,
      date: dateStr,
      amount,
      cat: type === 'transfer' ? '' : String(obj.cat ?? 'Other').trim().slice(0, 24),
      acc,
      to,
      note: String(obj.note ?? '').trim().slice(0, 120),
      ts: Number(obj.ts) || Date.now() + idx,
    });
  });

  // Ensure pad is used if needed
  void pad;

  return {
    summary: { added: transactions.length, skipped },
    nextSettings,
    nextAccounts,
    settingsChanged: Boolean(raw.settings),
    accountsChanged,
    transactions,
  };
};
