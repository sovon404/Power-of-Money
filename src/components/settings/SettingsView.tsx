import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Tag, 
  Plus, 
  Archive, 
  Database, 
  CheckCircle2, 
  Copy, 
  Check, 
  Sliders, 
  ShieldCheck,
  FileCode,
  ExternalLink,
  PiggyBank,
  Edit2,
  Wallet,
  Landmark,
  ArrowRight
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { Category, FinancialAccount } from '../../types';
import { getSupabaseStatus } from '../../lib/supabase';
import { generateUuid, toUuid } from '../../lib/uuid';

export const SettingsView: React.FC = () => {
  const { currentWorkspace, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const categories = db.getCategories(workspaceId);
  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const savingsAccounts = accounts.filter(a => ['savings_dps', 'investment'].includes(a.account_type_id));
  const supabaseStatus = getSupabaseStatus();

  const [activeTab, setActiveTab] = useState<'categories' | 'supabase' | 'general'>('categories');
  const [catFilter, setCatFilter] = useState<'all' | 'expense' | 'income' | 'saving'>('all');

  // Add / Edit Category Modal state
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'expense' | 'income' | 'saving'>('expense');
  const [catClassification, setCatClassification] = useState('expense_operating');
  const [catTargetSavingsAcc, setCatTargetSavingsAcc] = useState('');
  const [catColor, setCatColor] = useState('#0284c7');

  // Inline Savings Head Creation
  const [isCreatingHead, setIsCreatingHead] = useState(false);
  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadProvider, setNewHeadProvider] = useState('Savings Fund');

  const [copiedMigration, setCopiedMigration] = useState(false);

  const openAddCategoryModal = () => {
    setEditingCategory(null);
    setCatName('');
    setCatType('expense');
    setCatClassification('expense_operating');
    setCatTargetSavingsAcc(savingsAccounts[0]?.id || '');
    setCatColor('#0284c7');
    setIsCreatingHead(false);
    setShowAddCatModal(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatType(cat.type === 'transfer_allocation' ? 'saving' : cat.type);
    setCatClassification(cat.accounting_classification || (cat.type === 'saving' ? 'asset_savings' : 'expense_operating'));
    setCatTargetSavingsAcc(cat.target_savings_account_id || savingsAccounts[0]?.id || '');
    setCatColor(cat.color || '#0284c7');
    setIsCreatingHead(false);
    setShowAddCatModal(true);
  };

  const handleCreateSavingsHeadInline = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newHeadName.trim()) return;

    const newAccId = generateUuid();
    const newAcc: FinancialAccount = {
      id: newAccId,
      workspace_id: workspaceId,
      name: newHeadName.trim(),
      account_type_id: 'savings_dps',
      provider: newHeadProvider.trim() || 'Savings Fund',
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
    setCatTargetSavingsAcc(newAccId);
    setNewHeadName('');
    setIsCreatingHead(false);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    if (editingCategory) {
      const updated: Category = {
        ...editingCategory,
        name: catName.trim(),
        type: catType,
        accounting_classification: (catType === 'saving' ? (catClassification || 'asset_savings') : catClassification) as any,
        target_savings_account_id: catType === 'saving' ? (catTargetSavingsAcc || undefined) : undefined,
        color: catColor,
      };
      db.saveCategory(updated);
    } else {
      const newCat: Category = {
        id: toUuid(`cat_${workspaceId}_${Date.now()}`),
        workspace_id: workspaceId,
        name: catName.trim(),
        type: catType,
        accounting_classification: (catType === 'saving' ? 'asset_savings' : catClassification) as any,
        target_savings_account_id: catType === 'saving' ? (catTargetSavingsAcc || undefined) : undefined,
        icon: catType === 'saving' ? 'piggy-bank' : catType === 'income' ? 'plus-circle' : 'tag',
        color: catType === 'saving' ? '#0d9488' : catColor,
        is_seed: false,
        is_archived: false,
        sort_order: categories.length + 1,
      };
      db.saveCategory(newCat);
    }

    refreshData();
    setShowAddCatModal(false);
    setCatName('');
  };

  const handleToggleArchive = (cat: Category) => {
    db.saveCategory({
      ...cat,
      is_archived: !cat.is_archived,
    });
    refreshData();
  };

  const filteredCategories = categories.filter(c => {
    if (catFilter === 'all') return true;
    if (catFilter === 'saving') return c.type === 'saving' || c.accounting_classification === 'asset_savings';
    return c.type === catFilter;
  });

  const expenseCount = categories.filter(c => c.type === 'expense').length;
  const incomeCount = categories.filter(c => c.type === 'income').length;
  const savingCount = categories.filter(c => c.type === 'saving' || c.accounting_classification === 'asset_savings').length;

  const copyMigrationList = () => {
    const text = `-- Power of Money: Execute these migrations in Supabase SQL Editor in order:
1. 20261031000001_core_schema.sql
2. 20261031000002_accounting_ledger.sql
3. 20261031000003_banking_cards_loans.sql
4. 20261031000004_property_register.sql
5. 20261031000005_budgets_savings_recurring.sql
6. 20261031000006_accounting_functions_and_rpc.sql
7. 20261031000007_rls_and_storage_policies.sql
8. 20261031000008_security_and_integrity_tests.sql
9. 20261101000009_master_alignment_triggers_and_rls.sql
10. 20261101000010_historical_entries_and_crud_support.sql
11. 20261101000011_income_types_and_dashboard_cockpit.sql
12. 20261102000012_savings_category_and_heads.sql`;
    navigator.clipboard.writeText(text);
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Workspace Settings &amp; Customization
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Customize categories, manage saving and income types, configure currency, and inspect database migrations.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'categories'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Category Manager ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'supabase'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Supabase &amp; SQL Migrations
          </button>
        </div>
      </div>

      {/* Tab 1: Category Customization Engine */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Financial Categories &amp; Heads
              </h3>
              <p className="text-xs text-slate-500">
                Operating expenses, income streams, and dedicated saving / reserved fund allocations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Pills */}
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setCatFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    catFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  All ({categories.length})
                </button>
                <button
                  onClick={() => setCatFilter('expense')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    catFilter === 'expense'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  Expenses ({expenseCount})
                </button>
                <button
                  onClick={() => setCatFilter('income')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    catFilter === 'income'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  Income ({incomeCount})
                </button>
                <button
                  onClick={() => setCatFilter('saving')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    catFilter === 'saving'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  Savings ({savingCount})
                </button>
              </div>

              {canWrite && (
                <button
                  onClick={openAddCategoryModal}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Category</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredCategories.map(cat => {
              const isSaving = cat.type === 'saving' || cat.accounting_classification === 'asset_savings';
              const targetAcc = cat.target_savings_account_id ? accounts.find(a => a.id === cat.target_savings_account_id) : undefined;
              return (
                <div
                  key={cat.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 truncate min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color || (isSaving ? '#0d9488' : '#0284c7') }}
                    />
                    <div className="truncate min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate block">
                          {cat.name}
                        </span>
                        {isSaving && (
                          <span className="text-3xs font-bold px-1.5 py-0.2 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 shrink-0">
                            Saving
                          </span>
                        )}
                        {cat.type === 'income' && (
                          <span className="text-3xs font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                            Income
                          </span>
                        )}
                      </div>
                      <span className="text-3xs text-slate-400 capitalize block truncate">
                        {isSaving && targetAcc 
                          ? `→ ${targetAcc.name}` 
                          : cat.accounting_classification?.replace('_', ' ') || cat.type}
                      </span>
                    </div>
                  </div>

                  {canWrite && (
                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditCategoryModal(cat)}
                        title="Edit category"
                        className="p-1 rounded text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleArchive(cat)}
                        title="Archive this category"
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Supabase Architecture & Migrations */}
      {activeTab === 'supabase' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <span>Supabase PostgreSQL Integration Status</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Target connection: {supabaseStatus.url}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                supabaseStatus.isConfigured
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
              }`}>
                {supabaseStatus.isConfigured ? 'Connected to Supabase' : 'Offline / Standalone Mode'}
              </span>
            </div>
          </div>

          <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
            <p>
              The complete executable database architecture has been generated in versioned migration files under <code>/supabase/migrations/</code>:
            </p>

            <div className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-2xs space-y-1.5 border border-slate-800">
              <div className="text-slate-400 font-bold mb-2">Ordered Migration Files Generated:</div>
              <div>1. /supabase/migrations/20261031000001_core_schema.sql (Profiles, Workspaces, RBAC, Audit)</div>
              <div>2. /supabase/migrations/20261031000002_accounting_ledger.sql (Accounts, Journal Entries, Balance Trigger)</div>
              <div>3. /supabase/migrations/20261031000003_banking_cards_loans.sql (Credit Cards, Statements, Loans, Receivables)</div>
              <div>4. /supabase/migrations/20261031000004_property_register.sql (Properties, Khara, Ana, Valuations, Recoveries)</div>
              <div>5. /supabase/migrations/20261031000005_budgets_savings_recurring.sql (Categories, Budgets, DPS Goals, Recurring)</div>
              <div>6. /supabase/migrations/20261031000006_accounting_functions_and_rpc.sql (Transfer RPC, Reversal RPC, Seed Categories)</div>
              <div>7. /supabase/migrations/20261031000007_rls_and_storage_policies.sql (Row Level Security &amp; Storage Vault)</div>
              <div>8. /supabase/migrations/20261031000008_security_and_integrity_tests.sql (10 Critical Automated Test Cases)</div>
              <div>9. /supabase/migrations/20261101000009_master_alignment_triggers_and_rls.sql (RLS Policies &amp; Balance Alignment)</div>
              <div>10. /supabase/migrations/20261101000010_historical_entries_and_crud_support.sql (Historical Transactions &amp; Audit Logs)</div>
              <div>11. /supabase/migrations/20261101000011_income_types_and_dashboard_cockpit.sql (Income Types &amp; Realtime Trigger)</div>
              <div>12. /supabase/migrations/20261102000012_savings_category_and_heads.sql (Dedicated Savings Types &amp; Heads Linkage)</div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={copyMigrationList}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
              >
                {copiedMigration ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMigration ? 'Copied Migration Order' : 'Copy Execution Order'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl my-8">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              {editingCategory ? 'Edit Financial Category' : 'Add Custom Financial Category'}
            </h3>

            <form onSubmit={handleSaveCategory} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. DSPF BAF Contribution, Unity Fund-2026, Vehicle Maintenance"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category Type
                  </label>
                  <select
                    value={catType}
                    onChange={(e: any) => {
                      const selected = e.target.value;
                      setCatType(selected);
                      if (selected === 'saving') {
                        setCatClassification('asset_savings');
                        setCatColor('#0d9488');
                        if (!catTargetSavingsAcc && savingsAccounts.length > 0) {
                          setCatTargetSavingsAcc(savingsAccounts[0].id);
                        }
                      } else if (selected === 'income') {
                        setCatClassification('income_operating');
                        setCatColor('#10b981');
                      } else {
                        setCatClassification('expense_operating');
                        setCatColor('#f97316');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="saving">Saving / Reserved Fund</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Accounting Class
                  </label>
                  <select
                    value={catClassification}
                    onChange={(e) => setCatClassification(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {catType === 'saving' ? (
                      <>
                        <option value="asset_savings">Asset Savings / Reserved Fund</option>
                        <option value="asset_transfer">Asset Transfer</option>
                      </>
                    ) : catType === 'income' ? (
                      <>
                        <option value="income_operating">Operating Income</option>
                      </>
                    ) : (
                      <>
                        <option value="expense_operating">Operating Expense</option>
                        <option value="expense_finance">Bank &amp; Finance Charge</option>
                        <option value="liability_reduction">Liability Reduction</option>
                        <option value="asset_transfer">Asset Transfer</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Dynamic Target Savings Head Selection when Category Type is Saving */}
              {catType === 'saving' && (
                <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                      <PiggyBank className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>Target Savings Head / Reserved Fund</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingHead(!isCreatingHead)}
                      className="text-2xs font-semibold text-teal-700 dark:text-teal-300 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isCreatingHead ? 'Select Existing' : 'New Head'}</span>
                    </button>
                  </div>

                  {!isCreatingHead ? (
                    <div>
                      <select
                        value={catTargetSavingsAcc}
                        onChange={(e) => setCatTargetSavingsAcc(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        required
                      >
                        {savingsAccounts.length === 0 ? (
                          <option value="">No savings head found. Click "New Head" above.</option>
                        ) : (
                          savingsAccounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.provider})
                            </option>
                          ))
                        )}
                      </select>
                      <p className="text-3xs text-teal-700 dark:text-teal-400 mt-1">
                        Transactions tagged with this category will credit your payment account and debit directly into this savings head.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-teal-200 dark:border-teal-800">
                      <div>
                        <label className="block text-3xs font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                          New Head Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Unity Fund-2026, DSPF (BAF), Gold Fund"
                          value={newHeadName}
                          onChange={(e) => setNewHeadName(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-3xs font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                          Fund Category / Provider
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Dedicated Fund, BAF, Bank DPS"
                          value={newHeadProvider}
                          onChange={(e) => setNewHeadProvider(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsCreatingHead(false)}
                          className="px-2 py-1 text-2xs text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateSavingsHeadInline}
                          className="px-3 py-1 text-2xs font-semibold rounded bg-teal-600 hover:bg-teal-500 text-white"
                        >
                          Save Head
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tag Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 cursor-pointer p-0"
                  />
                  <span className="text-xs font-mono text-slate-500 uppercase">{catColor}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
