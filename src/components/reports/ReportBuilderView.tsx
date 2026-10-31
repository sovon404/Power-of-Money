import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  Filter, 
  Calendar, 
  FileSpreadsheet, 
  PieChart as PieIcon, 
  TrendingUp, 
  ShieldCheck 
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';

export const ReportBuilderView: React.FC = () => {
  const { currentWorkspace, formatMoney } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId);
  const categories = db.getCategories(workspaceId);
  const entries = db.getJournalEntries(workspaceId);
  const loans = db.getLoans(workspaceId);
  const properties = db.getProperties(workspaceId);

  const [dateRange, setDateRange] = useState<'this_month' | 'last_month' | 'this_year' | 'all'>('this_month');
  const [reportType, setReportType] = useState<'income_expense' | 'net_worth' | 'cash_flow' | 'category_breakdown'>('income_expense');

  // Compute metrics based on date range
  const now = new Date();
  const thisMonthPrefix = now.toISOString().slice(0, 7);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthPrefix = lastMonthDate.toISOString().slice(0, 7);
  const thisYearPrefix = now.getFullYear().toString();

  const isEntryInRange = (entryDate: string) => {
    if (dateRange === 'this_month') return entryDate.startsWith(thisMonthPrefix);
    if (dateRange === 'last_month') return entryDate.startsWith(lastMonthPrefix);
    if (dateRange === 'this_year') return entryDate.startsWith(thisYearPrefix);
    return true;
  };

  let totalIncome = 0;
  let totalExpense = 0;
  const categorySummary: Record<string, { name: string; amount: number; type: string }> = {};

  entries.forEach(entry => {
    if (entry.status === 'posted' && isEntryInRange(entry.entry_date)) {
      entry.lines?.forEach(line => {
        if (line.category_id) {
          const cat = categories.find(c => c.id === line.category_id);
          const catName = cat?.name || 'Uncategorized';
          if (!categorySummary[line.category_id]) {
            categorySummary[line.category_id] = { name: catName, amount: 0, type: line.line_type };
          }
          categorySummary[line.category_id].amount += line.amount;

          if (line.line_type === 'debit') {
            totalExpense += line.amount;
          } else {
            totalIncome += line.amount;
          }
        }
      });
    }
  });

  const netSavings = totalIncome - totalExpense;

  // Assets & Liabilities Breakdown
  const liquidAssets = accounts
    .filter(a => ['cash', 'bank', 'mfs'].includes(a.account_type_id))
    .reduce((s, a) => s + a.current_balance_cached, 0);

  const savingsInvestments = accounts
    .filter(a => ['savings_dps', 'investment'].includes(a.account_type_id))
    .reduce((s, a) => s + a.current_balance_cached, 0);

  const moneyLent = loans
    .filter(l => l.type === 'lent' && l.status === 'active')
    .reduce((s, l) => s + (l.principal_amount - l.total_principal_repaid), 0);

  const propertyVal = properties
    .filter(p => p.status !== 'sold')
    .reduce((s, p) => s + (p.current_market_valuation * ((p.normalized_ownership_percentage ?? 100) / 100)), 0);

  const totalAssets = liquidAssets + savingsInvestments + moneyLent + propertyVal;

  const cardLiab = accounts
    .filter(a => a.account_type_id === 'credit_card')
    .reduce((s, a) => s + a.current_balance_cached, 0);

  const loanDebt = loans
    .filter(l => l.type === 'borrowed' && l.status === 'active')
    .reduce((s, l) => s + (l.principal_amount - l.total_principal_repaid), 0);

  const totalLiabilities = cardLiab + loanDebt;
  const netWorth = totalAssets - totalLiabilities;

  // CSV Export Function
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Transaction Number,Date,Description,Source Type,Status,Debit Total,Credit Total\n';

    entries.forEach(e => {
      const dTotal = e.lines?.reduce((s, l) => s + (l.line_type === 'debit' ? l.amount : 0), 0) || 0;
      const cTotal = e.lines?.reduce((s, l) => s + (l.line_type === 'credit' ? l.amount : 0), 0) || 0;
      const safeMemo = `"${e.memo.replace(/"/g, '""')}"`;
      csvContent += `${e.entry_number},${e.entry_date},${safeMemo},${e.source_type},${e.status},${dTotal},${cTotal}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `power_of_money_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Financial Reports &amp; Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Audit-grade double-entry financial statements and category spending breakdowns.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white shadow-xs transition-colors self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Ledger (CSV)</span>
        </button>
      </div>

      {/* Date Range & Report Tabs Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setReportType('income_expense')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              reportType === 'income_expense'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Income &amp; Expense
          </button>
          <button
            onClick={() => setReportType('net_worth')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              reportType === 'net_worth'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Balance Sheet / Net Worth
          </button>
          <button
            onClick={() => setReportType('category_breakdown')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              reportType === 'category_breakdown'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Category Spending
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={dateRange}
            onChange={(e: any) => setDateRange(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="this_month">Current Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">Current Year</option>
            <option value="all">All-Time Historical</option>
          </select>
        </div>
      </div>

      {/* Report 1: Income vs Expense Statement */}
      {reportType === 'income_expense' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Earned Inflow</span>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums my-1">
                {formatMoney(totalIncome)}
              </div>
              <span className="text-2xs text-slate-400">Excludes borrowed principal and returned loans</span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Operating Outflow</span>
              <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums my-1">
                {formatMoney(totalExpense)}
              </div>
              <span className="text-2xs text-slate-400">Excludes loan principal repayments and transfers</span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Net Operating Surplus</span>
              <div className={`text-2xl font-bold font-mono tabular-nums my-1 ${
                netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {formatMoney(netSavings)}
              </div>
              <span className="text-2xs text-slate-400">Net addition to workspace equity</span>
            </div>
          </div>
        </div>
      )}

      {/* Report 2: Balance Sheet / Net Worth Statement */}
      {reportType === 'net_worth' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Assets Column */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Total Assets
              </h3>
              <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatMoney(totalAssets)}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Liquid Cash, Bank &amp; MFS</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">{formatMoney(liquidAssets)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">DPS &amp; Term Investments</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">{formatMoney(savingsInvestments)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Money Lent (Receivables)</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">{formatMoney(moneyLent)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600 dark:text-slate-400">Property Portfolio (Share-Adjusted)</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">{formatMoney(propertyVal)}</span>
              </div>
            </div>
          </div>

          {/* Liabilities Column */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Total Liabilities &amp; Equity
              </h3>
              <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                {formatMoney(totalLiabilities)}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Credit Card Liabilities</span>
                <span className="font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{formatMoney(cardLiab)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Loan &amp; Debt Principal</span>
                <span className="font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{formatMoney(loanDebt)}</span>
              </div>
              <div className="flex justify-between py-2 mt-4 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                <span className="font-bold text-emerald-800 dark:text-emerald-300">Net Workspace Equity</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm tabular-nums">{formatMoney(netWorth)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report 3: Category Spending Breakdown */}
      {reportType === 'category_breakdown' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Spending Across Categorized Entries
          </h3>

          <div className="space-y-3">
            {Object.keys(categorySummary).length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No categorized spending in the selected period.
              </div>
            ) : (
              Object.entries(categorySummary).map(([catId, data]) => {
                const pct = totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0;
                return (
                  <div key={catId} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800 dark:text-slate-200">{data.name}</span>
                      <span className="font-mono text-slate-900 dark:text-white tabular-nums">
                        {formatMoney(data.amount)} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
