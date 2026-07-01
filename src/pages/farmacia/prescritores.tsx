// =====================================================================
// Cadastro de Prescritores (medicos) — CRUD simples (nome + CRM + UF).
// =====================================================================

import { useEffect, useState, useMemo } from 'react'
import { Stethoscope, Plus, Edit2, Trash2, Search, Loader2, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'
import { prescribersService } from '@/lib/services/farmacia-cadastros'
import type { Prescriber } from '@/lib/types/farmacia'
import { getErrorMessage } from '@/lib/utils/error-messages'

import { ActiveStockBadge } from '@/components/active-stock-badge'
const ALLOWED_ROLES = new Set([
  'admin', 'manager', 'administrador', 'gestor', 'pharmacist',
])

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

export function Prescritores() {
  const { user } = useAuth()
  const { mode } = useTheme()
  const canManage = !!user?.role && ALLOWED_ROLES.has(user.role)

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

  const [rows, setRows] = useState<Prescriber[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Prescriber | null>(null)
  const [fName, setFName] = useState('')
  const [fCrm, setFCrm] = useState('')
  const [fUf, setFUf] = useState('BA')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try { setRows(await prescribersService.list()) }
    catch (e: any) { setError(getErrorMessage(e)) }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) || r.crm.toLowerCase().includes(q)
    )
  }, [rows, search])

  function openNew() {
    setEditing(null); setFName(''); setFCrm(''); setFUf('BA'); setFormError(''); setShowForm(true)
  }
  function openEdit(p: Prescriber) {
    setEditing(p); setFName(p.name); setFCrm(p.crm); setFUf(p.crm_uf); setFormError(''); setShowForm(true)
  }

  async function save() {
    setSaving(true); setFormError('')
    try {
      if (editing) await prescribersService.update(editing.id, { name: fName, crm: fCrm, crm_uf: fUf })
      else await prescribersService.create({ name: fName, crm: fCrm, crm_uf: fUf })
      setShowForm(false); await load()
    } catch (e: any) { setFormError(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  async function remove(p: Prescriber) {
    if (!confirm(`Desativar prescritor "${p.name}"?`)) return
    try { await prescribersService.deactivate(p.id); await load() }
    catch (e: any) { setError(getErrorMessage(e)) }
  }

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="p-6" style={card}>
          <h1 className="inline-flex items-center gap-2 flex-wrap text-xl font-semibold" style={{ color: txt }}>Sem permissão <ActiveStockBadge /></h1>
          <p className="text-sm mt-2" style={{ color: txtSec }}>
            Apenas a coordenação/farmacêutico podem cadastrar prescritores.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-100"><Stethoscope className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: txt }}>Prescritores</h1>
            <p className="text-sm" style={{ color: txtSec }}>Médicos autorizados a prescrever</p>
          </div>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Novo Prescritor
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-100 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="p-4" style={card}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
          <input placeholder="Buscar por nome ou CRM..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...input, paddingLeft: 36 }} />
        </div>
      </div>

      <div className="p-2" style={card}>
        {loading ? (
          <div className="flex items-center justify-center p-8" style={{ color: txtMut }}>
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-center" style={{ color: txtMut }}>
            Nenhum prescritor cadastrado.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: txtSec }}>Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: txtSec }}>CRM</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: txtSec }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: txt }}>{p.name}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: txtSec }}>CRM {p.crm}/{p.crm_uf}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="h-8 px-2 mr-1">
                      <Edit2 size={14} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => remove(p)} className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md p-6 space-y-4" style={card}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: txt }}>
                {editing ? 'Editar Prescritor' : 'Novo Prescritor'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ color: txtMut }}><X size={18} /></button>
            </div>
            {formError && (
              <div className="p-2 rounded bg-red-100 border border-red-200 text-red-800 text-sm">{formError}</div>
            )}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: txtSec }}>Nome *</label>
              <input value={fName} onChange={(e) => setFName(e.target.value)} style={input} placeholder="Nome completo" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: txtSec }}>CRM *</label>
                <input value={fCrm} onChange={(e) => setFCrm(e.target.value.replace(/\D/g, ''))} style={input} placeholder="12345" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: txtSec }}>UF</label>
                <select value={fUf} onChange={(e) => setFUf(e.target.value)} style={input as any}>
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving && <Loader2 size={14} className="mr-2 animate-spin" />}Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
