import React, { useState } from 'react';
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
  Users, 
  Sparkles, 
  Sliders, 
  Settings, 
  Plus, 
  Check, 
  ShieldCheck, 
  ChevronDown
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export type NavItemKey = 
  | 'dashboard'
  | 'accounts'
  | 'ledger'
  | 'cards'
  | 'loans'
  | 'properties'
  | 'savings'
  | 'budgets'
  | 'recurring'
  | 'reports'
  | 'family'
  | 'ai'
  | 'setup'
  | 'settings';

interface SidebarProps {
  activeView: NavItemKey;
  onSelectView: (view: NavItemKey) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { 
    currentWorkspace, 
    workspaces, 
    switchWorkspace, 
    createFamilyWorkspace, 
    userRole 
  } = useWorkspace();

  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  const navItems: Array<{ key: NavItemKey; label: string; icon: React.FC<{ className?: string }>; section?: string }> = [
    { key: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { key: 'accounts', label: 'Accounts & MFS', icon: Wallet },
    { key: 'ledger', label: 'Double-Entry Ledger', icon: BookOpen },
    { key: 'cards', label: 'Credit Cards', icon: CreditCard },
    { key: 'loans', label: 'Loans & Receivables', icon: HandCoins },
    { key: 'properties', label: 'Property Register', icon: Building2 },
    { key: 'savings', label: 'DPS & Savings Goals', icon: PiggyBank },
    { key: 'budgets', label: 'Budgets & Limits', icon: PieChart },
    { key: 'recurring', label: 'Recurring & Bills', icon: Repeat },
    { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { key: 'family', label: 'Family Collaboration', icon: Users },
    { key: 'ai', label: 'AI Receipt & Advisor', icon: Sparkles },
    { key: 'setup', label: 'Opening Balances', icon: Sliders },
    { key: 'settings', label: 'Settings & Categories', icon: Settings },
  ];

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    createFamilyWorkspace(newWsName.trim());
    setNewWsName('');
    setShowNewWorkspaceModal(false);
    setIsWorkspaceMenuOpen(false);
  };

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
        {/* Brand & Workspace Switcher Header */}
        <div className="p-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-base">
              ৳
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight block leading-tight">
                Power of Money
              </span>
              <span className="text-xs text-slate-400 block font-normal">
                Financial Operating System
              </span>
            </div>
          </div>

          {/* Workspace Switcher Button */}
          <div className="relative">
            <button
              onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors"
            >
              <div className="truncate pr-2">
                <span className="text-xs text-slate-400 block uppercase font-medium tracking-wider">
                  {currentWorkspace?.type === 'family' ? 'Family Workspace' : 'Personal Workspace'}
                </span>
                <span className="text-sm font-semibold text-white truncate block">
                  {currentWorkspace?.name || 'Loading...'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {isWorkspaceMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30 py-1 overflow-hidden">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                  Switch Workspace
                </div>
                {workspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      switchWorkspace(ws.id);
                      setIsWorkspaceMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-700/70 transition-colors text-slate-200"
                  >
                    <div className="truncate">
                      <div className="font-medium text-white truncate">{ws.name}</div>
                      <div className="text-slate-400 text-2xs capitalize">{ws.type} · {ws.currency}</div>
                    </div>
                    {ws.id === currentWorkspace?.id && (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />
                    )}
                  </button>
                ))}
                
                <div className="border-t border-slate-700 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowNewWorkspaceModal(true);
                      setIsWorkspaceMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:bg-slate-700/50 font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Family Workspace
                  </button>
                </div>
              </div>
            )}
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
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left whitespace-nowrap
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
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
                S
              </div>
              <div className="truncate">
                <span className="block text-white font-medium truncate">Sovon</span>
                <span className="block text-slate-400 text-2xs">Workspace {userRole}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-emerald-400 text-2xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Isolated</span>
            </div>
          </div>
        </div>
      </aside>

      {/* New Family Workspace Modal */}
      {showNewWorkspaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Create Family Workspace
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Family workspaces allow shared management of properties, household accounts, and budgets while keeping your personal workspace 100% private.
            </p>

            <form onSubmit={handleCreateWorkspace}>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Khan Family Household"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewWorkspaceModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-xs"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
