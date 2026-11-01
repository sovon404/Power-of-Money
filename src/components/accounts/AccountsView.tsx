import React, { useState } from 'react';
import { 
  Plus, 
  ArrowRightLeft, 
  Wallet, 
  Archive, 
  Edit3, 
  Check, 
  X, 
  Smartphone, 
  Landmark, 
  Banknote,
  PiggyBank,
  TrendingUp,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { FinancialAccount } from '../../types';
import { NumericInput } from '../common/NumericInput';

export const AccountsView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId);
  const activeAccounts = accounts.filter(a => !a.is_archived);
  const archivedAccounts = accounts.filter(a => a.is_archived);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // New Account Form state
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('bank');
  const [provider, setProvider] = useState('BRAC Bank');
  const [accountMasked, setAccountMasked] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState('#0284c7');

  // Transfer Form state
  const [sourceAccId, setSourceAccId] = useState('');
  const [destAccId, setDestAccId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferMemo, setTransferMemo] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  // Edit Account Form state
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editProvider, setEditProvider] = useState('');
  const [editMasked, setEditMasked] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editColor, setEditColor] = useState('#0284c7');

  const openEditModal = (acc: FinancialAccount) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditProvider(acc.provider || '');
    setEditMasked(acc.account_number_masked || '');
    setEditBalance(acc.current_balance_cached.toString());
    setEditNotes(acc.notes || '');
    setEditColor(acc.color || '#0284c7');
  };

  const handleSaveEditAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || !editName.trim()) return;

    const updated: FinancialAccount = {
      ...editingAccount,
      name: editName.trim(),
      provider: editProvider.trim(),
      account_number_masked: editMasked.trim() || undefined,
      current_balance_cached: parseFloat(editBalance) || 0,
      notes: editNotes.trim() || undefined,
      color: editColor,
    };

    db.saveAccount(updated);
    refreshData();
    setEditingAccount(null);
  };

  const handleDeleteAccount = (acc: FinancialAccount) => {
    if (confirm(`Are you sure you want to delete account "${acc.name}"? This action cannot be undone.`)) {
      db.deleteAccount(acc.id, workspaceId);
      refreshData();
    }
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) return;

    const opBal = parseFloat(openingBalance) || 0;
    const newAccId = 'acc_' + Date.now();

    const newAcc: FinancialAccount = {
      id: newAccId,
      workspace_id: workspaceId,
      name: accountName.trim(),
      account_type_id: accountType,
      provider: provider.trim(),
      account_number_masked: accountMasked.trim() ? `•••• ${accountMasked.trim().slice(-4)}` : undefined,
      currency: currentWorkspace?.currency || 'BDT',
      opening_balance: opBal,
      opening_date: openingDate,
      current_balance_cached: opBal,
      is_archived: false,
      icon: accountType === 'mfs' ? 'smartphone' : accountType === 'cash' ? 'banknote' : 'landmark',
      color,
      notes: notes.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    db.saveAccount(newAcc);

    // If opening balance > 0, post opening balance double-entry transaction against Opening Equity
    if (opBal > 0) {
      db.postJournalEntry(workspaceId, {
        memo: `Opening Balance for ${newAcc.name}`,
        source_type: 'opening_balance',
        entry_date: openingDate,
        lines: [
          {
            account_id: newAccId,
            line_type: 'debit',
            amount: opBal,
            memo: 'Opening Asset Balance',
          },
          {
            account_id: newAccId, // in simplified model offset
            line_type: 'credit',
            amount: opBal,
            memo: 'Opening Equity Offset',
          },
        ],
      });
    }

    refreshData();
    setShowAddModal(false);
    resetForm();
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError('Please enter a valid transfer amount.');
      return;
    }

    if (!sourceAccId || !destAccId) {
      setTransferError('Please select both source and destination accounts.');
      return;
    }

    if (sourceAccId === destAccId) {
      setTransferError('Source and destination accounts must be different.');
      return;
    }

    const res = db.postTransfer(
      workspaceId,
      sourceAccId,
      destAccId,
      amt,
      transferDate,
      transferMemo.trim() || 'Account Transfer'
    );

    if (!res.success) {
      setTransferError(res.error || 'Failed to process transfer.');
      return;
    }

    refreshData();
    setShowTransferModal(false);
    setTransferAmount('');
    setTransferMemo('');
  };

  const toggleArchive = (acc: FinancialAccount) => {
    db.saveAccount({
      ...acc,
      is_archived: !acc.is_archived,
    });
    refreshData();
  };

  const resetForm = () => {
    setAccountName('');
    setAccountType('bank');
    setProvider('BRAC Bank');
    setAccountMasked('');
    setOpeningBalance('0.00');
    setNotes('');
  };

  const providerPresets = [
    'Cash', 'bKash', 'Nagad', 'Rocket', 'Upay',
    'BRAC Bank', 'Dutch-Bangla Bank', 'City Bank', 'Eastern Bank',
    'Islami Bank Bangladesh', 'Standard Chartered', 'Mutual Trust Bank',
    'Pubali Bank', 'Prime Bank', 'Other Bank'
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Accounts &amp; Mobile Financial Services
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage bank accounts, physical cash, bKash, Nagad, Rocket, Upay, and investments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transfer Funds</span>
          </button>

          {canWrite && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeAccounts.map(acc => {
          const isMfs = acc.account_type_id === 'mfs';
          const isCash = acc.account_type_id === 'cash';
          const isInvestment = acc.account_type_id === 'investment' || acc.account_type_id === 'savings_dps';

          return (
            <div
              key={acc.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-xs shrink-0"
                      style={{ backgroundColor: acc.color }}
                    >
                      {isMfs ? <Smartphone className="w-5 h-5" /> : isCash ? <Banknote className="w-5 h-5" /> : isInvestment ? <TrendingUp className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {acc.name}
                      </h4>
                      <span className="text-2xs text-slate-400 font-medium">
                        {acc.provider} {acc.account_number_masked ? `· ${acc.account_number_masked}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {canWrite && (
                      <>
                        <button
                          onClick={() => openEditModal(acc)}
                          title="Edit Account"
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc)}
                          title="Delete Account"
                          className="p-1 rounded-md text-rose-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => toggleArchive(acc)}
                      title="Archive Account"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="my-4">
                  <span className="text-2xs uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
                    Current Balance
                  </span>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums tracking-tight">
                    {formatMoney(acc.current_balance_cached)}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400">
                <span>Opened: {acc.opening_date}</span>
                <span className="capitalize">{acc.account_type_id.replace('_', ' ')}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Archived Accounts Toggle & List */}
      {archivedAccounts.length > 0 && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            {showArchived ? 'Hide' : 'Show'} Archived Accounts ({archivedAccounts.length})
          </button>

          {showArchived && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
              {archivedAccounts.map(acc => (
                <div
                  key={acc.id}
                  className="p-4 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 opacity-70"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        {acc.name} (Archived)
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {formatMoney(acc.current_balance_cached)}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleArchive(acc)}
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Financial Account or Wallet
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. BRAC Bank Salary, bKash Personal, Pocket Cash"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account Type
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="bank">Bank Checking/Savings</option>
                    <option value="mfs">Mobile Financial Services (bKash/Nagad)</option>
                    <option value="cash">Cash in Hand</option>
                    <option value="savings_dps">DPS / Term Deposit</option>
                    <option value="investment">Investment / Stocks</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Provider
                  </label>
                  <input
                    type="text"
                    list="provider-presets"
                    placeholder="e.g. bKash, BRAC Bank"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                  <datalist id="provider-presets">
                    {providerPresets.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Opening Balance ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <NumericInput
                    placeholder="0.00"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Masked Number (Last 4)
                  </label>
                  <NumericInput
                    allowDecimal={false}
                    maxLength={4}
                    placeholder="e.g. 7597"
                    value={accountMasked}
                    onChange={(e) => setAccountMasked(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Card Color Badge
                </label>
                <div className="flex items-center gap-2">
                  {['#0284c7', '#10b981', '#e11d48', '#f97316', '#8b5cf6', '#64748b'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-white ring-2 ring-emerald-500' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
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
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Funds Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Transfer Funds Between Accounts
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {transferError && (
              <div className="p-3 mb-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            <form onSubmit={handleTransfer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  From Account (Source Asset)
                </label>
                <select
                  value={sourceAccId}
                  onChange={(e) => setSourceAccId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  <option value="">Select source account</option>
                  {activeAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(a.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  To Account (Destination Asset)
                </label>
                <select
                  value={destAccId}
                  onChange={(e) => setDestAccId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  <option value="">Select destination account</option>
                  {activeAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(a.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <NumericInput
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Transfer Date
                  </label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Memo
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank to bKash add money, ATM cash withdrawal"
                  value={transferMemo}
                  onChange={(e) => setTransferMemo(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Financial Account
              </h3>
              <button
                onClick={() => setEditingAccount(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Provider
                  </label>
                  <input
                    type="text"
                    value={editProvider}
                    onChange={(e) => setEditProvider(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Masked Account #
                  </label>
                  <input
                    type="text"
                    value={editMasked}
                    onChange={(e) => setEditMasked(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Balance ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <NumericInput
                    placeholder="0.00"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Theme Color
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-xs font-mono text-slate-500">{editColor}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (editingAccount) handleDeleteAccount(editingAccount);
                    setEditingAccount(null);
                  }}
                  className="px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  Delete Account
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingAccount(null)}
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
