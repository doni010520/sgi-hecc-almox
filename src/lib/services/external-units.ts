import { supabase } from '../supabase'

export interface ExternalUnit {
  id: string
  name: string
  cnpj: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

class ExternalUnitsService {
  async list(includeInactive = false): Promise<ExternalUnit[]> {
    let q = supabase.from('external_units').select('*').order('name')
    if (!includeInactive) q = q.eq('is_active', true)
    const { data, error } = await q
    if (error) throw new Error('Erro ao listar unidades externas: ' + error.message)
    return (data || []) as ExternalUnit[]
  }

  async create(input: { name: string; cnpj?: string }): Promise<ExternalUnit> {
    if (!input.name.trim()) throw new Error('Nome é obrigatório.')
    const { data, error } = await supabase
      .from('external_units')
      .insert({ name: input.name.trim(), cnpj: input.cnpj?.trim() || null })
      .select('*')
      .single()
    if (error) throw new Error('Erro ao criar unidade externa: ' + error.message)
    return data as ExternalUnit
  }

  async update(id: string, input: Partial<{ name: string; cnpj: string; is_active: boolean }>): Promise<ExternalUnit> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.name !== undefined) {
      if (!input.name.trim()) throw new Error('Nome é obrigatório.')
      patch.name = input.name.trim()
    }
    if (input.cnpj !== undefined) patch.cnpj = input.cnpj.trim() || null
    if (input.is_active !== undefined) patch.is_active = input.is_active
    const { data, error } = await supabase
      .from('external_units').update(patch).eq('id', id).select('*').single()
    if (error) throw new Error('Erro ao atualizar unidade externa: ' + error.message)
    return data as ExternalUnit
  }

  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('external_units')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error('Erro ao desativar: ' + error.message)
  }
}

export const externalUnitsService = new ExternalUnitsService()
