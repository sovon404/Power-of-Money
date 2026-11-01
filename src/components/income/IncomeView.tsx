import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Plus, 
  PieChart as PieIcon, 
  Lightbulb, 
  ShieldAlert, 
  Calendar, 
  Search,
  Filter,
  Edit2,
  Trash2,
  History,
  Building2,
  Briefcase,
  Globe,
  Laptop
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { JournalEntry } from '../../types';
import { NewTransactionModal } from '../modals/NewTransactionModal';

export const IncomeView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const categories = db.getCategories(workspaceId);
  const incomeCategories = categories.filter(c => c.type === 'income');
  const journalEntries = db.getJournalEntries(workspaceId);

  // Modal states
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  // Table filter states
  const [dateFilterRange, setDateFilterRange] = useState<'7days' | '30days' | 'this_month' | 'all' | 'custom'>('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Extract purely real income transaction rows from posted journal entries
  interface IncomeRecord {
    entryId: string;
    date: string;
    memo: string;
    counterparty: string;
    categoryId?: string;
    categoryName: string;
    categoryColor: string;
    accountId: string;
    accountName: string;
    amount: number;
    isHistorical: boolean;
    historicalNote?: string;
    rawEntry: JournalEntry;
  }

  const incomeRecords: IncomeRecord[] = useMemo(() => {
    const records: IncomeRecord[] = [];
    const incomeCatMap = new Map(incomeCategories.map(c => [c.id, c]));

    journalEntries.forEach(entry => {
      if (entry.status !== 'posted') return;

      // In double-entry: Income line is credit with an income category (or memo containing income)
      const creditLine = entry.lines?.find(l => l.line_type === 'credit' && (l.category_id && incomeCatMap.has(l.category_id)));
      const debitLine = entry.lines?.find(l => l.line_type === 'debit');

      if (creditLine) {
        const cat = creditLine.category_id ? incomeCatMap.get(creditLine.category_id) : undefined;
        const depositAcc = debitLine ? accounts.find(a => a.id === debitLine.account_id) : undefined;

        records.push({
          entryId: entry.id,
          date: entry.entry_date,
          memo: entry.memo,
          counterparty: creditLine.counterparty || debitLine?.counterparty || '',
          categoryId: creditLine.category_id,
          categoryName: cat?.name || 'General Income',
          categoryColor: cat?.color || '#10b981',
          accountId: debitLine?.account_id || '',
          accountName: depositAcc?.name || 'Liquid Account',
          amount: creditLine.amount,
          isHistorical: Boolean(entry.is_historical),
          historicalNote: entry.historical_note,
          rawEntry: entry,
        });
      }
    });

    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [journalEntries, incomeCategories, accounts]);

  // 2. Compute dynamic stream totals purely from database records
  const categoryTotals = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number; color: string }> = {};

    // Initialize all existing income categories with 0
    incomeCategories.forEach(cat => {
      map[cat.id] = { name: cat.name, total: 0, count: 0, color: cat.color || '#10b981' };
    });

    incomeRecords.forEach(rec => {
      if (rec.categoryId && map[rec.categoryId]) {
        map[rec.categoryId].total += rec.amount;
        map[rec.categoryId].count += 1;
      } else {
        const key = rec.categoryName;
        if (!map[key]) {
          map[key] = { name: rec.categoryName, total: 0, count: 0, color: rec.categoryColor };
        }
        map[key].total += rec.amount;
        map[key].count += 1;
      }
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [incomeCategories, incomeRecords]);

  const totalInflow = useMemo(() => {
    return incomeRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [incomeRecords]);

  const topStream = categoryTotals.length > 0 && categoryTotals[0].total > 0
    ? {
        name: categoryTotals[0].name,
        total: categoryTotals[0].total,
        pct: totalInflow > 0 ? (categoryTotals[0].total / totalInflow) * 100 : 0,
      }
    : { name: 'None yet', total: 0, pct: 0 };

  const activeStreamCount = categoryTotals.filter(c => c.total > 0).length;

  // 3. Filtered records for the Detail Table
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.slice(0, 7);

    return incomeRecords.filter(r => {
      // Date filter
      if (dateFilterRange === '7days' && r.date < sevenDaysAgo) return false;
      if (dateFilterRange === '30days' && r.date < thirtyDaysAgo) return false;
      if (dateFilterRange === 'this_month' && !r.date.startsWith(currentMonthPrefix)) return false;
      if (dateFilterRange === 'custom') {
        if (customFromDate && r.date < customFromDate) return false;
        if (customToDate && r.date > customToDate) return false;
      }

      // Category filter
      if (filterCategory !== 'all') {
        if (r.categoryId !== filterCategory && r.categoryName !== filterCategory) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMemo = r.memo.toLowerCase().includes(q);
        const matchCounter = r.counterparty.toLowerCase().includes(q);
        const matchCat = r.categoryName.toLowerCase().includes(q);
        const matchAcc = r.accountName.toLowerCase().includes(q);
        if (!matchMemo && !matchCounter && !matchCat && !matchAcc) return false;
      }

      return true;
    });
  }, [incomeRecords, dateFilterRange, customFromDate, customToDate, filterCategory, searchQuery]);

  const handleDeleteRecord = (entryId: string) => {
    if (window.confirm('Are you sure you want to delete this income entry? Linked account balances will be restored.')) {
      const res = db.deleteJournalEntry(workspaceId, entryId);
      if (res.success) {
        refreshData();
      } else {
        alert(res.error || 'Failed to delete income entry.');
      }
    }
  };

  const handleEditRecord = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setShowTxModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Income Hub &amp; Revenue Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real incoming revenue streams calculated strictly from verified database records.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => {
              setEditingEntry(null);
              setShowTxModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Income</span>
          </button>
        )}
      </div>

      {/* KPI Overview Grid - 100% Real Database Calculations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Total Revenue Inflow
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatMoney(totalInflow)}
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>{incomeRecords.length} posted income transaction{incomeRecords.length === 1 ? '' : 's'}</span>
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Dominant Revenue Driver
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
            {topStream.name}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-2xs">
            <span className="text-slate-500">Contribution Share</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
              {topStream.pct > 0 ? `${topStream.pct.toFixed(1)}%` : '0.0%'}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Active Income Channels
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {activeStreamCount} Channel{activeStreamCount === 1 ? '' : 's'}
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5">
            {activeStreamCount >= 3 ? (
              <span className="text-emerald-500 font-semibold">Healthy diversification</span>
            ) : activeStreamCount >= 1 ? (
              <span className="text-amber-500 font-semibold">Concentrated revenue</span>
            ) : (
              <span>No transactions recorded</span>
            )}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Average Per Inflow
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatMoney(incomeRecords.length > 0 ? totalInflow / incomeRecords.length : 0)}
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5">
            Per transaction ticket average
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DETAIL TABLE / ROWS OF LAST DAYS INCOME TRANSACTIONS     */}
      {/* ======================================================== */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <span>Detailed Income Transactions Log</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete chronological breakdown of each income entry with full update and delete control.
            </p>
          </div>

          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
            {filteredRecords.length} Transaction{filteredRecords.length === 1 ? '' : 's'} Shown
          </span>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Preset Date Range Buttons */}
          <div>
            <label className="block text-2xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Time Period
            </label>
            <select
              value={dateFilterRange}
              onChange={(e) => setDateFilterRange(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Dates</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-2xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Category Filter
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Income Categories</option>
              {incomeCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="sm:col-span-2">
            <label className="block text-2xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Search Memo / Client
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter by description, counterparty or account..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Custom Date Inputs if 'custom' selected */}
        {dateFilterRange === 'custom' && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 mb-1">From Date</label>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 mb-1">To Date</label>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Detail Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-2xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Description / Memo</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Deposited Into</th>
                <th className="py-2.5 px-3">Source / Flag</th>
                <th className="py-2.5 px-3 text-right">Inflow Amount</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No income transactions match your current filters. Click &ldquo;Record New Income&rdquo; above to record a payment.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.entryId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {rec.date}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 dark:text-white">{rec.memo}</div>
                      {rec.counterparty && (
                        <span className="text-2xs text-slate-400 block mt-0.5">
                          From: {rec.counterparty}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span 
                        className="px-2 py-0.5 rounded-full text-2xs font-semibold text-white inline-block"
                        style={{ backgroundColor: rec.categoryColor }}
                      >
                        {rec.categoryName}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {rec.accountName}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {rec.isHistorical ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                          <History className="w-3 h-3 text-amber-600" />
                          <span>Previous DB</span>
                        </span>
                      ) : (
                        <span className="text-2xs text-slate-400 font-mono">Current Live</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap text-sm">
                      +{formatMoney(rec.amount)}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditRecord(rec.rawEntry)}
                          title="Edit Income Transaction"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(rec.entryId)}
                          title="Delete Income Transaction"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Analytics Layout: Category Distribution & Dynamic Improvement Advisor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Distribution of Revenue */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-emerald-500" />
                  <span>Revenue Stream Distribution</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aggregated volume and share per income category from your active ledger.
                </p>
              </div>
              <span className="text-2xs font-mono font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Live DB
              </span>
            </div>

            {categoryTotals.filter(c => c.total > 0).length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-xs font-medium">No revenue streams active yet.</p>
                <span className="text-2xs text-slate-500">Record an income transaction above to see breakdown bars.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {categoryTotals.filter(c => c.total > 0).map(stream => {
                  const pct = totalInflow > 0 ? (stream.total / totalInflow) * 100 : 0;
                  return (
                    <div 
                      key={stream.name}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full shrink-0" 
                            style={{ backgroundColor: stream.color }}
                          />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {stream.name}
                          </span>
                          <span className="text-2xs text-slate-400">
                            ({stream.count} transaction{stream.count === 1 ? '' : 's'})
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                            {formatMoney(stream.total)}
                          </span>
                          <span className="text-2xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 ml-2">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: stream.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Dynamic "How Should I Improve?" Strategy Section */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Lightbulb className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                How Should I Improve?
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Real-time strategic observations computed dynamically from your actual earnings data.
            </p>

            <div className="space-y-3.5">
              {totalInflow === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    No Earnings Data Recorded Yet
                  </p>
                  <span>
                    Once you record your first income transaction (e.g. Salary, Client Retainer, Freelance invoice), dynamic diversification and concentration risk telemetry will be calculated here.
                  </span>
                </div>
              ) : (
                <>
                  {/* Dynamic Insight 1: Concentration Risk */}
                  {topStream.pct > 50 ? (
                    <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>High Concentration Risk ({topStream.name})</span>
                      </div>
                      <p className="text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>{topStream.name}</strong> accounts for <strong>{topStream.pct.toFixed(1)}%</strong> of your total recorded inflow ({formatMoney(topStream.total)}). To protect family cashflow against single-client or single-employer volatility, prioritize developing a secondary income stream contributing at least 20–30% of total revenue.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Balanced Concentration Health</span>
                      </div>
                      <p className="text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        No single stream dominates over 50% of your earnings. Your top driver (<strong>{topStream.name}</strong>) represents <strong>{topStream.pct.toFixed(1)}%</strong>, reflecting a balanced risk spread.
                      </p>
                    </div>
                  )}

                  {/* Dynamic Insight 2: Channel Count */}
                  <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
                      <DollarSign className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Earnings Channels ({activeStreamCount} Active)</span>
                    </div>
                    <p className="text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      You currently receive funds across {activeStreamCount} separate category channel{activeStreamCount === 1 ? '' : 's'}. Review whether passive channels (dividends, rental or interest yield) can be expanded to supplement active labor income.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Global Transaction Modal for Add & Edit with Editable Select */}
      <NewTransactionModal
        isOpen={showTxModal}
        entryToEdit={editingEntry}
        onClose={() => {
          setShowTxModal(false);
          setEditingEntry(null);
        }}
        onSuccess={refreshData}
      />
    </div>
  );
};
