import React, { useMemo, useState } from 'react';
import type { Account, AccountCategory, Transaction } from '../types/ledger';
import {
  c100,
  computeTotals,
  formatCompact,
  formatMoney,
  monthLabel,
  monthShort,
  shiftMonth,
} from '../utils/ledger';

interface StatsViewProps {
  month: string;
  currency: string;
  accounts: Account[];
  allTransactions: Transaction[];
  monthTransactions: Transaction[];
  onSelectMonth: (m: string) => void;
}

interface BreakdownSlice {
  id: string;
  label: string;
  sublabel?: string;
  cents: number;
  count: number;
  pct: number;
  color: string;
}

const EXPENSE_COLORS = [
  '#b8402b',
  '#1d4e89',
  '#c97a16',
  '#6d4c8a',
  '#197b84',
  '#566180',
  '#8c4a6b',
  '#5f7a3d',
];

const INCOME_COLORS = [
  '#0c7a5a',
  '#1d4e89',
  '#197b84',
  '#5f7a3d',
  '#c97a16',
  '#566180',
  '#6d4c8a',
  '#2d6a8e',
];

const ACCOUNT_CATEGORY_LABEL: Record<AccountCategory, string> = {
  bank: 'Bank',
  card: 'Card',
  cash: 'Cash',
  digital: 'Digital',
};

interface DonutChartProps {
  slices: BreakdownSlice[];
  totalCents: number;
  currency: string;
  centerLabel: string;
  activeId: string | null;
  onHover: (id: string | null) => void;
  ariaLabel: string;
}

const DonutChart: React.FC<DonutChartProps> = ({
  slices,
  totalCents,
  currency,
  centerLabel,
  activeId,
  onHover,
  ariaLabel,
}) => {
  const size = 148;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const activeSlice = activeId
    ? slices.find((s) => s.id === activeId) ?? null
    : null;

  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative w-[148px] h-[148px] shrink-0">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full -rotate-90"
          role="img"
          aria-label={ariaLabel}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-[#e7ece9] dark:text-[#202d27]"
          />
          {slices.map((slice) => {
            const dashLength =
              totalCents > 0 ? (slice.cents / totalCents) * circumference : 0;
            const gapAdjust = slices.length > 1 ? Math.min(2, dashLength * 0.2) : 0;
            const visibleDash = Math.max(0, dashLength - gapAdjust);
            const offset = cumulativeOffset;
            cumulativeOffset += dashLength;
            const isDimmed = activeId !== null && activeId !== slice.id;

            return (
              <circle
                key={slice.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={activeId === slice.id ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={`${visibleDash} ${circumference}`}
                strokeDashoffset={-offset}
                opacity={isDimmed ? 0.35 : 1}
                className="transition-opacity duration-150 cursor-pointer"
                onMouseEnter={() => onHover(slice.id)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onHover(activeId === slice.id ? null : slice.id)}
              >
                <title>
                  {slice.label}: {formatMoney(slice.cents, currency)} (
                  {slice.pct.toFixed(1)}%)
                </title>
              </circle>
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
          <span className="text-[10px] font-medium text-[#5b6962] dark:text-[#8fa097] truncate max-w-[92px]">
            {activeSlice ? activeSlice.label : centerLabel}
          </span>
          <span className="mt-0.5 text-xs sm:text-sm font-semibold font-num text-[#14201c] dark:text-[#e6eee9] whitespace-nowrap">
            {formatMoney(activeSlice ? activeSlice.cents : totalCents, currency)}
          </span>
          {activeSlice && (
            <span className="text-[10px] font-num text-[#5b6962] dark:text-[#8fa097]">
              {activeSlice.pct.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      <div className="w-full min-w-0 flex-1 space-y-1.5">
        {slices.slice(0, 5).map((slice) => {
          const isHighlighted = activeId === slice.id;
          return (
            <button
              key={slice.id}
              type="button"
              onMouseEnter={() => onHover(slice.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onHover(activeId === slice.id ? null : slice.id)}
              className={`w-full flex items-center justify-between gap-2 text-left text-xs rounded-lg px-2 py-1 transition-colors cursor-pointer ${
                isHighlighted
                  ? 'bg-[#f2f4f1] dark:bg-[#202d27]'
                  : 'hover:bg-[#f2f4f1]/60 dark:hover:bg-[#202d27]/60'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="font-medium text-[#14201c] dark:text-[#e6eee9] truncate">
                  {slice.label}
                </span>
              </span>
              <span className="font-num text-[#5b6962] dark:text-[#8fa097] whitespace-nowrap shrink-0">
                {slice.pct.toFixed(0)}%
              </span>
            </button>
          );
        })}
        {slices.length > 5 && (
          <p className="px-2 text-[11px] text-[#5b6962] dark:text-[#8fa097]">
            +{slices.length - 5} more below
          </p>
        )}
      </div>
    </div>
  );
};

interface BreakdownCardProps {
  title: string;
  countLabel: string;
  emptyText: string;
  centerLabel: string;
  slices: BreakdownSlice[];
  totalCents: number;
  currency: string;
  activeId: string | null;
  onHover: (id: string | null) => void;
  ariaLabel: string;
}

const BreakdownCard: React.FC<BreakdownCardProps> = ({
  title,
  countLabel,
  emptyText,
  centerLabel,
  slices,
  totalCents,
  currency,
  activeId,
  onHover,
  ariaLabel,
}) => {
  return (
    <section className="bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm sm:text-base font-semibold text-[#14201c] dark:text-[#e6eee9]">
          {title}
        </h2>
        <span className="text-xs font-num text-[#5b6962] dark:text-[#8fa097] whitespace-nowrap">
          {countLabel}
        </span>
      </div>

      {slices.length === 0 ? (
        <p className="mt-5 text-sm text-[#5b6962] dark:text-[#8fa097]">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          <DonutChart
            slices={slices}
            totalCents={totalCents}
            currency={currency}
            centerLabel={centerLabel}
            activeId={activeId}
            onHover={onHover}
            ariaLabel={ariaLabel}
          />

          <div className="pt-3.5 border-t border-[#dce2de] dark:border-[#27342e] space-y-2.5">
            {slices.map((row) => (
              <div
                key={row.id}
                onMouseEnter={() => onHover(row.id)}
                onMouseLeave={() => onHover(null)}
              >
                <div className="flex items-baseline justify-between gap-3 text-xs sm:text-sm">
                  <div className="min-w-0 flex items-baseline gap-2">
                    <span
                      className="w-2 h-2 rounded-xs shrink-0 self-center"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="font-medium text-[#14201c] dark:text-[#e6eee9] truncate">
                      {row.label}
                    </span>
                    <span className="text-xs text-[#5b6962] dark:text-[#8fa097] whitespace-nowrap">
                      {row.sublabel ? `${row.sublabel} · ` : ''}
                      {row.pct.toFixed(0)}% · {row.count}
                    </span>
                  </div>
                  <span className="font-num font-medium text-[#14201c] dark:text-[#e6eee9] whitespace-nowrap">
                    {formatMoney(row.cents, currency)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[#e7ece9] dark:bg-[#202d27] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(row.pct, 2).toFixed(1)}%`,
                      backgroundColor: row.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export const StatsView: React.FC<StatsViewProps> = ({
  month,
  currency,
  accounts,
  allTransactions,
  monthTransactions,
  onSelectMonth,
}) => {
  const [hoveredExpCat, setHoveredExpCat] = useState<string | null>(null);
  const [hoveredExpAcc, setHoveredExpAcc] = useState<string | null>(null);
  const [hoveredIncCat, setHoveredIncCat] = useState<string | null>(null);
  const [hoveredIncAcc, setHoveredIncAcc] = useState<string | null>(null);

  const accountById = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const buildCategoryBreakdown = (
    type: 'expense' | 'income',
    colors: string[]
  ): { rows: BreakdownSlice[]; total: number } => {
    const byCategory = new Map<string, { cents: number; count: number }>();
    let total = 0;

    monthTransactions
      .filter((t) => t.type === type)
      .forEach((t) => {
        const key = t.cat || 'Uncategorised';
        const cents = c100(t.amount);
        const existing = byCategory.get(key) || { cents: 0, count: 0 };
        existing.cents += cents;
        existing.count += 1;
        byCategory.set(key, existing);
        total += cents;
      });

    const rows: BreakdownSlice[] = Array.from(byCategory.entries())
      .sort((a, b) => b[1].cents - a[1].cents)
      .map(([name, info], idx) => ({
        id: name,
        label: name,
        cents: info.cents,
        count: info.count,
        pct: total > 0 ? (info.cents / total) * 100 : 0,
        color: colors[idx % colors.length],
      }));

    return { rows, total };
  };

  const buildAccountBreakdown = (
    type: 'expense' | 'income',
    colors: string[]
  ): { rows: BreakdownSlice[]; total: number } => {
    const byAccount = new Map<string, { cents: number; count: number }>();
    let total = 0;

    monthTransactions
      .filter((t) => t.type === type)
      .forEach((t) => {
        const cents = c100(t.amount);
        const existing = byAccount.get(t.acc) || { cents: 0, count: 0 };
        existing.cents += cents;
        existing.count += 1;
        byAccount.set(t.acc, existing);
        total += cents;
      });

    const rows: BreakdownSlice[] = Array.from(byAccount.entries())
      .sort((a, b) => b[1].cents - a[1].cents)
      .map(([accId, info], idx) => {
        const acc = accountById.get(accId);
        return {
          id: accId,
          label: acc?.name ?? 'Unknown account',
          sublabel: acc ? ACCOUNT_CATEGORY_LABEL[acc.category] : undefined,
          cents: info.cents,
          count: info.count,
          pct: total > 0 ? (info.cents / total) * 100 : 0,
          color: colors[idx % colors.length],
        };
      });

    return { rows, total };
  };

  const expenseByCategory = useMemo(
    () => buildCategoryBreakdown('expense', EXPENSE_COLORS),
    [monthTransactions]
  );

  const expenseByAccount = useMemo(
    () => buildAccountBreakdown('expense', EXPENSE_COLORS),
    [monthTransactions, accountById]
  );

  const incomeByCategory = useMemo(
    () => buildCategoryBreakdown('income', INCOME_COLORS),
    [monthTransactions]
  );

  const incomeByAccount = useMemo(
    () => buildAccountBreakdown('income', INCOME_COLORS),
    [monthTransactions, accountById]
  );

  const accountMonthlyCashflow = useMemo(() => {
    const flowMap = new Map<
      string,
      { id: string; name: string; income: number; expense: number }
    >();

    for (const t of monthTransactions) {
      if (t.type !== 'income' && t.type !== 'expense') continue;
      const cents = c100(t.amount);
      const acc = accountById.get(t.acc);
      const entry = flowMap.get(t.acc) || {
        id: t.acc,
        name: acc?.name ?? 'Unknown',
        income: 0,
        expense: 0,
      };
      if (t.type === 'income') entry.income += cents;
      else entry.expense += cents;
      flowMap.set(t.acc, entry);
    }

    const rows = Array.from(flowMap.values()).sort(
      (a, b) => b.income + b.expense - (a.income + a.expense)
    );
    const maxVal = Math.max(
      1,
      ...rows.map((r) => Math.max(r.income, r.expense))
    );
    return { rows, maxVal };
  }, [monthTransactions, accountById]);

  const sixMonthTrend = useMemo(() => {
    const months: string[] = [];
    for (let i = -5; i <= 0; i++) {
      months.push(shiftMonth(month, i));
    }
    const data = months.map((m) => {
      const list = allTransactions.filter((t) => t.date.slice(0, 7) === m);
      const totals = computeTotals(list);
      return { month: m, income: totals.income, expense: totals.expense };
    });
    const maxVal = Math.max(
      1,
      ...data.map((d) => Math.max(d.income, d.expense))
    );
    return { data, maxVal };
  }, [month, allTransactions]);

  return (
    <div className="mt-6 space-y-6">
      {/* Unified Expense Breakdown: Accounts (left) + Categories (right) */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#b8402b] dark:text-[#f08a74]">
            Expense breakdown · {monthLabel(month)}
          </h2>
          <span className="text-xs font-num font-medium text-[#b8402b] dark:text-[#f08a74]">
            -{formatMoney(expenseByCategory.total, currency)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <BreakdownCard
            title="Expense by account"
            countLabel={`${expenseByAccount.rows.length} ${
              expenseByAccount.rows.length === 1 ? 'account' : 'accounts'
            }`}
            emptyText={`No expenses across accounts in ${monthLabel(month)}.`}
            centerLabel="Total expense"
            slices={expenseByAccount.rows}
            totalCents={expenseByAccount.total}
            currency={currency}
            activeId={hoveredExpAcc}
            onHover={setHoveredExpAcc}
            ariaLabel={`Expense by account chart for ${monthLabel(month)}`}
          />

          <BreakdownCard
            title="Expense by category"
            countLabel={`${expenseByCategory.rows.length} ${
              expenseByCategory.rows.length === 1 ? 'category' : 'categories'
            }`}
            emptyText={`No expenses recorded in ${monthLabel(month)}.`}
            centerLabel="Total expense"
            slices={expenseByCategory.rows}
            totalCents={expenseByCategory.total}
            currency={currency}
            activeId={hoveredExpCat}
            onHover={setHoveredExpCat}
            ariaLabel={`Expense by category chart for ${monthLabel(month)}`}
          />
        </div>
      </div>

      {/* Unified Income Breakdown: Accounts (left) + Categories (right) */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#0c7a5a] dark:text-[#4cc79f]">
            Income breakdown · {monthLabel(month)}
          </h2>
          <span className="text-xs font-num font-medium text-[#0c7a5a] dark:text-[#4cc79f]">
            +{formatMoney(incomeByCategory.total, currency)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <BreakdownCard
            title="Income by account"
            countLabel={`${incomeByAccount.rows.length} ${
              incomeByAccount.rows.length === 1 ? 'account' : 'accounts'
            }`}
            emptyText={`No income across accounts in ${monthLabel(month)}.`}
            centerLabel="Total income"
            slices={incomeByAccount.rows}
            totalCents={incomeByAccount.total}
            currency={currency}
            activeId={hoveredIncAcc}
            onHover={setHoveredIncAcc}
            ariaLabel={`Income by account chart for ${monthLabel(month)}`}
          />

          <BreakdownCard
            title="Income by category"
            countLabel={`${incomeByCategory.rows.length} ${
              incomeByCategory.rows.length === 1 ? 'category' : 'categories'
            }`}
            emptyText={`No income recorded in ${monthLabel(month)}.`}
            centerLabel="Total income"
            slices={incomeByCategory.rows}
            totalCents={incomeByCategory.total}
            currency={currency}
            activeId={hoveredIncCat}
            onHover={setHoveredIncCat}
            ariaLabel={`Income by category chart for ${monthLabel(month)}`}
          />
        </div>
      </div>

      {/* Account Activity Comparison & Six-Month Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <section className="bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm sm:text-base font-semibold text-[#14201c] dark:text-[#e6eee9]">
              Account activity in {monthShort(month)}
            </h2>
            <span className="text-xs text-[#5b6962] dark:text-[#8fa097]">
              Income vs expense
            </span>
          </div>

          {accountMonthlyCashflow.rows.length === 0 ? (
            <p className="mt-5 text-sm text-[#5b6962] dark:text-[#8fa097]">
              No account income or expense activity in {monthLabel(month)}.
            </p>
          ) : (
            <>
              <div className="mt-4 space-y-3.5">
                {accountMonthlyCashflow.rows.map((row) => {
                  const incWidth =
                    (row.income / accountMonthlyCashflow.maxVal) * 100;
                  const expWidth =
                    (row.expense / accountMonthlyCashflow.maxVal) * 100;
                  return (
                    <div key={row.id} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="font-medium text-sm text-[#14201c] dark:text-[#e6eee9] truncate">
                          {row.name}
                        </span>
                        <span className="font-num text-[#5b6962] dark:text-[#8fa097] whitespace-nowrap">
                          {row.income > 0 && (
                            <span className="text-[#0c7a5a] dark:text-[#4cc79f]">
                              +{formatCompact(row.income)}
                            </span>
                          )}
                          {row.income > 0 && row.expense > 0 && ' · '}
                          {row.expense > 0 && (
                            <span className="text-[#b8402b] dark:text-[#f08a74]">
                              -{formatCompact(row.expense)}
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {row.income > 0 && (
                          <div className="h-2 rounded-full bg-[#e7ece9] dark:bg-[#202d27] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#0c7a5a] dark:bg-[#4cc79f]"
                              style={{ width: `${Math.max(incWidth, 2).toFixed(1)}%` }}
                              title={`Income: ${formatMoney(row.income, currency)}`}
                            />
                          </div>
                        )}
                        {row.expense > 0 && (
                          <div className="h-2 rounded-full bg-[#e7ece9] dark:bg-[#202d27] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#b8402b] dark:bg-[#f08a74]"
                              style={{ width: `${Math.max(expWidth, 2).toFixed(1)}%` }}
                              title={`Expense: ${formatMoney(row.expense, currency)}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-[#5b6962] dark:text-[#8fa097]">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0c7a5a] dark:bg-[#4cc79f]" />
                  <span>Income</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#b8402b] dark:bg-[#f08a74]" />
                  <span>Expense</span>
                </span>
              </div>
            </>
          )}
        </section>

        <section className="bg-[#ffffff] dark:bg-[#17211d] border border-[#dce2de] dark:border-[#27342e] rounded-2xl p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm sm:text-base font-semibold text-[#14201c] dark:text-[#e6eee9]">
              Last six months
            </h2>
            <span className="text-xs text-[#5b6962] dark:text-[#8fa097]">
              Click a month to inspect
            </span>
          </div>

          <div
            role="img"
            aria-label={`Income and expense comparison for the six months ending ${monthLabel(month)}`}
            className="mt-5 grid grid-cols-6 gap-2 border-b border-[#dce2de] dark:border-[#27342e]"
          >
            {sixMonthTrend.data.map((d, idx) => {
              const net = d.income - d.expense;
              const incHeight = (d.income / sixMonthTrend.maxVal) * 100;
              const expHeight = (d.expense / sixMonthTrend.maxVal) * 100;
              const isSelected = idx === 5;
              return (
                <button
                  key={d.month}
                  type="button"
                  onClick={() => onSelectMonth(d.month)}
                  className="flex flex-col items-center min-w-0 pb-2 rounded-t-lg hover:bg-[#f2f4f1] dark:hover:bg-[#202d27] transition-colors cursor-pointer"
                >
                  <div className="h-32 w-full flex items-end justify-center gap-1.5 px-1">
                    <span
                      className="block w-2/5 max-w-[18px] rounded-t bg-[#0c7a5a] dark:bg-[#4cc79f]"
                      style={{ height: `${incHeight.toFixed(1)}%` }}
                      title={`Income: ${formatMoney(d.income, currency)}`}
                    />
                    <span
                      className="block w-2/5 max-w-[18px] rounded-t bg-[#b8402b] dark:bg-[#f08a74]"
                      style={{ height: `${expHeight.toFixed(1)}%` }}
                      title={`Expense: ${formatMoney(d.expense, currency)}`}
                    />
                  </div>
                  <span
                    className={`mt-2 text-xs ${
                      isSelected
                        ? 'font-semibold text-[#14201c] dark:text-[#e6eee9]'
                        : 'text-[#5b6962] dark:text-[#8fa097]'
                    }`}
                  >
                    {monthShort(d.month)}
                  </span>
                  <span className="text-[11px] font-num text-[#5b6962] dark:text-[#8fa097]">
                    {net > 0 ? '+' : ''}
                    {formatCompact(net)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-[#5b6962] dark:text-[#8fa097]">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#0c7a5a] dark:bg-[#4cc79f]" />
              <span>Income</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#b8402b] dark:bg-[#f08a74]" />
              <span>Expense</span>
            </span>
            <span>Net total shown below each month</span>
          </div>
        </section>
      </div>
    </div>
  );
};
