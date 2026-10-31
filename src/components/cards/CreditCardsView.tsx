import React, { useState } from 'react';
import { 
  CreditCard as CreditCardIcon, 
  Plus, 
  ArrowRight, 
  ShieldCheck, 
  Calendar, 
  Percent, 
  FileText,
  DollarSign,
  AlertTriangle,
  X,
  CheckCircle2
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { CreditCard, FinancialAccount } from '../../types';

export const CreditCardsView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const cards = db.getCreditCards(workspaceId);
  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const bankAccounts = accounts.filter(a => ['bank', 'cash', 'mfs'].includes(a.account_type_id));

  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCardForPayment, setSelectedCardForPayment] = useState<CreditCard | null>(null);

  // New Card Form state
  const [cardName, setCardName] = useState('');
  const [issuingBank, setIssuingBank] = useState('City Bank');
  const [cardNetwork, setCardNetwork] = useState<'Visa' | 'Mastercard' | 'Amex'>('Visa');
  const [lastFour, setLastFour] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDay, setStatementDay] = useState('15');
  const [dueDay, setDueDay] = useState('5');
  const [apr, setApr] = useState('20.0');
  const [annualFee, setAnnualFee] = useState('0');

  // Payment Form state
  const [payFromAccId, setPayFromAccId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMemo, setPayMemo] = useState('Credit Card Bill Settlement');
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim() || !lastFour.trim() || !creditLimit) return;

    const limit = parseFloat(creditLimit) || 0;
    const cardId = 'card_' + Date.now();
    const liabilityAccId = 'acc_card_liab_' + Date.now();

    // 1. Create underlying liability account in financial_accounts
    const liabAcc: FinancialAccount = {
      id: liabilityAccId,
      workspace_id: workspaceId,
      name: `${cardName.trim()} (${issuingBank.trim()} •••• ${lastFour.trim()})`,
      account_type_id: 'credit_card',
      provider: issuingBank.trim(),
      account_number_masked: `•••• ${lastFour.trim()}`,
      currency: currentWorkspace?.currency || 'BDT',
      opening_balance: 0,
      opening_date: new Date().toISOString().split('T')[0],
      current_balance_cached: 0,
      is_archived: false,
      icon: 'credit-card',
      color: '#e11d48',
      created_at: new Date().toISOString(),
    };
    db.saveAccount(liabAcc);

    // 2. Create Credit Card record
    const newCard: CreditCard = {
      id: cardId,
      workspace_id: workspaceId,
      account_id: liabilityAccId,
      card_name: cardName.trim(),
      issuing_bank: issuingBank.trim(),
      card_network: cardNetwork,
      last_four_digits: lastFour.trim(),
      credit_limit: limit,
      statement_day: parseInt(statementDay, 10),
      payment_due_day: parseInt(dueDay, 10),
      interest_rate_apr: parseFloat(apr) || 0,
      annual_fee: parseFloat(annualFee) || 0,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    db.saveCreditCard(newCard);

    refreshData();
    setShowAddCardModal(false);
    resetForm();
  };

  const handlePayCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardForPayment || !payFromAccId || !payAmount) return;

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) return;

    // Strict Double-entry rule for credit card payment:
    // Debit: Credit Card Liability Account (Liability decreases)
    // Credit: Bank / Cash Asset Account (Liquid cash decreases)
    // ZERO operating expense recognized!
    const res = db.postJournalEntry(workspaceId, {
      memo: `Card Payment: ${selectedCardForPayment.card_name} (•••• ${selectedCardForPayment.last_four_digits})`,
      source_type: 'credit_card_payment',
      source_id: selectedCardForPayment.id,
      entry_date: payDate,
      lines: [
        {
          account_id: selectedCardForPayment.account_id,
          line_type: 'debit',
          amount: amt,
          memo: 'Card liability reduction (Settlement)',
        },
        {
          account_id: payFromAccId,
          line_type: 'credit',
          amount: amt,
          memo: `Payment to card: ${selectedCardForPayment.card_name}`,
        },
      ],
    });

    if (res.success) {
      setPaymentSuccessMsg(`Payment of ${formatMoney(amt)} posted! Card liability reduced, no duplicate expense recorded.`);
      refreshData();
      setTimeout(() => {
        setPaymentSuccessMsg(null);
        setShowPayModal(false);
      }, 2000);
    }
  };

  const resetForm = () => {
    setCardName('');
    setLastFour('');
    setCreditLimit('');
    setStatementDay('15');
    setDueDay('5');
    setApr('20.0');
    setAnnualFee('0');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Credit Cards &amp; Statement Liabilities
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Card charges increase liability; card payments settle liability without double-counting expenses.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => setShowAddCardModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Credit Card</span>
          </button>
        )}
      </div>

      {/* Cards Display Grid */}
      {cards.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <CreditCardIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No credit cards added</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Track credit limits, available credit, statement dates, and settle card bills without distorting your expense records.
          </p>
          {canWrite && (
            <button
              onClick={() => setShowAddCardModal(true)}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Add Your First Card
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map(card => {
            const liabAccount = accounts.find(a => a.id === card.account_id);
            const outstanding = liabAccount?.current_balance_cached || 0;
            const availableCredit = Math.max(0, card.credit_limit - outstanding);
            const utilizationPct = Math.min(100, Math.round((outstanding / card.credit_limit) * 100));

            return (
              <div
                key={card.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between"
              >
                {/* Visual Card Plastic Facsimile */}
                <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono tracking-widest text-slate-400">
                      {card.issuing_bank}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      {card.card_network}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-lg font-mono tracking-widest my-3 text-slate-200">
                    <span>••••</span>
                    <span>••••</span>
                    <span>••••</span>
                    <span className="font-bold text-white">{card.last_four_digits}</span>
                  </div>

                  <div className="flex items-center justify-between text-2xs text-slate-400 pt-2 border-t border-slate-700/60 font-mono">
                    <span>Statement: {card.statement_day}th</span>
                    <span>Due: {card.payment_due_day}th</span>
                  </div>
                </div>

                {/* Card Financial Details & Utilization */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-2xs text-slate-400 font-semibold uppercase block">
                        Outstanding Balance
                      </span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-base tabular-nums">
                        {formatMoney(outstanding)}
                      </span>
                    </div>

                    <div>
                      <span className="text-2xs text-slate-400 font-semibold uppercase block">
                        Available Credit
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base tabular-nums">
                        {formatMoney(availableCredit)}
                      </span>
                    </div>
                  </div>

                  {/* Utilization Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
                      <span>Limit: {formatMoney(card.credit_limit)}</span>
                      <span>{utilizationPct}% utilized</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          utilizationPct > 80 ? 'bg-rose-500' : utilizationPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${utilizationPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-2xs text-slate-400 font-medium">
                      APR: {card.interest_rate_apr}%
                    </span>

                    {canWrite && (
                      <button
                        onClick={() => {
                          setSelectedCardForPayment(card);
                          setShowPayModal(true);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white transition-colors"
                      >
                        Settle / Pay Bill
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Card Modal */}
      {showAddCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Register Credit Card
              </h3>
              <button
                onClick={() => setShowAddCardModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Card Nickname / Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. City Bank American Express, BRAC Bank Visa Signature"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Issuing Bank
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. City Bank, EBL"
                    value={issuingBank}
                    onChange={(e) => setIssuingBank(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Card Network
                  </label>
                  <select
                    value={cardNetwork}
                    onChange={(e: any) => setCardNetwork(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="Amex">American Express</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Last 4 Digits Only
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    pattern="[0-9]{4}"
                    placeholder="8492"
                    value={lastFour}
                    onChange={(e) => setLastFour(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Credit Limit ({currentWorkspace?.currency || 'BDT'})
                  </label>
                  <input
                    type="number"
                    step="100"
                    placeholder="100000"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Statement Day (Day of Month)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={statementDay}
                    onChange={(e) => setStatementDay(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Due Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-2xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                <span>
                  PCI DSS compliance: Full 16-digit card number, CVV, and PINs are never stored. Only the last 4 digits are kept for identification.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCardModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Register Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Credit Card Bill Modal */}
      {showPayModal && selectedCardForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Pay Credit Card Bill
                </h3>
                <span className="text-2xs text-slate-500">
                  {selectedCardForPayment.card_name} (•••• {selectedCardForPayment.last_four_digits})
                </span>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentSuccessMsg && (
              <div className="p-3 mb-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{paymentSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handlePayCard} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pay From (Bank / Cash Account)
                </label>
                <select
                  value={payFromAccId}
                  onChange={(e) => setPayFromAccId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  <option value="">Select funding account</option>
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({formatMoney(b.current_balance_cached)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Accounting Protection Notice */}
              <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-2xs text-blue-800 dark:text-blue-300">
                <strong>Accounting Guardrail:</strong> This payment debits your Card Liability and credits your Bank account. It will NOT be recorded as an expense, preventing duplicate expense counting.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Confirm Card Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
