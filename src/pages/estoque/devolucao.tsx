// =====================================================================
// Devolucao Interna
// Enfermagem (ou outro setor) devolve itens que pediu mas nao usou.
// O saldo VOLTA para o estoque que entregou.
// Campos: estoque de destino, quem devolveu, lista de itens, observacoes.
// =====================================================================

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Search, Loader2, Undo2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { stockService } from '@/lib/services/stock'
import type { StockLocation } from '@/lib/types/stock'

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
  notes?: string
}

export function DevolucaoInterna() {
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
  const inputStyle: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 10, padding: '10px 14px', fontSize: 14, color: txt, outline: 'none', width: '100%',
  }
  const labelStyle: React.CSSProperties = { color: txtSec, fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }

  const [locations, setLocations] = useState<StockLocation[]>([])
  const [locationId, setLocationId] = useState<string>('')
  const [items, setItems] = useState<ItemRow[]>([])
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<ReturnLine[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const locs = await stockService.getLocations()
        // Devolucao vai para satelite ou CAF (nao para almoxarifado direto)
        setLocations(locs.filter((l) => l.code !== 'ALMOX'))
        const sat1 = locs.find((l) => l.code === 'SAT_1')
        if (sat1) setLocationId(sat1.id)
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
  const updateQty = (id: string, q: number) => {
    setLines((prev) => prev.map((l) => (l.item_id === id ? { ...l, quantity: Math.max(1, q) } : l)))
  }
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.item_id !== id))

  // Justificativa obrigatoria (regra da farmacia) - minimo 5 caracteres
  const canSubmit =
    !!locationId && !!user?.id && lines.length > 0
    && lines.every((l) => l.quantity > 0)
    && notes.trim().length >= 5

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id) return
    setSubmitting(true)
    setError('')
    try {
      await stockService.createReturn({
        target_location_id: locationId,
        returned_by_user_id: user.id,
        department_id: (user as any).department_id ?? null,
        notes: notes.trim() || null,
        items: lines.map((l) => ({
          item_id: l.item_id,
          item_type: 'pharmacy',
          quantity: l.quantity,
          unit_cost: l.unit_cost,
          notes: l.notes ?? null,
        })),
      })
      navigate('/inventory/pharmacy')
    } catch (e: any) {
      setError(e?.message || 'Erro ao registrar devolucao')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
            <Undo2 size={22} /> Devolução da Enfermagem
          </h1>
          <p className="text-sm" style={{ color: txtSec }}>
            Registre itens devolvidos pela enfermagem. O saldo volta para o estoque escolhido.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-100 border border-red-200 flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="p-6 space-y-5" style={glass}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Devolver para o estoque *</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={inputStyle as any}>
              <option value="">Selecione...</option>
              {locations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Devolvido por</label>
            <div className="p-2 rounded-lg text-sm" style={{
              background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              color: txt, minHeight: 40, display: 'flex', alignItems: 'center', paddingLeft: 14,
            }}>{user?.full_name || user?.email || 'Usuario atual'}</div>
          </div>
        </div>

        {/* Busca item */}
        <div>
          <label style={labelStyle}>Adicionar item</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar item por nome ou codigo..." style={{ ...inputStyle, paddingLeft: 36 }} />
            {search && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg" style={{ border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
                {filtered.map((i) => (
                  <button key={i.id} onClick={() => addItem(i)} className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors block">
                    <p className="text-sm font-medium" style={{ color: txt }}>{i.name}</p>
                    <p className="text-xs" style={{ color: txtMut }}>{i.code || 'sem codigo'} • {i.unit}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lista */}
        {lines.length > 0 && (
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
            <table className="w-full">
              <thead>
                <tr className="text-xs" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', color: txtMut }}>
                  <th className="text-left p-2">Item</th>
                  <th className="text-right p-2 w-32">Quantidade</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.item_id}>
                    <td className="p-2 text-sm" style={{ color: txt }}>
                      {l.item_name} <span style={{ color: txtMut }}>({l.unit})</span>
                    </td>
                    <td className="p-2">
                      <input
                        type="number" min={1} value={l.quantity}
                        onChange={(e) => updateQty(l.item_id, parseInt(e.target.value) || 1)}
                        onWheel={(e) => e.currentTarget.blur()}
                        style={{ ...inputStyle, padding: '4px 8px', textAlign: 'right' }}
                      />
                    </td>
                    <td className="p-2">
                      <Button variant="ghost" size="sm" onClick={() => removeLine(l.item_id)} className="text-red-600 hover:bg-red-50 h-8 px-2">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <label style={labelStyle}>
            Justificativa <span className="text-red-500">*</span>
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Explique o motivo da devolucao (obrigatorio, min. 5 caracteres). Ex: paciente recebeu alta antes de iniciar tratamento; medicacao trocada por prescricao revisada; etc."
            style={{ ...inputStyle, resize: 'vertical' as const }} />
          <p className="text-xs mt-1" style={{ color: txtMut }}>
            {notes.trim().length < 5
              ? `${5 - notes.trim().length} caractere(s) faltando para liberar o registro.`
              : '✓ Justificativa OK'}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Registrar devolucao
          </Button>
        </div>
      </div>
    </div>
  )
}
