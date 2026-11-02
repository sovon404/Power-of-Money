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
  ArrowRight,
  Trash2
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
  const [catParentId, setCatParentId] = useState<string | null>(null);
  const [catDescription, setCatDescription] = useState('');
  const [isSavingCat, setIsSavingCat] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [copiedMigration, setCopiedMigration] = useState(false);
  const [copiedMasterFix, setCopiedMasterFix] = useState(false);

  const openAddCategoryModal = (parentId?: string | null) => {
    setEditingCategory(null);
    setCatName('');
    setCatDescription('');
    setSaveError(null);
    setCatParentId(parentId || null);
    if (parentId) {
      const parent = categories.find(c => c.id === parentId);
      if (parent) {
        setCatType(parent.type === 'transfer_allocation' ? 'saving' : parent.type);
        setCatClassification(parent.accounting_classification);
        setCatTargetSavingsAcc(parent.target_savings_account_id || '');
        setCatColor(parent.color || '#0284c7');
      }
    } else {
      setCatType('expense');
      setCatClassification('expense_operating');
      setCatTargetSavingsAcc(savingsAccounts[0]?.id || '');
      setCatColor('#0284c7');
    }
    setIsCreatingHead(false);
    setShowAddCatModal(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatDescription(cat.description || '');
    setSaveError(null);
    setCatParentId(cat.parent_id || null);
    setCatType(cat.type === 'transfer_allocation' ? 'saving' : cat.type);
    setCatClassification(cat.accounting_classification || (cat.type === 'saving' ? 'asset_savings' : 'expense_operating'));
    setCatTargetSavingsAcc(cat.target_savings_account_id || savingsAccounts[0]?.id || '');
    setCatColor(cat.color || '#0284c7');
    setIsCreatingHead(false);
    setShowAddCatModal(true);
  };

  const handleCreateSavingsHeadInline = async (e: React.MouseEvent) => {
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
    const { supabaseSync } = await import('../../services/supabaseSync');
    await supabaseSync.syncAccount(newAcc, workspaceId);

    refreshData();
    setCatTargetSavingsAcc(newAccId);
    setNewHeadName('');
    setIsCreatingHead(false);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setIsSavingCat(true);
    setSaveError(null);

    try {
      let catToSave: Category;
      if (editingCategory) {
        catToSave = {
          ...editingCategory,
          name: catName.trim(),
          description: catDescription.trim() || undefined,
          parent_id: catParentId || undefined,
          type: catType,
          accounting_classification: (catType === 'saving' ? (catClassification || 'asset_savings') : catClassification) as any,
          target_savings_account_id: catType === 'saving' ? (catTargetSavingsAcc || undefined) : undefined,
          color: catColor,
        };
      } else {
        catToSave = {
          id: toUuid(`cat_${workspaceId}_${Date.now()}`),
          workspace_id: workspaceId,
          name: catName.trim(),
          description: catDescription.trim() || undefined,
          parent_id: catParentId || undefined,
          type: catType,
          accounting_classification: (catType === 'saving' ? 'asset_savings' : catClassification) as any,
          target_savings_account_id: catType === 'saving' ? (catTargetSavingsAcc || undefined) : undefined,
          icon: catType === 'saving' ? 'piggy-bank' : catType === 'income' ? 'plus-circle' : 'tag',
          color: catType === 'saving' ? '#0d9488' : catColor,
          is_seed: false,
          is_archived: false,
          sort_order: categories.length + 1,
        };
      }

      const syncRes = await db.saveCategory(catToSave);
      if (!syncRes.success && syncRes.error) {
        console.warn('Category sync warning:', syncRes.error);
      }

      refreshData();
      setShowAddCatModal(false);
      setCatName('');
      setCatDescription('');
      setCatParentId(null);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save category');
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleToggleArchive = async (cat: Category) => {
    await db.saveCategory({
      ...cat,
      is_archived: !cat.is_archived,
    });
    refreshData();
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (window.confirm(`Are you sure you want to permanently delete category "${cat.name}"?`)) {
      const res = await db.deleteCategory(cat.id, workspaceId);
      if (!res.success && res.error) {
        alert(`Notice: Deleted locally. Supabase error: ${res.error}. Please run migration 17 in the Supabase SQL editor.`);
      }
      refreshData();
    }
  };

  const isSavingCategory = (c: Category) => 
    c.type === 'saving' || 
    c.accounting_classification === 'asset_savings' || 
    Boolean(c.target_savings_account_id) ||
    ['dps', 'dsp (baf)', 'unity fund-2026', 'los fund (installment)', 'friends fund installment'].includes(c.name.toLowerCase());

  const filteredCategories = categories.filter(c => {
    if (catFilter === 'all') return true;
    if (catFilter === 'saving') return isSavingCategory(c);
    if (catFilter === 'expense') return c.type === 'expense' && !isSavingCategory(c);
    if (catFilter === 'income') return c.type === 'income';
    return c.type === catFilter;
  });

  const expenseCount = categories.filter(c => c.type === 'expense' && !isSavingCategory(c)).length;
  const incomeCount = categories.filter(c => c.type === 'income').length;
  const savingCount = categories.filter(c => isSavingCategory(c)).length;

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
12. 20261102000012_savings_category_and_heads.sql
13. 20261102000013_period_end_date_and_enhancements.sql
14. 20261102000014_single_user_demolish_workspaces.sql
15. 20261102000015_categories_subcategories_and_saving_heads.sql
16. 20261102000016_fix_category_conflicts_and_cascade_deletes.sql
17. 20261102000017_master_categories_and_saving_heads_fix.sql`;
    navigator.clipboard.writeText(text);
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 2000);
  };

  const copyMasterFixSql = () => {
    const sql = `-- ==============================================================================
-- 1-CLICK MASTER FIX: Categories, Subcategories, Saving Heads & Cascade Deletes
-- Drops rigid constraints causing 409 error 23505 and 23503 foreign key blocks.
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop rigid constraint on (workspace_id, name)
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS uq_category_name_workspace;

-- Update type check to allow saving and savings
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_type_check CHECK (type IN ('income', 'expense', 'transfer_allocation', 'saving', 'savings'));

-- Update accounting classification check to allow asset_savings
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_accounting_classification_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_accounting_classification_check CHECK (accounting_classification IN ('expense_operating', 'expense_finance', 'liability_reduction', 'asset_transfer', 'asset_savings', 'receivable_outflow', 'income_operating'));

-- Add columns for subcategories, saving heads & notes
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS target_savings_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS income_type TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(workspace_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_target_savings ON public.categories(workspace_id, target_savings_account_id);

-- Hierarchical unique index
DROP INDEX IF EXISTS public.uq_category_name_parent_workspace;
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_name_parent_workspace ON public.categories (workspace_id, LOWER(TRIM(name)), COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Ensure foreign keys cascade/set null on delete
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_category') THEN ALTER TABLE public.journal_lines DROP CONSTRAINT fk_journal_lines_category; END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_category_id_fkey') THEN ALTER TABLE public.journal_lines DROP CONSTRAINT journal_lines_category_id_fkey; END IF;
    ALTER TABLE public.journal_lines ADD CONSTRAINT fk_journal_lines_category FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_category_id_fkey') THEN ALTER TABLE public.budgets DROP CONSTRAINT budgets_category_id_fkey; END IF;
    ALTER TABLE public.budgets ADD CONSTRAINT budgets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_rules_category_id_fkey') THEN ALTER TABLE public.recurring_rules DROP CONSTRAINT recurring_rules_category_id_fkey; END IF;
    ALTER TABLE public.recurring_rules ADD CONSTRAINT recurring_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Ensure savings account types
INSERT INTO public.account_types (id, name, classification, normal_balance, description)
VALUES 
    ('savings_dps', 'DPS & Fixed Term Deposits', 'asset', 'debit', 'Dedicated savings schemes, DSPF, Unity Fund, and reserved funds'),
    ('investment', 'Investment / Stocks / Funds', 'asset', 'debit', 'Capital market, mutual funds, gold, fixed deposits')
ON CONFLICT (id) DO UPDATE SET classification = 'asset', normal_balance = 'debit';

-- RLS permissions
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_all_access" ON public.categories;
CREATE POLICY "categories_all_access" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_accounts_all_access" ON public.financial_accounts;
CREATE POLICY "financial_accounts_all_access" ON public.financial_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);`;
    navigator.clipboard.writeText(sql);
    setCopiedMasterFix(true);
    setTimeout(() => setCopiedMasterFix(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Vault Settings &amp; Customization
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Customize categories, manage saving and income types, configure currency, and inspect database parameters.
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
                  onClick={() => openAddCategoryModal()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Category</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredCategories.filter(c => !c.parent_id).map(cat => {
              const isSaving = cat.type === 'saving' || cat.accounting_classification === 'asset_savings';
              const targetAcc = cat.target_savings_account_id ? accounts.find(a => a.id === cat.target_savings_account_id) : undefined;
              const subcats = categories.filter(c => c.parent_id === cat.id);

              return (
                <div
                  key={cat.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || (isSaving ? '#0d9488' : '#0284c7') }}
                        />
                        <div className="truncate min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                              {cat.name}
                            </span>
                            {isSaving && (
                              <span className="text-3xs font-bold px-1.5 py-0.2 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 shrink-0">
                                Saving Head
                              </span>
                            )}
                            {cat.type === 'income' && (
                              <span className="text-3xs font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                Income
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {canWrite && (
                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => openAddCategoryModal(cat.id)}
                            title="Add sub-category under this category"
                            className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 flex items-center gap-0.5"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>+ Sub</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditCategoryModal(cat)}
                            title="Edit category"
                            className="p-1 rounded text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(cat)}
                            title={cat.is_archived ? "Unarchive category" : "Archive category"}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            title="Delete category"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-3xs text-slate-400 mb-2 truncate">
                      {isSaving && targetAcc 
                        ? `Linked Asset Head: ${targetAcc.name}` 
                        : cat.accounting_classification?.replace('_', ' ') || cat.type}
                    </div>

                    {/* Nested Subcategories */}
                    {subcats.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                        <div className="text-3xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Sub-categories ({subcats.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {subcats.map(sub => (
                            <span
                              key={sub.id}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-3xs font-medium border border-slate-200 dark:border-slate-700"
                            >
                              <span>{sub.name}</span>
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCategory(sub);
                                  }}
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
              <div>13. /supabase/migrations/20261102000013_period_end_date_and_enhancements.sql (Period End Date &amp; Financial Enhancements)</div>
              <div>14. /supabase/migrations/20261102000014_single_user_demolish_workspaces.sql (Single-User Architecture &amp; RLS Simplification)</div>
              <div>15. /supabase/migrations/20261102000015_categories_subcategories_and_saving_heads.sql (Hierarchical Categories &amp; Saving Types)</div>
              <div>16. /supabase/migrations/20261102000016_fix_category_conflicts_and_cascade_deletes.sql (Conflict Dropping &amp; FK Cascade)</div>
              <div className="text-emerald-400 font-bold">17. /supabase/migrations/20261102000017_master_categories_and_saving_heads_fix.sql (Master Unified Fix - Recommended)</div>
            </div>

            {/* Master Fix Callout Box */}
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h4 className="text-xs font-bold text-white">
                      1-Click Master Fix for Categories, Saving Heads &amp; Cascading Deletes
                    </h4>
                  </div>
                  <p className="text-2xs text-slate-300 mt-1 leading-relaxed">
                    Fixes PostgREST 409 error 23505 (drops rigid unique constraint), check constraints for <code>saving</code> / <code>asset_savings</code>, and sets foreign key cascades so deleting categories never fails with 23503.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={copyMasterFixSql}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-xs"
                >
                  {copiedMasterFix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMasterFix ? 'Copied 1-Click Fix SQL!' : 'Copy 1-Click Master Fix SQL (Migration 17)'}</span>
                </button>

                <a
                  href="https://supabase.com/dashboard/project/apxbmwxovgpnttwprijw/sql"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>Open Supabase SQL Editor</span>
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={copyMigrationList}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
              >
                {copiedMigration ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMigration ? 'Copied Migration Order' : 'Copy All 17 Migration Files List'}</span>
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

            {saveError && (
              <div className="mb-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {saveError}
              </div>
            )}

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

              {/* Optional Parent Category for Sub-Categories */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Parent Category (Optional - select to create a Sub-Category)
                </label>
                <select
                  value={catParentId || ''}
                  onChange={(e) => setCatParentId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">None (Top-Level Category)</option>
                  {categories
                    .filter(c => !c.parent_id && c.id !== editingCategory?.id && (catType === 'saving' ? (c.type === 'saving' || c.accounting_classification === 'asset_savings') : c.type === catType))
                    .map(parent => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name} ({parent.type})
                      </option>
                    ))}
                </select>
                <p className="text-3xs text-slate-400 mt-1">
                  Select a parent to nest this as a subcategory, or leave as Top-Level.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Purpose (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly DPS scheme installment, Client freelance fee"
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
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
                  disabled={isSavingCat}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingCat && <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{editingCategory ? 'Update Category' : 'Create Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
