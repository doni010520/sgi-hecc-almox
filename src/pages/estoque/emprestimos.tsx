// =====================================================================
// Emprestimos em Aberto
// Lista todos os SAIDA_AVULSA com reason=emprestimo e awaits_return=true
// que ainda nao foram fechados. Permite "fechar" o emprestimo, gerando
// um RETORNO_EMPRESTIMO (entrada de volta ao estoque).
// =====================================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Loader2, Handshake, CornerDownLeft } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { stockService } from '@/lib/services/stock'
import type { OpenLoanRow, StockLocation } from '@/lib/types/stock'

interface LoanRowExtended extends OpenLoanRow {
  item_name?: string
  item_code?: string | null
  item_unit?: string
}

export function EmprestimosAbertos() {
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

  const [loans, setLoans] = useState<LoanRowExtended[]>([])
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState<string | null>(null)
  const [closeQty, setCloseQty] = useState<Record<string, number>>({})
  const [closeTo, setCloseTo] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    try {
      const [rawLoans, locs] = await Promise.all([
        stockService.listOpenLoans(),
        stockService.getLocations(),
      ])
      setLocations(locs)

      // Junta nome do item para exibicao
      const pharmIds = rawLoans.filter((l) => l.item_type === 'pharmacy').map((l) => l.item_id)
      const wareIds = rawLoans.filter((l) => l.item_type === 'warehouse').map((l) => l.item_id)
      const itemMap = new Map<string, { name: string; code: string | null; unit: string }>()
      if (pharmIds.length > 0) {
        const { data } = await supabase.from('pharmacy_items').select('id, name, code, unit').in('id', pharmIds)
        ;(data || []).forEach((r: any) => itemMap.set(r.id, { name: r.name, code: r.code, unit: r.unit }))
      }
      if (wareIds.length > 0) {
        const { data } = await supabase.from('warehouse_items').select('id, name, code, unit').in('id', wareIds)
        ;(data || []).forEach((r: any) => itemMap.set(r.id, { name: r.name, code: r.code, unit: r.unit }))
      }

      const enriched = rawLoans.map((l) => ({
        ...l,
        item_name: itemMap.get(l.item_id)?.name,
        item_code: itemMap.get(l.item_id)?.code ?? null,
        item_unit: itemMap.get(l.item_id)?.unit,
      }))
      setLoans(enriched)

      // Defaults: qty igual ao emprestado, local de retorno = origem
      const qDefaults: Record<string, number> = {}
      const tDefaults: Record<string, string> = {}
      enriched.forEach((l) => {
        qDefaults[l.movement_id] = l.quantity
        tDefaults[l.movement_id] = l.source_location_id
      })
      setCloseQty(qDefaults)
      setCloseTo(tDefaults)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar emprestimos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleClose = async (loan: LoanRowExtended) => {
    if (!user?.id) return
    const qty = closeQty[loan.movement_id] ?? loan.quantity
    const targetLoc = closeTo[loan.movement_id] ?? loan.source_location_id
    if (qty <= 0 || qty > loan.quantity) {
      alert('Quantidade invalida.')
      return
    }
    setClosing(loan.movement_id)
    try {
      await stockService.closeLoanFull({
        original_movement_id: loan.movement_id,
        item_id: loan.item_id,
        item_type: loan.item_type,
        target_location_id: targetLoc,
        quantity: qty,
        unit_cost: loan.unit_cost,
        notes: `Retorno do emprestimo (${loan.borrowed_to || '-'})`,
      })
      // Reload (se devolveu parcial, ele aparece de novo com saldo restante? Nao —
      // a view filtra "existe RETORNO_EMPRESTIMO ligado", entao desaparece da lista.
      // OK para v1; quem precisa de devolucao parcial pode adicionar saida nova.
      await load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao fechar emprestimo')
    } finally {
      setClosing(null)
    }
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
            <Handshake size={22} /> Emprestimos em Aberto
          </h1>
          <p className="text-sm" style={{ color: txtSec }}>
            Itens emprestados para fora aguardando retorno.
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
        ) : loans.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: txtMut }}>
            Nenhum emprestimo em aberto.
          </p>
        ) : (
          <div className="space-y-3">
            {loans.map((loan) => (
              <div key={loan.movement_id} className="rounded-lg p-4 space-y-3"
                style={{
                  background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                }}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <p className="font-medium" style={{ color: txt }}>
                      {loan.item_name || loan.item_id}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: txtMut }}>
                      {loan.item_code || 'sem codigo'} • {loan.quantity} {loan.item_unit || 'un'}
                      {loan.unit_cost && ` • R$ ${Number(loan.unit_cost).toFixed(2)}/un`}
                    </p>
                    <p className="text-sm mt-2" style={{ color: txtSec }}>
                      Emprestado para <strong>{loan.borrowed_to || '—'}</strong> em{' '}
                      <strong>{new Date(loan.performed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: txtMut }}>
                      De: {loan.location_name}
                    </p>
                    {loan.notes && (
                      <p className="text-xs mt-1 italic" style={{ color: txtMut }}>"{loan.notes}"</p>
                    )}
                  </div>
                </div>

                {/* Fechar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end pt-2 border-t"
                  style={{ borderColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  <div>
                    <label className="text-xs" style={{ color: txtMut }}>Quantidade retornando</label>
                    <input type="number" min={1} max={loan.quantity}
                      value={closeQty[loan.movement_id] ?? loan.quantity}
                      onChange={(e) => setCloseQty((m) => ({ ...m, [loan.movement_id]: parseInt(e.target.value) || 1 }))}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg"
                      style={{
                        background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
                        border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                        color: txt,
                      }} />
                  </div>
                  <div>
                    <label className="text-xs" style={{ color: txtMut }}>Devolver para</label>
                    <select value={closeTo[loan.movement_id] ?? loan.source_location_id}
                      onChange={(e) => setCloseTo((m) => ({ ...m, [loan.movement_id]: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-lg"
                      style={{
                        background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
                        border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                        color: txt,
                      }}>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={() => handleClose(loan)}
                    disabled={closing === loan.movement_id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {closing === loan.movement_id
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <CornerDownLeft className="w-4 h-4 mr-2" />}
                    Registrar retorno
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
