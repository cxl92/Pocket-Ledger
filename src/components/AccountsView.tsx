import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import type {
  Account,
  AccountCategory,
  Transaction,
  TransactionType,
} from '../types/ledger';
import {
  ACCOUNT_CATEGORIES,
  c100,
  compareTransactionsDesc,
  computeAccountBalances,
  dayLabel,
  formatMoney,
  monthLabel,
  monthShort,
  shiftMonth,
  todayStr,
} from '../utils/ledger';

interface AccountsViewProps {
  currency: string;
  month: string;
  accounts: Account[];
  transactions: Transaction[];
  selectedAccountId: string | null;
  onSelectAccount: (id: string | null) => void;
  onChangeMonth: (month: string) => void;
  onEditAccount: (id: string) => void;
  onAddEntryForAccount: (accountId: string) => void;
  onEditTransaction: (txId: string) => void;
}

type PeriodMode = 'all' | 'month';
type TxFilter = 'all' | TransactionType;

const CATEGORY_LABEL: Record<AccountCategory, string> = {
  bank: 'Bank',
  card: 'Card',
  cash: 'Cash',
  digital: 'Digital',
};

export const AccountsView: React.FC<AccountsViewProps> = ({
  currency,
  month,
  accounts,
  transactions,
  selectedAccountId,
  onSelectAccount,
  onChangeMonth,
  onEditAccount,
  onAddEntryForAccount,
  onEditTransaction,
}) => {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [txTypeFilter, setTxTypeFilter] = useState<TxFilter>('all');
  const [txSearch, setTxSearch] = useState('');

  // Build selectable month list (all months with transactions + recent 12 months + active month)
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    const current = todayStr().slice(0, 7);
    set.add(current);
    set.add(month);
    for (let i = -11; i <= 1; i++) {
      set.add(shiftMonth(current, i));
    }
    for (const t of transactions) {
      if (t.date && t.date.length >= 7) {
        set.add(t.date.slice(0, 7));
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [transactions, month]);

  const balances = useMemo(
    () => computeAccountBalances(accounts, transactions),
    [accounts, transactions]
  );

  const totalCents = useMemo(
    () => accounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0),
    [accounts, balances]
  );

  // All-time transaction counts per account for the main Accounts screen
  const allAccountEntryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      map.set(t.acc, (map.get(t.acc) || 0) + 1);
      if (t.type === 'transfer' && t.to) {
        map.set(t.to, (map.get(t.to) || 0) + 1);
      }
    }
    return map;
  }, [transactions]);

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [accounts]);

  const selectedAccount = useMemo(
    () =>
      selectedAccountId
        ? accounts.find((a) => a.id === selectedAccountId) ?? null
        : null,
    [accounts, selectedAccountId]
  );

  const selectedAccountData = useMemo(() => {
    if (!selectedAccount) return null;
    const related = transactions
      .filter((t) => {
        const involvesAccount =
          t.acc === selectedAccount.id || t.to === selectedAccount.id;
        if (!involvesAccount) return false;
        if (periodMode === 'month') {
          return t.date.slice(0, 7) === month;
        }
        return true;
      })
      .sort(compareTransactionsDesc);

    let inflowCents = 0;
    let outflowCents = 0;
    for (const t of related) {
      const cents = c100(t.amount);
      if (t.type === 'income') {
        inflowCents += cents;
      } else if (t.type === 'expense') {
        outflowCents += cents;
      } else if (t.type === 'transfer') {
        if (t.to === selectedAccount.id) inflowCents += cents;
        if (t.acc === selectedAccount.id) outflowCents += cents;
      }
    }

    const q = txSearch.trim().toLowerCase();
    const filtered = related.filter((t) => {
      if (txTypeFilter !== 'all' && t.type !== txTypeFilter) return false;
      if (q) {
        const cat = t.cat.toLowerCase();
        const note = t.note.toLowerCase();
        const otherAcc =
          t.type === 'transfer'
            ? (
                accountNameById.get(
                  t.acc === selectedAccount.id ? t.to : t.acc
                ) || ''
              ).toLowerCase()
            : '';
        if (!cat.includes(q) && !note.includes(q) && !otherAcc.includes(q)) {
          return false;
        }
      }
      return true;
    });

    const groups: { date: string; items: Transaction[] }[] = [];
    for (const t of filtered) {
      const last = groups[groups.length - 1];
      if (last && last.date === t.date) {
        last.items.push(t);
      } else {
        groups.push({ date: t.date, items: [t] });
      }
    }

    return {
      totalCount: related.length,
      inflowCents,
      outflowCents,
      groups,
    };
  }, [
    selectedAccount,
    transactions,
    periodMode,
    month,
    txTypeFilter,
    txSearch,
    accountNameById,
  ]);

  const groupedAccounts = useMemo(() => {
    return ACCOUNT_CATEGORIES.map((cat) => {
      const items = accounts.filter((a) => a.category === cat.id);
      const subtotal = items.reduce((sum, a) => sum + (balances[a.id] || 0), 0);
      return {
        ...cat,
        items,
        subtotal,
      };
    }).filter((group) => group.items.length > 0);
  }, [accounts, balances]);

  const handleToggleAccount = (id: string) => {
    setTxTypeFilter('all');
    setTxSearch('');
    onSelectAccount(selectedAccountId === id ? null : id);
  };

  const renderPeriodControl = () => (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Period mode"
        className="inline-flex bg-[#e7ece9] dark:bg-[#202d27] rounded-xl p-1 gap-1"
      >
        <button
          type="button"
          onClick={() => setPeriodMode('all')}
          aria-pressed={periodMode === 'all'}
          className={`min-h-[34px] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            periodMode === 'all'
              ? 'bg-[#ffffff] dark:bg-[#17211d] text-[#14201c] dark:text-[#e6eee9] font-semibold border border-[#dce2de] dark:border-[#27342e]'
              : 'text-[#5b6962] dark:text-[#8fa097] border border-transparent'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setPeriodMode('month')}
          aria-pressed={periodMode === 'month'}
          className={`min-h-[34px] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            periodMode === 'month'
              ? 'bg-[#ffffff] dark:bg-[#17211d] text-[#14201c] dark:text-[#e6eee9] font-semibold border border-[#dce2de] dark:border-[#27342e]'
              : 'text-[#5b6962] dark:text-[#8fa097] border border-transparent'
          }`}
        >
          Month
        </button>
      </div>

      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => {
            setPeriodMode('month');
            onChangeMonth(shiftMonth(month, -1));
          }}
          className="w-8 h-9 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] hover:bg-[#e7ece9] dark:hover:bg-[#202d27] flex items-center justify-center transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <select
          aria-label="Select month"
          value={month}
          onChange={(e) => {
            setPeriodMode('month');
            onChangeMonth(e.target.value);
          }}
          className={`h-9 px-2.5 text-xs rounded-xl border bg-[#ffffff] dark:bg-[#17211d] font-medium cursor-pointer focus:outline-2 focus:outline-[#1d4e89] dark:focus:outline-[#86b4ee] ${
            periodMode === 'month'
              ? 'border-[#1d4e89] dark:border-[#86b4ee] text-[#14201c] dark:text-[#e6eee9]'
              : 'border-[#dce2de] dark:border-[#27342e] text-[#5b6962] dark:text-[#8fa097]'
          }`}
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-label="Next month"
          onClick={() => {
            setPeriodMode('month');
            onChangeMonth(shiftMonth(month, 1));
          }}
          className="w-8 h-9 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] hover:bg-[#e7ece9] dark:hover:bg-[#202d27] flex items-center justify-center transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderAccountTransactionsPanel = (account: Account) => {
    if (!selectedAccountData) return null;
    const currentBal = balances[account.id] || 0;
    const hasFilter = txTypeFilter !== 'all' || txSearch.trim() !== '';

    return (
      <div className="space-y-4">
        <div className="pb-4 border-b border-[#dce2de] dark:border-[#27342e] space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-semibold text-[#14201c] dark:text-[#e6eee9]">
                  {account.name}
                </h3>
                <span className="text-xs text-[#5b6962] dark:text-[#8fa097]">
                  {CATEGORY_LABEL[account.category]} · Opening{' '}
                  {formatMoney(c100(account.opening), currency)}
                </span>
              </div>
              <span
                className={`block mt-1 text-2xl font-semibold font-num ${
                  currentBal < 0
                    ? 'text-[#b8402b] dark:text-[#f08a74]'
                    : 'text-[#14201c] dark:text-[#e6eee9]'
                }`}
              >
                {formatMoney(currentBal, currency)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEditAccount(account.id)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] hover:bg-[#e7ece9] dark:hover:bg-[#202d27] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => onAddEntryForAccount(account.id)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#1d4e89] hover:bg-[#173f70] dark:bg-[#86b4ee] dark:text-[#0b1a2e] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add entry</span>
              </button>
            </div>
          </div>

          {/* Period Selector inside Transaction Details */}
          <div className="pt-1">{renderPeriodControl()}</div>

          <div className="flex flex-wrap items-center gap-5 text-xs">
            <div>
              <span className="text-[#5b6962] dark:text-[#8fa097]">
                {periodMode === 'all'
                  ? 'Money in: '
                  : `In (${monthShort(month)}): `}
              </span>
              <span className="font-num font-medium text-[#0c7a5a] dark:text-[#4cc79f]">
                +{formatMoney(selectedAccountData.inflowCents, currency)}
              </span>
            </div>
            <div>
              <span className="text-[#5b6962] dark:text-[#8fa097]">
                {periodMode === 'all'
                  ? 'Money out: '
                  : `Out (${monthShort(month)}): `}
              </span>
              <span className="font-num font-medium text-[#b8402b] dark:text-[#f08a74]">
                -{formatMoney(selectedAccountData.outflowCents, currency)}
              </span>
            </div>
            <div>
              <span className="text-[#5b6962] dark:text-[#8fa097]">Entries: </span>
              <span className="font-num font-medium text-[#14201c] dark:text-[#e6eee9]">
                {selectedAccountData.totalCount}
              </span>
            </div>
          </div>
        </div>

        {selectedAccountData.totalCount === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-[#14201c] dark:text-[#e6eee9]">
              {periodMode === 'all'
                ? `No transactions for ${account.name} yet.`
                : `No transactions for ${account.name} in ${monthLabel(month)}.`}
            </p>
            <p className="mt-1 text-xs text-[#5b6962] dark:text-[#8fa097]">
              Expenses, income, and transfers involving this account appear here.
            </p>
            {periodMode === 'month' && (
              <button
                type="button"
                onClick={() => setPeriodMode('all')}
                className="mt-3 min-h-[36px] px-3.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-xs font-medium cursor-pointer"
              >
                Show all months
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div
                role="group"
                aria-label="Filter account transactions"
                className="grid grid-cols-4 bg-[#e7ece9] dark:bg-[#202d27] rounded-xl p-1 gap-1"
              >
                {(['all', 'expense', 'income', 'transfer'] as TxFilter[]).map(
                  (type) => {
                    const active = txTypeFilter === type;
                    const label =
                      type === 'all'
                        ? 'All'
                        : type === 'expense'
                          ? 'Expense'
                          : type === 'income'
                            ? 'Income'
                            : 'Transfer';
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setTxTypeFilter(type)}
                        aria-pressed={active}
                        className={`min-h-[34px] px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-[#ffffff] dark:bg-[#17211d] text-[#14201c] dark:text-[#e6eee9] font-semibold border border-[#dce2de] dark:border-[#27342e]'
                            : 'text-[#5b6962] dark:text-[#8fa097] border border-transparent'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  }
                )}
              </div>

              <div className="relative flex-1 sm:max-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#5b6962] dark:text-[#8fa097] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Search"
                  aria-label="Search account transactions"
                  className="w-full min-h-[36px] pl-8 pr-7 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#f5f7f5] dark:bg-[#0e1412] text-xs placeholder:text-[#5b6962]/70 dark:placeholder:text-[#8fa097]/70 focus:outline-2 focus:outline-[#1d4e89] dark:focus:outline-[#86b4ee]"
                />
                {txSearch && (
                  <button
                    type="button"
                    onClick={() => setTxSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#5b6962] hover:text-[#14201c] dark:hover:text-[#e6eee9] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {selectedAccountData.groups.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-[#5b6962] dark:text-[#8fa097]">
                  No transactions match your filter.
                </p>
                {hasFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxTypeFilter('all');
                      setTxSearch('');
                    }}
                    className="mt-2.5 min-h-[34px] px-3 rounded-lg border border-[#dce2de] dark:border-[#27342e] text-xs font-medium cursor-pointer"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="max-h-[560px] overflow-y-auto pr-1">
                {selectedAccountData.groups.map((group) => {
                  let dayDelta = 0;
                  for (const t of group.items) {
                    const cents = c100(t.amount);
                    if (t.type === 'income') dayDelta += cents;
                    else if (t.type === 'expense') dayDelta -= cents;
                    else if (t.type === 'transfer') {
                      if (t.to === account.id) dayDelta += cents;
                      if (t.acc === account.id) dayDelta -= cents;
                    }
                  }

                  return (
                    <div key={group.date} className="mt-4 first:mt-1">
                      <div className="flex items-baseline justify-between pb-1.5 border-b border-[#dce2de] dark:border-[#27342e] text-[11px] text-[#5b6962] dark:text-[#8fa097]">
                        <span className="font-medium">{dayLabel(group.date)}</span>
                        {dayDelta !== 0 && (
                          <span className="font-num font-medium">
                            {dayDelta > 0 ? '+' : ''}
                            {formatMoney(dayDelta, currency)}
                          </span>
                        )}
                      </div>

                      <div>
                        {group.items.map((t) => {
                          const cents = c100(t.amount);
                          const isTransfer = t.type === 'transfer';
                          const isIncomingTransfer =
                            isTransfer && t.to === account.id;
                          const otherAccountName = isTransfer
                            ? accountNameById.get(
                                isIncomingTransfer ? t.acc : t.to
                              ) ?? 'Unknown account'
                            : '';

                          const title = isTransfer
                            ? isIncomingTransfer
                              ? `Transfer from ${otherAccountName}`
                              : `Transfer to ${otherAccountName}`
                            : t.cat || 'Uncategorised';

                          const sub =
                            t.note ||
                            (isTransfer
                              ? 'Account transfer'
                              : t.type === 'income'
                                ? 'Income'
                                : 'Expense');

                          const isPositive =
                            t.type === 'income' || isIncomingTransfer;

                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => onEditTransaction(t.id)}
                              className="w-full min-h-[52px] py-2.5 px-2 -mx-2 rounded-lg flex items-center justify-between gap-3 text-left border-b border-[#dce2de]/60 dark:border-[#27342e]/60 hover:bg-[#f2f4f1]/70 dark:hover:bg-[#202d27]/70 transition-colors cursor-pointer"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="block font-medium text-sm text-[#14201c] dark:text-[#e6eee9] truncate">
                                  {title}
                                </span>
                                <span className="block text-xs text-[#5b6962] dark:text-[#8fa097] truncate mt-0.5">
                                  {sub}
                                </span>
                              </div>

                              <div className="shrink-0 text-right">
                                <span
                                  className={`font-num font-medium text-sm whitespace-nowrap ${
                                    isTransfer
                                      ? isIncomingTransfer
                                        ? 'text-[#0c7a5a] dark:text-[#4cc79f]'
                                        : 'text-[#566180] dark:text-[#9aa6c4]'
                                      : isPositive
                                        ? 'text-[#0c7a5a] dark:text-[#4cc79f]'
                                        : 'text-[#b8402b] dark:text-[#f08a74]'
                                  }`}
                                >
                                  {isPositive ? '+' : '-'}
                                  {formatMoney(cents, currency)}
                                </span>
                                {isTransfer && (
                                  <span className="block text-[10px] text-[#5b6962] dark:text-[#8fa097]">
                                    {isIncomingTransfer ? 'Inflow' : 'Outflow'}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="pb-5 border-b border-[#dce2de] dark:border-[#27342e] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#14201c] dark:text-[#e6eee9]">
            Accounts
          </h1>
          <span className="block mt-3 text-xs font-medium text-[#5b6962] dark:text-[#8fa097]">
            Total across all accounts
          </span>
          <span
            className={`block mt-1 text-3xl font-semibold font-num ${
              totalCents < 0
                ? 'text-[#b8402b] dark:text-[#f08a74]'
                : 'text-[#14201c] dark:text-[#e6eee9]'
            }`}
          >
            {formatMoney(totalCents, currency)}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* All Account Categories & Rows */}
        <div className="lg:col-span-6 space-y-6">
          {groupedAccounts.map((group) => (
            <section key={group.id} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold text-[#14201c] dark:text-[#e6eee9]">
                  {group.label}{' '}
                  <span className="font-normal text-xs text-[#5b6962] dark:text-[#8fa097]">
                    · {group.items.length}{' '}
                    {group.items.length === 1 ? 'account' : 'accounts'}
                  </span>
                </h2>
                <span
                  className={`text-sm font-num font-semibold ${
                    group.subtotal < 0
                      ? 'text-[#b8402b] dark:text-[#f08a74]'
                      : 'text-[#14201c] dark:text-[#e6eee9]'
                  }`}
                >
                  {formatMoney(group.subtotal, currency)}
                </span>
              </div>

              <div className="bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl divide-y divide-[#dce2de] dark:divide-[#27342e] overflow-hidden">
                {group.items.map((acc) => {
                  const bal = balances[acc.id] || 0;
                  const entryCount = allAccountEntryCounts.get(acc.id) || 0;
                  const isSelected = selectedAccount?.id === acc.id;

                  return (
                    <div key={acc.id}>
                      <button
                        type="button"
                        onClick={() => handleToggleAccount(acc.id)}
                        aria-expanded={isSelected}
                        className={`w-full min-h-[64px] px-5 py-3.5 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#e7ece9]/75 dark:bg-[#202d27]'
                            : 'hover:bg-[#f2f4f1]/70 dark:hover:bg-[#202d27]/70'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="block font-medium text-[15px] text-[#14201c] dark:text-[#e6eee9] truncate">
                            {acc.name}
                          </span>
                          <span className="block text-xs text-[#5b6962] dark:text-[#8fa097] mt-0.5">
                            Opening {formatMoney(c100(acc.opening), currency)} ·{' '}
                            {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                          </span>
                        </div>

                        <span
                          className={`font-num font-semibold text-base whitespace-nowrap shrink-0 ${
                            bal < 0
                              ? 'text-[#b8402b] dark:text-[#f08a74]'
                              : 'text-[#14201c] dark:text-[#e6eee9]'
                          }`}
                        >
                          {formatMoney(bal, currency)}
                        </span>
                      </button>

                      {/* Mobile Inline Transactions Expansion (stays on same screen) */}
                      {isSelected && (
                        <div className="lg:hidden px-4 py-4 bg-[#f5f7f5]/60 dark:bg-[#0e1412]/50 border-t border-[#dce2de] dark:border-[#27342e]">
                          {renderAccountTransactionsPanel(acc)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Desktop Side Panel for Selected Account Transactions (same screen) */}
        <aside className="hidden lg:block lg:col-span-6 bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl p-5 sticky top-[84px]">
          {selectedAccount ? (
            renderAccountTransactionsPanel(selectedAccount)
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-[#14201c] dark:text-[#e6eee9]">
                Select an account
              </p>
              <p className="mt-1 text-xs text-[#5b6962] dark:text-[#8fa097]">
                Click any account on the left to view its transaction details, edit its balance, or add an entry.
              </p>
            </div>
          )}
        </aside>
      </div>

      <p className="text-xs leading-relaxed text-[#5b6962] dark:text-[#8fa097]">
        Each account balance equals its opening balance plus income, minus expenses, with transfers moved directly between accounts. Transfers never inflate income or expense totals.
      </p>
    </div>
  );
};
