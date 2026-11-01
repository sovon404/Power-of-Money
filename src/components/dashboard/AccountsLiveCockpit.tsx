import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  CreditCard, 
  Shield, 
  ArrowRight, 
  Edit3, 
  X, 
  RefreshCw,
  Landmark,
  Smartphone,
  PiggyBank,
  HandCoins,
  TrendingUp,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { FinancialAccount } from '../../types';
import { toUuid } from '../../lib/uuid';
import { NumericInput } from '../common/NumericInput';

interface AccountsLiveCockpitProps {
  onNavigateAccounts?: () => void;
  onNavigateIncome?: () => void;
  onNavigateCards?: () => void;
}

interface CockpitHeadLabels {
  cashInHand: string;
  cashInBank: string;
  bkash: string;
  nagad: string;
  dspf: string;
  unity: string;
  los: string;
  cardDue: string;
  otherLoans: string;
  income: string;
}

const DEFAULT_LABELS: CockpitHeadLabels = {
  cashInHand: 'Cash In Hand',
  cashInBank: 'Cash In Bank / Online',
  bkash: 'bKash Wallet',
  nagad: 'Nagad Wallet',
  dspf: 'DSPF (BAF)',
  unity: 'Unity Fund-2026',
  los: 'LOS Fund',
  cardDue: 'Credit Card Due',
  otherLoans: 'Other Loans (Payable)',
  income: 'Remote / Earned Revenue',
};

export const AccountsLiveCockpit: React.FC<AccountsLiveCockpitProps> = ({
  onNavigateAccounts,
  onNavigateIncome,
  onNavigateCards,
}) => {
  const { currentWorkspace, formatMoney, refreshData, canWrite, isSyncingWithDb, lastDbSyncTime, syncFromDatabase } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  // Customizable head names stored per workspace
  const [headLabels, setHeadLabels] = useState<CockpitHeadLabels>(() => {
    try {
      const saved = localStorage.getItem(`pom_cockpit_labels_${workspaceId}`);
      return saved ? { ...DEFAULT_LABELS, ...JSON.parse(saved) } : DEFAULT_LABELS;
    } catch {
      return DEFAULT_LABELS;
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pom_cockpit_labels_${workspaceId}`);
      if (saved) {
        setHeadLabels({ ...DEFAULT_LABELS, ...JSON.parse(saved) });
      } else {
        setHeadLabels(DEFAULT_LABELS);
      }
    } catch {
      setHeadLabels(DEFAULT_LABELS);
    }
  }, [workspaceId]);

  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  
  // Find accounts strictly from database records
  const cashAcc = accounts.find(a => a.account_type_id === 'cash' || a.name.toLowerCase().includes('cash'));
  const bankAcc = accounts.find(a => a.account_type_id === 'bank' || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('checking'));
  const bkashAcc = accounts.find(a => a.name.toLowerCase().includes('bkash'));
  const nagadAcc = accounts.find(a => a.name.toLowerCase().includes('nagad'));
  const dspfAcc = accounts.find(a => a.name.toLowerCase().includes('dspf'));
  const unityAcc = accounts.find(a => a.name.toLowerCase().includes('unity'));
  const losAcc = accounts.find(a => a.name.toLowerCase().includes('los'));
  const cardAcc = accounts.find(a => a.account_type_id === 'credit_card' || a.name.toLowerCase().includes('card due'));

  // Balances strictly from DB
  const cashInHand = cashAcc?.current_balance_cached ?? 0;
  const cashInBank = bankAcc?.current_balance_cached ?? 0;
  const bkashBalance = bkashAcc?.current_balance_cached ?? 0;
  const nagadBalance = nagadAcc?.current_balance_cached ?? 0;
  
  const dspfBaf = dspfAcc?.current_balance_cached ?? 0;
  const unityFund2026 = unityAcc?.current_balance_cached ?? 0;
  const losFund = losAcc?.current_balance_cached ?? 0;
  
  const creditCardDue = cardAcc?.current_balance_cached ?? 0;
  
  // Loans strictly from DB
  const loans = db.getLoans(workspaceId);
  const otherLoans = loans
    .filter(l => l.type === 'borrowed' && l.status === 'active')
    .reduce((sum, l) => sum + (l.principal_amount - l.total_principal_repaid), 0);

  // Posted income from double-entry ledger lines
  const journalEntries = db.getJournalEntries(workspaceId);
  const categories = db.getCategories(workspaceId);
  const incomeCategoryIds = new Set(categories.filter(c => c.type === 'income').map(c => c.id));

  const remoteIncomeTotal = journalEntries
    .filter(e => e.status === 'posted')
    .reduce((sum, e) => {
      const entryIncome = e.lines?.reduce((lineSum, l) => {
        if (l.line_type === 'credit') {
          if (l.category_id && incomeCategoryIds.has(l.category_id)) {
            return lineSum + l.amount;
          }
        }
        return lineSum;
      }, 0) || 0;
      return sum + entryIncome;
    }, 0);

  // Grouped Calculations
  const totalLiquid = cashInHand + cashInBank + bkashBalance + nagadBalance;
  const totalSavings = dspfBaf + unityFund2026 + losFund;
  const totalLiabilities = creditCardDue + otherLoans;

  // Inline Quick Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Form values
  const [editLabels, setEditLabels] = useState<CockpitHeadLabels>(headLabels);
  const [editCash, setEditCash] = useState(cashInHand.toString());
  const [editBank, setEditBank] = useState(cashInBank.toString());
  const [editBkash, setEditBkash] = useState(bkashBalance.toString());
  const [editNagad, setEditNagad] = useState(nagadBalance.toString());
  const [editDspf, setEditDspf] = useState(dspfBaf.toString());
  const [editUnity, setEditUnity] = useState(unityFund2026.toString());
  const [editLos, setEditLos] = useState(losFund.toString());
  const [editCardDue, setEditCardDue] = useState(creditCardDue.toString());

  const handleOpenEdit = () => {
    setEditLabels(headLabels);
    setEditCash(cashInHand.toString());
    setEditBank(cashInBank.toString());
    setEditBkash(bkashBalance.toString());
    setEditNagad(nagadBalance.toString());
    setEditDspf(dspfBaf.toString());
    setEditUnity(unityFund2026.toString());
    setEditLos(losFund.toString());
    setEditCardDue(creditCardDue.toString());
    setIsEditModalOpen(true);
  };

  const handleSaveBalances = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Save custom head labels
    setHeadLabels(editLabels);
    try {
      localStorage.setItem(`pom_cockpit_labels_${workspaceId}`, JSON.stringify(editLabels));
    } catch (err) {
      console.warn('Failed to save cockpit labels:', err);
    }

    // 2. Helper to upsert financial accounts with new names and balances
    const updateOrCreateAccount = (
      existingAcc: FinancialAccount | undefined,
      defaultId: string,
      name: string,
      typeId: string,
      provider: string,
      balance: number,
      color: string,
      icon: string
    ) => {
      const accId = existingAcc?.id || toUuid(defaultId);
      const acc: FinancialAccount = {
        id: accId,
        workspace_id: workspaceId,
        name,
        account_type_id: typeId,
        provider,
        currency: currentWorkspace?.currency || 'BDT',
        opening_balance: existingAcc?.opening_balance ?? balance,
        opening_date: existingAcc?.opening_date ?? new Date().toISOString().split('T')[0],
        current_balance_cached: balance,
        is_archived: false,
        icon,
        color,
        created_at: existingAcc?.created_at ?? new Date().toISOString(),
      };
      db.saveAccount(acc);
    };

    updateOrCreateAccount(cashAcc, `acc_cash_hand_${workspaceId}`, editLabels.cashInHand, 'cash', 'Cash', parseFloat(editCash) || 0, '#10b981', 'banknote');
    updateOrCreateAccount(bankAcc, `acc_bank_online_${workspaceId}`, editLabels.cashInBank, 'bank', 'Bank', parseFloat(editBank) || 0, '#0284c7', 'landmark');
    updateOrCreateAccount(bkashAcc, `acc_bkash_wallet_${workspaceId}`, editLabels.bkash, 'mfs', 'bKash', parseFloat(editBkash) || 0, '#e11d48', 'smartphone');
    updateOrCreateAccount(nagadAcc, `acc_nagad_wallet_${workspaceId}`, editLabels.nagad, 'mfs', 'Nagad', parseFloat(editNagad) || 0, '#ea580c', 'smartphone');
    updateOrCreateAccount(dspfAcc, `acc_dspf_baf_${workspaceId}`, editLabels.dspf, 'savings_dps', 'BAF / DSPF', parseFloat(editDspf) || 0, '#0d9488', 'piggy-bank');
    updateOrCreateAccount(unityAcc, `acc_unity_fund_${workspaceId}`, editLabels.unity, 'savings_dps', 'Unity Fund', parseFloat(editUnity) || 0, '#eab308', 'flag');
    updateOrCreateAccount(losAcc, `acc_los_fund_${workspaceId}`, editLabels.los, 'liability_reduction', 'LOS Fund', parseFloat(editLos) || 0, '#9333ea', 'layers');
    updateOrCreateAccount(cardAcc, `acc_card_due_${workspaceId}`, editLabels.cardDue, 'credit_card', 'Credit Card Due', parseFloat(editCardDue) || 0, '#e11d48', 'credit-card');

    refreshData();
    setIsEditModalOpen(false);
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-6">
      {/* Clean Top Header (Removed all promotional / extra text) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Accounts &amp; Wallets Cockpit
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => syncFromDatabase()}
            disabled={isSyncingWithDb}
            title={lastDbSyncTime ? `Synced at ${lastDbSyncTime}. Click to refresh.` : 'Sync with DB'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-500 ${isSyncingWithDb ? 'animate-spin' : ''}`} />
            <span>{isSyncingWithDb ? 'Syncing...' : 'Sync DB'}</span>
          </button>

          {canWrite && (
            <button
              onClick={handleOpenEdit}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold transition-all shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Heads &amp; Balances</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* GROUP 1: LIQUID FUNDS & MOBILE WALLETS                   */}
      {/* ======================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Liquid Funds &amp; Mobile Wallets
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
            Subtotal: {formatMoney(totalLiquid)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Cash In Hand */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-2xs font-semibold truncate">{headLabels.cashInHand}</span>
              <Wallet className="w-4 h-4 text-emerald-500 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {formatMoney(cashInHand)}
            </div>
          </div>

          {/* Cash In Bank / Online */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-2xs font-semibold truncate">{headLabels.cashInBank}</span>
              <Landmark className="w-4 h-4 text-blue-500 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {formatMoney(cashInBank)}
            </div>
          </div>

          {/* bKash Wallet */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-2xs font-semibold truncate">{headLabels.bkash}</span>
              <Smartphone className="w-4 h-4 text-pink-500 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {formatMoney(bkashBalance)}
            </div>
          </div>

          {/* Nagad Wallet */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-2xs font-semibold truncate">{headLabels.nagad}</span>
              <Smartphone className="w-4 h-4 text-orange-500 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {formatMoney(nagadBalance)}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* GROUP 2: DEDICATED SAVINGS & RETAINED FUNDS              */}
      {/* ======================================================== */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Dedicated Savings &amp; Reserved Funds
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
            Subtotal: {formatMoney(totalSavings)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* DSPF (BAF) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-2xs font-semibold truncate">{headLabels.dspf}</span>
              <PiggyBank className="w-4 h-4 text-teal-500 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {formatMoney(dspfBaf)}
            </div>
          </div>

          {/* Unity Fund */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-2xs font-semibold truncate">{headLabels.unity}</span>
              <Shield className="w-4 h-4 text-amber-500 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {formatMoney(unityFund2026)}
            </div>
          </div>

          {/* LOS Fund */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-2xs font-semibold truncate">{headLabels.los}</span>
              <Layers className="w-4 h-4 text-purple-500 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {formatMoney(losFund)}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* GROUP 3: LIABILITIES & COMMITMENTS                       */}
      {/* ======================================================== */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Liabilities &amp; Obligations
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
            Total Dues: {formatMoney(totalLiabilities)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Credit Card Due */}
          <div 
            onClick={onNavigateCards}
            className="p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex flex-col justify-between cursor-pointer hover:border-rose-300 transition-colors"
          >
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
              <span className="text-2xs font-semibold truncate">{headLabels.cardDue}</span>
              <CreditCard className="w-4 h-4 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
              {formatMoney(creditCardDue)}
            </div>
          </div>

          {/* Other Loans Borrowed */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-2xs font-semibold truncate">{headLabels.otherLoans}</span>
              <HandCoins className="w-4 h-4 text-rose-400 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {formatMoney(otherLoans)}
            </div>
          </div>

          {/* Revenue Inflow Snapshot */}
          <div 
            onClick={onNavigateIncome}
            className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex flex-col justify-between cursor-pointer hover:border-emerald-300 transition-colors"
          >
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
              <span className="text-2xs font-semibold truncate">{headLabels.income}</span>
              <TrendingUp className="w-4 h-4 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatMoney(remoteIncomeTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Head Names & Balances Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl my-8"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Customize Cockpit Heads &amp; Balances
                  </h3>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Edit the display title of any head and adjust its balance with instant database synchronization.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBalances} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* 1. Cash In Hand */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Head 1 Name
                    </label>
                    <input
                      type="text"
                      value={editLabels.cashInHand}
                      onChange={(e) => setEditLabels({ ...editLabels, cashInHand: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Balance (BDT ৳)
                    </label>
                    <NumericInput
                      placeholder="0.00"
                      value={editCash}
                      onChange={(e) => setEditCash(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                {/* 2. Bank / Online */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Head 2 Name
                    </label>
                    <input
                      type="text"
                      value={editLabels.cashInBank}
                      onChange={(e) => setEditLabels({ ...editLabels, cashInBank: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Balance (BDT ৳)
                    </label>
                    <NumericInput
                      placeholder="0.00"
                      value={editBank}
                      onChange={(e) => setEditBank(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                {/* 3. bKash */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Head 3 Name
                    </label>
                    <input
                      type="text"
                      value={editLabels.bkash}
                      onChange={(e) => setEditLabels({ ...editLabels, bkash: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Balance (BDT ৳)
                    </label>
                    <NumericInput
                      placeholder="0.00"
                      value={editBkash}
                      onChange={(e) => setEditBkash(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                {/* 4. Nagad */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Head 4 Name
                    </label>
                    <input
                      type="text"
                      value={editLabels.nagad}
                      onChange={(e) => setEditLabels({ ...editLabels, nagad: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Balance (BDT ৳)
                    </label>
                    <NumericInput
                      placeholder="0.00"
                      value={editNagad}
                      onChange={(e) => setEditNagad(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                {/* 5. DSPF (BAF) */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Head 5 Name
                    </label>
                    <input
                      type="text"
                      value={editLabels.dspf}
                      onChange={(e) => setEditLabels({ ...editLabels, dspf: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Balance (BDT ৳)
                    </label>
                    <NumericInput
                      placeholder="0.00"
                      value={editDspf}
                      onChange={(e) => setEditDspf(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                {/* 6. Unity Fund */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Head 6 Name
                    </label>
                    <input
                      type="text"
                      value={editLabels.unity}
                      onChange={(e) => setEditLabels({ ...editLabels, unity: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Balance (BDT ৳)
                    </label>
                    <NumericInput
                      placeholder="0.00"
                      value={editUnity}
                      onChange={(e) => setEditUnity(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                {/* 7. LOS Fund */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Head 7 Name
                    </label>
                    <input
                      type="text"
                      value={editLabels.los}
                      onChange={(e) => setEditLabels({ ...editLabels, los: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Balance (BDT ৳)
                    </label>
                    <NumericInput
                      placeholder="0.00"
                      value={editLos}
                      onChange={(e) => setEditLos(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                {/* 8. Credit Card Due */}
                <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-rose-700 dark:text-rose-400 mb-1">
                      Head 8 Name
                    </label>
                    <input
                      type="text"
                      value={editLabels.cardDue}
                      onChange={(e) => setEditLabels({ ...editLabels, cardDue: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-rose-700 dark:text-rose-400 mb-1">
                      Due Amount (BDT ৳)
                    </label>
                    <NumericInput
                      placeholder="0.00"
                      value={editCardDue}
                      onChange={(e) => setEditCardDue(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-xs transition-all"
                  >
                    Save &amp; Sync to Database
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
