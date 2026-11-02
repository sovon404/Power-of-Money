import React, { useState, useMemo } from 'react';
import { 
  Download, 
  Calendar, 
  FileSpreadsheet, 
  TrendingUp, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight, 
  Printer, 
  PieChart as PieIcon,
  BarChart3,
  History,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { JournalEntry } from '../../types';
import { toUuid } from '../../lib/uuid';

export const ReportBuilderView: React.FC = () => {
  const { currentWorkspace, formatMoney } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId);
  const categories = db.getCategories(workspaceId);
  const entries = db.getJournalEntries(workspaceId);

  // Date Range and Filter state
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'this_month' | 'last_month' | 'this_year' | 'custom'>('this_month');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  
  // Statement Configuration
  const [statementType, setStatementType] = useState<'mix' | 'income' | 'expense' | 'transfers' | 'account' | 'category'>('mix');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [includeHistorical, setIncludeHistorical] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'statement' | 'chart'>('statement');

  // Compute effective date bounds
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (datePreset === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (datePreset === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return { start, end: todayStr };
    }
    if (datePreset === '30days') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return { start, end: todayStr };
    }
    if (datePreset === 'this_month') {
      const start = `${todayStr.slice(0, 7)}-01`;
      return { start, end: todayStr };
    }
    if (datePreset === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { 
        start: lastMonth.toISOString().split('T')[0], 
        end: lastMonthEnd.toISOString().split('T')[0] 
      };
    }
    if (datePreset === 'this_year') {
      const start = `${now.getFullYear()}-01-01`;
      return { start, end: todayStr };
    }
    if (datePreset === 'custom') {
      return { start: fromDate, end: toDate };
    }
    return { start: '', end: '' }; // 'all'
  }, [datePreset, fromDate, toDate]);

  // Account & Category lookups
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Flattened Statement Rows
  interface StatementRow {
    id: string;
    entryId: string;
    entryNumber: number;
    date: string;
    memo: string;
    sourceType: string;
    categoryName: string;
    categoryType: string;
    accountName: string;
    counterparty: string;
    inflow: number;
    outflow: number;
    isHistorical: boolean;
    historicalNote?: string;
  }

  const statementRows: StatementRow[] = useMemo(() => {
    const rows: StatementRow[] = [];
    const defaultIncomeAccUuid = toUuid(`acc_income_earned_${workspaceId}`);
    const defaultExpenseAccUuid = toUuid(`acc_expense_operating_${workspaceId}`);

    entries.forEach(entry => {
      if (entry.status !== 'posted') return;

      // Filter by historical flag
      if (!includeHistorical && entry.is_historical) return;

      // Filter by date range
      if (dateRangeBounds.start && entry.entry_date < dateRangeBounds.start) return;
      if (dateRangeBounds.end && entry.entry_date > dateRangeBounds.end) return;

      const lines = entry.lines || [];
      if (lines.length === 0) return;

      // --- CASE 1: SPECIFIC ACCOUNT STATEMENT MODE ---
      if (statementType === 'account' && selectedAccountId) {
        const accountLines = lines.filter(l => l.account_id === selectedAccountId);
        if (accountLines.length === 0) return;

        const targetAcc = accountMap.get(selectedAccountId);
        const isLiability = ['credit_card', 'loan_payable'].includes(targetAcc?.account_type_id || '');

        const totalDebit = accountLines.filter(l => l.line_type === 'debit').reduce((sum, l) => sum + l.amount, 0);
        const totalCredit = accountLines.filter(l => l.line_type === 'credit').reduce((sum, l) => sum + l.amount, 0);

        let inflow = 0;
        let outflow = 0;

        if (isLiability) {
          // For liability accounts, Credit increases due (outflow/charge), Debit decreases due (inflow/payment)
          if (totalCredit > totalDebit) {
            outflow = totalCredit - totalDebit;
          } else if (totalDebit > totalCredit) {
            inflow = totalDebit - totalCredit;
          }
        } else {
          // For asset accounts (Cash, Bank, MFS, Savings), Debit is Inflow (+), Credit is Outflow (-)
          if (totalDebit > totalCredit) {
            inflow = totalDebit - totalCredit;
          } else if (totalCredit > totalDebit) {
            outflow = totalCredit - totalDebit;
          }
        }

        // If net is 0, skip
        if (inflow === 0 && outflow === 0) return;

        // Resolve counter category and counterparty
        const counterLine = lines.find(l => l.account_id !== selectedAccountId);
        const catId = lines.find(l => l.category_id)?.category_id || counterLine?.category_id;
        const cat = catId ? categoryMap.get(catId) : undefined;
        const counterparty = lines.find(l => l.counterparty)?.counterparty || '';

        rows.push({
          id: `${entry.id}_acc`,
          entryId: entry.id,
          entryNumber: entry.entry_number,
          date: entry.entry_date,
          memo: entry.memo || accountLines[0].memo || 'Transaction',
          sourceType: entry.source_type,
          categoryName: cat?.name || (entry.source_type === 'transfer' ? 'Transfer' : 'Uncategorized'),
          categoryType: cat?.type || entry.source_type,
          accountName: targetAcc?.name || 'Account',
          counterparty,
          inflow,
          outflow,
          isHistorical: Boolean(entry.is_historical),
          historicalNote: entry.historical_note,
        });
        return;
      }

      // --- CASE 2: SPECIFIC CATEGORY STATEMENT MODE ---
      if (statementType === 'category' && selectedCategoryId) {
        const catLine = lines.find(l => l.category_id === selectedCategoryId);
        if (!catLine) return;

        const targetCat = categoryMap.get(selectedCategoryId);
        const isIncomeCat = targetCat?.type === 'income' || Boolean(targetCat?.income_type);

        let inflow = 0;
        let outflow = 0;
        let displayAccName = 'General Account';

        if (isIncomeCat) {
          inflow = catLine.amount;
          const depositLine = lines.find(l => l.line_type === 'debit');
          const depAcc = depositLine ? accountMap.get(depositLine.account_id) : undefined;
          displayAccName = depAcc?.name || 'Bank / Wallet';
        } else {
          outflow = catLine.amount;
          const payLine = lines.find(l => l.line_type === 'credit');
          const payAcc = payLine ? accountMap.get(payLine.account_id) : undefined;
          displayAccName = payAcc?.name || 'Cash / Card';
        }

        rows.push({
          id: `${entry.id}_cat`,
          entryId: entry.id,
          entryNumber: entry.entry_number,
          date: entry.entry_date,
          memo: catLine.memo || entry.memo,
          sourceType: entry.source_type,
          categoryName: targetCat?.name || 'Category',
          categoryType: targetCat?.type || 'expense',
          accountName: displayAccName,
          counterparty: catLine.counterparty || lines.find(l => l.counterparty)?.counterparty || '',
          inflow,
          outflow,
          isHistorical: Boolean(entry.is_historical),
          historicalNote: entry.historical_note,
        });
        return;
      }

      // --- CASE 3: GENERAL STATEMENT (MIX, INCOME ONLY, EXPENSE ONLY, TRANSFERS ONLY) ---
      // A. Transfers
      if (entry.source_type === 'transfer') {
        if (statementType === 'income' || statementType === 'expense') return;

        const creditLine = lines.find(l => l.line_type === 'credit');
        const debitLine = lines.find(l => l.line_type === 'debit');
        const fromAcc = creditLine ? accountMap.get(creditLine.account_id) : undefined;
        const toAcc = debitLine ? accountMap.get(debitLine.account_id) : undefined;
        const transferAmount = debitLine?.amount || creditLine?.amount || 0;

        rows.push({
          id: `${entry.id}_transfer`,
          entryId: entry.id,
          entryNumber: entry.entry_number,
          date: entry.entry_date,
          memo: entry.memo || `Transfer: ${fromAcc?.name || 'Account'} → ${toAcc?.name || 'Account'}`,
          sourceType: 'transfer',
          categoryName: 'Transfer',
          categoryType: 'transfer',
          accountName: `${fromAcc?.name || 'Source'} → ${toAcc?.name || 'Destination'}`,
          counterparty: '—',
          inflow: statementType === 'transfers' ? transferAmount : 0,
          outflow: statementType === 'transfers' ? transferAmount : 0,
          isHistorical: Boolean(entry.is_historical),
          historicalNote: entry.historical_note,
        });
        return;
      }

      if (statementType === 'transfers') return;

      // B. Opening Balance
      if (entry.source_type === 'opening_balance') {
        if (statementType === 'expense') return;
        const debitLine = lines.find(l => l.line_type === 'debit');
        const acc = debitLine ? accountMap.get(debitLine.account_id) : undefined;
        const amount = debitLine?.amount || lines[0]?.amount || 0;

        rows.push({
          id: `${entry.id}_open`,
          entryId: entry.id,
          entryNumber: entry.entry_number,
          date: entry.entry_date,
          memo: entry.memo || `Opening Balance: ${acc?.name || 'Account'}`,
          sourceType: 'opening_balance',
          categoryName: 'Opening Balance',
          categoryType: 'equity',
          accountName: acc?.name || 'Account',
          counterparty: '—',
          inflow: amount,
          outflow: 0,
          isHistorical: Boolean(entry.is_historical),
          historicalNote: entry.historical_note,
        });
        return;
      }

      // C. Income Entry Check
      const incomeCatLine = lines.find(l => {
        if (!l.category_id) return false;
        const c = categoryMap.get(l.category_id);
        return c?.type === 'income' || Boolean(c?.income_type);
      });

      const isCreditToIncome = lines.some(l => {
        if (l.line_type !== 'credit') return false;
        if (l.account_id === defaultIncomeAccUuid) return true;
        const a = accountMap.get(l.account_id);
        return (
          a?.account_type_id?.startsWith('income') ||
          a?.name.toLowerCase().includes('earned revenue') ||
          a?.name.toLowerCase().includes('income')
        );
      });

      const isIncome = Boolean(incomeCatLine || isCreditToIncome);

      if (isIncome) {
        if (statementType === 'expense') return;

        const debitLine = lines.find(l => {
          if (l.line_type !== 'debit') return false;
          const a = accountMap.get(l.account_id);
          return a && ['cash', 'bank', 'mfs', 'savings_dps', 'investment'].includes(a.account_type_id);
        }) || lines.find(l => l.line_type === 'debit');

        const depAcc = debitLine ? accountMap.get(debitLine.account_id) : undefined;
        const catId = incomeCatLine?.category_id || lines.find(l => l.category_id)?.category_id;
        const cat = catId ? categoryMap.get(catId) : undefined;
        const amount = incomeCatLine?.amount || debitLine?.amount || lines[0]?.amount || 0;
        const counterparty = lines.find(l => l.counterparty)?.counterparty || '';

        rows.push({
          id: `${entry.id}_inc`,
          entryId: entry.id,
          entryNumber: entry.entry_number,
          date: entry.entry_date,
          memo: entry.memo,
          sourceType: entry.source_type,
          categoryName: cat?.name || 'Income / Revenue',
          categoryType: 'income',
          accountName: depAcc?.name || 'Bank / Wallet',
          counterparty,
          inflow: amount,
          outflow: 0,
          isHistorical: Boolean(entry.is_historical),
          historicalNote: entry.historical_note,
        });
        return;
      }

      // D. Expense Entry Check
      if (statementType === 'income') return;

      const creditLine = lines.find(l => {
        if (l.line_type !== 'credit') return false;
        const a = accountMap.get(l.account_id);
        return a && ['cash', 'bank', 'mfs', 'credit_card', 'savings_dps', 'investment', 'loan_payable'].includes(a.account_type_id);
      }) || lines.find(l => l.line_type === 'credit');

      const payAcc = creditLine ? accountMap.get(creditLine.account_id) : undefined;

      const expenseCatLine = lines.find(l => {
        if (!l.category_id) return false;
        const c = categoryMap.get(l.category_id);
        return c?.type === 'expense';
      }) || lines.find(l => l.line_type === 'debit');

      const catId = expenseCatLine?.category_id || lines.find(l => l.category_id)?.category_id;
      const cat = catId ? categoryMap.get(catId) : undefined;
      const amount = expenseCatLine?.amount || creditLine?.amount || lines[0]?.amount || 0;
      const counterparty = lines.find(l => l.counterparty)?.counterparty || '';

      rows.push({
        id: `${entry.id}_exp`,
        entryId: entry.id,
        entryNumber: entry.entry_number,
        date: entry.entry_date,
        memo: entry.memo,
        sourceType: entry.source_type,
        categoryName: cat?.name || 'General Expense',
        categoryType: 'expense',
        accountName: payAcc?.name || 'Cash / Card',
        counterparty,
        inflow: 0,
        outflow: amount,
        isHistorical: Boolean(entry.is_historical),
        historicalNote: entry.historical_note,
      });
    });

    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, dateRangeBounds, includeHistorical, statementType, selectedAccountId, selectedCategoryId, categoryMap, accountMap, workspaceId]);

  // Aggregate Metrics (Strictly 100% computed from real records - zero mock numbers)
  const totalInflow = useMemo(() => statementRows.reduce((sum, r) => sum + r.inflow, 0), [statementRows]);
  const totalOutflow = useMemo(() => statementRows.reduce((sum, r) => sum + r.outflow, 0), [statementRows]);
  const netPosition = totalInflow - totalOutflow;
  const savingsRate = totalInflow > 0 ? Math.max(0, (netPosition / totalInflow) * 100) : 0;

  // Chart data grouping by month or day
  const chartData = useMemo(() => {
    const monthlyMap: Record<string, { period: string; inflow: number; outflow: number }> = {};
    statementRows.forEach(r => {
      const monthKey = r.date.slice(0, 7); // YYYY-MM
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { period: monthKey, inflow: 0, outflow: 0 };
      }
      monthlyMap[monthKey].inflow += r.inflow;
      monthlyMap[monthKey].outflow += r.outflow;
    });

    return Object.values(monthlyMap).sort((a, b) => a.period.localeCompare(b.period));
  }, [statementRows]);

  // CSV Export Action
  const handleExportCSV = () => {
    if (statementRows.length === 0) {
      alert('No records available in this range to export.');
      return;
    }

    const headers = ['Date', 'Entry #', 'Memo', 'Category', 'Account', 'Counterparty', 'Historical/Legacy', 'Inflow', 'Outflow'];
    const csvLines = [headers.join(',')];

    statementRows.forEach(r => {
      const row = [
        `"${r.date}"`,
        r.entryNumber,
        `"${r.memo.replace(/"/g, '""')}"`,
        `"${r.categoryName.replace(/"/g, '""')}"`,
        `"${r.accountName.replace(/"/g, '""')}"`,
        `"${r.counterparty.replace(/"/g, '""')}"`,
        r.isHistorical ? '"Yes"' : '"No"',
        r.inflow.toFixed(2),
        r.outflow.toFixed(2),
      ];
      csvLines.push(row.join(','));
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial_statement_${statementType}_${datePreset}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Financial Statements &amp; Custom Date-to-Date Generator</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generate custom date-to-date statements (mixed, income-only, expense-only, or account-specific) with instant export.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Statement Configuration & Date Controls Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
          <Filter className="w-4 h-4 text-emerald-500" />
          <span>Statement Parameters &amp; Time Window</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Statement Type */}
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Statement Mode
            </label>
            <select
              value={statementType}
              onChange={(e) => setStatementType(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="mix">All In-Out (Mixed Statement)</option>
              <option value="income">Inflows Only (Income Statement)</option>
              <option value="expense">Outflows Only (Expense Statement)</option>
              <option value="transfers">Transfers &amp; Allocations</option>
              <option value="account">Account-Specific Ledger</option>
              <option value="category">Category-Specific Breakdown</option>
            </select>
          </div>

          {/* 2. Date Preset */}
          <div>
            <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Time Period
            </label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="all">All Available Records</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Fiscal Year</option>
              <option value="custom">Custom Date-to-Date...</option>
            </select>
          </div>

          {/* Conditional Account Select */}
          {statementType === 'account' && (
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Filter Specific Account
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="">All Accounts</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional Category Select */}
          {statementType === 'category' && (
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Filter Specific Category
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name} ({cat.type})</option>
                ))}
              </select>
            </div>
          )}

          {/* Historical / Previous DB Toggle */}
          <div className="flex items-center gap-2 pt-6">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHistorical}
                onChange={(e) => setIncludeHistorical(e.target.checked)}
                className="rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="flex items-center gap-1">
                <History className="w-3.5 h-3.5 text-amber-500" />
                <span>Include Prior Period / Previous DB Entries</span>
              </span>
            </label>
          </div>
        </div>

        {/* Date From & Date To Custom Pickers */}
        {datePreset === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                From Date (Start)
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                To Date (End)
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Aggregate Statement Summary Cards (Pure DB calculations) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-2xs font-semibold uppercase text-slate-500 block mb-1">
            Total Period Inflow
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            +{formatMoney(totalInflow)}
          </div>
          <span className="text-2xs text-slate-400 mt-1 block">Revenue, deposits &amp; recoveries</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-2xs font-semibold uppercase text-slate-500 block mb-1">
            Total Period Outflow
          </span>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
            -{formatMoney(totalOutflow)}
          </div>
          <span className="text-2xs text-slate-400 mt-1 block">Living expenses &amp; repayments</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-2xs font-semibold uppercase text-slate-500 block mb-1">
            Net Cashflow Position
          </span>
          <div className={`text-2xl font-bold font-mono tabular-nums ${
            netPosition >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {netPosition >= 0 ? `+${formatMoney(netPosition)}` : formatMoney(netPosition)}
          </div>
          <span className="text-2xs text-slate-400 mt-1 block">
            {netPosition >= 0 ? 'Surplus retained' : 'Deficit / Over-outflow'}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-2xs font-semibold uppercase text-slate-500 block mb-1">
            Active Statement Rows
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {statementRows.length} Rows
          </div>
          <span className="text-2xs text-slate-400 mt-1 block">
            Savings Rate: {savingsRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* View Switcher: Table Statement vs Velocity Chart */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('statement')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'statement'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Statement Ledger Table ({statementRows.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('chart')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'chart'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Monthly Cashflow Chart</span>
        </button>
      </div>

      {/* Tab 1: Detailed Statement Table */}
      {activeTab === 'statement' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-2xs uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-4">Description / Memo</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Account</th>
                  <th className="py-3 px-3">Counterparty</th>
                  <th className="py-3 px-3">Flag</th>
                  <th className="py-3 px-4 text-right">Inflow (+)</th>
                  <th className="py-3 px-4 text-right">Outflow (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {statementRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No financial records match the selected statement parameters and date range.
                    </td>
                  </tr>
                ) : (
                  statementRows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">
                        #{row.entryNumber}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        <div>{row.memo}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {row.categoryName}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        {row.accountName}
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {row.counterparty || '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.isHistorical ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                            <History className="w-3 h-3 text-amber-600" />
                            <span>Previous DB</span>
                          </span>
                        ) : (
                          <span className="text-3xs text-slate-400 font-mono">Current</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                        {row.inflow > 0 ? `+${formatMoney(row.inflow)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums whitespace-nowrap">
                        {row.outflow > 0 ? `-${formatMoney(row.outflow)}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Monthly Cashflow Chart */}
      {activeTab === 'chart' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Monthly Inflow vs Outflow Velocity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visualizing operating cash conservation across time periods.
              </p>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
              No transaction history available in this range to plot chart.
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="period" fontSize={11} stroke="#94a3b8" />
                  <YAxis fontSize={11} stroke="#94a3b8" tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(val: any) => formatMoney(Number(val) || 0)} 
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="inflow" name="Total Inflow" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflow" name="Total Outflow" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
