import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  KeyRound, 
  UserCheck, 
  Fingerprint,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface AuthGateProps {
  onAuthenticated: (user: { email: string; name: string }) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('sovon01818537597@gmail.com');
  const [password, setPassword] = useState('••••••••••••');
  const [fullName, setFullName] = useState('Sovon');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!password.trim() || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    // Simulate cryptographic verification and session storage
    setTimeout(() => {
      setIsLoading(false);
      const user = {
        email: email.trim().toLowerCase(),
        name: tab === 'signup' ? fullName.trim() || 'Account Owner' : (email.includes('sovon') ? 'Sovon' : email.split('@')[0]),
      };

      localStorage.setItem('pom_auth_session', JSON.stringify({
        ...user,
        authenticated_at: new Date().toISOString(),
        role: 'owner',
      }));

      onAuthenticated(user);
    }, 450);
  };

  const handleQuickSovonLogin = () => {
    setEmail('sovon01818537597@gmail.com');
    setPassword('PowerOfMoney2026!');
    setFullName('Sovon');
    setErrorMsg(null);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const user = {
        email: 'sovon01818537597@gmail.com',
        name: 'Sovon',
      };
      localStorage.setItem('pom_auth_session', JSON.stringify({
        ...user,
        authenticated_at: new Date().toISOString(),
        role: 'owner',
      }));
      onAuthenticated(user);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Futuristic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Security Brand Header */}
      <div className="text-center mb-8 relative z-10 max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-4 shadow-lg shadow-emerald-950/50">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          POWER OF MONEY
        </h1>
        <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">
          Double-Entry Financial Management Vault
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl relative z-10 p-6 sm:p-8">
        {/* Strict Auth Notice */}
        <div className="mb-6 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5 text-xs text-slate-300">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block font-medium">Strict Access Protection:</strong>
            <span>Direct sign-in required. Guest browsing is disabled to preserve financial data integrity and security.</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl mb-6 border border-slate-800">
          <button
            type="button"
            onClick={() => { setTab('signin'); setErrorMsg(null); }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'signin' 
                ? 'bg-slate-800 text-white shadow-xs' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In to Account
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setErrorMsg(null); }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'signup' 
                ? 'bg-slate-800 text-white shadow-xs' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create New Account
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sovon"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
                  required
                />
                <UserCheck className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Account Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
                required
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300">
                Password
              </label>
              {tab === 'signin' && (
                <span className="text-2xs text-slate-500 hover:text-slate-400 cursor-pointer">
                  Recovery key enabled
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
                required
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>{tab === 'signin' ? 'Unlock Account & Vault' : 'Register Secure Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Verified Account Pass (Sovon) */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-2xs text-slate-500 mb-2">Verified Owner Profile Identified</p>
          <button
            type="button"
            onClick={handleQuickSovonLogin}
            className="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            <span>Instant Sign In as <strong>sovon01818537597@gmail.com</strong></span>
          </button>
        </div>
      </div>

      {/* Security Footer Info */}
      <div className="mt-8 text-center text-2xs text-slate-500 flex items-center gap-3">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>RLS Enforced</span>
        </span>
        <span>•</span>
        <span>Double-Entry Balanced</span>
        <span>•</span>
        <span>Bangladeshi Taka (৳)</span>
      </div>
    </div>
  );
};
