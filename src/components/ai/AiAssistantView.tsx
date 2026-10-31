import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Upload, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Bot, 
  Send, 
  FileText, 
  ShieldCheck,
  Scale
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { ReceiptScanResult } from '../../types';

export const AiAssistantView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const categories = db.getCategories(workspaceId);
  const entries = db.getJournalEntries(workspaceId);
  const loans = db.getLoans(workspaceId);
  const properties = db.getProperties(workspaceId);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'receipt' | 'insights' | 'advisor'>('receipt');

  // Receipt Scanner State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedFundingAccountId, setSelectedFundingAccountId] = useState(accounts[0]?.id || '');
  const [confirmedPostSuccess, setConfirmedPostSuccess] = useState<string | null>(null);

  // Financial Health Insights State
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsData, setInsightsData] = useState<any | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Advisor Chat State
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    {
      sender: 'assistant',
      text: `Hello! I am your Power of Money Financial Advisor. How can I assist you with your ${currentWorkspace?.currency || 'BDT'} finances today? Ask about your net worth, debt management, or budget optimizations.`,
    },
  ]);

  // Image Upload & OCR
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setScanResult(null);
      setScanError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleScanReceipt = async () => {
    if (!selectedImage) return;
    setIsScanning(true);
    setScanError(null);
    setConfirmedPostSuccess(null);

    try {
      const availableCatNames = categories.map(c => c.name);
      const res = await fetch('/api/gemini/analyze-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImage,
          availableCategories: availableCatNames,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to scan receipt');
      }

      setScanResult(data.data);
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || 'Receipt analysis failed. Please verify API configuration.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmAndPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanResult || !selectedFundingAccountId) return;

    // Find suggested category
    const matchedCat = categories.find(c => c.name.toLowerCase() === scanResult.categorySuggestion.toLowerCase()) || categories[0];

    // Explicit User Confirmation Step:
    const res = db.postJournalEntry(workspaceId, {
      memo: `${scanResult.merchant}: ${scanResult.summary || 'Receipt Purchase'}`,
      source_type: 'ai_receipt_scan',
      entry_date: scanResult.date || new Date().toISOString().split('T')[0],
      lines: [
        {
          account_id: selectedFundingAccountId,
          line_type: 'credit',
          amount: scanResult.amount,
          memo: `Paid to ${scanResult.merchant}`,
          counterparty: scanResult.merchant,
        },
        {
          account_id: selectedFundingAccountId,
          line_type: 'debit',
          amount: scanResult.amount,
          memo: `${matchedCat?.name}: ${scanResult.summary || 'Purchase'}`,
          category_id: matchedCat?.id,
          counterparty: scanResult.merchant,
        },
      ],
    });

    if (res.success) {
      setConfirmedPostSuccess(`Transaction posted to ledger! ${formatMoney(scanResult.amount)} categorized under ${matchedCat?.name}.`);
      refreshData();
      setTimeout(() => {
        setConfirmedPostSuccess(null);
        setScanResult(null);
        setSelectedImage(null);
      }, 3000);
    }
  };

  // Generate Insights
  const handleGenerateInsights = async () => {
    setInsightsLoading(true);
    setInsightsError(null);

    const summaryPayload = {
      accountsCount: accounts.length,
      liquidAssetsTotal: accounts.filter(a => ['cash', 'bank', 'mfs'].includes(a.account_type_id)).reduce((s, a) => s + a.current_balance_cached, 0),
      loansOwedTotal: loans.filter(l => l.type === 'borrowed').reduce((s, l) => s + (l.principal_amount - l.total_principal_repaid), 0),
      moneyLentTotal: loans.filter(l => l.type === 'lent').reduce((s, l) => s + (l.principal_amount - l.total_principal_repaid), 0),
      propertiesCount: properties.length,
      recentEntriesCount: entries.length,
    };

    try {
      const res = await fetch('/api/gemini/financial-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summaryData: summaryPayload,
          currency: currentWorkspace?.currency || 'BDT',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch insights');
      }

      setInsightsData(data.data);
    } catch (err: any) {
      setInsightsError(err.message || 'Failed to generate financial advisory report.');
    } finally {
      setInsightsLoading(false);
    }
  };

  // Ask Advisor Chat
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuestion.trim() || chatLoading) return;

    const userQ = chatQuestion.trim();
    setChatQuestion('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userQ }]);
    setChatLoading(true);

    try {
      const contextSummary = {
        workspaceName: currentWorkspace?.name,
        currency: currentWorkspace?.currency || 'BDT',
        totalAccounts: accounts.length,
        totalEntries: entries.length,
      };

      const res = await fetch('/api/gemini/ask-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userQ,
          context: contextSummary,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to answer question');
      }

      setChatMessages(prev => [...prev, { sender: 'assistant', text: data.answer }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { sender: 'assistant', text: `Sorry, I encountered an issue: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>AI Receipt Scanner &amp; Financial Advisor</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Powered securely by server-side Gemini 3.8 Flash. AI never posts without your explicit review.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('receipt')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'receipt'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Receipt OCR
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'insights'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Portfolio Insights
          </button>
          <button
            onClick={() => setActiveTab('advisor')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'advisor'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Ask Advisor
          </button>
        </div>
      </div>

      {/* Mode 1: Receipt Scanner & Confirmation Workflow */}
      {activeTab === 'receipt' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload & Preview Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              1. Upload Receipt or Utility Bill Image
            </h3>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedImage ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-72 flex items-center justify-center bg-slate-950">
                  <img
                    src={selectedImage}
                    alt="Receipt Preview"
                    className="max-h-72 object-contain"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white underline"
                  >
                    Change Image
                  </button>

                  <button
                    onClick={handleScanReceipt}
                    disabled={isScanning}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-xs transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isScanning ? 'Extracting Fields...' : 'Analyze with Gemini'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                  <Camera className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Click to Upload Receipt, Bill or Memo
                </h4>
                <p className="text-2xs text-slate-400 max-w-xs mx-auto">
                  Supports JPG, PNG, WEBP receipts. Automatically extracts vendor, amounts in ৳, date, and category.
                </p>
              </div>
            )}

            {scanError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}
          </div>

          {/* OCR Review & Explicit Confirmation Step */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                2. Review &amp; Post to Double-Entry Ledger
              </h3>
              <span className="text-2xs text-slate-400 font-medium">
                Mandatory User Review
              </span>
            </div>

            {confirmedPostSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{confirmedPostSuccess}</span>
              </div>
            )}

            {scanResult ? (
              <form onSubmit={handleConfirmAndPost} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Detected Merchant
                    </label>
                    <input
                      type="text"
                      value={scanResult.merchant}
                      onChange={(e) => setScanResult({ ...scanResult, merchant: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Total Amount ({scanResult.currency || 'BDT'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={scanResult.amount}
                      onChange={(e) => setScanResult({ ...scanResult, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={scanResult.date}
                      onChange={(e) => setScanResult({ ...scanResult, date: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Suggested Category
                    </label>
                    <select
                      value={scanResult.categorySuggestion}
                      onChange={(e) => setScanResult({ ...scanResult, categorySuggestion: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Debit Payment Account (Paid From)
                  </label>
                  <select
                    value={selectedFundingAccountId}
                    onChange={(e) => setSelectedFundingAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatMoney(a.current_balance_cached)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-2xs text-slate-500">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    AI Safety Guardrail Enforced:
                  </div>
                  Reviewing the extracted values ensures complete financial accuracy before writing balanced entries into your ledger.
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors"
                  >
                    Confirm &amp; Post to Ledger
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                Upload a receipt image on the left to extract merchant, date, amount, and suggested category.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Portfolio Insights */}
      {activeTab === 'insights' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Executive Financial Health Assessment
              </h3>
              <p className="text-xs text-slate-500">
                AI analyzes debt-to-liquid asset ratios, card exposure, and recommends wealth optimization.
              </p>
            </div>

            <button
              onClick={handleGenerateInsights}
              disabled={insightsLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-xs transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>{insightsLoading ? 'Analyzing Portfolio...' : 'Generate New Advisory'}</span>
            </button>
          </div>

          {insightsError && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{insightsError}</span>
            </div>
          )}

          {insightsData ? (
            <div className="space-y-4 pt-2">
              {/* Score banner */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-2xs uppercase tracking-wider text-slate-400 font-bold block">
                    Financial Health Score
                  </span>
                  <div className="text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {insightsData.healthScore} / 100
                  </div>
                </div>
                <div className="max-w-md text-xs text-slate-600 dark:text-slate-300">
                  {insightsData.assessmentSummary}
                </div>
              </div>

              {/* Recommendations list */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Actionable Recommendations
                </h4>
                <div className="space-y-2">
                  {insightsData.recommendations?.map((rec: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs">
              Click &quot;Generate New Advisory&quot; to review AI health indicators and debt optimization recommendations.
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Ask Financial Advisor Chat */}
      {activeTab === 'advisor' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col h-[520px] overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Power of Money Advisor
              </span>
            </div>
            <span className="text-2xs text-slate-400">
              Grounded in {currentWorkspace?.name}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-lg rounded-2xl p-3.5 text-xs ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl p-3 text-xs italic">
                  Advisor is analyzing your records...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendChat} className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask a question about your debts, savings rate, or property valuations..."
              value={chatQuestion}
              onChange={(e) => setChatQuestion(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatQuestion.trim()}
              className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
