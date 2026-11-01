import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowRightLeft, ArrowDownRight, ArrowUpRight, Scale, AlertCircle, History, Trash2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { JournalEntry, Category, FinancialAccount } from '../../types';
import { EditableSelect } from '../common/EditableSelect';
import { NumericInput } from '../common/NumericInput';
import { toUuid } from '../../lib/uuid';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entryToEdit?: JournalEntry | null;
  defaultMode?: 'expense' | 'income' | 'transfer';
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  entryToEdit,
  defaultMode,
}) => {
  const { currentWorkspace, formatMoney, refreshData } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = useMemo(() => db.getAccounts(workspaceId).filter(a => !a.is_archived), [workspaceId]);
  const categories = useMemo(() => db.getCategories(workspaceId), [workspaceId]);

  const [mode, setMode] = useState<'expense' | 'income' | 'transfer'>(defaultMode || 'expense');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [counterparty, setCounterparty] = useState<string>('');
  const [isHistorical, setIsHistorical] = useState<boolean>(false);
  const [historicalNote, setHistoricalNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or populate from entryToEdit ONLY when modal opens or entryToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    if (entryToEdit) {
      setDate(entryToEdit.entry_date);
      setMemo(entryToEdit.memo || '');
      setIsHistorical(Boolean(entryToEdit.is_historical));
      setHistoricalNote(entryToEdit.historical_note || '');

      const lines = entryToEdit.lines || [];
      const debitLine = lines.find(l => l.line_type === 'debit');
      const creditLine = lines.find(l => l.line_type === 'credit');

      if (debitLine) {
        setAmount(debitLine.amount.toString());
        setCounterparty(debitLine.counterparty || creditLine?.counterparty || '');
      }

      const linkedCatId = debitLine?.category_id || creditLine?.category_id;
      if (linkedCatId) {
        setCategoryId(linkedCatId);
      }

      if (entryToEdit.source_type === 'transfer') {
        setMode('transfer');
        setSourceAccountId(creditLine?.account_id || '');
        setDestinationAccountId(debitLine?.account_id || '');
      } else {
        const cat = db.getCategories(workspaceId).find(c => c.id === linkedCatId);
        if (cat?.type === 'income') {
          setMode('income');
          setDestinationAccountId(debitLine?.account_id || '');
        } else {
          setMode('expense');
          setSourceAccountId(creditLine?.account_id || debitLine?.account_id || '');
        }
      }
    } else {
      // New transaction defaults
      setDate(new Date().toISOString().split('T')[0]);
      setAmount('');
      setMemo('');
      setCounterparty('');
      setIsHistorical(false);
      setHistoricalNote('');
      setErrorMsg(null);
      setMode(defaultMode || 'expense');

      const currentAccounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
      const currentCategories = db.getCategories(workspaceId);

      if (currentAccounts.length > 0) {
        setSourceAccountId(currentAccounts[0].id);
      }
      if (currentAccounts.length > 1) {
        setDestinationAccountId(currentAccounts[1].id);
      }
      const expenseCats = currentCategories.filter(c => c.type === 'expense');
      if (expenseCats.length > 0) {
        setCategoryId(expenseCats[0].id);
      }
    }
  }, [isOpen, entryToEdit?.id, defaultMode]);

  if (!isOpen) return null;

  // Inline Category Add / Edit handlers
  const handleAddNewCategory = (name: string): string => {
    const newCatId = toUuid(`cat_${workspaceId}_${Date.now()}`);
    const newCat: Category = {
      id: newCatId,
      workspace_id: workspaceId,
      name,
      type: mode === 'income' ? 'income' : 'expense',
      income_type: mode === 'income' ? 'other' : undefined,
      accounting_classification: mode === 'income' ? 'income_operating' : 'expense_operating',
      icon: mode === 'income' ? 'plus-circle' : 'tag',
      color: mode === 'income' ? '#10b981' : '#f97316',
      is_seed: false,
      is_archived: false,
      sort_order: categories.length + 1,
    };
    db.saveCategory(newCat);
    refreshData();
    setCategoryId(newCatId);
    return newCatId;
  };

  const handleEditCategory = (catId: string, updatedName: string) => {
    const cat = categories.find(c => c.id === catId);
    if (cat) {
      db.saveCategory({ ...cat, name: updatedName });
      refreshData();
    }
  };

  // Inline Account Add / Edit handlers
  const handleAddNewAccount = (name: string): string => {
    const newAccId = toUuid(`acc_user_${workspaceId}_${Date.now()}`);
    const newAcc: FinancialAccount = {
      id: newAccId,
      workspace_id: workspaceId,
      name,
      account_type_id: 'bank',
      provider: 'Bank / Wallet',
      currency: currentWorkspace?.currency || 'BDT',
      opening_balance: 0,
      opening_date: new Date().toISOString().split('T')[0],
      current_balance_cached: 0,
      is_archived: false,
      icon: 'landmark',
      color: '#0284c7',
      created_at: new Date().toISOString(),
    };
    db.saveAccount(newAcc);
    refreshData();
    return newAccId;
  };

  const handleEditAccount = (accId: string, updatedName: string) => {
    const acc = accounts.find(a => a.id === accId);
    if (acc) {
      db.saveAccount({ ...acc, name: updatedName });
      refreshData();
    }
  };

  const handleDeleteEntry = () => {
    if (!entryToEdit) return;
    if (window.confirm('Are you sure you want to delete this transaction from the database? Linked account balances will be restored.')) {
      const res = db.deleteJournalEntry(workspaceId, entryToEdit.id);
      if (res.success) {
        refreshData();
        onSuccess?.();
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to delete transaction.');
      }
    }
  };

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

    const memoText = memo.trim();
    const selectedCat = categories.find(c => c.id === categoryId);

    if (mode === 'expense') {
      if (!sourceAccountId) {
        setErrorMsg('Please select a payment account.');
        return;
      }

      const defaultOperatingAccId = toUuid(`acc_expense_operating_${workspaceId}`);
      const lines = [
        {
          account_id: sourceAccountId,
          line_type: 'credit' as const,
          amount: numAmount,
          memo: memoText,
          category_id: categoryId || undefined,
          counterparty: counterparty.trim() || undefined,
        },
        {
          account_id: defaultOperatingAccId,
          line_type: 'debit' as const,
          amount: numAmount,
          memo: `${selectedCat?.name || 'Expense'}: ${memoText}`,
          category_id: categoryId || undefined,
          counterparty: counterparty.trim() || undefined,
        },
      ];

      if (entryToEdit) {
        const res = db.updateJournalEntry(workspaceId, entryToEdit.id, {
          memo: memoText,
          entry_date: date,
          is_historical: isHistorical,
          historical_note: historicalNote.trim() || undefined,
          lines,
        });
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to update transaction.');
          return;
        }
      } else {
        const res = db.postJournalEntry(workspaceId, {
          memo: memoText,
          source_type: 'manual',
          entry_date: date,
          is_historical: isHistorical,
          historical_note: historicalNote.trim() || undefined,
          lines,
        });
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to post transaction.');
          return;
        }
      }
    } else if (mode === 'income') {
      if (!destinationAccountId) {
        setErrorMsg('Please select a deposit destination account.');
        return;
      }

      const defaultIncomeAccId = toUuid(`acc_income_earned_${workspaceId}`);
      const lines = [
        {
          account_id: destinationAccountId,
          line_type: 'debit' as const,
          amount: numAmount,
          memo: memoText,
          category_id: categoryId || undefined,
          counterparty: counterparty.trim() || undefined,
        },
        {
          account_id: defaultIncomeAccId,
          line_type: 'credit' as const,
          amount: numAmount,
          memo: `${selectedCat?.name || 'Income'}: ${memoText}`,
          category_id: categoryId || undefined,
          counterparty: counterparty.trim() || undefined,
        },
      ];

      if (entryToEdit) {
        const res = db.updateJournalEntry(workspaceId, entryToEdit.id, {
          memo: memoText,
          entry_date: date,
          is_historical: isHistorical,
          historical_note: historicalNote.trim() || undefined,
          lines,
        });
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to update transaction.');
          return;
        }
      } else {
        const res = db.postJournalEntry(workspaceId, {
          memo: memoText,
          source_type: 'manual',
          entry_date: date,
          is_historical: isHistorical,
          historical_note: historicalNote.trim() || undefined,
          lines,
        });
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to post transaction.');
          return;
        }
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

      if (entryToEdit) {
        const lines = [
          {
            account_id: sourceAccountId,
            line_type: 'credit' as const,
            amount: numAmount,
            memo: `Transfer to destination: ${memoText}`,
          },
          {
            account_id: destinationAccountId,
            line_type: 'debit' as const,
            amount: numAmount,
            memo: `Transfer from source: ${memoText}`,
          },
        ];
        const res = db.updateJournalEntry(workspaceId, entryToEdit.id, {
          memo: memoText,
          entry_date: date,
          is_historical: isHistorical,
          historical_note: historicalNote.trim() || undefined,
          lines,
        });
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to update transfer.');
          return;
        }
      } else {
        const res = db.postTransfer(
          workspaceId,
          sourceAccountId,
          destinationAccountId,
          numAmount,
          date,
          memoText
        );
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to post transfer.');
          return;
        }
      }
    }

    refreshData();
    onSuccess?.();
    onClose();
  };

  // Convert categories to SelectOptions
  const activeCategories = mode === 'income' 
    ? categories.filter(c => c.type === 'income')
    : categories.filter(c => c.type === 'expense' || c.type === 'transfer_allocation');

  const incomeTypes = db.getIncomeTypes(workspaceId);
  const incomeTypeMap = new Map(incomeTypes.map(t => [t.id, t.name]));

  const categoryOptions = activeCategories.map(c => {
    let sub: string = c.type;
    if (c.type === 'income') {
      sub = (c.income_type && incomeTypeMap.get(c.income_type)) || (c.income_type ? c.income_type.replace('_', ' ') : 'General');
    }
    return {
      value: c.id,
      label: c.name,
      subLabel: sub,
      color: c.color,
    };
  });

  const accountOptions = accounts.map(a => ({
    value: a.id,
    label: a.name,
    subLabel: formatMoney(a.current_balance_cached),
    color: a.color,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl transition-all my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {entryToEdit ? 'Edit Transaction' : 'Record Transaction'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Balanced double-entry accounting with real-time Supabase synchronization.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount & Date Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount ({currentWorkspace?.currency || 'BDT'})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400 pointer-events-none">
                  ৳
                </span>
                <NumericInput
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

          {/* Accounts & Category with Inline Add & Edit Dropdowns */}
          {mode === 'expense' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableSelect
                label="Paid From (Account)"
                options={accountOptions}
                value={sourceAccountId}
                onChange={setSourceAccountId}
                onAddNew={handleAddNewAccount}
                onEditSelected={handleEditAccount}
                placeholder="Choose account"
                required
              />
              <EditableSelect
                label="Category"
                options={categoryOptions}
                value={categoryId}
                onChange={setCategoryId}
                onAddNew={handleAddNewCategory}
                onEditSelected={handleEditCategory}
                placeholder="Choose category"
                required
              />
            </div>
          )}

          {mode === 'income' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableSelect
                label="Deposit To (Account)"
                options={accountOptions}
                value={destinationAccountId}
                onChange={setDestinationAccountId}
                onAddNew={handleAddNewAccount}
                onEditSelected={handleEditAccount}
                placeholder="Choose destination"
                required
              />
              <EditableSelect
                label="Income Category"
                options={categoryOptions}
                value={categoryId}
                onChange={setCategoryId}
                onAddNew={handleAddNewCategory}
                onEditSelected={handleEditCategory}
                placeholder="Choose category"
                required
              />
            </div>
          )}

          {mode === 'transfer' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableSelect
                label="From Account (Source)"
                options={accountOptions}
                value={sourceAccountId}
                onChange={setSourceAccountId}
                onAddNew={handleAddNewAccount}
                onEditSelected={handleEditAccount}
                placeholder="Source account"
                required
              />
              <EditableSelect
                label="To Account (Destination)"
                options={accountOptions}
                value={destinationAccountId}
                onChange={setDestinationAccountId}
                onAddNew={handleAddNewAccount}
                onEditSelected={handleEditAccount}
                placeholder="Destination account"
                required
              />
            </div>
          )}

          {/* Description / Memo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Memo
            </label>
            <input
              type="text"
              placeholder="e.g. Monthly Wi-Fi bill payment, Remote client contract invoice"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Counterparty / Payee / Vendor */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Counterparty / Payee / Client (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Link3 Technologies, Shwapno Supermarket, Upwork Client"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* CRITICAL FEATURE: Historical / Previous Database Entry Toggle */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isHistorical}
                onChange={(e) => setIsHistorical(e.target.checked)}
                className="mt-0.5 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-amber-500" />
                  <span>Prior Period / Previous Database Entry</span>
                </span>
                <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Check this if this entry originates from your previous records or prior-year books. The date will not distort single-day spike velocity statistics, but will establish your cumulative past baseline and ledger equity.
                </p>
              </div>
            </label>

            {isHistorical && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Historical Period Note / Legacy Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. FY 2024-2025 Opening Balance, Previous Excel migration"
                  value={historicalNote}
                  onChange={(e) => setHistoricalNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:border-amber-500"
                />
              </div>
            )}
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

          {/* Submit & Delete Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              {entryToEdit && (
                <button
                  type="button"
                  onClick={handleDeleteEntry}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors"
              >
                {entryToEdit ? 'Update Transaction' : 'Post to Ledger'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
