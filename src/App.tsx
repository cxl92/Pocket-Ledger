import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountModal } from './components/AccountModal';
import { AccountsView } from './components/AccountsView';
import { ImportResultModal } from './components/ImportResultModal';
import { LedgerView } from './components/LedgerView';
import { MonthSummaryBar } from './components/MonthSummaryBar';
import { MobileNav, TopBar } from './components/Navigation';
import { SettingsView } from './components/SettingsView';
import { StatsView } from './components/StatsView';
import { TransactionModal } from './components/TransactionModal';
import { useLedgerStore } from './hooks/useLedgerStore';
import type {
  Account,
  AccountCategory,
  ImportSummary,
  TabId,
  ThemePreference,
  Transaction,
} from './types/ledger';
import {
  downloadJsonTemplate,
  downloadTemplate,
  exportCsv,
  exportJson,
  exportXlsx,
  parseExcelFile,
  parseJsonBackup,
} from './utils/exportImport';
import {
  compareTransactionsDesc,
  computeTotals,
  generateSampleTransactions,
  monthOf,
  shiftMonth,
  todayStr,
} from './utils/ledger';

const THEME_STORAGE_KEY = 'pocket-ledger-theme';
const LAST_ACC_STORAGE_KEY = 'pocket-ledger-lastacc';

function getStoredTheme(): ThemePreference {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') return val;
  } catch {
    // ignore
  }
  return 'system';
}

function getLastAcc(): string {
  try {
    return localStorage.getItem(LAST_ACC_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export default function App() {
  const store = useLedgerStore();
  const [activeTab, setActiveTab] = useState<TabId>('ledger');
  const [month, setMonth] = useState<string>(() => todayStr().slice(0, 7));
  const [ledgerAllMonths, setLedgerAllMonths] = useState<boolean>(false);
  const [theme, setTheme] = useState<ThemePreference>(getStoredTheme);
  const [toastMsg, setToastMsg] = useState<string>('');
  const toastTimer = useRef<number | null>(null);

  // Modal & detail selection state
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [modalDefaultAccId, setModalDefaultAccId] = useState<string>('');
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 3200);
  }, []);

  // Apply theme class to document.documentElement
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }

    const applyTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = theme === 'dark' || (theme === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', shouldBeDark);
    };

    applyTheme();
    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', applyTheme);
      return () => media.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  const monthTransactions = useMemo(
    () => store.transactions.filter((t) => t.date.slice(0, 7) === month),
    [store.transactions, month]
  );

  const monthTotals = useMemo(
    () => computeTotals(monthTransactions),
    [monthTransactions]
  );

  const allTotals = useMemo(
    () => computeTotals(store.transactions),
    [store.transactions]
  );

  const handleOpenNewEntry = () => {
    setEditingTx(null);
    setModalDefaultAccId(getLastAcc() || store.accounts[0]?.id || '');
    setTxModalOpen(true);
  };

  const handleOpenNewEntryForAccount = (accountId: string) => {
    setEditingTx(null);
    setModalDefaultAccId(accountId);
    setTxModalOpen(true);
  };

  const handleOpenEditEntry = (id: string) => {
    const found = store.transactions.find((t) => t.id === id) || null;
    if (found) {
      setEditingTx(found);
      setTxModalOpen(true);
    }
  };

  const handleSaveTx = async (tx: Omit<Transaction, 'id'> & { id?: string }) => {
    const isNew = !tx.id;
    const saved = await store.saveTransaction(tx);
    try {
      localStorage.setItem(LAST_ACC_STORAGE_KEY, saved.acc);
    } catch {
      // ignore
    }
    setMonth(monthOf(saved.date));
    if (activeTab !== 'accounts') {
      setActiveTab('ledger');
    }
    showToast(isNew ? 'Entry added' : 'Entry updated');
  };

  const handleDeleteTx = async (id: string) => {
    await store.deleteTransaction(id);
    showToast('Entry deleted');
  };

  const handleAddCategory = async (
    type: 'expense' | 'income',
    rawName: string
  ): Promise<boolean> => {
    const clean = rawName.trim().slice(0, 24);
    if (!clean) return false;
    const key = type === 'expense' ? 'expenseCategories' : 'incomeCategories';
    const current = store.settings[key];
    if (current.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      return true;
    }
    if (current.length >= 60) {
      showToast('Maximum of 60 categories reached.');
      return false;
    }
    await store.updateSettings({ [key]: [...current, clean] });
    return true;
  };

  const handleRemoveCategory = async (
    type: 'expense' | 'income',
    name: string
  ) => {
    const key = type === 'expense' ? 'expenseCategories' : 'incomeCategories';
    const current = store.settings[key];
    if (current.length <= 1) {
      showToast('Keep at least one category.');
      return;
    }
    await store.updateSettings({
      [key]: current.filter((c) => c !== name),
    });
  };

  const handleSaveAccount = async (account: {
    id?: string;
    name: string;
    opening: number;
    category: AccountCategory;
  }) => {
    const isNew = !account.id;
    await store.saveAccount(account);
    showToast(isNew ? 'Account added' : 'Account updated');
  };

  const handleDeleteAccount = async (id: string) => {
    await store.deleteAccount(id);
    if (selectedAccountId === id) {
      setSelectedAccountId(null);
    }
    showToast('Account deleted');
  };

  const handleLoadSample = async () => {
    const items = generateSampleTransactions(store.accounts);
    await store.bulkUpsert({ items });
    setActiveTab('ledger');
    setMonth(todayStr().slice(0, 7));
    showToast(`Added ${items.length} sample entries`);
  };

  const handleImportExcel = async (file: File) => {
    try {
      const parsed = await parseExcelFile(file, store.settings, store.accounts);
      await store.bulkUpsert({
        nextSettings: parsed.settingsChanged ? parsed.nextSettings : undefined,
        nextAccounts: parsed.accountsChanged ? parsed.nextAccounts : undefined,
        items: parsed.transactions,
      });
      if (parsed.transactions.length > 0) {
        const newest = parsed.transactions.slice().sort(compareTransactionsDesc)[0];
        setMonth(monthOf(newest.date));
        setActiveTab('ledger');
      }
      setImportSummary(parsed.summary);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'That file could not be read as an Excel file.'
      );
    }
  };

  const handleImportJson = async (file: File) => {
    try {
      const parsed = await parseJsonBackup(file, store.settings, store.accounts);
      await store.bulkUpsert({
        nextSettings: parsed.settingsChanged ? parsed.nextSettings : undefined,
        nextAccounts: parsed.accountsChanged ? parsed.nextAccounts : undefined,
        items: parsed.transactions,
      });
      showToast(`Restored ${parsed.transactions.length} entries`);
    } catch {
      showToast('That file is not a valid Pocket Ledger backup.');
    }
  };

  const handleClearAll = async () => {
    await store.clearAllTransactions();
    showToast('All entries deleted');
  };

  const canDeleteEditingAccount = Boolean(
    editingAccount &&
      store.accounts.length > 1 &&
      !store.transactions.some(
        (t) => t.acc === editingAccount.id || t.to === editingAccount.id
      )
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7f5] dark:bg-[#0e1412] text-[#14201c] dark:text-[#e6eee9]">
      <TopBar
        activeTab={activeTab}
        onSelectTab={(t) => {
          setActiveTab(t);
          setSelectedAccountId(null);
          window.scrollTo(0, 0);
        }}
        onAddEntry={handleOpenNewEntry}
        user={store.user}
        onSignIn={() => void store.signInWithGoogle()}
        onSignOut={() => void store.signOutUser()}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-32 md:pb-14">
          {store.errorBanner && (
            <div
              role="alert"
              className="mb-5 px-4 py-3 rounded-xl border border-[#b8402b]/40 bg-[#b8402b]/10 text-sm text-[#b8402b] dark:text-[#f08a74]"
            >
              {store.errorBanner}
            </div>
          )}

          {!store.ready ? (
            <div className="space-y-4 py-8">
              <div className="h-8 w-48 rounded-lg bg-[#e7ece9] dark:bg-[#202d27] animate-pulse" />
              <div className="h-12 w-64 rounded-lg bg-[#e7ece9] dark:bg-[#202d27] animate-pulse" />
              <div className="mt-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded-xl bg-[#e7ece9] dark:bg-[#202d27] animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {(activeTab === 'ledger' || activeTab === 'stats') && (
                <MonthSummaryBar
                  month={month}
                  currency={store.settings.currency}
                  incomeCents={
                    activeTab === 'ledger' && ledgerAllMonths
                      ? allTotals.income
                      : monthTotals.income
                  }
                  expenseCents={
                    activeTab === 'ledger' && ledgerAllMonths
                      ? allTotals.expense
                      : monthTotals.expense
                  }
                  showAllOption={activeTab === 'ledger'}
                  isAllMonths={activeTab === 'ledger' && ledgerAllMonths}
                  onSelectAllMonths={(all) => setLedgerAllMonths(all)}
                  onPrevMonth={() => setMonth((m) => shiftMonth(m, -1))}
                  onNextMonth={() => setMonth((m) => shiftMonth(m, 1))}
                  onCurrentMonth={() => setMonth(todayStr().slice(0, 7))}
                />
              )}

              {activeTab === 'ledger' && (
                <LedgerView
                  month={month}
                  isAllMonths={ledgerAllMonths}
                  currency={store.settings.currency}
                  accounts={store.accounts}
                  allTransactions={store.transactions}
                  monthTransactions={
                    ledgerAllMonths ? store.transactions : monthTransactions
                  }
                  onAddEntry={handleOpenNewEntry}
                  onEditEntry={handleOpenEditEntry}
                  onLoadSample={() => void handleLoadSample()}
                  onNavigateAccounts={() => setActiveTab('accounts')}
                />
              )}

              {activeTab === 'stats' && (
                <StatsView
                  month={month}
                  currency={store.settings.currency}
                  accounts={store.accounts}
                  allTransactions={store.transactions}
                  monthTransactions={monthTransactions}
                  onSelectMonth={(m) => setMonth(m)}
                />
              )}

              {activeTab === 'accounts' && (
                <AccountsView
                  currency={store.settings.currency}
                  month={month}
                  accounts={store.accounts}
                  transactions={store.transactions}
                  selectedAccountId={selectedAccountId}
                  onSelectAccount={(id) => setSelectedAccountId(id)}
                  onChangeMonth={(m) => setMonth(m)}
                  onEditAccount={(id) => {
                    const found = store.accounts.find((a) => a.id === id) || null;
                    if (found) {
                      setEditingAccount(found);
                      setAccModalOpen(true);
                    }
                  }}
                  onAddEntryForAccount={handleOpenNewEntryForAccount}
                  onEditTransaction={handleOpenEditEntry}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  user={store.user}
                  isCloud={store.isCloud}
                  settings={store.settings}
                  accounts={store.accounts}
                  transactions={store.transactions}
                  theme={theme}
                  pendingLocalMergeCount={store.pendingLocalMergeCount}
                  onChangeTheme={setTheme}
                  onSignIn={() => void store.signInWithGoogle()}
                  onSignOut={() => void store.signOutUser()}
                  onMergeLocal={() => {
                    void store.mergePendingLocalToCloud().then((count) => {
                      showToast(`Synced ${count} local entries to cloud`);
                    });
                  }}
                  onUpdateCurrency={(currency) => store.updateSettings({ currency })}
                  onAddAccount={() => {
                    setEditingAccount(null);
                    setAccModalOpen(true);
                  }}
                  onEditAccount={(id) => {
                    const found = store.accounts.find((a) => a.id === id) || null;
                    if (found) {
                      setEditingAccount(found);
                      setAccModalOpen(true);
                    }
                  }}
                  onAddCategory={handleAddCategory}
                  onRemoveCategory={handleRemoveCategory}
                  onExportXlsx={() => exportXlsx(store.accounts, store.transactions)}
                  onDownloadTemplate={() =>
                    downloadTemplate(store.accounts, store.settings)
                  }
                  onDownloadJsonTemplate={() =>
                    downloadJsonTemplate(store.accounts, store.settings)
                  }
                  onImportExcelFile={(file) => void handleImportExcel(file)}
                  onExportCsv={() => exportCsv(store.accounts, store.transactions)}
                  onExportJson={() =>
                    exportJson(store.settings, store.accounts, store.transactions)
                  }
                  onImportJsonFile={(file) => void handleImportJson(file)}
                  onLoadSample={() => void handleLoadSample()}
                  onClearAll={handleClearAll}
                  onToast={showToast}
                />
              )}
            </>
          )}
        </main>

      <MobileNav
        activeTab={activeTab}
        onSelectTab={(t) => {
          setActiveTab(t);
          setSelectedAccountId(null);
          window.scrollTo(0, 0);
        }}
        onAddEntry={handleOpenNewEntry}
      />

      <TransactionModal
        isOpen={txModalOpen}
        editingTx={editingTx}
        defaultAccountId={modalDefaultAccId || getLastAcc() || store.accounts[0]?.id || ''}
        accounts={store.accounts}
        settings={store.settings}
        onClose={() => setTxModalOpen(false)}
        onSave={handleSaveTx}
        onDelete={handleDeleteTx}
        onAddCategory={handleAddCategory}
      />

      <AccountModal
        isOpen={accModalOpen}
        editingAccount={editingAccount}
        currency={store.settings.currency}
        canDelete={canDeleteEditingAccount}
        onClose={() => setAccModalOpen(false)}
        onSave={handleSaveAccount}
        onDelete={handleDeleteAccount}
      />

      <ImportResultModal
        summary={importSummary}
        onClose={() => setImportSummary(null)}
      />

      {toastMsg && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-36 lg:bottom-8 z-50 px-4 py-2.5 rounded-xl bg-[#14201c] dark:bg-[#e6eee9] text-[#f5f7f5] dark:text-[#14201c] text-sm font-medium shadow-lg max-w-[calc(100%-32px)] text-center"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
