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

class SupabaseSyncEngine {
  private isAvailable(): boolean {
    return isSupabaseConfigured();
  }

  // 1. Sync User Profile
  async syncProfile(userId: string, email: string, fullName: string) {
    if (!this.isAvailable() || !userId) return;
    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email: email || '',
        full_name: fullName || '',
        default_currency: 'BDT',
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync profile error:', err);
    }
  }

  // Helper: Ensures the workspace exists in Supabase to prevent 23503 foreign key violation
  async ensureRemoteWorkspace(workspaceId: string, userId?: string) {
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
            name: 'Personal Finances',
            type: 'personal',
            created_by: ownerId,
            currency: 'BDT',
            description: 'Personal financial workspace',
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
    } catch (e) {
      console.warn('ensureRemoteWorkspace notice:', e);
    }
  }

  // Helper: Ensures an account exists in Supabase before foreign key references are inserted
  async ensureRemoteAccount(accountId: string, workspaceId: string, defaultName?: string, defaultType: string = 'bank') {
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
        const { db } = await import('./db');
        const localAccs = db.getAccounts(workspaceId);
        const localAcc = localAccs.find(a => toUuid(a.id) === accUuid || a.id === accountId);
        if (localAcc) {
          await this.syncAccount(localAcc, workspaceId);
        } else {
          const nameToUse = defaultName || 'Account';
          const { data: byName } = await supabase
            .from('financial_accounts')
            .select('id')
            .eq('workspace_id', wsUuid)
            .ilike('name', nameToUse)
            .maybeSingle();

          if (!byName) {
            await supabase.from('financial_accounts').insert({
              id: accUuid,
              workspace_id: wsUuid,
              name: `${nameToUse} (${accUuid.slice(0, 4)})`,
              account_type_id: defaultType,
              provider: defaultType === 'credit_card' ? 'Credit Card' : 'Other',
              currency: 'BDT',
              opening_balance: 0,
              opening_date: new Date().toISOString().split('T')[0],
              current_balance_cached: 0,
              is_archived: false,
              icon: defaultType === 'credit_card' ? 'credit-card' : 'wallet',
              color: defaultType === 'credit_card' ? '#e11d48' : '#0284c7',
              updated_at: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.warn('ensureRemoteAccount notice:', e);
    }
  }

  // Helper: Ensures a category exists in Supabase before journal_lines reference it
  async ensureRemoteCategory(categoryId: string, workspaceId: string, defaultName?: string) {
    if (!this.isAvailable() || !categoryId) return;
    const catUuid = toUuid(categoryId);
    const wsUuid = toUuid(workspaceId);
    try {
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('id', catUuid)
        .maybeSingle();

      if (!existing) {
        const { db } = await import('./db');
        const localCats = db.getCategories(workspaceId);
        const localCat = localCats.find(c => toUuid(c.id) === catUuid || c.id === categoryId);
        if (localCat) {
          await this.syncCategory(localCat, workspaceId);
        } else {
          const nameToUse = defaultName || 'General';
          const { data: byName } = await supabase
            .from('categories')
            .select('id')
            .eq('workspace_id', wsUuid)
            .ilike('name', nameToUse)
            .maybeSingle();

          if (!byName) {
            await supabase.from('categories').insert({
              id: catUuid,
              workspace_id: wsUuid,
              name: `${nameToUse} (${catUuid.slice(0, 4)})`,
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
        }
      }
    } catch (e) {
      console.warn('ensureRemoteCategory notice:', e);
    }
  }

  // 2. Sync Workspace & Membership
  async syncWorkspace(workspace: Workspace, userId: string) {
    if (!this.isAvailable() || !userId) return;
    const wsUuid = toUuid(workspace.id);

    try {
      await supabase.from('workspaces').upsert({
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

      await supabase.from('workspace_members').upsert({
        id: toUuid(`member_${wsUuid}_${userId}`),
        workspace_id: wsUuid,
        user_id: userId,
        role: 'owner',
        status: 'active',
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync workspace error:', err);
    }
  }

  // 3. Sync Financial Account (Checks by Name and ID to prevent 409 duplicate conflicts)
  async syncAccount(account: FinancialAccount, workspaceId: string) {
    if (!this.isAvailable()) return;
    const wsUuid = toUuid(workspaceId);
    try {
      await this.ensureRemoteWorkspace(workspaceId);

      const accUuid = toUuid(account.id);
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

      // Check if account already exists by name or by ID to prevent duplicate key errors
      const { data: byName } = await supabase
        .from('financial_accounts')
        .select('id')
        .eq('workspace_id', wsUuid)
        .ilike('name', account.name.trim());

      let remoteId: string | null = null;
      if (byName && byName.length > 0) {
        remoteId = byName[0].id;
      } else {
        const { data: byId } = await supabase
          .from('financial_accounts')
          .select('id')
          .eq('id', accUuid)
          .maybeSingle();
        if (byId) remoteId = byId.id;
      }

      if (remoteId) {
        const updatePayload = { ...accPayload };
        delete updatePayload.id;
        await supabase.from('financial_accounts').update(updatePayload).eq('id', remoteId).eq('workspace_id', wsUuid);
        if (account.id !== remoteId) {
          const { db } = await import('./db');
          db.remapAccountId(account.id, remoteId, workspaceId);
        }
      } else {
        await supabase.from('financial_accounts').insert(accPayload);
      }
    } catch (err) {
      console.warn('Sync account error:', err);
    }
  }

  // 4. Sync Category (Supports Subcategories and Saving Heads with multi-tier fallback, eliminates 409 error 23505 & 23503 FK error)
  async syncCategory(cat: Category, workspaceId: string): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!this.isAvailable()) return { success: true };
    const wsUuid = toUuid(workspaceId);
    const catUuid = toUuid(cat.id);

    try {
      await this.ensureRemoteWorkspace(workspaceId);

      // Pre-ensure foreign keys exist before constructing payload to prevent 23503
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
        color: cat.color || '#64748b',
        is_seed: Boolean(cat.is_seed),
        is_archived: Boolean(cat.is_archived),
        sort_order: cat.sort_order || 0,
        updated_at: new Date().toISOString(),
      };

      if (safeParentId) {
        catPayload.parent_id = safeParentId;
      }
      if (cat.income_type) {
        catPayload.income_type = cat.income_type;
      }
      if (safeTargetAccountId) {
        catPayload.target_savings_account_id = safeTargetAccountId;
      }
      if (cat.description) {
        catPayload.description = cat.description;
      }

      // Step 1: Check by ID first (primary key) to avoid 409 conflict
      const { data: byId } = await supabase
        .from('categories')
        .select('id, name')
        .eq('id', catUuid)
        .maybeSingle();

      let remoteIdToUpdate: string | null = byId?.id || null;

      // Step 2: If not found by ID, check by name in this workspace to avoid 23505 unique collision
      if (!remoteIdToUpdate) {
        const { data: byName } = await supabase
          .from('categories')
          .select('id, name')
          .eq('workspace_id', wsUuid)
          .ilike('name', cat.name.trim())
          .limit(1);

        if (byName && byName.length > 0) {
          remoteIdToUpdate = byName[0].id;
        }
      }

      // Safe multi-stage write function with comprehensive error fallbacks
      const executeWrite = async (isUpdate: boolean, targetId?: string): Promise<{ success: boolean; id: string; error?: string }> => {
        let payload = { ...catPayload };
        if (isUpdate) {
          delete payload.id;
        }

        const runOp = async (p: any) => {
          if (isUpdate && targetId) {
            return await supabase.from('categories').update(p).eq('id', targetId).select('id').maybeSingle();
          } else {
            return await supabase.from('categories').insert(p).select('id').maybeSingle();
          }
        };

        let res = await runOp(payload);

        // Fallback 1: Check constraint violation (23514) on older unmigrated schemas
        if (res.error && (res.error.code === '23514' || res.error.message?.includes('check constraint') || res.error.message?.includes('categories_type_check') || res.error.message?.includes('categories_accounting_classification_check'))) {
          if (payload.type === 'saving') payload.type = 'transfer_allocation';
          if (payload.accounting_classification === 'asset_savings') payload.accounting_classification = 'asset_transfer';
          res = await runOp(payload);
        }

        // Fallback 2: Missing columns on older unmigrated schemas (42703)
        if (res.error && (res.error.code === '42703' || res.error.message?.includes('does not exist'))) {
          delete payload.parent_id;
          delete payload.target_savings_account_id;
          delete payload.income_type;
          delete payload.description;
          res = await runOp(payload);
        }

        // Fallback 3: Foreign key violation (23503) for target_savings_account_id or parent_id
        if (res.error && (res.error.code === '23503' || res.error.message?.includes('foreign key'))) {
          delete payload.target_savings_account_id;
          delete payload.parent_id;
          res = await runOp(payload);
        }

        // Fallback 4: Duplicate key conflict (23505) during insert: update existing row by name
        if (!isUpdate && res.error && (res.error.code === '23505' || res.error.message?.includes('duplicate key') || res.error.message?.includes('uq_category_name_workspace'))) {
          delete payload.id;
          const updateRes = await supabase.from('categories').update(payload).eq('workspace_id', wsUuid).ilike('name', cat.name.trim()).select('id').maybeSingle();
          if (!updateRes.error && updateRes.data?.id) {
            return { success: true, id: updateRes.data.id };
          }
        }

        if (res.error) {
          console.warn('Category sync warning:', res.error.message);
          return { success: false, id: targetId || catUuid, error: res.error.message };
        }

        return { success: true, id: res.data?.id || targetId || catUuid };
      };

      if (remoteIdToUpdate) {
        const result = await executeWrite(true, remoteIdToUpdate);
        if (cat.id !== remoteIdToUpdate) {
          const { db } = await import('./db');
          db.remapCategoryId(cat.id, remoteIdToUpdate, workspaceId);
        }
        return result;
      } else {
        const result = await executeWrite(false);
        return result;
      }
    } catch (err: any) {
      console.warn('Sync category error:', err);
      return { success: false, id: catUuid, error: err.message || 'Sync failed' };
    }
  }

  // 5. Sync Journal Entry & Lines
  async syncJournalEntry(entry: JournalEntry, workspaceId: string, userId?: string) {
    if (!this.isAvailable()) return;
    const entryUuid = toUuid(entry.id);
    const wsUuid = toUuid(workspaceId);

    try {
      await this.ensureRemoteWorkspace(workspaceId, userId);

      // Ensure all line accounts and categories exist in Supabase first to prevent 23503
      if (entry.lines && entry.lines.length > 0) {
        for (const line of entry.lines) {
          const isExpenseOp = line.account_id === toUuid(`acc_expense_operating_${workspaceId}`);
          const isIncomeOp = line.account_id === toUuid(`acc_income_earned_${workspaceId}`);
          const isEquityOp = line.account_id === toUuid(`acc_equity_offset_${workspaceId}`);

          if (isExpenseOp) {
            await this.ensureRemoteAccount(line.account_id, workspaceId, 'General Operating Expenses', 'expense_operating');
          } else if (isIncomeOp) {
            await this.ensureRemoteAccount(line.account_id, workspaceId, 'Earned Revenue & Income', 'income_salary');
          } else if (isEquityOp) {
            await this.ensureRemoteAccount(line.account_id, workspaceId, 'Opening Balance Equity', 'opening_equity');
          } else {
            await this.ensureRemoteAccount(line.account_id, workspaceId);
          }

          if (line.category_id) {
            await this.ensureRemoteCategory(line.category_id, workspaceId);
          }
        }
      }

      // Upsert transaction header (omit identity column entry_number)
      const entryPayload: any = {
        id: entryUuid,
        workspace_id: wsUuid,
        entry_date: entry.entry_date,
        memo: entry.memo,
        source_type: entry.source_type,
        source_id: entry.source_id || null,
        status: entry.status || 'posted',
        is_reversal: Boolean(entry.is_reversal),
        created_by: userId ? userId : null,
        updated_at: new Date().toISOString(),
      };
      if (entry.period_end_date !== undefined) {
        entryPayload.period_end_date = entry.period_end_date || null;
      }
      if (entry.is_historical !== undefined) {
        entryPayload.is_historical = Boolean(entry.is_historical);
      }
      if (entry.historical_note !== undefined) {
        entryPayload.historical_note = entry.historical_note || null;
      }

      try {
        await supabase.from('journal_entries').upsert(entryPayload);
      } catch (upsertErr) {
        // Fallback without historical/period columns if migration not run yet
        delete entryPayload.period_end_date;
        delete entryPayload.is_historical;
        delete entryPayload.historical_note;
        await supabase.from('journal_entries').upsert(entryPayload);
      }

      // Upsert debit/credit lines
      if (entry.lines && entry.lines.length > 0) {
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

        await supabase.from('journal_lines').upsert(linesPayload);
      }
    } catch (err) {
      console.warn('Sync journal entry error:', err);
    }
  }

  // 6. Sync Credit Card (Guarantees workspace and underlying liability account exist first!)
  async syncCreditCard(card: CreditCard, workspaceId: string) {
    if (!this.isAvailable()) return;
    const wsUuid = toUuid(workspaceId);
    const accUuid = toUuid(card.account_id);
    const cardUuid = toUuid(card.id);

    try {
      // Step 1: Ensure workspace exists in Supabase
      await this.ensureRemoteWorkspace(workspaceId);

      // Step 2: Ensure the underlying liability account exists in Supabase FIRST
      await this.ensureRemoteAccount(
        card.account_id, 
        workspaceId, 
        `${card.card_name} (${card.last_four_digits})`, 
        'credit_card'
      );

      // Step 3: Now upsert the credit card record with 100% valid foreign keys
      const { error } = await supabase.from('credit_cards').upsert({
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
      });

      if (error) {
        console.error('Supabase credit_cards upsert error:', error);
      }
    } catch (err) {
      console.warn('Sync card error:', err);
    }
  }

  // 7. Sync Loan
  async syncLoan(loan: Loan, workspaceId: string) {
    if (!this.isAvailable()) return;
    const wsUuid = toUuid(workspaceId);
    try {
      await this.ensureRemoteWorkspace(workspaceId);
      if (loan.account_id) {
        await this.ensureRemoteAccount(loan.account_id, workspaceId);
      }

      await supabase.from('loans').upsert({
        id: toUuid(loan.id),
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
      });
    } catch (err) {
      console.warn('Sync loan error:', err);
    }
  }

  // 8. Sync Property
  async syncProperty(property: Property, workspaceId: string) {
    if (!this.isAvailable()) return;
    const wsUuid = toUuid(workspaceId);
    try {
      await this.ensureRemoteWorkspace(workspaceId);

      await supabase.from('properties').upsert({
        id: toUuid(property.id),
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
      });
    } catch (err) {
      console.warn('Sync property error:', err);
    }
  }

  // 9. Sync Budget
  async syncBudget(budget: Budget, workspaceId: string) {
    if (!this.isAvailable()) return;
    const wsUuid = toUuid(workspaceId);
    try {
      await this.ensureRemoteWorkspace(workspaceId);
      await this.ensureRemoteCategory(budget.category_id, workspaceId);

      await supabase.from('budgets').upsert({
        id: toUuid(budget.id),
        workspace_id: wsUuid,
        category_id: toUuid(budget.category_id),
        period_type: budget.period_type || 'monthly',
        period_start: budget.period_start,
        period_end: budget.period_end,
        budget_amount: budget.budget_amount,
        alert_threshold_percentage: budget.alert_threshold_percentage || 80,
        notes: budget.notes || null,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Sync budget error:', err);
    }
  }

  // 10. Sync Savings Goal
  async syncSavingsGoal(goal: SavingsGoal, workspaceId: string) {
    if (!this.isAvailable()) return;
    const wsUuid = toUuid(workspaceId);
    try {
      await this.ensureRemoteWorkspace(workspaceId);
      if (goal.account_id) {
        await this.ensureRemoteAccount(goal.account_id, workspaceId);
      }

      await supabase.from('savings_goals').upsert({
        id: toUuid(goal.id),
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
      });
    } catch (err) {
      console.warn('Sync savings goal error:', err);
    }
  }

  // 11. Sync Recurring Transaction Rule & Bill
  async syncRecurringRule(rule: RecurringRule, workspaceId: string) {
    if (!this.isAvailable()) return;
    const wsUuid = toUuid(workspaceId);
    try {
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

      await supabase.from('recurring_rules').upsert({
        id: toUuid(rule.id),
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
      });
    } catch (err) {
      console.warn('Sync recurring rule error:', err);
    }
  }

  // Hydrate all workspace entities from Supabase to local client
  async pullRemoteWorkspaceData(workspaceId: string) {
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
        supabase.from('financial_accounts').select('*').eq('workspace_id', wsUuid),
        supabase.from('categories').select('*').eq('workspace_id', wsUuid),
        supabase.from('credit_cards').select('*').eq('workspace_id', wsUuid),
        supabase.from('loans').select('*').eq('workspace_id', wsUuid),
        supabase.from('properties').select('*').eq('workspace_id', wsUuid),
        supabase.from('journal_entries').select('*, lines:journal_lines(*)').eq('workspace_id', wsUuid),
        supabase.from('budgets').select('*').eq('workspace_id', wsUuid),
        supabase.from('savings_goals').select('*').eq('workspace_id', wsUuid),
        supabase.from('recurring_rules').select('*').eq('workspace_id', wsUuid),
      ]);

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
    } catch (err) {
      console.warn('Pull remote data notice:', err);
      return null;
    }
  }

  // ==========================================
  // Remote Deletion Operations
  // ==========================================
  async deleteJournalEntry(entryId: string, workspaceId: string) {
    if (!this.isAvailable()) return;
    const entryUuid = toUuid(entryId);
    const wsUuid = toUuid(workspaceId);
    try {
      await supabase.from('journal_lines').delete().eq('journal_entry_id', entryUuid);
      const { error } = await supabase.from('journal_entries').delete().eq('id', entryUuid).eq('workspace_id', wsUuid);
      if (error) console.error('Delete journal entry error from Supabase:', error);
    } catch (err) {
      console.warn('Delete journal entry error:', err);
    }
  }

  async deleteCreditCard(cardId: string, workspaceId: string) {
    if (!this.isAvailable()) return;
    const cardUuid = toUuid(cardId);
    const wsUuid = toUuid(workspaceId);
    try {
      await supabase.from('credit_card_statements').delete().eq('credit_card_id', cardUuid);
      const { error } = await supabase.from('credit_cards').delete().eq('id', cardUuid).eq('workspace_id', wsUuid);
      if (error) console.error('Delete credit card error from Supabase:', error);
    } catch (err) {
      console.warn('Delete credit card error:', err);
    }
  }

  async deleteAccount(accountId: string, workspaceId: string, accountName?: string) {
    if (!this.isAvailable()) return;
    const accUuid = toUuid(accountId);
    const wsUuid = toUuid(workspaceId);
    try {
      let idsToDelete: string[] = [accUuid];
      if (accountName && accountName.trim()) {
        const { data: matches } = await supabase
          .from('financial_accounts')
          .select('id')
          .eq('workspace_id', wsUuid)
          .ilike('name', accountName.trim());
        if (matches && matches.length > 0) {
          idsToDelete = Array.from(new Set([...idsToDelete, ...matches.map(m => m.id)]));
        }
      }

      for (const idToDel of idsToDelete) {
        // 1. Unlink categories pointing to this account as target savings
        try {
          await supabase.from('categories').update({ target_savings_account_id: null }).eq('target_savings_account_id', idToDel).eq('workspace_id', wsUuid);
        } catch {}
        // 2. Delete associated credit cards referencing this account
        try {
          await supabase.from('credit_cards').delete().eq('account_id', idToDel).eq('workspace_id', wsUuid);
        } catch {}
        // 3. Unlink any loans referencing this account
        try {
          await supabase.from('loans').update({ account_id: null }).eq('account_id', idToDel).eq('workspace_id', wsUuid);
        } catch {}
        // 4. Unlink any savings goals referencing this account
        try {
          await supabase.from('savings_goals').update({ account_id: null }).eq('account_id', idToDel).eq('workspace_id', wsUuid);
        } catch {}
        // 5. Delete journal lines referencing this account
        try {
          await supabase.from('journal_lines').delete().eq('account_id', idToDel).eq('workspace_id', wsUuid);
        } catch {}
        // 6. Delete the account itself
        const { error } = await supabase.from('financial_accounts').delete().eq('id', idToDel).eq('workspace_id', wsUuid);
        if (error && error.code !== 'PGRST116') console.warn('Delete account error from Supabase:', error.message);
      }

      if (accountName && accountName.trim()) {
        await supabase.from('financial_accounts').delete().eq('workspace_id', wsUuid).ilike('name', accountName.trim());
      }
    } catch (err) {
      console.warn('Delete account error:', err);
    }
  }

  async deleteLoan(loanId: string, workspaceId: string) {
    if (!this.isAvailable()) return;
    const loanUuid = toUuid(loanId);
    const wsUuid = toUuid(workspaceId);
    try {
      await supabase.from('loan_payments').delete().eq('loan_id', loanUuid);
      const { error } = await supabase.from('loans').delete().eq('id', loanUuid).eq('workspace_id', wsUuid);
      if (error) console.error('Delete loan error from Supabase:', error);
    } catch (err) {
      console.warn('Delete loan error:', err);
    }
  }

  async deleteProperty(propertyId: string, workspaceId: string) {
    if (!this.isAvailable()) return;
    const propUuid = toUuid(propertyId);
    const wsUuid = toUuid(workspaceId);
    try {
      await supabase.from('property_recoveries').delete().eq('property_id', propUuid);
      await supabase.from('property_valuations').delete().eq('property_id', propUuid);
      await supabase.from('property_owners').delete().eq('property_id', propUuid);
      const { error } = await supabase.from('properties').delete().eq('id', propUuid).eq('workspace_id', wsUuid);
      if (error) console.error('Delete property error from Supabase:', error);
    } catch (err) {
      console.warn('Delete property error:', err);
    }
  }

  async deleteBudget(budgetId: string, workspaceId: string) {
    if (!this.isAvailable()) return;
    const budgetUuid = toUuid(budgetId);
    const wsUuid = toUuid(workspaceId);
    try {
      const { error } = await supabase.from('budgets').delete().eq('id', budgetUuid).eq('workspace_id', wsUuid);
      if (error) console.error('Delete budget error from Supabase:', error);
    } catch (err) {
      console.warn('Delete budget error:', err);
    }
  }

  async deleteSavingsGoal(goalId: string, workspaceId: string) {
    if (!this.isAvailable()) return;
    const goalUuid = toUuid(goalId);
    const wsUuid = toUuid(workspaceId);
    try {
      const { error } = await supabase.from('savings_goals').delete().eq('id', goalUuid).eq('workspace_id', wsUuid);
      if (error) console.error('Delete savings goal error from Supabase:', error);
    } catch (err) {
      console.warn('Delete savings goal error:', err);
    }
  }

  async deleteCategory(categoryId: string, workspaceId: string, categoryName?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable()) return { success: true };
    const catUuid = toUuid(categoryId);
    const wsUuid = toUuid(workspaceId);
    try {
      let idsToDelete: string[] = [catUuid];
      if (categoryName && categoryName.trim()) {
        const { data: matches } = await supabase
          .from('categories')
          .select('id')
          .ilike('name', categoryName.trim());
        if (matches && matches.length > 0) {
          idsToDelete = Array.from(new Set([...idsToDelete, ...matches.map(m => m.id)]));
        }
      }

      for (const idToDel of idsToDelete) {
        // 1. Delete child subcategories
        try {
          await supabase.from('categories').delete().eq('parent_id', idToDel);
        } catch {}
        // 2. Unlink category_id on journal lines so foreign key constraint 23503 is satisfied
        try {
          await supabase.from('journal_lines').update({ category_id: null }).eq('category_id', idToDel);
        } catch {}
        // 3. Delete any budgets associated with this category
        try {
          await supabase.from('budgets').delete().eq('category_id', idToDel);
        } catch {}
        // 4. Unlink category_id on recurring rules
        try {
          await supabase.from('recurring_rules').update({ category_id: null }).eq('category_id', idToDel);
        } catch {}
        // 5. Delete category
        const { error } = await supabase.from('categories').delete().eq('id', idToDel);
        if (error && error.code !== 'PGRST116') {
          console.warn('Delete category notice:', error.message);
        }
      }

      if (categoryName && categoryName.trim()) {
        await supabase.from('categories').delete().eq('workspace_id', wsUuid).ilike('name', categoryName.trim());
      }
      return { success: true };
    } catch (err: any) {
      console.warn('Delete category notice:', err);
      return { success: false, error: err.message };
    }
  }

  async deleteRecurringRule(ruleId: string, workspaceId: string) {
    if (!this.isAvailable()) return;
    const ruleUuid = toUuid(ruleId);
    const wsUuid = toUuid(workspaceId);
    try {
      await supabase.from('recurring_executions').delete().eq('recurring_rule_id', ruleUuid);
      const { error } = await supabase.from('recurring_rules').delete().eq('id', ruleUuid).eq('workspace_id', wsUuid);
      if (error) console.error('Delete recurring rule error from Supabase:', error);
    } catch (err) {
      console.warn('Delete recurring rule error:', err);
    }
  }
}

export const supabaseSync = new SupabaseSyncEngine();
