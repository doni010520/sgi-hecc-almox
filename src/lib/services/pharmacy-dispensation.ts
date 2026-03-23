import { supabase } from '../supabase'
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

  async create(data: CreateDispensationData): Promise<{ id: string } | null> {
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) throw new Error('User not authenticated')

      // Insert dispensation header
      const { data: dispensation, error: dispError } = await supabase
        .from('pharmacy_dispensations')
        .insert({
          patient_name: data.patient_name.trim(),
          patient_bed_room: data.patient_bed_room?.trim() || null,
          medical_record_number: data.medical_record_number.trim(),
          prescribing_doctor: data.prescribing_doctor.trim(),
          prescription_number: data.prescription_number.trim(),
          sector: data.sector?.trim() || null,
          notes: data.notes?.trim() || null,
          created_by: authData.user.id,
        })
        .select('id')
        .single()

      if (dispError) throw dispError
      if (!dispensation) throw new Error('Failed to create dispensation')

      // Insert dispensation items (trigger handles stock deduction)
      const itemsToInsert = data.items.map((item) => ({
        dispensation_id: dispensation.id,
        item_id: item.item_id,
        quantity: item.quantity,
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

      return { id: dispensation.id }
    } catch (error) {
      console.error('Error creating dispensation:', error)
      throw error
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
