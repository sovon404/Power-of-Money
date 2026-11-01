import React, { useState } from 'react';
import { 
  Wallet, 
  CreditCard, 
  Shield, 
  Calendar, 
  ArrowRight, 
  Edit3, 
  X, 
  TrendingUp,
  RefreshCw,
  Database,
  PlusCircle,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { FinancialAccount } from '../../types';
import { toUuid } from '../../lib/uuid';

interface AccountsLiveCockpitProps {
  onNavigateAccounts?: () => void;
  onNavigateIncome?: () => void;
  onNavigateCards?: () => void;
}

export const AccountsLiveCockpit: React.FC<AccountsLiveCockpitProps> = ({
  onNavigateAccounts,
  onNavigateIncome,
  onNavigateCards,
}) => {
  const { currentWorkspace, formatMoney, refreshData, canWrite, isSyncingWithDb, lastDbSyncTime, syncFromDatabase } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  
  // Find accounts strictly from database records
  const cashAcc = accounts.find(a => a.account_type_id === 'cash' || a.name.toLowerCase().includes('cash in hand'));
  const bankAcc = accounts.find(a => a.account_type_id === 'bank' || a.name.toLowerCase().includes('bank'));
  const bkashAcc = accounts.find(a => a.name.toLowerCase().includes('bkash'));
  const nagadAcc = accounts.find(a => a.name.toLowerCase().includes('nagad'));
  const dspfAcc = accounts.find(a => a.name.toLowerCase().includes('dspf'));
  const unityAcc = accounts.find(a => a.name.toLowerCase().includes('unity fund'));
  const losAcc = accounts.find(a => a.name.toLowerCase().includes('los fund'));
  const cardAcc = accounts.find(a => a.account_type_id === 'credit_card' || a.name.toLowerCase().includes('card due'));

  // Values: STRICTLY from database, zero dummy fallbacks
  const cashInHand = cashAcc?.current_balance_cached ?? 0;
  const cashInBank = bankAcc?.current_balance_cached ?? 0;
  const bkashBalance = bkashAcc?.current_balance_cached ?? 0;
  const nagadBalance = nagadAcc?.current_balance_cached ?? 0;
  
  const dspfBaf = dspfAcc?.current_balance_cached ?? 0;
  const unityFund2026 = unityAcc?.current_balance_cached ?? 0;
  const losFund = losAcc?.current_balance_cached ?? 0;
  
  const creditCardDue = cardAcc?.current_balance_cached ?? 0;
  
  // Borrowed loans strictly from DB
  const loans = db.getLoans(workspaceId);
  const otherLoans = loans
    .filter(l => l.type === 'borrowed' && l.status === 'active')
    .reduce((sum, l) => sum + (l.principal_amount - l.total_principal_repaid), 0);

  // Remote / Earned Income total calculated strictly from double-entry posted transactions
  const journalEntries = db.getJournalEntries(workspaceId);
  const categories = db.getCategories(workspaceId);
  const incomeCategoryIds = new Set(categories.filter(c => c.type === 'income').map(c => c.id));

  const remoteIncomeTotal = journalEntries
    .filter(e => e.status === 'posted')
    .reduce((sum, e) => {
      const entryIncome = e.lines?.reduce((lineSum, l) => {
        if (l.line_type === 'credit') {
          if ((l.category_id && incomeCategoryIds.has(l.category_id)) ||
              (l.memo && l.memo.toLowerCase().includes('remote')) ||
              (l.counterparty && l.counterparty.toLowerCase().includes('remote'))) {
            return lineSum + l.amount;
          }
        }
        return lineSum;
      }, 0) || 0;
      return sum + entryIncome;
    }, 0);

  // Real-time calculated sums
  const totalBalance = cashInHand + cashInBank + bkashBalance + nagadBalance;
  const totalSavings = dspfBaf + unityFund2026 + losFund;
  const remainingCashOrUnity = Math.max(0, cashInHand - unityFund2026);

  const hasAnyAccount = accounts.length > 0;

  // Inline Quick Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCash, setEditCash] = useState(cashInHand.toString());
  const [editBank, setEditBank] = useState(cashInBank.toString());
  const [editBkash, setEditBkash] = useState(bkashBalance.toString());
  const [editNagad, setEditNagad] = useState(nagadBalance.toString());
  const [editDspf, setEditDspf] = useState(dspfBaf.toString());
  const [editUnity, setEditUnity] = useState(unityFund2026.toString());
  const [editLos, setEditLos] = useState(losFund.toString());
  const [editCardDue, setEditCardDue] = useState(creditCardDue.toString());
  const [fiscalPeriod, setFiscalPeriod] = useState('June 2026 To May 2027');

  const handleOpenEdit = () => {
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
    if (!canWrite) return;

    const updates = [
      { acc: cashAcc, name: 'Cash in Hand', type: 'cash', provider: 'Cash', icon: 'banknote', color: '#10b981', val: parseFloat(editCash) || 0 },
      { acc: bankAcc, name: 'Cash In Bank/Online', type: 'bank', provider: 'BRAC / Online Banking', icon: 'landmark', color: '#0284c7', val: parseFloat(editBank) || 0 },
      { acc: bkashAcc, name: 'bKash', type: 'mfs', provider: 'bKash', icon: 'smartphone', color: '#e11d48', val: parseFloat(editBkash) || 0 },
      { acc: nagadAcc, name: 'Nagad', type: 'mfs', provider: 'Nagad', icon: 'smartphone', color: '#f97316', val: parseFloat(editNagad) || 0 },
      { acc: dspfAcc, name: 'DSPF BAF', type: 'savings_dps', provider: 'BAF Provident Fund', icon: 'shield', color: '#3b82f6', val: parseFloat(editDspf) || 0 },
      { acc: unityAcc, name: 'Unity Fund-2026', type: 'savings_dps', provider: 'Unity Special Allocation', icon: 'flag', color: '#eab308', val: parseFloat(editUnity) || 0 },
      { acc: losAcc, name: 'LOS Fund', type: 'savings_dps', provider: 'LOS Reserve', icon: 'lock', color: '#8b5cf6', val: parseFloat(editLos) || 0 },
      { acc: cardAcc, name: 'Credit Card Due', type: 'credit_card', provider: 'City Bank Visa', icon: 'credit-card', color: '#f43f5e', val: parseFloat(editCardDue) || 0 },
    ];

    updates.forEach(({ acc, name, type, provider, icon, color, val }) => {
      const accountToSave: FinancialAccount = acc ? {
        ...acc,
        current_balance_cached: val,
        opening_balance: acc.opening_balance || val,
      } : {
        id: toUuid(`acc_${type}_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${workspaceId}`),
        workspace_id: workspaceId,
        name,
        account_type_id: type,
        provider,
        currency: currentWorkspace?.currency || 'BDT',
        opening_balance: val,
        opening_date: new Date().toISOString().split('T')[0],
        current_balance_cached: val,
        is_archived: false,
        icon,
        color,
        created_at: new Date().toISOString(),
      };
      db.saveAccount(accountToSave);
    });

    setIsEditModalOpen(false);
    refreshData();
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: custom * 0.04, duration: 0.35, ease: 'easeOut' as const }
    })
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white dark:bg-slate-900 border-2 border-emerald-500/25 dark:border-emerald-500/20 rounded-3xl p-5 sm:p-7 shadow-xl shadow-emerald-950/5 relative overflow-hidden transition-all"
    >
      {/* Background subtle animated glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-800 gap-3 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <motion.div 
              whileHover={{ rotate: 12, scale: 1.05 }}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20"
            >
              <Wallet className="w-4 h-4" />
            </motion.div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Accounts &amp; Wallets — Live Financial Cockpit</span>
                <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  REAL DB DATA
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live financial position directly bound to your verified Supabase database
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Live DB Sync Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSyncingWithDb ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isSyncingWithDb ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300 text-2xs">
              {isSyncingWithDb ? 'Syncing...' : lastDbSyncTime ? `DB ${lastDbSyncTime}` : 'Supabase Active'}
            </span>
            <button
              onClick={() => syncFromDatabase()}
              disabled={isSyncingWithDb}
              title="Refresh from Supabase DB"
              className="ml-1 text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingWithDb ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
          </div>

          {canWrite && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleOpenEdit}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold transition-all shadow-sm shadow-emerald-600/20"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{hasAnyAccount ? 'Input / Adjust Figures' : 'Setup Your Accounts'}</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* If database has 0 accounts yet, show prompt */}
      {!hasAnyAccount && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex flex-col sm:flex-row items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                No Demo Data Active: Clean Slate from Database
              </p>
              <p className="text-2xs text-slate-600 dark:text-slate-400">
                All mock records are removed. Click &ldquo;Setup Your Accounts&rdquo; to input your real Cash in Hand, Bank, bKash, DSPF, and Cards.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenEdit}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 shadow-sm transition-all"
          >
            Input Figures Now
          </button>
        </motion.div>
      )}

      {/* Cockpit Structure: EXACT 4-Row Configuration */}
      <div className="pt-6 space-y-5 relative z-10">
        
        {/* ROW 1: Cash In hand | DSPF BAF | Credit Card Due */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Cash In hand */}
          <motion.div 
            custom={1}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:bg-slate-950/70 border border-emerald-500/20 dark:border-emerald-500/15 hover:border-emerald-500/50 transition-all shadow-xs"
          >
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1 flex items-center justify-between">
              <span>Cash In hand</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </span>
            <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
              {formatMoney(cashInHand)}
            </div>
            <span className="text-3xs text-emerald-700/80 dark:text-emerald-400/90 font-medium block mt-1">
              Physical Liquid Cash (Database)
            </span>
          </motion.div>

          {/* 2. DSPF BAF */}
          <motion.div 
            custom={2}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 hover:border-blue-500/60 transition-all shadow-xs"
          >
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-1 flex items-center justify-between">
              <span>DSPF BAF</span>
              <Shield className="w-3.5 h-3.5 text-blue-500" />
            </span>
            <div className="text-2xl font-extrabold font-mono text-blue-900 dark:text-blue-100 tracking-tight tabular-nums">
              {formatMoney(dspfBaf)}
            </div>
            <span className="text-3xs text-blue-600 dark:text-blue-400 font-medium block mt-1">
              BAF Provident Fund Principal &amp; Yield
            </span>
          </motion.div>

          {/* 3. Credit Card Due */}
          <motion.div 
            custom={3}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            onClick={onNavigateCards}
            className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 hover:border-rose-500/60 transition-all cursor-pointer shadow-xs"
          >
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 block mb-1 flex items-center justify-between">
              <span>Credit Card Due</span>
              <CreditCard className="w-3.5 h-3.5 text-rose-500" />
            </span>
            <div className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400 tracking-tight tabular-nums">
              {formatMoney(creditCardDue)}
            </div>
            <span className="text-3xs text-rose-600 dark:text-rose-400 font-medium block mt-1 flex items-center gap-1">
              <span>Current Liability • Card Ledger</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </motion.div>
        </div>

        {/* FISCAL PERIOD BANNER */}
        <motion.div 
          custom={4}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="py-2.5 px-4 rounded-xl bg-slate-100/90 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-white">Active Fiscal Period:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">
              {fiscalPeriod}
            </span>
          </div>
          <span className="text-2xs text-slate-500 font-mono hidden sm:inline">
            Direct Database Synced
          </span>
        </motion.div>

        {/* ROW 2: Cash In Bank/Online (Manual Input) | LOS Fund | Other Loans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Cash In Bank/Online */}
          <motion.div 
            custom={5}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-4 rounded-2xl bg-sky-50/50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/40 hover:border-sky-500/50 transition-all shadow-xs"
          >
            <span className="text-xs font-semibold text-sky-800 dark:text-sky-300 block mb-1">
              Cash In Bank/Online (Manual Input)
            </span>
            <div className="text-2xl font-extrabold font-mono text-sky-900 dark:text-sky-100 tracking-tight tabular-nums">
              {formatMoney(cashInBank)}
            </div>
            <span className="text-3xs text-sky-600/80 dark:text-sky-400 font-medium block mt-1">
              Checking &amp; Online Banking
            </span>
          </motion.div>

          {/* 2. LOS Fund */}
          <motion.div 
            custom={6}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 hover:border-purple-500/50 transition-all shadow-xs"
          >
            <span className="text-xs font-semibold text-purple-800 dark:text-purple-300 block mb-1">
              LOS Fund
            </span>
            <div className="text-2xl font-extrabold font-mono text-purple-900 dark:text-purple-100 tracking-tight tabular-nums">
              {formatMoney(losFund)}
            </div>
            <span className="text-3xs text-purple-600/80 dark:text-purple-400 font-medium block mt-1">
              Dedicated Reserve Allocation
            </span>
          </motion.div>

          {/* 3. Other Loans */}
          <motion.div 
            custom={7}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 hover:border-amber-500/50 transition-all shadow-xs"
          >
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 block mb-1">
              Other Loans
            </span>
            <div className="text-2xl font-extrabold font-mono text-amber-900 dark:text-amber-100 tracking-tight tabular-nums">
              {formatMoney(otherLoans)}
            </div>
            <span className="text-3xs text-amber-600/80 dark:text-amber-400 font-medium block mt-1">
              Active Borrowed Debt Liabilities
            </span>
          </motion.div>
        </div>

        {/* ROW 3: Total Balance | Unity Fund-2026 | Remote Income (Total) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Total Balance */}
          <motion.div 
            custom={8}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border-2 border-emerald-400/50 dark:border-emerald-600/50 hover:border-emerald-500 transition-all shadow-sm"
          >
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-1 flex items-center justify-between">
              <span>Total Balance</span>
              <span className="text-3xs font-mono font-bold px-1.5 py-0.5 rounded-sm bg-emerald-200/70 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                LIQUID SUM
              </span>
            </span>
            <div className="text-3xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300 tracking-tight tabular-nums">
              {formatMoney(totalBalance)}
            </div>
            <span className="text-3xs text-emerald-700/80 dark:text-emerald-400 font-medium block mt-1">
              Sum of Liquid Balances (Cash + Bank + bKash + Nagad)
            </span>
          </motion.div>

          {/* 2. Unity Fund-2026 */}
          <motion.div 
            custom={9}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-4 rounded-2xl bg-yellow-50/60 dark:bg-yellow-950/30 border border-yellow-200/60 dark:border-yellow-800/40 hover:border-yellow-500/60 transition-all shadow-xs"
          >
            <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 block mb-1">
              Unity Fund-2026
            </span>
            <div className="text-2xl font-extrabold font-mono text-yellow-900 dark:text-yellow-100 tracking-tight tabular-nums">
              {formatMoney(unityFund2026)}
            </div>
            <span className="text-3xs text-yellow-700 dark:text-yellow-400 font-medium block mt-1">
              Special 2026 Unity Allocation
            </span>
          </motion.div>

          {/* 3. Remote Income (Total) */}
          <motion.div 
            custom={10}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            onClick={onNavigateIncome}
            className="p-4 rounded-2xl bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-200/60 dark:border-cyan-800/40 hover:border-cyan-500/60 transition-all cursor-pointer shadow-xs"
          >
            <span className="text-xs font-semibold text-cyan-800 dark:text-cyan-300 block mb-1 flex items-center justify-between">
              <span>Remote Income (Total)</span>
              <TrendingUp className="w-3.5 h-3.5 text-cyan-600" />
            </span>
            <div className="text-2xl font-extrabold font-mono text-cyan-800 dark:text-cyan-200 tracking-tight tabular-nums">
              {formatMoney(remoteIncomeTotal)}
            </div>
            <span className="text-3xs text-cyan-700 dark:text-cyan-400 font-medium block mt-1 flex items-center gap-1">
              <span>View Inflow Breakdown &amp; Categories</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </motion.div>
        </div>

        {/* ROW 4: bKash | Nagad | Total Savings | Remaining Cash In hand | Unity Fund */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. bKash */}
          <motion.div 
            custom={11}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-4 rounded-2xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-200/60 dark:border-pink-900/40 hover:border-pink-500/50 transition-all shadow-xs"
          >
            <span className="text-xs font-semibold text-pink-700 dark:text-pink-300 block mb-1 flex items-center justify-between">
              <span>bKash</span>
              <span className="w-2 h-2 rounded-full bg-pink-500" />
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-pink-900 dark:text-pink-100 tracking-tight tabular-nums">
              {formatMoney(bkashBalance)}
            </div>
            <span className="text-3xs text-pink-600/80 dark:text-pink-400 font-medium block mt-1">
              MFS Liquid Balance
            </span>
          </motion.div>

          {/* 2. Nagad */}
          <motion.div 
            custom={12}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-4 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 hover:border-orange-500/50 transition-all shadow-xs"
          >
            <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 block mb-1 flex items-center justify-between">
              <span>Nagad</span>
              <span className="w-2 h-2 rounded-full bg-orange-500" />
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-orange-900 dark:text-orange-100 tracking-tight tabular-nums">
              {formatMoney(nagadBalance)}
            </div>
            <span className="text-3xs text-orange-600/80 dark:text-orange-400 font-medium block mt-1">
              MFS Liquid Balance
            </span>
          </motion.div>

          {/* 3. Total Savings */}
          <motion.div 
            custom={13}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 hover:border-indigo-500/60 transition-all shadow-xs"
          >
            <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 block mb-1 flex items-center justify-between">
              <span>Total Savings</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-900 dark:text-indigo-100 tracking-tight tabular-nums">
              {formatMoney(totalSavings)}
            </div>
            <span className="text-3xs text-indigo-700 dark:text-indigo-400 font-medium block mt-1">
              DSPF BAF + Unity + LOS
            </span>
          </motion.div>

          {/* 4. Remaining Cash In hand | Unity Fund */}
          <motion.div 
            custom={14}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all shadow-xs"
          >
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Remaining Cash | Unity
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight tabular-nums">
              {formatMoney(remainingCashOrUnity)}
            </div>
            <span className="text-3xs text-slate-400 font-medium block mt-1">
              Cash Buffer Indicator
            </span>
          </motion.div>
        </div>

      </div>

      {/* Quick Edit Figures Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-500" />
                  <span>Update Real Accounts in Supabase DB</span>
                </h3>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Enter your genuine current balances in BDT (৳). These accounts and figures will be saved and synchronized directly with your Supabase database.
              </p>

              <form onSubmit={handleSaveBalances} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Cash In hand (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editCash}
                      onChange={(e) => setEditCash(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Cash In Bank / Online (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editBank}
                      onChange={(e) => setEditBank(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      bKash Wallet (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editBkash}
                      onChange={(e) => setEditBkash(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nagad Wallet (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editNagad}
                      onChange={(e) => setEditNagad(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      DSPF BAF (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editDspf}
                      onChange={(e) => setEditDspf(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Credit Card Due (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editCardDue}
                      onChange={(e) => setEditCardDue(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Unity Fund-2026 (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editUnity}
                      onChange={(e) => setEditUnity(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      LOS Fund (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editLos}
                      onChange={(e) => setEditLos(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Active Fiscal Period
                  </label>
                  <input
                    type="text"
                    value={fiscalPeriod}
                    onChange={(e) => setFiscalPeriod(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
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
                    className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md shadow-emerald-600/20 transition-all"
                  >
                    Save &amp; Sync to Supabase
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
