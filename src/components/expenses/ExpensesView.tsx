import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  Receipt, 
  Plus, 
  Filter, 
  AlertTriangle, 
  Calendar, 
  CreditCard, 
  Wallet, 
  Smartphone, 
  CheckCircle2, 
  Search,
  Sparkles,
  ArrowRight,
  PiggyBank
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { JournalEntry, FinancialAccount, Category } from '../../types';
import { NewTransactionModal } from '../modals/NewTransactionModal';
import { toUuid } from '../../lib/uuid';

interface ExpensesViewProps {
  onOpenAiScan?: () => void;
  onOpenNewTransaction?: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  onOpenAiScan,
  onOpenNewTransaction,
}) => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const categories = db.getCategories(workspaceId);
  const expenseCategories = categories.filter(c => c.type === 'expense' || c.type === 'saving');
  const journalEntries = db.getJournalEntries(workspaceId);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [outflowFilter, setOutflowFilter] = useState<'all' | 'operating' | 'savings'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'this_month' | 'last_month' | 'all'>('this_month');

  // Filter out expense entries
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStr = lastMonthDate.toISOString().slice(0, 7);

  interface ExpenseRow {
    id: string;
    entryId: string;
    date: string;
    periodEndDate?: string;
    memo: string;
    amount: number;
    categoryName: string;
    categoryId: string;
    channelName: string;
    channelType: string;
    counterparty?: string;
    isSavingAllocation?: boolean;
    targetSavingsHeadName?: string;
  }

  const expenseRows: ExpenseRow[] = [];
  const categoryTotals: Record<string, { name: string; total: number; count: number; color: string }> = {};
  const defaultIncomeAccUuid = toUuid(`acc_income_earned_${workspaceId}`);
  const defaultExpenseAccUuid = toUuid(`acc_expense_operating_${workspaceId}`);

  journalEntries.forEach(entry => {
    if (entry.status !== 'posted') return;

    // Check date
    if (dateFilter === 'this_month' && !entry.entry_date.startsWith(currentMonthStr)) return;
    if (dateFilter === 'last_month' && !entry.entry_date.startsWith(lastMonthStr)) return;

    // Strictly skip transfers and opening balances
    if (entry.source_type === 'transfer' || entry.source_type === 'opening_balance') return;

    const lines = entry.lines || [];
    if (lines.length === 0) return;

    // 1. Check if this entry represents an INCOME transaction (must never appear in Central Expense Hub)
    const hasIncomeCat = lines.some(l => {
      if (!l.category_id) return false;
      const c = categories.find(cat => cat.id === l.category_id);
      return c?.type === 'income' || Boolean(c?.income_type);
    });

    const isCreditToIncomeAcc = lines.some(l => {
      if (l.line_type !== 'credit') return false;
      if (l.account_id === defaultIncomeAccUuid) return true;
      const acc = accounts.find(a => a.id === l.account_id);
      return (
        acc?.account_type_id?.startsWith('income') ||
        acc?.name?.toLowerCase().includes('earned revenue') ||
        acc?.name?.toLowerCase().includes('income')
      );
    });

    if (hasIncomeCat || isCreditToIncomeAcc) {
      // This is an income transaction, exclude from Expense view completely
      return;
    }

    // 2. Identify paying account (credit line on asset/card account)
    const creditLine = lines.find(l => {
      if (l.line_type !== 'credit') return false;
      const acc = accounts.find(a => a.id === l.account_id);
      return acc && ['cash', 'bank', 'mfs', 'credit_card', 'savings_dps', 'investment', 'loan_payable'].includes(acc.account_type_id);
    }) || lines.find(l => l.line_type === 'credit');

    const payerAcc = creditLine?.account_id ? accounts.find(a => a.id === creditLine.account_id) : undefined;

    // 3. Identify debit line (debit to expense account, category, or savings head)
    const debitLine = lines.find(l => l.line_type === 'debit');
    const debitAcc = debitLine?.account_id ? accounts.find(a => a.id === debitLine.account_id) : undefined;
    const isSavingHeadDebit = debitAcc && ['savings_dps', 'investment'].includes(debitAcc.account_type_id);

    // 4. Resolve category
    const linkedCatId = debitLine?.category_id || creditLine?.category_id || lines.find(l => l.category_id)?.category_id;
    const cat = linkedCatId ? categories.find(c => c.id === linkedCatId) : undefined;

    // Double check: if linked category is income, exclude
    if (cat && cat.type === 'income') return;

    const isSavingAllocation = cat?.type === 'saving' || cat?.accounting_classification === 'asset_savings' || Boolean(isSavingHeadDebit);
    const targetSavingsHeadName = isSavingHeadDebit 
      ? debitAcc?.name 
      : (cat?.target_savings_account_id ? accounts.find(a => a.id === cat.target_savings_account_id)?.name : undefined);

    const catName = cat?.name || (isSavingAllocation ? (targetSavingsHeadName || 'Saving Allocation') : 'Uncategorized Expense');
    const catId = cat?.id || (isSavingAllocation ? 'saving_head' : 'uncategorized');
    const catColor = cat?.color || (isSavingAllocation ? '#0d9488' : '#ef4444');
    const amount = debitLine?.amount || creditLine?.amount || lines[0]?.amount || 0;
    const memo = debitLine?.memo || entry.memo || 'Expense';
    const counterparty = debitLine?.counterparty || creditLine?.counterparty || lines.find(l => l.counterparty)?.counterparty;

    if (!categoryTotals[catId]) {
      categoryTotals[catId] = {
        name: catName,
        total: 0,
        count: 0,
        color: catColor,
      };
    }
    categoryTotals[catId].total += amount;
    categoryTotals[catId].count += 1;

    expenseRows.push({
      id: debitLine?.id || entry.id,
      entryId: entry.id,
      date: entry.entry_date,
      periodEndDate: entry.period_end_date,
      memo,
      amount,
      categoryName: catName,
      categoryId: catId,
      channelName: payerAcc?.name || 'Cash / Card',
      channelType: payerAcc?.account_type_id || 'cash',
      counterparty,
      isSavingAllocation,
      targetSavingsHeadName,
    });
  });

  const totalExpense = expenseRows.reduce((sum, r) => sum + r.amount, 0);
  const totalOperating = expenseRows.filter(r => !r.isSavingAllocation).reduce((sum, r) => sum + r.amount, 0);
  const totalSavingsAllocated = expenseRows.filter(r => r.isSavingAllocation).reduce((sum, r) => sum + r.amount, 0);

  // Filtered rows
  const filteredRows = expenseRows.filter(row => {
    if (outflowFilter === 'operating' && row.isSavingAllocation) return false;
    if (outflowFilter === 'savings' && !row.isSavingAllocation) return false;
    if (selectedCategory !== 'all' && row.categoryId !== selectedCategory) return false;
    if (selectedChannel !== 'all') {
      if (selectedChannel === 'cash' && row.channelType !== 'cash') return false;
      if (selectedChannel === 'card' && row.channelType !== 'credit_card') return false;
      if (selectedChannel === 'mfs' && row.channelType !== 'mfs') return false;
      if (selectedChannel === 'bank' && row.channelType !== 'bank') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        row.memo.toLowerCase().includes(q) ||
        row.categoryName.toLowerCase().includes(q) ||
        row.channelName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Top expense categories
  const sortedCategories = Object.values(categoryTotals).sort((a, b) => b.total - a.total);
  const topCategory = sortedCategories[0] || { name: 'No Expense Logged', total: 0 };

  // Calculate dominant payment channel dynamically
  const channelCounts: Record<string, { label: string; count: number; total: number }> = {};
  expenseRows.forEach(r => {
    const key = r.channelName || 'Cash';
    if (!channelCounts[key]) channelCounts[key] = { label: key, count: 0, total: 0 };
    channelCounts[key].count += 1;
    channelCounts[key].total += r.amount;
  });
  const dominantChannel = Object.values(channelCounts).sort((a, b) => b.total - a.total)[0] || {
    label: 'None',
    count: 0,
    total: 0
  };

  const [entryToEdit, setEntryToEdit] = useState<JournalEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEditEntry = (row: ExpenseRow) => {
    const fullEntry = journalEntries.find(e => e.id === row.entryId);
    if (fullEntry) {
      setEntryToEdit(fullEntry);
      setIsEditModalOpen(true);
    }
  };

  const handleDeleteEntry = (row: ExpenseRow) => {
    if (confirm(`Are you sure you want to delete this expense of ${formatMoney(row.amount)} (${row.memo})? This will balance and restore your account.`)) {
      db.deleteJournalEntry(workspaceId, row.entryId);
      refreshData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Central Expense Hub
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
              {expenseCategories.length} Categories
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centralized monitoring of all personal, household, and family outflow transactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAiScan && (
            <button
              onClick={onOpenAiScan}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Scan Receipt</span>
            </button>
          )}

          {canWrite && onOpenNewTransaction && (
            <button
              onClick={onOpenNewTransaction}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Log Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Total Outflows
          </span>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
            {formatMoney(totalExpense)}
          </div>
          <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5 flex flex-col gap-0.5">
            <span className="text-slate-600 dark:text-slate-300">
              Expenses: <strong className="font-mono">{formatMoney(totalOperating)}</strong>
            </span>
            <span className="text-teal-600 dark:text-teal-400">
              Saved to Heads: <strong className="font-mono">{formatMoney(totalSavingsAllocated)}</strong>
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Highest Expense Category
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
            {topCategory.name}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-2xs">
            <span className="text-slate-500">Total Spent</span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
              {formatMoney(topCategory.total)}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Payment Channel Dominance
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
            {dominantChannel.label}
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5">
            {dominantChannel.count > 0 ? `${dominantChannel.count} outflows (${formatMoney(dominantChannel.total)})` : 'No outflows logged yet'}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Outflow Spike Monitor
          </span>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Normal Velocity</span>
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5">
            No category exceeds 150% threshold
          </p>
        </div>
      </div>

      {/* Top 6 Spending Categories Bar Visualizer */}
      {sortedCategories.length > 0 && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            Top Spending Allocations
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {sortedCategories.slice(0, 6).map(cat => {
              const pct = totalExpense > 0 ? (cat.total / totalExpense) * 100 : 0;
              return (
                <div key={cat.name} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-2xs font-semibold text-slate-500 dark:text-slate-400 block truncate">
                    {cat.name}
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white block mt-1 tabular-nums">
                    {formatMoney(cat.total)}
                  </span>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full rounded-full" 
                      style={{ width: `${Math.max(pct, 5)}%` }} 
                    />
                  </div>
                  <span className="text-3xs text-slate-400 mt-1 block">
                    {pct.toFixed(0)}% of total
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search memo or vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="all">All 36 Categories</option>
            {expenseCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Payment Channel Filter */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="all">All Payment Channels</option>
            <option value="cash">Cash in Hand</option>
            <option value="mfs">bKash &amp; Nagad</option>
            <option value="bank">Bank / Online</option>
            <option value="card">Credit Card</option>
          </select>
        </div>

        {/* Outflow Type Filter (All, Operating Expenses, Savings Allocations) */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setOutflowFilter('all')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              outflowFilter === 'all' ? 'bg-white dark:bg-slate-700 font-semibold shadow-xs text-slate-900 dark:text-white' : 'text-slate-500'
            }`}
          >
            All Outflows ({expenseRows.length})
          </button>
          <button
            onClick={() => setOutflowFilter('operating')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              outflowFilter === 'operating' ? 'bg-white dark:bg-slate-700 font-semibold shadow-xs text-rose-600 dark:text-rose-400' : 'text-slate-500'
            }`}
          >
            Operating
          </button>
          <button
            onClick={() => setOutflowFilter('savings')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              outflowFilter === 'savings' ? 'bg-white dark:bg-slate-700 font-semibold shadow-xs text-teal-600 dark:text-teal-400' : 'text-slate-500'
            }`}
          >
            Savings Heads
          </button>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setDateFilter('this_month')}
            className={`px-3 py-1 rounded-md transition-all ${
              dateFilter === 'this_month' ? 'bg-white dark:bg-slate-700 font-semibold shadow-xs text-slate-900 dark:text-white' : 'text-slate-500'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setDateFilter('last_month')}
            className={`px-3 py-1 rounded-md transition-all ${
              dateFilter === 'last_month' ? 'bg-white dark:bg-slate-700 font-semibold shadow-xs text-slate-900 dark:text-white' : 'text-slate-500'
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1 rounded-md transition-all ${
              dateFilter === 'all' ? 'bg-white dark:bg-slate-700 font-semibold shadow-xs text-slate-900 dark:text-white' : 'text-slate-500'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Main Expense Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-2xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category / Head</th>
                <th className="py-3 px-4">Description / Memo</th>
                <th className="py-3 px-4">Paid Via</th>
                <th className="py-3 px-4 text-right">Amount ({currentWorkspace?.currency || 'BDT'})</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No expense records matching the active filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => {
                  const entry = journalEntries.find(e => e.id === row.entryId);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap text-xs">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span>{row.date}</span>
                            {entry?.is_historical && (
                              <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700" title={entry.historical_note || 'Prior Period DB Entry'}>
                                Prior DB
                              </span>
                            )}
                          </div>
                          {row.periodEndDate && (
                            <span className="text-3xs text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                              → {row.periodEndDate}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold w-fit ${
                            row.isSavingAllocation
                              ? 'bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {row.categoryName}
                          </span>
                          {row.isSavingAllocation && (
                            <span className="text-3xs text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1">
                              <PiggyBank className="w-2.5 h-2.5" />
                              <span>Added to: {row.targetSavingsHeadName || 'Savings Head'}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                        {row.memo}
                        {row.counterparty && (
                          <span className="text-2xs text-slate-400 block">Vendor: {row.counterparty}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {row.channelType === 'credit_card' ? (
                            <CreditCard className="w-3.5 h-3.5 text-rose-500" />
                          ) : row.channelType === 'mfs' ? (
                            <Smartphone className="w-3.5 h-3.5 text-pink-500" />
                          ) : (
                            <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          <span>{row.channelName}</span>
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap tabular-nums ${
                        row.isSavingAllocation ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        -{formatMoney(row.amount)}
                        {row.isSavingAllocation && (
                          <span className="text-3xs font-sans font-normal text-teal-500 block">Saved in Head</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {canWrite && (
                            <>
                              <button
                                onClick={() => handleEditEntry(row)}
                                title="Edit Expense"
                                className="px-2 py-1 text-2xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(row)}
                                title="Delete Expense"
                                className="px-2 py-1 text-2xs font-medium rounded-md bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition-colors"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {isEditModalOpen && entryToEdit && (
        <NewTransactionModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEntryToEdit(null);
          }}
          entryToEdit={entryToEdit}
          defaultMode="expense"
        />
      )}
    </div>
  );
};
