// =====================================================================
// Nova Dispensacao — F4 do redesenho farmacia.
// - Paciente vinculado da tabela patients (autocomplete)
// - Prescritor vinculado da tabela prescribers (autocomplete)
// - Lote/validade na escolha do medicamento (FEFO sugere o que vence antes)
// - Alerta MAV com modal "CONFIRMO" antes de salvar
// - Usuario identificado pelo login (campo created_by automatico)
// =====================================================================

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/theme'
import {
  ArrowLeft, Search, Plus, Trash2, Loader2, AlertCircle, AlertTriangle,
  UserCheck, Stethoscope, Pill, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { pharmacyDispensationService } from '@/lib/services/pharmacy-dispensation'
import { patientsService, prescribersService } from '@/lib/services/farmacia-cadastros'
import type { Patient, Prescriber, PatientAdmission } from '@/lib/types/farmacia'

// Cada linha em selectedItems guarda dados denormalizados pra exibicao.
interface SelectedItem {
  item_id: string
  name: string
  code: string
  unit: string
  is_mav: boolean
  expiry_tracking_id: string | null
  batch_number: string | null
  expiry_date: string | null
  available_in_batch: number   // saldo do lote (ou estoque total se sem lote)
  quantity: number
}

interface PharmacyItemRow {
  id: string
  code: string | null
  name: string
  unit: string
  current_stock: number
  is_mav: boolean
}

interface LotRow {
  id: string                  // expiry_tracking.id
  batch_number: string
  expiry_date: string | null
  current_quantity: number
}

export function NewDispensation() {
  const navigate = useNavigate()
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
  const input: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 10, padding: '10px 14px', fontSize: 14,
    color: txt, outline: 'none', width: '100%',
  }
  const lbl: React.CSSProperties = {
    color: txtSec, fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: 0.5, display: 'block', marginBottom: 4,
  }

  // ---------- Paciente ----------
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [openAdmission, setOpenAdmission] = useState<PatientAdmission | null>(null)

  // ---------- Prescritor ----------
  const [prescSearch, setPrescSearch] = useState('')
  const [prescResults, setPrescResults] = useState<Prescriber[]>([])
  const [selectedPresc, setSelectedPresc] = useState<Prescriber | null>(null)

  // ---------- Dados da prescricao ----------
  const [prescriptionNumber, setPrescriptionNumber] = useState('')
  const [bedRoom, setBedRoom] = useState('')
  const [sector, setSector] = useState('')
  const [notes, setNotes] = useState('')

  // ---------- Medicamentos ----------
  const [itemSearch, setItemSearch] = useState('')
  const [itemResults, setItemResults] = useState<PharmacyItemRow[]>([])
  const [loadingLots, setLoadingLots] = useState<string | null>(null)
  const [lotsByItem, setLotsByItem] = useState<Record<string, LotRow[]>>({})
  const [expandedItem, setExpandedItem] = useState<PharmacyItemRow | null>(null)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])

  // ---------- Submit ----------
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showMavConfirm, setShowMavConfirm] = useState(false)
  const [mavConfirmText, setMavConfirmText] = useState('')

  const hasMav = useMemo(
    () => selectedItems.some((i) => i.is_mav),
    [selectedItems]
  )

  // ---------- Patient search ----------
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

  // ---------- Prescriber search ----------
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!prescSearch.trim() || selectedPresc) return setPrescResults([])
      try { setPrescResults(await prescribersService.search(prescSearch)) }
      catch (e) { console.error(e) }
    }, 200)
    return () => clearTimeout(t)
  }, [prescSearch, selectedPresc])

  // ---------- Item search ----------
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = itemSearch.trim()
      if (!q) return setItemResults([])
      const { data, error } = await supabase
        .from('pharmacy_items')
        .select('id, code, name, unit, current_stock, is_mav')
        .eq('is_active', true)
        .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
        .order('name')
        .limit(20)
      if (error) console.error(error)
      setItemResults((data || []) as PharmacyItemRow[])
    }, 200)
    return () => clearTimeout(t)
  }, [itemSearch])

  async function loadLots(itemId: string): Promise<LotRow[]> {
    if (lotsByItem[itemId]) return lotsByItem[itemId]
    setLoadingLots(itemId)
    try {
      const { data, error } = await supabase
        .from('expiry_tracking')
        .select('id, batch_number, expiry_date, current_quantity')
        .eq('item_id', itemId)
        .gt('current_quantity', 0)
        .order('expiry_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      const lots = (data || []) as LotRow[]
      setLotsByItem((p) => ({ ...p, [itemId]: lots }))
      return lots
    } finally {
      setLoadingLots(null)
    }
  }

  function clickItem(item: PharmacyItemRow) {
    setExpandedItem(item)
    void loadLots(item.id)
  }

  function selectWithLot(item: PharmacyItemRow, lot: LotRow) {
    setSelectedItems((prev) => [
      ...prev,
      {
        item_id: item.id, name: item.name, code: item.code || '', unit: item.unit || 'UN',
        is_mav: item.is_mav,
        expiry_tracking_id: lot.id,
        batch_number: lot.batch_number,
        expiry_date: lot.expiry_date,
        available_in_batch: lot.current_quantity,
        quantity: 1,
      },
    ])
    setExpandedItem(null); setItemSearch('')
  }

  function selectWithoutLot(item: PharmacyItemRow) {
    setSelectedItems((prev) => [
      ...prev,
      {
        item_id: item.id, name: item.name, code: item.code || '', unit: item.unit || 'UN',
        is_mav: item.is_mav,
        expiry_tracking_id: null, batch_number: null, expiry_date: null,
        available_in_batch: item.current_stock,
        quantity: 1,
      },
    ])
    setExpandedItem(null); setItemSearch('')
  }

  function removeItem(idx: number) {
    setSelectedItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function setQty(idx: number, qty: number) {
    setSelectedItems((prev) => prev.map((it, i) =>
      i === idx ? { ...it, quantity: Math.max(1, qty) } : it
    ))
  }

  const canSubmit =
    !!selectedPatient && !!selectedPresc &&
    prescriptionNumber.trim().length > 0 &&
    selectedItems.length > 0 &&
    selectedItems.every((i) => i.quantity > 0 && i.quantity <= i.available_in_batch)

  async function trySubmit() {
    setError('')
    if (!canSubmit) return
    if (hasMav) {
      setShowMavConfirm(true); setMavConfirmText('')
      return
    }
    await doSubmit()
  }

  async function doSubmit() {
    setSubmitting(true); setError('')
    try {
      await pharmacyDispensationService.create({
        patient_name: selectedPatient!.full_name,
        medical_record_number: selectedPatient!.medical_record_number,
        prescribing_doctor: `${selectedPresc!.name} (CRM ${selectedPresc!.crm}/${selectedPresc!.crm_uf})`,
        prescription_number: prescriptionNumber,
        patient_bed_room: bedRoom || undefined,
        sector: sector || undefined,
        notes: notes || undefined,
        patient_id: selectedPatient!.id,
        admission_id: openAdmission?.id ?? null,
        prescriber_id: selectedPresc!.id,
        items: selectedItems.map((i) => ({
          item_id: i.item_id,
          quantity: i.quantity,
          expiry_tracking_id: i.expiry_tracking_id,
          batch_number: i.batch_number,
          expiry_date: i.expiry_date,
        })),
      })
      navigate('/dispensacao')
    } catch (e: any) {
      setError(e?.message || 'Erro ao registrar dispensação')
    } finally {
      setSubmitting(false); setShowMavConfirm(false)
    }
  }

  function fmt(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  }
  function expiryColor(d: string | null | undefined): string {
    if (!d) return 'rgba(0,0,0,0.05)'
    const days = Math.floor((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000)
    if (days < 0) return 'rgba(239,68,68,0.15)'
    if (days <= 30) return 'rgba(239,68,68,0.10)'
    if (days <= 90) return 'rgba(245,158,11,0.10)'
    return 'rgba(16,185,129,0.10)'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dispensacao')}
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
          <p className="text-sm" style={{ color: txtSec }}>
            Dispensação de medicamentos por prescrição médica
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-100 border border-red-200 flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="p-6 space-y-4" style={card}>
        <h2 className="text-lg font-semibold" style={{ color: txt }}>Dados da Prescrição</h2>

        {/* Paciente */}
        <div>
          <label style={lbl}>Paciente *</label>
          {selectedPatient ? (
            <div className="p-3 rounded-lg flex items-center justify-between"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <div className="flex items-center gap-2">
                <UserCheck size={18} className="text-emerald-600" />
                <div>
                  <p className="font-medium" style={{ color: txt }}>{selectedPatient.full_name}</p>
                  <p className="text-xs" style={{ color: txtSec }}>
                    Prontuário {selectedPatient.medical_record_number} · Nasc. {fmt(selectedPatient.birth_date)}
                    {openAdmission
                      ? ` · 🟢 Internado desde ${fmt(openAdmission.admission_date)}`
                      : ' · ⚪ Sem internação aberta'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setSelectedPatient(null); setPatientSearch('') }}>
                Trocar
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
              <input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Buscar por nome ou prontuário..."
                style={{ ...input, paddingLeft: 36 }} />
              {patientResults.length > 0 && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg"
                  style={{ border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
                  {patientResults.map((p) => (
                    <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatientResults([]) }}
                      className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-white/5 block">
                      <p className="text-sm font-medium" style={{ color: txt }}>{p.full_name}</p>
                      <p className="text-xs" style={{ color: txtMut }}>Prontuário {p.medical_record_number} · {fmt(p.birth_date)}</p>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs mt-1" style={{ color: txtMut }}>
                Não está cadastrado? Cadastre em <strong>Cadastros Farmácia → Pacientes</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Prescritor */}
        <div>
          <label style={lbl}>Prescritor (médico) *</label>
          {selectedPresc ? (
            <div className="p-3 rounded-lg flex items-center justify-between"
              style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <div className="flex items-center gap-2">
                <Stethoscope size={18} className="text-blue-600" />
                <div>
                  <p className="font-medium" style={{ color: txt }}>{selectedPresc.name}</p>
                  <p className="text-xs" style={{ color: txtSec }}>CRM {selectedPresc.crm}/{selectedPresc.crm_uf}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setSelectedPresc(null); setPrescSearch('') }}>
                Trocar
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
              <input value={prescSearch} onChange={(e) => setPrescSearch(e.target.value)}
                placeholder="Buscar por nome ou CRM..."
                style={{ ...input, paddingLeft: 36 }} />
              {prescResults.length > 0 && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg"
                  style={{ border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
                  {prescResults.map((p) => (
                    <button key={p.id} onClick={() => { setSelectedPresc(p); setPrescSearch(''); setPrescResults([]) }}
                      className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-white/5 block">
                      <p className="text-sm font-medium" style={{ color: txt }}>{p.name}</p>
                      <p className="text-xs" style={{ color: txtMut }}>CRM {p.crm}/{p.crm_uf}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label style={lbl}>Nº Prescrição *</label>
            <input value={prescriptionNumber} onChange={(e) => setPrescriptionNumber(e.target.value)}
              placeholder="Ex: PRESC-2026-001" style={input} />
          </div>
          <div>
            <label style={lbl}>Leito / Quarto</label>
            <input value={bedRoom} onChange={(e) => setBedRoom(e.target.value)}
              placeholder="Ex: Enf. 3 - Leito 12" style={input} />
          </div>
          <div>
            <label style={lbl}>Setor</label>
            <input value={sector} onChange={(e) => setSector(e.target.value)}
              placeholder="Ex: UTI, Enfermaria" style={input} />
          </div>
        </div>

        <div>
          <label style={lbl}>Observações</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Observações adicionais..." style={{ ...input, resize: 'vertical' as const }} />
        </div>
      </div>

      <div className="p-6 space-y-4" style={card}>
        <h2 className="text-lg font-semibold" style={{ color: txt }}>Medicamentos</h2>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
          <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)}
            placeholder="Buscar medicamento por nome ou código..."
            style={{ ...input, paddingLeft: 36 }} />
          {itemSearch && itemResults.length > 0 && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg"
              style={{ border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
              {itemResults.map((i) => (
                <button key={i.id} onClick={() => clickItem(i)}
                  className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-white/5 block">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-1" style={{ color: txt }}>
                      <Pill size={14} />
                      {i.name}
                      {i.is_mav && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          ⚠️ MAV
                        </span>
                      )}
                    </p>
                    <span className="text-xs" style={{ color: txtMut }}>
                      {i.current_stock} {i.unit || 'UN'} em estoque
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: txtMut }}>{i.code || 'sem código'}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {expandedItem && (
          <div className="p-4 rounded-lg"
            style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                     border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: txt }}>
                  Lotes disponíveis — {expandedItem.name}
                </p>
                <p className="text-xs" style={{ color: txtMut }}>
                  Ordenados por FEFO (mais próximo do vencimento primeiro)
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setExpandedItem(null)}>Fechar</Button>
            </div>

            {loadingLots === expandedItem.id ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: txtMut }}>
                <Loader2 size={14} className="animate-spin" /> Carregando lotes...
              </div>
            ) : (lotsByItem[expandedItem.id] || []).length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm" style={{ color: txtMut }}>
                  Este medicamento não tem lotes rastreados via NF.
                  Você pode dispensar do estoque agregado:
                </p>
                <Button size="sm" onClick={() => selectWithoutLot(expandedItem)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus size={14} className="mr-1" /> Dispensar sem lote ({expandedItem.current_stock} {expandedItem.unit})
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {(lotsByItem[expandedItem.id] || []).map((lot, idx) => (
                  <div key={lot.id}
                    className="flex items-center justify-between gap-2 p-2 rounded"
                    style={{ background: expiryColor(lot.expiry_date) }}>
                    <div className="text-sm flex items-center gap-3 flex-wrap">
                      {idx === 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300">FEFO ←</span>}
                      <span style={{ color: txt }}>Lote <strong>{lot.batch_number}</strong></span>
                      <span style={{ color: txtSec }}>Validade {fmt(lot.expiry_date)}</span>
                      <span style={{ color: txtMut }}>{lot.current_quantity} un</span>
                    </div>
                    <Button size="sm" onClick={() => selectWithLot(expandedItem, lot)}>
                      <Plus size={14} className="mr-1" /> Usar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedItems.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: txtMut }}>
            Nenhum medicamento adicionado. Use a busca acima.
          </p>
        ) : (
          <div className="space-y-2">
            {selectedItems.map((it, idx) => (
              <div key={idx} className="p-3 rounded-lg flex items-center gap-3 flex-wrap"
                style={{ background: it.is_mav ? 'rgba(245,158,11,0.08)' : (mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'),
                         border: `1px solid ${it.is_mav ? 'rgba(245,158,11,0.3)' : (mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium flex items-center gap-1 flex-wrap" style={{ color: txt }}>
                    <Pill size={14} /> {it.name}
                    {it.is_mav && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 border border-amber-300">
                        ⚠️ MAV
                      </span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: txtMut }}>
                    {it.batch_number ? `Lote ${it.batch_number} · Val ${fmt(it.expiry_date)}` : 'Sem lote específico'}
                    {' · '}Saldo disponível: {it.available_in_batch}
                  </p>
                </div>
                <input type="number" min={1} max={it.available_in_batch}
                  value={it.quantity}
                  onChange={(e) => setQty(idx, parseInt(e.target.value) || 1)}
                  onWheel={(e) => e.currentTarget.blur()}
                  style={{ ...input, width: 80 }} />
                <span className="text-xs" style={{ color: txtMut }}>{it.unit}</span>
                <Button variant="outline" size="sm" onClick={() => removeItem(idx)}
                  className="text-red-600 border-red-200 hover:bg-red-50 h-8 px-2">
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {hasMav && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-amber-800">
              <strong>Atenção:</strong> esta dispensação contém Medicamento(s) de Alta Vigilância.
              Ao confirmar, será solicitada a digitação de <strong>"CONFIRMO"</strong> para dupla checagem.
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/dispensacao')}>Cancelar</Button>
        <Button onClick={trySubmit} disabled={!canSubmit || submitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {submitting ? <Loader2 size={14} className="mr-2 animate-spin" /> : <CheckCircle2 size={14} className="mr-2" />}
          Confirmar Dispensação
        </Button>
      </div>

      {showMavConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md p-6 space-y-4" style={card}>
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle size={20} />
              <h3 className="text-lg font-bold">ATENÇÃO — Medicamento de Alta Vigilância</h3>
            </div>
            <p className="text-sm" style={{ color: txt }}>
              Esta dispensação contém <strong>{selectedItems.filter((i) => i.is_mav).length} MAV(s)</strong>:
            </p>
            <ul className="space-y-1 text-sm">
              {selectedItems.filter((i) => i.is_mav).map((i, idx) => (
                <li key={idx} className="p-2 rounded bg-amber-50 border border-amber-200" style={{ color: txt }}>
                  • <strong>{i.name}</strong> — {i.quantity} {i.unit}
                  {i.batch_number && <span style={{ color: txtSec }}> · Lote {i.batch_number}, Val {fmt(i.expiry_date)}</span>}
                </li>
              ))}
            </ul>
            <div className="text-sm space-y-2" style={{ color: txt }}>
              <p>Revise antes de confirmar:</p>
              <ul className="ml-4 text-xs space-y-0.5" style={{ color: txtSec }}>
                <li>✓ Paciente: {selectedPatient?.full_name} (prontuário {selectedPatient?.medical_record_number})</li>
                <li>✓ Prescritor: {selectedPresc?.name} (CRM {selectedPresc?.crm})</li>
                <li>✓ Nº prescrição: {prescriptionNumber}</li>
              </ul>
            </div>
            <div>
              <label style={lbl}>Para confirmar, digite "CONFIRMO" abaixo *</label>
              <input value={mavConfirmText} onChange={(e) => setMavConfirmText(e.target.value)}
                style={input} placeholder="CONFIRMO" autoFocus />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowMavConfirm(false)}>Cancelar</Button>
              <Button onClick={doSubmit}
                disabled={mavConfirmText.trim().toUpperCase() !== 'CONFIRMO' || submitting}
                className="bg-amber-600 hover:bg-amber-700 text-white">
                {submitting ? <Loader2 size={14} className="mr-2 animate-spin" /> : <AlertTriangle size={14} className="mr-2" />}
                Confirmar Dispensação MAV
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
