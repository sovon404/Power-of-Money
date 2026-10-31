import React, { useState } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { Sidebar, NavItemKey } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ExecutiveDashboard } from './components/dashboard/ExecutiveDashboard';
import { AccountsView } from './components/accounts/AccountsView';
import { LedgerView } from './components/ledger/LedgerView';
import { CreditCardsView } from './components/cards/CreditCardsView';
import { LoansView } from './components/loans/LoansView';
import { PropertyRegisterView } from './components/properties/PropertyRegisterView';
import { SavingsGoalsView } from './components/savings/SavingsGoalsView';
import { BudgetsView } from './components/budgets/BudgetsView';
import { RecurringBillsView } from './components/recurring/RecurringBillsView';
import { ReportBuilderView } from './components/reports/ReportBuilderView';
import { FamilyWorkspaceView } from './components/family/FamilyWorkspaceView';
import { AiAssistantView } from './components/ai/AiAssistantView';
import { OpeningBalanceWizard } from './components/setup/OpeningBalanceWizard';
import { SettingsView } from './components/settings/SettingsView';
import { NewTransactionModal } from './components/modals/NewTransactionModal';

const AppContent: React.FC = () => {
  const { isInitialSetupDone, refreshData } = useWorkspace();
  const [activeView, setActiveView] = useState<NavItemKey>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);

  // If user hasn't completed initial setup and is on dashboard, guide them with a notice
  const viewTitles: Record<NavItemKey, string> = {
    dashboard: 'Executive Overview',
    accounts: 'Accounts & MFS',
    ledger: 'Double-Entry Ledger',
    cards: 'Credit Cards',
    loans: 'Loans & Receivables',
    properties: 'Property Register',
    savings: 'DPS & Savings Goals',
    budgets: 'Budgets & Limits',
    recurring: 'Recurring & Bills',
    reports: 'Financial Reports',
    family: 'Family Collaboration',
    ai: 'AI Receipt & Advisor',
    setup: 'Opening Balances Wizard',
    settings: 'Settings & Categories',
  };

  const handleOpenAiScan = () => {
    setActiveView('ai');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          title={viewTitles[activeView]}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
          onOpenAiScan={handleOpenAiScan}
        />

        {/* Setup Banner Notice if not completed yet */}
        {!isInitialSetupDone && activeView !== 'setup' && (
          <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200 shadow-xs">
            <div>
              <strong className="font-semibold block sm:inline mr-2">Fresh Workspace Initialized:</strong>
              <span>Enter your real opening bank, cash, and bKash balances to establish Opening Equity.</span>
            </div>
            <button
              onClick={() => setActiveView('setup')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shrink-0 text-left sm:text-center"
            >
              Start Opening Wizard &rarr;
            </button>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeView === 'dashboard' && (
            <ExecutiveDashboard
              onNavigate={setActiveView}
              onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
              onOpenAiScan={handleOpenAiScan}
            />
          )}
          {activeView === 'accounts' && <AccountsView />}
          {activeView === 'ledger' && (
            <LedgerView onOpenNewTransaction={() => setIsNewTxModalOpen(true)} />
          )}
          {activeView === 'cards' && <CreditCardsView />}
          {activeView === 'loans' && <LoansView />}
          {activeView === 'properties' && <PropertyRegisterView />}
          {activeView === 'savings' && <SavingsGoalsView />}
          {activeView === 'budgets' && <BudgetsView />}
          {activeView === 'recurring' && <RecurringBillsView />}
          {activeView === 'reports' && <ReportBuilderView />}
          {activeView === 'family' && <FamilyWorkspaceView />}
          {activeView === 'ai' && <AiAssistantView />}
          {activeView === 'setup' && <OpeningBalanceWizard />}
          {activeView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Global New Transaction Modal */}
      <NewTransactionModal
        isOpen={isNewTxModalOpen}
        onClose={() => setIsNewTxModalOpen(false)}
        onSuccess={() => {
          refreshData();
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <WorkspaceProvider>
      <AppContent />
    </WorkspaceProvider>
  );
}
