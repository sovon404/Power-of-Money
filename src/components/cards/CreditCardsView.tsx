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
  CheckCircle2,
  Edit2,
  Trash2
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { CreditCard, FinancialAccount, JournalEntry } from '../../types';
import { toUuid } from '../../lib/uuid';
import { supabaseSync } from '../../services/supabaseSync';
import { NewTransactionModal } from '../modals/NewTransactionModal';

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

  // New Card Charge (Expense) Form state
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [selectedCardForCharge, setSelectedCardForCharge] = useState<CreditCard | null>(null);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeCategoryId, setChargeCategoryId] = useState('');
  const [chargeMerchant, setChargeMerchant] = useState('');
  const [chargeMemo, setChargeMemo] = useState('');
  const [chargeDate, setChargeDate] = useState(new Date().toISOString().split('T')[0]);

  const categories = db.getCategories(workspaceId);
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const journalEntries = db.getJournalEntries(workspaceId);

  // Edit Card Form state
  const [showEditCardModal, setShowEditCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editIssuingBank, setEditIssuingBank] = useState('');
  const [editCardNetwork, setEditCardNetwork] = useState<'Visa' | 'Mastercard' | 'Amex'>('Visa');
  const [editLastFour, setEditLastFour] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('');
  const [editStatementDay, setEditStatementDay] = useState('15');
  const [editDueDay, setEditDueDay] = useState('5');
  const [editApr, setEditApr] = useState('20.0');
  const [editAnnualFee, setEditAnnualFee] = useState('0');

  // Edit / Delete Ledger Transaction Modal state
  const [editingTxEntry, setEditingTxEntry] = useState<JournalEntry | null>(null);
  const [showTxModal, setShowTxModal] = useState(false);

  const handleOpenEditCard = (card: CreditCard) => {
    setEditingCard(card);
    setEditCardName(card.card_name);
    setEditIssuingBank(card.issuing_bank);
    setEditCardNetwork((card.card_network as any) || 'Visa');
    setEditLastFour(card.last_four_digits);
    setEditCreditLimit(card.credit_limit.toString());
    setEditStatementDay(card.statement_day.toString());
    setEditDueDay(card.payment_due_day.toString());
    setEditApr((card.interest_rate_apr ?? 20).toString());
    setEditAnnualFee((card.annual_fee ?? 0).toString());
    setShowEditCardModal(true);
  };

  const handleSaveEditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;

    const updatedCard: CreditCard = {
      ...editingCard,
      card_name: editCardName.trim(),
      issuing_bank: editIssuingBank.trim(),
      card_network: editCardNetwork,
      last_four_digits: editLastFour.trim(),
      credit_limit: parseFloat(editCreditLimit) || 0,
      statement_day: parseInt(editStatementDay, 10) || 15,
      payment_due_day: parseInt(editDueDay, 10) || 5,
      interest_rate_apr: parseFloat(editApr) || 0,
      annual_fee: parseFloat(editAnnualFee) || 0,
    };

    db.saveCreditCard(updatedCard);
    await supabaseSync.syncCreditCard(updatedCard, workspaceId);

    // Also update liability account name if present
    const liabAcc = accounts.find(a => a.id === editingCard.account_id);
    if (liabAcc) {
      db.saveAccount({
        ...liabAcc,
        name: `${editCardName.trim()} (${editIssuingBank.trim()} •••• ${editLastFour.trim()})`,
        provider: editIssuingBank.trim(),
        account_number_masked: `•••• ${editLastFour.trim()}`,
      });
    }

    refreshData();
    setShowEditCardModal(false);
    setEditingCard(null);
  };

  const handleDeleteCard = (card: CreditCard) => {
    if (window.confirm(`Are you sure you want to delete ${card.card_name} (•••• ${card.last_four_digits})? This will remove the card and its linked liability account from the database.`)) {
      db.deleteCreditCard(card.id, workspaceId);
      refreshData();
    }
  };

  const handleDeleteLedgerItem = (journalEntryId: string) => {
    if (window.confirm('Are you sure you want to delete this credit card transaction from the database? Account and card balances will be restored.')) {
      db.deleteJournalEntry(workspaceId, journalEntryId);
      refreshData();
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim() || !lastFour.trim() || !creditLimit) return;

    const limit = parseFloat(creditLimit) || 0;
    const cardId = toUuid(`card_${lastFour.trim()}_${workspaceId}_${Date.now()}`);
    const liabilityAccId = toUuid(`acc_card_liab_${lastFour.trim()}_${workspaceId}`);

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
    await supabaseSync.syncAccount(liabAcc, workspaceId);

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
    await supabaseSync.syncCreditCard(newCard, workspaceId);

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

  const handleChargeCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardForCharge || !chargeAmount || !chargeCategoryId) return;

    const amt = parseFloat(chargeAmount);
    if (isNaN(amt) || amt <= 0) return;

    const chosenCat = categories.find(c => c.id === chargeCategoryId);
    const catName = chosenCat?.name || 'Expense';

    // Strict Double-entry rule for credit card charge/expense:
    // Debit: Operating Expense Category (e.g. Personal Food, Mess Bill, Tech)
    // Credit: Credit Card Liability Account (Card liability increases)
    const res = db.postJournalEntry(workspaceId, {
      memo: chargeMemo || `Card Swipe: ${chargeMerchant || 'Purchase'} (${catName})`,
      source_type: 'credit_card_charge',
      source_id: selectedCardForCharge.id,
      entry_date: chargeDate,
      lines: [
        {
          account_id: toUuid(`acc_expense_operating_${workspaceId}`),
          category_id: chargeCategoryId,
          line_type: 'debit',
          amount: amt,
          counterparty: chargeMerchant,
          memo: chargeMemo || `Card purchase: ${catName}`,
        },
        {
          account_id: selectedCardForCharge.account_id,
          line_type: 'credit',
          amount: amt,
          memo: `Liability charged on ${selectedCardForCharge.card_name}`,
        },
      ],
    });

    if (res.success) {
      // Update account cached balance
      const liabAcc = accounts.find(a => a.id === selectedCardForCharge.account_id);
      if (liabAcc) {
        liabAcc.current_balance_cached += amt;
        db.saveAccount(liabAcc);
      }
      refreshData();
      setShowChargeModal(false);
      setChargeAmount('');
      setChargeMerchant('');
      setChargeMemo('');
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        {card.card_network}
                      </span>
                      {canWrite && (
                        <div className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/80">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCard(card)}
                            title="Edit Card Details"
                            className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCard(card)}
                            title="Delete Card"
                            className="p-1 rounded text-rose-400 hover:text-rose-200 hover:bg-rose-950/80 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedCardForCharge(card);
                            setShowChargeModal(true);
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors"
                        >
                          + Charge Expense
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCardForPayment(card);
                            setShowPayModal(true);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white transition-colors"
                        >
                          Settle Bill
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* CONNECTED CREDIT CARD IN-OUT LEDGER & EXPENSE BREAKDOWN   */}
      {/* ======================================================== */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCardIcon className="w-4 h-4 text-rose-500" />
              <span>Credit In-Out Ledger &amp; Connected Expenses</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live tracking of all charges (outflow expenses added) and payments (liability reductions) across all credit cards.
            </p>
          </div>
        </div>

        {/* In-Out Summary Cards */}
        {(() => {
          // Calculate card in-out numbers
          const cardAccountIds = new Set(cards.map(c => c.account_id));
          let totalCharges = 0; // Credit in (expenses charged to card)
          let totalPayments = 0; // Credit out (bills paid to card)
          const cardCategorySpend: Record<string, { name: string; amount: number }> = {};

          interface CardLedgerItem {
            id: string;
            journalEntryId: string;
            date: string;
            memo: string;
            type: 'charge' | 'payment';
            amount: number;
            cardName: string;
            categoryOrSource: string;
          }

          const items: CardLedgerItem[] = [];

          journalEntries.forEach(entry => {
            if (entry.status !== 'posted') return;

            // Check if any line touches a card liability account
            entry.lines?.forEach(line => {
              if (cardAccountIds.has(line.account_id)) {
                const card = cards.find(c => c.account_id === line.account_id);
                const cardLabel = card ? `${card.card_name} (•••• ${card.last_four_digits})` : 'Credit Card';

                if (line.line_type === 'credit') {
                  // Credit to card liability = charge/expense added
                  totalCharges += line.amount;

                  // Find companion debit line for category
                  const compLine = entry.lines?.find(l => l.id !== line.id && l.category_id);
                  const cat = categories.find(c => c.id === compLine?.category_id);
                  const catName = cat?.name || 'Operating Expense';

                  if (cat) {
                    if (!cardCategorySpend[cat.id]) cardCategorySpend[cat.id] = { name: cat.name, amount: 0 };
                    cardCategorySpend[cat.id].amount += line.amount;
                  }

                  items.push({
                    id: line.id,
                    journalEntryId: entry.id,
                    date: entry.entry_date,
                    memo: entry.memo,
                    type: 'charge',
                    amount: line.amount,
                    cardName: cardLabel,
                    categoryOrSource: catName,
                  });
                } else if (line.line_type === 'debit') {
                  // Debit to card liability = settlement/payment
                  totalPayments += line.amount;

                  const compLine = entry.lines?.find(l => l.id !== line.id && l.account_id);
                  const payerAcc = accounts.find(a => a.id === compLine?.account_id);

                  items.push({
                    id: line.id,
                    journalEntryId: entry.id,
                    date: entry.entry_date,
                    memo: entry.memo,
                    type: 'payment',
                    amount: line.amount,
                    cardName: cardLabel,
                    categoryOrSource: payerAcc ? `Paid from ${payerAcc.name}` : 'Bank Transfer',
                  });
                }
              }
            });
          });

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-2xs font-semibold text-rose-500 uppercase block mb-1">
                    Total Card Charges (Credit In)
                  </span>
                  <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatMoney(totalCharges)}
                  </div>
                  <span className="text-3xs text-slate-400 block mt-1">Expenses swiped onto cards</span>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-2xs font-semibold text-emerald-500 uppercase block mb-1">
                    Total Bill Settlements (Credit Out)
                  </span>
                  <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatMoney(totalPayments)}
                  </div>
                  <span className="text-3xs text-slate-400 block mt-1">Debited liability reductions</span>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-2xs font-semibold text-slate-500 uppercase block mb-1">
                    Net Outstanding Card Liability
                  </span>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                    {formatMoney(accounts.filter(a => a.account_type_id === 'credit_card').reduce((s, a) => s + a.current_balance_cached, 0))}
                  </div>
                  <span className="text-3xs text-slate-400 block mt-1">Active revolving dues</span>
                </div>
              </div>

              {/* Connected In-Out Activity Table */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-2xs uppercase tracking-wider text-slate-500 font-semibold">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Card</th>
                        <th className="py-2.5 px-4">Description / Linked Category</th>
                        <th className="py-2.5 px-4 text-right">In-Out Amount</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            No credit card swipes or settlements recorded yet. Use &ldquo;+ Charge Expense&rdquo; above to log a card swipe.
                          </td>
                        </tr>
                      ) : (
                        items.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-4 font-mono text-slate-500">{item.date}</td>
                            <td className="py-2.5 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-3xs font-semibold uppercase ${
                                item.type === 'charge'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                              }`}>
                                {item.type === 'charge' ? 'Charge (Expense)' : 'Payment (Settle)'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                              {item.cardName}
                            </td>
                            <td className="py-2.5 px-4 text-slate-900 dark:text-slate-100">
                              <div>{item.memo}</div>
                              <span className="text-2xs text-slate-400">{item.categoryOrSource}</span>
                            </td>
                            <td className={`py-2.5 px-4 text-right font-mono font-bold tabular-nums ${
                              item.type === 'charge' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {item.type === 'charge' ? `+${formatMoney(item.amount)}` : `-${formatMoney(item.amount)}`}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const found = journalEntries.find(e => e.id === item.journalEntryId);
                                    if (found) {
                                      setEditingTxEntry(found);
                                      setShowTxModal(true);
                                    }
                                  }}
                                  title="Edit Transaction"
                                  className="p-1 rounded-md text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLedgerItem(item.journalEntryId)}
                                  title="Delete Transaction"
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

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

      {/* Charge Card (Expense) Modal */}
      {showChargeModal && selectedCardForCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Record Credit Card Swipe (Expense)
                </h3>
                <span className="text-2xs text-slate-500">
                  Charged on {selectedCardForCharge.card_name} (•••• {selectedCardForCharge.last_four_digits})
                </span>
              </div>
              <button
                onClick={() => setShowChargeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChargeCard} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expense Category (from 36 Workspace Categories)
                </label>
                <select
                  value={chargeCategoryId}
                  onChange={(e) => setChargeCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  <option value="">Select expense category</option>
                  {expenseCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (BDT ৳)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Charge Date
                  </label>
                  <input
                    type="date"
                    value={chargeDate}
                    onChange={(e) => setChargeDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Merchant / Store Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shwapno, Star Tech, Cloud Server"
                  value={chargeMerchant}
                  onChange={(e) => setChargeMerchant(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Memo
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly groceries, tech equipment"
                  value={chargeMemo}
                  onChange={(e) => setChargeMemo(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-2xs text-rose-800 dark:text-rose-300">
                <strong>Accounting Guardrail:</strong> This swipe debits your chosen Operating Expense category and credits your Credit Card Liability.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowChargeModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-xs"
                >
                  Confirm Card Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Card Modal */}
      {showEditCardModal && editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Credit Card
              </h3>
              <button
                onClick={() => setShowEditCardModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCard} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Card Nickname / Display Name
                </label>
                <input
                  type="text"
                  value={editCardName}
                  onChange={(e) => setEditCardName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Issuing Bank / Entity
                  </label>
                  <input
                    type="text"
                    value={editIssuingBank}
                    onChange={(e) => setEditIssuingBank(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Network
                  </label>
                  <select
                    value={editCardNetwork}
                    onChange={(e) => setEditCardNetwork(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="Amex">American Express</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editLastFour}
                    onChange={(e) => setEditLastFour(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Credit Limit (BDT ৳)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editCreditLimit}
                    onChange={(e) => setEditCreditLimit(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Statement Day (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={editStatementDay}
                    onChange={(e) => setEditStatementDay(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Due Day (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={editDueDay}
                    onChange={(e) => setEditDueDay(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Interest APR (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editApr}
                    onChange={(e) => setEditApr(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Annual Fee (BDT ৳)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={editAnnualFee}
                    onChange={(e) => setEditAnnualFee(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteCard(editingCard);
                    setShowEditCardModal(false);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Card</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditCardModal(false)}
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

      {/* Global Transaction Modal for editing ledger swipes/settlements */}
      <NewTransactionModal
        isOpen={showTxModal}
        entryToEdit={editingTxEntry}
        onClose={() => {
          setShowTxModal(false);
          setEditingTxEntry(null);
        }}
        onSuccess={refreshData}
      />
    </div>
  );
};
