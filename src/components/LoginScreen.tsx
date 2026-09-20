import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Store,
  LogIn,
  Users,
  ShieldCheck,
  MapPin,
  ArrowRight,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface LoginScreenProps {
  onOpenSpreadsheet: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOpenSpreadsheet }) => {
  const { manpower, loginWithNik } = useApp();
  const [nikInput, setNikInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nikInput.trim()) {
      setErrorMsg('Silakan masukkan NIK Anda.');
      return;
    }

    const success = loginWithNik(nikInput.trim());
    if (!success) {
      setErrorMsg(`NIK ${nikInput} tidak ditemukan di Master Manpower.`);
    }
  };

  const handleQuickLogin = (nik: string) => {
    loginWithNik(nik);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Brand Bar */}
      <div className="relative z-10 max-w-md w-full mx-auto flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 font-bold">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">Retail Attendance</div>
            <div className="text-[10px] text-slate-400">Google Sheets Single Source of Truth</div>
          </div>
        </div>

        <button
          onClick={onOpenSpreadsheet}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sheets Master</span>
        </button>
      </div>

      {/* Login Card */}
      <div className="relative z-10 max-w-md w-full mx-auto my-auto py-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-md space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-black text-white tracking-tight">Masuk Sistem Absensi</h1>
            <p className="text-xs text-slate-400">
              Autentikasi tanpa password — masukkan NIK yang terdaftar pada sheet MANPOWER
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Nomor Induk Karyawan (NIK)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={nikInput}
                  onChange={(e) => {
                    setNikInput(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Contoh: 1001, 1002, 1004..."
                  className="w-full text-sm font-mono p-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Masuk Sekarang</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>

          {/* Quick Login Role Shortcuts */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
              Atau Pilih Akun Demo Sesuai Role (Rule 6):
            </div>

            <div className="grid grid-cols-1 gap-2">
              {manpower.slice(0, 4).map((user) => (
                <button
                  key={user.nik}
                  type="button"
                  onClick={() => handleQuickLogin(user.nik)}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-left transition-colors flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-[11px]">
                      {user.roleLevel}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{user.employeeName}</div>
                      <div className="text-[10px] text-slate-400">
                        NIK: {user.nik} • {user.position}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Masuk →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Note */}
      <div className="relative z-10 max-w-md w-full mx-auto text-center pb-2 text-[11px] text-slate-500">
        Retail Attendance Web App • Powered by Google Sheets & Apps Script
      </div>
    </div>
  );
};
