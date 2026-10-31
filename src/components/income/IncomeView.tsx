import React, { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Plus, 
  ArrowUpRight, 
  PieChart as PieIcon, 
  Lightbulb, 
  ShieldAlert, 
  CheckCircle2, 
  Calendar, 
  Briefcase, 
  Globe, 
  Laptop, 
  Building2, 
  ArrowRight,
  Filter,
  Sparkles
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { JournalEntry, FinancialAccount, Category } from '../../types';

export const IncomeView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const liquidAccounts = accounts.filter(a => ['cash', 'bank', 'mfs'].includes(a.account_type_id));
  const categories = db.getCategories(workspaceId);
  const incomeCategories = categories.filter(c => c.type === 'income');
  const journalEntries = db.getJournalEntries(workspaceId);

  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>('Remote Income');
  const [destinationAccountId, setDestinationAccountId] = useState<string>(liquidAccounts[0]?.id || '');
  const [amount, setAmount] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [clientOrEmployer, setClientOrEmployer] = useState<string>('');
  const [memo, setMemo] = useState<string>('Remote Income Remittance');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Build income streams data
  // Combine real journal entries and seeded fund figures
  const streamMap: Record<string, { total: number; count: number; icon: any; color: string; description: string }> = {
    'Remote Income': { 
      total: 282982, 
      count: 4, 
      icon: Globe, 
      color: '#0284c7', 
      description: 'International contracts, overseas clients & remote engineering' 
    },
    'Salary': { 
      total: 85000, 
      count: 2, 
      icon: Briefcase, 
      color: '#10b981', 
      description: 'Primary corporate employment & regular pay' 
    },
    'Business / Freelance': { 
      total: 42500, 
      count: 3, 
      icon: Laptop, 
      color: '#8b5cf6', 
      description: 'Consulting, project milestones & freelance services' 
    },
    'Investment Returns': { 
      total: 12400, 
      count: 1, 
      icon: TrendingUp, 
      color: '#f59e0b', 
      description: 'DSPF BAF dividends, DPS profit & interest yield' 
    },
    'Rental & Property': { 
      total: 0, 
      count: 0, 
      icon: Building2, 
      color: '#14b8a6', 
      description: 'Lease and rental inflows from owned properties' 
    },
    'Other Income': { 
      total: 5000, 
      count: 1, 
      icon: DollarSign, 
      color: '#64748b', 
      description: 'Allowances, gifts & miscellaneous returns' 
    },
  };

  // Parse posted journal entries for any added income lines
  journalEntries.forEach(entry => {
    if (entry.status === 'posted') {
      entry.lines?.forEach(line => {
        if (line.line_type === 'credit' && line.category_id) {
          const cat = categories.find(c => c.id === line.category_id);
          if (cat && cat.type === 'income') {
            const streamName = cat.name.includes('Remote') ? 'Remote Income' :
                               cat.name.includes('Salary') ? 'Salary' :
                               cat.name.includes('Business') || cat.name.includes('Freelance') ? 'Business / Freelance' :
                               cat.name.includes('Investment') ? 'Investment Returns' :
                               cat.name.includes('Rental') ? 'Rental & Property' : 'Other Income';
            if (streamMap[streamName]) {
              streamMap[streamName].total += line.amount;
              streamMap[streamName].count += 1;
            }
          }
        }
      });
    }
  });

  const totalInflow = Object.values(streamMap).reduce((sum, s) => sum + s.total, 0);

  // Determine dominant revenue stream
  const sortedStreams = Object.entries(streamMap)
    .map(([name, data]) => ({
      name,
      ...data,
      pct: totalInflow > 0 ? (data.total / totalInflow) * 100 : 0
    }))
    .sort((a, b) => b.total - a.total);

  const topStream = sortedStreams[0] || { name: 'Remote Income', pct: 0, total: 0 };

  const handleRecordIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || !destinationAccountId) return;

    // Find or create matching income category
    let matchedCat = incomeCategories.find(c => c.name.toLowerCase().includes(selectedSource.toLowerCase()));
    if (!matchedCat) {
      matchedCat = incomeCategories[0] || {
        id: 'cat_income_remote',
        workspace_id: workspaceId,
        name: selectedSource,
        type: 'income',
        accounting_classification: 'income_operating',
        icon: 'trending-up',
        color: '#10b981',
        is_seed: false,
        is_archived: false,
        sort_order: 1,
      };
    }

    // Double-entry: Debit Asset (Bank/MFS/Cash), Credit Income Category
    const destAcc = liquidAccounts.find(a => a.id === destinationAccountId);

    const res = db.postJournalEntry(workspaceId, {
      memo: memo || `${selectedSource} Inflow from ${clientOrEmployer || 'Direct Remittance'}`,
      source_type: 'manual',
      entry_date: entryDate,
      lines: [
        {
          account_id: destinationAccountId,
          line_type: 'debit',
          amount: parsedAmount,
          memo: `Deposited into ${destAcc?.name || 'Account'}`,
        },
        {
          account_id: '',
          category_id: matchedCat.id,
          line_type: 'credit',
          amount: parsedAmount,
          counterparty: clientOrEmployer,
          memo: `Earned from ${selectedSource}`,
        },
      ],
    });

    if (res.success && destAcc) {
      destAcc.current_balance_cached += parsedAmount;
      db.saveAccount(destAcc);
    }

    setAmount('');
    setClientOrEmployer('');
    setShowAddIncomeModal(false);
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Income Hub &amp; Revenue Analytics
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Multi-Stream
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track all incoming cash streams, analyze revenue concentrations, and optimize earnings growth.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => setShowAddIncomeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Income</span>
          </button>
        )}
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Total Revenue Inflow
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatMoney(totalInflow)}
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Across all active earnings channels</span>
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Dominant Revenue Driver
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
            {topStream.name}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-2xs">
            <span className="text-slate-500">Contribution Share</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
              {topStream.pct.toFixed(1)}% of total
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Active Income Channels
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {sortedStreams.filter(s => s.total > 0).length} Channels
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5">
            Diversification health score: <strong className="text-emerald-500">Good</strong>
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Average Inflow / Month
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatMoney(totalInflow / 3)}
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5">
            Trailing 90-day annualized velocity
          </p>
        </div>
      </div>

      {/* Main Two-Column Analytics Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: "Where is Most Money Coming From?" */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-emerald-500" />
                  <span>Where is Most Money Coming From?</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Categorized breakdown of all inbound financial streams
                </p>
              </div>
              <span className="text-2xs font-mono font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Sorted by volume
              </span>
            </div>

            {/* Inflow Distribution Bars */}
            <div className="space-y-4">
              {sortedStreams.map((stream) => {
                const IconComponent = stream.icon;
                return (
                  <div 
                    key={stream.name} 
                    className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: stream.color }}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {stream.name}
                            </span>
                            {stream.pct > 50 && (
                              <span className="px-1.5 py-0.2 rounded-xs text-3xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                                Primary Source
                              </span>
                            )}
                          </div>
                          <span className="text-2xs text-slate-400 block line-clamp-1">
                            {stream.description}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold font-mono text-slate-900 dark:text-white block tabular-nums">
                          {formatMoney(stream.total)}
                        </span>
                        <span className="text-2xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {stream.pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(stream.pct, 3)}%`, backgroundColor: stream.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 Columns: "How Should I Improve?" Financial Advisor */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Lightbulb className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                How Should I Improve?
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Strategic recommendations based on your current income streams and concentration risk
            </p>

            <div className="space-y-3.5">
              {/* Insight 1: Diversification & Concentration Risk */}
              <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Mitigate Single-Source Concentration</span>
                </div>
                <p className="text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your <strong>Remote Income</strong> represents <strong>{topStream.pct.toFixed(0)}%</strong> of your total inflow. If this single client or platform pauses, cash velocity drops significantly. Aim to build a secondary retainer or local contract paying at least 25% of baseline.
                </p>
              </div>

              {/* Insight 2: Surplus Reinvestment */}
              <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Automate Surplus Sweeps into DSPF &amp; DPS</span>
                </div>
                <p className="text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  On the day your Remote Income lands, immediately transfer 20% into <strong>DSPF BAF</strong> or high-yield DPS before monthly expenses begin. This turns volatile active income into compounding passive yield.
                </p>
              </div>

              {/* Insight 3: Rate Leverage */}
              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Pricing Power &amp; Hourly Indexing</span>
                </div>
                <p className="text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Every 6 months of continuous remote delivery, negotiate an 8–12% performance increase or shift from hourly tracking to fixed milestone value pricing.
                </p>
              </div>

              {/* Insight 4: FX Hedging */}
              <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-800 dark:text-purple-300 mb-1">
                  <Globe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>Foreign Exchange Conversion Timing</span>
                </div>
                <p className="text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  When receiving USD/EUR wire transfers, convert in tranches rather than a single lump sum during market dips to maximize your net BDT conversion rate.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Record Income Modal */}
      {showAddIncomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Record Incoming Payment
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Credits your income stream and debits your chosen liquid account with double-entry balance.
            </p>

            <form onSubmit={handleRecordIncome} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Income Stream Category
                </label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Remote Income">Remote Income (International Client)</option>
                  <option value="Salary">Salary (Primary Employment)</option>
                  <option value="Business / Freelance">Business / Freelance Milestones</option>
                  <option value="Investment Returns">Investment Returns / DPS Yield</option>
                  <option value="Rental & Property">Rental &amp; Property Inflow</option>
                  <option value="Other Income">Other Miscellaneous Income</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Inflow Amount (BDT ৳)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Deposit Into (Liquid Asset Account)
                </label>
                <select
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  {liquidAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.provider} - Balance: {formatMoney(a.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date Received
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Client / Source Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Global"
                    value={clientOrEmployer}
                    onChange={(e) => setClientOrEmployer(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Memo / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. October milestone release"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddIncomeModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Confirm &amp; Post Inflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
