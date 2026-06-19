import { useState, useEffect } from 'react'
import { Search, Plus, Minus, Loader2, Bed, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Item } from '@/lib/services/items'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

// Item that requires special patient info
const COLCHAO_CASCA_OVO_CODE = '65.30.19.00114671-8'

const itemSchema = z.object({
  id: z.string().uuid('ID inválido'),
  quantity: z.number().min(1, 'Quantidade deve ser maior que 0'),
  patient_name: z.string().optional(),
  patient_bed: z.string().optional(),
  patient_ward: z.string().optional(),
  nurse_name: z.string().optional(),
  _uid: z.string().optional(),
  // justificativa para itens de farmacia
  justificativa_motivo: z.string().optional(),
  justificativa_patient_name: z.string().optional(),
  justificativa_prontuario: z.string().optional(),
  // lote selecionado
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
})

export type RequestItem = z.infer<typeof itemSchema>

// ID único por linha no cliente — permite múltiplas entradas do mesmo item
// (ex: Colchão Casca de Ovo, uma entrada por paciente)
const makeUid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`

interface RequestItemsProps {
  type: 'pharmacy' | 'warehouse'
  onSubmit: (items: RequestItem[]) => void
  defaultValues?: RequestItem[]
}

const JUSTIFICATIVA_MOTIVOS = ['Quebra', 'Não encontrado', 'Avariado'] as const

export function RequestItems({ type, onSubmit, defaultValues = [] }: RequestItemsProps) {
  const [items, setItems] = useState<Item[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItems, setSelectedItems] = useState<RequestItem[]>(
    defaultValues.map(v => (v._uid ? v : { ...v, _uid: makeUid() }))
  )
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Sincroniza selectedItems quando defaultValues muda (ex: ao "Continuar editando" rascunho)
  useEffect(() => {
    if (defaultValues.length > 0 && selectedItems.length === 0) {
      setSelectedItems(defaultValues.map(v => (v._uid ? v : { ...v, _uid: makeUid() })))
    }
  }, [defaultValues])

  // Colchao casca de ovo modal
  const [showPatientModal, setShowPatientModal] = useState(false)
  const [pendingItem, setPendingItem] = useState<Item | null>(null)
  const [patientName, setPatientName] = useState('')
  const [patientBed, setPatientBed] = useState('')
  const [patientWard, setPatientWard] = useState('')
  const [nurseName, setNurseName] = useState('')
  const [patientError, setPatientError] = useState<string | null>(null)

  // Justificativa modal (farmacia, nao-colchao)
  const [showJustModal, setShowJustModal] = useState(false)
  const [justPendingItem, setJustPendingItem] = useState<Item | null>(null)
  const [justPendingUid, setJustPendingUid] = useState<string>('')
  const [justMotivo, setJustMotivo] = useState<string>('')
  const [justPatientName, setJustPatientName] = useState('')
  const [justProntuario, setJustProntuario] = useState('')
  const [justIsCurativo, setJustIsCurativo] = useState(false)
  const [justError, setJustError] = useState<string | null>(null)

  // Cache de medication_class por item_id
  const [medicationClassCache, setMedicationClassCache] = useState<Record<string, string | null>>({})

  // Cache de lotes por item_id (FEFO: ordenado por expiry_date ASC)
  const [lotsCache, setLotsCache] = useState<Record<string, Array<{ batch_number: string; expiry_date: string; current_quantity: number }>>>({})

  useEffect(() => {
    loadItems()
  }, [])

  // Auto-seleciona lote FEFO quando lotes são carregados
  useEffect(() => {
    if (type !== 'pharmacy') return
    setSelectedItems(prev => prev.map(item => {
      if (item.batch_number) return item
      const lots = lotsCache[item.id]
      if (lots && lots.length > 0) {
        return { ...item, batch_number: lots[0].batch_number, expiry_date: lots[0].expiry_date }
      }
      return item
    }))
  }, [lotsCache])

  async function loadItems() {
    try {
      setLoading(true)
      const table = type === 'pharmacy' ? 'pharmacy_items' : 'warehouse_items'
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error('Error loading items:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchLotsForItem(itemId: string) {
    if (itemId in lotsCache) return
    const { data } = await supabase
      .from('expiry_tracking')
      .select('batch_number, expiry_date, current_quantity')
      .eq('item_id', itemId)
      .gt('current_quantity', 0)
      .order('expiry_date', { ascending: true })
    setLotsCache(prev => ({ ...prev, [itemId]: data || [] }))
  }

  async function getMedicationClass(itemId: string): Promise<string | null> {
    if (itemId in medicationClassCache) return medicationClassCache[itemId]
    const { data } = await supabase
      .from('pharmacy_items')
      .select('medication_class')
      .eq('id', itemId)
      .single()
    const cls = (data as any)?.medication_class ?? null
    setMedicationClassCache(prev => ({ ...prev, [itemId]: cls }))
    return cls
  }

  // Filter items based on search term, sort items with stock first
  const filteredItems = items
    .filter(item => {
      return searchTerm === '' ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()))
    })
    .sort((a, b) => {
      // Items with stock come first, then 0-stock at the bottom
      const aStock = (a as any).current_stock || 0
      const bStock = (b as any).current_stock || 0
      if (aStock > 0 && bStock <= 0) return -1
      if (aStock <= 0 && bStock > 0) return 1
      return 0
    })

  const handleAddItem = async (item: Item) => {
    // Colchão Casca de Ovo: permite múltiplas entradas (uma por paciente).
    // Sempre abre o modal — a checagem de paciente duplicado ocorre ao confirmar.
    if (item.code === COLCHAO_CASCA_OVO_CODE) {
      setPendingItem(item)
      setPatientName('')
      setPatientBed('')
      setPatientWard('')
      setNurseName('')
      setPatientError(null)
      setShowPatientModal(true)
      return
    }

    // Demais itens: não permite duplicar no mesmo pedido
    if (selectedItems.some(i => i.id === item.id)) return

    // Itens de farmacia (exceto colchao): abrir modal de justificativa
    if (type === 'pharmacy') {
      const cls = await getMedicationClass(item.id)
      // Inicia carregamento de lotes em paralelo enquanto usuário preenche o modal
      fetchLotsForItem(item.id)
      const isCurativo = cls?.toLowerCase() === 'curativo'
      setJustPendingItem(item)
      const uid = makeUid()
      setJustPendingUid(uid)
      setJustMotivo('')
      setJustPatientName('')
      setJustProntuario('')
      setJustIsCurativo(isCurativo)
      setJustError(null)
      setShowJustModal(true)
      return
    }

    setSelectedItems([...selectedItems, { id: item.id, quantity: 1, _uid: makeUid() }])
  }

  const handleConfirmPatientItem = () => {
    if (!pendingItem || !patientName.trim() || !patientBed.trim() || !patientWard.trim() || !nurseName.trim()) return

    // Regra: um item individual por paciente — não permite mesmo paciente duas vezes
    const normalizedName = patientName.trim().toLowerCase()
    const duplicate = selectedItems.some(
      i => i.id === pendingItem.id && i.patient_name?.trim().toLowerCase() === normalizedName
    )
    if (duplicate) {
      setPatientError(
        `Já existe um "${pendingItem.name}" solicitado para o paciente "${patientName.trim()}". Cada item é individual — informe um paciente diferente ou cancele.`
      )
      return
    }

    setSelectedItems([...selectedItems, {
      id: pendingItem.id,
      quantity: 1,
      patient_name: patientName.trim(),
      patient_bed: patientBed.trim(),
      patient_ward: patientWard.trim(),
      nurse_name: nurseName.trim(),
      _uid: makeUid(),
    }])
    setShowPatientModal(false)
    setPendingItem(null)
    setPatientError(null)
  }

  const handleConfirmJustificativa = () => {
    if (!justPendingItem) return

    // Curativo: apenas nome do paciente obrigatorio
    if (justIsCurativo) {
      if (!justPatientName.trim()) {
        setJustError('Informe o nome do paciente.')
        return
      }
    } else {
      // Demais: motivo + nome do paciente obrigatorios
      if (!justMotivo) {
        setJustError('Selecione o motivo.')
        return
      }
      if (!justPatientName.trim()) {
        setJustError('Informe o nome do paciente.')
        return
      }
    }

    setSelectedItems(prev => [
      ...prev,
      {
        id: justPendingItem.id,
        quantity: 1,
        _uid: justPendingUid,
        justificativa_motivo: justIsCurativo ? undefined : justMotivo,
        justificativa_patient_name: justPatientName.trim(),
        justificativa_prontuario: justProntuario.trim() || undefined,
      },
    ])
    setShowJustModal(false)
    setJustPendingItem(null)
    setJustError(null)
  }

  const handleRemoveItem = (uid: string) => {
    setSelectedItems(selectedItems.filter(item => item._uid !== uid))
  }

  const handleQuantityChange = (uid: string, quantity: number) => {
    setSelectedItems(selectedItems.map(item =>
      item._uid === uid ? { ...item, quantity } : item
    ))
  }

  const handleLotChange = (uid: string, batch_number: string, expiry_date: string) => {
    setSelectedItems(prev => prev.map(i => i._uid === uid ? { ...i, batch_number, expiry_date } : i))
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)

      // Validação crítica antes de enviar
      if (selectedItems.length === 0) {
        alert('Por favor, selecione pelo menos um item antes de continuar.')
        return
      }

      // Validar se todas as quantidades são válidas
      const invalidItems = selectedItems.filter(item => item.quantity <= 0)
      if (invalidItems.length > 0) {
        alert('Todos os itens devem ter quantidade maior que zero.')
        return
      }

      await onSubmit(selectedItems)
    } catch (error) {
      console.error('Error submitting items:', error)
    } finally {
      setSubmitting(false)
    }
  }

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

  return (
    <div className="space-y-6">
      {/* Search Items */}
      <div className="space-y-2">
        <Label>Buscar Itens</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Digite o nome ou código do item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Available Items */}
      <div className="space-y-2">
        <Label>Itens Disponíveis</Label>
        <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
          {filteredItems.map(item => {
            const stock = (item as any).current_stock || 0
            const isOutOfStock = stock <= 0
            return (
              <div key={item.id} className={`p-4 flex items-center justify-between ${isOutOfStock ? 'bg-red-50/50 opacity-60' : 'hover:bg-gray-50'}`}>
                <div>
                  <p className={`font-medium ${isOutOfStock ? 'text-gray-400' : ''}`}>{item.name}</p>
                  <p className="text-sm text-gray-500">
                    {item.code} • {item.category} • {item.unit}
                    <span className={`ml-2 font-medium ${isOutOfStock ? 'text-red-500' : 'text-green-600'}`}>
                      (Estoque: {stock})
                    </span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddItem(item)}
                  disabled={isOutOfStock || (item.code !== COLCHAO_CASCA_OVO_CODE && selectedItems.some(i => i.id === item.id))}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isOutOfStock ? 'Sem estoque' : 'Adicionar'}
                </Button>
              </div>
            )
          })}
          {filteredItems.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              Nenhum item encontrado
            </div>
          )}
        </div>
      </div>

      {/* Selected Items */}
      <div className="space-y-2">
        <Label>Itens Selecionados</Label>
        <div className="border-2 border-emerald-200 rounded-lg divide-y divide-emerald-100 bg-emerald-50/60">
          {selectedItems.map(selectedItem => {
            const item = items.find(i => i.id === selectedItem.id)
            if (!item) return null

            const isColchao = item.code === COLCHAO_CASCA_OVO_CODE
            const rowKey = selectedItem._uid || item.id

            return (
              <div key={rowKey} className="p-4 flex items-center justify-between hover:bg-emerald-100/50 transition-colors">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    {item.code} • {item.category} • {item.unit}
                  </p>
                  {selectedItem.patient_name && (
                    <div className="mt-1 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 text-blue-800">
                      <strong>Paciente:</strong> {selectedItem.patient_name} | <strong>Leito:</strong> {selectedItem.patient_bed} | <strong>Posto:</strong> {selectedItem.patient_ward} | <strong>Enf:</strong> {selectedItem.nurse_name}
                    </div>
                  )}
                  {/* Justificativa de farmacia */}
                  {(selectedItem.justificativa_motivo || selectedItem.justificativa_patient_name) && (
                    <div className="mt-1 text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-800 space-y-0.5">
                      {selectedItem.justificativa_motivo && (
                        <p><strong>Motivo:</strong> {selectedItem.justificativa_motivo}</p>
                      )}
                      {selectedItem.justificativa_patient_name && (
                        <p>
                          <strong>Paciente:</strong> {selectedItem.justificativa_patient_name}
                          {selectedItem.justificativa_prontuario && (
                            <> | <strong>Prontuario:</strong> {selectedItem.justificativa_prontuario}</>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                  {/* Seleção de lote FEFO (apenas farmácia) */}
                  {type === 'pharmacy' && !isColchao && (() => {
                    const lots = lotsCache[item.id]
                    if (lots === undefined) return (
                      <p className="mt-1 text-xs text-gray-400">Carregando lotes...</p>
                    )
                    if (lots.length === 0) return (
                      <p className="mt-1 text-xs text-red-500">Sem lotes disponíveis</p>
                    )
                    return (
                      <div className="mt-1">
                        <select
                          value={selectedItem.batch_number || lots[0].batch_number}
                          onChange={(e) => {
                            const lot = lots.find(l => l.batch_number === e.target.value)
                            if (lot) handleLotChange(selectedItem._uid!, lot.batch_number, lot.expiry_date)
                          }}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                        >
                          {lots.map(l => (
                            <option key={l.batch_number} value={l.batch_number}>
                              Lote: {l.batch_number} | Val: {new Date(l.expiry_date + 'T00:00:00').toLocaleDateString('pt-BR')} | Qtd: {l.current_quantity}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })()}
                </div>
                <div className="flex items-center gap-4">
                  {isColchao ? (
                    <span className="text-sm text-gray-700 px-2">
                      <strong>1 {item.unit}</strong>
                      <span className="ml-2 text-xs text-gray-500">(item individual por paciente)</span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(
                          selectedItem._uid!,
                          Math.max(1, selectedItem.quantity - 1)
                        )}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        value={selectedItem.quantity === 0 ? '' : selectedItem.quantity}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '') {
                            handleQuantityChange(selectedItem._uid!, 0)
                            return
                          }
                          const n = parseInt(raw, 10)
                          if (!isNaN(n)) {
                            handleQuantityChange(selectedItem._uid!, n)
                          }
                        }}
                        onBlur={(e) => {
                          const n = parseInt(e.target.value, 10)
                          if (isNaN(n) || n < 1) {
                            handleQuantityChange(selectedItem._uid!, 1)
                          }
                        }}
                        className="w-20 text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(
                          selectedItem._uid!,
                          selectedItem.quantity + 1
                        )}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleRemoveItem(selectedItem._uid!)}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            )
          })}
          {selectedItems.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Nenhum item selecionado
            </div>
          )}
        </div>
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={selectedItems.length === 0 || submitting}
        onClick={handleSubmit}
      >
        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Confirmar Seleção
      </Button>

      {/* Patient Info Modal for Colchao Casca de Ovo */}
      <Dialog open={showPatientModal} onOpenChange={(open) => { setShowPatientModal(open); if (!open) setPatientError(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bed className="w-5 h-5 text-blue-600" />
              Dados do Paciente
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mb-2">
            Este item é individual por paciente. Para solicitar mais de um, adicione o item novamente para cada paciente diferente.
          </p>
          <div className="space-y-3">
            <div>
              <Label>Nome do Paciente *</Label>
              <Input value={patientName} onChange={(e) => { setPatientName(e.target.value); if (patientError) setPatientError(null) }} placeholder="Nome completo do paciente" className="mt-1" />
            </div>
            <div>
              <Label>Leito *</Label>
              <Input value={patientBed} onChange={(e) => setPatientBed(e.target.value)} placeholder="Ex: 201, 302-A" className="mt-1" />
            </div>
            <div>
              <Label>Posto *</Label>
              <Input value={patientWard} onChange={(e) => setPatientWard(e.target.value)} placeholder="Ex: Posto 1, Posto 2, UTI" className="mt-1" />
            </div>
            <div>
              <Label>Enfermeira de Plantao *</Label>
              <Input value={nurseName} onChange={(e) => setNurseName(e.target.value)} placeholder="Nome da enfermeira" className="mt-1" />
            </div>
          </div>
          {patientError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {patientError}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowPatientModal(false); setPatientError(null) }}>Cancelar</Button>
            <Button
              onClick={handleConfirmPatientItem}
              disabled={!patientName.trim() || !patientBed.trim() || !patientWard.trim() || !nurseName.trim()}
              className="bg-primary-500 hover:bg-primary-600 text-white"
            >
              Adicionar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Justificativa Modal para itens de farmacia (exceto colchao) */}
      <Dialog open={showJustModal} onOpenChange={(open) => { setShowJustModal(open); if (!open) setJustError(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              Justificativa do Item
            </DialogTitle>
          </DialogHeader>
          {justPendingItem && (
            <p className="text-sm text-gray-500 mb-1">
              Item: <strong>{justPendingItem.name}</strong>
            </p>
          )}

          <div className="space-y-4">
            {/* Para curativo: apenas nome do paciente */}
            {justIsCurativo ? (
              <div>
                <Label>Nome do Paciente *</Label>
                <Input
                  value={justPatientName}
                  onChange={(e) => { setJustPatientName(e.target.value); if (justError) setJustError(null) }}
                  placeholder="Nome completo do paciente"
                  className="mt-1"
                />
              </div>
            ) : (
              <>
                <div>
                  <Label>Motivo *</Label>
                  <select
                    value={justMotivo}
                    onChange={(e) => { setJustMotivo(e.target.value); if (justError) setJustError(null) }}
                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Selecione o motivo...</option>
                    {JUSTIFICATIVA_MOTIVOS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Nome do Paciente *</Label>
                  <Input
                    value={justPatientName}
                    onChange={(e) => { setJustPatientName(e.target.value); if (justError) setJustError(null) }}
                    placeholder="Nome completo do paciente"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Prontuario (opcional)</Label>
                  <Input
                    value={justProntuario}
                    onChange={(e) => setJustProntuario(e.target.value)}
                    placeholder="Numero do prontuario"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Paciente nao cadastrado?{' '}
                    <a
                      href="/farmacia/pacientes"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      Cadastrar aqui
                    </a>
                  </p>
                </div>
              </>
            )}
          </div>

          {justError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {justError}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => { setShowJustModal(false); setJustError(null) }}
            >
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmJustificativa}
              disabled={
                justIsCurativo
                  ? !justPatientName.trim()
                  : !justMotivo || !justPatientName.trim()
              }
              className="bg-primary-500 hover:bg-primary-600 text-white"
            >
              Adicionar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
