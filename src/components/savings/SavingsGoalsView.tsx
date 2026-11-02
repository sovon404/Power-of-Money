import React, { useState } from 'react';
import { 
  PiggyBank, 
  Plus, 
  TrendingUp, 
  Calendar, 
  Target, 
  CheckCircle2, 
  X,
  Sparkles,
  Edit3,
  Edit2,
  Trash2,
  Layers,
  FolderTree,
  Landmark,
  ShieldCheck
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { SavingsGoal, Category, FinancialAccount } from '../../types';
import { NumericInput } from '../common/NumericInput';
import { toUuid, generateUuid } from '../../lib/uuid';

export const SavingsGoalsView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const goals = db.getSavingsGoals(workspaceId);
  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const liquidAccounts = accounts.filter(a => ['bank', 'cash', 'mfs'].includes(a.account_type_id));
  const savingsAccounts = accounts.filter(a => ['savings_dps', 'investment'].includes(a.account_type_id));

  // Saving Categories & Subcategories
  const allCategories = db.getCategories(workspaceId);
  const isSavingCategory = (c: Category) => 
    c.type === 'saving' || 
    c.accounting_classification === 'asset_savings' || 
    Boolean(c.target_savings_account_id) ||
    ['dps', 'dsp (baf)', 'unity fund-2026', 'los fund (installment)', 'friends fund installment'].includes(c.name.toLowerCase());
  
  const savingCategories = allCategories.filter(isSavingCategory);
  const rootSavingCategories = savingCategories.filter(c => !c.parent_id);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);

  // Saving Head & Sub-category Modal state
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [editingHeadCat, setEditingHeadCat] = useState<Category | null>(null);
  const [headName, setHeadName] = useState('');
  const [headDescription, setHeadDescription] = useState('');
  const [headParentId, setHeadParentId] = useState<string | null>(null);
  const [headTargetAcc, setHeadTargetAcc] = useState('');
  const [headColor, setHeadColor] = useState('#0d9488');
  const [isCreatingHeadAccount, setIsCreatingHeadAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountProvider, setNewAccountProvider] = useState('Dedicated Fund');

  // Edit Goal state
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editName, setEditName] = useState('');
  const [editTargetAmount, setEditTargetAmount] = useState('');
  const [editCurrentSaved, setEditCurrentSaved] = useState('');
  const [editMonthlyContribution, setEditMonthlyContribution] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');

  const openEditModal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setEditName(goal.name);
    setEditTargetAmount(goal.target_amount.toString());
    setEditCurrentSaved(goal.current_saved_amount.toString());
    setEditMonthlyContribution(goal.monthly_contribution.toString());
    setEditTargetDate(goal.target_date || '');
  };

  const handleSaveEditGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !editName.trim()) return;

    const updated: SavingsGoal = {
      ...editingGoal,
      name: editName.trim(),
      target_amount: parseFloat(editTargetAmount) || editingGoal.target_amount,
      current_saved_amount: parseFloat(editCurrentSaved) || 0,
      monthly_contribution: parseFloat(editMonthlyContribution) || 0,
      target_date: editTargetDate || undefined,
    };

    db.saveSavingsGoal(updated);
    refreshData();
    setEditingGoal(null);
  };

  const handleDeleteGoal = (goal: SavingsGoal) => {
    if (confirm(`Are you sure you want to delete the goal "${goal.name}"?`)) {
      db.deleteSavingsGoal(goal.id, workspaceId);
      refreshData();
    }
  };

  // Saving Head & Sub-category modal handlers
  const openAddHeadModal = (parentId?: string | null) => {
    setEditingHeadCat(null);
    setHeadName('');
    setHeadDescription('');
    setHeadParentId(parentId || null);
    if (parentId) {
      const parent = savingCategories.find(c => c.id === parentId);
      setHeadTargetAcc(parent?.target_savings_account_id || savingsAccounts[0]?.id || '');
      setHeadColor(parent?.color || '#0d9488');
    } else {
      setHeadTargetAcc(savingsAccounts[0]?.id || '');
      setHeadColor('#0d9488');
    }
    setIsCreatingHeadAccount(false);
    setNewAccountName('');
    setShowHeadModal(true);
  };

  const openEditHeadModal = (cat: Category) => {
    setEditingHeadCat(cat);
    setHeadName(cat.name);
    setHeadDescription(cat.description || '');
    setHeadParentId(cat.parent_id || null);
    setHeadTargetAcc(cat.target_savings_account_id || savingsAccounts[0]?.id || '');
    setHeadColor(cat.color || '#0d9488');
    setIsCreatingHeadAccount(false);
    setShowHeadModal(true);
  };

  const handleCreateSavingsAccountInline = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;

    const newAccId = generateUuid();
    const newAcc: FinancialAccount = {
      id: newAccId,
      workspace_id: workspaceId,
      name: newAccountName.trim(),
      account_type_id: 'savings_dps',
      provider: newAccountProvider.trim() || 'Dedicated Fund',
      currency: currentWorkspace?.currency || 'BDT',
      opening_balance: 0,
      opening_date: new Date().toISOString().split('T')[0],
      current_balance_cached: 0,
      is_archived: false,
      icon: 'piggy-bank',
      color: '#0d9488',
      created_at: new Date().toISOString(),
    };

    db.saveAccount(newAcc);
    refreshData();
    setHeadTargetAcc(newAccId);
    setNewAccountName('');
    setIsCreatingHeadAccount(false);
  };

  const handleSaveSavingHead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headName.trim()) return;

    if (editingHeadCat) {
      const updated: Category = {
        ...editingHeadCat,
        name: headName.trim(),
        description: headDescription.trim() || undefined,
        parent_id: headParentId || undefined,
        type: 'saving',
        accounting_classification: 'asset_savings',
        target_savings_account_id: headTargetAcc || undefined,
        color: headColor,
      };
      db.saveCategory(updated);
    } else {
      const newCat: Category = {
        id: toUuid(`cat_saving_${workspaceId}_${Date.now()}`),
        workspace_id: workspaceId,
        name: headName.trim(),
        description: headDescription.trim() || undefined,
        parent_id: headParentId || undefined,
        type: 'saving',
        accounting_classification: 'asset_savings',
        target_savings_account_id: headTargetAcc || undefined,
        icon: 'piggy-bank',
        color: headColor,
        is_seed: false,
        is_archived: false,
        sort_order: savingCategories.length + 1,
      };
      db.saveCategory(newCat);
    }

    refreshData();
    setShowHeadModal(false);
    setHeadName('');
    setHeadDescription('');
    setHeadParentId(null);
  };

  const handleDeleteSavingHead = (cat: Category) => {
    if (confirm(`Are you sure you want to permanently delete saving category "${cat.name}"?`)) {
      db.deleteCategory(cat.id, workspaceId);
      refreshData();
    }
  };

  // New Goal form
  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState<any>('dps');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentSaved, setCurrentSaved] = useState('0');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [expectedReturnRate, setExpectedReturnRate] = useState('8.5');

  // Contribute form
  const [contributeAmount, setContributeAmount] = useState('');
  const [fundingAccount, setFundingAccount] = useState('');
  const [contributeSuccess, setContributeSuccess] = useState<string | null>(null);

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const tAmt = parseFloat(targetAmount);
    if (!name.trim() || isNaN(tAmt) || tAmt <= 0) return;

    const newGoal: SavingsGoal = {
      id: 'goal_' + Date.now(),
      workspace_id: workspaceId,
      name: name.trim(),
      goal_type: goalType,
      target_amount: tAmt,
      current_saved_amount: parseFloat(currentSaved) || 0,
      monthly_contribution: parseFloat(monthlyContribution) || 0,
      target_date: targetDate || undefined,
      expected_return_rate: parseFloat(expectedReturnRate) || 0,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    db.saveSavingsGoal(newGoal);
    refreshData();
    setShowAddModal(false);
    resetForm();
  };

  const handleContribute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !fundingAccount) return;
    const amt = parseFloat(contributeAmount);
    if (isNaN(amt) || amt <= 0) return;

    const savingsAccs = accounts.filter(a => ['savings_dps', 'investment'].includes(a.account_type_id));
    let targetAccId = selectedGoal.account_id;
    if (!targetAccId) {
      const match = savingsAccs.find(a => a.name.toLowerCase() === selectedGoal.name.toLowerCase()) 
        || savingsAccs.find(a => selectedGoal.name.toLowerCase().includes(a.name.toLowerCase()))
        || savingsAccs[0];
      targetAccId = match?.id || fundingAccount;
    }

    // Double-entry rule for DPS / Savings contribution:
    // Debit: Target Savings Head Account
    // Credit: Funding Bank / Cash Account
    db.postJournalEntry(workspaceId, {
      memo: `DPS / Savings Contribution: ${selectedGoal.name}`,
      source_type: 'transfer',
      source_id: selectedGoal.id,
      entry_date: new Date().toISOString().split('T')[0],
      lines: [
        {
          account_id: targetAccId,
          line_type: 'debit',
          amount: amt,
          memo: `Savings asset allocation: ${selectedGoal.name}`,
        },
        {
          account_id: fundingAccount,
          line_type: 'credit',
          amount: amt,
          memo: `Funding transfer for ${selectedGoal.name}`,
        },
      ],
    });

    selectedGoal.current_saved_amount += amt;
    if (selectedGoal.current_saved_amount >= selectedGoal.target_amount) {
      selectedGoal.status = 'completed';
    }
    db.saveSavingsGoal(selectedGoal);

    setContributeSuccess(`Contribution of ${formatMoney(amt)} saved! Account updated as an asset transfer without distorting expenses.`);
    refreshData();
    setTimeout(() => {
      setContributeSuccess(null);
      setShowContributeModal(false);
    }, 2000);
  };

  const resetForm = () => {
    setName('');
    setGoalType('dps');
    setTargetAmount('');
    setCurrentSaved('0');
    setMonthlyContribution('');
    setTargetDate('');
    setExpectedReturnRate('8.5');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            DPS, Savings &amp; Financial Goals
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track recurring DPS installments, target milestones, and maturity dates distinct from ordinary expenses.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Savings Goal / DPS</span>
          </button>
        )}
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <PiggyBank className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No savings goals yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Build discipline with DPS monthly installments, emergency funds, and long-term asset targets.
          </p>
          {canWrite && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Create Your First Goal
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map(goal => {
            const pct = Math.min(100, Math.round((goal.current_saved_amount / goal.target_amount) * 100));

            return (
              <div
                key={goal.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-2xs uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">
                        {goal.goal_type.replace('_', ' ')}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {goal.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${
                        goal.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}>
                        {goal.status === 'completed' ? 'Target Reached' : `${pct}%`}
                      </span>
                      {canWrite && (
                        <>
                          <button
                            onClick={() => openEditModal(goal)}
                            title="Edit Goal"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal)}
                            title="Delete Goal"
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
                        Saved So Far
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base tabular-nums">
                        {formatMoney(goal.current_saved_amount)}
                      </span>
                    </div>

                    <div>
                      <span className="text-2xs text-slate-400 font-semibold uppercase block">
                        Target Goal
                      </span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-base tabular-nums">
                        {formatMoney(goal.target_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="my-2">
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {goal.monthly_contribution > 0 && (
                    <div className="text-2xs text-slate-500 dark:text-slate-400 mt-2">
                      Monthly Installment: <span className="font-mono font-semibold">{formatMoney(goal.monthly_contribution)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500 mt-3">
                  <span>{goal.target_date ? `Target: ${goal.target_date}` : 'Ongoing'}</span>

                  {goal.status !== 'completed' && canWrite && (
                    <button
                      onClick={() => {
                        setSelectedGoal(goal);
                        setContributeAmount(goal.monthly_contribution > 0 ? goal.monthly_contribution.toString() : '5000');
                        setShowContributeModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                    >
                      Deposit Installment
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* Saving Categories, Heads & Sub-Categories Management */}
      {/* ======================================================== */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <FolderTree className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Saving Heads, Categories &amp; Sub-Categories
              </h3>
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
              Dedicated DPS heads, DSPF, Unity Fund, and nested sub-categories. Fully synced with double-entry accounting.
            </p>
          </div>

          {canWrite && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openAddHeadModal(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Saving Head</span>
              </button>
            </div>
          )}
        </div>

        {rootSavingCategories.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <p className="text-xs font-medium">No custom saving heads added yet.</p>
            <span className="text-2xs text-slate-500">Create a dedicated saving head like DPS, DSPF, or Unity Fund above.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rootSavingCategories.map(cat => {
              const targetAcc = cat.target_savings_account_id ? accounts.find(a => a.id === cat.target_savings_account_id) : undefined;
              const subcats = savingCategories.filter(c => c.parent_id === cat.id);

              return (
                <div
                  key={cat.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || '#0d9488' }}
                        />
                        <div className="truncate min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {cat.name}
                          </h4>
                          <span className="text-3xs text-teal-600 dark:text-teal-400 font-semibold block truncate">
                            {targetAcc ? `Linked: ${targetAcc.name}` : 'Reserved Fund Asset'}
                          </span>
                        </div>
                      </div>

                      {canWrite && (
                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => openAddHeadModal(cat.id)}
                            title="Add sub-category under this head"
                            className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 hover:bg-teal-100 flex items-center gap-0.5"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>+ Sub</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditHeadModal(cat)}
                            title="Edit head"
                            className="p-1 rounded text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSavingHead(cat)}
                            title="Delete saving head"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {targetAcc && (
                      <div className="flex items-center justify-between text-2xs py-1 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 my-2">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Head Balance:</span>
                        <span className="font-mono font-bold text-teal-700 dark:text-teal-300 tabular-nums">
                          {formatMoney(targetAcc.current_balance_cached)}
                        </span>
                      </div>
                    )}

                    {cat.description && (
                      <p className="text-3xs text-slate-400 italic mb-2">
                        {cat.description}
                      </p>
                    )}

                    {/* Sub-categories */}
                    {subcats.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                        <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">
                          Sub-categories ({subcats.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {subcats.map(sub => (
                            <span
                              key={sub.id}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-3xs font-medium border border-slate-200 dark:border-slate-700 shadow-2xs"
                            >
                              <span>{sub.name}</span>
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSavingHead(sub)}
                                  title="Delete subcategory"
                                  className="text-slate-400 hover:text-rose-500 font-bold ml-0.5"
                                >
                                  &times;
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                New Savings or DPS Goal
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Goal / DPS Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5-Year DPS Scheme, Emergency Fund, Hajj Savings"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Goal Type
                  </label>
                  <select
                    value={goalType}
                    onChange={(e: any) => setGoalType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="dps">DPS (Recurring Deposit)</option>
                    <option value="emergency_fund">Emergency Fund</option>
                    <option value="fixed_deposit">Fixed Deposit</option>
                    <option value="property_downpayment">Property Downpayment</option>
                    <option value="general_savings">General Savings</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Amount ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <NumericInput
                    placeholder="300000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Contribution
                  </label>
                  <NumericInput
                    placeholder="5000"
                    value={monthlyContribution}
                    onChange={(e) => setMonthlyContribution(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target / Maturity Date
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
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
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {showContributeModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Deposit to {selectedGoal.name}
                </h3>
                <span className="text-2xs text-slate-500">
                  Transfers to savings are asset transfers, not expenses.
                </span>
              </div>
              <button
                onClick={() => setShowContributeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {contributeSuccess && (
              <div className="p-3 mb-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{contributeSuccess}</span>
              </div>
            )}

            <form onSubmit={handleContribute} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Funding Account (Bank / MFS)
                </label>
                <select
                  value={fundingAccount}
                  onChange={(e) => setFundingAccount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  <option value="">Select funding account</option>
                  {liquidAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(a.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Installment Amount
                </label>
                <NumericInput
                  placeholder="0.00"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowContributeModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Record Installment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Savings / DPS Goal
              </h3>
              <button
                onClick={() => setEditingGoal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Goal Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Goal ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <NumericInput
                    placeholder="0.00"
                    value={editTargetAmount}
                    onChange={(e) => setEditTargetAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Saved
                  </label>
                  <NumericInput
                    placeholder="0.00"
                    value={editCurrentSaved}
                    onChange={(e) => setEditCurrentSaved(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Installment
                  </label>
                  <NumericInput
                    placeholder="0.00"
                    value={editMonthlyContribution}
                    onChange={(e) => setEditMonthlyContribution(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={editTargetDate}
                    onChange={(e) => setEditTargetDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
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
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Saving Category & Sub-Category Modal */}
      {showHeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span>
                  {editingHeadCat
                    ? 'Edit Saving Category'
                    : headParentId
                    ? 'Add Sub-Category'
                    : 'Add New Saving Head'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowHeadModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSavingHead} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {headParentId ? 'Sub-Category Name' : 'Saving Head / Category Title'}
                </label>
                <input
                  type="text"
                  placeholder={headParentId ? "e.g. 5-Yr Sonali Bank DPS, Monthly Contribution" : "e.g. DPS Schemes, Emergency Reserve, Unity Fund-2026"}
                  value={headName}
                  onChange={(e) => setHeadName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                  autoFocus
                />
              </div>

              {/* Parent Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Parent Saving Category (Optional)
                </label>
                <select
                  value={headParentId || ''}
                  onChange={(e) => setHeadParentId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">None (Top-Level Saving Head)</option>
                  {rootSavingCategories
                    .filter(c => c.id !== editingHeadCat?.id)
                    .map(parent => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name}
                      </option>
                    ))}
                </select>
                <p className="text-3xs text-slate-400 mt-1">
                  Select a parent saving category to make this a nested sub-category.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Purpose (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Long-term asset accumulation, family contingency fund"
                  value={headDescription}
                  onChange={(e) => setHeadDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Target Savings Account Linkage */}
              <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Linked Asset Head Account</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingHeadAccount(!isCreatingHeadAccount)}
                    className="text-2xs font-semibold text-teal-700 dark:text-teal-300 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isCreatingHeadAccount ? 'Select Existing' : 'New Account'}</span>
                  </button>
                </div>

                {!isCreatingHeadAccount ? (
                  <div>
                    <select
                      value={headTargetAcc}
                      onChange={(e) => setHeadTargetAcc(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      required
                    >
                      {savingsAccounts.length === 0 ? (
                        <option value="">No savings asset account found. Click "New Account" above.</option>
                      ) : (
                        savingsAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.provider}) - {formatMoney(acc.current_balance_cached)}
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-3xs text-teal-700 dark:text-teal-400 mt-1">
                      Double-entry engine will debit this asset account when this saving category is funded.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-teal-200 dark:border-teal-800">
                    <div>
                      <label className="block text-3xs font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        New Account Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Unity Fund-2026 Asset, DSPF (BAF) Account"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-3xs font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        Provider / Fund Manager
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dedicated Fund, BAF, Sonali Bank"
                        value={newAccountProvider}
                        onChange={(e) => setNewAccountProvider(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCreatingHeadAccount(false)}
                        className="px-2 py-1 text-2xs text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateSavingsAccountInline}
                        className="px-3 py-1 text-2xs font-semibold rounded bg-teal-600 hover:bg-teal-500 text-white"
                      >
                        Save Account
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={headColor}
                    onChange={(e) => setHeadColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 cursor-pointer p-0"
                  />
                  <span className="text-xs font-mono text-slate-500 uppercase">{headColor}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowHeadModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-xs"
                >
                  {editingHeadCat ? 'Update Saving Category' : 'Save Saving Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
