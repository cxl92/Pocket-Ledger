import React from 'react';
import { X } from 'lucide-react';
import type { ImportSummary } from '../types/ledger';

interface ImportResultModalProps {
  summary: ImportSummary | null;
  onClose: () => void;
}

export const ImportResultModal: React.FC<ImportResultModalProps> = ({
  summary,
  onClose,
}) => {
  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        className="relative z-10 w-full sm:max-w-md bg-[#f5f7f5] dark:bg-[#0e1412] border border-[#dce2de] dark:border-[#27342e] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2
            id="import-modal-title"
            className="text-lg font-semibold text-[#14201c] dark:text-[#e6eee9]"
          >
            Upload finished
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-[#14201c] dark:text-[#e6eee9]">
          <strong>{summary.added}</strong>{' '}
          {summary.added === 1 ? 'entry' : 'entries'} added or updated
          {summary.skipped.length > 0 ? (
            <>
              , <strong>{summary.skipped.length}</strong> skipped.
            </>
          ) : (
            '.'
          )}
        </p>

        {summary.skipped.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[#5b6962] dark:text-[#8fa097] mb-1.5">
              Skipped rows (first {Math.min(summary.skipped.length, 8)}):
            </p>
            <ul className="text-xs text-[#5b6962] dark:text-[#8fa097] space-y-1 list-disc pl-4">
              {summary.skipped.slice(0, 8).map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] rounded-xl bg-[#1d4e89] hover:bg-[#173f70] dark:bg-[#86b4ee] dark:text-[#0b1a2e] text-white text-sm font-semibold cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};
