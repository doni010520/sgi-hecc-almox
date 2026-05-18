// =====================================================================
// Vencimentos a Baixar
// Lista da view expiring_to_writeoff: itens com saldo > 0 e validade vencida.
// Permite dar baixa em massa (cria stock_movement tipo SAIDA_AVULSA com
// reason='vencimento' por item selecionado).
// =====================================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Loader2, CalendarX, Check } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'
import { Button } from '@/components/ui/button'
import { stockService } from '@/lib/services/stock'
import type { ExpiringToWriteoffRow } from '@/lib/types/stock'

export function VencimentosABaixar() {
  const navigate = useNavigate()
  const { user } = useAuth()
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
  }

  const allowedRoles = new Set(['admin','manager','administrador','gestor','pharmacist','warehouse_manager','atendente'])
  const canUse = !!user?.role && allowedRoles.has(user.role)

  const [rows, setRows] = useState<ExpiringToWriteoffRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cafLocationId, setCafLocationId] = useState<string>('')

  const load = async () => {
    setLoading(true)
    try {
      const [data, locs] = await Promise.all([
        stockService.listExpiringToWriteoff(),
        stockService.getLocations(),
      ])
      setRows(data)
      const caf = locs.find((l) => l.code === 'CAF')
      if (caf) setCafLocationId(caf.id)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar vencimentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  const toggleAll = () =>
    setSelected((prev) => prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.expiry_tracking_id)))

  const totalLoss = rows
    .filter((r) => selected.has(r.expiry_tracking_id))
    .reduce((sum, r) => sum + (Number(r.estimated_loss) || 0), 0)

  const handleWriteoff = async () => {
    if (selected.size === 0 || !user?.id || !cafLocationId) return
    setSubmitting(true)
    setError('')
    try {
      // Faz baixa para cada selecionado. Sequencial pra captura de erros claros.
      for (const r of rows.filter((row) => selected.has(row.expiry_tracking_id))) {
        await stockService.createSaidaAvulsa({
          item_id: r.item_id,
          item_type: r.item_type,
          quantity: r.current_quantity,
          unit_cost: r.unit_cost,
          source_location_id: cafLocationId, // assumindo CAF; em fluxo real isso pode variar por lote
          reason: 'vencimento',
          reason_detail: `Lote ${r.batch_number} | Venc: ${r.expiry_date}`,
          notes: `Baixa em massa de itens vencidos`,
        })
      }
      setSelected(new Set())
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao registrar baixa')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canUse) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="p-6" style={glass}>
          <h1 className="text-xl font-semibold" style={{ color: txt }}>Sem permissao</h1>
          <p className="text-sm mt-2" style={{ color: txtSec }}>Apenas coordenacao/farmaceutico podem dar baixa em vencimentos.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
          background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
          border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
          color: txt,
        }}><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: txt }}>
            <CalendarX size={22} /> Vencimentos a Baixar
          </h1>
          <p className="text-sm" style={{ color: txtSec }}>
            Itens com validade expirada e saldo positivo. Selecione para dar baixa em massa.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-100 border border-red-200 flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="p-6" style={glass}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: txtMut }} />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: txtMut }}>
            Nenhum item vencido com saldo. Tudo limpo! 🎉
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 pb-3 border-b"
              style={{ borderColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: txt }}>
                <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} />
                {selected.size === rows.length ? 'Desmarcar todos' : `Selecionar todos (${rows.length})`}
              </label>
              <div className="text-right">
                {selected.size > 0 && (
                  <p className="text-xs" style={{ color: txtMut }}>
                    {selected.size} selecionados · perda estimada:{' '}
                    <strong style={{ color: '#ef4444' }}>
                      {totalLoss.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {rows.map((r) => (
                <label key={r.expiry_tracking_id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                  style={{
                    background: selected.has(r.expiry_tracking_id)
                      ? (mode === 'dark' ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)')
                      : (mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                    border: `1px solid ${selected.has(r.expiry_tracking_id) ? '#ef4444' : (mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}`,
                  }}>
                  <input type="checkbox" checked={selected.has(r.expiry_tracking_id)} onChange={() => toggle(r.expiry_tracking_id)} className="flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm" style={{ color: txt }}>{r.item_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: txtMut }}>
                      Lote <strong>{r.batch_number}</strong> · Venc:{' '}
                      <strong style={{ color: '#ef4444' }}>
                        {new Date(r.expiry_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </strong>
                      {' · '}Saldo: <strong>{r.current_quantity}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                      {r.estimated_loss !== null
                        ? Number(r.estimated_loss).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleWriteoff}
                disabled={selected.size === 0 || submitting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Dar baixa em {selected.size} item(s)
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
