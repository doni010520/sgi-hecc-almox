import { supabase } from '@/lib/supabase'

export type MotivoPerda =
  | 'Vencimento'
  | 'Quebra'
  | 'Avaria'
  | 'Desvio'
  | 'Contaminação'
  | 'Recolhimento'
  | 'Outro'

export interface MedicationLoss {
  id: string
  item_id: string | null
  item_nome: string
  stock_location_id: string | null
  batch_number: string | null
  expiry_date: string | null
  quantity: number
  motivo: string
  documento: string | null
  observacao: string | null
  is_controlado: boolean | null
  responsavel_nome: string | null
  created_by: string | null
  created_at: string
}

export interface CreateMedicationLossData {
  item_id?: string | null
  item_nome: string
  stock_location_id?: string | null
  batch_number?: string | null
  expiry_date?: string | null
  quantity: number
  motivo: string
  documento?: string | null
  observacao?: string | null
  is_controlado?: boolean | null
  responsavel_nome?: string | null
}

export type UpdateMedicationLossData = Partial<CreateMedicationLossData>

class MedicationLossesService {
  private static instance: MedicationLossesService
  static getInstance() {
    if (!MedicationLossesService.instance) {
      MedicationLossesService.instance = new MedicationLossesService()
    }
    return MedicationLossesService.instance
  }

  async getAll(): Promise<MedicationLoss[]> {
    const { data, error } = await supabase
      .from('medication_losses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Error listing medication losses:', error)
      throw new Error(error.message)
    }

    return (data || []) as MedicationLoss[]
  }

  async create(payload: CreateMedicationLossData): Promise<MedicationLoss> {
    const { data: authData } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('medication_losses')
      .insert({
        item_id: payload.item_id || null,
        item_nome: payload.item_nome.trim(),
        stock_location_id: payload.stock_location_id || null,
        batch_number: payload.batch_number?.trim() || null,
        expiry_date: payload.expiry_date || null,
        quantity: payload.quantity,
        motivo: payload.motivo,
        documento: payload.documento?.trim() || null,
        observacao: payload.observacao?.trim() || null,
        is_controlado: payload.is_controlado ?? false,
        responsavel_nome: payload.responsavel_nome?.trim() || null,
        created_by: authData?.user?.id || null,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating medication loss:', error)
      throw new Error(error.message)
    }

    return data as MedicationLoss
  }

  async update(id: string, payload: UpdateMedicationLossData): Promise<MedicationLoss> {
    const patch: Record<string, unknown> = {}

    if (payload.item_id !== undefined) patch.item_id = payload.item_id || null
    if (payload.item_nome !== undefined) patch.item_nome = payload.item_nome.trim()
    if (payload.stock_location_id !== undefined) patch.stock_location_id = payload.stock_location_id || null
    if (payload.batch_number !== undefined) patch.batch_number = payload.batch_number?.trim() || null
    if (payload.expiry_date !== undefined) patch.expiry_date = payload.expiry_date || null
    if (payload.quantity !== undefined) patch.quantity = payload.quantity
    if (payload.motivo !== undefined) patch.motivo = payload.motivo
    if (payload.documento !== undefined) patch.documento = payload.documento?.trim() || null
    if (payload.observacao !== undefined) patch.observacao = payload.observacao?.trim() || null
    if (payload.is_controlado !== undefined) patch.is_controlado = payload.is_controlado ?? false
    if (payload.responsavel_nome !== undefined) patch.responsavel_nome = payload.responsavel_nome?.trim() || null

    const { data, error } = await supabase
      .from('medication_losses')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating medication loss:', error)
      throw new Error(error.message)
    }

    return data as MedicationLoss
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('medication_losses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting medication loss:', error)
      throw new Error(error.message)
    }
  }
}

export const medicationLossesService = MedicationLossesService.getInstance()
