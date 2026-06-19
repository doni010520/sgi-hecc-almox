import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Download,
  Loader2,
  Package2,
  Pill,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/utils/error-messages'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Direction = 'entrada' | 'saida'

interface MovementRow {
  movement_id: string
  direction: Direction
  subtype: string
  movement_date: string
  item_id: string | null
  item_type: 'pharmacy' | 'warehouse'
  item_code: string | null
  item_name: string | null
  unit: string | null
  quantity: number
  unit_price: number | null
  total_value: number | null
  origin_or_destination: string | null
  invoice_number: string | null
  afm_number: string | null
  batch_number: string | null
  expiry_date: string | null
  notes: string | null
  source_kind: 'stock_entries' | 'warehouse_dispatch' | 'request'
  is_active: boolean
}

const ENTRY_SUBTYPES = ['Compra', 'Empréstimo', 'Doação', 'Permuta', 'Inventário']
const EXIT_SUBTYPES = [
  'Consumo interno',
  'Empréstimo',
  'Doação',
  'Permuta',
  'Transferência',
  'Solicitação',
  'Outro',
]

// Considerado consumo externo (saída para fora do hospital ou não-consumo direto)
const EXTERNAL_SUBTYPES = new Set(['Empréstimo', 'Doação', 'Permuta', 'Transferência'])

const fmtBRL = (n: number | null | undefined) =>
  n == null
    ? '—'
    : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtNum = (n: number | null | undefined) =>
  n == null ? '0' : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—'
  try {
    return format(new Date(s), "dd/MM/yyyy HH:mm", { locale: ptBR })
  } catch {
    return '—'
  }
}

export function MovementsReport() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const sevenAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const [startDate, setStartDate] = useState(sevenAgo)
  const [endDate, setEndDate] = useState(today)
  const [direction, setDirection] = useState<'todas' | Direction>('todas')
  const [subtype, setSubtype] = useState<string>('todos')
  const [itemType, setItemType] = useState<'todos' | 'pharmacy' | 'warehouse'>('todos')
  const [showCancelled, setShowCancelled] = useState(false)
  const [search, setSearch] = useState('')

  const [rows, setRows] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()

  }, [])

  async function load() {
    try {
      setLoading(true)
      setError(null)
      let q = supabase
        .from('v_inventory_movements')
        .select('*')
        .gte('movement_date', `${startDate}T00:00:00`)
        .lte('movement_date', `${endDate}T23:59:59`)
        .order('movement_date', { ascending: false })
        .limit(5000)

      if (!showCancelled) q = q.eq('is_active', true)
      if (direction !== 'todas') q = q.eq('direction', direction)
      if (subtype !== 'todos') q = q.eq('subtype', subtype)
      if (itemType !== 'todos') q = q.eq('item_type', itemType)

      const { data, error } = await q
      if (error) throw error
      setRows((data as MovementRow[]) || [])
    } catch (e: any) {
      console.error('Error loading movements:', e)
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(
      (r) =>
        (r.item_name || '').toLowerCase().includes(q) ||
        (r.item_code || '').toLowerCase().includes(q) ||
        (r.origin_or_destination || '').toLowerCase().includes(q) ||
        (r.invoice_number || '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const totals = useMemo(() => {
    let entradaQty = 0
    let entradaValor = 0
    let consumoInternoQty = 0
    let consumoInternoValor = 0
    let consumoExternoQty = 0
    let consumoExternoValor = 0
    let solicitacaoQty = 0
    let solicitacaoValor = 0

    for (const r of filtered) {
      const q = Number(r.quantity || 0)
      const v = Number(r.total_value || 0)
      if (r.direction === 'entrada') {
        entradaQty += q
        entradaValor += v
      } else {
        if (r.subtype === 'Consumo interno') {
          consumoInternoQty += q
          consumoInternoValor += v
        } else if (r.subtype === 'Solicitação') {
          solicitacaoQty += q
          solicitacaoValor += v
        } else if (EXTERNAL_SUBTYPES.has(r.subtype)) {
          consumoExternoQty += q
          consumoExternoValor += v
        } else {
          consumoInternoQty += q
          consumoInternoValor += v
        }
      }
    }

    const consumoTotalQty =
      consumoInternoQty + consumoExternoQty + solicitacaoQty
    const consumoTotalValor =
      consumoInternoValor + consumoExternoValor + solicitacaoValor

    return {
      entradaQty,
      entradaValor,
      consumoInternoQty,
      consumoInternoValor,
      consumoExternoQty,
      consumoExternoValor,
      solicitacaoQty,
      solicitacaoValor,
      consumoTotalQty,
      consumoTotalValor,
    }
  }, [filtered])

  const subtypeOptions = direction === 'entrada' ? ENTRY_SUBTYPES : EXIT_SUBTYPES

  const exportCSV = () => {
    const headers = [
      'Data',
      'Direção',
      'Tipo',
      'Origem/Almoxarifado',
      'Código',
      'Item',
      'Unidade',
      'Quantidade',
      'Valor Unitário',
      'Valor Total',
      'Origem/Destino',
      'NF',
      'AFM',
      'Lote',
      'Validade',
      'Observações',
    ]
    const lines = [headers.join(';')]
    for (const r of filtered) {
      lines.push(
        [
          fmtDate(r.movement_date),
          r.direction === 'entrada' ? 'Entrada' : 'Saída',
          r.subtype,
          r.item_type === 'pharmacy' ? 'Farmácia' : 'Almoxarifado',
          r.item_code || '',
          (r.item_name || '').replace(/;/g, ','),
          r.unit || '',
          fmtNum(r.quantity),
          r.unit_price != null ? r.unit_price.toFixed(2).replace('.', ',') : '',
          r.total_value != null ? r.total_value.toFixed(2).replace('.', ',') : '',
          (r.origin_or_destination || '').replace(/;/g, ','),
          r.invoice_number || '',
          r.afm_number || '',
          r.batch_number || '',
          r.expiry_date || '',
          (r.notes || '').replace(/;/g, ',').replace(/\n/g, ' '),
        ].join(';')
      )
    }
    const blob = new Blob(['﻿' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `movimentacoes_${startDate}_a_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary-100 rounded-lg">
          <BarChart3 className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Movimentações e Consumo</h1>
          <p className="text-sm text-gray-500">
            Entradas (NFs) + saídas (consumo interno, doações, empréstimos, transferências, solicitações).
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="start">Data inicial</Label>
            <Input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="end">Data final</Label>
            <Input
              id="end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="direction">Direção</Label>
            <select
              id="direction"
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value as any)
                setSubtype('todos')
              }}
              className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm"
            >
              <option value="todas">Todas</option>
              <option value="entrada">Entradas (NF)</option>
              <option value="saida">Saídas (consumo)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="subtype">Tipo</Label>
            <select
              id="subtype"
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm"
              disabled={direction === 'todas'}
            >
              <option value="todos">Todos</option>
              {subtypeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="item_type">Categoria</Label>
            <select
              id="item_type"
              value={itemType}
              onChange={(e) => setItemType(e.target.value as any)}
              className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm"
            >
              <option value="todos">Farmácia + Almoxarifado</option>
              <option value="pharmacy">Farmácia</option>
              <option value="warehouse">Almoxarifado</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="search">Buscar item / NF / destino</Label>
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1"
              placeholder="Nome, código, NF, fornecedor, setor..."
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
                className="w-4 h-4"
              />
              Incluir cancelados/estornados
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={load} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<ArrowDownToLine className="w-5 h-5" />}
          label="Entradas (NF)"
          qty={totals.entradaQty}
          value={totals.entradaValor}
          color="emerald"
        />
        <SummaryCard
          icon={<ArrowUpFromLine className="w-5 h-5" />}
          label="Consumo interno"
          qty={totals.consumoInternoQty + totals.solicitacaoQty}
          value={totals.consumoInternoValor + totals.solicitacaoValor}
          color="blue"
          hint="Saída direta + solicitações"
        />
        <SummaryCard
          icon={<ArrowUpFromLine className="w-5 h-5" />}
          label="Consumo externo"
          qty={totals.consumoExternoQty}
          value={totals.consumoExternoValor}
          color="amber"
          hint="Empréstimo, doação, permuta, transferência"
        />
        <SummaryCard
          icon={<ArrowUpFromLine className="w-5 h-5" />}
          label="Consumo total"
          qty={totals.consumoTotalQty}
          value={totals.consumoTotalValor}
          color="rose"
        />
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabela detalhada */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">
            {filtered.length.toLocaleString('pt-BR')} movimentações encontradas
          </h2>
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Nenhuma movimentação no período/filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Data</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Direção</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Item</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Qtd</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Valor</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Origem / Destino</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">NF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.movement_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {fmtDate(r.movement_date)}
                    </td>
                    <td className="px-3 py-2">
                      {r.direction === 'entrada' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ArrowDownToLine className="w-3 h-3" />
                          Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <ArrowUpFromLine className="w-3 h-3" />
                          Saída
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">{r.subtype}</td>
                    <td className="px-3 py-2 text-xs text-gray-900">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">
                          {r.item_type === 'pharmacy' ? (
                            <Pill className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Package2 className="w-3 h-3 text-purple-600" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.item_name || '—'}</div>
                          <div className="text-[10px] text-gray-500 font-mono">{r.item_code || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-medium">
                      {fmtNum(r.quantity)} {r.unit || ''}
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-gray-700">
                      {fmtBRL(r.total_value)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {r.origin_or_destination || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 font-mono">
                      {r.invoice_number || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  qty,
  value,
  color,
  hint,
}: {
  icon: React.ReactNode
  label: string
  qty: number
  value: number
  color: 'emerald' | 'blue' | 'amber' | 'rose'
  hint?: string
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center gap-2 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{fmtNum(qty)}</div>
      <div className="text-xs">{fmtBRL(value)}</div>
      {hint && <div className="text-[10px] mt-1 opacity-75">{hint}</div>}
    </div>
  )
}
