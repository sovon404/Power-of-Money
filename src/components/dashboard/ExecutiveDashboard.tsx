import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  Building2, 
  HandCoins, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { NavItemKey } from '../layout/Sidebar';
import { AccountsLiveCockpit } from './AccountsLiveCockpit';

interface ExecutiveDashboardProps {
  onNavigate: (view: NavItemKey) => void;
  onOpenNewTransaction: () => void;
  onOpenAiScan: () => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  onNavigate,
  onOpenNewTransaction,
  onOpenAiScan,
}) => {
  const { currentWorkspace, formatMoney } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const cards = db.getCreditCards(workspaceId);
  const loans = db.getLoans(workspaceId);
  const properties = db.getProperties(workspaceId);
  const journalEntries = db.getJournalEntries(workspaceId);

  // Financial Engine Computations
  // 1. Liquid Assets: cash, bank, mfs
  const liquidAssets = accounts
    .filter(a => ['cash', 'bank', 'mfs'].includes(a.account_type_id))
    .reduce((sum, a) => sum + a.current_balance_cached, 0);

  // 2. Savings, DPS & Investments
  const savingsAndInvestments = accounts
    .filter(a => ['savings_dps', 'investment'].includes(a.account_type_id))
    .reduce((sum, a) => sum + a.current_balance_cached, 0);

  // 3. Receivables (Money lent to others)
  const moneyLent = loans
    .filter(l => l.type === 'lent' && l.status === 'active')
    .reduce((sum, l) => sum + (l.principal_amount - l.total_principal_repaid), 0);

  // 4. Properties Market Value (ownership adjusted)
  const propertyAssets = properties
    .filter(p => p.status !== 'sold')
    .reduce((sum, p) => {
      const sharePct = (p.normalized_ownership_percentage ?? 100) / 100;
      return sum + (p.current_market_valuation * sharePct);
    }, 0);

  const totalAssets = liquidAssets + savingsAndInvestments + moneyLent + propertyAssets;

  // 5. Liabilities: Credit Cards + Loans Borrowed
  const cardLiabilities = accounts
    .filter(a => a.account_type_id === 'credit_card')
    .reduce((sum, a) => sum + a.current_balance_cached, 0);

  const borrowedLoans = loans
    .filter(l => l.type === 'borrowed' && l.status === 'active')
    .reduce((sum, l) => sum + (l.principal_amount - l.total_principal_repaid), 0);

  const totalLiabilities = cardLiabilities + borrowedLoans;

  // 6. Net Worth = Total Assets - Total Liabilities
  const netWorth = totalAssets - totalLiabilities;

  // 7. This Month's Income & Expenses derived from double-entry ledger lines
  const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g. '2026-10'
  let monthlyIncome = 0;
  let monthlyExpense = 0;

  journalEntries.forEach(entry => {
    if (entry.status === 'posted' && entry.entry_date.startsWith(currentMonthStr)) {
      entry.lines?.forEach(line => {
        if (line.category_id) {
          // Categorized line
          if (line.line_type === 'debit') {
            monthlyExpense += line.amount;
          } else if (line.line_type === 'credit') {
            monthlyIncome += line.amount;
          }
        }
      });
    }
  });

  return (
    <div className="space-y-6">
      {/* 1. Accounts & Wallets Live Financial Cockpit (Upper-side of dashboard as requested) */}
      <AccountsLiveCockpit
        onNavigateAccounts={() => onNavigate('accounts')}
        onNavigateIncome={() => onNavigate('income')}
        onNavigateCards={() => onNavigate('cards')}
      />

      {/* Top Welcome & KPI Metric Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Worth Card */}
        <motion.div 
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/20 shadow-sm hover:shadow-md hover:shadow-emerald-500/5 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Net Worth (Equity)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
            {formatMoney(netWorth)}
          </div>
          <div className="mt-2 text-2xs text-slate-500 dark:text-slate-400">
            Assets: <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{formatMoney(totalAssets)}</span> · Liab: <span className="font-mono font-medium text-rose-600 dark:text-rose-400">{formatMoney(totalLiabilities)}</span>
          </div>
        </motion.div>

        {/* Liquid Cash & Bank */}
        <motion.div 
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-500/20 dark:border-blue-500/20 shadow-sm hover:shadow-md hover:shadow-blue-500/5 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Liquid Cash &amp; MFS
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
            {formatMoney(liquidAssets)}
          </div>
          <div className="mt-2 text-2xs text-slate-500 dark:text-slate-400">
            Cash, bKash, Nagad, and Checking
          </div>
        </motion.div>

        {/* Total Debt & Liabilities */}
        <motion.div 
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-500/20 dark:border-rose-500/20 shadow-sm hover:shadow-md hover:shadow-rose-500/5 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Liabilities
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
            {formatMoney(totalLiabilities)}
          </div>
          <div className="mt-2 text-2xs text-slate-500 dark:text-slate-400">
            Card Dues: <span className="font-mono">{formatMoney(cardLiabilities)}</span> · Loans: <span className="font-mono">{formatMoney(borrowedLoans)}</span>
          </div>
        </motion.div>

        {/* Money Lent (Receivables) */}
        <motion.div 
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/20 dark:border-amber-500/20 shadow-sm hover:shadow-md hover:shadow-amber-500/5 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Money Lent (Receivables)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <HandCoins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
            {formatMoney(moneyLent)}
          </div>
          <div className="mt-2 text-2xs text-slate-500 dark:text-slate-400">
            To be collected from borrowers
          </div>
        </motion.div>
      </div>

      {/* Monthly Cash Flow & Quick Accounts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Monthly Cash Flow & Ledger Summary */}
        <div className="lg:col-span-2 space-y-6">
          {/* Monthly Inflow vs Outflow Banner */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Monthly Operating Cash Flow
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Transfers, loan principal, and investments are excluded from expenses.
                </p>
              </div>
              <button
                onClick={onOpenNewTransaction}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Entry</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                  <ArrowDownRight className="w-4 h-4" />
                  <span>Operating Inflow</span>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatMoney(monthlyIncome)}
                </div>
                <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                  Salary, returns &amp; earned income
                </div>
              </div>

              <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Operating Outflow</span>
                </div>
                <div className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400 tabular-nums">
                  {formatMoney(monthlyExpense)}
                </div>
                <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                  Living costs, utilities &amp; charges
                </div>
              </div>
            </div>
          </div>

          {/* Recent Ledger Transactions */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Recent Ledger Entries
              </h3>
              <button
                onClick={() => onNavigate('ledger')}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                View Complete Ledger &rarr;
              </button>
            </div>

            {journalEntries.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <Plus className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium">No ledger transactions posted yet.</p>
                <button
                  onClick={onOpenNewTransaction}
                  className="mt-3 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-500"
                >
                  Record your first transaction
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="pb-2.5">Date</th>
                      <th className="pb-2.5">Description</th>
                      <th className="pb-2.5">Type</th>
                      <th className="pb-2.5 text-right">Debit / Credit</th>
                      <th className="pb-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {journalEntries.slice(0, 5).map(entry => {
                      const totalAmount = entry.lines?.reduce((sum, l) => sum + (l.line_type === 'debit' ? l.amount : 0), 0) || 0;
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {entry.entry_date}
                          </td>
                          <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                            {entry.memo}
                          </td>
                          <td className="py-2.5 text-slate-500 dark:text-slate-400 capitalize">
                            {entry.source_type.replace('_', ' ')}
                          </td>
                          <td className="py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap tabular-nums">
                            {formatMoney(totalAmount)}
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${
                              entry.status === 'posted'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}>
                              {entry.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Account Balances & Quick Modules */}
        <div className="space-y-6">
          {/* Accounts Summary Box */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Accounts &amp; Wallets
              </h3>
              <button
                onClick={() => onNavigate('accounts')}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Manage &rarr;
              </button>
            </div>

            <div className="space-y-3">
              {accounts.map(acc => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 text-white"
                      style={{ backgroundColor: acc.color }}
                    >
                      {acc.provider.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {acc.name}
                      </div>
                      <div className="text-2xs text-slate-400 dark:text-slate-500">
                        {acc.provider} {acc.account_number_masked ? `· ${acc.account_number_masked}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-bold font-mono text-slate-900 dark:text-white tabular-nums shrink-0 ml-2">
                    {formatMoney(acc.current_balance_cached)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Properties Overview */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Property Portfolio
                </h3>
              </div>
              <button
                onClick={() => onNavigate('properties')}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Details &rarr;
              </button>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums mb-1">
              {formatMoney(propertyAssets)}
            </div>
            <div className="text-2xs text-slate-500 dark:text-slate-400">
              {properties.length} registered properties (Khara, Ana, Shares)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
