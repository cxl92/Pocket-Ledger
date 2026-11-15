import React, { useMemo, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import type { Account, Transaction, TransactionType } from '../types/ledger';
import {
  c100,
  compareTransactionsDesc,
  computeAccountBalances,
  computeTotals,
  dayLabel,
  formatMoney,
  monthLabel,
} from '../utils/ledger';

interface LedgerViewProps {
  month: string;
  isAllMonths?: boolean;
  currency: string;
  accounts: Account[];
  allTransactions: Transaction[];
  monthTransactions: Transaction[];
  onAddEntry: () => void;
  onEditEntry: (id: string) => void;
  onLoadSample: () => void;
  onNavigateAccounts: () => void;
}

type FilterType = 'all' | TransactionType;

export const LedgerView: React.FC<LedgerViewProps> = ({
  month,
  isAllMonths = false,
  currency,
  accounts,
  allTransactions,
  monthTransactions,
  onAddEntry,
  onEditEntry,
  onLoadSample,
  onNavigateAccounts,
}) => {
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [accounts]);

  const getAccountName = (id: string) => accountNameById.get(id) ?? 'Unknown account';

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monthTransactions
      .filter((t) => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (
          accountFilter !== 'all' &&
          t.acc !== accountFilter &&
          t.to !== accountFilter
        ) {
          return false;
        }
        if (q) {
          const accName = getAccountName(t.acc).toLowerCase();
          const toName = t.to ? getAccountName(t.to).toLowerCase() : '';
          const cat = t.cat.toLowerCase();
          const note = t.note.toLowerCase();
          if (
            !accName.includes(q) &&
            !toName.includes(q) &&
            !cat.includes(q) &&
            !note.includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort(compareTransactionsDesc);
  }, [monthTransactions, typeFilter, accountFilter, searchQuery, accountNameById]);

  const groupedByDay = useMemo(() => {
    const groups: { date: string; items: Transaction[] }[] = [];
    for (const t of filteredTransactions) {
      const last = groups[groups.length - 1];
      if (last && last.date === t.date) {
        last.items.push(t);
      } else {
        groups.push({ date: t.date, items: [t] });
      }
    }
    return groups;
  }, [filteredTransactions]);

  const balances = useMemo(
    () => computeAccountBalances(accounts, allTransactions),
    [accounts, allTransactions]
  );

  const totalNetWorth = useMemo(
    () => accounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0),
    [accounts, balances]
  );

  const hasActiveFilters =
    typeFilter !== 'all' || accountFilter !== 'all' || searchQuery.trim() !== '';

  if (allTransactions.length === 0) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <h2 className="text-lg font-semibold text-[#14201c] dark:text-[#e6eee9]">
          Your ledger is empty
        </h2>
        <p className="mt-2 text-sm text-[#5b6962] dark:text-[#8fa097]">
          Record what you earn, spend, and transfer between accounts in one place.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onAddEntry}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1d4e89] hover:bg-[#173f70] dark:bg-[#86b4ee] dark:text-[#0b1a2e] text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            Add your first entry
          </button>
          <button
            type="button"
            onClick={onLoadSample}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] hover:bg-[#e7ece9] dark:hover:bg-[#202d27] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            Fill with sample entries
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-8 min-w-0">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div
            role="group"
            aria-label="Filter by entry type"
            className="grid grid-cols-4 bg-[#e7ece9] dark:bg-[#202d27] rounded-xl p-1 gap-1"
          >
            {(['all', 'expense', 'income', 'transfer'] as FilterType[]).map((type) => {
              const active = typeFilter === type;
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
                  onClick={() => setTypeFilter(type)}
                  aria-pressed={active}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#ffffff] dark:bg-[#17211d] text-[#14201c] dark:text-[#e6eee9] font-semibold shadow-xs border border-[#dce2de] dark:border-[#27342e]'
                      : 'text-[#5b6962] dark:text-[#8fa097] hover:text-[#14201c] dark:hover:text-[#e6eee9] border border-transparent'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-[#5b6962] dark:text-[#8fa097] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search note or category"
                aria-label="Search entries"
                className="w-full min-h-[40px] pl-9 pr-8 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-sm placeholder:text-[#5b6962]/70 dark:placeholder:text-[#8fa097]/70 focus:outline-2 focus:outline-[#1d4e89] dark:focus:outline-[#86b4ee]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#5b6962] hover:text-[#14201c] dark:hover:text-[#e6eee9] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              aria-label="Filter by account"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="min-h-[40px] max-w-[140px] px-2.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-xs font-medium text-[#14201c] dark:text-[#e6eee9] focus:outline-2 focus:outline-[#1d4e89]"
            >
              <option value="all">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grouped Day List */}
        {groupedByDay.length === 0 ? (
          <div className="py-12 text-center border-t border-[#dce2de] dark:border-[#27342e] mt-5">
            <p className="text-sm font-medium text-[#14201c] dark:text-[#e6eee9]">
              {monthTransactions.length === 0
                ? isAllMonths
                  ? 'No entries yet.'
                  : `No entries in ${monthLabel(month)}.`
                : 'No entries match your current filter.'}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('all');
                    setAccountFilter('all');
                    setSearchQuery('');
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-xs font-medium cursor-pointer"
                >
                  Clear filters
                </button>
              )}
              <button
                type="button"
                onClick={onAddEntry}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1d4e89] dark:bg-[#86b4ee] text-white dark:text-[#0b1a2e] text-xs font-semibold cursor-pointer"
              >
                Add entry
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            {groupedByDay.map((group) => {
              const dayTotals = computeTotals(group.items);
              const dayNet = dayTotals.income - dayTotals.expense;
              return (
                <section key={group.date} className="mt-5">
                  <div className="flex items-baseline justify-between pb-2 border-b border-[#dce2de] dark:border-[#27342e] text-xs text-[#5b6962] dark:text-[#8fa097]">
                    <span className="font-medium">{dayLabel(group.date)}</span>
                    {dayNet !== 0 && (
                      <span className="font-num font-medium">
                        {dayNet > 0 ? '+' : ''}
                        {formatMoney(dayNet, currency)}
                      </span>
                    )}
                  </div>

                  <div>
                    {group.items.map((t) => {
                      const cents = c100(t.amount);
                      const isTransfer = t.type === 'transfer';
                      const title = isTransfer ? 'Transfer' : t.cat || 'Uncategorised';
                      const subParts = isTransfer
                        ? [
                            `${getAccountName(t.acc)} → ${getAccountName(t.to)}`,
                            t.note,
                          ].filter(Boolean)
                        : [t.note, getAccountName(t.acc)].filter(Boolean);

                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onEditEntry(t.id)}
                          className="w-full min-h-[58px] py-3 px-2 -mx-2 rounded-lg flex items-center justify-between gap-4 text-left border-b border-[#dce2de]/70 dark:border-[#27342e]/70 hover:bg-[#ffffff]/80 dark:hover:bg-[#17211d]/80 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[15px] text-[#14201c] dark:text-[#e6eee9] truncate">
                                {title}
                              </span>
                            </div>
                            <p className="text-xs text-[#5b6962] dark:text-[#8fa097] truncate mt-0.5">
                              {subParts.join(' · ')}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <span
                              className={`font-num font-medium text-[15px] whitespace-nowrap ${
                                isTransfer
                                  ? 'text-[#566180] dark:text-[#9aa6c4]'
                                  : t.type === 'income'
                                    ? 'text-[#0c7a5a] dark:text-[#4cc79f]'
                                    : 'text-[#b8402b] dark:text-[#f08a74]'
                              }`}
                            >
                              {isTransfer
                                ? `→ ${formatMoney(cents, currency)}`
                                : `${t.type === 'income' ? '+' : '-'}${formatMoney(cents, currency)}`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Right Column: Account Balances Summary */}
      <aside className="hidden lg:block lg:col-span-4 bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl p-5 sticky top-[84px] max-h-[calc(100vh-108px)] overflow-y-auto">
        <div className="flex items-baseline justify-between gap-2 pb-4 border-b border-[#dce2de] dark:border-[#27342e]">
          <div>
            <span className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097]">
              Total across accounts
            </span>
            <span
              className={`block mt-1 text-2xl font-semibold font-num ${
                totalNetWorth < 0
                  ? 'text-[#b8402b] dark:text-[#f08a74]'
                  : 'text-[#14201c] dark:text-[#e6eee9]'
              }`}
            >
              {formatMoney(totalNetWorth, currency)}
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateAccounts}
            className="text-xs font-medium text-[#1d4e89] dark:text-[#86b4ee] hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <span>Manage</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-2 divide-y divide-[#dce2de]/70 dark:divide-[#27342e]/70">
          {accounts.map((acc) => {
            const bal = balances[acc.id] || 0;
            return (
              <div
                key={acc.id}
                className="py-3 flex items-center justify-between gap-3 text-sm"
              >
                <span className="font-medium text-[#14201c] dark:text-[#e6eee9] truncate">
                  {acc.name}
                </span>
                <span
                  className={`font-num font-medium whitespace-nowrap ${
                    bal < 0
                      ? 'text-[#b8402b] dark:text-[#f08a74]'
                      : 'text-[#14201c] dark:text-[#e6eee9]'
                  }`}
                >
                  {formatMoney(bal, currency)}
                </span>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
};
