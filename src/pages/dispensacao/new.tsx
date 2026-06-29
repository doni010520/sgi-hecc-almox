import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '@/contexts/theme'
import {
  ArrowLeft, ArrowRight, Search, Trash2, Loader2, AlertCircle, AlertTriangle,
  UserCheck, Stethoscope, Pill, CheckCircle2, ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { pharmacyDispensationService } from '@/lib/services/pharmacy-dispensation'
import { patientsService, prescribersService } from '@/lib/services/farmacia-cadastros'
import type { Patient, Prescriber, PatientAdmission } from '@/lib/types/farmacia'
import { getErrorMessage } from '@/lib/utils/error-messages'

interface SelectedItem {
  item_id: string
  name: string
  code: string
  unit: string
  is_mav: boolean
  medication_class: string | null
  // lote escolhido (FEFO por padrão; pode trocar no seletor)
  expiry_tracking_id: string | null
  batch_number: string | null
  expiry_date: string | null
  available_in_batch: number
  item_stock: number // estoque agregado (para opção "sem lote")
  quantity: number
}

interface PharmacyItemRow {
  id: string
  code: string | null
  name: string
  unit: string
  current_stock: number
  is_mav: boolean
  medication_class: string | null
}

interface LotRow {
  id: string
  batch_number: string
  expiry_date: string | null
  current_quantity: number
}

const STEPS = [
  { label: 'Paciente', icon: UserCheck },
  { label: 'Prescrição', icon: ClipboardList },
  { label: 'Prescritor', icon: Stethoscope },
  { label: 'Medicamentos', icon: Pill },
  { label: 'Resumo', icon: CheckCircle2 },
]
const STEP_RESUMO = 4

export function NewDispensation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mode } = useTheme()

  const txt = mode === 'dark' ? '#fff' : '#0d2e1c'
  const txtSec = mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(13,46,28,0.65)'
  const txtMut = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(13,46,28,0.45)'

  const card: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(10,15,20,0.55)' : 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
    borderRadius: 16,
  }
  const inputStyle: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 10, padding: '10px 14px', fontSize: 14,
    color: txt, outline: 'none', width: '100%',
  }
  const lbl: React.CSSProperties = {
    color: txtSec, fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: 0.5, display: 'block', marginBottom: 4,
  }
  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', zIndex: 50, width: '100%', marginTop: 4,
    background: mode === 'dark' ? 'rgba(15,20,28,0.98)' : 'rgba(255,255,255,0.98)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 10, maxHeight: 260, overflowY: 'auto',
  }

  const [step, setStep] = useState(0)

  // Etapa 1 — Paciente (pode vir pré-selecionado da tela /dispensacao/paciente)
  const prefilledPatient = (location.state as { patient?: Patient } | null)?.patient ?? null
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(prefilledPatient)
  const [openAdmission, setOpenAdmission] = useState<PatientAdmission | null>(null)

  // Etapa 2 — Prescrição
  const [prescriptionNumber, setPrescriptionNumber] = useState('')
  const [prescriptionDate, setPrescriptionDate] = useState('')

  // Etapa 3 — Prescritor
  const [prescSearch, setPrescSearch] = useState('')
  const [prescResults, setPrescResults] = useState<Prescriber[]>([])
  const [selectedPresc, setSelectedPresc] = useState<Prescriber | null>(null)

  // Etapa 4 — Medicamentos
  const [itemSearch, setItemSearch] = useState('')
  const [itemResults, setItemResults] = useState<PharmacyItemRow[]>([])
  const [searchingItems, setSearchingItems] = useState(false)
  const [addingItem, setAddingItem] = useState<string | null>(null)
  const [lotsByItem, setLotsByItem] = useState<Record<string, LotRow[]>>({})
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])

  // Etapa 5 — Resumo / submit
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showMavConfirm, setShowMavConfirm] = useState(false)
  const [mavConfirmText, setMavConfirmText] = useState('')

  const hasMav = useMemo(() => selectedItems.some((i) => i.is_mav), [selectedItems])
  const needsApproval = useMemo(
    () => selectedItems.some((i) => i.is_mav || i.medication_class === 'controlados' || i.medication_class === 'antimicrobianos'),
    [selectedItems]
  )

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!patientSearch.trim() || selectedPatient) return setPatientResults([])
      try { setPatientResults(await patientsService.search(patientSearch)) }
      catch (e) { console.error(e) }
    }, 200)
    return () => clearTimeout(t)
  }, [patientSearch, selectedPatient])

  useEffect(() => {
    if (!selectedPatient) { setOpenAdmission(null); return }
    patientsService.getOpenAdmission(selectedPatient.id)
      .then(setOpenAdmission)
      .catch((e) => console.error(e))
  }, [selectedPatient])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!prescSearch.trim() || selectedPresc) return setPrescResults([])
      try { setPrescResults(await prescribersService.search(prescSearch)) }
      catch (e) { console.error(e) }
    }, 200)
    return () => clearTimeout(t)
  }, [prescSearch, selectedPresc])

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = itemSearch.trim()
      if (!q) { setItemResults([]); return }
      setSearchingItems(true)
      const { data, error: err } = await supabase
        .from('pharmacy_items')
        .select('id, code, name, unit, current_stock, is_mav, medication_class')
        .eq('is_active', true)
        .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
        .order('name')
        .limit(20)
      if (err) console.error(err)
      setItemResults((data || []) as PharmacyItemRow[])
      setSearchingItems(false)
    }, 200)
    return () => clearTimeout(t)
  }, [itemSearch])

  async function loadLots(itemId: string): Promise<LotRow[]> {
    if (lotsByItem[itemId]) return lotsByItem[itemId]
    const { data, error: err } = await supabase
      .from('expiry_tracking')
      .select('id, batch_number, expiry_date, current_quantity')
      .eq('item_id', itemId)
      .gt('current_quantity', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
    if (err) console.error(err)
    const lots = (data || []) as LotRow[]
    setLotsByItem((p) => ({ ...p, [itemId]: lots }))
    return lots
  }

  // Adiciona o item já com o lote FEFO (primeiro por validade) selecionado.
  async function addItem(item: PharmacyItemRow) {
    if (selectedItems.some((s) => s.item_id === item.id)) {
      setItemSearch(''); setItemResults([])
      return
    }
    setAddingItem(item.id)
    try {
      const lots = await loadLots(item.id)
      const fefo = lots[0]
      setSelectedItems((prev) => [
        ...prev,
        {
          item_id: item.id, name: item.name, code: item.code || '', unit: item.unit || 'UN',
          is_mav: item.is_mav, medication_class: item.medication_class,
          expiry_tracking_id: fefo?.id ?? null,
          batch_number: fefo?.batch_number ?? null,
          expiry_date: fefo?.expiry_date ?? null,
          available_in_batch: fefo ? fefo.current_quantity : item.current_stock,
          item_stock: item.current_stock,
          quantity: 1,
        },
      ])
      setItemSearch(''); setItemResults([])
    } finally {
      setAddingItem(null)
    }
  }

  function changeLot(idx: number, lotId: string) {
    setSelectedItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it
      if (!lotId) {
        const avail = it.item_stock
        return { ...it, expiry_tracking_id: null, batch_number: null, expiry_date: null, available_in_batch: avail, quantity: Math.min(it.quantity, Math.max(1, avail)) }
      }
      const lot = (lotsByItem[it.item_id] || []).find((l) => l.id === lotId)
      if (!lot) return it
      return {
        ...it, expiry_tracking_id: lot.id, batch_number: lot.batch_number,
        expiry_date: lot.expiry_date, available_in_batch: lot.current_quantity,
        quantity: Math.min(it.quantity, Math.max(1, lot.current_quantity)),
      }
    }))
  }

  function removeItem(idx: number) {
    setSelectedItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function setQty(idx: number, qty: number) {
    setSelectedItems((prev) => prev.map((it, i) =>
      i === idx ? { ...it, quantity: Math.max(1, qty) } : it
    ))
  }

  function fmt(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  }

  function expiryColor(d: string | null | undefined): string {
    if (!d) return mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
    const days = Math.floor((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000)
    if (days < 0) return 'rgba(239,68,68,0.15)'
    if (days <= 30) return 'rgba(239,68,68,0.10)'
    if (days <= 90) return 'rgba(245,158,11,0.10)'
    return 'rgba(16,185,129,0.10)'
  }

  async function trySubmit() {
    setError('')
    if (hasMav) { setShowMavConfirm(true); setMavConfirmText(''); return }
    await doSubmit()
  }

  async function doSubmit() {
    setSubmitting(true); setError('')
    try {
      const result = await pharmacyDispensationService.create({
        patient_name: selectedPatient!.full_name,
        medical_record_number: selectedPatient!.medical_record_number,
        prescribing_doctor: `${selectedPresc!.name} (CRM ${selectedPresc!.crm}/${selectedPresc!.crm_uf})`,
        prescription_number: prescriptionNumber.trim(),
        prescription_date: prescriptionDate,
        patient_id: selectedPatient!.id,
        admission_id: openAdmission?.id ?? null,
        prescriber_id: selectedPresc!.id,
        mav_confirmado: hasMav ? true : false,
        items: selectedItems.map((i) => ({
          item_id: i.item_id, quantity: i.quantity,
          expiry_tracking_id: i.expiry_tracking_id,
          batch_number: i.batch_number, expiry_date: i.expiry_date,
        })),
      })
      const msg = result?.needsApproval
        ? 'Aguardando aprovação do farmacêutico'
        : 'Dispensação registrada com sucesso'
      navigate('/dispensacao', { state: { successMsg: msg } })
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setSubmitting(false); setShowMavConfirm(false)
    }
  }

  const canAdvance: boolean[] = [
    !!selectedPatient,
    !!prescriptionDate && !!prescriptionNumber.trim(),
    !!selectedPresc,
    selectedItems.length > 0 && selectedItems.every((i) => i.quantity > 0 && i.quantity <= i.available_in_batch),
    true,
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dispensacao')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
            background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
            color: txt,
          }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: txt }}>Nova Dispensação</h1>
          <p className="text-sm" style={{ color: txtSec }}>Dispensação de medicamentos por prescrição médica</p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="p-4" style={card}>
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = i === step
            const done = i < step
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all"
                  style={{
                    background: done
                      ? 'rgba(16,185,129,0.85)'
                      : active
                      ? 'rgba(59,130,246,0.85)'
                      : mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    color: done || active ? '#fff' : txtMut,
                    border: active ? '2px solid rgba(59,130,246,0.6)' : '2px solid transparent',
                  }}>
                  {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>
                <span className="text-xs font-medium hidden sm:block" style={{ color: active ? txt : txtMut }}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 h-1 rounded-full" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{ width: `${(step / (STEPS.length - 1)) * 100}%`, background: 'rgba(59,130,246,0.7)' }}
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-100 border border-red-200 flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Etapa 1 — Paciente */}
      {step === 0 && (
        <div className="p-6 space-y-4" style={card}>
          <h2 className="text-lg font-semibold" style={{ color: txt }}>Etapa 1 — Paciente</h2>

          {selectedPatient ? (
            <div className="p-4 rounded-xl flex items-center justify-between"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <div className="flex items-center gap-3">
                <UserCheck size={20} className="text-emerald-500" />
                <div>
                  <p className="font-semibold" style={{ color: txt }}>{selectedPatient.full_name}</p>
                  <p className="text-sm" style={{ color: txtSec }}>
                    Prontuário {selectedPatient.medical_record_number}
                    {' · '}
                    {openAdmission
                      ? `Internado desde ${fmt(openAdmission.admission_date)}`
                      : 'Sem internação aberta'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setSelectedPatient(null); setPatientSearch('') }}>
                Trocar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <label style={lbl}>Buscar por prontuário ou nome *</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
                <input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Nome do paciente ou número do prontuário..."
                  style={{ ...inputStyle, paddingLeft: 36 }}
                  autoFocus
                />
                {patientResults.length > 0 && (
                  <div style={dropdownStyle}>
                    {patientResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatientResults([]) }}
                        className="w-full text-left px-4 py-3 block"
                        style={{ borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}` }}>
                        <p className="text-sm font-medium" style={{ color: txt }}>{p.full_name}</p>
                        <p className="text-xs" style={{ color: txtMut }}>Prontuário {p.medical_record_number} · {fmt(p.birth_date)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs" style={{ color: txtMut }}>
                Paciente não cadastrado?{' '}
                <a href="/farmacia/pacientes" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                  Cadastrar agora
                </a>
              </p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setStep(1)}
              disabled={!canAdvance[0]}
              className="bg-blue-600 hover:bg-blue-700 text-white">
              Confirmar Paciente <ArrowRight size={14} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Etapa 2 — Prescrição */}
      {step === 1 && (
        <div className="p-6 space-y-4" style={card}>
          <h2 className="text-lg font-semibold" style={{ color: txt }}>Etapa 2 — Dados da Prescrição</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={lbl}>Número da Prescrição *</label>
              <input
                value={prescriptionNumber}
                onChange={(e) => setPrescriptionNumber(e.target.value)}
                placeholder="Ex: 2026-000123"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <label style={lbl}>Data da Prescrição *</label>
              <input
                type="date"
                value={prescriptionDate}
                onChange={(e) => setPrescriptionDate(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft size={14} className="mr-2" /> Voltar
            </Button>
            <Button
              onClick={() => setStep(2)}
              disabled={!canAdvance[1]}
              className="bg-blue-600 hover:bg-blue-700 text-white">
              Continuar <ArrowRight size={14} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Etapa 3 — Prescritor */}
      {step === 2 && (
        <div className="p-6 space-y-4" style={card}>
          <h2 className="text-lg font-semibold" style={{ color: txt }}>Etapa 3 — Prescritor</h2>

          {selectedPresc ? (
            <div className="p-4 rounded-xl flex items-center justify-between"
              style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <div className="flex items-center gap-3">
                <Stethoscope size={20} className="text-blue-500" />
                <div>
                  <p className="font-semibold" style={{ color: txt }}>{selectedPresc.name}</p>
                  <p className="text-sm" style={{ color: txtSec }}>CRM {selectedPresc.crm}/{selectedPresc.crm_uf}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setSelectedPresc(null); setPrescSearch('') }}>
                Trocar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <label style={lbl}>Buscar por nome ou CRM *</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
                <input
                  value={prescSearch}
                  onChange={(e) => setPrescSearch(e.target.value)}
                  placeholder="Nome do prescritor ou CRM..."
                  style={{ ...inputStyle, paddingLeft: 36 }}
                  autoFocus
                />
                {prescResults.length > 0 && (
                  <div style={dropdownStyle}>
                    {prescResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPresc(p); setPrescSearch(''); setPrescResults([]) }}
                        className="w-full text-left px-4 py-3 block"
                        style={{ borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}` }}>
                        <p className="text-sm font-medium" style={{ color: txt }}>{p.name}</p>
                        <p className="text-xs" style={{ color: txtMut }}>CRM {p.crm}/{p.crm_uf}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft size={14} className="mr-2" /> Voltar
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!canAdvance[2]}
              className="bg-blue-600 hover:bg-blue-700 text-white">
              Confirmar Prescritor <ArrowRight size={14} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Etapa 4 — Medicamentos */}
      {step === 3 && (
        <div className="p-6 space-y-4" style={card}>
          <h2 className="text-lg font-semibold" style={{ color: txt }}>Etapa 4 — Medicamentos</h2>
          <p className="text-xs" style={{ color: txtMut }}>
            Busque e clique para adicionar. O lote que vence primeiro (FEFO) é escolhido automaticamente — você pode trocar abaixo.
          </p>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
            <input
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Buscar medicamento por nome ou código..."
              style={{ ...inputStyle, paddingLeft: 36 }}
            />
            {itemSearch.trim() && (
              <div style={dropdownStyle}>
                {searchingItems ? (
                  <div className="flex items-center gap-2 text-sm px-4 py-3" style={{ color: txtMut }}>
                    <Loader2 size={14} className="animate-spin" /> Buscando...
                  </div>
                ) : itemResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm" style={{ color: txtMut }}>Nenhum medicamento encontrado.</div>
                ) : itemResults.map((i) => {
                  const already = selectedItems.some((s) => s.item_id === i.id)
                  const out = i.current_stock <= 0
                  return (
                    <button
                      key={i.id}
                      onClick={() => addItem(i)}
                      disabled={already || addingItem === i.id}
                      className="w-full text-left px-4 py-3 block disabled:opacity-50"
                      style={{ borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}` }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium flex items-center gap-1" style={{ color: txt }}>
                          <Pill size={13} /> {i.name}
                          {i.is_mav && (
                            <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">⚠️ MAV</span>
                          )}
                          {already && <span className="ml-1 text-xs" style={{ color: txtMut }}>(já adicionado)</span>}
                        </p>
                        <span className="text-xs ml-2 flex items-center gap-1" style={{ color: out ? '#dc2626' : txtMut }}>
                          {addingItem === i.id && <Loader2 size={12} className="animate-spin" />}
                          {i.current_stock} {i.unit || 'UN'}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: txtMut }}>{i.code || 'sem código'}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selectedItems.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: txtMut }}>
              Nenhum medicamento adicionado. Use a busca acima.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((it, idx) => {
                const lots = lotsByItem[it.item_id] || []
                const over = it.quantity > it.available_in_batch
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl space-y-2"
                    style={{
                      background: it.is_mav ? 'rgba(245,158,11,0.08)' : mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${it.is_mav ? 'rgba(245,158,11,0.3)' : mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                    }}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium flex items-center gap-1 flex-wrap" style={{ color: txt }}>
                          <Pill size={13} /> {it.name}
                          {it.is_mav && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 border border-amber-300">⚠️ MAV</span>
                          )}
                        </p>
                        <p className="text-xs" style={{ color: txtMut }}>{it.code || 'sem código'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={it.available_in_batch}
                          value={it.quantity}
                          onChange={(e) => setQty(idx, parseInt(e.target.value) || 1)}
                          onWheel={(e) => e.currentTarget.blur()}
                          style={{ ...inputStyle, width: 80, borderColor: over ? '#dc2626' : (inputStyle.border as string) }}
                        />
                        <span className="text-xs" style={{ color: txtMut }}>{it.unit}</span>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => removeItem(idx)}
                          className="text-red-600 border-red-200 hover:bg-red-50 h-8 px-2">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>

                    {/* Seletor de lote (FEFO por padrão) */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: txtMut }}>Lote</span>
                      <select
                        value={it.expiry_tracking_id ?? ''}
                        onChange={(e) => changeLot(idx, e.target.value)}
                        style={{ ...inputStyle, width: 'auto', minWidth: 260, padding: '6px 10px', background: expiryColor(it.expiry_date) }}>
                        {lots.length === 0 && <option value="">Sem lote — estoque agregado ({it.item_stock} {it.unit})</option>}
                        {lots.map((l, li) => (
                          <option key={l.id} value={l.id}>
                            {li === 0 ? '★ FEFO · ' : ''}Lote {l.batch_number} · Val {fmt(l.expiry_date)} · {l.current_quantity} un
                          </option>
                        ))}
                        {lots.length > 0 && <option value="">Sem lote — estoque agregado ({it.item_stock} {it.unit})</option>}
                      </select>
                      <span className="text-xs" style={{ color: over ? '#dc2626' : txtMut }}>
                        Disponível: {it.available_in_batch}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {hasMav && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800">
                <strong>Atenção:</strong> contém Medicamento(s) de Alta Vigilância. Será solicitada confirmação <strong>"CONFIRMO"</strong> antes de salvar.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft size={14} className="mr-2" /> Voltar
            </Button>
            <Button
              onClick={() => setStep(STEP_RESUMO)}
              disabled={!canAdvance[3]}
              className="bg-blue-600 hover:bg-blue-700 text-white">
              Revisar Resumo <ArrowRight size={14} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Etapa 5 — Resumo */}
      {step === STEP_RESUMO && (
        <div className="p-6 space-y-5" style={card}>
          <h2 className="text-lg font-semibold" style={{ color: txt }}>Etapa 5 — Resumo</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl space-y-1"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: txtMut }}>Paciente</p>
              <p className="font-semibold" style={{ color: txt }}>{selectedPatient?.full_name}</p>
              <p className="text-sm" style={{ color: txtSec }}>
                Prontuário {selectedPatient?.medical_record_number}
                {openAdmission ? ` · Internado desde ${fmt(openAdmission.admission_date)}` : ''}
              </p>
            </div>

            <div className="p-4 rounded-xl space-y-1"
              style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: txtMut }}>Prescritor</p>
              <p className="font-semibold" style={{ color: txt }}>{selectedPresc?.name}</p>
              <p className="text-sm" style={{ color: txtSec }}>CRM {selectedPresc?.crm}/{selectedPresc?.crm_uf}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-2"
            style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: txtMut }}>Nº da Prescrição</p>
              <p className="font-semibold" style={{ color: txt }}>{prescriptionNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: txtMut }}>Data da Prescrição</p>
              <p className="font-semibold" style={{ color: txt }}>{fmt(prescriptionDate)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: txtMut }}>
              Medicamentos ({selectedItems.length})
            </p>
            {selectedItems.map((it, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl flex items-center justify-between gap-2"
                style={{
                  background: it.is_mav ? 'rgba(245,158,11,0.08)' : mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${it.is_mav ? 'rgba(245,158,11,0.25)' : mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}`,
                }}>
                <div>
                  <p className="text-sm font-medium flex items-center gap-1" style={{ color: txt }}>
                    <Pill size={13} /> {it.name}
                    {it.is_mav && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 border border-amber-300">⚠️ MAV</span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: txtMut }}>
                    {it.batch_number ? `Lote ${it.batch_number} · Val ${fmt(it.expiry_date)}` : 'Sem lote específico'}
                  </p>
                </div>
                <span className="text-sm font-bold" style={{ color: txt }}>
                  {it.quantity} {it.unit}
                </span>
              </div>
            ))}
          </div>

          {needsApproval && (
            <div className="p-4 rounded-xl flex items-start gap-3 bg-amber-50 border border-amber-200">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-amber-800">
                <strong>Esta dispensação requer aprovação farmacêutica.</strong> Ela ficará com status
                "Aguardando aprovação" até que um farmacêutico autorize.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft size={14} className="mr-2" /> Voltar
              </Button>
              <Button variant="outline" onClick={() => setStep(0)}>
                Editar do início
              </Button>
            </div>
            <Button
              onClick={trySubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting
                ? <Loader2 size={14} className="mr-2 animate-spin" />
                : <CheckCircle2 size={14} className="mr-2" />}
              Confirmar Dispensação
            </Button>
          </div>
        </div>
      )}

      {/* Modal MAV */}
      {showMavConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md p-6 space-y-4" style={card}>
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle size={20} />
              <h3 className="text-lg font-bold" style={{ color: txt }}>ATENÇÃO — Medicamento de Alta Vigilância</h3>
            </div>
            <p className="text-sm" style={{ color: txt }}>
              Esta dispensação contém <strong>{selectedItems.filter((i) => i.is_mav).length} MAV(s)</strong>:
            </p>
            <ul className="space-y-1 text-sm">
              {selectedItems.filter((i) => i.is_mav).map((i, idx) => (
                <li key={idx} className="p-2 rounded-lg bg-amber-50 border border-amber-200" style={{ color: txt }}>
                  <strong>{i.name}</strong> — {i.quantity} {i.unit}
                  {i.batch_number && (
                    <span style={{ color: txtSec }}> · Lote {i.batch_number}, Val {fmt(i.expiry_date)}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="text-xs space-y-0.5" style={{ color: txtSec }}>
              <p>✓ Paciente: {selectedPatient?.full_name} ({selectedPatient?.medical_record_number})</p>
              <p>✓ Prescritor: {selectedPresc?.name} (CRM {selectedPresc?.crm})</p>
              <p>✓ Prescrição: {prescriptionNumber} · {fmt(prescriptionDate)}</p>
            </div>
            <div>
              <label style={lbl}>Para confirmar, digite "CONFIRMO" *</label>
              <input
                value={mavConfirmText}
                onChange={(e) => setMavConfirmText(e.target.value)}
                style={inputStyle}
                placeholder="CONFIRMO"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowMavConfirm(false)}>Cancelar</Button>
              <Button
                onClick={doSubmit}
                disabled={mavConfirmText.trim().toUpperCase() !== 'CONFIRMO' || submitting}
                className="bg-amber-600 hover:bg-amber-700 text-white">
                {submitting ? <Loader2 size={14} className="mr-2 animate-spin" /> : <AlertTriangle size={14} className="mr-2" />}
                Confirmar MAV
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
