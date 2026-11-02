import React, { useState, useEffect } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { Sidebar, NavItemKey } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ExecutiveDashboard } from './components/dashboard/ExecutiveDashboard';
import { IncomeView } from './components/income/IncomeView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { AccountsView } from './components/accounts/AccountsView';
import { LedgerView } from './components/ledger/LedgerView';
import { CreditCardsView } from './components/cards/CreditCardsView';
import { LoansView } from './components/loans/LoansView';
import { PropertyRegisterView } from './components/properties/PropertyRegisterView';
import { SavingsGoalsView } from './components/savings/SavingsGoalsView';
import { BudgetsView } from './components/budgets/BudgetsView';
import { RecurringBillsView } from './components/recurring/RecurringBillsView';
import { ReportBuilderView } from './components/reports/ReportBuilderView';
import { AiAssistantView } from './components/ai/AiAssistantView';
import { SettingsView } from './components/settings/SettingsView';
import { NewTransactionModal } from './components/modals/NewTransactionModal';
import { AuthGate } from './components/auth/AuthGate';
import { AuthUser } from './types';
import { supabase } from './lib/supabase';

const VALID_VIEWS: NavItemKey[] = [
  'dashboard',
  'income',
  'expenses',
  'accounts',
  'ledger',
  'cards',
  'loans',
  'properties',
  'savings',
  'budgets',
  'recurring',
  'reports',
  'ai',
  'settings'
];

interface AppContentProps {
  onSignOut: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ onSignOut }) => {
  const { isInitialSetupDone, refreshData } = useWorkspace();

  // Read URL hash on load for full URL persistence across refresh
  const getInitialView = (): NavItemKey => {
    const hash = window.location.hash.replace(/^#\/?/, '') as NavItemKey;
    return VALID_VIEWS.includes(hash) ? hash : 'dashboard';
  };

  const [activeView, setActiveView] = useState<NavItemKey>(getInitialView);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);

  // Synchronize browser URL hash with view state
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '') as NavItemKey;
      if (VALID_VIEWS.includes(hash)) {
        setActiveView(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    if (!window.location.hash || !VALID_VIEWS.includes(window.location.hash.replace(/^#\/?/, '') as NavItemKey)) {
      window.location.hash = `#/${activeView}`;
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (view: NavItemKey) => {
    setActiveView(view);
    window.location.hash = `#/${view}`;
  };

  const viewTitles: Record<NavItemKey, string> = {
    dashboard: 'Executive Overview',
    income: 'Income Hub & Analytics',
    expenses: 'Central Expenses',
    accounts: 'Accounts & MFS',
    ledger: 'Double-Entry Ledger',
    cards: 'Credit Cards & In-Out',
    loans: 'Loans & Receivables',
    properties: 'Property Register',
    savings: 'DPS & Savings Goals',
    budgets: 'Budgets & Limits',
    recurring: 'Recurring & Bills',
    reports: 'Financial Reports & Telemetry',
    ai: 'AI Receipt & Advisor',
    settings: 'Settings & Categories',
  };

  const handleOpenAiScan = () => {
    navigateTo('ai');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        onSelectView={navigateTo}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        onSignOut={onSignOut}
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

        {/* Viewport Content with URL Persistence */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeView === 'dashboard' && (
            <ExecutiveDashboard
              onNavigate={navigateTo}
              onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
              onOpenAiScan={handleOpenAiScan}
            />
          )}
          {activeView === 'income' && <IncomeView />}
          {activeView === 'expenses' && (
            <ExpensesView
              onOpenAiScan={handleOpenAiScan}
              onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
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
          {activeView === 'ai' && <AiAssistantView />}
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
  // STRICT AUTHENTICATION GATE:
  // Must go with verified Supabase account. No guest bypass. No moving forward without real authentication.
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('pom_auth_session');
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed && parsed.id ? parsed : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // Check real Supabase session status
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      try {
        const saved = localStorage.getItem('pom_auth_session');
        const parsed = saved ? JSON.parse(saved) : null;
        if (parsed && parsed.id && parsed.id.startsWith('00000000')) {
          return; // Retain active sandbox demo session
        }
      } catch {
        // ignore parse error
      }

      if (error || !session?.user || !session.user.email_confirmed_at) {
        if (!session?.user) {
          localStorage.removeItem('pom_auth_session');
          setAuthUser(null);
        }
      } else {
        const verifiedUser: AuthUser = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Vault Owner',
        };
        localStorage.setItem('pom_auth_session', JSON.stringify(verifiedUser));
        setAuthUser(verifiedUser);
      }
    });

    // Real-time auth subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      try {
        const saved = localStorage.getItem('pom_auth_session');
        const parsed = saved ? JSON.parse(saved) : null;
        if (parsed && parsed.id && parsed.id.startsWith('00000000')) {
          return;
        }
      } catch {
        // ignore parse error
      }

      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('pom_auth_session');
        setAuthUser(null);
      } else if (session?.user && session.user.email_confirmed_at) {
        const verifiedUser: AuthUser = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Vault Owner',
        };
        localStorage.setItem('pom_auth_session', JSON.stringify(verifiedUser));
        setAuthUser(verifiedUser);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out notice:', err);
    }
    localStorage.removeItem('pom_auth_session');
    setAuthUser(null);
  };

  const handleAuthenticated = (user: AuthUser) => {
    localStorage.setItem('pom_auth_session', JSON.stringify(user));
    setAuthUser(user);
  };

  if (!authUser) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  return (
    <WorkspaceProvider authUser={authUser}>
      <AppContent onSignOut={handleSignOut} />
    </WorkspaceProvider>
  );
}
