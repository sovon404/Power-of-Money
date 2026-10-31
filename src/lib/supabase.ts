import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Production Supabase Configuration
// Default to the user's live Supabase project credentials with environment variable override
export const SUPABASE_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://apxbmwxovgpnttwprijw.supabase.co';

export const SUPABASE_ANON_KEY = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFweGJtd3hvdmdwbnR0d3ByaWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDExOTIsImV4cCI6MjEwOTAxNzE5Mn0.WLknIE8p1JbkKIDRFx1g6uLLC6gY4o-G967fk5EOd5U';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith('https://')
  );
};

// Singleton Client
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Live Direct Ping from Client Browser to Supabase Cloud
 * Tests GoTrue Auth Health & Database Table Access
 */
export const pingSupabase = async (): Promise<{
  connected: boolean;
  latencyMs: number;
  url: string;
  authStatus: string;
  tableStatus: string;
  error?: string;
}> => {
  const start = performance.now();
  try {
    // 1. Direct Ping to Supabase Auth Health
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    const authOk = authRes.ok;

    // 2. Direct Ping to Supabase REST / PostgREST
    const restRes = await fetch(`${SUPABASE_URL}/rest/v1/categories?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    const tableOk = restRes.ok;

    return {
      connected: authOk || tableOk,
      latencyMs,
      url: SUPABASE_URL,
      authStatus: authOk ? 'Online (HTTP 200)' : `HTTP ${authRes.status}`,
      tableStatus: tableOk ? 'Accessible (HTTP 200)' : `HTTP ${restRes.status}`,
    };
  } catch (err: any) {
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    return {
      connected: false,
      latencyMs,
      url: SUPABASE_URL,
      authStatus: 'Offline / Network error',
      tableStatus: 'Unreachable',
      error: err.message || 'Network failure reaching Supabase',
    };
  }
};

export const getSupabaseStatus = () => {
  return {
    isConfigured: true,
    url: SUPABASE_URL,
    hasKey: true,
  };
};
