import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set — every read
 * and write in the app (DataContext, AuthContext) goes through this client.
 * `detectSessionInUrl` is on so the password-recovery link's access token in
 * the URL hash (landing on /reset-password) establishes a session on its
 * own, without the app having to parse it manually.
 */
export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
