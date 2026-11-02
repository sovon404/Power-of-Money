import React from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  BookOpen, 
  CreditCard, 
  HandCoins, 
  Building2, 
  PiggyBank, 
  PieChart, 
  Repeat, 
  BarChart3, 
  Sparkles, 
  Settings, 
  ShieldCheck, 
  TrendingUp,
  Receipt,
  LogOut
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export type NavItemKey = 
  | 'dashboard'
  | 'income'
  | 'expenses'
  | 'accounts'
  | 'ledger'
  | 'cards'
  | 'loans'
  | 'properties'
  | 'savings'
  | 'budgets'
  | 'recurring'
  | 'reports'
  | 'ai'
  | 'settings';

interface SidebarProps {
  activeView: NavItemKey;
  onSelectView: (view: NavItemKey) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  isOpenMobile,
  onCloseMobile,
  onSignOut,
}) => {
  const { currentUser } = useWorkspace();

  const navItems: Array<{ key: NavItemKey; label: string; icon: React.FC<{ className?: string }> }> = [
    { key: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { key: 'income', label: 'Income Hub', icon: TrendingUp },
    { key: 'expenses', label: 'Central Expenses', icon: Receipt },
    { key: 'accounts', label: 'Accounts & MFS', icon: Wallet },
    { key: 'ledger', label: 'Double-Entry Ledger', icon: BookOpen },
    { key: 'cards', label: 'Credit Cards', icon: CreditCard },
    { key: 'loans', label: 'Loans & Receivables', icon: HandCoins },
    { key: 'properties', label: 'Property Register', icon: Building2 },
    { key: 'savings', label: 'DPS & Savings Goals', icon: PiggyBank },
    { key: 'budgets', label: 'Budgets & Limits', icon: PieChart },
    { key: 'recurring', label: 'Recurring & Bills', icon: Repeat },
    { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { key: 'ai', label: 'AI Receipt & Advisor', icon: Sparkles },
    { key: 'settings', label: 'Settings & Categories', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 text-slate-200 border-r border-slate-800
        flex flex-col transition-transform duration-200 ease-in-out
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand & User Vault Header */}
        <div className="p-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 px-1 py-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-xs shrink-0">
              ৳
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold text-white tracking-tight block leading-tight truncate">
                Power of Money
              </span>
              <span className="text-2xs text-emerald-400 font-medium mt-0.5 flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                Personal Financial Vault
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onSelectView(item.key);
                  onCloseMobile();
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left whitespace-nowrap cursor-pointer
                  ${isActive 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Status Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center justify-between text-xs px-2 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-emerald-700/60 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="truncate min-w-0">
                <span className="block text-white font-medium text-xs truncate" title={currentUser?.name}>
                  {currentUser?.name || 'Vault Owner'}
                </span>
                <span className="block text-slate-400 text-2xs truncate font-mono" title={currentUser?.email}>
                  {currentUser?.email || 'Authenticated'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-emerald-400 text-2xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Single User</span>
              </div>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  title="Sign out of account"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
