import { supabase } from '../supabase'

export type AuditOrigem = 'audit' | 'stock'

export interface AuditLogEntry {
  ts: string
  actor_id: string | null
  actor_name: string | null
  origem: AuditOrigem
  action: string
  entity: string
  entity_id: string
  details: Record<string, any> | null
}

export interface AuditLogFilters {
  dateFrom?: string
  dateTo?: string
  actorId?: string
  origem?: AuditOrigem
  entity?: string
  action?: string
  search?: string
  limit?: number
}

class AuditLogService {
  async list(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
    let q = supabase
      .from('v_global_audit_log')
      .select('*')
      .order('ts', { ascending: false })

    if (filters.dateFrom) q = q.gte('ts', `${filters.dateFrom}T00:00:00`)
    if (filters.dateTo) q = q.lte('ts', `${filters.dateTo}T23:59:59`)
    if (filters.actorId) q = q.eq('actor_id', filters.actorId)
    if (filters.origem) q = q.eq('origem', filters.origem)
    if (filters.entity) q = q.eq('entity', filters.entity)
    if (filters.action) q = q.eq('action', filters.action)
    q = q.limit(filters.limit ?? 500)

    const { data, error } = await q
    if (error) throw error

    let rows = (data || []) as AuditLogEntry[]

    if (filters.search?.trim()) {
      const needle = filters.search.toLowerCase()
      rows = rows.filter(
        (r) =>
          r.entity_id?.toLowerCase().includes(needle) ||
          r.entity?.toLowerCase().includes(needle) ||
          r.actor_name?.toLowerCase().includes(needle) ||
          JSON.stringify(r.details || {}).toLowerCase().includes(needle)
      )
    }

    return rows
  }

  async listActors(): Promise<Array<{ id: string; full_name: string }>> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .order('full_name')
    if (error) throw error
    return (data || []) as Array<{ id: string; full_name: string }>
  }
}

export const auditLogService = new AuditLogService()
