import { useCallback, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import type {
  Account,
  AccountCategory,
  LedgerSettings,
  Transaction,
} from '../types/ledger';
import {
  createDefaultAccounts,
  createDefaultSettings,
  inferAccountCategory,
  isAccountCategory,
  newId,
  sanitizeId,
} from '../utils/ledger';

const LOCAL_KEY = 'pocket-ledger-v2';
const LEGACY_LOCAL_KEY = 'pocket-ledger-v1';

interface LocalSnapshot {
  settings: LedgerSettings;
  accounts: Account[];
  transactions: Transaction[];
}

function loadLocalSnapshot(): LocalSnapshot {
  try {
    const rawV2 = localStorage.getItem(LOCAL_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<LocalSnapshot>;
      return {
        settings: parsed.settings?.currency
          ? {
              currency: String(parsed.settings.currency).slice(0, 6) || 'RM',
              expenseCategories: parsed.settings.expenseCategories?.length
                ? parsed.settings.expenseCategories
                : createDefaultSettings().expenseCategories,
              incomeCategories: parsed.settings.incomeCategories?.length
                ? parsed.settings.incomeCategories
                : createDefaultSettings().incomeCategories,
            }
          : createDefaultSettings(),
        accounts:
          Array.isArray(parsed.accounts) && parsed.accounts.length > 0
            ? parsed.accounts.map((a, idx) => ({
                id: sanitizeId(a.id, 'a'),
                name: String(a.name).slice(0, 30),
                opening: Number(a.opening) || 0,
                category: isAccountCategory(a.category)
                  ? a.category
                  : inferAccountCategory(a.name),
                sortOrder: Number.isFinite(a.sortOrder) ? a.sortOrder : idx,
              }))
            : createDefaultAccounts(),
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      };
    }

    const rawV1 = localStorage.getItem(LEGACY_LOCAL_KEY);
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as {
        settings?: {
          currency?: string;
          accounts?: { id: string; name: string; opening?: number }[];
          cats?: { expense?: string[]; income?: string[] };
        };
        tx?: Transaction[];
      };
      const def = createDefaultSettings();
      return {
        settings: {
          currency: parsed.settings?.currency?.slice(0, 6) || def.currency,
          expenseCategories: parsed.settings?.cats?.expense?.length
            ? parsed.settings.cats.expense
            : def.expenseCategories,
          incomeCategories: parsed.settings?.cats?.income?.length
            ? parsed.settings.cats.income
            : def.incomeCategories,
        },
        accounts: parsed.settings?.accounts?.length
          ? parsed.settings.accounts.map((a, idx) => ({
              id: sanitizeId(a.id, 'a'),
              name: String(a.name).slice(0, 30),
              opening: Number(a.opening) || 0,
              category: inferAccountCategory(String(a.name)),
              sortOrder: idx,
            }))
          : createDefaultAccounts(),
        transactions: Array.isArray(parsed.tx) ? parsed.tx : [],
      };
    }
  } catch {
    // ignore corrupted local storage
  }

  return {
    settings: createDefaultSettings(),
    accounts: createDefaultAccounts(),
    transactions: [],
  };
}

function saveLocalSnapshot(snapshot: LocalSnapshot): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage quota errors
  }
}

export function useLedgerStore() {
  const initialLocal = useRef<LocalSnapshot>(loadLocalSnapshot());
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [settings, setSettings] = useState<LedgerSettings>(initialLocal.current.settings);
  const [accounts, setAccounts] = useState<Account[]>(initialLocal.current.accounts);
  const [transactions, setTransactions] = useState<Transaction[]>(
    initialLocal.current.transactions
  );
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [pendingLocalMergeCount, setPendingLocalMergeCount] = useState<number>(0);

  const cloudInitializedRef = useRef(false);

  // Sync local mode changes back to localStorage when signed out
  useEffect(() => {
    if (!user && authReady) {
      saveLocalSnapshot({ settings, accounts, transactions });
    }
  }, [user, authReady, settings, accounts, transactions]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setErrorBanner('');
      if (!nextUser) {
        const local = loadLocalSnapshot();
        setSettings(local.settings);
        setAccounts(local.accounts);
        setTransactions(local.transactions);
        setCloudReady(false);
        setPendingLocalMergeCount(0);
        cloudInitializedRef.current = false;
      }
    });
    return () => unsub();
  }, []);

  // Attach Firestore listeners when authenticated
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    let settingsLoaded = false;
    let accountsLoaded = false;
    let txLoaded = false;

    const markReady = () => {
      if (settingsLoaded && accountsLoaded && txLoaded) {
        setCloudReady(true);
      }
    };

    const userDocRef = doc(db, 'users', uid);
    const unsubSettings = onSnapshot(
      userDocRef,
      async (snap) => {
        if (!snap.exists()) {
          if (!cloudInitializedRef.current) {
            cloudInitializedRef.current = true;
            const local = loadLocalSnapshot();
            const batch = writeBatch(db);
            batch.set(userDocRef, {
              ownerId: uid,
              currency: local.settings.currency.slice(0, 6) || 'RM',
              expenseCategories: local.settings.expenseCategories.slice(0, 60),
              incomeCategories: local.settings.incomeCategories.slice(0, 60),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            local.accounts.forEach((acc, idx) => {
              const accId = sanitizeId(acc.id, 'a');
              batch.set(doc(db, 'users', uid, 'accounts', accId), {
                ownerId: uid,
                name: acc.name.slice(0, 30),
                opening: Number(acc.opening) || 0,
                category: isAccountCategory(acc.category)
                  ? acc.category
                  : inferAccountCategory(acc.name),
                sortOrder: Number.isFinite(acc.sortOrder) ? acc.sortOrder : idx,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            });
            try {
              await batch.commit();
              // Also migrate local transactions in chunks if any exist
              if (local.transactions.length > 0) {
                for (let i = 0; i < local.transactions.length; i += 400) {
                  const txBatch = writeBatch(db);
                  local.transactions.slice(i, i + 400).forEach((t) => {
                    const txId = sanitizeId(t.id, 't');
                    txBatch.set(doc(db, 'users', uid, 'transactions', txId), {
                      ownerId: uid,
                      type: t.type,
                      date: t.date,
                      amount: Math.round(Number(t.amount) * 100) / 100,
                      cat: t.type === 'transfer' ? '' : t.cat.slice(0, 24),
                      acc: sanitizeId(t.acc, 'a'),
                      to: t.type === 'transfer' ? sanitizeId(t.to, 'a') : '',
                      note: t.note.slice(0, 120),
                      ts: Number(t.ts) || Date.now(),
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                    });
                  });
                  await txBatch.commit();
                }
              }
            } catch (err) {
              setErrorBanner('Could not initialize your cloud ledger. Please try again.');
              handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
            }
          }
          return;
        }

        const data = snap.data();
        setSettings({
          currency: String(data.currency || 'RM'),
          expenseCategories: Array.isArray(data.expenseCategories)
            ? data.expenseCategories.map(String)
            : createDefaultSettings().expenseCategories,
          incomeCategories: Array.isArray(data.incomeCategories)
            ? data.incomeCategories.map(String)
            : createDefaultSettings().incomeCategories,
        });
        settingsLoaded = true;
        markReady();
      },
      (err) => {
        setErrorBanner('Unable to read your ledger settings from cloud storage.');
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    );

    const accountsQuery = query(
      collection(db, 'users', uid, 'accounts'),
      where('ownerId', '==', uid)
    );
    const unsubAccounts = onSnapshot(
      accountsQuery,
      (snap) => {
        const list: Account[] = snap.docs
          .map((d) => {
            const data = d.data();
            const name = String(data.name || '');
            return {
              id: d.id,
              name,
              opening: Number(data.opening) || 0,
              category: isAccountCategory(data.category)
                ? data.category
                : inferAccountCategory(name),
              sortOrder: Number(data.sortOrder) || 0,
            };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
        if (list.length > 0) {
          setAccounts(list);
        }
        accountsLoaded = true;
        markReady();
      },
      (err) => {
        setErrorBanner('Unable to sync accounts from cloud storage.');
        handleFirestoreError(err, OperationType.LIST, `users/${uid}/accounts`);
      }
    );

    const txQuery = query(
      collection(db, 'users', uid, 'transactions'),
      where('ownerId', '==', uid)
    );
    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        const list: Transaction[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type as Transaction['type'],
            date: String(data.date || ''),
            amount: Number(data.amount) || 0,
            cat: String(data.cat || ''),
            acc: String(data.acc || ''),
            to: String(data.to || ''),
            note: String(data.note || ''),
            ts: Number(data.ts) || 0,
          };
        });
        setTransactions(list);
        const local = loadLocalSnapshot();
        if (local.transactions.length > 0) {
          const cloudIds = new Set(list.map((t) => t.id));
          const unsynced = local.transactions.filter((t) => !cloudIds.has(t.id));
          setPendingLocalMergeCount(unsynced.length);
        } else {
          setPendingLocalMergeCount(0);
        }
        txLoaded = true;
        markReady();
      },
      (err) => {
        setErrorBanner('Unable to sync transactions from cloud storage.');
        handleFirestoreError(err, OperationType.LIST, `users/${uid}/transactions`);
      }
    );

    return () => {
      unsubSettings();
      unsubAccounts();
      unsubTx();
    };
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    try {
      setErrorBanner('');
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in was cancelled or failed.';
      if (!msg.includes('popup-closed-by-user')) {
        setErrorBanner(msg);
      }
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const updateSettings = useCallback(
    async (partial: Partial<LedgerSettings>) => {
      const next: LedgerSettings = {
        currency: (partial.currency ?? settings.currency).trim().slice(0, 6) || 'RM',
        expenseCategories: (partial.expenseCategories ?? settings.expenseCategories).slice(0, 60),
        incomeCategories: (partial.incomeCategories ?? settings.incomeCategories).slice(0, 60),
      };

      if (!user) {
        setSettings(next);
        return;
      }

      const uid = user.uid;
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (partial.currency !== undefined) payload.currency = next.currency;
      if (partial.expenseCategories !== undefined)
        payload.expenseCategories = next.expenseCategories;
      if (partial.incomeCategories !== undefined)
        payload.incomeCategories = next.incomeCategories;

      try {
        await updateDoc(doc(db, 'users', uid), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
      }
    },
    [user, settings]
  );

  const saveAccount = useCallback(
    async (
      account: Omit<Account, 'id' | 'sortOrder' | 'category'> & {
        id?: string;
        category?: AccountCategory;
        sortOrder?: number;
      }
    ) => {
      const cleanName = account.name.trim().slice(0, 30);
      const opening = Math.round((Number(account.opening) || 0) * 100) / 100;
      const category = isAccountCategory(account.category)
        ? account.category
        : inferAccountCategory(cleanName);
      const isNew = !account.id;
      const id = sanitizeId(account.id || newId('a'), 'a');
      const sortOrder = account.sortOrder ?? accounts.length;

      if (!user) {
        setAccounts((prev) => {
          const exists = prev.some((a) => a.id === id);
          if (exists) {
            return prev.map((a) =>
              a.id === id ? { ...a, name: cleanName, opening, category, sortOrder } : a
            );
          }
          return [...prev, { id, name: cleanName, opening, category, sortOrder }];
        });
        return id;
      }

      const uid = user.uid;
      const path = `users/${uid}/accounts/${id}`;
      try {
        if (isNew) {
          await setDoc(doc(db, 'users', uid, 'accounts', id), {
            ownerId: uid,
            name: cleanName,
            opening,
            category,
            sortOrder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'users', uid, 'accounts', id), {
            name: cleanName,
            opening,
            category,
            sortOrder,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
      }
      return id;
    },
    [user, accounts.length]
  );

  const deleteAccount = useCallback(
    async (accountId: string) => {
      if (!user) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
        return;
      }
      const uid = user.uid;
      const path = `users/${uid}/accounts/${accountId}`;
      try {
        await deleteDoc(doc(db, 'users', uid, 'accounts', accountId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const saveTransaction = useCallback(
    async (tx: Omit<Transaction, 'id'> & { id?: string }) => {
      const isNew = !tx.id;
      const id = sanitizeId(tx.id || newId('t'), 't');
      const cleanTx: Transaction = {
        id,
        type: tx.type,
        date: tx.date,
        amount: Math.round(Number(tx.amount) * 100) / 100,
        cat: tx.type === 'transfer' ? '' : tx.cat.trim().slice(0, 24),
        acc: sanitizeId(tx.acc, 'a'),
        to: tx.type === 'transfer' ? sanitizeId(tx.to, 'a') : '',
        note: tx.note.trim().slice(0, 120),
        ts: tx.ts || Date.now(),
      };

      if (!user) {
        setTransactions((prev) => {
          const idx = prev.findIndex((x) => x.id === id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = cleanTx;
            return copy;
          }
          return [...prev, cleanTx];
        });
        return cleanTx;
      }

      const uid = user.uid;
      const path = `users/${uid}/transactions/${id}`;
      try {
        if (isNew) {
          await setDoc(doc(db, 'users', uid, 'transactions', id), {
            ownerId: uid,
            type: cleanTx.type,
            date: cleanTx.date,
            amount: cleanTx.amount,
            cat: cleanTx.cat,
            acc: cleanTx.acc,
            to: cleanTx.to,
            note: cleanTx.note,
            ts: cleanTx.ts,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'users', uid, 'transactions', id), {
            type: cleanTx.type,
            date: cleanTx.date,
            amount: cleanTx.amount,
            cat: cleanTx.cat,
            acc: cleanTx.acc,
            to: cleanTx.to,
            note: cleanTx.note,
            ts: cleanTx.ts,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
      }
      return cleanTx;
    },
    [user]
  );

  const deleteTransaction = useCallback(
    async (txId: string) => {
      if (!user) {
        setTransactions((prev) => prev.filter((x) => x.id !== txId));
        return;
      }
      const uid = user.uid;
      const path = `users/${uid}/transactions/${txId}`;
      try {
        await deleteDoc(doc(db, 'users', uid, 'transactions', txId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const bulkUpsert = useCallback(
    async (params: {
      nextSettings?: LedgerSettings;
      nextAccounts?: Account[];
      items: Transaction[];
    }) => {
      const { nextSettings, nextAccounts, items } = params;

      if (!user) {
        if (nextSettings) setSettings(nextSettings);
        if (nextAccounts) setAccounts(nextAccounts);
        if (items.length > 0) {
          setTransactions((prev) => {
            const map = new Map(prev.map((t) => [t.id, t]));
            items.forEach((t) => map.set(t.id, t));
            return Array.from(map.values());
          });
        }
        return;
      }

      const uid = user.uid;
      if (nextSettings) {
        await updateSettings(nextSettings);
      }
      if (nextAccounts) {
        const existingMap = new Map(accounts.map((a) => [a.id, a]));
        for (let i = 0; i < nextAccounts.length; i += 400) {
          const batch = writeBatch(db);
          nextAccounts.slice(i, i + 400).forEach((acc, idx) => {
            const accId = sanitizeId(acc.id, 'a');
            const exists = existingMap.has(accId);
            if (exists) {
              batch.update(doc(db, 'users', uid, 'accounts', accId), {
                name: acc.name.slice(0, 30),
                opening: Number(acc.opening) || 0,
                category: isAccountCategory(acc.category)
                  ? acc.category
                  : inferAccountCategory(acc.name),
                sortOrder: Number.isFinite(acc.sortOrder) ? acc.sortOrder : idx,
                updatedAt: serverTimestamp(),
              });
            } else {
              batch.set(doc(db, 'users', uid, 'accounts', accId), {
                ownerId: uid,
                name: acc.name.slice(0, 30),
                opening: Number(acc.opening) || 0,
                category: isAccountCategory(acc.category)
                  ? acc.category
                  : inferAccountCategory(acc.name),
                sortOrder: Number.isFinite(acc.sortOrder) ? acc.sortOrder : idx,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          });
          try {
            await batch.commit();
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${uid}/accounts`);
          }
        }
      }

      const existingTxIds = new Set(transactions.map((t) => t.id));
      for (let i = 0; i < items.length; i += 400) {
        const batch = writeBatch(db);
        items.slice(i, i + 400).forEach((t) => {
          const txId = sanitizeId(t.id, 't');
          const ref = doc(db, 'users', uid, 'transactions', txId);
          if (existingTxIds.has(txId)) {
            batch.update(ref, {
              type: t.type,
              date: t.date,
              amount: Math.round(Number(t.amount) * 100) / 100,
              cat: t.type === 'transfer' ? '' : t.cat.slice(0, 24),
              acc: sanitizeId(t.acc, 'a'),
              to: t.type === 'transfer' ? sanitizeId(t.to, 'a') : '',
              note: t.note.slice(0, 120),
              ts: Number(t.ts) || Date.now(),
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.set(ref, {
              ownerId: uid,
              type: t.type,
              date: t.date,
              amount: Math.round(Number(t.amount) * 100) / 100,
              cat: t.type === 'transfer' ? '' : t.cat.slice(0, 24),
              acc: sanitizeId(t.acc, 'a'),
              to: t.type === 'transfer' ? sanitizeId(t.to, 'a') : '',
              note: t.note.slice(0, 120),
              ts: Number(t.ts) || Date.now(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        });
        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}/transactions`);
        }
      }
    },
    [user, accounts, transactions, updateSettings]
  );

  const clearAllTransactions = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      return;
    }
    const uid = user.uid;
    for (let i = 0; i < transactions.length; i += 400) {
      const batch = writeBatch(db);
      transactions.slice(i, i + 400).forEach((t) => {
        batch.delete(doc(db, 'users', uid, 'transactions', t.id));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/transactions`);
      }
    }
  }, [user, transactions]);

  const mergePendingLocalToCloud = useCallback(async () => {
    if (!user) return 0;
    const local = loadLocalSnapshot();
    const cloudAccMap = new Map(accounts.map((a) => [a.id, a]));
    const missingAccs = local.accounts.filter((a) => !cloudAccMap.has(a.id));
    const cloudTxIds = new Set(transactions.map((t) => t.id));
    const missingTxs = local.transactions.filter((t) => !cloudTxIds.has(t.id));
    await bulkUpsert({
      nextAccounts: missingAccs.length > 0 ? [...accounts, ...missingAccs] : undefined,
      items: missingTxs,
    });
    setPendingLocalMergeCount(0);
    return missingTxs.length;
  }, [user, accounts, transactions, bulkUpsert]);

  return {
    user,
    authReady,
    ready: authReady && (!user || cloudReady),
    isCloud: Boolean(user),
    settings,
    accounts,
    transactions,
    errorBanner,
    pendingLocalMergeCount,
    signInWithGoogle,
    signOutUser,
    updateSettings,
    saveAccount,
    deleteAccount,
    saveTransaction,
    deleteTransaction,
    bulkUpsert,
    clearAllTransactions,
    mergePendingLocalToCloud,
  };
}
