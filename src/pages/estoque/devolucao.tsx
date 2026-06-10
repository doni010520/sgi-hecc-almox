// =====================================================================
// Devolucao Interna — 2 etapas por perfil
// Enfermagem: cria devolucao com status 'pending'
// Farmacia: cria direto como 'confirmed' ou confirma pendentes
// =====================================================================

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/theme'
import { useAuth } from '@/contexts/auth'
import { ArrowLeft, Search, Plus, Trash2, Loader2, AlertCircle, CheckCircle2, Clock, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { stockService } from '@/lib/services/stock'

interface ItemRow {
  id: string
  code: string | null
  name: string
  unit: string
  price: number | null
}
interface ReturnLine {
  item_id: string
  item_name: string
  unit: string
  quantity: number
  unit_cost: number | null
}

interface PendingReturn {
  id: string
  patient_name: string | null
  patient_prontuario: string | null
  return_reason: string | null
  return_status: string
  created_at: string
  returned_by_user_id: string | null
  creator_name?: string | null
  items: Array<{
    id: string
    item_id: string
    item_type: string
    quantity: number
    item_name?: string
  }>
}

const PHARMACY_ROLES = new Set(['atendente', 'gestor', 'administrador', 'pharmacist'])

export function DevolucaoInterna() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { mode } = useTheme()

  const isPharmacy = !!user?.role && PHARMACY_ROLES.has(user.role)

  const txt = mode === 'dark' ? '#fff' : '#0d2e1c'
  const txtSec = mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(13,46,28,0.65)'
  const txtMut = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(13,46,28,0.45)'

  const glass: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(10,15,20,0.55)' : 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
    borderRadius: 16,
  }
  const inputStyle: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    color: txt,
    outline: 'none',
    width: '100%',
  }
  const labelStyle: React.CSSProperties = {
    color: txtSec,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 4,
    display: 'block',
  }

  // ---- Aba ativa ----
  const [activeTab, setActiveTab] = useState<'nova' | 'pendentes'>('nova')

  // ---- Form state ----
  const [patientName, setPatientName] = useState('')
  const [prontuario, setProntuario] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [lines, setLines] = useState<ReturnLine[]>([])
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<ItemRow[]>([])
  const [cafLocationId, setCafLocationId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ---- Pendentes state ----
  const [pendentes, setPendentes] = useState<PendingReturn[]>([])
  const [loadingPendentes, setLoadingPendentes] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [divergenceNotes, setDivergenceNotes] = useState<Record<string, string>>({})
  const [confirmingSubmit, setConfirmingSubmit] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const locs = await stockService.getLocations()
        const caf = locs.find((l) => l.code === 'CAF')
        if (caf) setCafLocationId(caf.id)
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar locais')
      }
      const { data } = await supabase
        .from('pharmacy_items')
        .select('id, code, name, unit, price')
        .eq('is_active', true)
        .order('name')
        .limit(2000)
      setItems((data || []) as ItemRow[])
    })()
  }, [])

  const loadPendentes = async () => {
    setLoadingPendentes(true)
    try {
      const { data, error: err } = await supabase
        .from('stock_returns')
        .select(`
          id, patient_name, patient_prontuario, return_reason, return_status,
          created_at, returned_by_user_id,
          stock_return_items (id, item_id, item_type, quantity)
        `)
        .eq('return_status', 'pending')
        .order('created_at', { ascending: false })
      if (err) throw err

      const rows: PendingReturn[] = (data || []).map((r: any) => ({
        ...r,
        items: r.stock_return_items || [],
      }))

      // Enriquecer item_name
      if (rows.length > 0) {
        const allItemIds = Array.from(new Set(rows.flatMap((r) => r.items.map((i) => i.item_id))))
        if (allItemIds.length > 0) {
          const { data: pharmItems } = await supabase
            .from('pharmacy_items')
            .select('id, name')
            .in('id', allItemIds)
          const nameMap: Record<string, string> = {}
          ;(pharmItems || []).forEach((pi: any) => { nameMap[pi.id] = pi.name })
          rows.forEach((r) => {
            r.items = r.items.map((i) => ({ ...i, item_name: nameMap[i.item_id] || i.item_id }))
          })
        }
      }

      setPendentes(rows)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar pendentes')
    } finally {
      setLoadingPendentes(false)
    }
  }

  useEffect(() => {
    if (isPharmacy && activeTab === 'pendentes') {
      loadPendentes()
    }
  }, [isPharmacy, activeTab])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items.slice(0, 15)
    return items
      .filter((i) => i.name.toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q))
      .slice(0, 15)
  }, [items, search])

  const addItem = (i: ItemRow) => {
    if (lines.some((l) => l.item_id === i.id)) return
    setLines((prev) => [
      ...prev,
      { item_id: i.id, item_name: i.name, unit: i.unit, quantity: 1, unit_cost: i.price ?? null },
    ])
    setSearch('')
  }
  const updateQty = (id: string, q: number) =>
    setLines((prev) => prev.map((l) => (l.item_id === id ? { ...l, quantity: Math.max(1, q) } : l)))
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.item_id !== id))

  const canSubmit =
    !!cafLocationId &&
    !!user?.id &&
    lines.length > 0 &&
    lines.every((l) => l.quantity > 0) &&
    patientName.trim().length >= 2 &&
    returnReason.trim().length >= 5

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id) return
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const returnStatus = isPharmacy ? 'confirmed' : 'pending'

      const { data: ret, error: e1 } = await supabase
        .from('stock_returns')
        .insert({
          target_location_id: cafLocationId,
          returned_by_user_id: user.id,
          patient_name: patientName.trim(),
          patient_prontuario: prontuario.trim() || null,
          return_reason: returnReason.trim(),
          return_status: returnStatus,
        })
        .select('id')
        .single()

      if (e1 || !ret) throw new Error('Erro ao criar devolucao: ' + (e1?.message ?? 'sem dados'))

      const itemRows = lines.map((l) => ({
        return_id: ret.id,
        item_id: l.item_id,
        item_type: 'pharmacy',
        quantity: l.quantity,
      }))

      const { error: e2 } = await supabase.from('stock_return_items').insert(itemRows)
      if (e2) throw new Error('Erro ao inserir itens: ' + e2.message)

      // Farmacia: criar movimentacoes imediatamente
      if (isPharmacy) {
        for (const l of lines) {
          await supabase.from('stock_movements').insert({
            item_id: l.item_id,
            item_type: 'pharmacy',
            movement_type: 'DEVOLUCAO_INT',
            direction: 'in',
            quantity: l.quantity,
            unit_cost: l.unit_cost,
            target_location_id: cafLocationId,
            return_id: ret.id,
            performed_by: user.id,
          })
        }
      }

      setSuccess(
        isPharmacy
          ? 'Devolucao registrada e confirmada com sucesso!'
          : 'Devolucao enviada para confirmacao da farmacia!'
      )
      setPatientName('')
      setProntuario('')
      setReturnReason('')
      setLines([])
    } catch (e: any) {
      setError(e?.message || 'Erro ao registrar devolucao')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirm = async (pendente: PendingReturn) => {
    if (!user?.id || !cafLocationId) return
    setConfirmingSubmit(pendente.id)
    setError('')
    try {
      const notes = divergenceNotes[pendente.id]?.trim() || null

      const { error: e1 } = await supabase
        .from('stock_returns')
        .update({
          return_status: 'confirmed',
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
          ...(notes ? { divergence_notes: notes } : {}),
        })
        .eq('id', pendente.id)

      if (e1) throw new Error('Erro ao confirmar: ' + e1.message)

      for (const it of pendente.items) {
        await supabase.from('stock_movements').insert({
          item_id: it.item_id,
          item_type: it.item_type,
          movement_type: 'DEVOLUCAO_INT',
          direction: 'in',
          quantity: it.quantity,
          target_location_id: cafLocationId,
          return_id: pendente.id,
          performed_by: user.id,
        })
      }

      setConfirmingId(null)
      await loadPendentes()
    } catch (e: any) {
      setError(e?.message || 'Erro ao confirmar devolucao')
    } finally {
      setConfirmingSubmit(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
            background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
            color: txt,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: txt }}>
            <Undo2 size={22} /> Devolucao Interna
          </h1>
          <p className="text-sm" style={{ color: txtSec }}>
            {isPharmacy
              ? 'Registre ou confirme devolucoes da enfermagem.'
              : 'Solicite devolucao de itens ao estoque da farmacia.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-100 border border-red-200 flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center gap-2 text-emerald-800 text-sm">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Tabs — apenas farmacia ve aba Pendentes */}
      {isPharmacy && (
        <div className="flex gap-2">
          {(['nova', 'pendentes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setError(''); setSuccess('') }}
              style={{
                padding: '8px 20px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: activeTab === tab
                  ? (mode === 'dark' ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.15)')
                  : (mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
                color: activeTab === tab ? '#10b981' : txtSec,
                border: `1px solid ${activeTab === tab ? '#10b981' : 'transparent'}`,
              }}
            >
              {tab === 'nova' ? 'Nova Devolucao' : 'Pendentes'}
            </button>
          ))}
        </div>
      )}

      {/* ===== ABA NOVA DEVOLUCAO ===== */}
      {activeTab === 'nova' && (
        <div className="p-6 space-y-5" style={glass}>
          {/* Paciente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Nome do Paciente <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nome completo do paciente"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Prontuario (opcional)</label>
              <input
                value={prontuario}
                onChange={(e) => setProntuario(e.target.value)}
                placeholder="Numero do prontuario"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label style={labelStyle}>
              Motivo da Devolucao <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo da devolucao (minimo 5 caracteres). Ex: paciente recebeu alta antes de iniciar tratamento."
              style={{ ...inputStyle, resize: 'vertical' as const }}
            />
            <p className="text-xs mt-1" style={{ color: txtMut }}>
              {returnReason.trim().length < 5
                ? `${5 - returnReason.trim().length} caractere(s) faltando`
                : '✓ Motivo OK'}
            </p>
          </div>

          {/* Busca item */}
          <div>
            <label style={labelStyle}>Adicionar Item</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar item por nome ou codigo..."
                style={{ ...inputStyle, paddingLeft: 36 }}
              />
              {search && (
                <div
                  className="mt-2 max-h-56 overflow-y-auto rounded-lg"
                  style={{
                    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                    background: mode === 'dark' ? 'rgba(10,15,20,0.9)' : 'rgba(255,255,255,0.95)',
                    position: 'relative',
                    zIndex: 10,
                  }}
                >
                  {filtered.length === 0 ? (
                    <p className="p-3 text-sm text-center" style={{ color: txtMut }}>Nenhum item encontrado</p>
                  ) : (
                    filtered.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => addItem(i)}
                        className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors block"
                      >
                        <p className="text-sm font-medium" style={{ color: txt }}>{i.name}</p>
                        <p className="text-xs" style={{ color: txtMut }}>
                          {i.code || 'sem codigo'} • {i.unit}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Lista de itens */}
          {lines.length > 0 && (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}
            >
              <table className="w-full">
                <thead>
                  <tr
                    className="text-xs"
                    style={{
                      background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      color: txtMut,
                    }}
                  >
                    <th className="text-left p-2">Item</th>
                    <th className="text-right p-2 w-32">Quantidade</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.item_id} style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                      <td className="p-2 text-sm" style={{ color: txt }}>
                        {l.item_name}{' '}
                        <span style={{ color: txtMut }}>({l.unit})</span>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => updateQty(l.item_id, parseInt(e.target.value) || 1)}
                          onWheel={(e) => e.currentTarget.blur()}
                          style={{ ...inputStyle, padding: '4px 8px', textAlign: 'right' }}
                        />
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(l.item_id)}
                          className="text-red-600 hover:bg-red-50 h-8 px-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {isPharmacy ? 'Registrar Devolucao' : 'Enviar para Farmacia'}
            </Button>
          </div>
        </div>
      )}

      {/* ===== ABA PENDENTES (so farmacia) ===== */}
      {activeTab === 'pendentes' && isPharmacy && (
        <div className="space-y-4">
          {loadingPendentes ? (
            <div className="p-12 flex justify-center" style={glass}>
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: txtMut }} />
            </div>
          ) : pendentes.length === 0 ? (
            <div className="p-8 text-center" style={glass}>
              <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: '#10b981' }} />
              <p className="text-sm font-medium" style={{ color: txtSec }}>
                Nenhuma devolucao pendente!
              </p>
            </div>
          ) : (
            pendentes.map((p) => (
              <div key={p.id} className="p-5 space-y-4" style={glass}>
                {/* Cabecalho */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock size={14} style={{ color: '#f59e0b' }} />
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                      >
                        Pendente
                      </span>
                      <span className="text-xs" style={{ color: txtMut }}>
                        {new Date(p.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="font-semibold" style={{ color: txt }}>
                      Paciente: {p.patient_name || '—'}
                    </p>
                    {p.patient_prontuario && (
                      <p className="text-sm" style={{ color: txtSec }}>
                        Prontuario: {p.patient_prontuario}
                      </p>
                    )}
                    {p.return_reason && (
                      <p className="text-sm" style={{ color: txtSec }}>
                        Motivo: {p.return_reason}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setConfirmingId(confirmingId === p.id ? null : p.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
                  >
                    <CheckCircle2 size={14} className="mr-1" />
                    Confirmar Recebimento
                  </Button>
                </div>

                {/* Itens */}
                {p.items.length > 0 && (
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{
                      border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                    }}
                  >
                    <table className="w-full">
                      <thead>
                        <tr
                          style={{
                            background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                          }}
                        >
                          <th className="text-left p-2 text-xs" style={{ color: txtMut }}>Item</th>
                          <th className="text-right p-2 text-xs w-24" style={{ color: txtMut }}>Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.items.map((it) => (
                          <tr
                            key={it.id}
                            style={{
                              borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                            }}
                          >
                            <td className="p-2 text-sm" style={{ color: txt }}>
                              {it.item_name || it.item_id}
                            </td>
                            <td className="p-2 text-sm text-right font-semibold" style={{ color: txt }}>
                              {it.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Painel de confirmacao */}
                {confirmingId === p.id && (
                  <div
                    className="p-4 space-y-3 rounded-xl"
                    style={{
                      background: mode === 'dark' ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)',
                      border: '1px solid rgba(16,185,129,0.25)',
                    }}
                  >
                    <label style={{ ...labelStyle, color: '#10b981' }}>
                      Observacoes sobre divergencias (opcional)
                    </label>
                    <textarea
                      value={divergenceNotes[p.id] || ''}
                      onChange={(e) =>
                        setDivergenceNotes((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      rows={2}
                      placeholder="Registre qualquer divergencia na quantidade ou estado dos itens recebidos."
                      style={{ ...inputStyle, resize: 'vertical' as const }}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmingId(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        disabled={confirmingSubmit === p.id}
                        onClick={() => handleConfirm(p)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {confirmingSubmit === p.id ? (
                          <Loader2 size={14} className="mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} className="mr-1" />
                        )}
                        Confirmar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
