import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowRightLeft, ArrowDownRight, ArrowUpRight, Scale, AlertCircle, History, Trash2, PiggyBank, Calendar, CalendarRange } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { JournalEntry, Category, FinancialAccount } from '../../types';
import { EditableSelect } from '../common/EditableSelect';
import { NumericInput } from '../common/NumericInput';
import { toUuid, generateUuid } from '../../lib/uuid';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  entryToEdit?: JournalEntry | null;
  defaultMode?: 'expense' | 'income' | 'transfer' | 'saving';
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
  const savingsAccounts = useMemo(() => accounts.filter(a => ['savings_dps', 'investment'].includes(a.account_type_id)), [accounts]);
  const categories = useMemo(() => db.getCategories(workspaceId), [workspaceId]);

  const [mode, setMode] = useState<'expense' | 'income' | 'transfer' | 'saving'>(defaultMode || 'expense');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [periodEndDate, setPeriodEndDate] = useState<string>('');
  const [isDateRange, setIsDateRange] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [targetSavingsAccountId, setTargetSavingsAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [counterparty, setCounterparty] = useState<string>('');
  const [isHistorical, setIsHistorical] = useState<boolean>(false);
  const [historicalNote, setHistoricalNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Helper for computing duration span
  const getPeriodDurationLabel = (start: string, end: string) => {
    if (!start || !end) return '';
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diffTime = d2.getTime() - d1.getTime();
    if (diffTime < 0) return 'Invalid: End date must be on or after start date';
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
    if (diffDays >= 365) {
      const years = (diffDays / 365).toFixed(1);
      return `${years} yrs (${diffDays.toLocaleString()} days) span`;
    }
    if (diffDays >= 30) {
      const months = Math.round(diffDays / 30.4);
      return `~${months} mo (${diffDays} days) span`;
    }
    return `${diffDays} days period`;
  };

  // Initialize or populate from entryToEdit ONLY when modal opens or entryToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    if (entryToEdit) {
      setDate(entryToEdit.entry_date);
      if (entryToEdit.period_end_date) {
        setIsDateRange(true);
        setPeriodEndDate(entryToEdit.period_end_date);
      } else {
        setIsDateRange(false);
        setPeriodEndDate('');
      }
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

      const debitAcc = accounts.find(a => a.id === debitLine?.account_id);
      const isSavingDebit = debitAcc && ['savings_dps', 'investment'].includes(debitAcc.account_type_id);

      if (isSavingDebit) {
        setMode('saving');
        setSourceAccountId(creditLine?.account_id || '');
        setTargetSavingsAccountId(debitLine?.account_id || '');
      } else if (entryToEdit.source_type === 'transfer') {
        setMode('transfer');
        setSourceAccountId(creditLine?.account_id || '');
        setDestinationAccountId(debitLine?.account_id || '');
      } else {
        const cat = db.getCategories(workspaceId).find(c => c.id === linkedCatId);
        if (cat?.type === 'income') {
          setMode('income');
          setDestinationAccountId(debitLine?.account_id || '');
        } else if (cat?.type === 'saving') {
          setMode('saving');
          setSourceAccountId(creditLine?.account_id || '');
          setTargetSavingsAccountId(debitLine?.account_id || cat.target_savings_account_id || '');
        } else {
          setMode('expense');
          setSourceAccountId(creditLine?.account_id || debitLine?.account_id || '');
        }
      }
    } else {
      // New transaction defaults
      setDate(new Date().toISOString().split('T')[0]);
      setPeriodEndDate('');
      setIsDateRange(false);
      setAmount('');
      setMemo('');
      setCounterparty('');
      setIsHistorical(false);
      setHistoricalNote('');
      setErrorMsg(null);
      setMode(defaultMode || 'expense');

      const currentAccounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
      const currentCategories = db.getCategories(workspaceId);
      const curSavingsAccounts = currentAccounts.filter(a => ['savings_dps', 'investment'].includes(a.account_type_id));

      if (currentAccounts.length > 0) {
        setSourceAccountId(currentAccounts[0].id);
      }
      if (currentAccounts.length > 1) {
        setDestinationAccountId(currentAccounts[1].id);
      }
      if (curSavingsAccounts.length > 0) {
        setTargetSavingsAccountId(curSavingsAccounts[0].id);
      }

      if (defaultMode === 'saving') {
        const savingCat = currentCategories.find(c => c.type === 'saving');
        if (savingCat) {
          setCategoryId(savingCat.id);
          if (savingCat.target_savings_account_id) {
            setTargetSavingsAccountId(savingCat.target_savings_account_id);
          }
        }
      } else if (defaultMode === 'income') {
        const incomeCat = currentCategories.find(c => c.type === 'income');
        if (incomeCat) setCategoryId(incomeCat.id);
      } else {
        const expenseCats = currentCategories.filter(c => c.type === 'expense');
        if (expenseCats.length > 0) {
          setCategoryId(expenseCats[0].id);
        }
      }
    }
  }, [isOpen, entryToEdit?.id, defaultMode]);

  // When selected category changes, check if it has a linked savings head
  const handleSelectCategory = (newCatId: string) => {
    setCategoryId(newCatId);
    const cat = categories.find(c => c.id === newCatId);
    if (cat?.type === 'saving' || cat?.accounting_classification === 'asset_savings') {
      if (cat.target_savings_account_id) {
        setTargetSavingsAccountId(cat.target_savings_account_id);
      } else if (!targetSavingsAccountId && savingsAccounts.length > 0) {
        setTargetSavingsAccountId(savingsAccounts[0].id);
      }
    }
  };

  if (!isOpen) return null;

  // Inline Category Add / Edit handlers
  const handleAddNewCategory = (name: string): string => {
    const newCatId = toUuid(`cat_${workspaceId}_${Date.now()}`);
    const isSaving = mode === 'saving';
    const newCat: Category = {
      id: newCatId,
      workspace_id: workspaceId,
      name,
      type: mode === 'income' ? 'income' : isSaving ? 'saving' : 'expense',
      income_type: mode === 'income' ? 'other' : undefined,
      accounting_classification: mode === 'income' ? 'income_operating' : isSaving ? 'asset_savings' : 'expense_operating',
      target_savings_account_id: isSaving ? targetSavingsAccountId : undefined,
      icon: mode === 'income' ? 'plus-circle' : isSaving ? 'piggy-bank' : 'tag',
      color: mode === 'income' ? '#10b981' : isSaving ? '#0d9488' : '#f97316',
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

  // Inline Savings Head Add / Edit handlers
  const handleAddNewSavingsHead = (name: string): string => {
    const newAccId = generateUuid();
    const newAcc: FinancialAccount = {
      id: newAccId,
      workspace_id: workspaceId,
      name,
      account_type_id: 'savings_dps',
      provider: 'Dedicated Fund',
      currency: currentWorkspace?.currency || 'BDT',
      opening_balance: 0,
      opening_date: new Date().toISOString().split('T')[0],
      current_balance_cached: 0,
      is_archived: false,
      icon: 'piggy-bank',
      color: '#0d9488',
      created_at: new Date().toISOString(),
    };
    db.saveAccount(newAcc);
    refreshData();
    setTargetSavingsAccountId(newAccId);
    return newAccId;
  };

  const handleEditSavingsHead = (accId: string, updatedName: string) => {
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

    if (isDateRange && periodEndDate && periodEndDate < date) {
      setErrorMsg('Period End Date must be on or after Start Date.');
      return;
    }

    const effectivePeriodEnd = isDateRange && periodEndDate ? periodEndDate : undefined;
    const memoText = memo.trim();
    const selectedCat = categories.find(c => c.id === categoryId);
    const isSavingAllocation = mode === 'saving' || selectedCat?.type === 'saving' || selectedCat?.accounting_classification === 'asset_savings';

    if (isSavingAllocation) {
      if (!sourceAccountId) {
        setErrorMsg('Please select a payment account.');
        return;
      }
      if (!targetSavingsAccountId) {
        setErrorMsg('Please select a Target Savings Head / Reserved Fund.');
        return;
      }
      if (sourceAccountId === targetSavingsAccountId) {
        setErrorMsg('Source payment account and Target Savings Head must be different.');
        return;
      }

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
          account_id: targetSavingsAccountId,
          line_type: 'debit' as const,
          amount: numAmount,
          memo: `Savings Allocation (${selectedCat?.name || 'Dedicated Fund'}): ${memoText}`,
          category_id: categoryId || undefined,
          counterparty: counterparty.trim() || undefined,
        },
      ];

      if (entryToEdit) {
        const res = db.updateJournalEntry(workspaceId, entryToEdit.id, {
          memo: memoText,
          entry_date: date,
          period_end_date: effectivePeriodEnd,
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
          source_id: targetSavingsAccountId,
          entry_date: date,
          period_end_date: effectivePeriodEnd,
          is_historical: isHistorical,
          historical_note: historicalNote.trim() || undefined,
          lines,
        });
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to post transaction.');
          return;
        }
      }

      // Update matching savings goals if any
      const goals = db.getSavingsGoals(workspaceId);
      const targetHeadAcc = accounts.find(a => a.id === targetSavingsAccountId);
      const matchedGoal = goals.find(g => 
        g.account_id === targetSavingsAccountId ||
        (targetHeadAcc && g.name.toLowerCase() === targetHeadAcc.name.toLowerCase()) ||
        (selectedCat && g.name.toLowerCase() === selectedCat.name.toLowerCase())
      );
      if (matchedGoal) {
        matchedGoal.current_saved_amount = (Number(matchedGoal.current_saved_amount) || 0) + numAmount;
        if (matchedGoal.current_saved_amount >= matchedGoal.target_amount) {
          matchedGoal.status = 'completed';
        }
        db.saveSavingsGoal(matchedGoal);
      }
    } else if (mode === 'expense') {
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
          period_end_date: effectivePeriodEnd,
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
          period_end_date: effectivePeriodEnd,
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
          period_end_date: effectivePeriodEnd,
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
          period_end_date: effectivePeriodEnd,
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
          period_end_date: effectivePeriodEnd,
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
          memoText,
          effectivePeriodEnd
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
  // Convert categories to SelectOptions
  const activeCategories = mode === 'income' 
    ? categories.filter(c => c.type === 'income')
    : mode === 'saving'
    ? categories.filter(c => c.type === 'saving' || c.accounting_classification === 'asset_savings')
    : categories.filter(c => c.type !== 'income');

  const incomeTypes = db.getIncomeTypes(workspaceId);
  const incomeTypeMap = new Map(incomeTypes.map(t => [t.id, t.name]));

  const categoryOptions = activeCategories.map(c => {
    let sub: string = c.type;
    if (c.type === 'income') {
      sub = (c.income_type && incomeTypeMap.get(c.income_type)) || (c.income_type ? c.income_type.replace('_', ' ') : 'Income');
    } else if (c.type === 'saving' || c.accounting_classification === 'asset_savings') {
      sub = 'Saving / Reserved Fund';
    } else {
      sub = 'Expense';
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

  const savingsAccountOptions = savingsAccounts.map(a => ({
    value: a.id,
    label: a.name,
    subLabel: formatMoney(a.current_balance_cached),
    color: a.color || '#0d9488',
  }));

  const selectedCat = categories.find(c => c.id === categoryId);
  const sourceAcc = accounts.find(a => a.id === sourceAccountId);
  const targetSavingsAcc = accounts.find(a => a.id === targetSavingsAccountId);

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

        {/* Mode Selector Tabs (4 Modes: Expense, Income, Saving Allocation, Transfer) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl my-4 text-xs font-semibold">
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
            onClick={() => {
              setMode('saving');
              const savingCat = categories.find(c => c.type === 'saving');
              if (savingCat) {
                setCategoryId(savingCat.id);
                if (savingCat.target_savings_account_id) {
                  setTargetSavingsAccountId(savingCat.target_savings_account_id);
                }
              }
            }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${
              mode === 'saving'
                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <PiggyBank className="w-4 h-4" />
            <span>Saving</span>
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
          {/* Amount & Date Configuration */}
          <div className="space-y-3">
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
                  className="w-full pl-8 pr-3 py-2.5 text-base font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 shadow-xs"
                  required
                />
              </div>
            </div>

            {/* Date Mode Toggle: Single Date vs Period / Date Range (e.g. 01 Jan 2025 to 31 Dec 2026) */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Date / Timeframe
                </span>
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 text-3xs font-medium">
                  <button
                    type="button"
                    onClick={() => setIsDateRange(false)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      !isDateRange
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Specific Date
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDateRange(true);
                      if (!periodEndDate) {
                        setPeriodEndDate(date);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                      isDateRange
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <CalendarRange className="w-3 h-3" />
                    Date Period / Span
                  </button>
                </div>
              </div>

              {!isDateRange ? (
                <div>
                  <label className="block text-2xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-2xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        From (Start Date)
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        To (End Date)
                      </label>
                      <input
                        type="date"
                        value={periodEndDate}
                        onChange={(e) => setPeriodEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  </div>
                  {periodEndDate && (
                    <div className="flex items-center justify-between text-3xs px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300">
                      <span className="font-semibold flex items-center gap-1">
                        <CalendarRange className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Span: {date} → {periodEndDate}
                      </span>
                      <span className="font-mono font-medium">
                        {getPeriodDurationLabel(date, periodEndDate)}
                      </span>
                    </div>
                  )}
                  <p className="text-3xs text-slate-500 dark:text-slate-400">
                    💡 Perfect for cumulative entries (e.g. 01 Jan 2025 to 31 Dec 2026), yearly retainers, or lump-sum prior records.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Accounts & Category with Inline Add & Edit Dropdowns */}
          {mode === 'expense' && (
            <div className="space-y-3">
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
                  onChange={handleSelectCategory}
                  onAddNew={handleAddNewCategory}
                  onEditSelected={handleEditCategory}
                  placeholder="Choose category"
                  required
                />
              </div>

              {/* Dynamic Target Savings Head Selection if Expense category is a Saving Head */}
              {(selectedCat?.type === 'saving' || selectedCat?.accounting_classification === 'asset_savings') && (
                <div className="p-3.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                      <PiggyBank className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <span>Target Savings Head / Reserved Fund</span>
                    </label>
                  </div>
                  <EditableSelect
                    options={savingsAccountOptions}
                    value={targetSavingsAccountId}
                    onChange={setTargetSavingsAccountId}
                    onAddNew={handleAddNewSavingsHead}
                    onEditSelected={handleEditSavingsHead}
                    placeholder="Select target savings head (e.g. DSPF, Unity Fund)"
                    addNewTitle="New Savings Head"
                    editTitle="Edit Head Name"
                    required
                  />
                  <p className="text-3xs text-teal-700 dark:text-teal-300 leading-relaxed">
                    ✨ <strong>Saving Head Detected:</strong> This will deduct {amount ? formatMoney(parseFloat(amount) || 0) : 'funds'} from {sourceAcc?.name || 'paying account'} and deposit directly into your <strong>{targetSavingsAcc?.name || 'Dedicated Savings Head'}</strong>, increasing your real-time savings balance in the Accounts Cockpit.
                  </p>
                </div>
              )}
            </div>
          )}

          {mode === 'saving' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EditableSelect
                  label="Paid From (Liquid Account / Wallet)"
                  options={accountOptions}
                  value={sourceAccountId}
                  onChange={setSourceAccountId}
                  onAddNew={handleAddNewAccount}
                  onEditSelected={handleEditAccount}
                  placeholder="Choose paying account"
                  required
                />
                <EditableSelect
                  label="Saving Category"
                  options={categoryOptions}
                  value={categoryId}
                  onChange={handleSelectCategory}
                  onAddNew={handleAddNewCategory}
                  onEditSelected={handleEditCategory}
                  placeholder="Choose category"
                  required
                />
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                    <PiggyBank className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Target Savings Head / Reserved Fund</span>
                  </label>
                </div>
                <EditableSelect
                  options={savingsAccountOptions}
                  value={targetSavingsAccountId}
                  onChange={setTargetSavingsAccountId}
                  onAddNew={handleAddNewSavingsHead}
                  onEditSelected={handleEditSavingsHead}
                  placeholder="Select target savings head (e.g. DSPF, Unity Fund)"
                  addNewTitle="New Savings Head"
                  editTitle="Edit Head Name"
                  required
                />
                <p className="text-3xs text-teal-700 dark:text-teal-300 leading-relaxed">
                  ✨ <strong>Dedicated Savings Flow:</strong> Deducts from {sourceAcc?.name || 'Liquid Wallet'} and adds directly into your <strong>{targetSavingsAcc?.name || 'Savings Head'}</strong> without distorting operational burn expenses.
                </p>
              </div>
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
