import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/theme'
import { ArrowLeft, Search, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { pharmacyDispensationService } from '@/lib/services/pharmacy-dispensation'
import type { Item } from '@/lib/services/items'

interface SelectedItem {
  item_id: string
  name: string
  code: string
  unit: string
  current_stock: number
  quantity: number
}

export function NewDispensation() {
  const navigate = useNavigate()
  const { mode } = useTheme()

  const txt = mode === 'dark' ? '#fff' : '#0d2e1c'
  const txtSec = mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(13,46,28,0.65)'
  const txtMut = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(13,46,28,0.45)'

  const glass: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(10,15,20,0.55)' : 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
    borderRadius: 16,
    transition: 'background 0.4s, border-color 0.4s',
  }

  const inputStyle: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 10, padding: '10px 14px', fontSize: 14,
    color: txt, outline: 'none', width: '100%',
  }

  const labelStyle: React.CSSProperties = { color: txtSec, fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }

  // Form state
  const [patientName, setPatientName] = useState('')
  const [medicalRecord, setMedicalRecord] = useState('')
  const [bedRoom, setBedRoom] = useState('')
  const [sector, setSector] = useState('')
  const [doctor, setDoctor] = useState('')
  const [prescriptionNumber, setPrescriptionNumber] = useState('')
  const [notes, setNotes] = useState('')

  // Items state
  const [allItems, setAllItems] = useState<Item[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    try {
      setLoadingItems(true)
      const { data, error } = await supabase
        .from('pharmacy_items')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      setAllItems(data || [])
    } catch (e) {
      console.error('Error loading items:', e)
    } finally {
      setLoadingItems(false)
    }
  }

  const filteredItems = allItems.filter((item) => {
    if (!itemSearch.trim()) return false
    const q = itemSearch.toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q)
    )
  }).filter((item) => !selectedItems.some((s) => s.item_id === item.id))

  const addItem = (item: Item) => {
    setSelectedItems((prev) => [
      ...prev,
      {
        item_id: item.id,
        name: item.name,
        code: item.code,
        unit: item.unit || 'UN',
        current_stock: item.current_stock || 0,
        quantity: 1,
      },
    ])
    setItemSearch('')
  }

  const removeItem = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.item_id !== itemId))
  }

  const updateQuantity = (itemId: string, qty: number) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.item_id === itemId ? { ...i, quantity: Math.max(1, qty) } : i))
    )
  }

  const canSubmit =
    patientName.trim() &&
    medicalRecord.trim() &&
    doctor.trim() &&
    prescriptionNumber.trim() &&
    selectedItems.length > 0 &&
    selectedItems.every((i) => i.quantity > 0 && i.quantity <= i.current_stock)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      await pharmacyDispensationService.create({
        patient_name: patientName,
        patient_bed_room: bedRoom || undefined,
        medical_record_number: medicalRecord,
        prescribing_doctor: doctor,
        prescription_number: prescriptionNumber,
        sector: sector || undefined,
        notes: notes || undefined,
        items: selectedItems.map((i) => ({ item_id: i.item_id, quantity: i.quantity })),
      })
      navigate('/dispensacao')
    } catch (e: any) {
      setError(e?.message || 'Erro ao registrar dispensacao')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dispensacao')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
            background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
            color: txt,
          }}
        ><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: txt }}>Nova Dispensacao</h1>
          <p className="text-sm" style={{ color: txtSec }}>Registre a dispensacao de medicamentos por prescricao medica</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-100 border border-red-200 flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Patient & Prescription Info */}
      <div className="p-6" style={glass}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: txt }}>Dados do Paciente e Prescricao</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Nome do Paciente *</label>
            <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Nome completo" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>N. do Prontuario *</label>
            <input value={medicalRecord} onChange={(e) => setMedicalRecord(e.target.value)} placeholder="Ex: 123456" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Leito / Quarto</label>
            <input value={bedRoom} onChange={(e) => setBedRoom(e.target.value)} placeholder="Ex: Enf. 3 - Leito 12" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Setor</label>
            <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ex: UTI, Enfermaria" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Medico Prescritor *</label>
            <input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="Nome do medico" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>N. da Prescricao *</label>
            <input value={prescriptionNumber} onChange={(e) => setPrescriptionNumber(e.target.value)} placeholder="Ex: PRESC-2026-001" style={inputStyle} />
          </div>
          <div className="md:col-span-2">
            <label style={labelStyle}>Observacoes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observacoes adicionais..." rows={2}
              style={{ ...inputStyle, resize: 'vertical' as const }} />
          </div>
        </div>
      </div>

      {/* Items Selection */}
      <div className="p-6" style={glass}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: txt }}>Medicamentos Dispensados</h2>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
          <input
            type="text"
            placeholder="Buscar medicamento por nome ou codigo..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 34 }}
          />
        </div>

        {/* Search Results */}
        {filteredItems.length > 0 && (
          <div className="mb-4 rounded-xl overflow-hidden" style={{
            border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            maxHeight: 200, overflowY: 'auto',
          }}>
            {filteredItems.slice(0, 10).map((item) => (
              <div
                key={item.id}
                onClick={() => addItem(item)}
                className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors"
                style={{
                  borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
                  background: mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}
              >
                <div>
                  <span className="font-medium text-sm" style={{ color: txt }}>{item.name}</span>
                  <span className="text-xs ml-2" style={{ color: txtMut }}>{item.code}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: txtMut }}>
                    Estoque: <span className="font-semibold" style={{ color: (item.current_stock || 0) > 0 ? '#22c55e' : '#ef4444' }}>{item.current_stock || 0}</span> {item.unit}
                  </span>
                  <Plus size={16} style={{ color: '#22c55e' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {loadingItems && (
          <div className="text-center py-4" style={{ color: txtMut }}>
            <Loader2 size={20} className="animate-spin inline-block mr-2" /> Carregando medicamentos...
          </div>
        )}

        {/* Selected Items */}
        {selectedItems.length === 0 ? (
          <div className="text-center py-8 rounded-xl" style={{
            color: txtMut, border: `2px dashed ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          }}>
            Nenhum medicamento adicionado. Use a busca acima para encontrar e adicionar.
          </div>
        ) : (
          <div className="space-y-2">
            {selectedItems.map((item) => {
              const overStock = item.quantity > item.current_stock
              return (
                <div key={item.item_id} className="flex items-center gap-4 px-4 py-3 rounded-xl" style={{
                  background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${overStock ? 'rgba(239,68,68,0.4)' : (mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}`,
                }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate" style={{ color: txt }}>{item.name}</div>
                    <div className="text-xs" style={{ color: txtMut }}>{item.code} | Estoque: {item.current_stock} {item.unit}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs" style={{ color: txtSec }}>Qtd:</label>
                    <input
                      type="number"
                      min={1}
                      max={item.current_stock}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.item_id, parseInt(e.target.value) || 1)}
                      style={{ ...inputStyle, width: 80, textAlign: 'center' as const, padding: '6px 8px' }}
                    />
                    <span className="text-xs" style={{ color: txtMut }}>{item.unit}</span>
                  </div>
                  {overStock && (
                    <span className="text-xs text-red-500 whitespace-nowrap">Excede estoque!</span>
                  )}
                  <button onClick={() => removeItem(item.item_id)} style={{
                    color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
                  }}><Trash2 size={16} /></button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/dispensacao')}>Cancelar</Button>
        <Button
          className="bg-primary-500 hover:bg-primary-600 text-white"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin mr-2" /> Registrando...</>
          ) : (
            'Registrar Dispensacao'
          )}
        </Button>
      </div>
    </div>
  )
}
