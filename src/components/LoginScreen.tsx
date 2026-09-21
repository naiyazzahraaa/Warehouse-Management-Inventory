import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ShieldCheck, 
  Lock, 
  User as UserIcon, 
  KeyRound, 
  Boxes, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  QrCode, 
  ArrowRight, 
  Warehouse, 
  Info,
  Sparkles,
  ClipboardList,
  Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { isAuthenticated, loginWithCredentials } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, seamlessly redirect to dashboard via SPA router
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname;
      const target = from && from !== '/' && from !== '/login' ? from : '/dashboard';
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const res = loginWithCredentials(username, password);
    if (!res.success) {
      setIsLoading(false);
      setError(res.message || 'Username atau kata sandi tidak valid.');
    } else {
      // Successful login: Instant Single Page Application navigation (no full page reload)
      if (onLoginSuccess) {
        onLoginSuccess();
      }
      setIsLoading(false);
      const from = (location.state as any)?.from?.pathname;
      const target = from && from !== '/' && from !== '/login' ? from : '/dashboard';
      navigate(target, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-all duration-300">
      
      {/* Ambient background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(#64748b_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Branding */}
      <div className="relative z-10 max-w-5xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0A192F] flex items-center justify-center text-white shadow-md">
            <Warehouse className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-slate-900 block">
              Warehouse Management Inventory
            </span>
            <span className="text-[10px] text-slate-600 font-semibold tracking-wide">
              Warehouse Bin Card & QR Management System
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-700 font-mono bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Sistem Siap</span>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="relative z-10 max-w-md w-full mx-auto my-auto py-6">
        <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden animate-fadeIn">
          
          {/* Card Header */}
          <div className="p-6 sm:p-7 bg-[#0A192F] text-white text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-white mx-auto flex items-center justify-center border border-blue-400/30 mb-3">
              <Lock className="w-6 h-6 text-blue-300" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Warehouse Management Inventory
            </h1>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="p-6 sm:p-7 space-y-4">
            
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1.5 uppercase tracking-wider">
                Username Akun
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Kata Sandi (Password)
                </label>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1 rounded"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <span>Memverifikasi...</span>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>

        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center py-2 text-xs text-slate-600 font-bold">
        Warehouse Management System • Hak Cipta Terlindungi &copy; {new Date().getFullYear()}
      </div>

    </div>
  );
};
