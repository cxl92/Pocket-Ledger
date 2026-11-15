import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Account, AccountCategory } from '../types/ledger';
import { ACCOUNT_CATEGORIES, inferAccountCategory } from '../utils/ledger';

interface AccountModalProps {
  isOpen: boolean;
  editingAccount: Account | null;
  currency: string;
  canDelete: boolean;
  onClose: () => void;
  onSave: (account: {
    id?: string;
    name: string;
    opening: number;
    category: AccountCategory;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  editingAccount,
  currency,
  canDelete,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [opening, setOpening] = useState('0');
  const [category, setCategory] = useState<AccountCategory>('bank');
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setConfirmDelete(false);
    setSubmitting(false);
    if (editingAccount) {
      setName(editingAccount.name);
      setOpening(String(editingAccount.opening));
      setCategory(editingAccount.category || inferAccountCategory(editingAccount.name));
      setCategoryTouched(true);
    } else {
      setName('');
      setOpening('0');
      setCategory('bank');
      setCategoryTouched(false);
      setTimeout(() => nameRef.current?.focus(), 40);
    }
  }, [isOpen, editingAccount]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNameChange = (nextName: string) => {
    setName(nextName);
    if (!categoryTouched && !editingAccount) {
      setCategory(inferAccountCategory(nextName));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = name.trim().slice(0, 30);
    if (!cleaned) {
      setError('Give the account a name.');
      return;
    }
    const openVal = parseFloat(opening.replace(/,/g, '')) || 0;
    setSubmitting(true);
    try {
      await onSave({
        id: editingAccount?.id,
        name: cleaned,
        opening: openVal,
        category,
      });
      onClose();
    } catch {
      setError('Could not save account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingAccount) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSubmitting(true);
    try {
      await onDelete(editingAccount.id);
      onClose();
    } catch {
      setError('Could not delete account.');
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
        aria-labelledby="acc-modal-title"
        className="relative z-10 w-full sm:max-w-md bg-[#f5f7f5] dark:bg-[#0e1412] border border-[#dce2de] dark:border-[#27342e] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="acc-modal-title"
            className="text-lg font-semibold text-[#14201c] dark:text-[#e6eee9]"
          >
            {editingAccount ? 'Edit account' : 'New account'}
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
          <div>
            <label
              htmlFor="acc-name"
              className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097] mb-1.5"
            >
              Name
            </label>
            <input
              ref={nameRef}
              id="acc-name"
              maxLength={30}
              autoComplete="off"
              placeholder="e.g. Savings"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] text-sm"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097] mb-1.5">
              Category
            </span>
            <div className="grid grid-cols-4 bg-[#e7ece9] dark:bg-[#202d27] rounded-xl p-1 gap-1">
              {ACCOUNT_CATEGORIES.map((cat) => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id);
                      setCategoryTouched(true);
                    }}
                    aria-pressed={active}
                    className={`min-h-[38px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#ffffff] dark:bg-[#17211d] text-[#14201c] dark:text-[#e6eee9] font-semibold border border-[#dce2de] dark:border-[#27342e]'
                        : 'text-[#5b6962] dark:text-[#8fa097] border border-transparent'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="acc-opening"
              className="block text-xs font-medium text-[#5b6962] dark:text-[#8fa097] mb-1.5"
            >
              Opening balance
            </label>
            <div className="flex items-center gap-3 px-3.5 rounded-xl border border-[#dce2de] dark:border-[#27342e] bg-[#ffffff] dark:bg-[#17211d] focus-within:outline-2 focus-within:outline-[#1d4e89] dark:focus-within:outline-[#86b4ee]">
              <span className="text-sm font-num text-[#5b6962] dark:text-[#8fa097]">
                {currency}
              </span>
              <input
                id="acc-opening"
                inputMode="decimal"
                autoComplete="off"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                className="w-full min-h-[48px] bg-transparent font-num text-lg font-medium focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-[#b8402b] dark:text-[#f08a74]">
              {error}
            </p>
          )}

          {editingAccount && !canDelete && (
            <p className="text-xs text-[#5b6962] dark:text-[#8fa097]">
              This account has existing entries or is your only account, so it cannot be deleted.
            </p>
          )}

          <div className="pt-2 flex items-center gap-3">
            {editingAccount && canDelete && (
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
              className="flex-1 min-h-[44px] px-5 rounded-xl bg-[#1d4e89] hover:bg-[#173f70] dark:bg-[#86b4ee] dark:text-[#0b1a2e] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
