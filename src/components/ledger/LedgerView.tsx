import React, { useState } from 'react';
import { 
  Plus, 
  RotateCcw, 
  Search, 
  Filter, 
  Scale, 
  ChevronRight, 
  ChevronDown, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { JournalEntry } from '../../types';

interface LedgerViewProps {
  onOpenNewTransaction: () => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({ onOpenNewTransaction }) => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const entries = db.getJournalEntries(workspaceId);
  const accounts = db.getAccounts(workspaceId);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterType, setFilterType] = useState('');
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, boolean>>({});

  // Reversal Modal state
  const [reversalTarget, setReversalTarget] = useState<JournalEntry | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalError, setReversalError] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedEntryIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredEntries = entries.filter(e => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMemo = e.memo.toLowerCase().includes(q);
      const matchNumber = e.entry_number.toString().includes(q);
      const matchLines = e.lines?.some(l => l.counterparty?.toLowerCase().includes(q) || l.memo?.toLowerCase().includes(q));
      if (!matchMemo && !matchNumber && !matchLines) return false;
    }
    if (filterAccount) {
      const touchesAccount = e.lines?.some(l => l.account_id === filterAccount);
      if (!touchesAccount) return false;
    }
    if (filterType && e.source_type !== filterType) {
      return false;
    }
    return true;
  });

  const handleExecuteReversal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget) return;

    if (!reversalReason.trim()) {
      setReversalError('Please provide an audit reason for the transaction reversal.');
      return;
    }

    const res = db.postReversal(workspaceId, reversalTarget.id, reversalReason.trim());
    if (!res.success) {
      setReversalError(res.error || 'Failed to reverse transaction.');
      return;
    }

    refreshData();
    setReversalTarget(null);
    setReversalReason('');
    setReversalError(null);
  };

  const getAccountName = (accId: string) => {
    return accounts.find(a => a.id === accId)?.name || 'Account';
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Double-Entry General Ledger</span>
            <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Balanced Debits = Credits
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Immutable transaction records. Errors are corrected through audit-tracked reversal entries.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={onOpenNewTransaction}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Record Transaction</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search memo, vendor, transaction number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="">All Accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="manual">Manual Entry</option>
            <option value="transfer">Account Transfer</option>
            <option value="opening_balance">Opening Balance</option>
            <option value="credit_card_payment">Card Payment</option>
            <option value="loan_repayment">Loan Repayment</option>
            <option value="ai_receipt_scan">AI Receipt Scan</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Scale className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold">No journal entries match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-2xs">
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-2">#</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-4">Transaction Memo</th>
                  <th className="py-3 px-3">Source Type</th>
                  <th className="py-3 px-4 text-right">Debit Balance</th>
                  <th className="py-3 px-4 text-right">Credit Balance</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredEntries.map(entry => {
                  const isExpanded = Boolean(expandedEntryIds[entry.id]);
                  const debitTotal = entry.lines?.reduce((s, l) => s + (l.line_type === 'debit' ? l.amount : 0), 0) || 0;
                  const creditTotal = entry.lines?.reduce((s, l) => s + (l.line_type === 'credit' ? l.amount : 0), 0) || 0;

                  return (
                    <React.Fragment key={entry.id}>
                      <tr 
                        onClick={() => toggleExpand(entry.id)}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${
                          entry.status === 'reversed' ? 'opacity-60 bg-slate-50/50 dark:bg-slate-800/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-slate-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="py-3 px-2 font-mono text-slate-400">
                          #{entry.entry_number}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {entry.entry_date}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span>{entry.memo}</span>
                            {entry.is_reversal && (
                              <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                Reversal
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-500 capitalize whitespace-nowrap">
                          {entry.source_type.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                          {formatMoney(debitTotal)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-blue-600 dark:text-blue-400 tabular-nums whitespace-nowrap">
                          {formatMoney(creditTotal)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${
                            entry.status === 'posted'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          }`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {entry.status === 'posted' && canWrite && (
                            <button
                              onClick={() => setReversalTarget(entry)}
                              title="Reverse this transaction with audit entry"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reverse</span>
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Sub-Lines (Debits & Credits) */}
                      {isExpanded && entry.lines && (
                        <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                          <td colSpan={9} className="p-4 pl-12">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xs">
                              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                                Double-Entry Journal Lines
                              </span>
                              <div className="space-y-1.5">
                                {entry.lines.map((line, idx) => (
                                  <div
                                    key={line.id || idx}
                                    className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold uppercase text-2xs px-1.5 py-0.5 rounded ${
                                        line.line_type === 'debit'
                                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                          : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                                      }`}>
                                        {line.line_type}
                                      </span>
                                      <span className="font-semibold text-slate-900 dark:text-white">
                                        {getAccountName(line.account_id)}
                                      </span>
                                      {line.counterparty && (
                                        <span className="text-slate-400 text-2xs">
                                          (Counterparty: {line.counterparty})
                                        </span>
                                      )}
                                    </div>
                                    <div className="font-bold tabular-nums">
                                      {formatMoney(line.amount)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Reversal Modal */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Reverse Transaction #{reversalTarget.entry_number}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Financial transactions cannot be deleted. This will post an exact inverse mirror entry to reverse the balances with an audit trail.
            </p>

            {reversalError && (
              <div className="p-3 mb-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{reversalError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteReversal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Reversal
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inadvertent duplicate entry, Wrong counterparty selected"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReversalTarget(null)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-xs"
                >
                  Confirm Reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
