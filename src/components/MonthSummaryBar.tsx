import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMoney, monthLabel, todayStr } from '../utils/ledger';

interface MonthSummaryBarProps {
  month: string;
  currency: string;
  incomeCents: number;
  expenseCents: number;
  showAllOption?: boolean;
  isAllMonths?: boolean;
  onSelectAllMonths?: (all: boolean) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
}

export const MonthSummaryBar: React.FC<MonthSummaryBarProps> = ({
  month,
  currency,
  incomeCents,
  expenseCents,
  showAllOption = false,
  isAllMonths = false,
  onSelectAllMonths,
  onPrevMonth,
  onNextMonth,
  onCurrentMonth,
}) => {
  const netCents = incomeCents - expenseCents;
  const currentMonth = todayStr().slice(0, 7);
  const isCurrentMonth = month === currentMonth;

  return (
    <header className="pb-5 border-b border-[#dce2de] dark:border-[#27342e]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isAllMonths && onSelectAllMonths) onSelectAllMonths(false);
              onPrevMonth();
            }}
            aria-label="Previous month"
            className="w-11 h-11 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] hover:bg-[#e7ece9] dark:hover:bg-[#202d27] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[#14201c] dark:text-[#e6eee9] px-1 whitespace-nowrap">
            {isAllMonths ? 'All months' : monthLabel(month)}
          </h1>
          <button
            type="button"
            onClick={() => {
              if (isAllMonths && onSelectAllMonths) onSelectAllMonths(false);
              onNextMonth();
            }}
            aria-label="Next month"
            className="w-11 h-11 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] hover:bg-[#e7ece9] dark:hover:bg-[#202d27] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!isAllMonths && !isCurrentMonth && (
            <button
              type="button"
              onClick={onCurrentMonth}
              className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] hover:bg-[#e7ece9] dark:hover:bg-[#202d27] text-xs font-medium text-[#1d4e89] dark:text-[#86b4ee] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              This month
            </button>
          )}

          {showAllOption && onSelectAllMonths && (
            <div
              role="group"
              aria-label="Ledger period"
              className="inline-flex bg-[#e7ece9] dark:bg-[#202d27] rounded-xl p-1 gap-1"
            >
              <button
                type="button"
                onClick={() => onSelectAllMonths(false)}
                aria-pressed={!isAllMonths}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  !isAllMonths
                    ? 'bg-[#ffffff] dark:bg-[#17211d] text-[#14201c] dark:text-[#e6eee9] font-semibold border border-[#dce2de] dark:border-[#27342e]'
                    : 'text-[#5b6962] dark:text-[#8fa097] border border-transparent'
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => onSelectAllMonths(true)}
                aria-pressed={isAllMonths}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isAllMonths
                    ? 'bg-[#ffffff] dark:bg-[#17211d] text-[#14201c] dark:text-[#e6eee9] font-semibold border border-[#dce2de] dark:border-[#27342e]'
                    : 'text-[#5b6962] dark:text-[#8fa097] border border-transparent'
                }`}
              >
                All
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 sm:gap-8">
        <div>
          <span className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097]">
            {isAllMonths ? 'Net across all months' : 'Net this month'}
          </span>
          <span
            className={`block mt-1 text-3xl sm:text-[32px] font-semibold tracking-tight font-num ${
              netCents < 0
                ? 'text-[#b8402b] dark:text-[#f08a74]'
                : 'text-[#14201c] dark:text-[#e6eee9]'
            }`}
          >
            {netCents > 0 ? '+' : ''}
            {formatMoney(netCents, currency)}
          </span>
        </div>

        <div className="flex items-center gap-6 sm:gap-8">
          <div>
            <span className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097]">
              Income
            </span>
            <span className="block mt-1 text-base sm:text-lg font-medium font-num text-[#0c7a5a] dark:text-[#4cc79f]">
              +{formatMoney(incomeCents, currency)}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097]">
              Expense
            </span>
            <span className="block mt-1 text-base sm:text-lg font-medium font-num text-[#b8402b] dark:text-[#f08a74]">
              -{formatMoney(expenseCents, currency)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
