import { supabase } from '../supabase'
import { stockService } from './stock'
import type {
  PharmacyDispensation,
  CreateDispensationData,
} from '../types/dispensation'

class PharmacyDispensationService {
  private static instance: PharmacyDispensationService

  private constructor() {}

  static getInstance(): PharmacyDispensationService {
    if (!PharmacyDispensationService.instance) {
      PharmacyDispensationService.instance = new PharmacyDispensationService()
    }
    return PharmacyDispensationService.instance
  }

  async getAll(filters?: {
    dateFrom?: string
    dateTo?: string
    search?: string
  }): Promise<PharmacyDispensation[]> {
    try {
      let query = supabase
        .from('pharmacy_dispensations')
        .select(`
          *,
          items:pharmacy_dispensation_items(
            id,
            item_id,
            quantity,
            item:pharmacy_items(
              id,
              name,
              code,
              unit
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (filters?.dateFrom) {
        query = query.gte('created_at', `${filters.dateFrom}T00:00:00`)
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', `${filters.dateTo}T23:59:59`)
      }

      const { data, error } = await query

      if (error) throw error
      if (!data) return []

      // Get user names for created_by
      const userIds = [...new Set(data.map((d: any) => d.created_by).filter(Boolean))]
      let userMap: Record<string, string> = {}
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', userIds)
        if (users) {
          userMap = Object.fromEntries(users.map((u: any) => [u.id, u.full_name]))
        }
      }

      let results = data.map((d: any) => ({
        id: d.id,
        dispensation_number: d.dispensation_number,
        patient_name: d.patient_name,
        patient_bed_room: d.patient_bed_room,
        medical_record_number: d.medical_record_number,
        prescribing_doctor: d.prescribing_doctor,
        prescription_number: d.prescription_number,
        sector: d.sector,
        notes: d.notes,
        status: d.status,
        created_by: d.created_by,
        created_by_name: userMap[d.created_by] || 'Desconhecido',
        created_at: d.created_at,
        cancelled_at: d.cancelled_at,
        cancellation_reason: d.cancellation_reason,
        items: (d.items || []).map((i: any) => ({
          id: i.id,
          item_id: i.item_id,
          item_name: i.item?.name || '',
          item_code: i.item?.code || '',
          item_unit: i.item?.unit || 'UN',
          quantity: i.quantity,
        })),
      })) as PharmacyDispensation[]

      // Client-side search filter
      if (filters?.search?.trim()) {
        const q = filters.search.toLowerCase()
        results = results.filter(
          (d) =>
            d.patient_name.toLowerCase().includes(q) ||
            d.medical_record_number.toLowerCase().includes(q) ||
            d.prescribing_doctor.toLowerCase().includes(q) ||
            d.prescription_number.toLowerCase().includes(q) ||
            String(d.dispensation_number).includes(q)
        )
      }

      return results
    } catch (error) {
      console.error('Error fetching dispensations:', error)
      return []
    }
  }

  async getById(id: string): Promise<PharmacyDispensation | null> {
    try {
      const { data, error } = await supabase
        .from('pharmacy_dispensations')
        .select(`
          *,
          items:pharmacy_dispensation_items(
            id,
            item_id,
            quantity,
            item:pharmacy_items(
              id,
              name,
              code,
              unit
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) return null

      // Get user name
      let createdByName = 'Desconhecido'
      if (data.created_by) {
        const { data: userData } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', data.created_by)
          .single()
        if (userData) createdByName = userData.full_name
      }

      return {
        id: data.id,
        dispensation_number: data.dispensation_number,
        patient_name: data.patient_name,
        patient_bed_room: data.patient_bed_room,
        medical_record_number: data.medical_record_number,
        prescribing_doctor: data.prescribing_doctor,
        prescription_number: data.prescription_number,
        sector: data.sector,
        notes: data.notes,
        status: data.status,
        created_by: data.created_by,
        created_by_name: createdByName,
        created_at: data.created_at,
        cancelled_at: data.cancelled_at,
        cancellation_reason: data.cancellation_reason,
        items: (data.items || []).map((i: any) => ({
          id: i.id,
          item_id: i.item_id,
          item_name: i.item?.name || '',
          item_code: i.item?.code || '',
          item_unit: i.item?.unit || 'UN',
          quantity: i.quantity,
        })),
      }
    } catch (error) {
      console.error('Error fetching dispensation:', error)
      return null
    }
  }

  async create(data: CreateDispensationData): Promise<{ id: string; needsApproval?: boolean } | null> {
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) throw new Error('User not authenticated')

      // Resolve o estoque-fonte (CAF por padrao). Modelo multi-estoque exige
      // que toda prescricao tenha origem. CAF tem cache no stockService.
      const cafLocation = await stockService.getLocationByCode('CAF')
      if (!cafLocation) {
        throw new Error('Local CAF nao encontrado em stock_locations.')
      }

      // Buscar medication_class e is_mav de todos os itens para determinar
      // se a dispensacao precisa de aprovacao farmaceutica.
      const itemIds = data.items.map((i) => i.item_id)
      const { data: itemDetails } = await supabase
        .from('pharmacy_items')
        .select('id, medication_class, is_mav')
        .in('id', itemIds)

      const REQUIRES_APPROVAL_CLASSES = new Set(['controlados', 'antimicrobianos'])
      const needsApproval = (itemDetails || []).some((item: any) =>
        item.is_mav || REQUIRES_APPROVAL_CLASSES.has(item.medication_class)
      )

      // Insert dispensation header (ja com source_location_id no novo modelo)
      const { data: dispensation, error: dispError } = await supabase
        .from('pharmacy_dispensations')
        .insert({
          patient_name: data.patient_name.trim(),
          patient_bed_room: data.patient_bed_room?.trim() || null,
          medical_record_number: data.medical_record_number.trim(),
          prescribing_doctor: data.prescribing_doctor.trim(),
          prescription_number: data.prescription_number.trim(),
          prescription_date: data.prescription_date ?? null,
          sector: data.sector?.trim() || null,
          notes: data.notes?.trim() || null,
          created_by: authData.user.id,
          source_location_id: cafLocation.id,
          status: needsApproval ? 'pending_approval' : 'completed',
          // Novos vinculos
          patient_id: data.patient_id ?? null,
          admission_id: data.admission_id ?? null,
          prescriber_id: data.prescriber_id ?? null,
        })
        .select('id')
        .single()

      if (dispError) throw dispError
      if (!dispensation) throw new Error('Failed to create dispensation')

      // Snapshot de precos unitarios para registrar custo em stock_movements
      const { data: priceRows } = await supabase
        .from('pharmacy_items')
        .select('id, price')
        .in('id', itemIds)
      const priceMap = new Map<string, number | null>(
        (priceRows || []).map((p: any) => [p.id, p.price ?? null])
      )

      // Insert dispensation items.
      // OBS: a trigger legada `deduct_pharmacy_stock` ja decrementa
      // pharmacy_items.current_stock. Em seguida, registramos no
      // livro-razao (stock_movements) — o trigger fn_apply_stock_movement
      // decrementa item_stocks(CAF). Sao tabelas diferentes; o trigger
      // de compat fn_sync_legacy_stock_columns mantem ambos coerentes.
      const itemsToInsert = data.items.map((item) => ({
        dispensation_id: dispensation.id,
        item_id: item.item_id,
        quantity: item.quantity,
        expiry_tracking_id: item.expiry_tracking_id ?? null,
        batch_number: item.batch_number ?? null,
        expiry_date: item.expiry_date ?? null,
      }))

      const { error: itemsError } = await supabase
        .from('pharmacy_dispensation_items')
        .insert(itemsToInsert)

      if (itemsError) {
        // Rollback: delete the dispensation header
        await supabase
          .from('pharmacy_dispensations')
          .delete()
          .eq('id', dispensation.id)
        throw itemsError
      }

      // Se precisa de aprovacao, nao debitar estoque agora.
      // O debito ocorre quando o farmaceutico aprovar via approveDispensation().
      if (needsApproval) {
        return { id: dispensation.id, needsApproval: true }
      }

      // Registra cada saida no livro-razao do novo modelo.
      // Se algum falhar (ex: saldo insuficiente em item_stocks), faz rollback
      // total (dispensacao + items + movimentacoes ja criadas).
      const today = new Date().toISOString().slice(0, 10)
      try {
        for (const item of data.items) {
          await stockService.dispenseFromPrescription({
            item_id: item.item_id,
            quantity: item.quantity,
            unit_cost: priceMap.get(item.item_id) ?? null,
            source_location_id: cafLocation.id,
            medical_record_number: data.medical_record_number.trim(),
            prescription_date: today,
            dispensation_id: dispensation.id,
          })

          // Se um lote foi escolhido, decrementa o expiry_tracking via RPC atomico
          if (item.expiry_tracking_id) {
            const { error: trackErr } = await supabase.rpc('decrement_expiry_tracking', {
              p_tracking_id: item.expiry_tracking_id,
              p_qty: item.quantity,
            })
            if (trackErr) {
              throw new Error(`Falha ao baixar lote: ${trackErr.message}`)
            }
          }
        }
      } catch (movementError) {
        // Rollback completo. As movimentacoes ja criadas sao imutaveis (trigger
        // bloqueia DELETE em stock_movements), mas como nao deveriam existir
        // se a dispensacao falha como um todo, apenas deletamos a dispensacao
        // (items caem por CASCADE) e o usuario refaz. Sera necessario um
        // AJUSTE manual se houver inconsistencia. Logamos para investigar.
        console.error(
          'Falha ao registrar stock_movement; revertendo dispensacao.',
          movementError
        )
        await supabase
          .from('pharmacy_dispensations')
          .delete()
          .eq('id', dispensation.id)
        throw movementError
      }

      return { id: dispensation.id }
    } catch (error) {
      console.error('Error creating dispensation:', error)
      throw error
    }
  }

  async approveDispensation(dispensationId: string): Promise<void> {
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) throw new Error('User not authenticated')

      // Buscar nome do aprovador
      let approverName = 'Desconhecido'
      const { data: approverData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', authData.user.id)
        .single()
      if (approverData) approverName = approverData.full_name

      // Buscar a dispensacao com seus items
      const dispensation = await this.getById(dispensationId)
      if (!dispensation) throw new Error('Dispensacao nao encontrada')
      if (dispensation.status !== 'pending_approval') {
        throw new Error('Dispensacao nao esta pendente de aprovacao')
      }

      const cafLocation = await stockService.getLocationByCode('CAF')
      if (!cafLocation) {
        throw new Error('Local CAF nao encontrado em stock_locations.')
      }

      // Snapshot de precos
      const itemIds = dispensation.items.map((i) => i.item_id)
      const { data: priceRows } = await supabase
        .from('pharmacy_items')
        .select('id, price')
        .in('id', itemIds)
      const priceMap = new Map<string, number | null>(
        (priceRows || []).map((p: any) => [p.id, p.price ?? null])
      )

      const today = new Date().toISOString().slice(0, 10)

      // Debitar estoque para cada item
      for (const item of dispensation.items) {
        await stockService.dispenseFromPrescription({
          item_id: item.item_id,
          quantity: item.quantity,
          unit_cost: priceMap.get(item.item_id) ?? null,
          source_location_id: cafLocation.id,
          medical_record_number: dispensation.medical_record_number,
          prescription_date: today,
          dispensation_id: dispensationId,
        })

        if (item.expiry_tracking_id) {
          const { error: trackErr } = await supabase.rpc('decrement_expiry_tracking', {
            p_tracking_id: item.expiry_tracking_id,
            p_qty: item.quantity,
          })
          if (trackErr) {
            throw new Error(`Falha ao baixar lote: ${trackErr.message}`)
          }
        }
      }

      // Marcar dispensacao como aprovada/concluida
      const { error } = await supabase
        .from('pharmacy_dispensations')
        .update({
          status: 'completed',
          approved_by: authData.user.id,
          approved_at: new Date().toISOString(),
          approved_by_name: approverName,
        })
        .eq('id', dispensationId)

      if (error) throw error
    } catch (error) {
      console.error('Error approving dispensation:', error)
      throw error
    }
  }

  async getPendingApprovals(): Promise<PharmacyDispensation[]> {
    try {
      const { data, error } = await supabase
        .from('pharmacy_dispensations')
        .select(`
          *,
          items:pharmacy_dispensation_items(
            id,
            item_id,
            quantity,
            expiry_tracking_id,
            batch_number,
            expiry_date,
            item:pharmacy_items(
              id,
              name,
              code,
              unit,
              medication_class,
              is_mav
            )
          )
        `)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!data) return []

      // Buscar nomes dos criadores
      const userIds = [...new Set(data.map((d: any) => d.created_by).filter(Boolean))]
      let userMap: Record<string, string> = {}
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', userIds)
        if (users) {
          userMap = Object.fromEntries(users.map((u: any) => [u.id, u.full_name]))
        }
      }

      return data.map((d: any) => ({
        id: d.id,
        dispensation_number: d.dispensation_number,
        patient_name: d.patient_name,
        patient_bed_room: d.patient_bed_room,
        medical_record_number: d.medical_record_number,
        prescribing_doctor: d.prescribing_doctor,
        prescription_number: d.prescription_number,
        prescription_date: d.prescription_date,
        sector: d.sector,
        notes: d.notes,
        status: d.status,
        created_by: d.created_by,
        created_by_name: userMap[d.created_by] || 'Desconhecido',
        created_at: d.created_at,
        cancelled_at: d.cancelled_at,
        cancellation_reason: d.cancellation_reason,
        approved_by: d.approved_by,
        approved_at: d.approved_at,
        approved_by_name: d.approved_by_name,
        patient_id: d.patient_id,
        admission_id: d.admission_id,
        prescriber_id: d.prescriber_id,
        items: (d.items || []).map((i: any) => ({
          id: i.id,
          item_id: i.item_id,
          item_name: i.item?.name || '',
          item_code: i.item?.code || '',
          item_unit: i.item?.unit || 'UN',
          quantity: i.quantity,
          expiry_tracking_id: i.expiry_tracking_id,
          batch_number: i.batch_number,
          expiry_date: i.expiry_date,
          medication_class: i.item?.medication_class ?? null,
          is_mav: i.item?.is_mav ?? false,
        })),
      })) as PharmacyDispensation[]
    } catch (error) {
      console.error('Error fetching pending approvals:', error)
      return []
    }
  }

  async cancel(id: string, reason: string): Promise<void> {
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('pharmacy_dispensations')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: authData.user.id,
          cancellation_reason: reason.trim(),
        })
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error cancelling dispensation:', error)
      throw error
    }
  }
}

export const pharmacyDispensationService =
  PharmacyDispensationService.getInstance()
