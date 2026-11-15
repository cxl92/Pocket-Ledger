# Security Specification — Pocket Ledger

## 1. Data Invariants
1. **Strict Owner Isolation**: Every document under `/users/{userId}`, `/users/{userId}/accounts/{accountId}`, and `/users/{userId}/transactions/{transactionId}` belongs exclusively to the verified user whose `request.auth.uid == userId` and `ownerId == request.auth.uid`.
2. **Email Verification Mandate**: All authenticated reads and writes require `request.auth.token.email_verified == true`.
3. **Parent Master Gate**: No account or transaction document can be created unless the parent `/users/{userId}` settings document exists (or is atomically created in the same batch via `existsAfter`).
4. **Transaction Integrity**:
   - `type` must be one of `'expense'`, `'income'`, or `'transfer'`.
   - `amount` must be strictly greater than `0` and bounded (`<= 1,000,000,000`).
   - `date` must match `YYYY-MM-DD`.
   - When `type == 'transfer'`, `to` must be a valid account ID and `to != acc`.
5. **Temporal & Identity Immutability**: `ownerId` and `createdAt` are immutable after creation; `createdAt` (on create) and `updatedAt` (on create/update) must equal `request.time`.
6. **Size & Schema Containment**: All document keys are strictly checked with `hasAll()` and `hasOnly()`. All strings and category lists enforce `.size()` bounds to prevent resource exhaustion.

## 2. The "Dirty Dozen" Adversarial Payloads
All 12 payloads below MUST result in `PERMISSION_DENIED`:
1. **Cross-user Read/Write**: User A attempts to read or create `/users/{userB}/transactions/tx1`.
2. **Unverified Email**: Authenticated user with `email_verified: false` attempts to write `/users/{userA}`.
3. **Shadow / Ghost Field Injection**: User A creates a transaction containing an extra key `isAdmin: true` or `verified: true`.
4. **Owner Spoofing**: User A creates an account under `/users/{userA}/accounts/acc1` with `ownerId: "userB"`.
5. **Immutable Field Mutation**: User A updates a transaction and attempts to alter `ownerId` or `createdAt`.
6. **Client-Forged Timestamp**: User A creates or updates a document with a backdated `createdAt` or `updatedAt` != `request.time`.
7. **Self-Transfer Bypass**: User A creates a `transfer` transaction where `acc == to`.
8. **Negative or Zero Amount**: User A creates an `expense` transaction with `amount: -50` or `amount: 0`.
9. **ID Poisoning**: User A attempts to create a transaction with a 1,500-character ID or invalid characters (`../evil`).
10. **Oversized Note / String Exhaustion**: User A creates a transaction with a 10,000-character `note`.
11. **Invalid Date Format**: User A creates a transaction with `date: "15/11/2026"` instead of `YYYY-MM-DD`.
12. **Blanket List Query Scraping**: User A attempts `collection(db, 'users/userB/transactions')` without matching `ownerId == request.auth.uid`.
