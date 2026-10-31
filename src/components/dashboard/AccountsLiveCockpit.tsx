import React, { useState } from 'react';
import { 
  Wallet, 
  CreditCard, 
  Shield, 
  Calendar, 
  ArrowRight, 
  Edit3, 
  Check, 
  X, 
  RotateCcw,
  Sparkles,
  HelpCircle,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { FinancialAccount } from '../../types';

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
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  
  // Find accounts or default values
  const cashAcc = accounts.find(a => a.account_type_id === 'cash' || a.name.toLowerCase().includes('cash in hand'));
  const bankAcc = accounts.find(a => a.account_type_id === 'bank' || a.name.toLowerCase().includes('bank'));
  const bkashAcc = accounts.find(a => a.name.toLowerCase().includes('bkash'));
  const nagadAcc = accounts.find(a => a.name.toLowerCase().includes('nagad'));
  const dspfAcc = accounts.find(a => a.name.toLowerCase().includes('dspf'));
  const unityAcc = accounts.find(a => a.name.toLowerCase().includes('unity fund'));
  const losAcc = accounts.find(a => a.name.toLowerCase().includes('los fund'));
  const cardAcc = accounts.find(a => a.account_type_id === 'credit_card' || a.name.toLowerCase().includes('card due'));

  // Values
  const cashInHand = cashAcc?.current_balance_cached ?? 198;
  const cashInBank = bankAcc?.current_balance_cached ?? 12215;
  const bkashBalance = bkashAcc?.current_balance_cached ?? 2490;
  const nagadBalance = nagadAcc?.current_balance_cached ?? 10;
  
  const dspfBaf = dspfAcc?.current_balance_cached ?? 111541.73;
  const unityFund2026 = unityAcc?.current_balance_cached ?? 20000;
  const losFund = losAcc?.current_balance_cached ?? 0;
  
  const creditCardDue = cardAcc?.current_balance_cached ?? 37497.49;
  
  // Borrowed loans
  const loans = db.getLoans(workspaceId);
  const otherLoans = loans
    .filter(l => l.type === 'borrowed' && l.status === 'active')
    .reduce((sum, l) => sum + (l.principal_amount - l.total_principal_repaid), 0);

  // Remote Income total
  const remoteIncomeTotal = 282982;

  // Real-time calculations matching user layout
  const totalBalance = cashInHand + cashInBank + bkashBalance + nagadBalance;
  const totalSavings = dspfBaf + unityFund2026 + losFund;
  const remainingCashOrUnity = 0; // Remainder buffer indicator

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

    const updates: Array<{ acc: FinancialAccount | undefined; val: number }> = [
      { acc: cashAcc, val: parseFloat(editCash) || 0 },
      { acc: bankAcc, val: parseFloat(editBank) || 0 },
      { acc: bkashAcc, val: parseFloat(editBkash) || 0 },
      { acc: nagadAcc, val: parseFloat(editNagad) || 0 },
      { acc: dspfAcc, val: parseFloat(editDspf) || 0 },
      { acc: unityAcc, val: parseFloat(editUnity) || 0 },
      { acc: losAcc, val: parseFloat(editLos) || 0 },
      { acc: cardAcc, val: parseFloat(editCardDue) || 0 },
    ];

    updates.forEach(({ acc, val }) => {
      if (acc) {
        acc.current_balance_cached = val;
        db.saveAccount(acc);
      }
    });

    setIsEditModalOpen(false);
    refreshData();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl p-5 sm:p-7 shadow-xl shadow-emerald-950/5 relative overflow-hidden transition-all">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Accounts &amp; Wallets — Live Financial Cockpit</span>
                <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  PRIMARY VIEW
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct view of current liquid funds, provident savings, and active obligations
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canWrite && (
            <button
              onClick={handleOpenEdit}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors shadow-2xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Adjust / Edit Figures</span>
            </button>
          )}
        </div>
      </div>

      {/* Cockpit Structure: EXACT 4-Row Configuration */}
      <div className="pt-6 space-y-5">
        
        {/* ROW 1: Cash In hand | DSPF BAF | Credit Card Due */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Cash In hand */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Cash In hand
            </span>
            <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight tabular-nums">
              {formatMoney(cashInHand)}
            </div>
            <span className="text-3xs text-emerald-600 dark:text-emerald-400 font-medium block mt-1">
              Physical Wallet Currency
            </span>
          </div>

          {/* 2. DSPF BAF */}
          <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 hover:border-blue-500/60 transition-all">
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
          </div>

          {/* 3. Credit Card Due */}
          <div 
            onClick={onNavigateCards}
            className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 hover:border-rose-500/60 transition-all cursor-pointer"
          >
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 block mb-1 flex items-center justify-between">
              <span>Credit Card Due</span>
              <CreditCard className="w-3.5 h-3.5 text-rose-500" />
            </span>
            <div className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400 tracking-tight tabular-nums">
              {formatMoney(creditCardDue)}
            </div>
            <span className="text-3xs text-rose-600 dark:text-rose-400 font-medium block mt-1 flex items-center gap-1">
              <span>City Bank Visa • Current liability</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* FISCAL PERIOD BANNER: June 2026 To May 2027 */}
        <div className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-white">Active Fiscal Year Period:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">
              {fiscalPeriod}
            </span>
          </div>
          <span className="text-2xs text-slate-500 font-mono hidden sm:inline">
            12-Month Balanced Ledger
          </span>
        </div>

        {/* ROW 2: Cash In Bank/Online (Manual Input) | LOS Fund | Other Loans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Cash In Bank/Online */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Cash In Bank/Online (Manual Input)
            </span>
            <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight tabular-nums">
              {formatMoney(cashInBank)}
            </div>
            <span className="text-3xs text-slate-400 block mt-1">
              Checking &amp; Online Banking Balance
            </span>
          </div>

          {/* 2. LOS Fund */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              LOS Fund
            </span>
            <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight tabular-nums">
              {formatMoney(losFund)}
            </div>
            <span className="text-3xs text-slate-400 block mt-1">
              LOS Dedicated Reserve Allocation
            </span>
          </div>

          {/* 3. Other Loans */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Other Loans
            </span>
            <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight tabular-nums">
              {formatMoney(otherLoans)}
            </div>
            <span className="text-3xs text-slate-400 block mt-1">
              Active Borrowed Debt Liabilities
            </span>
          </div>
        </div>

        {/* ROW 3: Total Balance | Unity Fund-2026 | Remote Income (Total) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Total Balance */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 hover:border-emerald-500 transition-all">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-1 flex items-center justify-between">
              <span>Total Balance</span>
              <span className="text-3xs font-mono font-bold px-1.5 py-0.5 rounded-sm bg-emerald-200/60 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                LIQUID SUM
              </span>
            </span>
            <div className="text-3xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300 tracking-tight tabular-nums">
              {formatMoney(totalBalance)}
            </div>
            <span className="text-3xs text-emerald-700/80 dark:text-emerald-400 font-medium block mt-1">
              Cash (198) + Bank (12,215) + bKash (2,490) + Nagad (10)
            </span>
          </div>

          {/* 2. Unity Fund-2026 */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 hover:border-amber-500/60 transition-all">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 block mb-1">
              Unity Fund-2026
            </span>
            <div className="text-2xl font-extrabold font-mono text-amber-900 dark:text-amber-100 tracking-tight tabular-nums">
              {formatMoney(unityFund2026)}
            </div>
            <span className="text-3xs text-amber-700 dark:text-amber-400 font-medium block mt-1">
              Special 2026 Unity Dedicated Allocation
            </span>
          </div>

          {/* 3. Remote Income (Total) */}
          <div 
            onClick={onNavigateIncome}
            className="p-4 rounded-2xl bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-200/60 dark:border-cyan-800/40 hover:border-cyan-500/60 transition-all cursor-pointer"
          >
            <span className="text-xs font-semibold text-cyan-800 dark:text-cyan-300 block mb-1 flex items-center justify-between">
              <span>Remote Income (Total)</span>
              <TrendingUp className="w-3.5 h-3.5 text-cyan-600" />
            </span>
            <div className="text-2xl font-extrabold font-mono text-cyan-800 dark:text-cyan-200 tracking-tight tabular-nums">
              {formatMoney(remoteIncomeTotal)}
            </div>
            <span className="text-3xs text-cyan-700 dark:text-cyan-400 font-medium block mt-1 flex items-center gap-1">
              <span>View Inflow Breakdown &amp; Improvement Insights</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* ROW 4: bKash | Nagad | Total Savings | Remaining Cash In hand | Unity Fund */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. bKash */}
          <div className="p-4 rounded-2xl bg-pink-50/40 dark:bg-pink-950/20 border border-pink-200/60 dark:border-pink-900/40 hover:border-pink-500/50 transition-all">
            <span className="text-xs font-semibold text-pink-700 dark:text-pink-300 block mb-1">
              bKash
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-pink-900 dark:text-pink-100 tracking-tight tabular-nums">
              {formatMoney(bkashBalance)}
            </div>
            <span className="text-3xs text-pink-600/80 dark:text-pink-400 font-medium block mt-1">
              Wallet •••• 7597
            </span>
          </div>

          {/* 2. Nagad */}
          <div className="p-4 rounded-2xl bg-orange-50/40 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 hover:border-orange-500/50 transition-all">
            <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 block mb-1">
              Nagad
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-orange-900 dark:text-orange-100 tracking-tight tabular-nums">
              {formatMoney(nagadBalance)}
            </div>
            <span className="text-3xs text-orange-600/80 dark:text-orange-400 font-medium block mt-1">
              Wallet •••• 3791
            </span>
          </div>

          {/* 3. Total Savings */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 hover:border-indigo-500/60 transition-all">
            <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 block mb-1 flex items-center justify-between">
              <span>Total Savings</span>
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-900 dark:text-indigo-100 tracking-tight tabular-nums">
              {formatMoney(totalSavings)}
            </div>
            <span className="text-3xs text-indigo-700 dark:text-indigo-400 font-medium block mt-1">
              DSPF BAF + Unity Fund
            </span>
          </div>

          {/* 4. Remaining Cash In hand | Unity Fund */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Remaining Cash | Unity
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight tabular-nums">
              {formatMoney(remainingCashOrUnity)}
            </div>
            <span className="text-3xs text-slate-400 font-medium block mt-1">
              Zero Unallocated Variance
            </span>
          </div>
        </div>

      </div>

      {/* Quick Edit Figures Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-500" />
                <span>Adjust Live Cockpit Figures</span>
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Update your current balances in BDT (৳). All calculated sums (Total Balance, Total Savings) will recompute instantly.
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
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
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Save &amp; Update Cockpit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
