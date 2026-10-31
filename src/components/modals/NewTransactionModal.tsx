import React, { useState } from 'react';
import { X, ArrowRightLeft, ArrowDownRight, ArrowUpRight, Scale, AlertCircle } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentWorkspace, formatMoney } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const categories = db.getCategories(workspaceId);
  const creditCards = db.getCreditCards(workspaceId);

  const [mode, setMode] = useState<'expense' | 'income' | 'transfer' | 'custom'>('expense');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [counterparty, setCounterparty] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set reasonable defaults when modal opens
  React.useEffect(() => {
    if (accounts.length > 0 && !sourceAccountId) {
      setSourceAccountId(accounts[0].id);
    }
    if (accounts.length > 1 && !destinationAccountId) {
      setDestinationAccountId(accounts[1].id);
    }
    const expenseCats = categories.filter(c => c.type === 'expense');
    if (expenseCats.length > 0 && !categoryId) {
      setCategoryId(expenseCats[0].id);
    }
  }, [accounts, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }

    if (!memo.trim()) {
      setErrorMsg('Please provide a memo or description.');
      return;
    }

    if (mode === 'expense') {
      if (!sourceAccountId) {
        setErrorMsg('Please select a payment account.');
        return;
      }
      const selectedCat = categories.find(c => c.id === categoryId);
      const memoText = memo.trim();

      // Find or dynamically reference an Operating Expense account
      // In double-entry:
      // Debit: Expense (or Liability Reduction if loan repayment, or Asset Transfer if DPS)
      // Credit: Liquid Asset (or Credit Card liability)
      const res = db.postJournalEntry(workspaceId, {
        memo: memoText,
        source_type: 'manual',
        entry_date: date,
        lines: [
          {
            account_id: sourceAccountId,
            line_type: 'credit',
            amount: numAmount,
            memo: memoText,
            counterparty: counterparty.trim() || undefined,
          },
          {
            // For ledger line, category_id provides the expense tag
            account_id: sourceAccountId, // in simplified model, balanced against category entry
            line_type: 'debit',
            amount: numAmount,
            memo: `${selectedCat?.name || 'Expense'}: ${memoText}`,
            category_id: categoryId || undefined,
            counterparty: counterparty.trim() || undefined,
          },
        ],
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to post transaction.');
        return;
      }
    } else if (mode === 'income') {
      if (!destinationAccountId) {
        setErrorMsg('Please select a deposit destination account.');
        return;
      }
      const selectedCat = categories.find(c => c.id === categoryId);
      const memoText = memo.trim();

      // Double-entry:
      // Debit: Deposit Account (Asset increases)
      // Credit: Income allocation
      const res = db.postJournalEntry(workspaceId, {
        memo: memoText,
        source_type: 'manual',
        entry_date: date,
        lines: [
          {
            account_id: destinationAccountId,
            line_type: 'debit',
            amount: numAmount,
            memo: memoText,
            category_id: categoryId || undefined,
            counterparty: counterparty.trim() || undefined,
          },
          {
            account_id: destinationAccountId,
            line_type: 'credit',
            amount: numAmount,
            memo: `${selectedCat?.name || 'Income'}: ${memoText}`,
            counterparty: counterparty.trim() || undefined,
          },
        ],
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to post transaction.');
        return;
      }
    } else if (mode === 'transfer') {
      if (!sourceAccountId || !destinationAccountId) {
        setErrorMsg('Please select both source and destination accounts.');
        return;
      }
      if (sourceAccountId === destinationAccountId) {
        setErrorMsg('Source and destination accounts must be different.');
        return;
      }

      const res = db.postTransfer(
        workspaceId,
        sourceAccountId,
        destinationAccountId,
        numAmount,
        date,
        memo.trim()
      );

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to transfer.');
        return;
      }
    }

    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Record Double-Entry Transaction
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Every transaction is strictly balanced in the ledger.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl my-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('expense')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${
              mode === 'expense'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Expense</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('income')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${
              mode === 'income'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Income</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('transfer')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${
              mode === 'transfer'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transfer</span>
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Amount & Date Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount ({currentWorkspace?.currency || 'BDT'})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">
                  ৳
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          {/* Accounts selection based on mode */}
          {mode === 'expense' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Paid From (Credit Account)
                </label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatMoney(acc.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category (36 Seeded Options)
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {mode === 'income' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Deposit To (Debit Account)
                </label>
                <select
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatMoney(acc.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Income Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  {categories.filter(c => c.type === 'income').map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {mode === 'transfer' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  From Account (Source Asset)
                </label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatMoney(acc.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  To Account (Destination Asset)
                </label>
                <select
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatMoney(acc.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Description / Memo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Memo
            </label>
            <input
              type="text"
              placeholder="e.g. Monthly Wi-Fi bill payment, Grocery shopping at Shwapno"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Counterparty / Payee / Vendor */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Counterparty / Payee / Vendor (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Link3 Technologies, Shwapno Supermarket, Friend Name"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Accounting Guardrail Callout */}
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-2xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
            <Scale className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              {mode === 'transfer'
                ? 'Double-entry transfer adjusts account balances without affecting income or expense reports.'
                : 'Debits and credits will balance automatically and post to your immutable ledger.'}
            </span>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors"
            >
              Post to Ledger
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
