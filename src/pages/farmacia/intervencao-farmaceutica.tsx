// =====================================================================
// Intervenção Farmacêutica — CRUD com dashboard de indicadores.
// Tabela: pharmaceutical_interventions
// =====================================================================

import { useEffect, useState, useMemo } from 'react'
import {
  Stethoscope, Plus, Edit2, Trash2, Search, Loader2, AlertCircle, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'
import { supabase } from '@/lib/supabase'

// ─── Tipos ───────────────────────────────────────────────────────────

type PRM = 'ADESAO' | 'EFETIVIDADE' | 'INDICACAO' | 'SEGURANCA'
type Acatado = 'SIM' | 'NAO_C_JUST' | 'NAO_S_JUST'
type Gravidade = 'LEVE' | 'MODERADA' | 'GRAVE' | 'MUITO_GRAVE'

const PRM_LABEL: Record<PRM, string> = {
  ADESAO: 'Adesão',
  EFETIVIDADE: 'Efetividade',
  INDICACAO: 'Indicação',
  SEGURANCA: 'Segurança',
}

const ACATADO_LABEL: Record<Acatado, string> = {
  SIM: 'Sim',
  NAO_C_JUST: 'Não (com justificativa)',
  NAO_S_JUST: 'Não (sem justificativa)',
}

const GRAVIDADE_LABEL: Record<Gravidade, string> = {
  LEVE: 'Leve',
  MODERADA: 'Moderada',
  GRAVE: 'Grave',
  MUITO_GRAVE: 'Muito grave',
}

interface Intervencao {
  id: string
  data: string
  paciente: string | null
  unidade: string | null
  leito: string | null
  prontuario: string | null
  contato: string | null
  prm: PRM
  causa: string | null
  tipo_intervencao: string | null
  medicamento: string | null
  descricao: string | null
  acatado: Acatado
  justificativa: string | null
  desfecho_clinico: string | null
  gravidade: Gravidade | null
  farmaceutico: string | null
  data_ultima_verificacao: string | null
  observacao: string | null
  created_at: string
}

// ─── Helpers de badge ────────────────────────────────────────────────

function AcatadoBadge({ value }: { value: Acatado }) {
  const styles: Record<Acatado, string> = {
    SIM: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    NAO_C_JUST: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    NAO_S_JUST: 'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${styles[value]}`}>
      {ACATADO_LABEL[value]}
    </span>
  )
}

function GravidadeBadge({ value }: { value: Gravidade | null }) {
  if (!value) return <span className="text-xs text-gray-400">—</span>
  const styles: Record<Gravidade, string> = {
    LEVE: 'bg-blue-50 text-blue-700 border border-blue-200',
    MODERADA: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    GRAVE: 'bg-orange-50 text-orange-700 border border-orange-200',
    MUITO_GRAVE: 'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${styles[value]}`}>
      {GRAVIDADE_LABEL[value]}
    </span>
  )
}

// ─── Componente principal ────────────────────────────────────────────

export function IntervencaoFarmaceutica() {
  const { user } = useAuth()
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
  const input: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 10, padding: '10px 14px', fontSize: 14,
    color: txt, outline: 'none', width: '100%',
  }
  const lbl: React.CSSProperties = {
    color: txtSec, fontSize: 12, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.5,
    display: 'block', marginBottom: 4,
  }

  // ─── Estado da listagem ────────────────────────────────────────────

  const [rows, setRows]       = useState<Intervencao[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [error, setError]     = useState('')

  // ─── Estado do formulário ──────────────────────────────────────────

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Intervencao | null>(null)
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState('')

  const emptyForm = () => ({
    fData: new Date().toISOString().slice(0, 10),
    fPaciente: '',
    fUnidade: '',
    fLeito: '',
    fProntuario: '',
    fContato: '',
    fPrm: 'ADESAO' as PRM,
    fCausa: '',
    fTipo: '',
    fMedicamento: '',
    fDescricao: '',
    fAcatado: 'SIM' as Acatado,
    fJustificativa: '',
    fDesfecho: '',
    fGravidade: '' as Gravidade | '',
    fFarmaceutico: user?.full_name ?? '',
    fDataVerif: '',
    fObservacao: '',
  })

  const [f, setF] = useState(emptyForm())

  const set = (key: keyof ReturnType<typeof emptyForm>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF(prev => ({ ...prev, [key]: e.target.value }))

  // ─── Carregamento ──────────────────────────────────────────────────

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const { data, error: err } = await supabase
        .from('pharmaceutical_interventions')
        .select('*')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
      if (err) throw err
      setRows((data ?? []) as Intervencao[])
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar intervenções')
    } finally {
      setLoading(false)
    }
  }

  // ─── Filtro ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      (r.paciente ?? '').toLowerCase().includes(q) ||
      (r.medicamento ?? '').toLowerCase().includes(q) ||
      (r.farmaceutico ?? '').toLowerCase().includes(q) ||
      (r.prontuario ?? '').toLowerCase().includes(q) ||
      PRM_LABEL[r.prm].toLowerCase().includes(q)
    )
  }, [rows, search])

  // ─── Dashboard ────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:     rows.length,
    acatadas:  rows.filter(r => r.acatado === 'SIM').length,
    nao_acatadas: rows.filter(r => r.acatado === 'NAO_C_JUST' || r.acatado === 'NAO_S_JUST').length,
    pendentes: rows.filter(r => !r.data_ultima_verificacao).length,
  }), [rows])

  // ─── CRUD ──────────────────────────────────────────────────────────

  function openNew() {
    setEditing(null)
    setF(emptyForm())
    setFormError('')
    setShowForm(true)
  }

  function openEdit(row: Intervencao) {
    setEditing(row)
    setF({
      fData: row.data,
      fPaciente: row.paciente ?? '',
      fUnidade: row.unidade ?? '',
      fLeito: row.leito ?? '',
      fProntuario: row.prontuario ?? '',
      fContato: row.contato ?? '',
      fPrm: row.prm,
      fCausa: row.causa ?? '',
      fTipo: row.tipo_intervencao ?? '',
      fMedicamento: row.medicamento ?? '',
      fDescricao: row.descricao ?? '',
      fAcatado: row.acatado,
      fJustificativa: row.justificativa ?? '',
      fDesfecho: row.desfecho_clinico ?? '',
      fGravidade: (row.gravidade ?? '') as Gravidade | '',
      fFarmaceutico: row.farmaceutico ?? '',
      fDataVerif: row.data_ultima_verificacao ?? '',
      fObservacao: row.observacao ?? '',
    })
    setFormError('')
    setShowForm(true)
  }

  async function save() {
    if (!f.fData) { setFormError('Data é obrigatória.'); return }
    if (!f.fPrm)  { setFormError('PRM é obrigatório.'); return }
    if (!f.fAcatado) { setFormError('Campo "Acatado" é obrigatório.'); return }
    if (f.fAcatado === 'NAO_C_JUST' && !f.fJustificativa.trim()) {
      setFormError('Justificativa é obrigatória quando não acatado com justificativa.')
      return
    }

    setSaving(true); setFormError('')
    const payload = {
      data: f.fData,
      paciente: f.fPaciente || null,
      unidade: f.fUnidade || null,
      leito: f.fLeito || null,
      prontuario: f.fProntuario || null,
      contato: f.fContato || null,
      prm: f.fPrm,
      causa: f.fCausa || null,
      tipo_intervencao: f.fTipo || null,
      medicamento: f.fMedicamento || null,
      descricao: f.fDescricao || null,
      acatado: f.fAcatado,
      justificativa: f.fJustificativa || null,
      desfecho_clinico: f.fDesfecho || null,
      gravidade: (f.fGravidade as Gravidade) || null,
      farmaceutico: f.fFarmaceutico || null,
      data_ultima_verificacao: f.fDataVerif || null,
      observacao: f.fObservacao || null,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editing) {
        const { error: err } = await supabase
          .from('pharmaceutical_interventions')
          .update(payload)
          .eq('id', editing.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('pharmaceutical_interventions')
          .insert(payload)
        if (err) throw err
      }
      setShowForm(false)
      await load()
    } catch (e: any) {
      setFormError(e?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function remove(row: Intervencao) {
    if (!confirm(`Excluir intervenção de "${row.paciente || 'paciente sem nome'}"?`)) return
    try {
      const { error: err } = await supabase
        .from('pharmaceutical_interventions')
        .delete()
        .eq('id', row.id)
      if (err) throw err
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao excluir')
    }
  }

  function fmtDate(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  }

  // ─── Render ────────────────────────────────────────────────────────

  const statCard = (label: string, value: number, color: string) => (
    <div className="p-5 flex flex-col gap-1" style={card}>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: txtSec }}>{label}</span>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-purple-100">
            <Stethoscope className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: txt }}>Intervenção Farmacêutica</h1>
            <p className="text-sm" style={{ color: txtSec }}>Registro e acompanhamento de intervenções</p>
          </div>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Nova Intervenção
        </Button>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCard('Total intervenções', stats.total,        '#7c3aed')}
        {statCard('Acatadas',           stats.acatadas,     '#059669')}
        {statCard('Não acatadas',       stats.nao_acatadas, '#dc2626')}
        {statCard('Pendentes verificação', stats.pendentes, '#d97706')}
      </div>

      {/* Erro global */}
      {error && (
        <div className="p-3 rounded-lg bg-red-100 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Busca */}
      <div className="p-4" style={card}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
          <input
            placeholder="Buscar por paciente, medicamento, PRM, farmacêutico ou prontuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...input, paddingLeft: 36 }}
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="p-2 overflow-x-auto" style={card}>
        {loading ? (
          <div className="flex items-center justify-center p-8" style={{ color: txtMut }}>
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-center" style={{ color: txtMut }}>
            Nenhuma intervenção registrada.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                {['Data', 'Paciente', 'PRM', 'Tipo', 'Medicamento', 'Acatado', 'Desfecho', 'Gravidade', 'Farmacêutico', ''].map(h => (
                  <th key={h} className={`${h === '' ? 'text-right' : 'text-left'} px-3 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap`} style={{ color: txtSec }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                  <td className="px-3 py-3 text-sm whitespace-nowrap" style={{ color: txtSec }}>{fmtDate(row.data)}</td>
                  <td className="px-3 py-3 text-sm font-medium" style={{ color: txt }}>
                    <div>{row.paciente || '—'}</div>
                    {row.prontuario && <div className="text-xs mt-0.5" style={{ color: txtMut }}>Pron. {row.prontuario}</div>}
                  </td>
                  <td className="px-3 py-3 text-sm whitespace-nowrap" style={{ color: txtSec }}>{PRM_LABEL[row.prm]}</td>
                  <td className="px-3 py-3 text-sm max-w-[140px] truncate" style={{ color: txtSec }} title={row.tipo_intervencao ?? ''}>
                    {row.tipo_intervencao || '—'}
                  </td>
                  <td className="px-3 py-3 text-sm max-w-[140px] truncate" style={{ color: txtSec }} title={row.medicamento ?? ''}>
                    {row.medicamento || '—'}
                  </td>
                  <td className="px-3 py-3"><AcatadoBadge value={row.acatado} /></td>
                  <td className="px-3 py-3 text-sm max-w-[160px] truncate" style={{ color: txtSec }} title={row.desfecho_clinico ?? ''}>
                    {row.desfecho_clinico || '—'}
                  </td>
                  <td className="px-3 py-3"><GravidadeBadge value={row.gravidade} /></td>
                  <td className="px-3 py-3 text-sm whitespace-nowrap" style={{ color: txtSec }}>{row.farmaceutico || '—'}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <Button variant="outline" size="sm" onClick={() => openEdit(row)} className="h-8 px-2 mr-1">
                      <Edit2 size={14} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => remove(row)} className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal formulário */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-2xl p-6 space-y-5 my-8" style={card}>

            {/* Título */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: txt }}>
                {editing ? 'Editar Intervenção' : 'Nova Intervenção Farmacêutica'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ color: txtMut }}><X size={18} /></button>
            </div>

            {formError && (
              <div className="p-2 rounded bg-red-100 border border-red-200 text-red-800 text-sm">{formError}</div>
            )}

            {/* Seção: Dados gerais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={lbl}>Data *</label>
                <input type="date" value={f.fData} onChange={set('fData')} style={input} />
              </div>
              <div>
                <label style={lbl}>Paciente</label>
                <input value={f.fPaciente} onChange={set('fPaciente')} style={input} placeholder="Nome do paciente" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label style={lbl}>Unidade</label>
                <input value={f.fUnidade} onChange={set('fUnidade')} style={input} placeholder="Ex: UTI" />
              </div>
              <div>
                <label style={lbl}>Leito</label>
                <input value={f.fLeito} onChange={set('fLeito')} style={input} placeholder="Ex: 12A" />
              </div>
              <div>
                <label style={lbl}>Prontuário</label>
                <input value={f.fProntuario} onChange={set('fProntuario')} style={input} />
              </div>
              <div>
                <label style={lbl}>Contato</label>
                <input value={f.fContato} onChange={set('fContato')} style={input} placeholder="Telefone / nome" />
              </div>
            </div>

            {/* Seção: PRM */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={lbl}>PRM *</label>
                <select value={f.fPrm} onChange={set('fPrm')} style={input as React.CSSProperties}>
                  {(Object.entries(PRM_LABEL) as Array<[PRM, string]>).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Causa</label>
                <input value={f.fCausa} onChange={set('fCausa')} style={input} placeholder="Causa relacionada ao PRM" />
              </div>
            </div>

            {/* Seção: Intervenção */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={lbl}>Tipo de intervenção</label>
                <input value={f.fTipo} onChange={set('fTipo')} style={input} placeholder="Ex: Ajuste de dose" />
              </div>
              <div>
                <label style={lbl}>Medicamento</label>
                <input value={f.fMedicamento} onChange={set('fMedicamento')} style={input} placeholder="Medicamento envolvido" />
              </div>
            </div>

            <div>
              <label style={lbl}>Descrição</label>
              <textarea value={f.fDescricao} onChange={set('fDescricao')} rows={3}
                style={{ ...input, resize: 'vertical' as const }}
                placeholder="Descrição detalhada da intervenção" />
            </div>

            {/* Seção: Acatamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={lbl}>Acatado *</label>
                <select value={f.fAcatado} onChange={set('fAcatado')} style={input as React.CSSProperties}>
                  {(Object.entries(ACATADO_LABEL) as Array<[Acatado, string]>).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {f.fAcatado === 'NAO_C_JUST' && (
                <div>
                  <label style={lbl}>Justificativa *</label>
                  <input value={f.fJustificativa} onChange={set('fJustificativa')} style={input}
                    placeholder="Justificativa para não acatamento" />
                </div>
              )}
            </div>

            {/* Seção: Desfecho e gravidade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={lbl}>Desfecho clínico</label>
                <input value={f.fDesfecho} onChange={set('fDesfecho')} style={input} placeholder="Desfecho observado" />
              </div>
              <div>
                <label style={lbl}>Gravidade</label>
                <select value={f.fGravidade} onChange={set('fGravidade')} style={input as React.CSSProperties}>
                  <option value="">— Selecione —</option>
                  {(Object.entries(GRAVIDADE_LABEL) as Array<[Gravidade, string]>).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Seção: Farmacêutico e verificação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={lbl}>Farmacêutico</label>
                <input value={f.fFarmaceutico} onChange={set('fFarmaceutico')} style={input} />
              </div>
              <div>
                <label style={lbl}>Data da última verificação</label>
                <input type="date" value={f.fDataVerif} onChange={set('fDataVerif')} style={input} />
              </div>
            </div>

            <div>
              <label style={lbl}>Observação</label>
              <textarea value={f.fObservacao} onChange={set('fObservacao')} rows={2}
                style={{ ...input, resize: 'vertical' as const }}
                placeholder="Observações adicionais" />
            </div>

            {/* Ações */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving && <Loader2 size={14} className="mr-2 animate-spin" />} Salvar
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
