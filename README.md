# POWER OF MONEY

**A Modern, Secure, Customizable Personal & Family Financial Management Operating System**

Power of Money is built on immutable double-entry accounting ($\sum \text{Debits} = \sum \text{Credits}$), multi-tenant family workspace collaboration, real estate share partitions (including Khara and Ana notations), credit card liability tracking, and server-side Gemini AI receipt scanning.

---

## 1. Key Capabilities & Architectural Highlights

- **Double-Entry Accounting Engine**: Every transaction enforces mathematical debit-credit balance. Balances are derived directly from journal entries with atomic cached synchronization.
- **Strict Financial Integrity**:
  - **Credit Card Settlements**: Debits credit card liability and credits bank asset; *never recorded as a double expense*.
  - **Borrowed Money**: Inflow credits a loan payable liability; *never treated as earned income*.
  - **Loan Principal Repayments**: Debits loan payable; *only the interest portion is recognized as a financing expense*.
  - **Money Lent (Receivables)**: Creates an asset receivable; borrower returns reduce the receivable without generating fake income.
  - **Property Recoveries**: Reduce the property recovery receivable without inflating operating income.
- **The 36 Customizable Seed Categories**: Safe idempotent seeding of all 36 user-specified categories (*Home Expense, Wifi, Electricity, Personal Food, Mess Bill, Protein Target, etc.*) while retaining full user editability, archiving, and customization.
- **Complex Property & Asset Register**: Preserves exact original size notations verbatim (*"75 Khara", "20/4 Khara", "100–150 Khara", "N/A"*) and fractional ownership shares (*"6 Ana", "3 Share", "Mass Share", "50%"*) without converting unknown values to zero.
- **Family Workspace Collaboration**: Complete tenant isolation. Family members invited to a shared household workspace can never access each other's private personal workspaces.
- **Server-Side Gemini AI Receipt OCR**: Upload any receipt or utility bill. Gemini 3.8 Flash extracts the merchant, date, amount (in ৳ / BDT), and suggests categories. The user explicitly reviews and confirms before any ledger posting.

---

## 2. Directory Structure

```text
├── docs/
│   └── DATABASE_ARCHITECTURE.md       # ER diagram in Mermaid, dictionary, and accounting rules
├── src/
│   ├── components/
│   │   ├── accounts/AccountsView.tsx            # Bank, cash, bKash, Nagad, Rocket, Upay accounts
│   │   ├── ai/AiAssistantView.tsx               # Gemini receipt OCR & Financial Health Advisor
│   │   ├── budgets/BudgetsView.tsx              # Monthly category spending limits & alerts
│   │   ├── cards/CreditCardsView.tsx            # Card limits, available credit, statements
│   │   ├── dashboard/ExecutiveDashboard.tsx     # Net worth, liquid cash, monthly cash flow
│   │   ├── family/FamilyWorkspaceView.tsx       # RBAC memberships & module permissions
│   │   ├── layout/Header.tsx                    # Top bar contract header with quick actions
│   │   ├── layout/Sidebar.tsx                   # Multi-workspace switcher & navigation
│   │   ├── ledger/LedgerView.tsx                # Double-entry ledger with audit reversals
│   │   ├── loans/LoansView.tsx                  # Money borrowed (debt) vs money lent (receivable)
│   │   ├── modals/NewTransactionModal.tsx       # Balanced double-entry transaction modal
│   │   ├── properties/PropertyRegisterView.tsx  # Khara/Ana land register & recovery tracking
│   │   ├── recurring/RecurringBillsView.tsx     # Idempotent recurring utility bill schedules
│   │   ├── reports/ReportBuilderView.tsx        # Net worth statement, cash flow & CSV export
│   │   ├── savings/SavingsGoalsView.tsx         # DPS installment plans & milestones
│   │   ├── settings/SettingsView.tsx            # Category manager & Supabase migration helper
│   │   └── setup/OpeningBalanceWizard.tsx       # Fresh start baseline wizard & opening equity
│   ├── context/
│   │   └── WorkspaceContext.tsx                 # Workspace state, BDT currency, and RBAC
│   ├── lib/
│   │   └── supabase.ts                          # Supabase client & connectivity inspector
│   ├── services/
│   │   └── db.ts                                # Double-entry ledger engine & local storage
│   ├── types/
│   │   └── index.ts                             # Comprehensive TypeScript type definitions
│   ├── App.tsx                                  # Application root orchestrator
│   ├── index.css                                # Tailwind CSS v4 styling & dark mode setup
│   └── main.tsx                                 # React root entry point
├── supabase/
│   └── migrations/
│       ├── 20261031000001_core_schema.sql
│       ├── 20261031000002_accounting_ledger.sql
│       ├── 20261031000003_banking_cards_loans.sql
│       ├── 20261031000004_property_register.sql
│       ├── 20261031000005_budgets_savings_recurring.sql
│       ├── 20261031000006_accounting_functions_and_rpc.sql
│       ├── 20261031000007_rls_and_storage_policies.sql
│       └── 20261031000008_security_and_integrity_tests.sql
├── server.ts                                    # Full-stack Express server with Gemini API routes
├── package.json
└── vite.config.ts
```

---

## 3. Database Migrations Execution Guide (Supabase)

To deploy the schema to your Supabase PostgreSQL project:

1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Run each migration file from `/supabase/migrations/` in exact sequential order:
   - `20261031000001_core_schema.sql` (Profiles, workspaces, memberships, invitations, audit logs)
   - `20261031000002_accounting_ledger.sql` (Account types, financial accounts, journal entries, balance views)
   - `20261031000003_banking_cards_loans.sql` (Credit cards, card statements, loans, receivables)
   - `20261031000004_property_register.sql` (Properties, Khara, Ana, valuations, recoveries)
   - `20261031000005_budgets_savings_recurring.sql` (Categories, budgets, DPS goals, recurring rules)
   - `20261031000006_accounting_functions_and_rpc.sql` (Double-entry posting RPC, transfer RPC, reversal RPC, and 36 seed categories function)
   - `20261031000007_rls_and_storage_policies.sql` (Row Level Security on all tables, secure storage vault)
   - `20261031000008_security_and_integrity_tests.sql` (Executes the 10 automated test cases proving tenant isolation and accounting rules)
3. Confirm that all test cases in migration 8 pass with notice `ALL 10 FINANCIAL & SECURITY TESTS PASSED PERFECTLY!`.

---

## 4. Environment Variables Configuration

Copy `.env.example` to `.env`:

```bash
# Gemini API Key (accessed securely on server-side)
GEMINI_API_KEY="your-gemini-api-key"

# Supabase PostgreSQL Configuration
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

*Note: The Supabase Service-Role key is NEVER placed in frontend code or shared.*

---

## 5. Development & Production Commands

```bash
# Start full-stack development server (Express backend + Vite HMR frontend)
npm run dev

# Run TypeScript compile validation
npm run lint

# Build production bundle
npm run build

# Start production server
npm start
```
