// =====================================================================
// Notificação de Receita (Portaria 344/98)
// Tabela notificacao_receita — registro de receituário controlado
// =====================================================================

import { useEffect, useState, useMemo } from 'react'
import {
  ClipboardList, Plus, Edit2, Trash2, Search, Loader2, AlertCircle, X, Download,
} from 'lucide-react'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/theme'
import {
  notificacaoReceitaService,
  type NotificacaoReceita as NotificacaoReceitaRow,
  type CreateNotificacaoReceitaData,
  type TipoNotificacao,
} from '@/lib/services/notificacao-receita'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/utils/error-messages'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PatientOption {
  id: string
  full_name: string
  medical_record_number: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SUBTIPOS: Record<TipoNotificacao, string[]> = {
  A: ['A1', 'A2', 'A3'],
  B: ['B1', 'B2'],
  C_ESPECIAL: ['C1', 'C2', 'C3'],
}

const TIPO_LABEL: Record<TipoNotificacao, string> = {
  A: 'A (Amarela)',
  B: 'B (Azul)',
  C_ESPECIAL: 'C Especial (Branca)',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
function TipoBadge({ tipo }: { tipo: TipoNotificacao }) {
  const map: Record<TipoNotificacao, { label: string; cls: string }> = {
    A:          { label: 'A — Amarela', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    B:          { label: 'B — Azul',    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    C_ESPECIAL: { label: 'C — Branca',  cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  }
  const { label, cls } = map[tipo] || map.A
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${cls}`}>
      {label}
    </span>
  )
}

function RetidaBadge({ retida }: { retida: boolean | null | undefined }) {
  return retida
    ? <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Sim</span>
    : <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border bg-gray-100 text-gray-600 border-gray-200">Não</span>
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function NotificacaoReceita() {
  const { mode } = useTheme()

  const txt    = mode === 'dark' ? '#fff' : '#0d2e1c'
  const txtSec = mode === 'dark' ? 'rgba(255,255,255,0.7)'  : 'rgba(13,46,28,0.65)'
  const txtMut = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(13,46,28,0.45)'

  const card: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(10,15,20,0.55)' : 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
    borderRadius: 16,
  }
  const inp: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 10, padding: '9px 12px', fontSize: 14,
    color: txt, outline: 'none', width: '100%',
  }
  const lbl: React.CSSProperties = {
    color: txtSec, fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4,
  }
  const divider: React.CSSProperties = {
    borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    marginTop: 12, paddingTop: 12,
  }

  // Data
  const [rows, setRows]       = useState<NotificacaoReceitaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')
  const [filterTipo, setFilterTipo] = useState<TipoNotificacao | ''>('')

  // Patients for dropdown
  const [patients, setPatients] = useState<PatientOption[]>([])

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  // ----- Form state -----
  const blankForm = (): CreateNotificacaoReceitaData => ({
    tipo: 'A', subtipo: '', numero: '', serie_talao: '',
    paciente_id: '', paciente_nome: '',
    prescritor_nome: '', prescritor_registro: '', prescritor_uf: '',
    data_prescricao: '', data_dispensacao: new Date().toISOString().slice(0, 10),
    dispensation_id: '', item_nome: '', quantidade: '',
    retida: true, observacao: '',
  })
  const [form, setForm] = useState<CreateNotificacaoReceitaData>(blankForm())

  // ----- Load -----
  useEffect(() => {
    load()
    loadPatients()
  }, [])

  async function load() {
    setLoading(true); setError('')
    try { setRows(await notificacaoReceitaService.getAll()) }
    catch (e) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  async function loadPatients() {
    const { data } = await supabase
      .from('patients')
      .select('id, full_name, medical_record_number')
      .eq('is_active', true)
      .order('full_name')
      .limit(500)
    if (data) setPatients(data as PatientOption[])
  }

  // ----- Filter -----
  const filtered = useMemo(() => {
    let list = rows
    if (filterTipo) list = list.filter(r => r.tipo === filterTipo)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(r =>
      r.numero.toLowerCase().includes(q) ||
      r.paciente_nome.toLowerCase().includes(q)
    )
    return list
  }, [rows, search, filterTipo])

  // ----- Modal helpers -----
  function set<K extends keyof CreateNotificacaoReceitaData>(k: K, v: CreateNotificacaoReceitaData[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function openNew() {
    setEditingId(null); setForm(blankForm()); setFormError(''); setShowModal(true)
  }

  function openEdit(r: NotificacaoReceitaRow) {
    setEditingId(r.id)
    setForm({
      tipo: r.tipo, subtipo: r.subtipo || '', numero: r.numero,
      serie_talao: r.serie_talao || '',
      paciente_id: r.paciente_id || '', paciente_nome: r.paciente_nome,
      prescritor_nome: r.prescritor_nome || '',
      prescritor_registro: r.prescritor_registro || '',
      prescritor_uf: r.prescritor_uf || '',
      data_prescricao: r.data_prescricao || '',
      data_dispensacao: r.data_dispensacao || '',
      dispensation_id: r.dispensation_id || '',
      item_nome: r.item_nome || '', quantidade: r.quantidade || '',
      retida: r.retida ?? true, observacao: r.observacao || '',
    })
    setFormError(''); setShowModal(true)
  }

  async function save() {
    if (!form.tipo)              { setFormError('Tipo é obrigatório'); return }
    if (!form.numero.trim())     { setFormError('Número da notificação é obrigatório'); return }
    if (!form.paciente_nome.trim()) { setFormError('Nome do paciente é obrigatório'); return }
    setSaving(true); setFormError('')
    try {
      if (editingId) {
        await notificacaoReceitaService.update(editingId, form)
      } else {
        await notificacaoReceitaService.create(form)
      }
      setShowModal(false); await load()
    } catch (e) { setFormError(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  async function remove(r: NotificacaoReceitaRow) {
    if (!window.confirm(`Excluir a notificação nº ${r.numero}?`)) return
    setError('')
    try {
      await notificacaoReceitaService.remove(r.id)
      await load()
    } catch (e) { setError(getErrorMessage(e)) }
  }

  // ----- Export XLSX -----
  function exportXLSX() {
    const headers = [
      'Tipo', 'Subtipo', 'Número', 'Série/Talão', 'Paciente',
      'Prescritor', 'Registro', 'UF', 'Data Prescrição', 'Data Dispensação',
      'Item', 'Quantidade', 'Retida', 'Observação',
    ]
    const dataRows = filtered.map(r => [
      TIPO_LABEL[r.tipo] || r.tipo,
      r.subtipo || '',
      r.numero,
      r.serie_talao || '',
      r.paciente_nome,
      r.prescritor_nome || '',
      r.prescritor_registro || '',
      r.prescritor_uf || '',
      r.data_prescricao ? fmtDate(r.data_prescricao) : '',
      r.data_dispensacao ? fmtDate(r.data_dispensacao) : '',
      r.item_nome || '',
      r.quantidade || '',
      r.retida ? 'Sim' : 'Não',
      r.observacao || '',
    ])

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
    ws['!cols'] = [
      { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 28 },
      { wch: 24 }, { wch: 14 }, { wch: 6 }, { wch: 16 }, { wch: 16 },
      { wch: 28 }, { wch: 14 }, { wch: 8 }, { wch: 40 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Notificações')

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', bookSST: false, compression: true })
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const now = new Date()
    const stamp = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`
    saveAs(blob, `notificacao_receita_${stamp}.xlsx`)
  }

  const subtipoOptions = SUBTIPOS[form.tipo] || []

  // ----- Render -----
  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-purple-100"><ClipboardList className="w-6 h-6 text-purple-600" /></div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: txt }}>Notificação de Receita</h1>
            <p className="text-sm" style={{ color: txtSec }}>Receituário controlado — Portaria 344/98</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportXLSX} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Exportar XLSX
          </Button>
          <Button onClick={openNew} className="bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Nova Notificação
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-100 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="p-4 flex flex-wrap gap-3 items-center" style={card}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
          <input
            placeholder="Buscar por número ou paciente..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inp, paddingLeft: 34 }}
          />
        </div>
        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value as TipoNotificacao | '')}
          style={{ ...inp, width: 'auto', minWidth: 200 }}
        >
          <option value="">Todos os tipos</option>
          <option value="A">A — Amarela</option>
          <option value="B">B — Azul</option>
          <option value="C_ESPECIAL">C Especial — Branca</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto" style={card}>
        {loading ? (
          <div className="flex items-center justify-center p-10" style={{ color: txtMut }}>
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-sm text-center" style={{ color: txtMut }}>Nenhuma notificação encontrada.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                {['Tipo','Número','Paciente','Prescritor','Data dispensação','Item','Retida','Ações'].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase whitespace-nowrap" style={{ color: txtSec }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr
                  key={r.id}
                  style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}
                >
                  <td className="px-3 py-3"><TipoBadge tipo={r.tipo} /></td>
                  <td className="px-3 py-3 font-medium whitespace-nowrap" style={{ color: txt }}>{r.numero}</td>
                  <td className="px-3 py-3" style={{ color: txt }}>{r.paciente_nome}</td>
                  <td className="px-3 py-3" style={{ color: txtSec }}>{r.prescritor_nome || '—'}</td>
                  <td className="px-3 py-3 whitespace-nowrap" style={{ color: txtSec }}>{fmtDate(r.data_dispensacao)}</td>
                  <td className="px-3 py-3" style={{ color: txtSec }}>{r.item_nome || '—'}</td>
                  <td className="px-3 py-3"><RetidaBadge retida={r.retida} /></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="h-7 px-2">
                        <Edit2 size={13} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(r)} className="h-7 px-2 text-red-600 hover:text-red-700">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-3xl my-6 p-6 space-y-5" style={{
            background: mode === 'dark' ? 'rgba(10,15,20,0.95)' : 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
            border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: 18,
          }}>
            {/* Modal header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: txt }}>
                {editingId ? 'Editar Notificação' : 'Nova Notificação de Receita'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ color: txtMut }}><X size={18} /></button>
            </div>

            {formError && (
              <div className="p-2 rounded bg-red-100 border border-red-200 text-red-800 text-sm">{formError}</div>
            )}

            {/* Seção Notificação */}
            <SectionTitle label="Notificação" txt={txt} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Tipo *" style={lbl}>
                <select
                  value={form.tipo}
                  onChange={e => {
                    set('tipo', e.target.value as TipoNotificacao)
                    // Reset subtipo when tipo changes (different option set)
                    set('subtipo', '')
                  }}
                  style={inp as React.CSSProperties}
                >
                  <option value="A">A — Amarela</option>
                  <option value="B">B — Azul</option>
                  <option value="C_ESPECIAL">C Especial — Branca</option>
                </select>
              </Field>
              <Field label="Subtipo" style={lbl}>
                <select value={form.subtipo || ''} onChange={e => set('subtipo', e.target.value)} style={inp as React.CSSProperties}>
                  <option value="">— selecionar —</option>
                  {subtipoOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Número *" style={lbl}>
                <input value={form.numero} onChange={e => set('numero', e.target.value)} style={inp} />
              </Field>
              <Field label="Série / Talão" style={lbl}>
                <input value={form.serie_talao || ''} onChange={e => set('serie_talao', e.target.value)} style={inp} />
              </Field>
            </div>

            {/* Seção Paciente */}
            <div style={divider} />
            <SectionTitle label="Paciente" txt={txt} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Paciente (do cadastro)" style={lbl}>
                <select
                  value={form.paciente_id || ''}
                  onChange={e => {
                    const id = e.target.value
                    const p = patients.find(i => i.id === id)
                    set('paciente_id', id)
                    if (p) set('paciente_nome', p.full_name)
                  }}
                  style={inp as React.CSSProperties}
                >
                  <option value="">— selecionar paciente —</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}{p.medical_record_number ? ` (${p.medical_record_number})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nome do paciente * (ou livre)" style={lbl}>
                <input
                  value={form.paciente_nome}
                  onChange={e => { set('paciente_nome', e.target.value); set('paciente_id', '') }}
                  style={inp}
                  placeholder="Ou preencha manualmente"
                />
              </Field>
            </div>

            {/* Seção Prescritor */}
            <div style={divider} />
            <SectionTitle label="Prescritor" txt={txt} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Nome do prescritor" style={lbl}>
                <input value={form.prescritor_nome || ''} onChange={e => set('prescritor_nome', e.target.value)} style={inp} />
              </Field>
              <Field label="Registro (CRM/CRO)" style={lbl}>
                <input value={form.prescritor_registro || ''} onChange={e => set('prescritor_registro', e.target.value)} style={inp} />
              </Field>
              <Field label="UF" style={lbl}>
                <input value={form.prescritor_uf || ''} onChange={e => set('prescritor_uf', e.target.value)} style={inp} maxLength={2} placeholder="Ex: BA" />
              </Field>
            </div>

            {/* Seção Dispensação */}
            <div style={divider} />
            <SectionTitle label="Dispensação" txt={txt} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Data da prescrição" style={lbl}>
                <input type="date" value={form.data_prescricao || ''} onChange={e => set('data_prescricao', e.target.value)} style={inp} />
              </Field>
              <Field label="Data da dispensação" style={lbl}>
                <input type="date" value={form.data_dispensacao || ''} onChange={e => set('data_dispensacao', e.target.value)} style={inp} />
              </Field>
              <Field label="Item / Medicamento" style={lbl}>
                <input value={form.item_nome || ''} onChange={e => set('item_nome', e.target.value)} style={inp} />
              </Field>
              <Field label="Quantidade" style={lbl}>
                <input value={form.quantidade || ''} onChange={e => set('quantidade', e.target.value)} style={inp} placeholder="Ex: 30 comp." />
              </Field>
            </div>
            <label className="flex items-center gap-2 mt-1" style={{ color: txtSec, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.retida ?? true}
                onChange={e => set('retida', e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Notificação/receita retida
            </label>

            {/* Observação */}
            <div style={divider} />
            <Field label="Observação" style={lbl}>
              <textarea rows={2} value={form.observacao || ''} onChange={e => set('observacao', e.target.value)} style={{ ...inp, resize: 'vertical' as const }} />
            </Field>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">
                {saving && <Loader2 size={14} className="mr-2 animate-spin" />} Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionTitle({ label, txt }: { label: string; txt: string }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: txt }}>
      {label}
    </h3>
  )
}

function Field({ label, style, children }: { label: string; style: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div>
      <label style={style}>{label}</label>
      {children}
    </div>
  )
}
