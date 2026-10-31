import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Check, 
  X, 
  Trash2, 
  Mail, 
  ShieldAlert, 
  Lock 
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { WorkspaceMember, WorkspaceRole } from '../../types';

export const FamilyWorkspaceView: React.FC = () => {
  const { currentWorkspace, canWrite } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';
  const isFamilyWs = currentWorkspace?.type === 'family';

  // Demo active members for current workspace
  const [members, setMembers] = useState<WorkspaceMember[]>([
    {
      id: 'mem_1',
      workspace_id: workspaceId,
      user_id: 'user_owner',
      role: 'owner',
      user_email: 'sovon@example.com',
      user_name: 'Sovon (Workspace Owner)',
      permissions: {
        can_view_accounts: true,
        can_manage_accounts: true,
        can_view_ledger: true,
        can_post_transactions: true,
        can_view_cards: true,
        can_manage_cards: true,
        can_view_loans: true,
        can_manage_loans: true,
        can_view_properties: true,
        can_manage_properties: true,
        can_view_budgets: true,
        can_manage_budgets: true,
        can_manage_members: true,
      },
      status: 'active',
      joined_at: '2026-10-01',
    },
    {
      id: 'mem_2',
      workspace_id: workspaceId,
      user_id: 'user_family_1',
      role: 'editor',
      user_email: 'spouse@example.com',
      user_name: 'Family Member (Spouse)',
      permissions: {
        can_view_accounts: true,
        can_manage_accounts: false,
        can_view_ledger: true,
        can_post_transactions: true,
        can_view_cards: true,
        can_manage_cards: false,
        can_view_loans: true,
        can_manage_loans: false,
        can_view_properties: true,
        can_manage_properties: true,
        can_view_budgets: true,
        can_manage_budgets: true,
        can_manage_members: false,
      },
      status: 'active',
      joined_at: '2026-10-12',
    },
  ]);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const newMem: WorkspaceMember = {
      id: 'mem_' + Date.now(),
      workspace_id: workspaceId,
      user_id: 'user_' + Date.now(),
      role: inviteRole,
      user_email: inviteEmail.trim(),
      user_name: inviteEmail.split('@')[0],
      permissions: {
        can_view_accounts: true,
        can_manage_accounts: inviteRole === 'admin',
        can_view_ledger: true,
        can_post_transactions: inviteRole !== 'viewer',
        can_view_cards: true,
        can_manage_cards: false,
        can_view_loans: true,
        can_manage_loans: false,
        can_view_properties: true,
        can_manage_properties: inviteRole === 'admin',
        can_view_budgets: true,
        can_manage_budgets: inviteRole !== 'viewer',
        can_manage_members: inviteRole === 'admin',
      },
      status: 'active',
      joined_at: new Date().toISOString().split('T')[0],
    };

    setMembers([...members, newMem]);
    setInviteSuccessMsg(`Invitation dispatched to ${inviteEmail}. Member added with role: ${inviteRole}.`);
    setInviteEmail('');
    setTimeout(() => {
      setInviteSuccessMsg(null);
      setShowInviteModal(false);
    }, 2000);
  };

  const handleRevoke = (memId: string) => {
    setMembers(members.filter(m => m.id !== memId));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Family Finance &amp; Member Collaboration</span>
            {!isFamilyWs && (
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Current: Personal Workspace
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Collaborate on family properties, shared accounts, and household budgets with granular permissions.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* Isolation Guarantee Callout */}
      <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <strong className="block font-semibold mb-0.5">Strict Personal Workspace Isolation</strong>
          <span className="text-blue-700 dark:text-blue-300 text-2xs block">
            Family members added to this shared workspace will NEVER gain access to your private personal workspace. Personal and family data models are strictly partitioned at the database RLS level.
          </span>
        </div>
      </div>

      {/* Members List */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Workspace Members ({members.length})
          </h3>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {members.map(member => (
            <div
              key={member.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-200">
                  {member.user_name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {member.user_name}
                    </span>
                    <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                      member.role === 'owner'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : member.role === 'admin'
                        ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                        : member.role === 'editor'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {member.role}
                    </span>
                  </div>
                  <span className="text-2xs text-slate-400 font-mono">
                    {member.user_email} · Joined {member.joined_at}
                  </span>
                </div>
              </div>

              {/* Module Permissions & Revoke */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2 text-2xs text-slate-500">
                  <span title="Ledger Posting Access" className={member.permissions.can_post_transactions ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                    Ledger: {member.permissions.can_post_transactions ? 'Write' : 'Read'}
                  </span>
                  <span>·</span>
                  <span title="Property Management" className={member.permissions.can_manage_properties ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                    Properties: {member.permissions.can_manage_properties ? 'Manage' : 'View'}
                  </span>
                </div>

                {member.role !== 'owner' && canWrite && (
                  <button
                    onClick={() => handleRevoke(member.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Revoke Membership"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Invite Member to Workspace
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteSuccessMsg && (
              <div className="p-3 mb-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{inviteSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Member Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. family.member@gmail.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e: any) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="editor">Editor (Can record entries and manage properties)</option>
                  <option value="viewer">Viewer (Read-only access, cannot modify records)</option>
                  <option value="admin">Administrator (Full module control)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
