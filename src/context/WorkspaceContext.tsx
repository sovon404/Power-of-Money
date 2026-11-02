import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Workspace, WorkspaceRole, AuthUser } from '../types';
import { db } from '../services/db';

interface WorkspaceContextType {
  currentUser: AuthUser;
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  userRole: WorkspaceRole;
  canWrite: boolean;
  isSyncingWithDb: boolean;
  lastDbSyncTime: string | null;
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

  const refreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const syncFromDatabase = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsSyncingWithDb(true);
    try {
      const { supabaseSync } = await import('../services/supabaseSync');
      const remote = await supabaseSync.pullRemoteWorkspaceData(currentWorkspace.id);
      if (remote) {
        db.hydrateFromSupabase(remote, currentWorkspace.id);
      }
      setLastDbSyncTime(new Date().toLocaleTimeString());
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.warn('Sync from database notice:', err);
    } finally {
      setIsSyncingWithDb(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    let isMounted = true;

    const setupSingleUserVault = async () => {
      setIsSyncingWithDb(true);
      try {
        const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
        const { supabaseSync } = await import('../services/supabaseSync');

        // 1. Sync Profile
        await supabaseSync.syncProfile(authUser.id, authUser.email || '', authUser.name || '');

        // 2. Initialize Single Vault
        const { workspace } = db.initializeUserWorkspace(authUser.id, authUser.name, authUser.email);
        await supabaseSync.syncWorkspace(workspace, authUser.id);

        if (!isMounted) return;

        // Ensure defaults only on first initialization
        db.ensureDefaultAccountsForWorkspace(workspace.id);
        db.ensureCategoriesForWorkspace(workspace.id);
        setCurrentWorkspace(workspace);

        // 3. Hydrate pure remote data from Supabase DB
        if (isSupabaseConfigured()) {
          const remote = await supabaseSync.pullRemoteWorkspaceData(workspace.id);
          if (remote && isMounted) {
            db.hydrateFromSupabase(remote, workspace.id);
            setLastDbSyncTime(new Date().toLocaleTimeString());
            setRefreshKey(prev => prev + 1);
          }
        }
      } catch (err) {
        console.warn('Single user vault discovery notice:', err);
      } finally {
        if (isMounted) setIsSyncingWithDb(false);
      }
    };

    setupSingleUserVault();

    return () => {
      isMounted = false;
    };
  }, [authUser.id, authUser.name, authUser.email]);

  const completeInitialSetup = () => {
    refreshData();
  };

  const updateWorkspaceSettings = useCallback((newSettings: Partial<NonNullable<Workspace['settings']>>) => {
    if (!currentWorkspace) return;
    const updatedWs: Workspace = {
      ...currentWorkspace,
      settings: {
        ...(currentWorkspace.settings || {}),
        ...newSettings,
      },
    };
    db.saveWorkspace(updatedWs);
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
        syncFromDatabase,
        refreshData,
        formatMoney,
        isInitialSetupDone: true,
        completeInitialSetup,
        updateWorkspaceSettings,
      }}
    >
      {children}
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
