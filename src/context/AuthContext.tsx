import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, StaffGroup } from '../types';
import { formatStandardRoleName } from '../utils/roleFormat';

export interface UserAccount extends User {
  passwordHash: string; // Stored password
}

export const DEFAULT_ACCOUNTS: UserAccount[] = [
  {
    id: 'usr-spv-01',
    name: 'Supervisor',
    username: 'supervisor',
    passwordHash: 'spv#wms2026',
    role: 'supervisor',
    department: 'Pergudangan & Logistik',
  },
  {
    id: 'usr-staff-a',
    name: 'Staff Shift Group A',
    username: 'staff_a',
    passwordHash: 'groupA@2026',
    role: 'staff',
    group: 'Group A',
    department: 'Operasional Gudang - Group A',
  },
  {
    id: 'usr-staff-b',
    name: 'Staff Shift Group B',
    username: 'staff_b',
    passwordHash: 'groupB@2026',
    role: 'staff',
    group: 'Group B',
    department: 'Operasional Gudang - Group B',
  },
  {
    id: 'usr-staff-c',
    name: 'Staff Shift Group C',
    username: 'staff_c',
    passwordHash: 'groupC@2026',
    role: 'staff',
    group: 'Group C',
    department: 'Operasional Gudang - Group C',
  },
  {
    id: 'usr-staff-d',
    name: 'Staff Shift Group D',
    username: 'staff_d',
    passwordHash: 'groupD@2026',
    role: 'staff',
    group: 'Group D',
    department: 'Operasional Gudang - Group D',
  },
  {
    id: 'usr-eval-01',
    name: 'Evaluator',
    username: 'evaluator',
    passwordHash: 'eval#stok2026',
    role: 'evaluator',
    department: 'Pengendalian Inventaris & Reorder',
  },
  {
    id: 'usr-rev-01',
    name: 'Reviewer',
    username: 'reviewer',
    passwordHash: 'review#2026',
    role: 'reviewer',
    department: 'Auditor & Tinjauan Inventaris',
  },
];

export const DEMO_USERS: Record<string, User> = {
  supervisor: DEFAULT_ACCOUNTS[0],
  staff_a: DEFAULT_ACCOUNTS[1],
  staff_b: DEFAULT_ACCOUNTS[2],
  staff_c: DEFAULT_ACCOUNTS[3],
  staff_d: DEFAULT_ACCOUNTS[4],
  staff: DEFAULT_ACCOUNTS[1],
  evaluator: DEFAULT_ACCOUNTS[5],
  reviewer: DEFAULT_ACCOUNTS[6],
  admin: DEFAULT_ACCOUNTS[0], // backward compatibility mapping to supervisor
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean; // mapped to isSupervisor for full administrative rights
  isSupervisor: boolean;
  isStaff: boolean;
  isEvaluator: boolean;
  isReviewer: boolean;
  canManageOutbound: boolean;
  canEditLowStockStatus: boolean;
  canEditItems: boolean;
  canDeleteItems: boolean;
  canCreateTransactions: boolean;
  canStockOpname: boolean;
  canEditTransactions: boolean;
  canDeleteTransactions: boolean;
  loginAs: (roleOrKey: string) => void;
  loginWithCredentials: (username: string, password: string) => { success: boolean; message?: string };
  logout: () => void;
  accounts: UserAccount[];
  addUserAccount: (newAccount: Omit<UserAccount, 'id'>) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'warehouse_session_user';
const ACCOUNTS_STORAGE_KEY = 'warehouse_user_accounts_v10';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      if (saved) {
        const parsed: UserAccount[] = JSON.parse(saved);
        const map = new Map<string, UserAccount>();
        for (const acc of DEFAULT_ACCOUNTS) {
          map.set(acc.username.toLowerCase(), acc);
        }
        for (const acc of parsed) {
          if (acc.username.toLowerCase() !== 'admin') {
            const sanitized: UserAccount = {
              ...acc,
              name: formatStandardRoleName(acc.name || acc.role),
            };
            delete (sanitized as any).avatar;
            map.set(sanitized.username.toLowerCase(), sanitized);
          }
        }
        return Array.from(map.values());
      }
    } catch {
      // Fallback
    }
    return DEFAULT_ACCOUNTS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.role === 'admin' || parsed.username === 'admin') {
          const spv = DEFAULT_ACCOUNTS[0];
          const { passwordHash, ...userProfile } = spv;
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userProfile));
          return userProfile;
        }
        parsed.name = formatStandardRoleName(parsed.name || parsed.role);
        delete parsed.avatar;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      }
    } catch {
      // Fallback
    }
    return null;
  });

  // Listen for storage changes from other tabs or direct events
  useEffect(() => {
    const handleAuthEvent = (e: CustomEvent) => {
      if (e.detail) {
        const sanitized = { ...e.detail, name: formatStandardRoleName(e.detail.name || e.detail.role) };
        delete (sanitized as any).avatar;
        setCurrentUser(sanitized);
      }
    };
    window.addEventListener('wms_auth_changed' as any, handleAuthEvent);
    return () => window.removeEventListener('wms_auth_changed' as any, handleAuthEvent);
  }, []);

  const loginWithCredentials = (usernameInput: string, passwordInput: string): { success: boolean; message?: string } => {
    const rawUser = usernameInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    if (!rawUser || !cleanPass) {
      return { success: false, message: 'Harap masukkan username dan kata sandi.' };
    }

    // Normalized username mapping for effortless typing
    let normalizedUsername = rawUser;
    if (rawUser === 'spv' || rawUser === 'spv_pengeluaran' || rawUser === 'admin') {
      normalizedUsername = 'supervisor';
    } else if (rawUser === 'staff a' || rawUser === 'shift_a' || rawUser === 'shift a' || rawUser === 'group a' || rawUser === 'group_a') {
      normalizedUsername = 'staff_a';
    } else if (rawUser === 'staff b' || rawUser === 'shift_b' || rawUser === 'shift b' || rawUser === 'group b' || rawUser === 'group_b') {
      normalizedUsername = 'staff_b';
    } else if (rawUser === 'staff c' || rawUser === 'shift_c' || rawUser === 'shift c' || rawUser === 'group c' || rawUser === 'group_c') {
      normalizedUsername = 'staff_c';
    } else if (rawUser === 'staff d' || rawUser === 'shift_d' || rawUser === 'shift d' || rawUser === 'group d' || rawUser === 'group_d') {
      normalizedUsername = 'staff_d';
    } else if (rawUser === 'staff') {
      normalizedUsername = 'staff_a';
    }

    // Specific password matching per account role and staff group
    const matched = accounts.find((acc) => {
      const matchName = acc.username.toLowerCase() === normalizedUsername;
      if (!matchName) return false;

      if (normalizedUsername === 'supervisor') {
        return cleanPass === acc.passwordHash || cleanPass === 'spv#wms2026' || cleanPass === 'spv123' || cleanPass === 'supervisor123';
      }
      if (normalizedUsername === 'reviewer') {
        return cleanPass === acc.passwordHash || cleanPass === 'review#2026' || cleanPass === 'reviewer123' || cleanPass === 'password';
      }
      if (normalizedUsername === 'evaluator') {
        return cleanPass === acc.passwordHash || cleanPass === 'eval#stok2026' || cleanPass === 'evaluator123';
      }
      if (normalizedUsername === 'staff_a') {
        return cleanPass === acc.passwordHash || cleanPass === 'groupA@2026' || cleanPass === 'groupa2026' || cleanPass === 'staffA123';
      }
      if (normalizedUsername === 'staff_b') {
        return cleanPass === acc.passwordHash || cleanPass === 'groupB@2026' || cleanPass === 'groupb2026' || cleanPass === 'staffB123';
      }
      if (normalizedUsername === 'staff_c') {
        return cleanPass === acc.passwordHash || cleanPass === 'groupC@2026' || cleanPass === 'groupc2026' || cleanPass === 'staffC123';
      }
      if (normalizedUsername === 'staff_d') {
        return cleanPass === acc.passwordHash || cleanPass === 'groupD@2026' || cleanPass === 'groupd2026' || cleanPass === 'staffD123';
      }
      return acc.passwordHash === cleanPass;
    });

    if (matched) {
      const { passwordHash, ...rawProfile } = matched;
      const userProfile: User = {
        ...rawProfile,
        name: formatStandardRoleName(rawProfile.name || rawProfile.role),
      };
      delete (userProfile as any).avatar;
      setCurrentUser(userProfile);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userProfile));
      } catch {
        // Ignore
      }
      // Notify window for instant zero-refresh transition
      window.dispatchEvent(new CustomEvent('wms_auth_changed', { detail: userProfile }));
      return { success: true };
    }

    return { 
      success: false, 
      message: 'Username atau kata sandi tidak cocok. Silakan periksa kembali akun yang Anda masukkan.' 
    };
  };

  const loginAs = (roleOrKey: string) => {
    let target = DEMO_USERS[roleOrKey];
    if (!target) {
      const found = accounts.find((a) => a.username.toLowerCase() === roleOrKey.toLowerCase() || a.role === roleOrKey);
      if (found) {
        const { passwordHash, ...userProfile } = found;
        target = userProfile;
      } else {
        target = DEFAULT_ACCOUNTS[0];
      }
    }
    const sanitizedTarget: User = {
      ...target,
      name: formatStandardRoleName(target.name || target.role),
    };
    delete (sanitizedTarget as any).avatar;
    setCurrentUser(sanitizedTarget);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sanitizedTarget));
    } catch {
      // Ignore
    }
    window.dispatchEvent(new CustomEvent('wms_auth_changed', { detail: sanitizedTarget }));
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore
    }
    window.dispatchEvent(new CustomEvent('wms_auth_changed', { detail: null }));
  };

  const addUserAccount = (newAcc: Omit<UserAccount, 'id'>): boolean => {
    const exists = accounts.some((a) => a.username.toLowerCase() === newAcc.username.toLowerCase().trim());
    if (exists) return false;

    const created: UserAccount = {
      ...newAcc,
      id: `usr-${Date.now()}`,
      username: newAcc.username.toLowerCase().trim(),
    };

    const next = [...accounts, created];
    setAccounts(next);
    try {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
    return true;
  };

  const isSupervisorUser = currentUser?.role === 'supervisor';
  const isStaffUser = currentUser?.role === 'staff';
  const isEvaluatorUser = currentUser?.role === 'evaluator';
  const isReviewerUser = currentUser?.role === 'reviewer';

  const value: AuthContextType = {
    user: currentUser,
    isAuthenticated: !!currentUser,
    // Admin capabilities are now fully held by Supervisor
    isAdmin: isSupervisorUser,
    isSupervisor: isSupervisorUser,
    isStaff: isStaffUser,
    isEvaluator: isEvaluatorUser,
    isReviewer: isReviewerUser,
    canManageOutbound: isSupervisorUser,
    canEditLowStockStatus: isEvaluatorUser || isSupervisorUser,
    // Role Reviewer: Read-Only. Cannot add, edit, delete, create transaction, or stock opname.
    canEditItems: !isReviewerUser,
    canDeleteItems: isSupervisorUser,
    canCreateTransactions: !isReviewerUser,
    canStockOpname: !isReviewerUser,
    // Edit history allowed for all except Reviewer; Delete history Supervisor only
    canEditTransactions: !isReviewerUser,
    canDeleteTransactions: isSupervisorUser,
    loginAs,
    loginWithCredentials,
    logout,
    accounts,
    addUserAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
