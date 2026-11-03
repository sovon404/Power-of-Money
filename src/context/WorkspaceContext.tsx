import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Workspace, WorkspaceRole, AuthUser } from '../types';
import { db } from '../services/db';
import { supabaseSync } from '../services/supabaseSync';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toUuid } from '../lib/uuid';

interface WorkspaceContextType {
  currentUser: AuthUser;
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  userRole: WorkspaceRole;
  canWrite: boolean;
  isSyncingWithDb: boolean;
  lastDbSyncTime: string | null;
  realtimeStatus: 'connected' | 'connecting' | 'disconnected';
  syncFromDatabase: () => Promise<void>;
  refreshData: () => void;
  formatMoney: (amount: number, currencyOverride?: string) => string;
  isInitialSetupDone: boolean;
  completeInitialSetup: () => void;
  updateWorkspaceSettings: (settings: Partial<NonNullable<Workspace['settings']>>) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: React.ReactNode;
  authUser: AuthUser;
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children, authUser }) => {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(() => {
    const { workspace } = db.initializeUserWorkspace(authUser.id, authUser.name, authUser.email);
    return workspace;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSyncingWithDb, setIsSyncingWithDb] = useState(false);
  const [lastDbSyncTime, setLastDbSyncTime] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  const channelRef = useRef<any>(null);

  const refreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Listen to in-memory db notifications
  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      refreshData();
    });
    return unsubscribe;
  }, [refreshData]);

  // Authoritative data fetch from Supabase
  const syncFromDatabase = useCallback(async () => {
    if (!currentWorkspace || !isSupabaseConfigured()) return;
    setIsSyncingWithDb(true);
    try {
      const remote = await supabaseSync.pullRemoteWorkspaceData(currentWorkspace.id);
      if (remote) {
        db.hydrateFromRemote(remote, currentWorkspace.id);
        setLastDbSyncTime(new Date().toLocaleTimeString());
        refreshData();
      }
    } catch (err: any) {
      console.warn('Sync from database notice:', err.message);
    } finally {
      setIsSyncingWithDb(false);
    }
  }, [currentWorkspace, refreshData]);

  // Initial Vault Setup & First Load from Supabase
  useEffect(() => {
    let isMounted = true;

    const setupSingleUserVault = async () => {
      setIsSyncingWithDb(true);
      try {
        await supabaseSync.syncProfile(authUser.id, authUser.email || '', authUser.name || '');

        const { workspace } = db.initializeUserWorkspace(authUser.id, authUser.name, authUser.email);
        await supabaseSync.syncWorkspace(workspace, authUser.id);

        if (!isMounted) return;
        setCurrentWorkspace(workspace);

        if (isSupabaseConfigured()) {
          const remote = await supabaseSync.pullRemoteWorkspaceData(workspace.id);
          if (remote && isMounted) {
            db.hydrateFromRemote(remote, workspace.id);
            setLastDbSyncTime(new Date().toLocaleTimeString());
            refreshData();

            const hasRemoteData = (remote.accounts && remote.accounts.length > 0) || (remote.categories && remote.categories.length > 0);
            if (!hasRemoteData) {
              await db.seedInitialWorkspaceDefaults(workspace.id);
              // Re-pull to confirm seeded data in DB
              const refetched = await supabaseSync.pullRemoteWorkspaceData(workspace.id);
              if (refetched && isMounted) {
                db.hydrateFromRemote(refetched, workspace.id);
                refreshData();
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('Single user vault discovery notice:', err.message);
      } finally {
        if (isMounted) setIsSyncingWithDb(false);
      }
    };

    setupSingleUserVault();

    return () => {
      isMounted = false;
    };
  }, [authUser.id, authUser.name, authUser.email, refreshData]);

  // ==========================================
  // Realtime Cross-Device Synchronization
  // ==========================================
  useEffect(() => {
    if (!currentWorkspace || !isSupabaseConfigured()) return;

    const wsUuid = toUuid(currentWorkspace.id);
    const channelName = `pom_realtime_ws_${wsUuid}`;

    // Clean up previous channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setRealtimeStatus('connecting');

    const handleRealtimeChange = async (payload: any) => {
      console.log(`[Realtime Sync] ${payload.table} change detected:`, payload.eventType);
      // Pull fresh authoritative state from Supabase to guarantee multi-device accuracy
      try {
        const remote = await supabaseSync.pullRemoteWorkspaceData(currentWorkspace.id);
        if (remote) {
          db.hydrateFromRemote(remote, currentWorkspace.id);
          setLastDbSyncTime(new Date().toLocaleTimeString());
          refreshData();
        }
      } catch (e: any) {
        console.warn('[Realtime Sync] Refresh failed:', e.message);
      }
    };

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'financial_accounts', filter: `workspace_id=eq.${wsUuid}` },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'journal_entries', filter: `workspace_id=eq.${wsUuid}` },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'journal_lines', filter: `workspace_id=eq.${wsUuid}` },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `workspace_id=eq.${wsUuid}` },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credit_cards', filter: `workspace_id=eq.${wsUuid}` },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loans', filter: `workspace_id=eq.${wsUuid}` },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties', filter: `workspace_id=eq.${wsUuid}` },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budgets', filter: `workspace_id=eq.${wsUuid}` },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_goals', filter: `workspace_id=eq.${wsUuid}` },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recurring_rules', filter: `workspace_id=eq.${wsUuid}` },
        handleRealtimeChange
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        }
      });

    channelRef.current = channel;

    // Window Visibility / Focus Recovery
    // When device wakes up or user tabs back, re-fetch to catch any missed updates
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncFromDatabase();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentWorkspace, syncFromDatabase, refreshData]);

  const completeInitialSetup = () => {
    refreshData();
  };

  const updateWorkspaceSettings = useCallback(async (newSettings: Partial<NonNullable<Workspace['settings']>>) => {
    if (!currentWorkspace) return;
    const updatedWs: Workspace = {
      ...currentWorkspace,
      settings: {
        ...(currentWorkspace.settings || {}),
        ...newSettings,
      },
    };
    await db.saveWorkspace(updatedWs);
    setCurrentWorkspace(updatedWs);
    refreshData();
  }, [currentWorkspace, refreshData]);

  const formatMoney = (amount: number, currencyOverride?: string): string => {
    const curr = currencyOverride || currentWorkspace?.currency || 'BDT';
    const isNegative = amount < 0;
    const absVal = Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    
    const symbol = curr === 'BDT' ? '৳' : curr === 'USD' ? '$' : curr;
    return `${isNegative ? '-' : ''}${symbol} ${absVal}`;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentUser: authUser,
        currentWorkspace,
        workspaces: currentWorkspace ? [currentWorkspace] : [],
        userRole: 'owner',
        canWrite: true,
        isSyncingWithDb,
        lastDbSyncTime,
        realtimeStatus,
        syncFromDatabase,
        refreshData,
        formatMoney,
        isInitialSetupDone: true,
        completeInitialSetup,
        updateWorkspaceSettings,
      }}
    >
      <div key={refreshKey} className="contents">
        {children}
      </div>
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
