import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Workspace, WorkspaceRole } from '../types';
import { db } from '../services/db';

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  userRole: WorkspaceRole;
  canWrite: boolean;
  switchWorkspace: (workspaceId: string) => void;
  createFamilyWorkspace: (name: string, description?: string) => Workspace;
  refreshData: () => void;
  formatMoney: (amount: number, currencyOverride?: string) => string;
  isInitialSetupDone: boolean;
  completeInitialSetup: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [userRole, setUserRole] = useState<WorkspaceRole>('owner');
  const [refreshKey, setRefreshKey] = useState(0);

  // Initial setup check
  const [isInitialSetupDone, setIsInitialSetupDone] = useState<boolean>(() => {
    return localStorage.getItem('pom_setup_completed') === 'true';
  });

  const refreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    const { workspace } = db.initializeDefaultWorkspace();
    const all = db.getWorkspaces();
    setWorkspaces(all);
    
    // Default to first workspace or active one
    const savedActiveId = localStorage.getItem('pom_active_workspace_id');
    const active = all.find(w => w.id === savedActiveId) || workspace;
    db.ensureUserCockpitAccounts(active.id);
    setCurrentWorkspace(active);
    localStorage.setItem('pom_active_workspace_id', active.id);
  }, [refreshKey]);

  const switchWorkspace = (workspaceId: string) => {
    const found = workspaces.find(w => w.id === workspaceId);
    if (found) {
      setCurrentWorkspace(found);
      localStorage.setItem('pom_active_workspace_id', found.id);
      // For personal workspace default role is owner; for family workspace can be configured
      setUserRole('owner');
      refreshData();
    }
  };

  const createFamilyWorkspace = (name: string, description?: string): Workspace => {
    const newWs: Workspace = {
      id: 'ws_family_' + Date.now(),
      name,
      type: 'family',
      created_by: 'user_owner',
      currency: currentWorkspace?.currency || 'BDT',
      description: description || 'Family financial collaboration workspace',
      created_at: new Date().toISOString(),
    };
    db.saveWorkspace(newWs);
    db.seedCategoriesForWorkspace(newWs.id);
    db.seedDefaultAccounts(newWs.id);
    
    setWorkspaces(db.getWorkspaces());
    switchWorkspace(newWs.id);
    return newWs;
  };

  const completeInitialSetup = () => {
    localStorage.setItem('pom_setup_completed', 'true');
    setIsInitialSetupDone(true);
    refreshData();
  };

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
        currentWorkspace,
        workspaces,
        userRole,
        canWrite,
        switchWorkspace,
        createFamilyWorkspace,
        refreshData,
        formatMoney,
        isInitialSetupDone,
        completeInitialSetup,
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
