import React, { useState } from 'react';
import { 
  Repeat, 
  Plus, 
  Play, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Clock
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { RecurringRule } from '../../types';
import { NumericInput } from '../common/NumericInput';

export const RecurringBillsView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const rules = db.getRecurringRules(workspaceId);
  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const categories = db.getCategories(workspaceId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  // New Rule state
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name.trim() || isNaN(amt) || amt <= 0) return;

    const newRule: RecurringRule = {
      id: 'rule_' + Date.now(),
      workspace_id: workspaceId,
      name: name.trim(),
      rule_type: ruleType,
      amount: amt,
      currency: currentWorkspace?.currency || 'BDT',
      frequency,
      start_date: startDate,
      next_due_date: nextDueDate,
      source_account_id: sourceAccountId || undefined,
      category_id: categoryId || undefined,
      auto_post: false,
      is_active: true,
    };

    db.saveRecurringRule(newRule);
    refreshData();
    setShowAddModal(false);
    resetForm();
  };

  const handleExecuteNow = (rule: RecurringRule) => {
    const today = new Date().toISOString().split('T')[0];
    const occurrenceId = `${rule.id}_${today}`;

    // Post double entry entry idempotently
    const res = db.postJournalEntry(workspaceId, {
      memo: `Recurring: ${rule.name}`,
      source_type: 'recurring_execution',
      source_id: occurrenceId,
      entry_date: today,
      lines: [
        {
          account_id: rule.source_account_id || accounts[0]?.id || '',
          line_type: 'credit',
          amount: rule.amount,
          memo: `Payment for recurring ${rule.name}`,
        },
        {
          account_id: rule.source_account_id || accounts[0]?.id || '',
          line_type: 'debit',
          amount: rule.amount,
          memo: `Recurring schedule: ${rule.name}`,
          category_id: rule.category_id,
        },
      ],
    });

    if (res.success) {
      setExecutionMessage(`Successfully executed recurring bill for ${rule.name} (${formatMoney(rule.amount)}). Idempotency enforced.`);
      refreshData();
      setTimeout(() => setExecutionMessage(null), 3000);
    }
  };

  const resetForm = () => {
    setName('');
    setRuleType('expense');
    setAmount('');
    setFrequency('monthly');
    setSourceAccountId('');
    setCategoryId('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Recurring Transactions &amp; Bills
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Automate Wi-Fi, electricity, DPS installments, subscriptions, and reminders with idempotent protection.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Recurring Bill</span>
          </button>
        )}
      </div>

      {executionMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{executionMessage}</span>
        </div>
      )}

      {/* Rules Grid */}
      {rules.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <Repeat className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No recurring rules registered</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Schedule recurring living bills such as Wi-Fi, Electricity, Mess bills, or Gym memberships.
          </p>
          {canWrite && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Add Your First Recurring Bill
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rules.map(rule => (
            <div
              key={rule.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-2xs uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">
                      {rule.frequency} · {rule.rule_type}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {rule.name}
                    </h4>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Active
                  </span>
                </div>

                <div className="my-3">
                  <span className="text-2xs text-slate-400 font-semibold uppercase block">
                    Scheduled Amount
                  </span>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                    {formatMoney(rule.amount)}
                  </div>
                </div>

                <div className="text-2xs text-slate-500 flex items-center gap-1.5 pt-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Next Due Date: <strong className="font-mono text-slate-700 dark:text-slate-300">{rule.next_due_date}</strong></span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-3">
                <span className="text-2xs text-slate-400">Idempotent guard on</span>

                {canWrite && (
                  <button
                    onClick={() => handleExecuteNow(rule)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    <span>Run Occurrence</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Register Recurring Schedule
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Schedule Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wifi (Home) Link3, Electricity (Home) DESCO"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e: any) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <NumericInput
                    placeholder="1250"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Next Due Date
                  </label>
                  <input
                    type="date"
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Account
                  </label>
                  <select
                    value={sourceAccountId}
                    onChange={(e) => setSourceAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">Default Account</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
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
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
