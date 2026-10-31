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
  ExternalLink
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { Category } from '../../types';
import { getSupabaseStatus } from '../../lib/supabase';

export const SettingsView: React.FC = () => {
  const { currentWorkspace, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const categories = db.getCategories(workspaceId);
  const supabaseStatus = getSupabaseStatus();

  const [activeTab, setActiveTab] = useState<'categories' | 'supabase' | 'general'>('categories');
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');
  const [newCatClassification, setNewCatClassification] = useState('expense_operating');
  const [newCatColor, setNewCatColor] = useState('#0284c7');
  const [copiedMigration, setCopiedMigration] = useState(false);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const newCat: Category = {
      id: 'cat_' + Date.now(),
      workspace_id: workspaceId,
      name: newCatName.trim(),
      type: newCatType,
      accounting_classification: newCatClassification as any,
      icon: 'tag',
      color: newCatColor,
      is_seed: false,
      is_archived: false,
      sort_order: categories.length + 1,
    };

    db.saveCategory(newCat);
    refreshData();
    setShowAddCatModal(false);
    setNewCatName('');
  };

  const handleToggleArchive = (cat: Category) => {
    db.saveCategory({
      ...cat,
      is_archived: !cat.is_archived,
    });
    refreshData();
  };

  const copyMigrationList = () => {
    const text = `-- Power of Money: Execute these migrations in Supabase SQL Editor in order:
1. 20261031000001_core_schema.sql
2. 20261031000002_accounting_ledger.sql
3. 20261031000003_banking_cards_loans.sql
4. 20261031000004_property_register.sql
5. 20261031000005_budgets_savings_recurring.sql
6. 20261031000006_accounting_functions_and_rpc.sql
7. 20261031000007_rls_and_storage_policies.sql
8. 20261031000008_security_and_integrity_tests.sql`;
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
            Customize the 36 seed categories, configure currency, and inspect Supabase PostgreSQL migrations.
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
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                36 User Seed Categories &amp; Custom Categories
              </h3>
              <p className="text-xs text-slate-500">
                All categories are fully editable, archivable, and bound to proper double-entry accounting classes.
              </p>
            </div>

            {canWrite && (
              <button
                onClick={() => setShowAddCatModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Category</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map(cat => (
              <div
                key={cat.id}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div className="truncate">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white truncate block">
                      {cat.name}
                    </span>
                    <span className="text-3xs text-slate-400 capitalize block truncate">
                      {cat.accounting_classification.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {canWrite && (
                  <button
                    onClick={() => handleToggleArchive(cat)}
                    title="Archive this category"
                    className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
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

      {/* Add Category Modal */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              Add Custom Financial Category
            </h3>

            <form onSubmit={handleCreateCategory} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Consulting Income, Vehicle Maintenance"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
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
                    value={newCatType}
                    onChange={(e: any) => setNewCatType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Accounting Class
                  </label>
                  <select
                    value={newCatClassification}
                    onChange={(e) => setNewCatClassification(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="expense_operating">Operating Expense</option>
                    <option value="expense_finance">Bank &amp; Finance Charge</option>
                    <option value="income_operating">Operating Income</option>
                    <option value="liability_reduction">Liability Reduction</option>
                    <option value="asset_transfer">Asset Transfer</option>
                  </select>
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
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
