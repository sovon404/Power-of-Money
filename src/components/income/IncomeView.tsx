import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Plus, 
  PieChart as PieIcon, 
  Lightbulb, 
  ShieldAlert, 
  Calendar, 
  Search,
  Filter,
  Edit2,
  Trash2,
  History,
  Building2,
  Briefcase,
  Globe,
  Laptop,
  Settings2,
  Check,
  X,
  Layers,
  Tag,
  ArrowUpRight,
  HelpCircle
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { db } from '../../services/db';
import { JournalEntry, Category, IncomeTypeItem } from '../../types';
import { NewTransactionModal } from '../modals/NewTransactionModal';
import { toUuid, generateUuid } from '../../lib/uuid';

const PRESET_COLORS = [
  '#10b981', '#0284c7', '#d97706', '#8b5cf6', '#ec4899', 
  '#0d9488', '#6366f1', '#f97316', '#14b8a6', '#64748b'
];

const PRESET_ICONS = [
  { id: 'briefcase', label: 'Briefcase' },
  { id: 'laptop', label: 'Laptop / Tech' },
  { id: 'building', label: 'Building / Land' },
  { id: 'globe', label: 'Globe / Web' },
  { id: 'trending-up', label: 'Growth / Invest' },
  { id: 'dollar-sign', label: 'Money / Cash' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'tag', label: 'Tag' },
];

export const IncomeView: React.FC = () => {
  const { currentWorkspace, formatMoney, refreshData, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';

  const accounts = db.getAccounts(workspaceId).filter(a => !a.is_archived);
  const categories = db.getCategories(workspaceId);
  const incomeCategories = categories.filter(c => c.type === 'income');
  const journalEntries = db.getJournalEntries(workspaceId);

  // Income Types
  const incomeTypes: IncomeTypeItem[] = useMemo(() => {
    return db.getIncomeTypes(workspaceId);
  }, [workspaceId, currentWorkspace]);

  const incomeTypeMap = useMemo(() => {
    return new Map(incomeTypes.map(t => [t.id, t]));
  }, [incomeTypes]);

  // Modal states
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  // Add / Edit Income Head (Category) Modal
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [headName, setHeadName] = useState('');
  const [headIncomeType, setHeadIncomeType] = useState('salary');
  const [headColor, setHeadColor] = useState('#10b981');
  const [headIcon, setHeadIcon] = useState('briefcase');

  // Manage Income Types Modal
  const [showManageTypesModal, setShowManageTypesModal] = useState(false);
  const [customTypes, setCustomTypes] = useState<IncomeTypeItem[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDesc, setNewTypeDesc] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#0284c7');
  const [newTypeIcon, setNewTypeIcon] = useState('laptop');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);

  // Table filter states
  const [dateFilterRange, setDateFilterRange] = useState<'7days' | '30days' | 'this_month' | 'all' | 'custom'>('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [filterIncomeType, setFilterIncomeType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Extract purely real income transaction rows from posted journal entries
  interface IncomeRecord {
    entryId: string;
    date: string;
    memo: string;
    counterparty: string;
    categoryId?: string;
    categoryName: string;
    categoryColor: string;
    incomeTypeId: string;
    incomeTypeName: string;
    incomeTypeColor: string;
    accountId: string;
    accountName: string;
    amount: number;
    isHistorical: boolean;
    historicalNote?: string;
    rawEntry: JournalEntry;
  }

  // Ensure income categories are initialized
  React.useEffect(() => {
    if (workspaceId) {
      db.ensureCategoriesForWorkspace(workspaceId);
    }
  }, [workspaceId]);

  const incomeRecords: IncomeRecord[] = useMemo(() => {
    const records: IncomeRecord[] = [];
    const incomeCatMap = new Map(incomeCategories.map(c => [c.id, c]));
    const allCatMap = new Map(categories.map(c => [c.id, c]));
    const defaultIncomeAccUuid = toUuid(`acc_income_earned_${workspaceId}`);

    journalEntries.forEach(entry => {
      if (entry.status !== 'posted') return;

      // Find any line with an income category, or an income account line
      const incomeCatLine = entry.lines?.find(l => l.category_id && incomeCatMap.has(l.category_id));
      const creditLine = entry.lines?.find(l => l.line_type === 'credit');
      const debitLine = entry.lines?.find(l => l.line_type === 'debit');

      // Check credit account
      const creditAcc = creditLine ? accounts.find(a => a.id === creditLine.account_id) : undefined;
      const isCreditToIncome = Boolean(
        creditLine && (
          creditLine.account_id === defaultIncomeAccUuid ||
          creditAcc?.account_type_id?.startsWith('income') ||
          creditAcc?.name.toLowerCase().includes('income') ||
          creditAcc?.name.toLowerCase().includes('revenue')
        )
      );

      // Check if this entry represents income
      const isIncome = Boolean(
        incomeCatLine ||
        isCreditToIncome ||
        (creditLine && (
          creditLine.memo?.toLowerCase().includes('salary') || 
          creditLine.memo?.toLowerCase().includes('income') ||
          creditLine.memo?.toLowerCase().includes('freelance') ||
          creditLine.memo?.toLowerCase().includes('mortgage')
        )) ||
        (entry.memo && (
          entry.memo.toLowerCase().includes('salary') || 
          entry.memo.toLowerCase().includes('freelance') || 
          entry.memo.toLowerCase().includes('mortgage') ||
          entry.memo.toLowerCase().includes('earned revenue')
        ))
      );

      if (!isIncome) return;

      const catId = incomeCatLine?.category_id || creditLine?.category_id || debitLine?.category_id;
      const cat = catId ? (incomeCatMap.get(catId) || allCatMap.get(catId)) : undefined;
      const depositAcc = debitLine ? accounts.find(a => a.id === debitLine.account_id) : undefined;
      const amount = incomeCatLine?.amount || creditLine?.amount || debitLine?.amount || 0;

      // Derive income type
      let typeId = cat?.income_type;
      if (!typeId) {
        const catNameLower = (cat?.name || entry.memo || '').toLowerCase();
        if (catNameLower.includes('salary') || catNameLower.includes('bonus') || catNameLower.includes('allowance')) typeId = 'salary';
        else if (catNameLower.includes('freelance') || catNameLower.includes('remote') || catNameLower.includes('contract')) typeId = 'remote_freelance';
        else if (catNameLower.includes('mortgage') || catNameLower.includes('rent') || catNameLower.includes('land') || catNameLower.includes('lease')) typeId = 'land_mortgage';
        else if (catNameLower.includes('invest') || catNameLower.includes('return') || catNameLower.includes('dividend')) typeId = 'investment';
        else if (catNameLower.includes('business') || catNameLower.includes('trade')) typeId = 'business';
        else typeId = 'other';
      }

      const typeInfo = incomeTypeMap.get(typeId);

      records.push({
        entryId: entry.id,
        date: entry.entry_date,
        memo: entry.memo,
        counterparty: creditLine?.counterparty || debitLine?.counterparty || '',
        categoryId: catId,
        categoryName: cat?.name || 'General Income',
        categoryColor: cat?.color || '#10b981',
        incomeTypeId: typeId,
        incomeTypeName: typeInfo?.name || typeId.replace('_', ' ').toUpperCase(),
        incomeTypeColor: typeInfo?.color || '#64748b',
        accountId: debitLine?.account_id || '',
        accountName: depositAcc?.name || 'Liquid Account',
        amount: Number(amount),
        isHistorical: Boolean(entry.is_historical),
        historicalNote: entry.historical_note,
        rawEntry: entry,
      });
    });

    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [journalEntries, incomeCategories, categories, accounts, incomeTypeMap, workspaceId]);

  // Total inflow
  const totalInflow = useMemo(() => {
    return incomeRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [incomeRecords]);

  // 2. Compute type-wise summaries
  interface TypeSummary {
    typeId: string;
    typeName: string;
    description?: string;
    color: string;
    icon: string;
    total: number;
    count: number;
    percentage: number;
  }

  const typeSummaries: TypeSummary[] = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};

    // Initialize all existing income types
    incomeTypes.forEach(t => {
      map[t.id] = { total: 0, count: 0 };
    });

    incomeRecords.forEach(rec => {
      if (!map[rec.incomeTypeId]) {
        map[rec.incomeTypeId] = { total: 0, count: 0 };
      }
      map[rec.incomeTypeId].total += rec.amount;
      map[rec.incomeTypeId].count += 1;
    });

    return incomeTypes.map(t => {
      const data = map[t.id] || { total: 0, count: 0 };
      const pct = totalInflow > 0 ? (data.total / totalInflow) * 100 : 0;
      return {
        typeId: t.id,
        typeName: t.name,
        description: t.description,
        color: t.color,
        icon: t.icon,
        total: data.total,
        count: data.count,
        percentage: pct,
      };
    });
  }, [incomeTypes, incomeRecords, totalInflow]);

  // 3. Compute category (head) totals
  const categoryTotals = useMemo(() => {
    const map: Record<string, { id: string; name: string; incomeType?: string; total: number; count: number; color: string }> = {};

    incomeCategories.forEach(cat => {
      map[cat.id] = { 
        id: cat.id, 
        name: cat.name, 
        incomeType: cat.income_type, 
        total: 0, 
        count: 0, 
        color: cat.color || '#10b981' 
      };
    });

    incomeRecords.forEach(rec => {
      if (rec.categoryId && map[rec.categoryId]) {
        map[rec.categoryId].total += rec.amount;
        map[rec.categoryId].count += 1;
      } else {
        const key = rec.categoryName;
        if (!map[key]) {
          map[key] = { id: key, name: rec.categoryName, total: 0, count: 0, color: rec.categoryColor };
        }
        map[key].total += rec.amount;
        map[key].count += 1;
      }
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [incomeCategories, incomeRecords]);

  const topStream = categoryTotals.length > 0 && categoryTotals[0].total > 0
    ? {
        name: categoryTotals[0].name,
        total: categoryTotals[0].total,
        pct: totalInflow > 0 ? (categoryTotals[0].total / totalInflow) * 100 : 0,
      }
    : { name: 'None yet', total: 0, pct: 0 };

  const activeStreamCount = categoryTotals.filter(c => c.total > 0).length;

  // 4. Filtered records for the Detail Table
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.slice(0, 7);

    return incomeRecords.filter(r => {
      // Date filter
      if (dateFilterRange === '7days' && r.date < sevenDaysAgo) return false;
      if (dateFilterRange === '30days' && r.date < thirtyDaysAgo) return false;
      if (dateFilterRange === 'this_month' && !r.date.startsWith(currentMonthPrefix)) return false;
      if (dateFilterRange === 'custom') {
        if (customFromDate && r.date < customFromDate) return false;
        if (customToDate && r.date > customToDate) return false;
      }

      // Income Type filter
      if (filterIncomeType !== 'all') {
        if (r.incomeTypeId !== filterIncomeType) return false;
      }

      // Category filter
      if (filterCategory !== 'all') {
        if (r.categoryId !== filterCategory && r.categoryName !== filterCategory) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMemo = r.memo.toLowerCase().includes(q);
        const matchCounter = r.counterparty.toLowerCase().includes(q);
        const matchCat = r.categoryName.toLowerCase().includes(q);
        const matchAcc = r.accountName.toLowerCase().includes(q);
        const matchType = r.incomeTypeName.toLowerCase().includes(q);
        if (!matchMemo && !matchCounter && !matchCat && !matchAcc && !matchType) return false;
      }

      return true;
    });
  }, [incomeRecords, dateFilterRange, customFromDate, customToDate, filterIncomeType, filterCategory, searchQuery]);

  // Actions
  const handleDeleteRecord = (entryId: string) => {
    if (window.confirm('Are you sure you want to delete this income entry? Linked account balances will be restored.')) {
      const res = db.deleteJournalEntry(workspaceId, entryId);
      if (res.success) {
        refreshData();
      } else {
        alert(res.error || 'Failed to delete income entry.');
      }
    }
  };

  const handleEditRecord = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setShowTxModal(true);
  };

  // Add / Edit Income Head modal handlers
  const openAddHeadModal = () => {
    setEditingCategory(null);
    setHeadName('');
    setHeadIncomeType(incomeTypes[0]?.id || 'salary');
    setHeadColor('#10b981');
    setHeadIcon('briefcase');
    setShowHeadModal(true);
  };

  const openEditHeadModal = (cat: Category) => {
    setEditingCategory(cat);
    setHeadName(cat.name);
    setHeadIncomeType(cat.income_type || 'other');
    setHeadColor(cat.color || '#10b981');
    setHeadIcon(cat.icon || 'briefcase');
    setShowHeadModal(true);
  };

  const handleSaveHead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headName.trim()) return;

    if (editingCategory) {
      const updated: Category = {
        ...editingCategory,
        name: headName.trim(),
        income_type: headIncomeType,
        color: headColor,
        icon: headIcon,
      };
      db.saveCategory(updated);
    } else {
      const newCat: Category = {
        id: toUuid(`cat_income_${workspaceId}_${Date.now()}`),
        workspace_id: workspaceId,
        name: headName.trim(),
        type: 'income',
        income_type: headIncomeType,
        accounting_classification: 'income_operating',
        icon: headIcon,
        color: headColor,
        is_seed: false,
        is_archived: false,
        sort_order: incomeCategories.length + 1,
      };
      db.saveCategory(newCat);
    }

    refreshData();
    setShowHeadModal(false);
  };

  const handleDeleteHead = (catId: string) => {
    if (window.confirm('Are you sure you want to remove this income head?')) {
      db.deleteCategory(catId, workspaceId);
      refreshData();
      setShowHeadModal(false);
    }
  };

  // Manage Income Types modal handlers
  const openManageTypesModal = () => {
    setCustomTypes([...incomeTypes]);
    setNewTypeName('');
    setNewTypeDesc('');
    setNewTypeColor('#0284c7');
    setNewTypeIcon('laptop');
    setEditingTypeId(null);
    setShowManageTypesModal(true);
  };

  const handleSaveNewType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    if (editingTypeId) {
      const updated = customTypes.map(t => {
        if (t.id === editingTypeId) {
          return {
            ...t,
            name: newTypeName.trim(),
            description: newTypeDesc.trim() || undefined,
            color: newTypeColor,
            icon: newTypeIcon,
          };
        }
        return t;
      });
      setCustomTypes(updated);
      db.saveIncomeTypes(workspaceId, updated);
      setEditingTypeId(null);
    } else {
      const slug = newTypeName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `type_${Date.now()}`;
      const newType: IncomeTypeItem = {
        id: slug,
        name: newTypeName.trim(),
        description: newTypeDesc.trim() || undefined,
        color: newTypeColor,
        icon: newTypeIcon,
      };
      const updated = [...customTypes, newType];
      setCustomTypes(updated);
      db.saveIncomeTypes(workspaceId, updated);
    }

    setNewTypeName('');
    setNewTypeDesc('');
    refreshData();
  };

  const handleEditTypeInList = (t: IncomeTypeItem) => {
    setEditingTypeId(t.id);
    setNewTypeName(t.name);
    setNewTypeDesc(t.description || '');
    setNewTypeColor(t.color);
    setNewTypeIcon(t.icon);
  };

  const handleDeleteTypeInList = (typeId: string) => {
    if (customTypes.length <= 1) {
      alert('You must have at least one income type.');
      return;
    }
    if (window.confirm('Delete this income type? Existing heads with this type will fall back to other.')) {
      const updated = customTypes.filter(t => t.id !== typeId);
      setCustomTypes(updated);
      db.saveIncomeTypes(workspaceId, updated);
      refreshData();
    }
  };

  const renderTypeIcon = (iconName: string) => {
    switch (iconName) {
      case 'briefcase': return <Briefcase className="w-4 h-4" />;
      case 'laptop': return <Laptop className="w-4 h-4" />;
      case 'building': return <Building2 className="w-4 h-4" />;
      case 'globe': return <Globe className="w-4 h-4" />;
      case 'trending-up': return <TrendingUp className="w-4 h-4" />;
      case 'dollar-sign': return <DollarSign className="w-4 h-4" />;
      case 'wallet': return <Layers className="w-4 h-4" />;
      default: return <Tag className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Income Streams &amp; Revenue Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Categorized revenue streams by Type (Salary, Remote/Freelancing, Land Mortgage, Business, Investment).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openManageTypesModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all shrink-0"
            title="Configure and add custom income types"
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage Types</span>
          </button>

          {canWrite && (
            <button
              onClick={openAddHeadModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold transition-all shrink-0"
              title="Add a new income head linked to an income type"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Income Head</span>
            </button>
          )}

          {canWrite && (
            <button
              onClick={() => {
                setEditingEntry(null);
                setShowTxModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Record Income</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. TYPE-WISE REVENUE STREAMS SUMMARY CARDS               */}
      {/* ======================================================== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Income Streams Breakdown by Type
            </h3>
          </div>
          <span className="text-2xs font-mono font-medium text-slate-500">
            Total Inflow: <strong className="text-emerald-600 dark:text-emerald-400">{formatMoney(totalInflow)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {typeSummaries.map(item => {
            const isSelected = filterIncomeType === item.typeId;
            return (
              <div
                key={item.typeId}
                onClick={() => setFilterIncomeType(isSelected ? 'all' : item.typeId)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'ring-2 ring-emerald-500 bg-white dark:bg-slate-900 shadow-md border-emerald-500'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div 
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: item.color }}
                  >
                    {renderTypeIcon(item.icon)}
                  </div>
                  <span className="text-2xs font-mono font-bold text-slate-500 dark:text-slate-400">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>

                <div className="font-semibold text-xs text-slate-900 dark:text-white truncate" title={item.typeName}>
                  {item.typeName}
                </div>

                <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                  {formatMoney(item.total)}
                </div>

                <div className="mt-2 flex items-center justify-between text-3xs text-slate-400">
                  <span>{item.count} entry{item.count === 1 ? '' : 'ies'}</span>
                  {isSelected && <span className="text-emerald-600 font-bold">Filtered</span>}
                </div>

                {/* Micro Progress Bar */}
                <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-800 mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.max(item.percentage, item.total > 0 ? 5 : 0)}%`, 
                      backgroundColor: item.color 
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. KPI OVERVIEW ROW                                      */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Total Revenue Inflow
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatMoney(totalInflow)}
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>{incomeRecords.length} recorded income transaction{incomeRecords.length === 1 ? '' : 's'}</span>
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Dominant Revenue Driver
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-white truncate">
            {topStream.name}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-2xs">
            <span className="text-slate-500">Contribution Share</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
              {topStream.pct > 0 ? `${topStream.pct.toFixed(1)}%` : '0.0%'}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Active Income Heads
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {activeStreamCount} Active
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5">
            {incomeCategories.length} configured head{incomeCategories.length === 1 ? '' : 's'} across {incomeTypes.length} types
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Average Per Inflow
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatMoney(incomeRecords.length > 0 ? totalInflow / incomeRecords.length : 0)}
          </div>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5">
            Per transaction ticket average
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. DETAIL TABLE / ROWS OF INCOME TRANSACTIONS            */}
      {/* ======================================================== */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <span>Detailed Income Transactions Log</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chronological log of income transactions with income type tagging, full editing, and rollback support.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {filterIncomeType !== 'all' && (
              <button
                onClick={() => setFilterIncomeType('all')}
                className="text-2xs font-medium px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1"
              >
                <span>Clear Type Filter</span>
                <X className="w-3 h-3" />
              </button>
            )}
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {filteredRecords.length} Transaction{filteredRecords.length === 1 ? '' : 's'} Shown
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Preset Date Range Buttons */}
          <div>
            <label className="block text-2xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Time Period
            </label>
            <select
              value={dateFilterRange}
              onChange={(e) => setDateFilterRange(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Dates</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* Income Type Filter */}
          <div>
            <label className="block text-2xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Filter By Income Type
            </label>
            <select
              value={filterIncomeType}
              onChange={(e) => setFilterIncomeType(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Income Types</option>
              {incomeTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-2xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Income Head / Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Income Heads</option>
              {incomeCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-2xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Search Memo / Client / Account
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter by description or sender..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Custom Date Inputs if 'custom' selected */}
        {dateFilterRange === 'custom' && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 mb-1">From Date</label>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-300 mb-1">To Date</label>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Detail Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-2xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Description / Memo</th>
                <th className="py-2.5 px-3">Income Head</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Deposited Into</th>
                <th className="py-2.5 px-3">Source / Flag</th>
                <th className="py-2.5 px-3 text-right">Inflow Amount</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No income transactions match your current filters. Click &ldquo;Record Income&rdquo; above to record a payment.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.entryId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {rec.date}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 dark:text-white">{rec.memo}</div>
                      {rec.counterparty && (
                        <span className="text-2xs text-slate-400 block mt-0.5">
                          From: {rec.counterparty}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span 
                        className="px-2 py-0.5 rounded-full text-2xs font-semibold text-white inline-block shadow-2xs"
                        style={{ backgroundColor: rec.categoryColor }}
                      >
                        {rec.categoryName}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span 
                        className="px-2 py-0.5 rounded-md text-3xs font-semibold text-white inline-flex items-center gap-1 shadow-2xs"
                        style={{ backgroundColor: rec.incomeTypeColor }}
                      >
                        {rec.incomeTypeName}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {rec.accountName}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {rec.isHistorical ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-3xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                          <History className="w-3 h-3 text-amber-600" />
                          <span>Previous DB</span>
                        </span>
                      ) : (
                        <span className="text-2xs text-slate-400 font-mono">Current Live</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap text-sm">
                      +{formatMoney(rec.amount)}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditRecord(rec.rawEntry)}
                          title="Edit Income Transaction"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(rec.entryId)}
                          title="Delete Income Transaction"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
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

      {/* ======================================================== */}
      {/* 4. REVENUE STREAM DISTRIBUTION & ACTIVE HEADS LIST       */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Distribution of Revenue per Head */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-emerald-500" />
                  <span>Revenue Stream Distribution</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aggregated volume and share per income head from your active ledger.
                </p>
              </div>
              <span className="text-2xs font-mono font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Live DB
              </span>
            </div>

            {categoryTotals.filter(c => c.total > 0).length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-xs font-medium">No revenue streams active yet.</p>
                <span className="text-2xs text-slate-500">Record an income transaction above to see breakdown bars.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {categoryTotals.filter(c => c.total > 0).map(stream => {
                  const pct = totalInflow > 0 ? (stream.total / totalInflow) * 100 : 0;
                  const catObj = incomeCategories.find(c => c.id === stream.id);
                  const typeObj = stream.incomeType ? incomeTypeMap.get(stream.incomeType) : undefined;
                  return (
                    <div 
                      key={stream.name}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full shrink-0" 
                            style={{ backgroundColor: stream.color }}
                          />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {stream.name}
                          </span>
                          {typeObj && (
                            <span 
                              className="px-1.5 py-0.2 rounded text-3xs font-medium text-white"
                              style={{ backgroundColor: typeObj.color }}
                            >
                              {typeObj.name}
                            </span>
                          )}
                          <span className="text-2xs text-slate-400">
                            ({stream.count} tx)
                          </span>
                          {catObj && (
                            <button
                              onClick={() => openEditHeadModal(catObj)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-opacity p-0.5"
                              title="Edit Head & Type"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                            {formatMoney(stream.total)}
                          </span>
                          <span className="text-2xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 ml-2">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: stream.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Dynamic "How Should I Improve?" Strategy Section */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Lightbulb className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                How Should I Improve?
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Real-time strategic observations computed dynamically from your actual earnings data.
            </p>

            <div className="space-y-3.5">
              {totalInflow === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    No Earnings Data Recorded Yet
                  </p>
                  <span>
                    Once you record your first income transaction (Salary, Remote/Freelance contract, Land mortgage profit, etc.), dynamic diversification telemetry will be calculated here.
                  </span>
                </div>
              ) : (
                <>
                  {/* Dynamic Insight 1: Concentration Risk */}
                  {topStream.pct > 50 ? (
                    <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>High Concentration Risk ({topStream.name})</span>
                      </div>
                      <p className="text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong>{topStream.name}</strong> accounts for <strong>{topStream.pct.toFixed(1)}%</strong> of your total recorded inflow ({formatMoney(topStream.total)}). To protect family cashflow against single-source volatility, prioritize developing secondary income streams (such as remote freelancing or land yields) to contribute at least 20–30% of total revenue.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Balanced Concentration Health</span>
                      </div>
                      <p className="text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        No single stream dominates over 50% of your earnings. Your top driver (<strong>{topStream.name}</strong>) represents <strong>{topStream.pct.toFixed(1)}%</strong>, reflecting sound diversification.
                      </p>
                    </div>
                  )}

                  {/* Dynamic Insight 2: Channel Count */}
                  <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
                      <DollarSign className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Earnings Channels ({activeStreamCount} Active)</span>
                    </div>
                    <p className="text-2xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      You currently receive funds across {activeStreamCount} separate category channel{activeStreamCount === 1 ? '' : 's'}. Review whether passive channels (dividends, rental or land mortgage yield) can be scaled further.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. ADD / EDIT INCOME HEAD MODAL                         */}
      {/* ======================================================== */}
      {showHeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingCategory ? 'Edit Income Head' : 'Add New Income Head'}
              </h3>
              <button
                onClick={() => setShowHeadModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHead} className="space-y-4 pt-4">
              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Income Head Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly BAF Salary, Upwork Remote, Land Lease"
                  value={headName}
                  onChange={(e) => setHeadName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Income Type *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHeadModal(false);
                      openManageTypesModal();
                    }}
                    className="text-2xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>+ Manage / New Type</span>
                  </button>
                </div>
                <select
                  value={headIncomeType}
                  onChange={(e) => setHeadIncomeType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {incomeTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-3xs text-slate-400 mt-1">
                  Associates this head with its macro stream (Salary, Remote/Freelance, Land Mortgage, etc.)
                </p>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Badge Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setHeadColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${headColor === c ? 'scale-125 ring-2 ring-slate-400' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Icon
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_ICONS.map(ic => (
                    <button
                      key={ic.id}
                      type="button"
                      onClick={() => setHeadIcon(ic.id)}
                      className={`p-2 rounded-xl border text-center flex flex-col items-center gap-1 text-2xs transition-colors ${
                        headIcon === ic.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {renderTypeIcon(ic.id)}
                      <span className="truncate max-w-full text-3xs">{ic.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                {editingCategory ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteHead(editingCategory.id)}
                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Delete Head
                  </button>
                ) : <span />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHeadModal(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    {editingCategory ? 'Update Head' : 'Create Income Head'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. MANAGE INCOME TYPES MODAL                             */}
      {/* ======================================================== */}
      {showManageTypesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-emerald-500" />
                  <span>Manage Income Types</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add, edit, or customize macro revenue streams (Salary, Remote/Freelancing, Land Mortgage, etc.)
                </p>
              </div>
              <button
                onClick={() => setShowManageTypesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of Existing Types */}
            <div className="space-y-2 my-4">
              <label className="block text-2xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Current Income Types ({customTypes.length})
              </label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {customTypes.map(t => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: t.color }}
                      >
                        {renderTypeIcon(t.icon)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                          {t.name}
                        </div>
                        {t.description && (
                          <div className="text-3xs text-slate-400 truncate">
                            {t.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditTypeInList(t)}
                        className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Edit Type"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTypeInList(t.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        title="Delete Type"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add or Edit Form */}
            <form onSubmit={handleSaveNewType} className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {editingTypeId ? 'Edit Selected Type' : '+ Add New Income Type'}
                </span>
                {editingTypeId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTypeId(null);
                      setNewTypeName('');
                      setNewTypeDesc('');
                    }}
                    className="text-2xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Type Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Remote / Freelancing, Land Mortgage, Salary"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Description / Subtext (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Contract revenue, monthly yields, rent"
                  value={newTypeDesc}
                  onChange={(e) => setNewTypeDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-3xs font-semibold text-slate-500 mb-1">
                  Theme Color
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTypeColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform ${newTypeColor === c ? 'scale-125 ring-2 ring-slate-400' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  {editingTypeId ? 'Save Type Changes' : 'Save New Type'}
                </button>
              </div>
            </form>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowManageTypesModal(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Transaction Modal for Add & Edit with Balanced Double-Entry */}
      <NewTransactionModal
        isOpen={showTxModal}
        defaultMode="income"
        entryToEdit={editingEntry}
        onClose={() => {
          setShowTxModal(false);
          setEditingEntry(null);
        }}
        onSuccess={refreshData}
      />
    </div>
  );
};
