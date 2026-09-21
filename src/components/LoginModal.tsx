import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, KeyRound, LogOut, ShieldCheck, ClipboardCheck, Users, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatStandardRoleName } from '../utils/roleFormat';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { user, isAdmin, isSupervisor, isEvaluator, loginWithCredentials, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Masukkan username akun');
      return;
    }
    const res = loginWithCredentials(username, password);
    if (res.success) {
      setError(null);
      onClose();
    } else {
      setError(res.message || 'Username atau password salah.');
    }
  };

  const currentRoleName = user ? formatStandardRoleName(user.name || user.role) : '';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-300">
        
        {/* Header - High Contrast Dark Header */}
        <div className="bg-[#0A192F] text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight text-white">Autentikasi Akun</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup modal"
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          
          {/* Active User Details Card - Strictly Pure Role Name & Icon (No avatar, no handle) */}
          {user ? (
            <div className="p-4 rounded-xl bg-slate-100/90 border-2 border-slate-300 space-y-3">
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs shrink-0 ${
                  isEvaluator
                    ? 'bg-purple-100 text-purple-800 border-2 border-purple-300'
                    : isSupervisor || isAdmin
                    ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                    : 'bg-emerald-100 text-emerald-800 border-2 border-emerald-300'
                }`}>
                  {isEvaluator ? (
                    <ClipboardCheck className="w-6 h-6 text-purple-700" />
                  ) : isSupervisor || isAdmin ? (
                    <ShieldCheck className="w-6 h-6 text-blue-700" />
                  ) : (
                    <Users className="w-6 h-6 text-emerald-700" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-slate-900 truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {currentRoleName}
                    </span>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                      isEvaluator ? 'bg-purple-100 text-purple-900 border-purple-300' :
                      isSupervisor || isAdmin ? 'bg-blue-100 text-blue-900 border-blue-300' :
                      'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}>
                      Aktif
                    </span>
                  </div>
                </div>
              </div>

              {/* Session Status & Logout Button */}
              <div className="pt-3 border-t border-slate-300 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900" style={{ color: 'var(--color-text-secondary)' }}>
                  Sesi Aktif
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    onClose();
                    navigate('/login', { replace: true });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 text-xs font-bold transition-colors cursor-pointer"
                  title="Keluar dari sesi akun ini"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-100 border-2 border-amber-300 text-amber-950 text-xs font-semibold">
              Belum ada pengguna yang login.
            </div>
          )}

          {/* Switch Account Form (Credentials-based with High Contrast) */}
          <div className="pt-1">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Masuk Akun:
            </h4>
            <form onSubmit={handleCustomLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                  Username & Kata Sandi:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white text-slate-900 placeholder:text-slate-500 font-semibold border-2 border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-800 focus:ring-1 focus:ring-blue-800"
                  />
                  <input
                    type="password"
                    placeholder="Kata Sandi"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white text-slate-900 placeholder:text-slate-500 font-semibold border-2 border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:border-blue-800 focus:ring-1 focus:ring-blue-800"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-rose-700 font-bold bg-rose-50 border border-rose-200 p-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-[#1E3A8A] hover:bg-blue-900 active:scale-[0.99] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Masuk
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
};
