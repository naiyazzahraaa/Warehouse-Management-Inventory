import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, DEMO_USERS } from '../context/AuthContext';
import { useCloudSync } from '../hooks/useCloudSync';
import { 
  Boxes, 
  QrCode, 
  Scan, 
  ShieldCheck, 
  UserCheck, 
  LogOut, 
  ArrowRightLeft, 
  LayoutDashboard, 
  PackageSearch,
  Cloud,
  RefreshCw,
  WifiOff,
  CheckCircle2
} from 'lucide-react';
import { formatStandardRoleName } from '../utils/roleFormat';

interface NavbarProps {
  activeTab?: 'dashboard' | 'items' | 'transactions';
  setActiveTab?: (tab: 'dashboard' | 'items' | 'transactions') => void;
  onOpenScanner: () => void;
  onOpenLoginModal: () => void;
  onOpenSyncGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab: propActiveTab,
  setActiveTab,
  onOpenScanner,
  onOpenLoginModal,
  onOpenSyncGuide,
}) => {
  const { user, isSupervisor, isEvaluator, isStaff, isReviewer, logout } = useAuth();
  const syncInfo = useCloudSync();
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    if (propActiveTab) return propActiveTab;
    if (location.pathname.startsWith('/items') || location.pathname.startsWith('/bin-card')) return 'items';
    if (location.pathname.startsWith('/transactions')) return 'transactions';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const handleNavigate = (path: string, tab: 'dashboard' | 'items' | 'transactions') => {
    if (setActiveTab) setActiveTab(tab);
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div 
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none shrink-0" 
            onClick={() => handleNavigate('/dashboard', 'dashboard')}
          >
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#0A192F] flex items-center justify-center text-white shadow-sm shrink-0">
              <Boxes className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-extrabold text-slate-950 text-sm sm:text-base tracking-tight whitespace-nowrap leading-tight">
                Warehouse Inventory
              </span>
              <p className="text-[11px] text-slate-700 font-medium leading-tight whitespace-nowrap hidden lg:block">
                Sistem Manajemen Inventaris & Mutasi Stok Gudang
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => handleNavigate('/dashboard', 'dashboard')}
              style={{
                color: activeTab === 'dashboard' ? 'var(--nav-text-active)' : 'var(--nav-text-inactive)',
                backgroundColor: activeTab === 'dashboard' ? 'var(--nav-bg-active)' : 'var(--nav-bg-inactive)'
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="nav-link-text">Dashboard</span>
            </button>
            <button
              onClick={() => handleNavigate('/items', 'items')}
              style={{
                color: activeTab === 'items' ? 'var(--nav-text-active)' : 'var(--nav-text-inactive)',
                backgroundColor: activeTab === 'items' ? 'var(--nav-bg-active)' : 'var(--nav-bg-inactive)'
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer"
            >
              <PackageSearch className="w-4 h-4 shrink-0" />
              <span className="nav-link-text">Manajemen Barang</span>
            </button>
            <button
              onClick={() => handleNavigate('/transactions', 'transactions')}
              style={{
                color: activeTab === 'transactions' ? 'var(--nav-text-active)' : 'var(--nav-text-inactive)',
                backgroundColor: activeTab === 'transactions' ? 'var(--nav-bg-active)' : 'var(--nav-bg-inactive)'
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4 shrink-0" />
              <span className="nav-link-text">Riwayat Mutasi</span>
            </button>
          </nav>

          {/* Action Center: QR Scanner Button & User Role Info */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Real-time Cloud Sync & Multi-Device Button */}
            <button
              onClick={onOpenSyncGuide}
              style={{
                backgroundColor: syncInfo.status === 'synced' ? 'var(--nav-sync-bg)' : undefined,
                color: syncInfo.status === 'synced' ? 'var(--nav-sync-text)' : undefined,
                borderColor: syncInfo.status === 'synced' ? 'var(--nav-sync-border)' : undefined,
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                syncInfo.status === 'synced'
                  ? 'hover:opacity-95'
                  : syncInfo.status === 'syncing' || syncInfo.status === 'connecting'
                  ? 'bg-amber-50 text-amber-950 border-amber-400 hover:bg-amber-100'
                  : 'bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200'
              }`}
              title="Status Sinkronisasi Cloud Multi-Perangkat (Firebase)"
            >
              {syncInfo.status === 'synced' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 hidden sm:inline" />
                  <span className="text-[11px] sm:text-xs">Cloud Sync</span>
                </>
              ) : syncInfo.status === 'syncing' || syncInfo.status === 'connecting' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                  <span className="text-[11px] sm:text-xs">Menyinkronkan</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] sm:text-xs">Offline</span>
                </>
              )}
            </button>

            {/* Quick Scan QR Button */}
            <button
              id="navbar-scan-btn"
              onClick={onOpenScanner}
              style={{
                backgroundColor: 'var(--nav-scan-bg)',
                color: 'var(--nav-scan-text)'
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm font-bold rounded-lg shadow-sm shadow-emerald-200 hover:opacity-90 transition-all active:scale-95 cursor-pointer border border-emerald-500/20"
              title="Pindai QR Code Kartu Barang"
            >
              <Scan className="w-4 h-4 animate-pulse" />
              <span className="font-semibold">Scan QR</span>
            </button>

            {/* User Profile / Status (Role Only) */}
            {user ? (
              <div className="flex items-center gap-2 pl-1 sm:px-2 border-l border-slate-200">
                <button
                  type="button"
                  onClick={onOpenLoginModal}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-all bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200/80 text-left"
                  title="Klik untuk ganti akun atau role"
                >
                  <ShieldCheck className={`w-4 h-4 shrink-0 ${
                    isSupervisor
                      ? 'text-blue-700'
                      : isReviewer
                      ? 'text-amber-700'
                      : isEvaluator
                      ? 'text-purple-700'
                      : 'text-emerald-700'
                  }`} />
                  <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
                    isSupervisor
                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                      : isReviewer
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : isEvaluator
                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}>
                    {formatStandardRoleName(user.name || user.role)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Keluar (Logout)"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLoginModal}
                className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                Masuk / Login
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
