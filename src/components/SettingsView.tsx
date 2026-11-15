import React, { useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Download, LogIn, LogOut, Pencil, Plus, Upload } from 'lucide-react';
import type {
  Account,
  AccountCategory,
  LedgerSettings,
  ThemePreference,
  Transaction,
} from '../types/ledger';
import { c100, formatMoney } from '../utils/ledger';

const CATEGORY_LABEL: Record<AccountCategory, string> = {
  bank: 'Bank',
  card: 'Card',
  cash: 'Cash',
  digital: 'Digital',
};

interface SettingsViewProps {
  user: User | null;
  isCloud: boolean;
  settings: LedgerSettings;
  accounts: Account[];
  transactions: Transaction[];
  theme: ThemePreference;
  pendingLocalMergeCount: number;
  onChangeTheme: (next: ThemePreference) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onMergeLocal: () => void;
  onUpdateCurrency: (currency: string) => Promise<void>;
  onAddAccount: () => void;
  onEditAccount: (id: string) => void;
  onAddCategory: (type: 'expense' | 'income', name: string) => Promise<boolean>;
  onRemoveCategory: (type: 'expense' | 'income', name: string) => Promise<void>;
  onExportXlsx: () => void;
  onDownloadTemplate: () => void;
  onDownloadJsonTemplate: () => void;
  onImportExcelFile: (file: File) => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
  onLoadSample: () => void;
  onClearAll: () => Promise<void>;
  onToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  isCloud,
  settings,
  accounts,
  theme,
  pendingLocalMergeCount,
  onChangeTheme,
  onSignIn,
  onSignOut,
  onMergeLocal,
  onUpdateCurrency,
  onAddAccount,
  onEditAccount,
  onAddCategory,
  onRemoveCategory,
  onExportXlsx,
  onDownloadTemplate,
  onDownloadJsonTemplate,
  onImportExcelFile,
  onExportCsv,
  onExportJson,
  onImportJsonFile,
  onLoadSample,
  onClearAll,
  onToast,
}) => {
  const [currencyInput, setCurrencyInput] = useState(settings.currency);
  const [newExpCat, setNewExpCat] = useState('');
  const [newIncCat, setNewIncCat] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleCurrencySave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = currencyInput.trim().slice(0, 6);
    if (!cleaned) {
      onToast('Enter a currency symbol or code.');
      return;
    }
    await onUpdateCurrency(cleaned);
    onToast(`Currency set to ${cleaned}`);
  };

  const handleAddCat = async (type: 'expense' | 'income') => {
    const val = (type === 'expense' ? newExpCat : newIncCat).trim().slice(0, 24);
    if (!val) return;
    const added = await onAddCategory(type, val);
    if (added) {
      if (type === 'expense') setNewExpCat('');
      else setNewIncCat('');
      onToast(`Added ${val}`);
    }
  };

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    await onClearAll();
  };

  return (
    <div className="space-y-8">
      <header className="pb-4 border-b border-[#dce2de] dark:border-[#27342e]">
        <h1 className="text-xl font-semibold tracking-tight text-[#14201c] dark:text-[#e6eee9]">
          Settings
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column: Accounts, Expense & Income Categories */}
        <div className="space-y-6">
          <section className="bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#14201c] dark:text-[#e6eee9]">
                  Accounts
                </h2>
                <p className="text-xs text-[#5b6962] dark:text-[#8fa097] mt-0.5">
                  {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} configured
                </p>
              </div>
              <button
                type="button"
                onClick={onAddAccount}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1d4e89] hover:bg-[#173f70] dark:bg-[#86b4ee] dark:text-[#0b1a2e] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Add account</span>
              </button>
            </div>

            {accounts.length > 0 && (
              <div className="divide-y divide-[#dce2de] dark:divide-[#27342e] border-t border-[#dce2de] dark:border-[#27342e]">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => onEditAccount(acc.id)}
                    className="w-full py-2.5 px-2 -mx-2 rounded-lg flex items-center justify-between gap-3 text-left hover:bg-[#f2f4f1]/70 dark:hover:bg-[#202d27]/70 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <span className="block text-sm font-medium text-[#14201c] dark:text-[#e6eee9] truncate">
                        {acc.name}
                      </span>
                      <span className="block text-xs text-[#5b6962] dark:text-[#8fa097]">
                        {CATEGORY_LABEL[acc.category]} · Opening{' '}
                        {formatMoney(c100(acc.opening), settings.currency)}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[#5b6962] dark:text-[#8fa097] inline-flex items-center gap-1">
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl p-5 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-[#14201c] dark:text-[#e6eee9]">
                Expense categories
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {settings.expenseCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onRemoveCategory('expense', cat)}
                    aria-label={`Remove ${cat}`}
                    className="min-h-[34px] px-3 rounded-lg border border-[#dce2de] dark:border-[#27342e] bg-[#f5f7f5] dark:bg-[#0e1412] hover:border-[#b8402b] dark:hover:border-[#f08a74] text-xs font-medium transition-colors cursor-pointer"
                  >
                    {cat} ×
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={newExpCat}
                  onChange={(e) => setNewExpCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAddCat('expense');
                    }
                  }}
                  maxLength={24}
                  placeholder="New expense category"
                  aria-label="New expense category"
                  className="flex-1 min-h-[42px] px-3 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#f5f7f5] dark:bg-[#0e1412] text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleAddCat('expense')}
                  className="min-h-[42px] px-4 rounded-xl border border-[#dce2de] dark:border-[#27342e] hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] text-sm font-medium cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-[#dce2de] dark:border-[#27342e]">
              <h2 className="text-sm font-semibold text-[#14201c] dark:text-[#e6eee9]">
                Income categories
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {settings.incomeCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onRemoveCategory('income', cat)}
                    aria-label={`Remove ${cat}`}
                    className="min-h-[34px] px-3 rounded-lg border border-[#dce2de] dark:border-[#27342e] bg-[#f5f7f5] dark:bg-[#0e1412] hover:border-[#b8402b] dark:hover:border-[#f08a74] text-xs font-medium transition-colors cursor-pointer"
                  >
                    {cat} ×
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={newIncCat}
                  onChange={(e) => setNewIncCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAddCat('income');
                    }
                  }}
                  maxLength={24}
                  placeholder="New income category"
                  aria-label="New income category"
                  className="flex-1 min-h-[42px] px-3 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#f5f7f5] dark:bg-[#0e1412] text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleAddCat('income')}
                  className="min-h-[42px] px-4 rounded-xl border border-[#dce2de] dark:border-[#27342e] hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] text-sm font-medium cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Appearance, Currency, Excel/CSV Backups, Ledger Data & Cloud Sync */}
        <div className="space-y-6">
          <section className="bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl p-5 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-[#14201c] dark:text-[#e6eee9]">
                Appearance
              </h2>
              <div
                role="group"
                aria-label="Theme preference"
                className="mt-3 grid grid-cols-3 bg-[#e7ece9] dark:bg-[#202d27] rounded-xl p-1 gap-1"
              >
                {(['system', 'light', 'dark'] as ThemePreference[]).map((opt) => {
                  const active = theme === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onChangeTheme(opt)}
                      aria-pressed={active}
                      className={`min-h-[38px] rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#ffffff] dark:bg-[#17211d] text-[#14201c] dark:text-[#e6eee9] font-semibold border border-[#dce2de] dark:border-[#27342e]'
                          : 'text-[#5b6962] dark:text-[#8fa097] border border-transparent'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleCurrencySave} className="pt-4 border-t border-[#dce2de] dark:border-[#27342e]">
              <label
                htmlFor="currency-input"
                className="block text-sm font-semibold text-[#14201c] dark:text-[#e6eee9]"
              >
                Currency symbol or code
              </label>
              <div className="mt-2.5 flex gap-2">
                <input
                  id="currency-input"
                  maxLength={6}
                  value={currencyInput}
                  onChange={(e) => setCurrencyInput(e.target.value)}
                  className="flex-1 min-h-[44px] px-3 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#f5f7f5] dark:bg-[#0e1412] text-sm font-num"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-4 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] hover:bg-[#e7ece9] dark:hover:bg-[#202d27] text-sm font-medium cursor-pointer whitespace-nowrap"
                >
                  Save
                </button>
              </div>
            </form>
          </section>

          <section className="bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-[#14201c] dark:text-[#e6eee9]">
              Excel, CSV, and JSON backups
            </h2>

            {/* Export */}
            <div className="space-y-2.5">
              <span className="block text-xs font-semibold text-[#5b6962] dark:text-[#8fa097]">
                Export
              </span>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={onExportXlsx}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={onExportCsv}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={onExportJson}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* Import */}
            <div className="pt-4 border-t border-[#dce2de] dark:border-[#27342e] space-y-2.5">
              <span className="block text-xs font-semibold text-[#5b6962] dark:text-[#8fa097]">
                Import
              </span>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => excelInputRef.current?.click()}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => jsonInputRef.current?.click()}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>JSON</span>
                </button>
              </div>
              <p className="text-xs text-[#5b6962] dark:text-[#8fa097]">
                Accepts `.xlsx`, `.xls`, `.csv`, or `.json`. Missing accounts and categories are created automatically.
              </p>
            </div>

            {/* Template */}
            <div className="pt-4 border-t border-[#dce2de] dark:border-[#27342e] space-y-2.5">
              <span className="block text-xs font-semibold text-[#5b6962] dark:text-[#8fa097]">
                Template
              </span>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={onDownloadTemplate}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={onDownloadJsonTemplate}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>JSON</span>
                </button>
              </div>
            </div>

            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onImportExcelFile(file);
              }}
            />
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onImportJsonFile(file);
              }}
            />
          </section>

          <section className="bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#14201c] dark:text-[#e6eee9]">
              Ledger data
            </h2>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={onLoadSample}
                className="min-h-[42px] px-4 rounded-xl border border-[#dce2de] dark:border-[#27342e] hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] text-sm font-medium cursor-pointer"
              >
                Add sample entries
              </button>
              <button
                type="button"
                onClick={() => void handleClear()}
                className="min-h-[42px] px-4 rounded-xl border border-[#b8402b] dark:border-[#f08a74] text-[#b8402b] dark:text-[#f08a74] hover:bg-[#b8402b]/10 text-sm font-medium cursor-pointer"
              >
                {confirmClear ? 'Tap again to delete every entry' : 'Delete all entries'}
              </button>
            </div>
          </section>

          <section className="bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#14201c] dark:text-[#e6eee9]">
              Cloud sync and storage
            </h2>
            {isCloud && user ? (
              <div className="space-y-3">
                <p className="text-sm text-[#5b6962] dark:text-[#8fa097]">
                  Signed in as{' '}
                  <span className="font-medium text-[#14201c] dark:text-[#e6eee9]">
                    {user.email || user.displayName}
                  </span>
                  . Your entries, accounts, and categories sync privately across devices.
                </p>
                {pendingLocalMergeCount > 0 && (
                  <div className="p-3 rounded-xl bg-[#e7ece9] dark:bg-[#202d27] flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-[#14201c] dark:text-[#e6eee9]">
                      {pendingLocalMergeCount} local{' '}
                      {pendingLocalMergeCount === 1 ? 'entry' : 'entries'} found in this browser.
                    </span>
                    <button
                      type="button"
                      onClick={onMergeLocal}
                      className="min-h-[36px] px-3 rounded-lg bg-[#1d4e89] dark:bg-[#86b4ee] text-white dark:text-[#0b1a2e] text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Sync to cloud
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onSignOut}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#dce2de] dark:border-[#27342e] text-sm font-medium inline-flex items-center gap-2 hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[#5b6962] dark:text-[#8fa097]">
                  Currently saved in this browser only. Sign in with Google to back up your ledger to the cloud and sync across devices.
                </p>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1d4e89] hover:bg-[#173f70] dark:bg-[#86b4ee] dark:text-[#0b1a2e] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign in with Google</span>
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
