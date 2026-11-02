import React, { useState } from 'react';
import { 
  PieChart, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  DollarSign, 
  TrendingUp,
  Edit3,
  Trash2
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { Budget } from '../../types';
import { EditableSelect } from '../common/EditableSelect';
import { NumericInput } from '../common/NumericInput';

export const BudgetsView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const budgets = db.getBudgets(workspaceId);
  const categories = db.getCategories(workspaceId).filter(c => c.type === 'expense');
  const journalEntries = db.getJournalEntries(workspaceId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [budgetAmt, setBudgetAmt] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');

  // Edit Budget state
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editThreshold, setEditThreshold] = useState('80');

  const openEditBudgetModal = (b: Budget) => {
    setEditingBudget(b);
    setEditAmount(b.budget_amount.toString());
    setEditThreshold(b.alert_threshold_percentage.toString());
  };

  const handleSaveEditBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) return;

    const updated: Budget = {
      ...editingBudget,
      budget_amount: amt,
      alert_threshold_percentage: parseInt(editThreshold, 10) || 80,
    };

    db.saveBudget(updated);
    refreshData();
    setEditingBudget(null);
  };

  const handleDeleteBudget = (b: Budget) => {
    if (confirm('Are you sure you want to delete this category budget limit?')) {
      db.deleteBudget(b.id, workspaceId);
      refreshData();
    }
  };

  // Compute actual spending for current month for each category
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const categorySpendingMap: Record<string, number> = {};

  journalEntries.forEach(entry => {
    if (entry.status === 'posted' && entry.entry_date.startsWith(currentMonthStr)) {
      if (entry.source_type === 'transfer' || entry.source_type === 'opening_balance') return;
      entry.lines?.forEach(line => {
        if (line.category_id && line.line_type === 'debit') {
          const cat = categories.find(c => c.id === line.category_id);
          if (cat?.type === 'expense') {
            categorySpendingMap[line.category_id] = (categorySpendingMap[line.category_id] || 0) + line.amount;
          }
        }
      });
    }
  });

  const handleCreateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(budgetAmt);
    if (!selectedCatId || isNaN(amt) || amt <= 0) return;

    const startOfMonth = `${currentMonthStr}-01`;
    const endOfMonth = `${currentMonthStr}-28`;

    const newBudget: Budget = {
      id: 'bgt_' + Date.now(),
      workspace_id: workspaceId,
      category_id: selectedCatId,
      period_type: 'monthly',
      period_start: startOfMonth,
      period_end: endOfMonth,
      budget_amount: amt,
      alert_threshold_percentage: parseInt(alertThreshold, 10) || 80,
    };

    db.saveBudget(newBudget);
    refreshData();
    setShowAddModal(false);
    setSelectedCatId('');
    setBudgetAmt('');
  };

  const getCategoryName = (id: string) => {
    return categories.find(c => c.id === id)?.name || 'Category';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Budgets &amp; Spending Limits
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Set monthly category spending caps with proactive threshold warnings.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Set Category Budget</span>
          </button>
        )}
      </div>

      {/* Budgets Grid */}
      {budgets.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <PieChart className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No active budgets configured</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Keep track of living expenses like Food, Utilities, Transport, and Home Maintenance with monthly spending caps.
          </p>
          {canWrite && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Set First Budget
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map(bgt => {
            const actual = categorySpendingMap[bgt.category_id] || 0;
            const remaining = Math.max(0, bgt.budget_amount - actual);
            const pct = Math.min(100, Math.round((actual / bgt.budget_amount) * 100));
            const isWarning = pct >= bgt.alert_threshold_percentage;
            const isExceeded = actual > bgt.budget_amount;

            return (
              <div
                key={bgt.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-2xs uppercase tracking-wider font-bold text-slate-400">
                        Monthly Budget · {currentMonthStr}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {getCategoryName(bgt.category_id)}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${
                        isExceeded
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : isWarning
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}>
                        {isExceeded ? 'Exceeded' : `${pct}% Spent`}
                      </span>
                      {canWrite && (
                        <>
                          <button
                            onClick={() => openEditBudgetModal(bgt)}
                            title="Edit Budget Limit"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBudget(bgt)}
                            title="Delete Budget"
                            className="p-1 rounded-md text-rose-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 my-3 text-xs">
                    <div>
                      <span className="text-2xs text-slate-400 font-semibold uppercase block">
                        Actual Spent
                      </span>
                      <span className={`font-mono font-bold text-base tabular-nums ${
                        isExceeded ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                      }`}>
                        {formatMoney(actual)}
                      </span>
                    </div>

                    <div>
                      <span className="text-2xs text-slate-400 font-semibold uppercase block">
                        Limit Cap
                      </span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-base tabular-nums">
                        {formatMoney(bgt.budget_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="my-2">
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {isWarning && (
                    <div className="text-2xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-2 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Approaching limit (alert at {bgt.alert_threshold_percentage}%)</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500 mt-2">
                  <span>Remaining: <strong className="font-mono text-slate-700 dark:text-slate-300">{formatMoney(remaining)}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Set Category Budget
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expense Category
                </label>
                <EditableSelect
                  options={categories.map(c => ({ value: c.id, label: c.name }))}
                  value={selectedCatId}
                  onChange={setSelectedCatId}
                  placeholder="Select or add expense category..."
                  onAddNew={(name: string) => {
                    const newId = 'cat_' + Date.now();
                    db.saveCategory({
                      id: newId,
                      workspace_id: workspaceId,
                      name,
                      type: 'expense',
                      accounting_classification: 'expense_operating',
                      icon: 'tag',
                      color: '#ef4444',
                      is_seed: false,
                      is_archived: false,
                      sort_order: 999,
                    });
                    refreshData();
                    return newId;
                  }}
                  onEditSelected={(id: string, newName: string) => {
                    const cat = categories.find(c => c.id === id);
                    if (cat) {
                      db.saveCategory({ ...cat, name: newName });
                      refreshData();
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Limit ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <NumericInput
                    placeholder="15000"
                    value={budgetAmt}
                    onChange={(e) => setBudgetAmt(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Alert Threshold (%)
                  </label>
                  <NumericInput
                    allowDecimal={false}
                    maxLength={3}
                    placeholder="85"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Budget Modal */}
      {editingBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Category Budget
              </h3>
              <button
                onClick={() => setEditingBudget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBudget} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <div className="px-3 py-2 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                  {getCategoryName(editingBudget.category_id)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Limit ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <NumericInput
                    placeholder="15000"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Alert Threshold (%)
                  </label>
                  <NumericInput
                    allowDecimal={false}
                    maxLength={3}
                    placeholder="85"
                    value={editThreshold}
                    onChange={(e) => setEditThreshold(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (editingBudget) handleDeleteBudget(editingBudget);
                    setEditingBudget(null);
                  }}
                  className="px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  Delete Budget
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingBudget(null)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
