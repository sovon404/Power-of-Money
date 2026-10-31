import React from 'react';
import { Menu, Plus, Sparkles, Moon, Sun } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface HeaderProps {
  title: string;
  onOpenMobileNav: () => void;
  onOpenNewTransaction: () => void;
  onOpenAiScan: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onOpenMobileNav,
  onOpenNewTransaction,
  onOpenAiScan,
}) => {
  const { currentWorkspace, canWrite } = useWorkspace();
  const [isDarkMode, setIsDarkMode] = React.useState<boolean>(() => {
    return document.documentElement.classList.contains('dark');
  });

  const toggleDarkMode = () => {
    const isDark = !isDarkMode;
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 transition-colors">
      <div className="flex items-center justify-between gap-4">
        {/* Zone 1: Mobile Toggle & Context Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileNav}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white lg:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white truncate">
            <span className="text-slate-500 dark:text-slate-400 font-normal hidden sm:inline">
              {currentWorkspace?.name}
            </span>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
            <span className="truncate">{title}</span>
          </div>
        </div>

        {/* Zone 3: Primary Action Affordances */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick AI Receipt Scan button */}
          <button
            onClick={onOpenAiScan}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Scan Receipt</span>
          </button>

          {/* Quick New Transaction Modal */}
          {canWrite && (
            <button
              onClick={onOpenNewTransaction}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-lg shadow-xs transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Record Entry</span>
            </button>
          )}

          {/* Dark Mode Switch */}
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle color theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
