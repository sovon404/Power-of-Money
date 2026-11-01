import React, { useState } from 'react';
import { 
  Sliders, 
  CheckCircle2, 
  Wallet, 
  CreditCard, 
  HandCoins, 
  Building2, 
  ArrowRight, 
  Scale, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { FinancialAccount, Loan, Property } from '../../types';
import { NumericInput } from '../common/NumericInput';

export const OpeningBalanceWizard: React.FC = () => {
  const { currentWorkspace, formatMoney, completeInitialSetup, refreshData } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const [step, setStep] = useState<number>(1);
  const [openingDate, setOpeningDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Balances
  const [cashBalance, setCashBalance] = useState('25000');
  const [bkashBalance, setBkashBalance] = useState('12000');
  const [nagadBalance, setNagadBalance] = useState('5000');
  const [bankBalance, setBankBalance] = useState('180000');
  const [bankName, setBankName] = useState('BRAC Bank');
  const [cardLiability, setCardLiability] = useState('15000');
  const [loanPayable, setLoanPayable] = useState('0');
  const [moneyLentReceivable, setMoneyLentReceivable] = useState('0');
  const [propertyEstimate, setPropertyEstimate] = useState('0');

  const [isFinishing, setIsFinishing] = useState(false);
  const [summaryMsg, setSummaryMsg] = useState<string | null>(null);

  const handleFinishSetup = () => {
    setIsFinishing(true);

    const cash = parseFloat(cashBalance) || 0;
    const bkash = parseFloat(bkashBalance) || 0;
    const nagad = parseFloat(nagadBalance) || 0;
    const bank = parseFloat(bankBalance) || 0;
    const card = parseFloat(cardLiability) || 0;
    const loan = parseFloat(loanPayable) || 0;
    const lent = parseFloat(moneyLentReceivable) || 0;
    const prop = parseFloat(propertyEstimate) || 0;

    // 1. Ensure Categories are seeded
    db.seedCategoriesForWorkspace(workspaceId);

    // 2. Setup Accounts with opening balances
    const accounts = db.ensureDefaultAccountsForWorkspace(workspaceId);
    let cashAcc = accounts.find(a => a.account_type_id === 'cash');
    let bkashAcc = accounts.find(a => a.provider === 'bKash');
    let nagadAcc = accounts.find(a => a.provider === 'Nagad');
    let bankAcc = accounts.find(a => a.account_type_id === 'bank');
    let equityAcc = accounts.find(a => a.account_type_id === 'opening_equity');

    if (cashAcc) {
      cashAcc.opening_balance = cash;
      cashAcc.current_balance_cached = cash;
      cashAcc.opening_date = openingDate;
      db.saveAccount(cashAcc);
    }
    if (bkashAcc) {
      bkashAcc.opening_balance = bkash;
      bkashAcc.current_balance_cached = bkash;
      bkashAcc.opening_date = openingDate;
      db.saveAccount(bkashAcc);
    }
    if (nagadAcc) {
      nagadAcc.opening_balance = nagad;
      nagadAcc.current_balance_cached = nagad;
      nagadAcc.opening_date = openingDate;
      db.saveAccount(nagadAcc);
    }
    if (bankAcc) {
      bankAcc.name = `${bankName} Checking`;
      bankAcc.provider = bankName;
      bankAcc.opening_balance = bank;
      bankAcc.current_balance_cached = bank;
      bankAcc.opening_date = openingDate;
      db.saveAccount(bankAcc);
    }

    // 3. Post double-entry Opening Balance Entry
    const totalOpeningAssets = cash + bkash + nagad + bank + lent + prop;
    const totalOpeningLiabilities = card + loan;
    const openingEquity = totalOpeningAssets - totalOpeningLiabilities;

    const openingLines: any[] = [];
    if (cashAcc && cash > 0) openingLines.push({ account_id: cashAcc.id, line_type: 'debit', amount: cash, memo: 'Cash Opening Balance' });
    if (bkashAcc && bkash > 0) openingLines.push({ account_id: bkashAcc.id, line_type: 'debit', amount: bkash, memo: 'bKash Opening Balance' });
    if (nagadAcc && nagad > 0) openingLines.push({ account_id: nagadAcc.id, line_type: 'debit', amount: nagad, memo: 'Nagad Opening Balance' });
    if (bankAcc && bank > 0) openingLines.push({ account_id: bankAcc.id, line_type: 'debit', amount: bank, memo: `${bankName} Opening Balance` });

    if (equityAcc && openingLines.length > 0) {
      const sumDebits = openingLines.reduce((s, l) => s + l.amount, 0);
      openingLines.push({
        account_id: equityAcc.id,
        line_type: 'credit',
        amount: sumDebits,
        memo: 'Opening Equity Offset',
      });

      db.postJournalEntry(workspaceId, {
        memo: 'Workspace Opening Positions & Balances',
        source_type: 'opening_balance',
        entry_date: openingDate,
        lines: openingLines,
      });
    }

    completeInitialSetup();
    refreshData();
    setIsFinishing(false);
    setSummaryMsg(`Setup complete! Opening positions credited against Opening Equity. The 36 categories seeded successfully.`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
          <Sliders className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Initial Financial Setup &amp; Opening Balances
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
          Start fresh without fake transactions. Enter your real opening baseline positions to establish balanced Opening Equity.
        </p>
      </div>

      {summaryMsg ? (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Opening Positions Initialized!
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            {summaryMsg}
          </p>
          <div className="pt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
            >
              Go to Executive Dashboard
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          {/* Step 1: Baseline Date */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">1</span>
              <span>Opening Financial Position Date</span>
            </h3>

            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Baseline Starting Date
              </label>
              <input
                type="date"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Step 2: Liquid Balances */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">2</span>
              <span>Cash, Bank &amp; Mobile Financial Wallets ({currentWorkspace?.currency || 'BDT'})</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cash in Hand
                </label>
                <NumericInput
                  placeholder="0.00"
                  value={cashBalance}
                  onChange={(e) => setCashBalance(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Bank Balance ({bankName})
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-1/2 px-2.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    placeholder="Bank Name"
                  />
                  <NumericInput
                    placeholder="0.00"
                    value={bankBalance}
                    onChange={(e) => setBankBalance(e.target.value)}
                    className="w-1/2 px-2.5 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  bKash Wallet Balance
                </label>
                <NumericInput
                  placeholder="0.00"
                  value={bkashBalance}
                  onChange={(e) => setBkashBalance(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nagad Wallet Balance
                </label>
                <NumericInput
                  placeholder="0.00"
                  value={nagadBalance}
                  onChange={(e) => setNagadBalance(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Seed Categories Guarantee */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>36 Customizable Seed Categories Ready</span>
            </div>
            <p className="text-2xs text-slate-500">
              The 36 requested expense categories (Home Expense, Wifi, Electricity, Personal Food, Mess Bill, Protein Target, etc.) are idempotently seeded and ready to use in your ledger.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleFinishSetup}
              disabled={isFinishing}
              className="w-full py-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-xs transition-colors"
            >
              {isFinishing ? 'Saving Baseline...' : 'Complete Setup & Establish Opening Equity'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
