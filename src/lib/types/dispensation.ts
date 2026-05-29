export interface PharmacyDispensation {
  id: string
  dispensation_number: number
  patient_name: string
  patient_bed_room?: string
  medical_record_number: string
  prescribing_doctor: string
  prescription_number: string
  sector?: string
  notes?: string
  status: 'completed' | 'cancelled'
  created_by: string
  created_by_name?: string
  created_at: string
  cancelled_at?: string
  cancellation_reason?: string
  // FKs novas (F1):
  patient_id?: string | null
  admission_id?: string | null
  prescriber_id?: string | null
  items: PharmacyDispensationItem[]
}

export interface PharmacyDispensationItem {
  id: string
  item_id: string
  item_name: string
  item_code: string
  item_unit: string
  quantity: number
  // Lote snapshot (F1):
  expiry_tracking_id?: string | null
  batch_number?: string | null
  expiry_date?: string | null
}

export interface CreateDispensationData {
  // Compat: campos texto continuam aceitos
  patient_name: string
  patient_bed_room?: string
  medical_record_number: string
  prescribing_doctor: string
  prescription_number: string
  sector?: string
  notes?: string

  // Novos vinculos (recomendado preencher):
  patient_id?: string | null
  admission_id?: string | null
  prescriber_id?: string | null

  items: Array<{
    item_id: string
    quantity: number
    expiry_tracking_id?: string | null
    batch_number?: string | null
    expiry_date?: string | null
  }>
}
