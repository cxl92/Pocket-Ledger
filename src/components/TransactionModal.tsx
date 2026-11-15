import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type {
  Account,
  LedgerSettings,
  Transaction,
  TransactionType,
} from '../types/ledger';
import { todayStr } from '../utils/ledger';

interface TransactionModalProps {
  isOpen: boolean;
  editingTx: Transaction | null;
  defaultAccountId: string;
  accounts: Account[];
  settings: LedgerSettings;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id'> & { id?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddCategory: (type: 'expense' | 'income', name: string) => Promise<boolean>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  editingTx,
  defaultAccountId,
  accounts,
  settings,
  onClose,
  onSave,
  onDelete,
  onAddCategory,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [cat, setCat] = useState('');
  const [acc, setAcc] = useState(defaultAccountId);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setConfirmDelete(false);
    setAddingCat(false);
    setNewCatName('');
    setSubmitting(false);

    if (editingTx) {
      setType(editingTx.type);
      setAmount(String(editingTx.amount));
      setDate(editingTx.date);
      setCat(editingTx.cat || '');
      setAcc(editingTx.acc);
      setTo(
        editingTx.to ||
          accounts.find((a) => a.id !== editingTx.acc)?.id ||
          accounts[0]?.id ||
          ''
      );
      setNote(editingTx.note || '');
    } else {
      const startAcc =
        accounts.find((a) => a.id === defaultAccountId)?.id ||
        accounts[0]?.id ||
        '';
      setType('expense');
      setAmount('');
      setDate(todayStr());
      setCat(settings.expenseCategories[0] || 'Other');
      setAcc(startAcc);
      setTo(accounts.find((a) => a.id !== startAcc)?.id || startAcc);
      setNote('');
      setTimeout(() => amountInputRef.current?.focus(), 40);
    }
  }, [isOpen, editingTx, defaultAccountId, accounts, settings.expenseCategories]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isTransfer = type === 'transfer';
  const baseCats =
    type === 'income' ? settings.incomeCategories : settings.expenseCategories;
  const catOptions =
    !cat || baseCats.includes(cat) ? baseCats : [cat, ...baseCats];

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    setError('');
    setAddingCat(false);
    if (nextType !== 'transfer') {
      const nextList =
        nextType === 'income'
          ? settings.incomeCategories
          : settings.expenseCategories;
      if (!nextList.includes(cat)) {
        setCat(nextList[0] || 'Other');
      }
    } else if (acc === to) {
      setTo(accounts.find((a) => a.id !== acc)?.id || acc);
    }
  };

  const handleSaveNewCat = async () => {
    const trimmed = newCatName.trim().slice(0, 24);
    if (!trimmed || type === 'transfer') return;
    const ok = await onAddCategory(type, trimmed);
    if (ok) {
      setCat(trimmed);
      setAddingCat(false);
      setNewCatName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.round(parseFloat(amount.replace(/,/g, '')) * 100) / 100;
    if (!(parsed > 0)) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Pick a valid date.');
      return;
    }
    if (isTransfer && acc === to) {
      setError('Choose two different accounts for a transfer.');
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        id: editingTx?.id,
        type,
        date,
        amount: parsed,
        cat: isTransfer ? '' : cat || baseCats[0] || 'Other',
        acc,
        to: isTransfer ? to : '',
        note: note.trim().slice(0, 120),
        ts: editingTx?.ts || Date.now(),
      });
      onClose();
    } catch {
      setError('Could not save entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTx) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSubmitting(true);
    try {
      await onDelete(editingTx.id);
      onClose();
    } catch {
      setError('Could not delete entry. Please try again.');
      setSubmitting(false);
    }
  };

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
        aria-labelledby="tx-modal-title"
        className="relative z-10 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#f5f7f5] dark:bg-[#0e1412] border border-[#dce2de] dark:border-[#27342e] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="tx-modal-title"
            className="text-lg font-semibold text-[#14201c] dark:text-[#e6eee9]"
          >
            {editingTx ? 'Edit entry' : 'New entry'}
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

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
          <div className="grid grid-cols-3 bg-[#e7ece9] dark:bg-[#202d27] rounded-xl p-1 gap-1">
            {(
              [
                ['expense', 'Expense'],
                ['income', 'Income'],
                ['transfer', 'Transfer'],
              ] as [TransactionType, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => handleTypeChange(val)}
                aria-pressed={type === val}
                className={`min-h-[40px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  type === val
                    ? 'bg-[#ffffff] dark:bg-[#17211d] text-[#14201c] dark:text-[#e6eee9] font-semibold border border-[#dce2de] dark:border-[#27342e]'
                    : 'text-[#5b6962] dark:text-[#8fa097] border border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label
              htmlFor="tx-amount"
              className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097] mb-1.5"
            >
              Amount
            </label>
            <div className="flex items-center gap-3 px-3.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] focus-within:outline-2 focus-within:outline-[#1d4e89] dark:focus-within:outline-[#86b4ee]">
              <span className="text-sm font-num text-[#5b6962] dark:text-[#8fa097]">
                {settings.currency}
              </span>
              <input
                ref={amountInputRef}
                id="tx-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full min-h-[52px] bg-transparent font-num text-2xl font-medium focus:outline-none"
              />
            </div>
          </div>

          {!isTransfer ? (
            <>
              <div>
                <span className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097] mb-2">
                  Category
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {catOptions.map((c) => {
                    const active = c === cat;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCat(c)}
                        aria-pressed={active}
                        className={`min-h-[36px] px-3.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#1d4e89] dark:bg-[#86b4ee] text-white dark:text-[#0b1a2e] border-[#1d4e89] dark:border-[#86b4ee]'
                            : 'bg-[#ffffff] dark:bg-[#17211d] text-[#14201c] dark:text-[#e6eee9] border-[#dce2de] dark:border-[#27342e] hover:bg-[#e7ece9] dark:hover:bg-[#202d27]'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setAddingCat((v) => !v)}
                    className="min-h-[36px] px-3.5 rounded-lg text-xs font-medium border border-dashed border-[#dce2de] dark:border-[#27342e] text-[#5b6962] dark:text-[#8fa097] hover:text-[#14201c] dark:hover:text-[#e6eee9] cursor-pointer"
                  >
                    + New
                  </button>
                </div>

                {addingCat && (
                  <div className="mt-2.5 flex gap-2">
                    <input
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleSaveNewCat();
                        }
                      }}
                      maxLength={24}
                      placeholder="Category name"
                      aria-label="New category name"
                      className="flex-1 min-h-[40px] px-3 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveNewCat()}
                      className="min-h-[40px] px-4 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="tx-acc"
                  className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097] mb-1.5"
                >
                  Account
                </label>
                <select
                  id="tx-acc"
                  value={acc}
                  onChange={(e) => setAcc(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-sm"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="tx-from"
                  className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097] mb-1.5"
                >
                  From
                </label>
                <select
                  id="tx-from"
                  value={acc}
                  onChange={(e) => setAcc(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-sm"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="tx-to"
                  className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097] mb-1.5"
                >
                  To
                </label>
                <select
                  id="tx-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-sm"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tx-date"
                className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097] mb-1.5"
              >
                Date
              </label>
              <input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="tx-note"
                className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097] mb-1.5"
              >
                Note
              </label>
              <input
                id="tx-note"
                maxLength={120}
                placeholder="Optional"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-sm"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-[#b8402b] dark:text-[#f08a74]">
              {error}
            </p>
          )}

          <div className="pt-2 flex items-center gap-3">
            {editingTx && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleDelete()}
                className="min-h-[44px] px-4 rounded-xl border border-[#b8402b] dark:border-[#f08a74] text-[#b8402b] dark:text-[#f08a74] text-sm font-medium hover:bg-[#b8402b]/10 cursor-pointer whitespace-nowrap"
              >
                {confirmDelete ? 'Tap again to delete' : 'Delete'}
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[44px] px-5 rounded-xl bg-[#1d4e89] hover:bg-[#173f70] dark:bg-[#86b4ee] dark:text-[#0b1a2e] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
