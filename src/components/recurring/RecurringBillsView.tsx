import React, { useState } from 'react';
import { 
  Repeat, 
  Plus, 
  Play, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Clock,
  Edit2,
  Trash2,
  Pause,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  Calendar,
  Check
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { RecurringRule, FinancialAccount } from '../../types';
import { NumericInput } from '../common/NumericInput';
import { generateUuid, toUuid } from '../../lib/uuid';

export const RecurringBillsView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const rules = db.getRecurringRules(workspaceId);
  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const categories = db.getCategories(workspaceId);

  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'yearly' | 'daily'>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [autoPost, setAutoPost] = useState(false);
  const [notes, setNotes] = useState('');

  const openAddModal = () => {
    setEditingRule(null);
    setName('');
    setRuleType('expense');
    setAmount('');
    setFrequency('monthly');
    setStartDate(new Date().toISOString().split('T')[0]);
    setNextDueDate(new Date().toISOString().split('T')[0]);
    setSourceAccountId(accounts[0]?.id || '');
    setDestinationAccountId(accounts[1]?.id || '');
    setCategoryId(categories.find(c => c.type === 'expense')?.id || '');
    setAutoPost(false);
    setNotes('');
    setErrorMessage(null);
    setShowModal(true);
  };

  const openEditModal = (rule: RecurringRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setRuleType(rule.rule_type === 'income' ? 'income' : rule.rule_type === 'transfer' ? 'transfer' : 'expense');
    setAmount(rule.amount.toString());
    setFrequency(rule.frequency as any || 'monthly');
    setStartDate(rule.start_date || new Date().toISOString().split('T')[0]);
    setNextDueDate(rule.next_due_date || new Date().toISOString().split('T')[0]);
    setSourceAccountId(rule.source_account_id || accounts[0]?.id || '');
    setDestinationAccountId(rule.destination_account_id || accounts[1]?.id || '');
    setCategoryId(rule.category_id || '');
    setAutoPost(Boolean(rule.auto_post));
    setNotes(rule.notes || '');
    setErrorMessage(null);
    setShowModal(true);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const amt = parseFloat(amount);
    if (!name.trim()) {
      setErrorMessage('Please enter a schedule title.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0.');
      return;
    }
    if (!nextDueDate) {
      setErrorMessage('Please select the next due date.');
      return;
    }

    if (ruleType === 'transfer' && sourceAccountId && destinationAccountId && sourceAccountId === destinationAccountId) {
      setErrorMessage('Source and destination accounts must be different.');
      return;
    }

    if (editingRule) {
      const updated: RecurringRule = {
        ...editingRule,
        name: name.trim(),
        rule_type: ruleType,
        amount: amt,
        currency: currentWorkspace?.currency || 'BDT',
        frequency,
        start_date: startDate,
        next_due_date: nextDueDate,
        source_account_id: sourceAccountId || undefined,
        destination_account_id: ruleType === 'transfer' ? (destinationAccountId || undefined) : undefined,
        category_id: categoryId || undefined,
        auto_post: autoPost,
        notes: notes.trim() || undefined,
      };
      db.saveRecurringRule(updated);
      setExecutionMessage(`Schedule "${updated.name}" updated successfully.`);
    } else {
      const newRule: RecurringRule = {
        id: generateUuid(),
        workspace_id: workspaceId,
        name: name.trim(),
        rule_type: ruleType,
        amount: amt,
        currency: currentWorkspace?.currency || 'BDT',
        frequency,
        start_date: startDate,
        next_due_date: nextDueDate,
        source_account_id: sourceAccountId || undefined,
        destination_account_id: ruleType === 'transfer' ? (destinationAccountId || undefined) : undefined,
        category_id: categoryId || undefined,
        auto_post: autoPost,
        is_active: true,
        notes: notes.trim() || undefined,
      };
      db.saveRecurringRule(newRule);
      setExecutionMessage(`Recurring schedule "${newRule.name}" created successfully.`);
    }

    refreshData();
    setShowModal(false);
    setTimeout(() => setExecutionMessage(null), 3500);
  };

  const handleDeleteRule = (rule: RecurringRule) => {
    if (window.confirm(`Are you sure you want to delete recurring schedule "${rule.name}"? Past posted transactions will remain in your ledger.`)) {
      db.deleteRecurringRule(rule.id, workspaceId);
      refreshData();
      setExecutionMessage(`Recurring rule "${rule.name}" deleted.`);
      setTimeout(() => setExecutionMessage(null), 3000);
    }
  };

  const handleToggleActive = (rule: RecurringRule) => {
    const updated: RecurringRule = {
      ...rule,
      is_active: !rule.is_active,
    };
    db.saveRecurringRule(updated);
    refreshData();
    setExecutionMessage(`Schedule "${rule.name}" is now ${updated.is_active ? 'Active' : 'Paused'}.`);
    setTimeout(() => setExecutionMessage(null), 2500);
  };

  const calculateNextDate = (currentDateStr: string, freq: string): string => {
    const d = new Date(currentDateStr);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];

    if (freq === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else if (freq === 'yearly') {
      d.setFullYear(d.getFullYear() + 1);
    } else if (freq === 'daily') {
      d.setDate(d.getDate() + 1);
    } else {
      // Monthly default
      d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().split('T')[0];
  };

  const handleExecuteNow = (rule: RecurringRule) => {
    const today = new Date().toISOString().split('T')[0];
    const occurrenceId = `${rule.id}_${today}`;
    const defaultAcc = accounts[0]?.id || toUuid(`acc_cash_hand_${workspaceId}`);

    let postResult: { success: boolean; error?: string };

    if (rule.rule_type === 'income') {
      const destAcc = rule.source_account_id || accounts.find(a => a.account_type_id === 'bank')?.id || defaultAcc;
      const defaultIncomeAcc = toUuid(`acc_income_earned_${workspaceId}`);
      postResult = db.postJournalEntry(workspaceId, {
        memo: `Recurring Inflow: ${rule.name}`,
        source_type: 'recurring_execution',
        source_id: occurrenceId,
        entry_date: today,
        lines: [
          {
            account_id: destAcc,
            line_type: 'debit',
            amount: rule.amount,
            memo: `Deposit: ${rule.name}`,
            category_id: rule.category_id,
          },
          {
            account_id: defaultIncomeAcc,
            line_type: 'credit',
            amount: rule.amount,
            memo: `Earned Revenue: ${rule.name}`,
            category_id: rule.category_id,
          },
        ],
      });
    } else if (rule.rule_type === 'transfer') {
      postResult = db.postTransfer(
        workspaceId,
        rule.source_account_id || defaultAcc,
        rule.destination_account_id || accounts[1]?.id || defaultAcc,
        rule.amount,
        today,
        `Recurring Transfer: ${rule.name}`
      );
    } else {
      // Expense or DPS installment
      const defaultOpAcc = toUuid(`acc_expense_operating_${workspaceId}`);
      postResult = db.postJournalEntry(workspaceId, {
        memo: `Recurring Bill: ${rule.name}`,
        source_type: 'recurring_execution',
        source_id: occurrenceId,
        entry_date: today,
        lines: [
          {
            account_id: rule.source_account_id || defaultAcc,
            line_type: 'credit',
            amount: rule.amount,
            memo: `Payment for ${rule.name}`,
          },
          {
            account_id: defaultOpAcc,
            line_type: 'debit',
            amount: rule.amount,
            memo: `Expense: ${rule.name}`,
            category_id: rule.category_id,
          },
        ],
      });
    }

    if (postResult.success) {
      // Advance next due date automatically
      const nextDate = calculateNextDate(rule.next_due_date, rule.frequency);
      db.saveRecurringRule({
        ...rule,
        next_due_date: nextDate,
      });

      setExecutionMessage(`Executed "${rule.name}" for ${formatMoney(rule.amount)}. Next due date advanced to ${nextDate}.`);
      refreshData();
      setTimeout(() => setExecutionMessage(null), 4000);
    } else {
      setErrorMessage(postResult.error || 'Failed to post recurring execution.');
    }
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
            Automate Wi-Fi, electricity, DPS installments, subscriptions, and reminders with full backend synchronization.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Recurring Bill</span>
          </button>
        )}
      </div>

      {executionMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{executionMessage}</span>
          </div>
          <button onClick={() => setExecutionMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Rules Grid */}
      {rules.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-xs">
          <Repeat className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No recurring rules registered</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Schedule your recurring living bills like Wi-Fi (Home), Electricity (DESCO), Mess bills, or DPS installments.
          </p>
          {canWrite && (
            <button
              onClick={openAddModal}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-xs"
            >
              Add Your First Recurring Bill
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map(rule => {
            const sourceAcc = accounts.find(a => a.id === rule.source_account_id);
            const destAcc = accounts.find(a => a.id === rule.destination_account_id);
            const linkedCat = categories.find(c => c.id === rule.category_id);

            return (
              <div
                key={rule.id}
                className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all shadow-xs flex flex-col justify-between ${
                  rule.is_active 
                    ? 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700' 
                    : 'border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-3xs uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          {rule.frequency}
                        </span>
                        <span className="text-3xs uppercase tracking-wider font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                          {rule.rule_type}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 leading-snug truncate">
                        {rule.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        title={rule.is_active ? 'Pause schedule' : 'Resume schedule'}
                        className={`text-2xs font-semibold px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                          rule.is_active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {rule.is_active ? 'Active' : 'Paused'}
                      </button>
                    </div>
                  </div>

                  {/* Scheduled Amount */}
                  <div className="my-3">
                    <span className="text-3xs text-slate-400 font-semibold uppercase block">
                      Scheduled Amount
                    </span>
                    <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(rule.amount)}
                    </div>
                  </div>

                  {/* Account / Category Context */}
                  <div className="space-y-1 text-2xs text-slate-500 dark:text-slate-400 pb-2">
                    {sourceAcc && (
                      <div className="flex items-center justify-between">
                        <span>Account:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                          {sourceAcc.name}
                        </span>
                      </div>
                    )}
                    {rule.rule_type === 'transfer' && destAcc && (
                      <div className="flex items-center justify-between">
                        <span>To:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                          {destAcc.name}
                        </span>
                      </div>
                    )}
                    {linkedCat && (
                      <div className="flex items-center justify-between">
                        <span>Category:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                          {linkedCat.name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-2xs">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3" />
                        Next Due:
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {rule.next_due_date}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-1">
                    {canWrite && (
                      <>
                        <button
                          onClick={() => openEditModal(rule)}
                          title="Edit recurring schedule"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule)}
                          title="Delete recurring schedule"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {canWrite && (
                    <button
                      onClick={() => handleExecuteNow(rule)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Post Now</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingRule ? 'Edit Recurring Schedule' : 'Register Recurring Schedule'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveRule} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Schedule Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wifi (Home) Link3, Electricity DESCO, Mess Bill"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rule Type
                  </label>
                  <select
                    value={ruleType}
                    onChange={(e: any) => setRuleType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Account Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e: any) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <NumericInput
                    placeholder="1250.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Next Due Date
                  </label>
                  <input
                    type="date"
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {ruleType === 'income' ? 'Deposit Account' : 'Payment Account'}
                  </label>
                  <select
                    value={sourceAccountId}
                    onChange={(e) => setSourceAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatMoney(a.current_balance_cached)})
                      </option>
                    ))}
                  </select>
                </div>

                {ruleType === 'transfer' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Destination Account
                    </label>
                    <select
                      value={destinationAccountId}
                      onChange={(e) => setDestinationAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      required
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatMoney(a.current_balance_cached)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Category
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="">No Category</option>
                      {categories
                        .filter(c => ruleType === 'income' ? c.type === 'income' : c.type !== 'income')
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.type})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Account number, subscriber ID, or reminder notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                {editingRule ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(editingRule)}
                    className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700"
                  >
                    Delete Schedule
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                  >
                    {editingRule ? 'Update Schedule' : 'Save Schedule'}
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
