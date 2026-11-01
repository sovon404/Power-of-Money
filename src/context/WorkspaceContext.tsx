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
  switchWorkspace: (workspaceId: string) => void;
  createFamilyWorkspace: (name: string, description?: string) => Workspace;
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [userRole, setUserRole] = useState<WorkspaceRole>('owner');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSyncingWithDb, setIsSyncingWithDb] = useState(false);
  const [lastDbSyncTime, setLastDbSyncTime] = useState<string | null>(null);

  // Initial setup check scoped to user
  const setupKey = `pom_setup_completed_${authUser.id}`;
  const [isInitialSetupDone, setIsInitialSetupDone] = useState<boolean>(() => {
    return localStorage.getItem(setupKey) === 'true';
  });

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

    const setupUserWorkspace = async () => {
      setIsSyncingWithDb(true);
      try {
        const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
        const { supabaseSync } = await import('../services/supabaseSync');

        // 1. Sync profile first
        await supabaseSync.syncProfile(authUser.id, authUser.email || '', authUser.name || '');

        let userWorkspaces: Workspace[] = [];

        // 2. Discover existing workspaces in Supabase
        if (isSupabaseConfigured()) {
          const { data: remoteWsList } = await supabase
            .from('workspaces')
            .select('*');

          if (remoteWsList && remoteWsList.length > 0) {
            userWorkspaces = remoteWsList.map(rw => ({
              id: rw.id,
              name: rw.name,
              type: rw.type,
              created_by: rw.created_by,
              currency: rw.currency || 'BDT',
              description: rw.description,
              settings: rw.settings,
              created_at: rw.created_at,
            }));
            userWorkspaces.forEach(w => db.saveWorkspace(w));
          }
        }

        // 3. If no remote workspaces found, initialize user vault and write to Supabase
        if (userWorkspaces.length === 0) {
          const { workspace } = db.initializeUserWorkspace(authUser.id, authUser.name, authUser.email);
          await supabaseSync.syncWorkspace(workspace, authUser.id);
          userWorkspaces = [workspace];
        }

        const userActiveWsKey = `pom_active_workspace_${authUser.id}`;
        const savedActiveId = localStorage.getItem(userActiveWsKey);
        const active = userWorkspaces.find(w => w.id === savedActiveId) || userWorkspaces[0];

        if (!isMounted) return;

        db.ensureDefaultAccountsForWorkspace(active.id);
        setWorkspaces(userWorkspaces);
        setCurrentWorkspace(active);
        localStorage.setItem(userActiveWsKey, active.id);
        setIsInitialSetupDone(localStorage.getItem(setupKey) === 'true');

        // 4. Hydrate all accounts, cards, loans, properties, journal entries from Supabase
        const remote = await supabaseSync.pullRemoteWorkspaceData(active.id);
        if (remote && isMounted) {
          db.hydrateFromSupabase(remote, active.id);
          setLastDbSyncTime(new Date().toLocaleTimeString());
          setRefreshKey(prev => prev + 1);
        }
      } catch (err) {
        console.warn('Workspace discovery notice:', err);
      } finally {
        if (isMounted) setIsSyncingWithDb(false);
      }
    };

    setupUserWorkspace();

    return () => {
      isMounted = false;
    };
  }, [authUser.id, authUser.name, authUser.email, setupKey]);

  const switchWorkspace = (workspaceId: string) => {
    const found = workspaces.find(w => w.id === workspaceId);
    if (found) {
      setCurrentWorkspace(found);
      localStorage.setItem(`pom_active_workspace_${authUser.id}`, found.id);
      setUserRole(found.created_by === authUser.id ? 'owner' : 'editor');
      refreshData();
    }
  };

  const createFamilyWorkspace = (name: string, description?: string): Workspace => {
    const newWs: Workspace = {
      id: `ws_family_${authUser.id}_${Date.now()}`,
      name,
      type: 'family',
      created_by: authUser.id,
      currency: currentWorkspace?.currency || 'BDT',
      description: description || 'Family financial collaboration workspace',
      created_at: new Date().toISOString(),
    };
    db.saveWorkspace(newWs);
    db.seedCategoriesForWorkspace(newWs.id);
    db.ensureDefaultAccountsForWorkspace(newWs.id);
    
    const updated = db.getWorkspaces(authUser.id);
    setWorkspaces(updated);
    switchWorkspace(newWs.id);
    return newWs;
  };

  const completeInitialSetup = () => {
    localStorage.setItem(setupKey, 'true');
    setIsInitialSetupDone(true);
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
    setWorkspaces(prev => prev.map(w => w.id === updatedWs.id ? updatedWs : w));
    refreshData();
  }, [currentWorkspace, refreshData]);

  const canWrite = userRole === 'owner' || userRole === 'admin' || userRole === 'editor';

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
        workspaces,
        userRole,
        canWrite,
        isSyncingWithDb,
        lastDbSyncTime,
        syncFromDatabase,
        switchWorkspace,
        createFamilyWorkspace,
        refreshData,
        formatMoney,
        isInitialSetupDone,
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
