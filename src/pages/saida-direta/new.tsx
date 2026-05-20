import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Plus, Trash2, Loader2, AlertCircle, Package2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { warehouseDispatchService, DISPATCH_TYPE_LABELS, type DispatchType } from '@/lib/services/warehouse-dispatch'
import type { Item } from '@/lib/services/items'

interface SelectedItem {
  item_id: string
  name: string
  code: string
  unit: string
  current_stock: number
  quantity: number
}

interface Department {
  id: string
  name: string
}

export function NewWarehouseDispatch() {
  const navigate = useNavigate()

  // Form state
  const [destinationType, setDestinationType] = useState<'interno' | 'externo'>('interno')
  const [departmentId, setDepartmentId] = useState<string>('')
  const [departmentText, setDepartmentText] = useState<string>('')
  const [dispatchType, setDispatchType] = useState<DispatchType>('consumo')
  const [notes, setNotes] = useState('')

  // Departments
  const [departments, setDepartments] = useState<Department[]>([])

  // Items state
  const [allItems, setAllItems] = useState<Item[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadItems()
    loadDepartments()
  }, [])

  async function loadItems() {
    try {
      setLoadingItems(true)
      const { data, error } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      setAllItems((data as any) || [])
    } catch (e) {
      console.error('Error loading items:', e)
    } finally {
      setLoadingItems(false)
    }
  }

  async function loadDepartments() {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name')
      if (error) throw error
      setDepartments((data as any) || [])
    } catch (e) {
      console.error('Error loading departments:', e)
    }
  }

  const filteredItems = allItems
    .filter((item) => {
      if (!itemSearch.trim()) return false
      const q = itemSearch.toLowerCase()
      return (
        item.name.toLowerCase().includes(q) ||
        (item.code || '').toLowerCase().includes(q)
      )
    })
    .filter((item) => !selectedItems.some((s) => s.item_id === item.id))

  const addItem = (item: Item) => {
    setSelectedItems((prev) => [
      ...prev,
      {
        item_id: item.id,
        name: item.name,
        code: item.code,
        unit: item.unit || 'UN',
        current_stock: item.current_stock || 0,
        quantity: 1,
      },
    ])
    setItemSearch('')
  }

  const removeItem = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.item_id !== itemId))
  }

  const updateQuantity = (itemId: string, qty: number) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.item_id === itemId ? { ...i, quantity: Math.max(1, qty) } : i))
    )
  }

  const hasDestination =
    destinationType === 'interno'
      ? !!departmentId
      : departmentText.trim().length > 0
  const allItemsValid =
    selectedItems.length > 0 &&
    selectedItems.every((i) => i.quantity > 0 && i.quantity <= i.current_stock)
  const canSubmit = hasDestination && allItemsValid

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      await warehouseDispatchService.create({
        destination_department_id: destinationType === 'interno' ? departmentId || undefined : undefined,
        destination_department_text: destinationType === 'externo' ? departmentText.trim() : undefined,
        dispatch_type: dispatchType,
        notes: notes || undefined,
        items: selectedItems.map((i) => ({ item_id: i.item_id, quantity: i.quantity })),
      })
      navigate('/saida-direta')
    } catch (e: any) {
      setError(e?.message || 'Erro ao registrar saída')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/saida-direta')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100 rounded-lg">
            <Package2 className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nova Saída Direta</h1>
            <p className="text-sm text-gray-500">
              Registre uma saída do almoxarifado sem solicitação prévia. O estoque é abatido automaticamente.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Destination */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Destino</h2>

        {/* Toggle: setor interno OU unidade externa */}
        <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => {
              setDestinationType('interno')
              setDepartmentText('')
              setDispatchType('consumo')
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              destinationType === 'interno'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Setor interno
          </button>
          <button
            type="button"
            onClick={() => {
              setDestinationType('externo')
              setDepartmentId('')
              if (dispatchType === 'consumo') setDispatchType('doacao')
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              destinationType === 'externo'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Unidade externa
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {destinationType === 'interno' ? (
            <div className="md:col-span-2">
              <Label htmlFor="department">Setor / Departamento *</Label>
              <select
                id="department"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm"
              >
                <option value="">— Selecione —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Se o destino for uma unidade externa (outro hospital), troque a opção acima.
              </p>
            </div>
          ) : (
            <div className="md:col-span-2">
              <Label htmlFor="department_text">Nome da unidade externa *</Label>
              <Input
                id="department_text"
                value={departmentText}
                onChange={(e) => setDepartmentText(e.target.value)}
                placeholder="Ex: Hospital São Rafael, UPA Lauro de Freitas, SAMU"
                className="mt-1"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Digite o nome do hospital, posto ou unidade que vai receber os itens.
              </p>
            </div>
          )}
          <div className="md:col-span-2">
            <Label htmlFor="dispatch_type">Tipo de Saída *</Label>
            <select
              id="dispatch_type"
              value={dispatchType}
              onChange={(e) => setDispatchType(e.target.value as DispatchType)}
              className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm"
            >
              {(Object.keys(DISPATCH_TYPE_LABELS) as DispatchType[]).map((key) => (
                <option key={key} value={key}>
                  {DISPATCH_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Selecione "Empréstimo" se o material vai voltar; "Doação" se não retorna; "Permuta" se há troca.
            </p>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais (opcional)"
              rows={2}
              className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Itens</h2>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar item por nome ou código..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {filteredItems.length > 0 && (
          <div className="mb-4 rounded-lg border border-gray-200 overflow-hidden max-h-60 overflow-y-auto">
            {filteredItems.slice(0, 20).map((item) => (
              <div
                key={item.id}
                onClick={() => addItem(item)}
                className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-sm text-gray-900">{item.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{item.code}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    Estoque:{' '}
                    <span
                      className={`font-semibold ${
                        (item.current_stock || 0) > 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {item.current_stock || 0}
                    </span>{' '}
                    {item.unit}
                  </span>
                  <Plus className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            ))}
          </div>
        )}

        {loadingItems && (
          <div className="text-center py-4 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Carregando itens...
          </div>
        )}

        {selectedItems.length === 0 ? (
          <div className="text-center py-8 rounded-lg border-2 border-dashed border-gray-200 text-gray-500">
            Nenhum item adicionado. Use a busca acima para encontrar e adicionar.
          </div>
        ) : (
          <div className="space-y-2">
            {selectedItems.map((item) => {
              const overStock = item.quantity > item.current_stock
              return (
                <div
                  key={item.item_id}
                  className={`flex items-center gap-4 px-4 py-3 rounded-lg border ${
                    overStock
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{item.name}</div>
                    <div className="text-xs text-gray-500">
                      {item.code} | Estoque: {item.current_stock} {item.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Qtd:</Label>
                    <input
                      type="number"
                      min={1}
                      max={item.current_stock}
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.item_id, parseInt(e.target.value) || 1)
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-20 px-2 py-1 text-sm text-center border border-gray-300 rounded"
                    />
                    <span className="text-xs text-gray-500">{item.unit}</span>
                  </div>
                  {overStock && (
                    <span className="text-xs text-red-600 whitespace-nowrap">Excede estoque!</span>
                  )}
                  <button
                    onClick={() => removeItem(item.item_id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/saida-direta')}>
          Cancelar
        </Button>
        <Button
          className="bg-primary-500 hover:bg-primary-600 text-white"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Registrando...
            </>
          ) : (
            'Registrar Saída'
          )}
        </Button>
      </div>
    </div>
  )
}
