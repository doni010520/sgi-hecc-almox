import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Download, AlertCircle,
  Loader2, ArrowUpDown, Pill, FileSpreadsheet, FileText,
  Eye, Plus, Edit, Trash2, PackagePlus, PackageMinus, X, Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { itemsService } from '@/lib/services/items'
import { stockService } from '@/lib/services/stock'
import { supabase } from '@/lib/supabase'
import type { ItemStockWithLocation } from '@/lib/types/stock'

interface LotRow {
  batch_number: string
  expiry_date: string | null
  current_quantity: number
}
import { AdvancedFilters } from '@/components/inventory/advanced-filters'
import { EditStockDialog } from '@/components/inventory/edit-stock-dialog'
import { DeleteItemDialog } from '@/components/inventory/delete-item-dialog'
import { AddStockDialog } from '@/components/inventory/add-stock-dialog'
import { EditItemDialog } from '@/components/inventory/edit-item-dialog'
import { useAuth } from '@/contexts/auth'
import type { Item, FilterOptions } from '@/lib/services/items'
import { ImportDialog } from '@/components/inventory/import-dialog'
import { AddItemDialog } from '@/components/inventory/add-item-dialog'

interface PharmacyItemsProps {
  locationId?: string
  locationName?: string
}

export function PharmacyItems({ locationId: _locationId, locationName }: PharmacyItemsProps = {}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    status: []
  })
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showEditStockDialog, setShowEditStockDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEntryDialog, setShowEntryDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [hideZeroStock, setHideZeroStock] = useState(true)
  const [hideNoLot, setHideNoLot] = useState(true)
  const [showEditItemDialog, setShowEditItemDialog] = useState(false)
  // Modal de lotes do item
  const [lotModalItem, setLotModalItem] = useState<Item | null>(null)
  // Saldos por local (CAF, SAT_1, SAT_2, SAT_T) carregados em uma chamada.
  // Map<itemId, Map<locationCode, quantity>>
  const [stocksByItem, setStocksByItem] = useState<Map<string, Record<string, number>>>(new Map())
  // Lotes ativos por item, ordenados por validade (FEFO).
  const [lotsByItem, setLotsByItem] = useState<Map<string, LotRow[]>>(new Map())

  const handleRegisterEntry = (item: Item) => {
    setSelectedItem(item)
    setShowEntryDialog(true)
  }

  const handleEditItem = (item: Item) => {
    setSelectedItem(item)
    setShowEditItemDialog(true)
  }

  const isAdmin = user?.role === 'administrador'
  const canEdit = user?.role === 'administrador' || user?.role === 'gestor'

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    try {
      setLoading(true)
      setError(null)
      // Carrega itens, saldos por local e lotes ativos em paralelo
      const [pharmacyItems, allStocks, allLots] = await Promise.all([
        itemsService.getByType('pharmacy', filters),
        loadAllPharmacyStocks(),
        loadAllLots(),
      ])

      setItems(pharmacyItems)
      setStocksByItem(allStocks)
      setLotsByItem(allLots)
    } catch (error) {
      console.error('Error loading items:', error)
      setError('Erro ao carregar itens. Por favor, tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Busca saldo de todos os itens de farmacia em todos os locais e agrupa por item_id.
  async function loadAllPharmacyStocks(): Promise<Map<string, Record<string, number>>> {
    try {
      // Lista os locais ativos uma vez (com cache no service) e depois busca todos
      // os saldos de cada local de uma so vez (paginacao 1k linhas eh suficiente).
      const locations = await stockService.getLocations()
      const result = new Map<string, Record<string, number>>()

      // Faz uma query por local. Sao 5 locais no maximo => 5 round-trips paralelos.
      const perLocation = await Promise.all(
        locations.map(async (loc) => {
          const rows = await stockService.getStocksByLocation(loc.id, 'pharmacy')
          return { code: loc.code, rows }
        })
      )

      for (const { code, rows } of perLocation) {
        for (const r of rows as ItemStockWithLocation[]) {
          const bucket = result.get(r.item_id) ?? {}
          bucket[code] = r.quantity
          result.set(r.item_id, bucket)
        }
      }
      return result
    } catch (e) {
      console.error('loadAllPharmacyStocks failed (continuando sem saldos por local):', e)
      return new Map()
    }
  }

  // Busca todos os lotes ativos (saldo > 0) e agrupa por item_id, ordenados por validade (FEFO).
  async function loadAllLots(): Promise<Map<string, LotRow[]>> {
    try {
      const result = new Map<string, LotRow[]>()
      // Paginação simples — 5000 lotes deve ser suficiente para o estoque atual.
      const { data, error } = await supabase
        .from('expiry_tracking')
        .select('item_id, batch_number, expiry_date, current_quantity')
        .gt('current_quantity', 0)
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .limit(5000)
      if (error) throw error
      for (const row of (data || []) as Array<LotRow & { item_id: string }>) {
        const list = result.get(row.item_id) ?? []
        list.push({
          batch_number: row.batch_number,
          expiry_date: row.expiry_date,
          current_quantity: row.current_quantity,
        })
        result.set(row.item_id, list)
      }
      return result
    } catch (e) {
      console.error('loadAllLots failed (continuando sem lotes):', e)
      return new Map()
    }
  }

  const handleExport = async () => {
    try {
      await itemsService.exportToExcel(
        filteredItems,
        `itens_farmacia_${new Date().toISOString().split('T')[0]}`
      )
    } catch (error) {
      console.error('Error exporting items:', error)
      setError('Erro ao exportar itens. Por favor, tente novamente.')
    }
  }

  void setShowEditStockDialog // keep reference

  const handleDelete = (item: Item) => {
    setSelectedItem(item)
    setShowDeleteDialog(true)
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedItems = [...items].sort((a, b) => {
    if (!sortColumn) return 0

    const aValue = a[sortColumn as keyof Item]
    const bValue = b[sortColumn as keyof Item]

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' 
        ? aValue - bValue
        : bValue - aValue
    }

    return 0
  })

  const hasLotInfo = (item: Item) => {
    const lots = lotsByItem.get(item.id) ?? []
    if (lots.length > 0) return true
    return !!((item as any).batch_number) && !!item.expiry_date
  }

  const filteredItems = sortedItems
    .filter(item => !hideZeroStock || (item.current_stock ?? 0) > 0)
    .filter(item => !hideNoLot || hasLotInfo(item))
    .filter(item =>
      searchTerm === '' ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code?.toLowerCase().includes(searchTerm.toLowerCase())
    )

  const zeroStockCount = sortedItems.filter(item => (item.current_stock ?? 0) === 0).length
  const noLotCount = sortedItems.filter(item => (item.current_stock ?? 0) > 0 && !hasLotInfo(item)).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Carregando itens...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadItems}>Tentar Novamente</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
        {/* Layout: empilha em < xl porque com 4 botoes + titulo + sidebar, falta espaco em telas medias */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-3 bg-blue-100 rounded-lg flex-shrink-0">
              <Pill className="w-6 h-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{locationName ? `Estoque — ${locationName}` : 'Itens da Farmácia'}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Gestão avançada do estoque farmacêutico
              </p>
            </div>
          </div>
          {/* flex-wrap garante que os botoes nao espremam em larguras intermediarias */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Importar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => navigate('/inventory/pharmacy/nf-entry')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Nova Entrada
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => navigate('/inventory/pharmacy/saida-lote')}
            >
              <PackageMinus className="w-4 h-4 mr-2" />
              Registrar Saída
            </Button>
            <Button
              className="bg-primary-500 hover:bg-primary-600 text-white"
              onClick={() => setShowAddItemDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Item
            </Button>
            <AdvancedFilters
              categories={['Medicamentos', 'Material Hospitalar']}
              onFilterChange={setFilters}
              defaultFilters={filters}
            />
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar por nome, código..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th
                  className="px-2 py-2 text-left text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-1">
                    Código
                    {sortColumn === 'code' && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="px-2 py-2 text-left text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Nome
                    {sortColumn === 'name' && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="px-2 py-2 text-left text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-1">
                    Categoria
                    {sortColumn === 'category' && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 whitespace-nowrap">
                  Unidade
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                  Lote
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                  Validade
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-600 whitespace-nowrap">
                  Última Compra
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-600 whitespace-nowrap">
                  Valor Ref.
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-600 whitespace-nowrap">
                  Consumo
                </th>
                <th
                  className="px-2 py-2 text-right text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('current_stock')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Estoque CAF
                    {sortColumn === 'current_stock' && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap" title="Saldo nos demais estoques (Satelite 1, Satelite 2, Satelite T)">
                  Sat. 1/2/T
                </th>
                <th
                  className="px-2 py-2 text-right text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  onClick={() => handleSort('min_stock')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Mín.
                    {sortColumn === 'min_stock' && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-600 whitespace-nowrap">
                  Pto. Sup.
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 whitespace-nowrap">
                  Status
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 whitespace-nowrap">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((item) => {
                const history = Array.isArray(item.consumption_history) ? item.consumption_history : []
                const avgConsumption = history.length
                  ? history.reduce((acc, curr) => acc + (curr?.quantity || 0), 0) / history.length
                  : 0

                const supplyPoint = Math.ceil(
                  (avgConsumption / 30) * (item.lead_time_days || 7) * 1.5
                )
                
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">{item.code}</td>
                    <td className="px-2 py-2 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">{item.category}</td>
                    <td className="px-2 py-2 text-xs text-center text-gray-700 font-medium">{item.unit}</td>
                    {(() => {
                      // Lote FEFO + contagem de lotes adicionais (preferência: expiry_tracking).
                      const lots = lotsByItem.get(item.id) ?? []
                      const fefo = lots[0]
                      const extra = Math.max(lots.length - 1, 0)
                      const batchDisplay = fefo?.batch_number || (item as any).batch_number || '-'
                      const expiryDisplay = fefo?.expiry_date || item.expiry_date || null
                      return (
                        <>
                          <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">
                            <span className="font-medium">{batchDisplay}</span>
                            {extra > 0 && (
                              <span
                                className="ml-1 inline-block px-1.5 py-0 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium"
                                title={`Mais ${extra} lote(s) — clique para ver detalhes`}
                              >
                                +{extra}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">
                            {expiryDisplay ? new Date(expiryDisplay + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </td>
                        </>
                      )
                    })()}
                    <td className="px-2 py-2 text-xs text-right text-gray-600 whitespace-nowrap">
                      {(item as any).last_purchase_price != null
                        ? Number((item as any).last_purchase_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '-'}
                    </td>
                    <td className="px-2 py-2 text-xs text-right text-gray-600 whitespace-nowrap">
                      {(item as any).reference_price != null
                        ? Number((item as any).reference_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '-'}
                    </td>
                    <td className="px-2 py-2 text-xs text-right text-gray-600 whitespace-nowrap">
                      {Math.round(avgConsumption)} {item.unit}/mês
                    </td>
                    <td className="px-2 py-2 text-sm text-right font-medium whitespace-nowrap">
                      <button
                        onClick={() => setLotModalItem(item)}
                        className="inline-flex items-center gap-1 hover:text-blue-600 hover:underline cursor-pointer"
                        title="Ver lotes disponíveis"
                      >
                        {item.current_stock} {item.unit}
                        {(lotsByItem.get(item.id) ?? []).length > 0 && (
                          <Layers className="w-3 h-3 text-blue-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      {(() => {
                        const bucket = stocksByItem.get(item.id) ?? {}
                        // Mostra apenas locais satelite que tem saldo > 0 ou existem como chave.
                        // CAF ja aparece na coluna "Estoque CAF".
                        const sat1 = bucket['SAT_1'] ?? 0
                        const sat2 = bucket['SAT_2'] ?? 0
                        const satT = bucket['SAT_T'] ?? 0
                        const chip = (label: string, value: number) => (
                          <span
                            key={label}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0 text-[10px] rounded border whitespace-nowrap ${
                              value > 0
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-gray-50 border-gray-200 text-gray-400'
                            }`}
                            title={`${label}: ${value} ${item.unit}`}
                          >
                            <span className="font-medium">{label}</span>
                            <span>{value}</span>
                          </span>
                        )
                        return (
                          <div className="flex flex-wrap gap-0.5 justify-start">
                            {chip('S1', sat1)}
                            {chip('S2', sat2)}
                            {chip('ST', satT)}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-2 py-2 text-xs text-right text-gray-600 whitespace-nowrap">
                      {item.min_stock} {item.unit}
                    </td>
                    <td className="px-2 py-2 text-xs text-right text-gray-600 whitespace-nowrap">
                      {supplyPoint} {item.unit}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-center">
                        {item.current_stock === 0 ? (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-50 text-red-600 border border-red-200 whitespace-nowrap">Sem Estoque</span>
                        ) : item.current_stock <= item.min_stock ? (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200 whitespace-nowrap">Estoque Baixo</span>
                        ) : item.current_stock <= supplyPoint ? (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-600 border border-blue-200 whitespace-nowrap">Ponto Pedido</span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-50 text-green-600 border border-green-200">Normal</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-center">
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <Button variant="outline" size="sm" onClick={() => handleRegisterEntry(item)} title="Registrar Entrada de Material" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-8 px-2">
                              <PackagePlus className="w-4 h-4" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button variant="outline" size="sm" onClick={() => handleEditItem(item)} title="Editar item" className="text-amber-600 border-amber-200 hover:bg-amber-50 h-8 px-2">
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/inventory/pharmacy/${item.id}`)} title="Ver detalhes" className="h-8 px-2">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button variant="outline" size="sm" onClick={() => handleDelete(item)} title="Excluir" className="text-red-600 border-red-200 hover:bg-red-50 h-8 px-2">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center flex-wrap px-4 py-3 border-t border-gray-100 bg-gray-50/40">
          <label className="flex items-center gap-2 text-sm text-gray-700 select-none whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={hideZeroStock}
              onChange={(e) => setHideZeroStock(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            Ocultar itens zerados
            {hideZeroStock && zeroStockCount > 0 && (
              <span className="text-xs text-gray-500">({zeroStockCount} ocultos)</span>
            )}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 select-none whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={hideNoLot}
              onChange={(e) => setHideNoLot(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            Ocultar itens sem lote/validade
            {hideNoLot && noLotCount > 0 && (
              <span className="text-xs text-gray-500">({noLotCount} ocultos)</span>
            )}
          </label>
        </div>
      </div>

      {/* Import Dialog */}
      <ImportDialog
        type="pharmacy"
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={loadItems}
      />

      {/* Add Item Dialog */}
      <AddItemDialog
        type="pharmacy"
        open={showAddItemDialog}
        onOpenChange={setShowAddItemDialog}
        onSuccess={loadItems}
      />

      {/* Edit Stock Dialog */}
      {selectedItem && (
        <EditStockDialog
          item={selectedItem}
          open={showEditStockDialog}
          onOpenChange={setShowEditStockDialog}
          onSuccess={() => {
            loadItems()
            setSelectedItem(null)
          }}
        />
      )}

      {/* Delete Item Dialog */}
      {selectedItem && (
        <DeleteItemDialog
          item={selectedItem}
          type="pharmacy"
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onSuccess={() => {
            loadItems()
            setSelectedItem(null)
          }}
        />
      )}

      {/* Register Entry Dialog (form completo) */}
      {selectedItem && (
        <AddStockDialog
          item={selectedItem}
          type="pharmacy"
          open={showEntryDialog}
          onOpenChange={setShowEntryDialog}
          onSuccess={() => {
            loadItems()
            setSelectedItem(null)
          }}
        />
      )}

      {/* Edit Item Dialog */}
      {selectedItem && (
        <EditItemDialog
          item={selectedItem}
          type="pharmacy"
          open={showEditItemDialog}
          onOpenChange={(open) => {
            setShowEditItemDialog(open)
            if (!open) setSelectedItem(null)
          }}
          onSuccess={() => {
            loadItems()
            setSelectedItem(null)
          }}
        />
      )}

      {/* Lot detail modal */}
      {lotModalItem && (() => {
        const lots = lotsByItem.get(lotModalItem.id) ?? []
        const today = Date.now()
        function expiryBand(d: string | null): { bg: string; text: string; label: string } {
          if (!d) return { bg: '#f9fafb', text: '#6b7280', label: '—' }
          const days = Math.floor((new Date(d + 'T00:00:00').getTime() - today) / 86400000)
          if (days < 0) return { bg: '#fef2f2', text: '#dc2626', label: 'Vencido' }
          if (days <= 30) return { bg: '#fef2f2', text: '#dc2626', label: `${days}d` }
          if (days <= 90) return { bg: '#fffbeb', text: '#d97706', label: `${days}d` }
          return { bg: '#f0fdf4', text: '#16a34a', label: `${days}d` }
        }
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setLotModalItem(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-500" />
                    Lotes — {lotModalItem.name}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Estoque total: <strong>{lotModalItem.current_stock} {lotModalItem.unit}</strong> · {lots.length} lote(s) rastreado(s)
                  </p>
                </div>
                <button
                  onClick={() => setLotModalItem(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-80 px-5 py-3 space-y-2">
                {lots.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">Nenhum lote rastreado para este item.</p>
                ) : (
                  lots.map((lot, idx) => {
                    const band = expiryBand(lot.expiry_date)
                    return (
                      <div
                        key={`${lot.batch_number}-${idx}`}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl border text-sm"
                        style={{ background: band.bg, borderColor: band.bg === '#f9fafb' ? '#e5e7eb' : band.bg }}
                      >
                        <div className="flex items-center gap-2">
                          {idx === 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold">FEFO</span>
                          )}
                          <span className="font-semibold text-gray-900">Lote {lot.batch_number}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-gray-600">
                            Val.: {lot.expiry_date ? new Date(lot.expiry_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                          </span>
                          <span className="font-medium px-2 py-0.5 rounded-full" style={{ color: band.text, background: band.bg === '#f9fafb' ? '#f3f4f6' : undefined }}>
                            {band.label}
                          </span>
                          <span className="font-bold text-gray-800">{lot.current_quantity} {lotModalItem.unit}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setLotModalItem(null)}>Fechar</Button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}