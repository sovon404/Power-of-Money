import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  KeyRound, 
  UserCheck, 
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  HelpCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AuthUser } from '../../types';
import { NumericInput } from '../common/NumericInput';

interface AuthGateProps {
  onAuthenticated: (user: AuthUser) => void;
}

type AuthMode = 'signin' | 'signup' | 'verify_email' | 'forgot_password';

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Auto-listen to Supabase Auth state changes (e.g. when user clicks confirmation email link)
  useEffect(() => {
    // 1. Check if there's already an active session in Supabase
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (session?.user && !error) {
        if (session.user.email_confirmed_at) {
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email || email,
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Vault Owner',
          };
          onAuthenticated(authUser);
        } else {
          setMode('verify_email');
        }
      }
    });

    // 2. Real-time auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user?.email_confirmed_at) {
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email || email,
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Vault Owner',
          };
          onAuthenticated(authUser);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [email, onAuthenticated]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot_password') {
      setIsLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });
        if (error) {
          setErrorMsg(error.message);
        } else {
          setSuccessMsg(`Password reset instructions have been sent to ${cleanEmail}. Please check your inbox.`);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to send password reset request.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!password.trim() || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signup') {
        // Strict Supabase Registration
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: fullName.trim() || 'Account Owner' },
          },
        });

        if (error) {
          if (error.message.toLowerCase().includes('already registered')) {
            setErrorMsg('This email is already registered in Supabase. Please sign in or verify your email below.');
            setMode('signin');
          } else {
            setErrorMsg(error.message);
          }
          setIsLoading(false);
          return;
        }

        // Check if email confirmation is required
        if (data.user && !data.user.email_confirmed_at) {
          setSuccessMsg(`Verification email dispatched to ${cleanEmail}. Please confirm before entering.`);
          setMode('verify_email');
          setIsLoading(false);
          return;
        }

        if (data.user && data.user.email_confirmed_at) {
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: fullName.trim() || data.user.email?.split('@')[0] || 'Vault Owner',
          };
          onAuthenticated(authUser);
          return;
        }
      } else {
        // Strict Supabase Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          const errMsg = error.message.toLowerCase();
          if (errMsg.includes('email not confirmed')) {
            setErrorMsg('Email verification is required by Supabase before signing in.');
            setMode('verify_email');
          } else if (errMsg.includes('invalid login credentials')) {
            setErrorMsg('Invalid login credentials. Please check your password or use "Forgot Password".');
          } else {
            setErrorMsg(error.message);
          }
          setIsLoading(false);
          return; // Strictly stop! No pass-through!
        }

        if (data.user) {
          if (!data.user.email_confirmed_at) {
            setErrorMsg('Your email address has not been confirmed yet.');
            setMode('verify_email');
            setIsLoading(false);
            return;
          }

          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
          };
          onAuthenticated(authUser);
          return;
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials and network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP / Token Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken.trim()) {
      setErrorMsg('Please enter the 6-digit confirmation code or token.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const token = otpToken.trim();

    try {
      // First attempt type: signup
      let result = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: 'signup',
      });

      // If signup type failed, try type: email
      if (result.error) {
        result = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token,
          type: 'email',
        });
      }

      if (result.error) {
        setErrorMsg(result.error.message || 'Invalid or expired confirmation code.');
        setIsLoading(false);
        return;
      }

      if (result.data.user) {
        const authUser: AuthUser = {
          id: result.data.user.id,
          email: result.data.user.email || cleanEmail,
          name: result.data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
        };
        setSuccessMsg('Email verified successfully! Opening vault...');
        setTimeout(() => {
          onAuthenticated(authUser);
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to verify confirmation code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Verification Email
  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg(`Verification email successfully resent to ${cleanEmail}. Check your inbox & spam folder.`);
        setResendCooldown(60);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend confirmation email.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user confirmed via external email link
  const handleCheckConfirmedStatus = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user?.email_confirmed_at) {
        const authUser: AuthUser = {
          id: data.user.id,
          email: data.user.email || email,
          name: data.user.user_metadata?.full_name || email.split('@')[0],
        };
        onAuthenticated(authUser);
      } else {
        setErrorMsg('Email confirmation not detected yet. Please click the link in your email or enter the code.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Status check failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Futuristic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Security Brand Header */}
      <div className="text-center mb-6 relative z-10 max-w-md">
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
        <div className="mb-5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5 text-xs text-slate-300">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block font-medium">Strict Profile & Supabase Auth:</strong>
            <span>Verified sign-in required. Every financial record, account, and ledger is strictly bound to your Supabase Profile ID.</span>
          </div>
        </div>

        {/* Tab Switcher (Visible in signin / signup) */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl mb-5 border border-slate-800">
            <button
              type="button"
              onClick={() => { setMode('signin'); setErrorMsg(null); setSuccessMsg(null); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signin' 
                  ? 'bg-slate-800 text-white shadow-xs' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In to Account
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setErrorMsg(null); setSuccessMsg(null); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup' 
                  ? 'bg-slate-800 text-white shadow-xs' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register New Vault
            </button>
          </div>
        )}

        {/* Status Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* MODE: VERIFY EMAIL */}
        {mode === 'verify_email' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 mb-2">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                Verify Your Email Address
              </h3>
              <p className="text-xs text-slate-300 mb-2">
                Supabase has sent a verification email to:
              </p>
              <div className="font-mono text-xs text-amber-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 break-all">
                {email}
              </div>
              <p className="text-2xs text-slate-400 mt-2">
                Click the confirmation link in your email, or enter the 6-digit confirmation code below.
              </p>
            </div>

            {/* OTP Code Form */}
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  6-Digit Confirmation Code / OTP Token
                </label>
                <NumericInput
                  allowDecimal={false}
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value)}
                  placeholder="e.g. 123456"
                  maxLength={12}
                  className="w-full px-3 py-2.5 text-center tracking-widest font-mono text-base rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !otpToken.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Code & Enter Vault</span>
                  </>
                )}
              </button>
            </form>

            {/* Action Buttons: Resend & Refresh */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isLoading || resendCooldown > 0}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-2xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Send className="w-3 h-3 text-emerald-400" />
                <span>{resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Email'}</span>
              </button>

              <button
                type="button"
                onClick={handleCheckConfirmedStatus}
                disabled={isLoading}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-2xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Check Link Status</span>
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setMode('signin'); setErrorMsg(null); setSuccessMsg(null); }}
                className="text-xs text-slate-400 hover:text-white underline underline-offset-4"
              >
                &larr; Return to Sign In with Password
              </button>
            </div>
          </div>
        )}

        {/* MODE: FORGOT PASSWORD */}
        {mode === 'forgot_password' && (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  required
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Password Reset Link</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setMode('signin'); setErrorMsg(null); setSuccessMsg(null); }}
                className="text-xs text-slate-400 hover:text-white underline underline-offset-4"
              >
                &larr; Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* MODE: SIGN IN / SIGN UP */}
        {(mode === 'signin' || mode === 'signup') && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Asif Mohammad Sovon"
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
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot_password'); setErrorMsg(null); setSuccessMsg(null); }}
                    className="text-2xs text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signin' ? 'Enter your Supabase password' : 'Choose a secure password (min 6 chars)'}
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
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Verify & Unlock Vault' : 'Create & Send Verification Email'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {mode === 'signin' && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setMode('verify_email'); setErrorMsg(null); setSuccessMsg(null); }}
                  className="text-2xs text-slate-400 hover:text-amber-400 flex items-center justify-center gap-1 mx-auto"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Awaiting email confirmation? Enter code here</span>
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Security Footer Info */}
      <div className="mt-8 text-center text-2xs text-slate-500 flex items-center gap-3">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Real Supabase Auth</span>
        </span>
        <span>•</span>
        <span>RLS Multi-Tenant Guard</span>
        <span>•</span>
        <span>Profile ID Binding</span>
      </div>
    </div>
  );
};
