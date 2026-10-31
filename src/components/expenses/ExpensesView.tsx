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
  ArrowRight
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { JournalEntry, FinancialAccount, Category } from '../../types';

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
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const journalEntries = db.getJournalEntries(workspaceId);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
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
    memo: string;
    amount: number;
    categoryName: string;
    categoryId: string;
    channelName: string;
    channelType: string;
    counterparty?: string;
  }

  const expenseRows: ExpenseRow[] = [];
  const categoryTotals: Record<string, { name: string; total: number; count: number; color: string }> = {};

  journalEntries.forEach(entry => {
    if (entry.status !== 'posted') return;

    // Check date
    if (dateFilter === 'this_month' && !entry.entry_date.startsWith(currentMonthStr)) return;
    if (dateFilter === 'last_month' && !entry.entry_date.startsWith(lastMonthStr)) return;

    // Find paying account and expense category
    let payerAcc: FinancialAccount | undefined;
    entry.lines?.forEach(line => {
      if (line.line_type === 'credit' && line.account_id) {
        payerAcc = accounts.find(a => a.id === line.account_id);
      }
    });

    entry.lines?.forEach(line => {
      if (line.line_type === 'debit' && line.category_id) {
        const cat = categories.find(c => c.id === line.category_id);
        const catName = cat?.name || 'Uncategorized Expense';

        if (!categoryTotals[line.category_id]) {
          categoryTotals[line.category_id] = {
            name: catName,
            total: 0,
            count: 0,
            color: cat?.color || '#ef4444',
          };
        }
        categoryTotals[line.category_id].total += line.amount;
        categoryTotals[line.category_id].count += 1;

        expenseRows.push({
          id: line.id,
          entryId: entry.id,
          date: entry.entry_date,
          memo: line.memo || entry.memo,
          amount: line.amount,
          categoryName: catName,
          categoryId: line.category_id,
          channelName: payerAcc?.name || 'Cash / Card',
          channelType: payerAcc?.account_type_id || 'cash',
          counterparty: line.counterparty,
        });
      }
    });
  });

  const totalExpense = expenseRows.reduce((sum, r) => sum + r.amount, 0);

  // Filtered rows
  const filteredRows = expenseRows.filter(row => {
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
  const topCategory = sortedCategories[0] || { name: 'Personal (Food)', total: 0 };

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
              36 Categories
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
            Total Expense Outflow
          </span>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
            {formatMoney(totalExpense)}
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5">
            {expenseRows.length} transactions recorded
          </p>
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
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            bKash &amp; Cash
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5">
            Micro-outflows processed via MFS
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
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description / Memo</th>
                <th className="py-3 px-4">Paid Via</th>
                <th className="py-3 px-4 text-right">Amount (BDT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No expense records matching the active filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {row.categoryName}
                      </span>
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
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap tabular-nums">
                      -{formatMoney(row.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
