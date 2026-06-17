import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/database'

// Get environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL) {
  throw new Error('Missing environment variable: VITE_SUPABASE_URL')
}

if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing environment variable: VITE_SUPABASE_ANON_KEY')
}

let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null

// Evita múltiplos redirects em uma rajada de requisições simultâneas após expiração.
let sessionExpiredHandled = false

// Detecta JWT expirado em QUALQUER resposta do PostgREST/Auth e força logout + redirect.
// Sem isso, o usuário ficava com modais mostrando "Erro de autenticação" sem entender o que fazer.
async function handleExpiredSession() {
  if (sessionExpiredHandled) return
  sessionExpiredHandled = true
  try {
    if (supabaseInstance) {
      await supabaseInstance.auth.signOut().catch(() => {})
    }
  } finally {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login?session_expired=1'
    }
  }
}

const interceptedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init)
  // Só nos importa 401. Outros erros (4xx/5xx) são tratados pelo chamador.
  if (response.status === 401) {
    try {
      // Clona pra não consumir o body original
      const cloned = response.clone()
      const body = await cloned.text()
      const lower = body.toLowerCase()
      // PostgREST devolve { message, code: 'PGRST301' } ou JWT errors com 'jwt'/'expired'/'invalid token'
      if (lower.includes('jwt') || lower.includes('expired') || lower.includes('invalid token') || lower.includes('pgrst301')) {
        handleExpiredSession()
      }
    } catch {
      // Se não conseguir ler o body, ignora — não força logout em qualquer 401
    }
  }
  return response
}

export const supabase = (() => {
  if (supabaseInstance) {
    return supabaseInstance
  }

  try {
    supabaseInstance = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: localStorage,
      storageKey: 'supabase.auth.token',
      flowType: 'pkce'
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'warehouse-management-system',
      },
      fetch: interceptedFetch,
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
    )

    return supabaseInstance
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    throw error
  }
})()

// Add connection health check
export const checkSupabaseHealth = async (): Promise<boolean> => {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    const { error } = await supabase.from('users').select('id').limit(1)
    clearTimeout(timeoutId)
    return !error
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Supabase health check timed out')
      } else {
        console.error('Supabase health check failed:', error.message)
      }
    }
    return false
  }
}