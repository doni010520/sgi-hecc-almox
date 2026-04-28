import { supabase } from '@/lib/supabase'
import type { RequestType } from '@/pages/new-request/types'
import type { RequestDetails } from '@/pages/new-request/components/request-details'
import type { RequestItem } from '@/pages/new-request/components/request-items'

export interface RequestDraft {
  user_id: string
  request_type: RequestType | null
  details: RequestDetails | null
  items: RequestItem[]
  current_step: number
  updated_at: string
}

class RequestDraftsService {
  async load(userId: string): Promise<RequestDraft | null> {
    try {
      const { data, error } = await supabase
        .from('request_drafts')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.warn('Failed to load draft from cloud:', error.message)
        return null
      }
      return data as RequestDraft | null
    } catch (e) {
      console.warn('Failed to load draft:', e)
      return null
    }
  }

  async save(userId: string, draft: Omit<RequestDraft, 'user_id' | 'updated_at'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('request_drafts')
        .upsert({
          user_id: userId,
          request_type: draft.request_type,
          details: draft.details,
          items: draft.items,
          current_step: draft.current_step,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (error) {
        console.warn('Failed to save draft to cloud:', error.message)
      }
    } catch (e) {
      console.warn('Failed to save draft:', e)
    }
  }

  async clear(userId: string): Promise<void> {
    try {
      await supabase.from('request_drafts').delete().eq('user_id', userId)
    } catch (e) {
      console.warn('Failed to clear draft:', e)
    }
  }
}

export const requestDraftsService = new RequestDraftsService()
