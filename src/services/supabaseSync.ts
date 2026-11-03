import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toUuid } from '../lib/uuid';
import { 
  Workspace, 
  FinancialAccount, 
  JournalEntry, 
  Category, 
  CreditCard, 
  Loan, 
  Property, 
  Budget, 
  SavingsGoal, 
  RecurringRule 
} from '../types';

export interface DeleteResult {
  success: boolean;
  action?: 'deleted' | 'archived';
  affectedCount?: number;
  message?: string;
  error?: string;
}

class SupabaseSyncEngine {
  public isAvailable(): boolean {
    return isSupabaseConfigured();
  }

  // 1. Sync User Profile
  async syncProfile(userId: string, email: string, fullName: string): Promise<void> {
    if (!this.isAvailable() || !userId) return;
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: email || '',
        full_name: fullName || '',
        default_currency: 'BDT',
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.warn('Sync profile warning:', error.message);
      }
    } catch (err: any) {
      console.warn('Sync profile network notice:', err.message);
    }
  }

  // Helper: Ensures the workspace exists in Supabase to prevent 23503 foreign key violation
  async ensureRemoteWorkspace(workspaceId: string, userId?: string): Promise<void> {
    if (!this.isAvailable() || !workspaceId) return;
    const wsUuid = toUuid(workspaceId);
    try {
      const { data: existing } = await supabase
        .from('workspaces')
        .select('id')
        .eq('id', wsUuid)
        .maybeSingle();

      if (!existing) {
        let ownerId = userId;
        if (!ownerId) {
          const authUser = (await supabase.auth.getUser()).data.user;
          ownerId = authUser?.id;
        }
        if (ownerId) {
          await supabase.from('workspaces').upsert({
            id: wsUuid,
            name: 'Personal Vault',
            type: 'personal',
            created_by: ownerId,
            currency: 'BDT',
            description: 'Personal financial vault',
            updated_at: new Date().toISOString(),
          });
          await supabase.from('workspace_members').upsert({
            id: toUuid(`member_${wsUuid}_${ownerId}`),
            workspace_id: wsUuid,
            user_id: ownerId,
            role: 'owner',
            status: 'active',
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (e: any) {
      console.warn('ensureRemoteWorkspace notice:', e.message);
    }
  }

  // Helper: Ensures an account exists in Supabase before foreign key references are inserted
  async ensureRemoteAccount(accountId: string, workspaceId: string, defaultName?: string, defaultType: string = 'bank'): Promise<void> {
    if (!this.isAvailable() || !accountId) return;
    const accUuid = toUuid(accountId);
    const wsUuid = toUuid(workspaceId);
    try {
      const { data: existing } = await supabase
        .from('financial_accounts')
        .select('id')
        .eq('id', accUuid)
        .maybeSingle();

      if (!existing) {
        const nameToUse = defaultName || 'Account';
        await supabase.from('financial_accounts').insert({
          id: accUuid,
          workspace_id: wsUuid,
          name: nameToUse,
          account_type_id: defaultType,
          provider: 'Bank / Wallet',
          currency: 'BDT',
          opening_balance: 0,
          opening_date: new Date().toISOString().split('T')[0],
          current_balance_cached: 0,
          is_archived: false,
          icon: defaultType === 'mfs' ? 'smartphone' : defaultType === 'credit_card' ? 'credit-card' : 'landmark',
          color: '#0284c7',
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('ensureRemoteAccount notice:', e.message);
    }
  }

  // Helper: Ensures a category exists in Supabase before foreign key references are inserted
  async ensureRemoteCategory(categoryId?: string, workspaceId?: string): Promise<void> {
    if (!this.isAvailable() || !categoryId || !workspaceId) return;
    const catUuid = toUuid(categoryId);
    const wsUuid = toUuid(workspaceId);
    try {
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('id', catUuid)
        .maybeSingle();

      if (!existing) {
        await supabase.from('categories').insert({
          id: catUuid,
          workspace_id: wsUuid,
          name: 'General Category',
          type: 'expense',
          accounting_classification: 'expense_operating',
          icon: 'tag',
          color: '#64748b',
          is_seed: false,
          is_archived: false,
          sort_order: 99,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('ensureRemoteCategory notice:', e.message);
    }
  }

  // 2. Sync Workspace
  async syncWorkspace(workspace: Workspace, userId: string): Promise<void> {
    if (!this.isAvailable() || !userId) return;
    const wsUuid = toUuid(workspace.id);

    try {
      const { error: wsError } = await supabase.from('workspaces').upsert({
        id: wsUuid,
        name: workspace.name,
        type: workspace.type,
        created_by: userId,
        currency: workspace.currency || 'BDT',
        description: workspace.description || '',
        settings: workspace.settings || {
          fiscal_year_start: '01-01',
          dateFormat: 'YYYY-MM-DD',
          enableAiReceipts: true,
        },
        updated_at: new Date().toISOString(),
      });

      if (wsError) throw wsError;

      await supabase.from('workspace_members').upsert({
        id: toUuid(`member_${wsUuid}_${userId}`),
        workspace_id: wsUuid,
        user_id: userId,
        role: 'owner',
        status: 'active',
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('Sync workspace error:', err.message);
      throw err;
    }
  }

  // 3. Sync Financial Account (Checks by ID first, upserts to Supabase)
  async syncAccount(account: FinancialAccount, workspaceId: string): Promise<FinancialAccount> {
    if (!this.isAvailable()) return account;
    const wsUuid = toUuid(workspaceId);
    const accUuid = toUuid(account.id);

    await this.ensureRemoteWorkspace(workspaceId);

    const accPayload: any = {
      id: accUuid,
      workspace_id: wsUuid,
      name: account.name.trim(),
      account_type_id: account.account_type_id,
      provider: account.provider || 'Other',
      account_number_masked: account.account_number_masked || null,
      currency: account.currency || 'BDT',
      opening_balance: account.opening_balance || 0,
      opening_date: account.opening_date || new Date().toISOString().split('T')[0],
      current_balance_cached: account.current_balance_cached || 0,
      is_archived: Boolean(account.is_archived),
      icon: account.icon || 'wallet',
      color: account.color || '#0284c7',
      notes: account.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('financial_accounts')
      .upsert(accPayload)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase financial_accounts upsert error:', error);
      throw error;
    }

    return (data as FinancialAccount) || account;
  }

  // 4. Sync Category
  async syncCategory(cat: Category, workspaceId: string): Promise<Category> {
    if (!this.isAvailable()) return cat;
    const wsUuid = toUuid(workspaceId);
    const catUuid = toUuid(cat.id);

    await this.ensureRemoteWorkspace(workspaceId);

    let safeTargetAccountId: string | undefined = undefined;
    if (cat.target_savings_account_id) {
      const targetUuid = toUuid(cat.target_savings_account_id);
      await this.ensureRemoteAccount(targetUuid, workspaceId);
      safeTargetAccountId = targetUuid;
    }

    let safeParentId: string | undefined = undefined;
    if (cat.parent_id) {
      const parentUuid = toUuid(cat.parent_id);
      await this.ensureRemoteCategory(parentUuid, workspaceId);
      safeParentId = parentUuid;
    }

    const isSaving = cat.type === 'saving' || cat.accounting_classification === 'asset_savings';
    const catPayload: any = {
      id: catUuid,
      workspace_id: wsUuid,
      name: cat.name.trim(),
      type: cat.type,
      accounting_classification: cat.accounting_classification || (isSaving ? 'asset_savings' : 'expense_operating'),
      icon: cat.icon || (isSaving ? 'piggy-bank' : 'tag'),
      color: cat.color || '#0284c7',
      is_seed: Boolean(cat.is_seed),
      is_archived: Boolean(cat.is_archived),
      sort_order: cat.sort_order || 1,
      target_savings_account_id: safeTargetAccountId || null,
      parent_id: safeParentId || null,
      income_type: cat.income_type || (cat.type === 'income' ? 'other' : null),
      description: cat.description || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('categories')
      .upsert(catPayload)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase categories upsert error:', error);
      throw error;
    }

    return (data as Category) || cat;
  }

  // 5. Sync Journal Entry with Lines
  async syncJournalEntry(entry: JournalEntry, workspaceId: string): Promise<void> {
    if (!this.isAvailable()) return;
    const wsUuid = toUuid(workspaceId);
    const entryUuid = toUuid(entry.id);

    await this.ensureRemoteWorkspace(workspaceId);

    // Pre-ensure all accounts and categories exist
    if (entry.lines && entry.lines.length > 0) {
      for (const line of entry.lines) {
        await this.ensureRemoteAccount(line.account_id, workspaceId);
        if (line.category_id) {
          await this.ensureRemoteCategory(line.category_id, workspaceId);
        }
      }
    }

    const entryPayload: any = {
      id: entryUuid,
      workspace_id: wsUuid,
      entry_date: entry.entry_date,
      period_end_date: entry.period_end_date || null,
      memo: entry.memo,
      source_type: entry.source_type,
      source_id: entry.source_id || null,
      status: entry.status || 'posted',
      is_reversal: Boolean(entry.is_reversal),
      is_historical: Boolean(entry.is_historical),
      historical_note: entry.historical_note || null,
      updated_at: new Date().toISOString(),
    };

    const { error: headerErr } = await supabase.from('journal_entries').upsert(entryPayload);
    if (headerErr) {
      // In case period_end_date column or historical_note is missing on older migrations, retry safely
      delete entryPayload.period_end_date;
      delete entryPayload.is_historical;
      delete entryPayload.historical_note;
      const { error: retryErr } = await supabase.from('journal_entries').upsert(entryPayload);
      if (retryErr) throw retryErr;
    }

    // Upsert lines
    if (entry.lines && entry.lines.length > 0) {
      // Clean existing lines first to handle edits
      await supabase.from('journal_lines').delete().eq('journal_entry_id', entryUuid);

      const linesPayload = entry.lines.map((l, i) => ({
        id: toUuid(l.id || `${entryUuid}_line_${i}`),
        journal_entry_id: entryUuid,
        workspace_id: wsUuid,
        account_id: toUuid(l.account_id),
        line_type: l.line_type,
        amount: l.amount,
        memo: l.memo || entry.memo,
        category_id: l.category_id ? toUuid(l.category_id) : null,
        counterparty: l.counterparty || null,
        tags: l.tags || [],
      }));

      const { error: linesErr } = await supabase.from('journal_lines').insert(linesPayload);
      if (linesErr) throw linesErr;
    }
  }

  // 6. Sync Credit Card
  async syncCreditCard(card: CreditCard, workspaceId: string): Promise<CreditCard> {
    if (!this.isAvailable()) return card;
    const wsUuid = toUuid(workspaceId);
    const accUuid = toUuid(card.account_id);
    const cardUuid = toUuid(card.id);

    await this.ensureRemoteWorkspace(workspaceId);
    await this.ensureRemoteAccount(
      card.account_id, 
      workspaceId, 
      `${card.card_name} (${card.last_four_digits})`, 
      'credit_card'
    );

    const { data, error } = await supabase.from('credit_cards').upsert({
      id: cardUuid,
      workspace_id: wsUuid,
      account_id: accUuid,
      card_name: card.card_name,
      issuing_bank: card.issuing_bank,
      card_network: card.card_network || 'Visa',
      last_four_digits: card.last_four_digits,
      credit_limit: card.credit_limit,
      statement_day: card.statement_day,
      payment_due_day: card.payment_due_day,
      interest_rate_apr: card.interest_rate_apr || 0,
      annual_fee: card.annual_fee || 0,
      status: card.status || 'active',
      notes: card.notes || null,
      updated_at: new Date().toISOString(),
    }).select('*').single();

    if (error) {
      console.error('Supabase credit_cards upsert error:', error);
      throw error;
    }

    return (data as CreditCard) || card;
  }

  // 7. Sync Loan
  async syncLoan(loan: Loan, workspaceId: string): Promise<Loan> {
    if (!this.isAvailable()) return loan;
    const wsUuid = toUuid(workspaceId);
    const loanUuid = toUuid(loan.id);

    await this.ensureRemoteWorkspace(workspaceId);
    if (loan.account_id) {
      await this.ensureRemoteAccount(loan.account_id, workspaceId);
    }

    const { data, error } = await supabase.from('loans').upsert({
      id: loanUuid,
      workspace_id: wsUuid,
      type: loan.type,
      account_id: loan.account_id ? toUuid(loan.account_id) : null,
      title: loan.title,
      counterparty_name: loan.counterparty_name,
      counterparty_phone: loan.counterparty_phone || null,
      counterparty_relationship: loan.counterparty_relationship || null,
      principal_amount: loan.principal_amount,
      interest_rate: loan.interest_rate || 0,
      is_interest_bearing: Boolean(loan.is_interest_bearing),
      start_date: loan.start_date,
      maturity_date: loan.maturity_date || null,
      installment_frequency: loan.installment_frequency || 'monthly',
      installment_amount: loan.installment_amount || 0,
      total_principal_repaid: loan.total_principal_repaid || 0,
      total_interest_paid: loan.total_interest_paid || 0,
      status: loan.status || 'active',
      notes: loan.notes || null,
      updated_at: new Date().toISOString(),
    }).select('*').single();

    if (error) {
      console.error('Supabase loans upsert error:', error);
      throw error;
    }

    return (data as Loan) || loan;
  }

  // 8. Sync Property
  async syncProperty(property: Property, workspaceId: string): Promise<Property> {
    if (!this.isAvailable()) return property;
    const wsUuid = toUuid(workspaceId);
    const propUuid = toUuid(property.id);

    await this.ensureRemoteWorkspace(workspaceId);

    const { data, error } = await supabase.from('properties').upsert({
      id: propUuid,
      workspace_id: wsUuid,
      property_code: property.property_code,
      name: property.name,
      category: property.category || 'Residential Plot',
      property_type: property.property_type || 'Freehold',
      original_size_description: property.original_size_description,
      normalized_size: property.normalized_size || null,
      measurement_unit: property.measurement_unit || 'Khara',
      original_ownership_description: property.original_ownership_description,
      normalized_ownership_percentage: property.normalized_ownership_percentage || null,
      ownership_uncertainty: Boolean(property.ownership_uncertainty),
      ownership_type: property.ownership_type || 'sole_member',
      location_address: property.location_address,
      district: property.district || null,
      mouza: property.mouza || null,
      khatian_number: property.khatian_number || null,
      dag_number: property.dag_number || null,
      acquisition_date: property.acquisition_date || null,
      acquisition_cost: property.acquisition_cost || null,
      current_market_valuation: property.current_market_valuation || 0,
      valuation_date: property.valuation_date || new Date().toISOString().split('T')[0],
      recovery_amount_required: property.recovery_amount_required || 0,
      expected_recovery_date: property.expected_recovery_date || null,
      actual_recovery_received: property.actual_recovery_received || 0,
      status: property.status || 'active',
      remarks: property.remarks || null,
      document_urls: property.document_urls || [],
      image_urls: property.image_urls || [],
      updated_at: new Date().toISOString(),
    }).select('*').single();

    if (error) {
      console.error('Supabase properties upsert error:', error);
      throw error;
    }

    return (data as Property) || property;
  }

  // 9. Sync Budget
  async syncBudget(budget: Budget, workspaceId: string): Promise<Budget> {
    if (!this.isAvailable()) return budget;
    const wsUuid = toUuid(workspaceId);
    const bgtUuid = toUuid(budget.id);

    await this.ensureRemoteWorkspace(workspaceId);
    await this.ensureRemoteCategory(budget.category_id, workspaceId);

    const { data, error } = await supabase.from('budgets').upsert({
      id: bgtUuid,
      workspace_id: wsUuid,
      category_id: toUuid(budget.category_id),
      period_type: budget.period_type || 'monthly',
      period_start: budget.period_start,
      period_end: budget.period_end,
      budget_amount: budget.budget_amount,
      alert_threshold_percentage: budget.alert_threshold_percentage || 80,
      notes: budget.notes || null,
      updated_at: new Date().toISOString(),
    }).select('*').single();

    if (error) {
      console.error('Supabase budgets upsert error:', error);
      throw error;
    }

    return (data as Budget) || budget;
  }

  // 10. Sync Savings Goal
  async syncSavingsGoal(goal: SavingsGoal, workspaceId: string): Promise<SavingsGoal> {
    if (!this.isAvailable()) return goal;
    const wsUuid = toUuid(workspaceId);
    const goalUuid = toUuid(goal.id);

    await this.ensureRemoteWorkspace(workspaceId);
    if (goal.account_id) {
      await this.ensureRemoteAccount(goal.account_id, workspaceId);
    }

    const { data, error } = await supabase.from('savings_goals').upsert({
      id: goalUuid,
      workspace_id: wsUuid,
      account_id: goal.account_id ? toUuid(goal.account_id) : null,
      name: goal.name,
      goal_type: goal.goal_type || 'dps',
      target_amount: goal.target_amount,
      current_saved_amount: goal.current_saved_amount || 0,
      monthly_contribution: goal.monthly_contribution || 0,
      target_date: goal.target_date || null,
      expected_maturity_date: goal.expected_maturity_date || null,
      expected_return_rate: goal.expected_return_rate || 0,
      status: goal.status || 'active',
      notes: goal.notes || null,
      updated_at: new Date().toISOString(),
    }).select('*').single();

    if (error) {
      console.error('Supabase savings_goals upsert error:', error);
      throw error;
    }

    return (data as SavingsGoal) || goal;
  }

  // 11. Sync Recurring Rule
  async syncRecurringRule(rule: RecurringRule, workspaceId: string): Promise<RecurringRule> {
    if (!this.isAvailable()) return rule;
    const wsUuid = toUuid(workspaceId);
    const ruleUuid = toUuid(rule.id);

    await this.ensureRemoteWorkspace(workspaceId);
    if (rule.source_account_id) {
      await this.ensureRemoteAccount(rule.source_account_id, workspaceId);
    }
    if (rule.destination_account_id) {
      await this.ensureRemoteAccount(rule.destination_account_id, workspaceId);
    }
    if (rule.category_id) {
      await this.ensureRemoteCategory(rule.category_id, workspaceId);
    }

    const { data, error } = await supabase.from('recurring_rules').upsert({
      id: ruleUuid,
      workspace_id: wsUuid,
      name: rule.name,
      rule_type: rule.rule_type || 'expense',
      amount: rule.amount,
      currency: rule.currency || 'BDT',
      frequency: rule.frequency || 'monthly',
      start_date: rule.start_date,
      end_date: rule.end_date || null,
      next_due_date: rule.next_due_date,
      source_account_id: rule.source_account_id ? toUuid(rule.source_account_id) : null,
      destination_account_id: rule.destination_account_id ? toUuid(rule.destination_account_id) : null,
      category_id: rule.category_id ? toUuid(rule.category_id) : null,
      auto_post: Boolean(rule.auto_post),
      is_active: Boolean(rule.is_active),
      notes: rule.notes || null,
      updated_at: new Date().toISOString(),
    }).select('*').single();

    if (error) {
      console.error('Supabase recurring_rules upsert error:', error);
      throw error;
    }

    return (data as RecurringRule) || rule;
  }

  // ==========================================
  // Pure Authoritative Remote Data Fetching
  // ==========================================
  async pullRemoteWorkspaceData(workspaceId: string): Promise<{
    accounts: FinancialAccount[];
    categories: Category[];
    cards: CreditCard[];
    loans: Loan[];
    properties: Property[];
    entries: JournalEntry[];
    budgets: Budget[];
    goals: SavingsGoal[];
    rules: RecurringRule[];
  } | null> {
    if (!this.isAvailable()) return null;
    const wsUuid = toUuid(workspaceId);

    try {
      const [
        accountsRes, 
        categoriesRes, 
        cardsRes, 
        loansRes, 
        propertiesRes, 
        entriesRes,
        budgetsRes,
        goalsRes,
        rulesRes
      ] = await Promise.all([
        supabase.from('financial_accounts').select('*').eq('workspace_id', wsUuid).order('name', { ascending: true }),
        supabase.from('categories').select('*').eq('workspace_id', wsUuid).order('sort_order', { ascending: true }),
        supabase.from('credit_cards').select('*').eq('workspace_id', wsUuid),
        supabase.from('loans').select('*').eq('workspace_id', wsUuid),
        supabase.from('properties').select('*').eq('workspace_id', wsUuid),
        supabase.from('journal_entries').select('*, lines:journal_lines(*)').eq('workspace_id', wsUuid).order('entry_date', { ascending: false }),
        supabase.from('budgets').select('*').eq('workspace_id', wsUuid),
        supabase.from('savings_goals').select('*').eq('workspace_id', wsUuid),
        supabase.from('recurring_rules').select('*').eq('workspace_id', wsUuid),
      ]);

      if (accountsRes.error) console.warn('Fetch accounts error:', accountsRes.error.message);
      if (categoriesRes.error) console.warn('Fetch categories error:', categoriesRes.error.message);
      if (entriesRes.error) console.warn('Fetch entries error:', entriesRes.error.message);

      return {
        accounts: accountsRes.data || [],
        categories: categoriesRes.data || [],
        cards: cardsRes.data || [],
        loans: loansRes.data || [],
        properties: propertiesRes.data || [],
        entries: entriesRes.data || [],
        budgets: budgetsRes.data || [],
        goals: goalsRes.data || [],
        rules: rulesRes.data || [],
      };
    } catch (err: any) {
      console.warn('Pull remote data notice:', err.message);
      return null;
    }
  }

  // ==========================================
  // Audited & Verified Remote Deletion Operations
  // ==========================================

  /**
   * Delete or Archive a Financial Account
   * Verifies affected rows. Never silently claims success on 0 rows.
   * If journal transactions exist, archives to preserve ledger integrity.
   */
  async deleteAccount(accountId: string, workspaceId: string): Promise<DeleteResult> {
    if (!this.isAvailable()) return { success: true, action: 'deleted' };
    const accUuid = toUuid(accountId);
    const wsUuid = toUuid(workspaceId);

    try {
      // 1. Try atomic safe_delete_financial_account RPC if present
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('safe_delete_financial_account', {
          p_account_id: accUuid,
          p_workspace_id: wsUuid,
        });
        if (!rpcErr && rpcData && rpcData.success) {
          return {
            success: true,
            action: rpcData.action || 'deleted',
            affectedCount: rpcData.affected || 1,
            message: rpcData.message,
          };
        }
      } catch {
        // RPC not yet deployed in DB; proceed to direct fallback
      }

      // 2. Direct verified fallback
      // Check if account has any double-entry journal transactions
      const { count, error: countErr } = await supabase
        .from('journal_lines')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accUuid);

      if (countErr) {
        console.warn('Journal lines check error:', countErr.message);
      }

      const hasTransactions = (count ?? 0) > 0;

      if (hasTransactions) {
        // SOFT-DELETE (Archive): Preserves immutable ledger history
        const { data: updateData, error: updateErr } = await supabase
          .from('financial_accounts')
          .update({ is_archived: true, updated_at: new Date().toISOString() })
          .eq('id', accUuid)
          .eq('workspace_id', wsUuid)
          .select('id');

        if (updateErr) throw updateErr;
        if (!updateData || updateData.length === 0) {
          throw new Error('Account not found in database or permission denied.');
        }

        // Unlink non-ledger references
        await supabase.from('categories').update({ target_savings_account_id: null }).eq('target_savings_account_id', accUuid).eq('workspace_id', wsUuid);
        await supabase.from('loans').update({ account_id: null }).eq('account_id', accUuid).eq('workspace_id', wsUuid);
        await supabase.from('savings_goals').update({ account_id: null }).eq('account_id', accUuid).eq('workspace_id', wsUuid);

        return {
          success: true,
          action: 'archived',
          affectedCount: updateData.length,
          message: 'Account has transaction history and was safely archived to preserve double-entry balance.',
        };
      }

      // Zero transactions: Safe to HARD-DELETE
      // Unlink non-ledger references first
      await supabase.from('categories').update({ target_savings_account_id: null }).eq('target_savings_account_id', accUuid).eq('workspace_id', wsUuid);
      await supabase.from('credit_cards').delete().eq('account_id', accUuid).eq('workspace_id', wsUuid);
      await supabase.from('loans').update({ account_id: null }).eq('account_id', accUuid).eq('workspace_id', wsUuid);
      await supabase.from('savings_goals').update({ account_id: null }).eq('account_id', accUuid).eq('workspace_id', wsUuid);

      // Delete account row and verify affected rows
      const { data: deleteData, error: deleteErr } = await supabase
        .from('financial_accounts')
        .delete()
        .eq('id', accUuid)
        .eq('workspace_id', wsUuid)
        .select('id');

      if (deleteErr) throw deleteErr;
      if (!deleteData || deleteData.length === 0) {
        throw new Error('Account record could not be deleted (0 rows affected). Check database permissions.');
      }

      return {
        success: true,
        action: 'deleted',
        affectedCount: deleteData.length,
        message: 'Account permanently removed from database.',
      };
    } catch (err: any) {
      console.error('deleteAccount failed:', err);
      return {
        success: false,
        error: err.message || 'Database deletion failed',
      };
    }
  }

  /**
   * Delete Journal Entry with verified row count
   */
  async deleteJournalEntry(entryId: string, workspaceId: string): Promise<DeleteResult> {
    if (!this.isAvailable()) return { success: true, action: 'deleted' };
    const entryUuid = toUuid(entryId);
    const wsUuid = toUuid(workspaceId);

    try {
      // 1. Try atomic safe_delete_journal_entry RPC if present
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('safe_delete_journal_entry', {
          p_entry_id: entryUuid,
          p_workspace_id: wsUuid,
        });
        if (!rpcErr && rpcData && rpcData.success) {
          return { success: true, action: 'deleted', message: rpcData.message };
        }
      } catch {
        // proceed to direct fallback
      }

      // 2. Direct fallback
      // Delete lines first
      await supabase.from('journal_lines').delete().eq('journal_entry_id', entryUuid);

      // Delete entry and verify
      const { data, error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', entryUuid)
        .eq('workspace_id', wsUuid)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Transaction record not found in database or permission denied.');
      }

      return { success: true, action: 'deleted', affectedCount: data.length };
    } catch (err: any) {
      console.error('deleteJournalEntry failed:', err);
      return { success: false, error: err.message || 'Transaction deletion failed' };
    }
  }

  /**
   * Delete Category with verified cleanup
   */
  async deleteCategory(categoryId: string, workspaceId: string): Promise<DeleteResult> {
    if (!this.isAvailable()) return { success: true, action: 'deleted' };
    const catUuid = toUuid(categoryId);
    const wsUuid = toUuid(workspaceId);

    try {
      // 1. Try RPC safe_delete_category
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('safe_delete_category', {
          p_category_id: catUuid,
          p_workspace_id: wsUuid,
        });
        if (!rpcErr && rpcData && rpcData.success) {
          return { success: true, action: 'deleted', message: rpcData.message };
        }
      } catch {
        // proceed to direct fallback
      }

      // 2. Direct fallback: Unlink lines, budgets, subcategories
      await supabase.from('journal_lines').update({ category_id: null }).eq('category_id', catUuid);
      await supabase.from('categories').delete().eq('parent_id', catUuid).eq('workspace_id', wsUuid);
      await supabase.from('budgets').delete().eq('category_id', catUuid).eq('workspace_id', wsUuid);
      await supabase.from('recurring_rules').update({ category_id: null }).eq('category_id', catUuid).eq('workspace_id', wsUuid);

      const { data, error } = await supabase
        .from('categories')
        .delete()
        .eq('id', catUuid)
        .eq('workspace_id', wsUuid)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Category not found in database or permission denied.');
      }

      return { success: true, action: 'deleted', affectedCount: data.length };
    } catch (err: any) {
      console.error('deleteCategory failed:', err);
      return { success: false, error: err.message || 'Category deletion failed' };
    }
  }

  /**
   * Delete Credit Card
   */
  async deleteCreditCard(cardId: string, workspaceId: string): Promise<DeleteResult> {
    if (!this.isAvailable()) return { success: true, action: 'deleted' };
    const cardUuid = toUuid(cardId);
    const wsUuid = toUuid(workspaceId);

    try {
      await supabase.from('credit_card_statements').delete().eq('credit_card_id', cardUuid);
      const { data, error } = await supabase
        .from('credit_cards')
        .delete()
        .eq('id', cardUuid)
        .eq('workspace_id', wsUuid)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Credit card not found in database or permission denied.');
      }

      return { success: true, action: 'deleted', affectedCount: data.length };
    } catch (err: any) {
      console.error('deleteCreditCard failed:', err);
      return { success: false, error: err.message || 'Credit card deletion failed' };
    }
  }

  /**
   * Delete Loan
   */
  async deleteLoan(loanId: string, workspaceId: string): Promise<DeleteResult> {
    if (!this.isAvailable()) return { success: true, action: 'deleted' };
    const loanUuid = toUuid(loanId);
    const wsUuid = toUuid(workspaceId);

    try {
      await supabase.from('loan_payments').delete().eq('loan_id', loanUuid);
      const { data, error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loanUuid)
        .eq('workspace_id', wsUuid)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Loan record not found in database or permission denied.');
      }

      return { success: true, action: 'deleted', affectedCount: data.length };
    } catch (err: any) {
      console.error('deleteLoan failed:', err);
      return { success: false, error: err.message || 'Loan deletion failed' };
    }
  }

  /**
   * Delete Property
   */
  async deleteProperty(propertyId: string, workspaceId: string): Promise<DeleteResult> {
    if (!this.isAvailable()) return { success: true, action: 'deleted' };
    const propUuid = toUuid(propertyId);
    const wsUuid = toUuid(workspaceId);

    try {
      await supabase.from('property_recoveries').delete().eq('property_id', propUuid);
      await supabase.from('property_valuations').delete().eq('property_id', propUuid);
      await supabase.from('property_owners').delete().eq('property_id', propUuid);

      const { data, error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propUuid)
        .eq('workspace_id', wsUuid)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Property record not found in database or permission denied.');
      }

      return { success: true, action: 'deleted', affectedCount: data.length };
    } catch (err: any) {
      console.error('deleteProperty failed:', err);
      return { success: false, error: err.message || 'Property deletion failed' };
    }
  }

  /**
   * Delete Budget
   */
  async deleteBudget(budgetId: string, workspaceId: string): Promise<DeleteResult> {
    if (!this.isAvailable()) return { success: true, action: 'deleted' };
    const budgetUuid = toUuid(budgetId);
    const wsUuid = toUuid(workspaceId);

    try {
      const { data, error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetUuid)
        .eq('workspace_id', wsUuid)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Budget not found in database or permission denied.');
      }

      return { success: true, action: 'deleted', affectedCount: data.length };
    } catch (err: any) {
      console.error('deleteBudget failed:', err);
      return { success: false, error: err.message || 'Budget deletion failed' };
    }
  }

  /**
   * Delete Savings Goal
   */
  async deleteSavingsGoal(goalId: string, workspaceId: string): Promise<DeleteResult> {
    if (!this.isAvailable()) return { success: true, action: 'deleted' };
    const goalUuid = toUuid(goalId);
    const wsUuid = toUuid(workspaceId);

    try {
      const { data, error } = await supabase
        .from('savings_goals')
        .delete()
        .eq('id', goalUuid)
        .eq('workspace_id', wsUuid)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Savings goal not found in database or permission denied.');
      }

      return { success: true, action: 'deleted', affectedCount: data.length };
    } catch (err: any) {
      console.error('deleteSavingsGoal failed:', err);
      return { success: false, error: err.message || 'Savings goal deletion failed' };
    }
  }

  /**
   * Delete Recurring Rule
   */
  async deleteRecurringRule(ruleId: string, workspaceId: string): Promise<DeleteResult> {
    if (!this.isAvailable()) return { success: true, action: 'deleted' };
    const ruleUuid = toUuid(ruleId);
    const wsUuid = toUuid(workspaceId);

    try {
      await supabase.from('recurring_executions').delete().eq('recurring_rule_id', ruleUuid);

      const { data, error } = await supabase
        .from('recurring_rules')
        .delete()
        .eq('id', ruleUuid)
        .eq('workspace_id', wsUuid)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Recurring rule not found in database or permission denied.');
      }

      return { success: true, action: 'deleted', affectedCount: data.length };
    } catch (err: any) {
      console.error('deleteRecurringRule failed:', err);
      return { success: false, error: err.message || 'Recurring rule deletion failed' };
    }
  }
}

export const supabaseSync = new SupabaseSyncEngine();
