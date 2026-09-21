import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, PackageSearch, Scan, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface MobileBottomNavProps {
  activeTab?: 'dashboard' | 'items' | 'transactions';
  setActiveTab?: (tab: 'dashboard' | 'items' | 'transactions') => void;
  onOpenScanner: () => void;
  onOpenLoginModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab: propActiveTab,
  setActiveTab,
  onOpenScanner,
  onOpenLoginModal,
}) => {
  const { user } = useAuth();
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

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1 shadow-lg mobile-bottom-nav"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.25rem)' }}
    >
      <div className="flex items-center justify-around">
        
        {/* Dashboard Tab */}
        <button
          onClick={() => handleNavigate('/dashboard', 'dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'dashboard' ? 'text-[#1E3A8A] font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Home</span>
        </button>

        {/* Items Tab */}
        <button
          onClick={() => handleNavigate('/items', 'items')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'items' ? 'text-[#1E3A8A] font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <PackageSearch className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Barang</span>
        </button>

        {/* Elevated Scan QR Button for Mobile Field Workers */}
        <div className="relative -top-5">
          <button
            onClick={onOpenScanner}
            className="w-14 h-14 rounded-full bg-[#1E3A8A] hover:bg-blue-900 text-white flex flex-col items-center justify-center shadow-lg border-4 border-white active:scale-95 transition-transform cursor-pointer"
            aria-label="Scan QR Code"
          >
            <Scan className="w-6 h-6" />
            <span className="text-[9px] font-bold tracking-tight">SCAN</span>
          </button>
        </div>

        {/* Transactions Tab */}
        <button
          onClick={() => handleNavigate('/transactions', 'transactions')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'transactions' ? 'text-[#1E3A8A] font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <ArrowRightLeft className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Mutasi</span>
        </button>

        {/* User Account / Profile Info (Strictly Role-Based) */}
        <button
          onClick={onOpenLoginModal}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-lg text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          title="Lihat Info Akun & Keluar"
        >
          <ShieldCheck className="w-5 h-5 text-[#1E3A8A]" />
          <span className="text-[10px] font-medium mt-0.5 truncate max-w-[70px]">
            {user
              ? user.role === 'supervisor'
                ? 'Supervisor'
                : user.role === 'evaluator'
                ? 'Evaluator'
                : user.group
                ? user.group
                : 'Staff'
              : 'Akun'}
          </span>
        </button>

      </div>
    </div>
  );
};
