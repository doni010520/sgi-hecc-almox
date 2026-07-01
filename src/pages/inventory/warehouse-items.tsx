import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Download, AlertCircle,
  Loader2, ArrowUpDown, Package2, FileSpreadsheet, FileText,
  Eye, Plus, Edit, Trash2, PackagePlus, PackageMinus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { itemsService } from '@/lib/services/items'
import { AdvancedFilters } from '@/components/inventory/advanced-filters'
import { ImportDialog } from '@/components/inventory/import-dialog'
import { AddItemDialog } from '@/components/inventory/add-item-dialog'
import { EditStockDialog } from '@/components/inventory/edit-stock-dialog'
import { DeleteItemDialog } from '@/components/inventory/delete-item-dialog'
import { AddStockDialog } from '@/components/inventory/add-stock-dialog'
import { EditItemDialog } from '@/components/inventory/edit-item-dialog'
import { useAuth } from '@/contexts/auth'
import type { Item, FilterOptions } from '@/lib/services/items'

export function WarehouseItems() {
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
  const [showEditItemDialog, setShowEditItemDialog] = useState(false)

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
  const loadItems = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await itemsService.getByType('warehouse', filters)
      setItems(data)
    } catch (error) {
      console.error('Error loading items:', error)
      setError('Erro ao carregar itens. Por favor, tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [filters])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const handleExport = async () => {
    try {
      setError(null)
      await itemsService.exportToExcel(
        filteredItems,
        `itens_almoxarifado_${new Date().toISOString().split('T')[0]}`
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

  const filteredItems = sortedItems
    .filter(item => !hideZeroStock || (item.current_stock ?? 0) > 0)
    .filter(item =>
      searchTerm === '' ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code?.toLowerCase().includes(searchTerm.toLowerCase())
    )

  const zeroStockCount = sortedItems.filter(item => (item.current_stock ?? 0) === 0).length

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
            <div className="p-3 bg-purple-100 rounded-lg flex-shrink-0">
              <Package2 className="w-6 h-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Itens do Almoxarifado</h1>
              <p className="text-sm text-gray-500 mt-1">
                Gestão avançada do estoque de materiais
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
              onClick={() => navigate('/inventory/warehouse/nf-entry')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Nova Entrada
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => navigate('/inventory/warehouse/saida-lote')}
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
              categories={[
                'Material de Escritório',
                'Material de Limpeza',
                'Equipamentos',
                'Outros'
              ]}
              onFilterChange={setFilters}
              defaultFilters={filters}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
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
                  className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-2">
                    Código
                    {sortColumn === 'code' && (
                      <ArrowUpDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Nome
                    {sortColumn === 'name' && (
                      <ArrowUpDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-2">
                    Categoria
                    {sortColumn === 'category' && (
                      <ArrowUpDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  Unidade
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Lote
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Validade
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Valor da Última Compra
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Valor Referencial
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Consumo Médio
                </th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('current_stock')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Estoque Atual
                    {sortColumn === 'current_stock' && (
                      <ArrowUpDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('min_stock')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Estoque Mínimo
                    {sortColumn === 'min_stock' && (
                      <ArrowUpDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  Ponto de Suprimento
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
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
                    <td className="px-4 py-3 text-sm text-gray-600">{item.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.category}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-700 font-medium">{item.unit}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {(item as any).batch_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.expiry_date ? new Date(item.expiry_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {(item as any).last_purchase_price != null
                        ? Number((item as any).last_purchase_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {(item as any).reference_price != null
                        ? Number((item as any).reference_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {Math.round(avgConsumption)} {item.unit}/mês
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {item.current_stock} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {item.min_stock} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {supplyPoint} {item.unit}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        {item.current_stock === 0 ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-50 text-red-600 border border-red-200">
                            Sem Estoque
                          </span>
                        ) : item.current_stock <= item.min_stock ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200">
                            Estoque Baixo
                          </span>
                        ) : item.current_stock <= supplyPoint ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                            Ponto de Pedido
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-50 text-green-600 border border-green-200">
                            Normal
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
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
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/inventory/warehouse/${item.id}`)} title="Ver detalhes" className="h-8 px-2">
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
      </div>

      {/* Import Dialog */}
      <ImportDialog
        type="warehouse"
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={loadItems}
      />

      {/* Add Item Dialog */}
      <AddItemDialog
        type="warehouse"
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
          type="warehouse"
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
          type="warehouse"
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
          type="warehouse"
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
    </div>
  )
}