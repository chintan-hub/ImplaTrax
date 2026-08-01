import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set. The app
 * currently runs entirely on localStorage (see src/store/DataContext.tsx)
 * and nothing imports this client yet — it's the landing point for the
 * next phase of the Supabase migration (see supabase/migrations and the
 * migration report), which rewrites DataContext/AuthContext to read and
 * write through it once real project credentials exist.
 */
export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null
