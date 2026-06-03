// =====================================================================
// Baixa de Estoque
// Permite a coordenadora/farmaceutico (ou warehouse_manager) baixar
// itens sem solicitacao, informando obrigatoriamente o motivo:
//   - Emprestimo  (para fora; pode ficar com "aguarda retorno")
//   - Devolucao ao fornecedor (NF de devolucao)
//   - Quebra
//   - Vencimento
//   - Outro (exige observacao)
//
// Acessivel apenas para usuarios com role pharmacist/manager/admin/
// warehouse_manager. O estoque selecionavel eh filtrado pelo papel/
// departamento do usuario.
// =====================================================================

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Search, Loader2, PackageMinus } from 'lucide-react'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { stockService } from '@/lib/services/stock'
import type {
  StockLocation,
  SaidaAvulsaReason,
} from '@/lib/types/stock'
import { SAIDA_AVULSA_REASON_LABEL } from '@/lib/types/stock'

interface PharmacyItemRow {
  id: string
  code: string | null
  name: string
  unit: string
  price: number | null
}

// Motivos disponiveis nesta tela. Emprestimo, Devolucao ao fornecedor e
// Obito sem reaproveitamento foram removidos a pedido da farmacia
// (continuam aceitos no banco para nao quebrar historico).
const REASONS: SaidaAvulsaReason[] = [
  'quebra',
  'vencimento',
  'defeito_fabricacao',
  'embalagem_violada',
  'falha_fracionamento',
  'outro',
]

export function SaidaAvulsa() {
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
    borderRadius: 10, padding: '10px 14px', fontSize: 14,
    color: txt, outline: 'none', width: '100%',
  }
  const labelStyle: React.CSSProperties = {
    color: txtSec, fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block',
  }

  // ---------- Permissao ----------
  const allowedRoles = useMemo(
    () => new Set(['admin', 'manager', 'administrador', 'gestor', 'pharmacist', 'warehouse_manager']),
    []
  )
  const canUse = !!user?.role && allowedRoles.has(user.role)

  // ---------- Estado ----------
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [locationId, setLocationId] = useState<string>('')
  const [items, setItems] = useState<PharmacyItemRow[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<PharmacyItemRow | null>(null)
  const [itemStock, setItemStock] = useState<number | null>(null)
  const [loadingStock, setLoadingStock] = useState(false)

  const [quantity, setQuantity] = useState<number>(1)
  const [reason, setReason] = useState<SaidaAvulsaReason>('quebra')

  // Campos condicionais ao motivo
  const [borrowedTo, setBorrowedTo] = useState('')
  const [awaitsReturn, setAwaitsReturn] = useState(true)
  const [supplierName, setSupplierName] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [notes, setNotes] = useState('')

  // Recentes
  const [recent, setRecent] = useState<any[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // ---------- Carga inicial ----------
  useEffect(() => {
    if (!canUse) return
    ;(async () => {
      try {
        const locs = await stockService.getLocations()
        setLocations(locs)
        // Default: CAF (cobre 80% dos casos da coordenadora)
        const caf = locs.find((l) => l.code === 'CAF')
        if (caf) setLocationId(caf.id)
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar locais')
      }

      const { data, error } = await supabase
        .from('pharmacy_items')
        .select('id, code, name, unit, price')
        .eq('is_active', true)
        .order('name')
        .limit(2000)
      if (error) console.error('loadItems:', error)
      setItems((data || []) as PharmacyItemRow[])
    })()
  }, [canUse])

  // Quando troca item ou estoque, busca saldo
  useEffect(() => {
    if (!selectedItem || !locationId) {
      setItemStock(null)
      return
    }
    setLoadingStock(true)
    stockService
      .getStock(selectedItem.id, 'pharmacy', locationId)
      .then((row) => setItemStock(row?.quantity ?? 0))
      .catch(() => setItemStock(null))
      .finally(() => setLoadingStock(false))
  }, [selectedItem, locationId])

  // Carrega historico recente daquele estoque
  useEffect(() => {
    if (!locationId) return
    ;(async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, quantity, reason, reason_detail, notes, performed_at, item_id')
        .eq('movement_type', 'SAIDA_AVULSA')
        .eq('source_location_id', locationId)
        .order('performed_at', { ascending: false })
        .limit(10)
      if (error) console.error('loadRecent:', error)
      setRecent(data || [])
    })()
  }, [locationId, submitting])

  // ---------- Filtragem de itens ----------
  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    if (!q) return items.slice(0, 20)
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.code || '').toLowerCase().includes(q)
      )
      .slice(0, 20)
  }, [items, itemSearch])

  // ---------- Validacoes ----------
  const estimatedLoss = selectedItem?.price
    ? Number(selectedItem.price) * quantity
    : null

  const canSubmit =
    !!locationId &&
    !!selectedItem &&
    quantity > 0 &&
    (itemStock === null || quantity <= itemStock) &&
    (reason !== 'outro' || notes.trim().length > 0) &&
    (reason !== 'emprestimo' || borrowedTo.trim().length > 0) &&
    (reason !== 'devolucao_fornecedor' || supplierName.trim().length > 0)

  const handleSubmit = async () => {
    if (!canSubmit || !selectedItem) return
    setSubmitting(true)
    setError('')
    try {
      // Monta reason_detail conforme o motivo
      let reasonDetail: string | null = null
      let combinedNotes = notes.trim() || null
      if (reason === 'emprestimo') reasonDetail = borrowedTo.trim() || null
      if (reason === 'devolucao_fornecedor') {
        reasonDetail = supplierName.trim() || null
        const nf = invoiceNumber.trim()
        if (nf) combinedNotes = `NF dev: ${nf}${combinedNotes ? ' | ' + combinedNotes : ''}`
      }

      await stockService.createSaidaAvulsa({
        item_id: selectedItem.id,
        item_type: 'pharmacy',
        quantity,
        unit_cost: selectedItem.price ?? null,
        source_location_id: locationId,
        reason,
        reason_detail: reasonDetail,
        awaits_return: reason === 'emprestimo' ? awaitsReturn : false,
        notes: combinedNotes,
      })

      // Reset
      setSelectedItem(null)
      setQuantity(1)
      setBorrowedTo('')
      setSupplierName('')
      setInvoiceNumber('')
      setNotes('')
      setItemSearch('')
    } catch (e: any) {
      setError(e?.message || 'Erro ao registrar saida')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Renderiza ----------
  if (!canUse) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="p-6" style={glass}>
          <h1 className="text-xl font-semibold" style={{ color: txt }}>
            Sem permissao
          </h1>
          <p className="text-sm mt-2" style={{ color: txtSec }}>
            Apenas a coordenacao e o farmaceutico (ou almoxarife) podem registrar saidas avulsas.
          </p>
        </div>
      </div>
    )
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
            <PackageMinus size={22} /> Baixa de Estoque
          </h1>
          <p className="text-sm" style={{ color: txtSec }}>
            Registre baixas de estoque sem solicitação: empréstimo, devolução ao fornecedor,
            quebra, vencimento, óbito sem reaproveitamento, defeito de fabricação, embalagem
            violada, falha no fracionamento ou outro.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-100 border border-red-200 flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Formulario */}
      <div className="p-6 space-y-5" style={glass}>
        {/* Estoque */}
        <div>
          <label style={labelStyle}>Estoque de origem *</label>
          <select
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value)
              setSelectedItem(null)
            }}
            style={inputStyle as any}
          >
            <option value="">Selecione...</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Item */}
        <div>
          <label style={labelStyle}>Item *</label>
          {selectedItem ? (
            <div className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
              <div>
                <p className="font-medium" style={{ color: txt }}>{selectedItem.name}</p>
                <p className="text-xs" style={{ color: txtMut }}>
                  {selectedItem.code || 'sem codigo'} • {selectedItem.unit}
                  {loadingStock ? ' • carregando saldo...' :
                    itemStock !== null ? ` • Saldo no estoque: ${itemStock}` : ''}
                  {selectedItem.price ? ` • R$ ${Number(selectedItem.price).toFixed(2)}` : ''}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedItem(null)}>
                Trocar
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Buscar por nome ou codigo..."
                style={{ ...inputStyle, paddingLeft: 36 }}
              />
              {itemSearch && (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-lg"
                  style={{ border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
                  {filteredItems.length === 0 ? (
                    <div className="p-3 text-sm" style={{ color: txtMut }}>Nada encontrado</div>
                  ) : (
                    filteredItems.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => { setSelectedItem(i); setItemSearch('') }}
                        className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors block"
                      >
                        <p className="text-sm font-medium" style={{ color: txt }}>{i.name}</p>
                        <p className="text-xs" style={{ color: txtMut }}>{i.code || 'sem codigo'} • {i.unit}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quantidade */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Quantidade *</label>
            <input
              type="number"
              min={1}
              max={itemStock ?? undefined}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              onWheel={(e) => e.currentTarget.blur()}
              style={inputStyle}
            />
            {itemStock !== null && quantity > itemStock && (
              <p className="text-xs mt-1 text-red-500">
                Quantidade maior que o saldo ({itemStock}).
              </p>
            )}
          </div>
          <div>
            <label style={labelStyle}>Valor estimado da baixa</label>
            <div className="p-2 rounded-lg text-sm font-semibold" style={{
              background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              color: txt, minHeight: 40, display: 'flex', alignItems: 'center', paddingLeft: 14,
            }}>
              {estimatedLoss !== null
                ? estimatedLoss.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : '—'}
            </div>
          </div>
        </div>

        {/* Motivo */}
        <div>
          <label style={labelStyle}>Motivo *</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className="px-3 py-2 text-sm rounded-lg border transition-colors text-center"
                style={{
                  background: reason === r
                    ? (mode === 'dark' ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)')
                    : (mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                  borderColor: reason === r ? '#10b981' : (mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                  color: reason === r ? '#059669' : txt,
                  fontWeight: reason === r ? 600 : 500,
                }}
              >
                {SAIDA_AVULSA_REASON_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Campos condicionais */}
        {reason === 'emprestimo' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Para quem (instituicao / setor externo) *</label>
              <input
                value={borrowedTo}
                onChange={(e) => setBorrowedTo(e.target.value)}
                placeholder="Ex: Hospital X / Setor Y"
                style={inputStyle}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: txt }}>
                <input
                  type="checkbox"
                  checked={awaitsReturn}
                  onChange={(e) => setAwaitsReturn(e.target.checked)}
                  className="w-4 h-4"
                />
                Aguarda retorno (vai para a lista de emprestimos em aberto)
              </label>
            </div>
          </div>
        )}

        {reason === 'devolucao_fornecedor' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Fornecedor *</label>
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Razao social do fornecedor"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>N. da NF de devolucao</label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ex: 1234"
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* Observacao */}
        <div>
          <label style={labelStyle}>
            Observacao {reason === 'outro' && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={reason === 'outro' ? 'Descreva o motivo (obrigatorio para "Outro")' : 'Detalhes adicionais...'}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' as const }}
          />
        </div>

        {/* Acoes */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackageMinus className="w-4 h-4 mr-2" />}
            Registrar baixa
          </Button>
        </div>
      </div>

      {/* Recentes */}
      <div className="p-6" style={glass}>
        <h2 className="text-base font-semibold mb-3" style={{ color: txt }}>
          Ultimas saidas avulsas deste estoque
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm" style={{ color: txtMut }}>Nenhuma saida avulsa registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <div key={r.id} className="text-sm flex items-center justify-between gap-2 p-2 rounded"
                style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
                <div className="flex-1">
                  <span className="font-medium" style={{ color: txt }}>
                    {SAIDA_AVULSA_REASON_LABEL[r.reason as SaidaAvulsaReason] || r.reason}
                  </span>
                  <span style={{ color: txtMut }}> · {r.quantity} un</span>
                  {r.reason_detail && <span style={{ color: txtSec }}> · {r.reason_detail}</span>}
                  {r.notes && <span style={{ color: txtMut }}> · {r.notes}</span>}
                </div>
                <span className="text-xs" style={{ color: txtMut }}>
                  {new Date(r.performed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
