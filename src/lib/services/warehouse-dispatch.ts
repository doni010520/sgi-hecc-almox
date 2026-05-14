import { supabase } from '../supabase'

export interface WarehouseDispatchItemInput {
  item_id: string
  quantity: number
}

export interface CreateWarehouseDispatchData {
  destination_department_id?: string
  destination_department_text?: string
  notes?: string
  items: WarehouseDispatchItemInput[]
}

export interface WarehouseDispatchSummary {
  id: string
  dispatch_number: number
  destination_department_id: string | null
  destination_department_text: string | null
  destination_department_name?: string | null
  notes: string | null
  status: 'completed' | 'cancelled'
  created_at: string
  created_by: string
  created_by_name?: string | null
  items_count?: number
  total_quantity?: number
}

class WarehouseDispatchService {
  private static instance: WarehouseDispatchService
  static getInstance() {
    if (!WarehouseDispatchService.instance) {
      WarehouseDispatchService.instance = new WarehouseDispatchService()
    }
    return WarehouseDispatchService.instance
  }

  async list(): Promise<WarehouseDispatchSummary[]> {
    const { data, error } = await supabase
      .from('warehouse_dispatches')
      .select(
        `id, dispatch_number, destination_department_id, destination_department_text,
         notes, status, created_at, created_by,
         departments:destination_department_id (name),
         users:created_by (full_name),
         warehouse_dispatch_items ( quantity )`
      )
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('Error listing warehouse dispatches:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      dispatch_number: row.dispatch_number,
      destination_department_id: row.destination_department_id,
      destination_department_text: row.destination_department_text,
      destination_department_name: row.departments?.name ?? null,
      notes: row.notes,
      status: row.status,
      created_at: row.created_at,
      created_by: row.created_by,
      created_by_name: row.users?.full_name ?? null,
      items_count: row.warehouse_dispatch_items?.length || 0,
      total_quantity:
        row.warehouse_dispatch_items?.reduce(
          (acc: number, it: any) => acc + (it.quantity || 0),
          0
        ) || 0,
    }))
  }

  async create(data: CreateWarehouseDispatchData): Promise<{ id: string }> {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) throw new Error('Usuário não autenticado')

    if (!data.items || data.items.length === 0) {
      throw new Error('Adicione pelo menos um item')
    }

    if (!data.destination_department_id && !data.destination_department_text?.trim()) {
      throw new Error('Informe o destino')
    }

    const { data: dispatch, error: dispatchError } = await supabase
      .from('warehouse_dispatches')
      .insert({
        destination_department_id: data.destination_department_id || null,
        destination_department_text: data.destination_department_text?.trim() || null,
        notes: data.notes?.trim() || null,
        created_by: authData.user.id,
      })
      .select('id')
      .single()

    if (dispatchError) {
      console.error('Error creating warehouse dispatch:', dispatchError)
      throw new Error(dispatchError.message)
    }
    if (!dispatch) throw new Error('Falha ao criar saída')

    const itemsToInsert = data.items.map((it) => ({
      dispatch_id: dispatch.id,
      item_id: it.item_id,
      quantity: it.quantity,
    }))

    const { error: itemsError } = await supabase
      .from('warehouse_dispatch_items')
      .insert(itemsToInsert)

    if (itemsError) {
      // Rollback
      await supabase.from('warehouse_dispatches').delete().eq('id', dispatch.id)
      console.error('Error inserting dispatch items:', itemsError)
      throw new Error(itemsError.message)
    }

    return { id: dispatch.id }
  }
}

export const warehouseDispatchService = WarehouseDispatchService.getInstance()
