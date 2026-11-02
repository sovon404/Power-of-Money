import React, { useState, useEffect } from 'react';
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
  Plus,
  Sliders,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  RotateCcw,
  X,
  PiggyBank,
  PieChart,
  Check,
  Layers,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { NavItemKey } from '../layout/Sidebar';
import { AccountsLiveCockpit } from './AccountsLiveCockpit';
import { DashboardWidgetConfig, DashboardWidgetId } from '../../types';
import { toUuid } from '../../lib/uuid';

interface ExecutiveDashboardProps {
  onNavigate: (view: NavItemKey) => void;
  onOpenNewTransaction: () => void;
  onOpenAiScan: () => void;
}

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'cockpit', title: 'Accounts & Wallets Live Cockpit', description: 'Liquid wallets, savings funds, obligations and dynamic subtotals', visible: true, order: 1 },
  { id: 'kpi_metrics', title: 'Financial Position KPIs', description: 'Net Worth, Liquid Assets, Debt Obligations, and Money Lent', visible: true, order: 2 },
  { id: 'cash_flow', title: 'Monthly Operating Cash Flow', description: 'Current month operating inflow vs outflow and quick entry', visible: true, order: 3 },
  { id: 'recent_transactions', title: 'Recent Ledger Entries', description: 'Real-time posted double-entry journal records', visible: true, order: 4 },
  { id: 'accounts_list', title: 'Accounts & Wallets Directory', description: 'Comprehensive list of all cash, bank and mobile accounts', visible: true, order: 5 },
  { id: 'property_portfolio', title: 'Property & Land Register', description: 'Real estate portfolio valuation and ownership partition', visible: true, order: 6 },
  { id: 'savings_goals', title: 'DPS & Savings Goals Tracker', description: 'Active deposit schemes, target balances and live progress', visible: true, order: 7 },
  { id: 'credit_cards', title: 'Credit Cards & Statements', description: 'Registered credit cards, statement dues and limit utilization', visible: true, order: 8 },
  { id: 'loans_summary', title: 'Loans & Receivables Tracker', description: 'Active debt obligations and money lent out to collect', visible: true, order: 9 },
  { id: 'budgets', title: 'Monthly Budgets Progress', description: 'Category spending caps vs actual ledger outflow', visible: true, order: 10 },
];

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  onNavigate,
  onOpenNewTransaction,
  onOpenAiScan,
}) => {
  const { currentWorkspace, formatMoney, updateWorkspaceSettings } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  // 1. Load customizable widgets from workspace settings with localStorage fallback
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(() => {
    try {
      if (currentWorkspace?.settings?.dashboardWidgets && currentWorkspace.settings.dashboardWidgets.length > 0) {
        return currentWorkspace.settings.dashboardWidgets;
      }
      const saved = localStorage.getItem(`pom_dashboard_widgets_${workspaceId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_WIDGETS;
  });

  useEffect(() => {
    if (currentWorkspace?.settings?.dashboardWidgets && currentWorkspace.settings.dashboardWidgets.length > 0) {
      setWidgets(currentWorkspace.settings.dashboardWidgets);
    } else {
      try {
        const saved = localStorage.getItem(`pom_dashboard_widgets_${workspaceId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWidgets(parsed);
            return;
          }
        }
      } catch {
        // fallback
      }
      setWidgets(DEFAULT_WIDGETS);
    }
  }, [workspaceId, currentWorkspace?.settings?.dashboardWidgets]);

  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);

  // Save updated widget configuration to local state, localStorage, and Supabase via WorkspaceContext
  const saveWidgetsConfig = (updatedWidgets: DashboardWidgetConfig[]) => {
    setWidgets(updatedWidgets);
    try {
      localStorage.setItem(`pom_dashboard_widgets_${workspaceId}`, JSON.stringify(updatedWidgets));
    } catch (e) {
      console.warn('Failed to save widgets locally:', e);
    }
    updateWorkspaceSettings({
      dashboardWidgets: updatedWidgets,
    });
  };

  const toggleWidgetVisibility = (id: DashboardWidgetId) => {
    const updated = widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    saveWidgetsConfig(updated);
  };

  const hideWidget = (id: DashboardWidgetId) => {
    const updated = widgets.map(w => w.id === id ? { ...w, visible: false } : w);
    saveWidgetsConfig(updated);
  };

  const moveWidget = (id: DashboardWidgetId, direction: 'up' | 'down') => {
    const sorted = [...widgets].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(w => w.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = sorted[index].order;
    sorted[index].order = sorted[targetIndex].order;
    sorted[targetIndex].order = temp;

    // re-normalize order 1..N
    const normalized = sorted.sort((a, b) => a.order - b.order).map((w, idx) => ({ ...w, order: idx + 1 }));
    saveWidgetsConfig(normalized);
  };

  const resetWidgets = () => {
    saveWidgetsConfig(DEFAULT_WIDGETS);
  };

  const showAllWidgets = () => {
    const updated = widgets.map(w => ({ ...w, visible: true }));
    saveWidgetsConfig(updated);
  };

  // Financial Engine Computations strictly from Database
  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const cards = db.getCreditCards(workspaceId);
  const loans = db.getLoans(workspaceId);
  const properties = db.getProperties(workspaceId);
  const journalEntries = db.getJournalEntries(workspaceId);
  const savingsGoals = db.getSavingsGoals(workspaceId);
  const budgets = db.getBudgets(workspaceId);

  // 1. Liquid Assets: cash, bank, mfs
  const liquidAssets = accounts
    .filter(a => ['cash', 'bank', 'mfs'].includes(a.account_type_id))
    .reduce((sum, a) => sum + (Number(a.current_balance_cached) || 0), 0);

  // 2. Savings, DPS & Investments
  const savingsAndInvestments = accounts
    .filter(a => ['savings_dps', 'investment'].includes(a.account_type_id))
    .reduce((sum, a) => sum + (Number(a.current_balance_cached) || 0), 0);

  // 3. Receivables (Money lent to others)
  const moneyLent = loans
    .filter(l => l.type === 'lent' && l.status === 'active')
    .reduce((sum, l) => sum + Math.max(0, l.principal_amount - l.total_principal_repaid), 0);

  // 4. Properties Market Value (ownership adjusted)
  const propertyAssets = properties
    .filter(p => p.status !== 'sold')
    .reduce((sum, p) => {
      const sharePct = (p.normalized_ownership_percentage ?? 100) / 100;
      return sum + (p.current_market_valuation * sharePct);
    }, 0);

  const totalAssets = liquidAssets + savingsAndInvestments + moneyLent + propertyAssets;

  // 5. Liabilities: Credit Cards + Loans Borrowed
  const totalCardDues = cards.reduce((sum, c) => {
    const cardAcc = accounts.find(a => a.id === c.account_id);
    return sum + (cardAcc?.current_balance_cached || 0);
  }, 0);

  const cardLiabilities = totalCardDues > 0 
    ? totalCardDues 
    : accounts
        .filter(a => a.account_type_id === 'credit_card')
        .reduce((sum, a) => sum + (Number(a.current_balance_cached) || 0), 0);

  const borrowedLoans = loans
    .filter(l => l.type === 'borrowed' && l.status === 'active')
    .reduce((sum, l) => sum + Math.max(0, l.principal_amount - l.total_principal_repaid), 0);

  const totalLiabilities = cardLiabilities + borrowedLoans;

  // 6. Net Worth = Total Assets - Total Liabilities
  const netWorth = totalAssets - totalLiabilities;

  // 7. This Month's Income & Expenses derived from double-entry ledger lines
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  let monthlyIncome = 0;
  let monthlyExpense = 0;

  const categories = db.getCategories(workspaceId);
  const incomeCategoryIds = new Set(categories.filter(c => c.type === 'income').map(c => c.id));
  const expenseCategoryIds = new Set(categories.filter(c => c.type === 'expense').map(c => c.id));
  const defaultIncomeAccUuid = toUuid(`acc_income_earned_${workspaceId}`);
  const defaultExpenseAccUuid = toUuid(`acc_expense_operating_${workspaceId}`);

  journalEntries.forEach(entry => {
    if (entry.status !== 'posted') return;
    if (!entry.entry_date.startsWith(currentMonthStr)) return;
    if (entry.source_type === 'transfer' || entry.source_type === 'opening_balance') return;

    const lines = entry.lines || [];
    if (lines.length === 0) return;

    // Check if this entry is income
    const isIncome = lines.some(l => 
      (l.category_id && incomeCategoryIds.has(l.category_id)) ||
      (l.line_type === 'credit' && l.account_id === defaultIncomeAccUuid)
    );

    // Check if this entry is expense
    const isExpense = lines.some(l => 
      (l.category_id && expenseCategoryIds.has(l.category_id)) ||
      (l.line_type === 'debit' && l.account_id === defaultExpenseAccUuid)
    );

    if (isIncome && !isExpense) {
      const incLine = lines.find(l => l.account_id === defaultIncomeAccUuid) ||
                      lines.find(l => l.category_id && incomeCategoryIds.has(l.category_id)) ||
                      lines[0];
      monthlyIncome += incLine?.amount || 0;
    } else if (isExpense) {
      const expLine = lines.find(l => l.account_id === defaultExpenseAccUuid) ||
                      lines.find(l => l.category_id && expenseCategoryIds.has(l.category_id)) ||
                      lines[0];
      monthlyExpense += expLine?.amount || 0;
    }
  });

  const activeWidgets = [...widgets].filter(w => w.visible).sort((a, b) => a.order - b.order);
  const hiddenWidgetsCount = widgets.filter(w => !w.visible).length;

  return (
    <div className="space-y-6">
      {/* Top Action Bar: Dashboard Customization Authority */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Dashboard Customization Authority
          </span>
          <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {activeWidgets.length} Active {hiddenWidgetsCount > 0 ? `· ${hiddenWidgetsCount} Hidden` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hiddenWidgetsCount > 0 && (
            <button
              onClick={showAllWidgets}
              className="px-3 py-1.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
            >
              Restore All ({hiddenWidgetsCount})
            </button>
          )}

          <button
            onClick={() => setIsCustomizeModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Customize Widgets &amp; Layout</span>
          </button>
        </div>
      </div>

      {/* Render Dynamic Widgets in User's Custom Sequence */}
      {activeWidgets.map(widget => {
        // 1. Cockpit Widget
        if (widget.id === 'cockpit') {
          return (
            <div key={widget.id} className="relative group">
              <AccountsLiveCockpit
                onNavigateAccounts={() => onNavigate('accounts')}
                onNavigateIncome={() => onNavigate('income')}
                onNavigateCards={() => onNavigate('cards')}
                onNavigateLoans={() => onNavigate('loans')}
                onNavigateSavings={() => onNavigate('savings')}
                onRemoveWidget={() => hideWidget('cockpit')}
              />
            </div>
          );
        }

        // 2. Financial Position KPIs
        if (widget.id === 'kpi_metrics') {
          return (
            <div key={widget.id} className="space-y-2">
              <div className="flex items-center justify-between text-2xs text-slate-400 px-1">
                <span className="font-semibold uppercase tracking-wider">Financial Health &amp; Position Overview</span>
                <button
                  onClick={() => hideWidget('kpi_metrics')}
                  className="hover:text-rose-500 transition-colors"
                  title="Hide this widget"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Net Worth */}
                <motion.div 
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/20 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Net Worth (Equity)</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
                    {formatMoney(netWorth)}
                  </div>
                  <div className="mt-2 text-2xs text-slate-500">
                    Assets: <span className="font-mono text-emerald-600">{formatMoney(totalAssets)}</span> · Liab: <span className="font-mono text-rose-600">{formatMoney(totalLiabilities)}</span>
                  </div>
                </motion.div>

                {/* Liquid Cash & MFS */}
                <motion.div 
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-500/20 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Liquid Cash &amp; MFS</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
                    {formatMoney(liquidAssets)}
                  </div>
                  <div className="mt-2 text-2xs text-slate-500">
                    Physical Cash, bKash, Nagad, Bank
                  </div>
                </motion.div>

                {/* Total Debt & Liabilities */}
                <motion.div 
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-500/20 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Total Liabilities</span>
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                      <CreditCard className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold font-mono tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatMoney(totalLiabilities)}
                  </div>
                  <div className="mt-2 text-2xs text-slate-500">
                    Card Dues: <span className="font-mono">{formatMoney(cardLiabilities)}</span> · Loans: <span className="font-mono">{formatMoney(borrowedLoans)}</span>
                  </div>
                </motion.div>

                {/* Money Lent (Receivables) */}
                <motion.div 
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/20 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Money Lent (Receivables)</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                      <HandCoins className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
                    {formatMoney(moneyLent)}
                  </div>
                  <div className="mt-2 text-2xs text-slate-500">
                    {loans.filter(l => l.type === 'lent' && l.status === 'active').length} active receivables to collect
                  </div>
                </motion.div>
              </div>
            </div>
          );
        }

        // 3. Monthly Operating Cash Flow
        if (widget.id === 'cash_flow') {
          return (
            <div key={widget.id} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Monthly Operating Cash Flow
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Current month double-entry income vs living expenditures
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onOpenNewTransaction}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Entry</span>
                  </button>
                  <button
                    onClick={() => hideWidget('cash_flow')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Hide widget"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
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
          );
        }

        // 4. Recent Ledger Entries
        if (widget.id === 'recent_transactions') {
          return (
            <div key={widget.id} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Recent Ledger Entries
                  </h3>
                  <p className="text-2xs text-slate-500">Atomic journal transactions posted across accounts</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onNavigate('ledger')}
                    className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    View Ledger &rarr;
                  </button>
                  <button
                    onClick={() => hideWidget('recent_transactions')}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Hide widget"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {journalEntries.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <p className="text-xs font-medium">No ledger transactions posted yet.</p>
                  <button
                    onClick={onOpenNewTransaction}
                    className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-500"
                  >
                    Record your first transaction &rarr;
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
                        <th className="pb-2.5 text-right">Amount</th>
                        <th className="pb-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {journalEntries.slice(0, 5).map(entry => {
                        const totalAmount = entry.lines?.reduce((sum, l) => sum + (l.line_type === 'debit' ? l.amount : 0), 0) || 0;
                        return (
                          <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 font-mono text-slate-500 whitespace-nowrap text-xs">
                              <div>{entry.entry_date}</div>
                              {entry.period_end_date && (
                                <div className="text-3xs text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                                  → {entry.period_end_date}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">{entry.memo}</td>
                            <td className="py-2.5 text-slate-500 capitalize">{entry.source_type.replace('_', ' ')}</td>
                            <td className="py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">{formatMoney(totalAmount)}</td>
                            <td className="py-2.5 text-right">
                              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
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
          );
        }

        // 5. Accounts & Wallets Directory
        if (widget.id === 'accounts_list') {
          return (
            <div key={widget.id} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Accounts &amp; Wallets Directory
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onNavigate('accounts')}
                    className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Manage &rarr;
                  </button>
                  <button
                    onClick={() => hideWidget('accounts_list')}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Hide widget"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {accounts.map(acc => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div 
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-2xs shrink-0 text-white"
                        style={{ backgroundColor: acc.color }}
                      >
                        {acc.provider.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{acc.name}</div>
                        <div className="text-2xs text-slate-400">{acc.provider}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold font-mono text-slate-900 dark:text-white tabular-nums shrink-0 ml-2">
                      {formatMoney(acc.current_balance_cached)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // 6. Property Portfolio
        if (widget.id === 'property_portfolio') {
          return (
            <div key={widget.id} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Property Register &amp; Land Portfolio
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onNavigate('properties')}
                    className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Portfolio Details &rarr;
                  </button>
                  <button
                    onClick={() => hideWidget('property_portfolio')}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Hide widget"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums mb-1">
                {formatMoney(propertyAssets)}
              </div>
              <div className="text-2xs text-slate-500">
                {properties.length} properties registered (Khara, Ana &amp; Shares partition)
              </div>
            </div>
          );
        }

        // 7. Savings Goals & DPS Tracker
        if (widget.id === 'savings_goals') {
          return (
            <div key={widget.id} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-4 h-4 text-teal-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    DPS &amp; Savings Goals Tracker
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onNavigate('savings')}
                    className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    View All Goals &rarr;
                  </button>
                  <button
                    onClick={() => hideWidget('savings_goals')}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Hide widget"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {savingsGoals.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">
                  <span>No savings goals configured yet.</span>
                  <button onClick={() => onNavigate('savings')} className="ml-2 font-semibold text-teal-600 underline">
                    Set a goal
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {savingsGoals.slice(0, 3).map(g => {
                    const pct = Math.min(100, Math.round(((g.current_saved_amount || 0) / (g.target_amount || 1)) * 100));
                    return (
                      <div key={g.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                          <span className="truncate">{g.name}</span>
                          <span className="font-mono text-teal-600">{pct}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-2xs text-slate-500 font-mono">
                          <span>{formatMoney(g.current_saved_amount)}</span>
                          <span>Target: {formatMoney(g.target_amount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        // 8. Credit Cards & Dues
        if (widget.id === 'credit_cards') {
          return (
            <div key={widget.id} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-rose-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Credit Cards &amp; Dues
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onNavigate('cards')}
                    className="text-xs font-medium text-rose-600 hover:underline"
                  >
                    Card In-Out &rarr;
                  </button>
                  <button
                    onClick={() => hideWidget('credit_cards')}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Hide widget"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {cards.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">
                  <span>No credit cards registered yet.</span>
                  <button onClick={() => onNavigate('cards')} className="ml-2 font-semibold text-rose-600 underline">
                    Add Credit Card
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cards.map(c => {
                    const cardAcc = accounts.find(a => a.id === c.account_id);
                    const outstandingBalance = cardAcc?.current_balance_cached || 0;
                    return (
                      <div key={c.id} className="p-3.5 rounded-xl bg-rose-50/30 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                          <span>{c.card_name}</span>
                          <span className="font-mono text-2xs text-slate-400">{c.issuing_bank}</span>
                        </div>
                        <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                          {formatMoney(outstandingBalance)}
                        </div>
                        <div className="text-2xs text-slate-500 font-mono">
                          Limit: {formatMoney(c.credit_limit)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        // 9. Loans & Receivables Tracker
        if (widget.id === 'loans_summary') {
          return (
            <div key={widget.id} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HandCoins className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Loans &amp; Debt Commitments
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onNavigate('loans')}
                    className="text-xs font-medium text-amber-600 hover:underline"
                  >
                    View All Loans &rarr;
                  </button>
                  <button
                    onClick={() => hideWidget('loans_summary')}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Hide widget"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-2xs font-semibold text-slate-500">Borrowed Obligations</span>
                  <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
                    {formatMoney(borrowedLoans)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-2xs font-semibold text-slate-500">Money Lent (Receivables)</span>
                  <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                    {formatMoney(moneyLent)}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // 10. Budgets Progress
        if (widget.id === 'budgets') {
          return (
            <div key={widget.id} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Monthly Budget Limits
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onNavigate('budgets')}
                    className="text-xs font-medium text-emerald-600 hover:underline"
                  >
                    Budgets Hub &rarr;
                  </button>
                  <button
                    onClick={() => hideWidget('budgets')}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Hide widget"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                {budgets.length} Category spending envelopes configured for this fiscal cycle.
              </p>
            </div>
          );
        }

        return null;
      })}

      {/* Persistent Add Widgets Callout if any widgets hidden */}
      {hiddenWidgetsCount > 0 && (
        <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-slate-400" />
            <span>{hiddenWidgetsCount} widgets are currently hidden from your dashboard.</span>
          </div>
          <button
            onClick={() => setIsCustomizeModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-2xs transition-colors cursor-pointer"
          >
            Manage Hidden Widgets &rarr;
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TOTAL DASHBOARD CUSTOMIZATION AUTHORITY           */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isCustomizeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl my-8"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Dashboard Customization Authority
                    </h3>
                    <p className="text-2xs text-slate-500">
                      Toggle, reorder, or remove any dashboard widget. Changes sync instantly to your database.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomizeModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 text-2xs">
                <button
                  type="button"
                  onClick={showAllWidgets}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  Show All Widgets
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const essentialIds: DashboardWidgetId[] = ['cockpit', 'kpi_metrics', 'cash_flow', 'recent_transactions'];
                    const updated = widgets.map(w => ({ ...w, visible: essentialIds.includes(w.id) }));
                    saveWidgetsConfig(updated);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Essential Only
                </button>
                <button
                  type="button"
                  onClick={resetWidgets}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors ml-auto flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Default</span>
                </button>
              </div>

              {/* Widgets List */}
              <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
                {[...widgets].sort((a, b) => a.order - b.order).map((w, index, arr) => (
                  <div
                    key={w.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      w.visible
                        ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 shadow-2xs'
                        : 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleWidgetVisibility(w.id)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          w.visible
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                        }`}
                        title={w.visible ? 'Click to hide widget' : 'Click to show widget'}
                      >
                        {w.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{w.title}</span>
                          {!w.visible && (
                            <span className="text-3xs font-semibold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 uppercase">
                              Hidden
                            </span>
                          )}
                        </div>
                        <p className="text-2xs text-slate-500 dark:text-slate-400">
                          {w.description}
                        </p>
                      </div>
                    </div>

                    {/* Order Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveWidget(w.id, 'up')}
                        title="Move Up"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === arr.length - 1}
                        onClick={() => moveWidget(w.id, 'down')}
                        title="Move Down"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setIsCustomizeModalOpen(false)}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  Done &amp; Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
