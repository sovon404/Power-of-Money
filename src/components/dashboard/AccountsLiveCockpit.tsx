import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  CreditCard, 
  Shield, 
  Edit3, 
  X, 
  RefreshCw,
  Landmark,
  Smartphone,
  PiggyBank,
  HandCoins,
  TrendingUp,
  Layers,
  Plus,
  Trash2,
  Check,
  Banknote,
  Flag,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  CircleDollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { FinancialAccount } from '../../types';
import { generateUuid, toUuid } from '../../lib/uuid';
import { NumericInput } from '../common/NumericInput';

interface AccountsLiveCockpitProps {
  onNavigateAccounts?: () => void;
  onNavigateIncome?: () => void;
  onNavigateCards?: () => void;
  onNavigateLoans?: () => void;
  onNavigateSavings?: () => void;
  onRemoveWidget?: () => void;
}

type HeadCategoryGroup = 'liquid' | 'savings' | 'liability';

export const AccountsLiveCockpit: React.FC<AccountsLiveCockpitProps> = ({
  onNavigateAccounts,
  onNavigateIncome,
  onNavigateCards,
  onNavigateLoans,
  onNavigateSavings,
  onRemoveWidget,
}) => {
  const { currentWorkspace, formatMoney, refreshData, canWrite, isSyncingWithDb, lastDbSyncTime, syncFromDatabase } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';


  // 1. Fetch real active accounts from database
  const allAccounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);

  // Group accounts dynamically
  const liquidAccounts = allAccounts.filter(a => ['cash', 'bank', 'mfs'].includes(a.account_type_id));
  const savingsAccounts = allAccounts.filter(a => ['savings_dps', 'investment'].includes(a.account_type_id));
  const liabilityAccounts = allAccounts.filter(a => ['credit_card', 'loan_payable'].includes(a.account_type_id));

  // 2. Fetch credit cards from Credit Cards module
  const creditCards = db.getCreditCards(workspaceId);
  const totalCreditCardsDue = creditCards.reduce((sum, c) => {
    const cardAcc = allAccounts.find(a => a.id === c.account_id);
    return sum + (cardAcc?.current_balance_cached || 0);
  }, 0);

  // 3. Fetch active loans from Loans module
  const loans = db.getLoans(workspaceId);
  const activeBorrowedLoans = loans.filter(l => l.type === 'borrowed' && l.status === 'active');
  const totalLoansBorrowed = activeBorrowedLoans.reduce((sum, l) => sum + Math.max(0, l.principal_amount - l.total_principal_repaid), 0);
  
  const activeLentLoans = loans.filter(l => l.type === 'lent' && l.status === 'active');
  const totalMoneyLent = activeLentLoans.reduce((sum, l) => sum + Math.max(0, l.principal_amount - l.total_principal_repaid), 0);

  // 4. Fetch income transactions from posted journal entries
  const journalEntries = db.getJournalEntries(workspaceId);
  const categories = db.getCategories(workspaceId);
  const incomeCategoryIds = new Set(categories.filter(c => c.type === 'income').map(c => c.id));
  const defaultIncomeAccUuid = toUuid(`acc_income_earned_${workspaceId}`);

  const totalEarnedRevenue = journalEntries
    .filter(e => e.status === 'posted' && e.source_type !== 'transfer' && e.source_type !== 'opening_balance')
    .reduce((sum, e) => {
      const incomeLine = e.lines?.find(l => 
        (l.line_type === 'credit' && (
          (l.category_id && incomeCategoryIds.has(l.category_id)) ||
          l.account_id === defaultIncomeAccUuid ||
          allAccounts.find(a => a.id === l.account_id)?.account_type_id?.startsWith('income') ||
          l.memo?.toLowerCase().includes('salary') ||
          l.memo?.toLowerCase().includes('income') ||
          l.memo?.toLowerCase().includes('freelance') ||
          l.memo?.toLowerCase().includes('mortgage')
        )) ||
        (l.category_id && incomeCategoryIds.has(l.category_id))
      );
      if (incomeLine) {
        return sum + Number(incomeLine.amount);
      }
      return sum;
    }, 0);

  // Dynamic Subtotals
  const totalLiquid = liquidAccounts.reduce((sum, a) => sum + (Number(a.current_balance_cached) || 0), 0);
  const totalSavings = savingsAccounts.reduce((sum, a) => sum + (Number(a.current_balance_cached) || 0), 0);
  
  // Total Liabilities = Credit Card Dues + Active Loans + Custom Liability Accounts
  const liabilityAccountsTotal = liabilityAccounts
    .filter(a => a.name.toLowerCase() !== 'credit card due') // avoid double counting if card due account mirrors credit cards
    .reduce((sum, a) => sum + (Number(a.current_balance_cached) || 0), 0);

  const effectiveCreditCardDue = totalCreditCardsDue > 0 
    ? totalCreditCardsDue 
    : (liabilityAccounts.find(a => a.account_type_id === 'credit_card')?.current_balance_cached || 0);

  const totalLiabilities = effectiveCreditCardDue + totalLoansBorrowed + liabilityAccountsTotal;
  const netLiquidPosition = totalLiquid + totalSavings - totalLiabilities;

  // Modals state
  const [isAddHeadModalOpen, setIsAddHeadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // New Head Form State
  const [newHeadGroup, setNewHeadGroup] = useState<HeadCategoryGroup>('liquid');
  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadProvider, setNewHeadProvider] = useState('Bank');
  const [newHeadBalance, setNewHeadBalance] = useState('0.00');
  const [newHeadColor, setNewHeadColor] = useState('#0284c7');
  const [newHeadIcon, setNewHeadIcon] = useState('wallet');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Heads & Balances State
  const [editAccountsList, setEditAccountsList] = useState<FinancialAccount[]>([]);

  const handleOpenAddHead = (defaultGroup: HeadCategoryGroup = 'liquid') => {
    setNewHeadGroup(defaultGroup);
    setNewHeadName('');
    setNewHeadBalance('0.00');
    if (defaultGroup === 'liquid') {
      setNewHeadProvider('Bank');
      setNewHeadColor('#0284c7');
      setNewHeadIcon('landmark');
    } else if (defaultGroup === 'savings') {
      setNewHeadProvider('Savings Fund');
      setNewHeadColor('#0d9488');
      setNewHeadIcon('piggy-bank');
    } else {
      setNewHeadProvider('Credit Card');
      setNewHeadColor('#e11d48');
      setNewHeadIcon('credit-card');
    }
    setIsAddHeadModalOpen(true);
  };

  const handleSaveNewHead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHeadName.trim()) return;

    setIsSubmitting(true);
    try {
      const balanceNum = parseFloat(newHeadBalance) || 0;
      let accountTypeId = 'bank';
      if (newHeadGroup === 'liquid') {
        const lowerName = newHeadName.toLowerCase();
        if (lowerName.includes('cash')) accountTypeId = 'cash';
        else if (lowerName.includes('bkash') || lowerName.includes('nagad') || lowerName.includes('wallet') || lowerName.includes('rocket')) accountTypeId = 'mfs';
        else accountTypeId = 'bank';
      } else if (newHeadGroup === 'savings') {
        accountTypeId = 'savings_dps';
      } else {
        accountTypeId = newHeadName.toLowerCase().includes('card') ? 'credit_card' : 'loan_payable';
      }

      const newAccId = generateUuid();
      const newAccount: FinancialAccount = {
        id: newAccId,
        workspace_id: workspaceId,
        name: newHeadName.trim(),
        account_type_id: accountTypeId,
        provider: newHeadProvider.trim() || 'General',
        currency: currentWorkspace?.currency || 'BDT',
        opening_balance: balanceNum,
        opening_date: new Date().toISOString().split('T')[0],
        current_balance_cached: balanceNum,
        is_archived: false,
        icon: newHeadIcon,
        color: newHeadColor,
        created_at: new Date().toISOString(),
      };

      db.saveAccount(newAccount);

      // If starting balance > 0, establish double-entry offset against Opening Balance Equity
      if (balanceNum > 0) {
        const equityAccId = toUuid(`acc_equity_offset_${workspaceId}`);
        const isDebitNormal = ['cash', 'bank', 'mfs', 'savings_dps', 'investment'].includes(accountTypeId);
        
        db.postJournalEntry(workspaceId, {
          memo: `Initial opening balance for ${newAccount.name}`,
          source_type: 'opening_balance',
          entry_date: new Date().toISOString().split('T')[0],
          lines: isDebitNormal
            ? [
                { account_id: newAccId, line_type: 'debit', amount: balanceNum, memo: `${newAccount.name} Opening Position` },
                { account_id: equityAccId, line_type: 'credit', amount: balanceNum, memo: 'Opening Equity Offset' },
              ]
            : [
                { account_id: equityAccId, line_type: 'debit', amount: balanceNum, memo: 'Opening Equity Offset' },
                { account_id: newAccId, line_type: 'credit', amount: balanceNum, memo: `${newAccount.name} Initial Obligation` },
              ],
        });
      }

      refreshData();
      setIsAddHeadModalOpen(false);
    } catch (err) {
      console.error('Error creating new head:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = () => {
    // Clone all current active accounts
    const cloned = allAccounts.map(a => ({ ...a }));
    setEditAccountsList(cloned);
    setIsEditModalOpen(true);
  };

  const handleUpdateEditAccount = (id: string, field: 'name' | 'current_balance_cached', value: any) => {
    setEditAccountsList(prev => prev.map(a => {
      if (a.id === id) {
        return { ...a, [field]: value };
      }
      return a;
    }));
  };

  const handleSaveEditedAccounts = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const equityAccId = toUuid(`acc_equity_offset_${workspaceId}`);
      for (const acc of editAccountsList) {
        const original = allAccounts.find(a => a.id === acc.id);
        const originalBal = Number(original?.current_balance_cached) || 0;
        const newBal = Number(acc.current_balance_cached) || 0;
        const diff = Math.round((newBal - originalBal) * 100) / 100;

        db.saveAccount({
          ...acc,
          current_balance_cached: newBal,
        });

        // If user changed the balance, establish a balancing calibration journal entry
        if (Math.abs(diff) > 0.001) {
          const isDebitNormal = ['cash', 'bank', 'mfs', 'savings_dps', 'investment', 'receivable'].includes(acc.account_type_id);
          const isIncrease = diff > 0;
          const absDiff = Math.abs(diff);

          let debitAcc = equityAccId;
          let creditAcc = acc.id;

          if (isDebitNormal) {
            debitAcc = isIncrease ? acc.id : equityAccId;
            creditAcc = isIncrease ? equityAccId : acc.id;
          } else {
            debitAcc = isIncrease ? equityAccId : acc.id;
            creditAcc = isIncrease ? acc.id : equityAccId;
          }

          db.postJournalEntry(workspaceId, {
            memo: `Balance calibration for ${acc.name}`,
            source_type: 'opening_balance',
            entry_date: new Date().toISOString().split('T')[0],
            lines: [
              { account_id: debitAcc, line_type: 'debit', amount: absDiff, memo: `Calibrate ${acc.name}` },
              { account_id: creditAcc, line_type: 'credit', amount: absDiff, memo: `Calibrate ${acc.name} Offset` },
            ],
          });
        }
      }
      refreshData();
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Failed to save edited accounts:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomAccount = (accountId: string) => {
    if (confirm('Are you sure you want to archive this head? Historical journal transactions will be retained.')) {
      db.deleteAccount(accountId, workspaceId);
      setEditAccountsList(prev => prev.filter(a => a.id !== accountId));
      refreshData();
    }
  };

  // Helper icon renderer
  const getHeadIcon = (acc: FinancialAccount) => {
    const nameLower = acc.name.toLowerCase();
    const type = acc.account_type_id;

    if (acc.icon === 'smartphone' || type === 'mfs' || nameLower.includes('bkash') || nameLower.includes('nagad') || nameLower.includes('rocket')) {
      return <Smartphone className="w-4 h-4 shrink-0" style={{ color: acc.color }} />;
    }
    if (acc.icon === 'landmark' || type === 'bank' || nameLower.includes('bank')) {
      return <Landmark className="w-4 h-4 shrink-0" style={{ color: acc.color }} />;
    }
    if (acc.icon === 'piggy-bank' || type === 'savings_dps' || nameLower.includes('dps') || nameLower.includes('dspf')) {
      return <PiggyBank className="w-4 h-4 shrink-0" style={{ color: acc.color }} />;
    }
    if (acc.icon === 'flag' || nameLower.includes('unity')) {
      return <Flag className="w-4 h-4 shrink-0" style={{ color: acc.color }} />;
    }
    if (acc.icon === 'layers' || nameLower.includes('los')) {
      return <Layers className="w-4 h-4 shrink-0" style={{ color: acc.color }} />;
    }
    if (acc.icon === 'credit-card' || type === 'credit_card' || nameLower.includes('card')) {
      return <CreditCard className="w-4 h-4 shrink-0 text-rose-500" />;
    }
    return <Banknote className="w-4 h-4 shrink-0" style={{ color: acc.color }} />;
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                Accounts &amp; Wallets Cockpit
              </h2>
              <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                Live Dynamic
              </span>
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
              Net Working Position: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatMoney(netLiquidPosition)}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Sync DB */}
          <button
            onClick={() => syncFromDatabase()}
            disabled={isSyncingWithDb}
            title={lastDbSyncTime ? `Synced at ${lastDbSyncTime}. Click to refresh.` : 'Sync with DB'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-500 ${isSyncingWithDb ? 'animate-spin' : ''}`} />
            <span>{isSyncingWithDb ? 'Syncing...' : 'Sync DB'}</span>
          </button>

          {canWrite && (
            <>
              {/* Add New Head */}
              <button
                onClick={() => handleOpenAddHead('liquid')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-semibold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Head</span>
              </button>

              {/* Edit Heads & Balances */}
              <button
                onClick={handleOpenEditModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Heads &amp; Balances</span>
              </button>
            </>
          )}

          {onRemoveWidget && (
            <button
              onClick={onRemoveWidget}
              title="Hide Cockpit Widget from Dashboard"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
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
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Liquid Funds &amp; Mobile Wallets
            </h3>
            <span className="text-2xs text-slate-400 font-medium">({liquidAccounts.length} heads)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
              Subtotal: {formatMoney(totalLiquid)}
            </span>
            {canWrite && (
              <button
                onClick={() => handleOpenAddHead('liquid')}
                className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />
                <span>New Wallet</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {liquidAccounts.map(acc => (
            <div 
              key={acc.id}
              onClick={onNavigateAccounts}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between hover:border-emerald-500/40 transition-all cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-2xs font-semibold truncate text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {acc.name}
                </span>
                {getHeadIcon(acc)}
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                  {formatMoney(acc.current_balance_cached)}
                </div>
                <div className="text-2xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>{acc.provider}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 group-hover:underline">Manage &rarr;</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* GROUP 2: DEDICATED SAVINGS & RESERVED FUNDS              */}
      {/* ======================================================== */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 ring-2 ring-teal-500/20" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Dedicated Savings &amp; Reserved Funds
            </h3>
            <span className="text-2xs text-slate-400 font-medium">({savingsAccounts.length} heads)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-extrabold text-teal-600 dark:text-teal-400">
              Subtotal: {formatMoney(totalSavings)}
            </span>
            {canWrite && (
              <button
                onClick={() => handleOpenAddHead('savings')}
                className="text-2xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />
                <span>New Fund</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {savingsAccounts.map(acc => (
            <div 
              key={acc.id}
              onClick={onNavigateSavings}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between hover:border-teal-500/40 transition-all cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-2xs font-semibold truncate text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {acc.name}
                </span>
                <div className="flex items-center gap-1.5">
                  {canWrite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal();
                      }}
                      title="Edit Head & Balance"
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 opacity-60 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {getHeadIcon(acc)}
                </div>
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                  {formatMoney(acc.current_balance_cached)}
                </div>
                <div className="text-2xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>{acc.provider}</span>
                  <span className="font-mono text-teal-600 dark:text-teal-400 group-hover:underline">Goals &rarr;</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* GROUP 3: LIABILITIES & COMMITMENTS                       */}
      {/* ======================================================== */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Liabilities &amp; Obligations
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-extrabold text-rose-600 dark:text-rose-400">
              Total Dues: {formatMoney(totalLiabilities)}
            </span>
            {canWrite && (
              <button
                onClick={() => handleOpenAddHead('liability')}
                className="text-2xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />
                <span>New Liability</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Credit Card Due - Dynamic from Credit Cards Module */}
          <div 
            onClick={onNavigateCards}
            className="p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex flex-col justify-between cursor-pointer hover:border-rose-400 transition-all shadow-2xs group"
          >
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
              <span className="text-2xs font-semibold truncate group-hover:underline">
                Credit Card Due
              </span>
              <CreditCard className="w-4 h-4 shrink-0" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                {formatMoney(effectiveCreditCardDue)}
              </div>
              <div className="text-2xs text-rose-500/80 dark:text-rose-400/80 mt-1 flex items-center justify-between">
                <span>{creditCards.length > 0 ? `${creditCards.length} Cards Active` : 'Revolving Lines'}</span>
                <span className="font-mono">In-Out &rarr;</span>
              </div>
            </div>
          </div>

          {/* Other Loans Borrowed - Dynamic from Loans Module */}
          <div 
            onClick={onNavigateLoans}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between cursor-pointer hover:border-slate-400 transition-all shadow-2xs group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-2xs font-semibold truncate text-slate-700 dark:text-slate-300 group-hover:underline">
                Other Loans (Payable)
              </span>
              <HandCoins className="w-4 h-4 text-rose-400 shrink-0" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {formatMoney(totalLoansBorrowed)}
              </div>
              <div className="text-2xs text-slate-400 mt-1 flex items-center justify-between">
                <span>{activeBorrowedLoans.length} Active Obligations</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">View &rarr;</span>
              </div>
            </div>
          </div>

          {/* Money Lent (Receivables) - Dynamic Recovery Position */}
          <div 
            onClick={onNavigateLoans}
            className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex flex-col justify-between cursor-pointer hover:border-amber-400 transition-all shadow-2xs group"
          >
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
              <span className="text-2xs font-semibold truncate group-hover:underline">
                Money Lent (Receivables)
              </span>
              <ArrowUpRight className="w-4 h-4 shrink-0" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300 tabular-nums">
                {formatMoney(totalMoneyLent)}
              </div>
              <div className="text-2xs text-amber-600/80 dark:text-amber-400/80 mt-1 flex items-center justify-between">
                <span>{activeLentLoans.length} Loans to Collect</span>
                <span className="font-mono">Track &rarr;</span>
              </div>
            </div>
          </div>

          {/* Remote / Earned Revenue - Dynamic from Double-Entry Ledger */}
          <div 
            onClick={onNavigateIncome}
            className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex flex-col justify-between cursor-pointer hover:border-emerald-400 transition-all shadow-2xs group"
          >
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
              <span className="text-2xs font-semibold truncate group-hover:underline">
                Remote / Earned Revenue
              </span>
              <TrendingUp className="w-4 h-4 shrink-0" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatMoney(totalEarnedRevenue)}
              </div>
              <div className="text-2xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 flex items-center justify-between">
                <span>Posted Inflows</span>
                <span className="font-mono">Analytics &rarr;</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD NEW HEAD                                    */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isAddHeadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl my-8"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Add New Cockpit Head
                    </h3>
                    <p className="text-2xs text-slate-500">
                      Creates a database-backed financial account with auto-sync.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddHeadModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveNewHead} className="space-y-4">
                {/* Group Selector */}
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Cockpit Section / Group
                  </label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setNewHeadGroup('liquid')}
                      className={`py-2 text-2xs font-semibold rounded-lg transition-all ${
                        newHeadGroup === 'liquid'
                          ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Liquid Wallet
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewHeadGroup('savings')}
                      className={`py-2 text-2xs font-semibold rounded-lg transition-all ${
                        newHeadGroup === 'savings'
                          ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Savings Fund
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewHeadGroup('liability')}
                      className={`py-2 text-2xs font-semibold rounded-lg transition-all ${
                        newHeadGroup === 'liability'
                          ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Liability Due
                    </button>
                  </div>
                </div>

                {/* Head Title */}
                <div>
                  <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Head Name
                  </label>
                  <input
                    type="text"
                    value={newHeadName}
                    onChange={(e) => setNewHeadName(e.target.value)}
                    placeholder={
                      newHeadGroup === 'liquid' 
                        ? 'e.g. Islami Bank, Rocket Wallet, Cash Jar' 
                        : newHeadGroup === 'savings'
                        ? 'e.g. Hajj Fund, Emergency Buffer, Gold DPS'
                        : 'e.g. City Bank Amex, Family Loan'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                    required
                  />
                </div>

                {/* Provider & Starting Balance */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Provider / Platform
                    </label>
                    <input
                      type="text"
                      value={newHeadProvider}
                      onChange={(e) => setNewHeadProvider(e.target.value)}
                      placeholder="e.g. BRAC, bKash, BAF"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Starting Balance (৳)
                    </label>
                    <NumericInput
                      placeholder="0.00"
                      value={newHeadBalance}
                      onChange={(e) => setNewHeadBalance(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Color Selector */}
                <div>
                  <label className="block text-2xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    {['#10b981', '#0284c7', '#e11d48', '#ea580c', '#0d9488', '#eab308', '#9333ea', '#6366f1'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewHeadColor(c)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          newHeadColor === c ? 'ring-2 ring-offset-2 ring-emerald-500 scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      >
                        {newHeadColor === c && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddHeadModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newHeadName.trim()}
                    className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-xs transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create &amp; Sync to Database'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL 2: EDIT HEADS & BALANCES                           */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl my-8"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Cockpit Heads &amp; Balances
                  </h3>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Rename any head and adjust current working balances with instant Supabase database persistence.
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

              <form onSubmit={handleSaveEditedAccounts} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                <div className="space-y-3">
                  {editAccountsList.map((acc, index) => (
                    <div 
                      key={acc.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-12 gap-3 items-center"
                    >
                      <div className="col-span-6">
                        <label className="block text-2xs font-semibold text-slate-500 mb-1">
                          Head #{index + 1} Name ({acc.provider})
                        </label>
                        <input
                          type="text"
                          value={acc.name}
                          onChange={(e) => handleUpdateEditAccount(acc.id, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                          required
                        />
                      </div>

                      <div className="col-span-5">
                        <label className="block text-2xs font-semibold text-slate-500 mb-1">
                          Balance (BDT ৳)
                        </label>
                        <NumericInput
                          placeholder="0.00"
                          value={acc.current_balance_cached.toString()}
                          onChange={(e) => handleUpdateEditAccount(acc.id, 'current_balance_cached', parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          required
                        />
                      </div>

                      <div className="col-span-1 flex items-center justify-center pt-4">
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomAccount(acc.id)}
                          title="Archive this head"
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      handleOpenAddHead('liquid');
                    }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Head</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-xs transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving...' : 'Save &amp; Sync to Database'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
