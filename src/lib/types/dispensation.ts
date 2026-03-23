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
  items: PharmacyDispensationItem[]
}

export interface PharmacyDispensationItem {
  id: string
  item_id: string
  item_name: string
  item_code: string
  item_unit: string
  quantity: number
}

export interface CreateDispensationData {
  patient_name: string
  patient_bed_room?: string
  medical_record_number: string
  prescribing_doctor: string
  prescription_number: string
  sector?: string
  notes?: string
  items: { item_id: string; quantity: number }[]
}
