import React, { useState } from 'react';
import { 
  HandCoins, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Percent, 
  X,
  Phone,
  User,
  Edit3,
  Trash2
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { Loan, FinancialAccount } from '../../types';

export const LoansView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const loans = db.getLoans(workspaceId);
  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const liquidAccounts = accounts.filter(a => ['bank', 'cash', 'mfs'].includes(a.account_type_id));

  const [activeTab, setActiveTab] = useState<'all' | 'borrowed' | 'lent'>('all');
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  // Edit Loan state
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCounterpartyName, setEditCounterpartyName] = useState('');
  const [editCounterpartyPhone, setEditCounterpartyPhone] = useState('');
  const [editCounterpartyRel, setEditCounterpartyRel] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const openEditLoanModal = (loan: Loan) => {
    setEditingLoan(loan);
    setEditTitle(loan.title);
    setEditCounterpartyName(loan.counterparty_name);
    setEditCounterpartyPhone(loan.counterparty_phone || '');
    setEditCounterpartyRel(loan.counterparty_relationship || '');
    setEditNotes(loan.notes || '');
  };

  const handleSaveEditLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoan || !editTitle.trim()) return;

    const updated: Loan = {
      ...editingLoan,
      title: editTitle.trim(),
      counterparty_name: editCounterpartyName.trim(),
      counterparty_phone: editCounterpartyPhone.trim() || undefined,
      counterparty_relationship: editCounterpartyRel.trim() || undefined,
      notes: editNotes.trim() || undefined,
    };

    db.saveLoan(updated);
    refreshData();
    setEditingLoan(null);
  };

  const handleDeleteLoan = (loan: Loan) => {
    if (confirm(`Are you sure you want to delete the loan "${loan.title}" (${loan.counterparty_name})?`)) {
      db.deleteLoan(loan.id, workspaceId);
      refreshData();
    }
  };

  // New Loan state
  const [loanType, setLoanType] = useState<'borrowed' | 'lent'>('borrowed');
  const [title, setTitle] = useState('');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyPhone, setCounterpartyPhone] = useState('');
  const [counterpartyRelationship, setCounterpartyRelationship] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('0');
  const [isInterestBearing, setIsInterestBearing] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [maturityDate, setMaturityDate] = useState('');
  const [fundingAccountId, setFundingAccountId] = useState('');

  // Repayment modal state
  const [repaymentAccount, setRepaymentAccount] = useState('');
  const [principalPayment, setPrincipalPayment] = useState('');
  const [interestPayment, setInterestPayment] = useState('0');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [repaySuccess, setRepaySuccess] = useState<string | null>(null);

  const filteredLoans = loans.filter(l => {
    if (activeTab === 'borrowed') return l.type === 'borrowed';
    if (activeTab === 'lent') return l.type === 'lent';
    return true;
  });

  const totalBorrowedPrincipal = loans
    .filter(l => l.type === 'borrowed' && l.status === 'active')
    .reduce((sum, l) => sum + (l.principal_amount - l.total_principal_repaid), 0);

  const totalLentPrincipal = loans
    .filter(l => l.type === 'lent' && l.status === 'active')
    .reduce((sum, l) => sum + (l.principal_amount - l.total_principal_repaid), 0);

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const principalNum = parseFloat(principal);
    if (!title.trim() || !counterpartyName.trim() || isNaN(principalNum) || principalNum <= 0) return;

    const loanId = 'loan_' + Date.now();
    const subAccId = 'acc_loan_sub_' + Date.now();

    // Create backing financial account for this loan
    const subAcc: FinancialAccount = {
      id: subAccId,
      workspace_id: workspaceId,
      name: `${loanType === 'borrowed' ? 'Debt: ' : 'Lent: '} ${title.trim()} (${counterpartyName.trim()})`,
      account_type_id: loanType === 'borrowed' ? 'loan_payable' : 'receivable',
      provider: 'Personal / Direct',
      currency: currentWorkspace?.currency || 'BDT',
      opening_balance: 0,
      opening_date: startDate,
      current_balance_cached: principalNum,
      is_archived: false,
      icon: loanType === 'borrowed' ? 'shield-alert' : 'arrow-up-right',
      color: loanType === 'borrowed' ? '#e11d48' : '#059669',
      created_at: new Date().toISOString(),
    };
    db.saveAccount(subAcc);

    const newLoan: Loan = {
      id: loanId,
      workspace_id: workspaceId,
      type: loanType,
      account_id: subAccId,
      title: title.trim(),
      counterparty_name: counterpartyName.trim(),
      counterparty_phone: counterpartyPhone.trim() || undefined,
      counterparty_relationship: counterpartyRelationship.trim() || undefined,
      principal_amount: principalNum,
      interest_rate: isInterestBearing ? (parseFloat(interestRate) || 0) : 0,
      is_interest_bearing: isInterestBearing,
      start_date: startDate,
      maturity_date: maturityDate || undefined,
      installment_frequency: 'monthly',
      total_principal_repaid: 0,
      total_interest_paid: 0,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    db.saveLoan(newLoan);

    // If funding account was selected, record the disbursement transaction:
    if (fundingAccountId) {
      if (loanType === 'borrowed') {
        // Borrowed money:
        // Debit: Cash/Bank Account (Asset increases)
        // Credit: Loan Payable Liability (Liability increases)
        // ZERO INCOME RECOGNIZED!
        db.postJournalEntry(workspaceId, {
          memo: `Loan Borrowed Inflow: ${title.trim()} from ${counterpartyName.trim()}`,
          source_type: 'loan_disbursement',
          source_id: loanId,
          entry_date: startDate,
          lines: [
            {
              account_id: fundingAccountId,
              line_type: 'debit',
              amount: principalNum,
              memo: `Funds received from ${counterpartyName}`,
            },
            {
              account_id: subAccId,
              line_type: 'credit',
              amount: principalNum,
              memo: `Principal liability created`,
            },
          ],
        });
      } else {
        // Lent money:
        // Debit: Loan Receivable (Asset increases)
        // Credit: Cash/Bank Account (Cash decreases)
        // ZERO EXPENSE RECOGNIZED!
        db.postJournalEntry(workspaceId, {
          memo: `Money Lent Outflow: ${title.trim()} to ${counterpartyName.trim()}`,
          source_type: 'loan_disbursement',
          source_id: loanId,
          entry_date: startDate,
          lines: [
            {
              account_id: subAccId,
              line_type: 'debit',
              amount: principalNum,
              memo: `Principal receivable established`,
            },
            {
              account_id: fundingAccountId,
              line_type: 'credit',
              amount: principalNum,
              memo: `Funds disbursed to ${counterpartyName}`,
            },
          ],
        });
      }
    }

    refreshData();
    setShowAddLoanModal(false);
    resetForm();
  };

  const handleRepay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !repaymentAccount) return;

    const pAmt = parseFloat(principalPayment) || 0;
    const iAmt = parseFloat(interestPayment) || 0;
    const totalOutflow = pAmt + iAmt;

    if (totalOutflow <= 0) return;

    // Strict Double-Entry Repayment Rules:
    if (selectedLoan.type === 'borrowed') {
      // Repaying borrowed loan:
      // Debit: Loan Payable (reduces liability by principal)
      // Debit: Interest Expense (if any interest paid)
      // Credit: Bank/Cash Account (reduces liquid cash)
      const lines: any[] = [];
      if (pAmt > 0 && selectedLoan.account_id) {
        lines.push({
          account_id: selectedLoan.account_id,
          line_type: 'debit',
          amount: pAmt,
          memo: `Principal reduction for loan: ${selectedLoan.title}`,
        });
      }
      if (iAmt > 0 && selectedLoan.account_id) {
        lines.push({
          account_id: selectedLoan.account_id,
          line_type: 'debit',
          amount: iAmt,
          memo: `Interest expense for loan: ${selectedLoan.title}`,
        });
      }
      lines.push({
        account_id: repaymentAccount,
        line_type: 'credit',
        amount: totalOutflow,
        memo: `Loan installment to ${selectedLoan.counterparty_name}`,
      });

      db.postJournalEntry(workspaceId, {
        memo: `Loan Installment: ${selectedLoan.title} (${selectedLoan.counterparty_name})`,
        source_type: 'loan_repayment',
        source_id: selectedLoan.id,
        entry_date: paymentDate,
        lines,
      });

      selectedLoan.total_principal_repaid += pAmt;
      selectedLoan.total_interest_paid += iAmt;
      if (selectedLoan.total_principal_repaid >= selectedLoan.principal_amount) {
        selectedLoan.status = 'fully_paid';
      }
      db.saveLoan(selectedLoan);

      setRepaySuccess(`Repayment recorded! Principal of ${formatMoney(pAmt)} reduced liability directly. Zero false operating expense.`);
    } else {
      // Receiving payment from borrower:
      // Debit: Bank/Cash Account (increases cash)
      // Credit: Loan Receivable (reduces receivable)
      // ZERO NEW INCOME RECOGNIZED!
      db.postJournalEntry(workspaceId, {
        memo: `Collection of money lent: ${selectedLoan.title} from ${selectedLoan.counterparty_name}`,
        source_type: 'loan_repayment',
        source_id: selectedLoan.id,
        entry_date: paymentDate,
        lines: [
          {
            account_id: repaymentAccount,
            line_type: 'debit',
            amount: pAmt,
            memo: `Funds returned by ${selectedLoan.counterparty_name}`,
          },
          {
            account_id: selectedLoan.account_id || repaymentAccount,
            line_type: 'credit',
            amount: pAmt,
            memo: `Receivable reduction`,
          },
        ],
      });

      selectedLoan.total_principal_repaid += pAmt;
      if (selectedLoan.total_principal_repaid >= selectedLoan.principal_amount) {
        selectedLoan.status = 'fully_paid';
      }
      db.saveLoan(selectedLoan);

      setRepaySuccess(`Collection recorded! ${formatMoney(pAmt)} recovered against receivable. Zero false income.`);
    }

    refreshData();
    setTimeout(() => {
      setRepaySuccess(null);
      setShowRepaymentModal(false);
    }, 2000);
  };

  const resetForm = () => {
    setTitle('');
    setCounterpartyName('');
    setCounterpartyPhone('');
    setCounterpartyRelationship('');
    setPrincipal('');
    setInterestRate('0');
    setIsInterestBearing(false);
    setFundingAccountId('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Loans, Debts &amp; Money Lent (Receivables)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Borrowed money is a liability, not income. Lent money is an asset, not an expense.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => setShowAddLoanModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Loan Record</span>
          </button>
        )}
      </div>

      {/* KPI Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Outstanding Debt (Money Borrowed)
            </span>
            <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
              {formatMoney(totalBorrowedPrincipal)}
            </div>
            <span className="text-2xs text-slate-400">Total principal liability to lenders</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Outstanding Receivables (Money Lent)
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatMoney(totalLentPrincipal)}
            </div>
            <span className="text-2xs text-slate-400">Asset balance to be returned by borrowers</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Filter Control */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit text-xs font-semibold">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            activeTab === 'all'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          All Records ({loans.length})
        </button>
        <button
          onClick={() => setActiveTab('borrowed')}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            activeTab === 'borrowed'
              ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Money Borrowed (Debts)
        </button>
        <button
          onClick={() => setActiveTab('lent')}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            activeTab === 'lent'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Money Lent (Receivables)
        </button>
      </div>

      {/* Loans List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredLoans.map(loan => {
          const isBorrowed = loan.type === 'borrowed';
          const remainingPrincipal = Math.max(0, loan.principal_amount - loan.total_principal_repaid);
          const progressPct = Math.min(100, Math.round((loan.total_principal_repaid / loan.principal_amount) * 100));

          return (
            <div
              key={loan.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isBorrowed 
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' 
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {isBorrowed ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {loan.title}
                      </h4>
                      <span className="text-2xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3" />
                        <span>{loan.counterparty_name}</span>
                        {loan.counterparty_relationship && <span>({loan.counterparty_relationship})</span>}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${
                      loan.status === 'fully_paid'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      {loan.status === 'fully_paid' ? 'Fully Settled' : 'Active'}
                    </span>
                    {canWrite && (
                      <>
                        <button
                          onClick={() => openEditLoanModal(loan)}
                          title="Edit Loan Details"
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLoan(loan)}
                          title="Delete Loan"
                          className="p-1 rounded-md text-rose-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Amounts Breakdown */}
                <div className="grid grid-cols-2 gap-3 my-3 text-xs">
                  <div>
                    <span className="text-2xs text-slate-400 font-semibold uppercase block">
                      Remaining Principal
                    </span>
                    <span className={`font-mono font-bold text-base tabular-nums ${
                      isBorrowed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {formatMoney(remainingPrincipal)}
                    </span>
                  </div>

                  <div>
                    <span className="text-2xs text-slate-400 font-semibold uppercase block">
                      Total Principal
                    </span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-base tabular-nums">
                      {formatMoney(loan.principal_amount)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="my-2">
                  <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
                    <span>Repaid: {formatMoney(loan.total_principal_repaid)}</span>
                    <span>{progressPct}% Settled</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isBorrowed ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action row */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-500">
                <span>Start: {loan.start_date}</span>

                {loan.status !== 'fully_paid' && canWrite && (
                  <button
                    onClick={() => {
                      setSelectedLoan(loan);
                      setPrincipalPayment(remainingPrincipal.toString());
                      setShowRepaymentModal(true);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white transition-colors"
                  >
                    {isBorrowed ? 'Record Repayment' : 'Record Collection'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Loan Modal */}
      {showAddLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                New Loan or Debt Record
              </h3>
              <button
                onClick={() => setShowAddLoanModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="space-y-3.5">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setLoanType('borrowed')}
                  className={`py-1.5 rounded-md transition-colors ${
                    loanType === 'borrowed'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Money Borrowed (Liability)
                </button>
                <button
                  type="button"
                  onClick={() => setLoanType('lent')}
                  className={`py-1.5 rounded-md transition-colors ${
                    loanType === 'lent'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Money Lent (Receivable)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Title / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank Home Loan, Personal Emergency Loan to Friend"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {loanType === 'borrowed' ? 'Lender Name' : 'Borrower Name'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BRAC Bank, Brother Rahim"
                    value={counterpartyName}
                    onChange={(e) => setCounterpartyName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Relationship
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bank, Family, Friend"
                    value={counterpartyRelationship}
                    onChange={(e) => setCounterpartyRelationship(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Principal Amount ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="50000"
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Funding Account (Disbursement)
                </label>
                <select
                  value={fundingAccountId}
                  onChange={(e) => setFundingAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">Do not post cash entry now (Opening balance already entered)</option>
                  {liquidAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(a.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddLoanModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Save Loan Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repay Modal */}
      {showRepaymentModal && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedLoan.type === 'borrowed' ? 'Record Loan Repayment' : 'Record Borrower Payment'}
                </h3>
                <span className="text-2xs text-slate-500">
                  {selectedLoan.title} ({selectedLoan.counterparty_name})
                </span>
              </div>
              <button
                onClick={() => setShowRepaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {repaySuccess && (
              <div className="p-3 mb-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{repaySuccess}</span>
              </div>
            )}

            <form onSubmit={handleRepay} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {selectedLoan.type === 'borrowed' ? 'Pay From Account' : 'Receive Into Account'}
                </label>
                <select
                  value={repaymentAccount}
                  onChange={(e) => setRepaymentAccount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  <option value="">Select account</option>
                  {liquidAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(a.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Principal Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={principalPayment}
                    onChange={(e) => setPrincipalPayment(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRepaymentModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Confirm &amp; Post to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Loan Details Modal */}
      {editingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Loan Details
              </h3>
              <button
                onClick={() => setEditingLoan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLoan} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Title / Reason
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Counterparty / Person Name
                </label>
                <input
                  type="text"
                  value={editCounterpartyName}
                  onChange={(e) => setEditCounterpartyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone #
                  </label>
                  <input
                    type="text"
                    value={editCounterpartyPhone}
                    onChange={(e) => setEditCounterpartyPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={editCounterpartyRel}
                    onChange={(e) => setEditCounterpartyRel(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
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
                    if (editingLoan) handleDeleteLoan(editingLoan);
                    setEditingLoan(null);
                  }}
                  className="px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  Delete Loan
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLoan(null)}
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
