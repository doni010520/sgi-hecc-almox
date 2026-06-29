import { useState, useEffect, useCallback } from 'react'
import {
  PackageCheck,
  Loader2,
  CheckCircle2,
  Calendar,
  Building2,
  User,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { requestService } from '@/lib/services/requests'
import { formatRequestNumber } from '@/lib/utils/request'

interface RequestItem {
  id: string
  quantity: number
  item_name: string
  item_code: string
  item_unit?: string
}

interface DeliveredRequest {
  id: string
  request_number: string | null
  requester_name: string
  department_name: string
  delivered_at: string | null
  delivered_by_name: string
  created_at: string
  items: RequestItem[]
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-white transition-all ${
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`}>
      {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}

export function ReceiptConfirmation() {
  const [requests, setRequests] = useState<DeliveredRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }, [])

  const loadDeliveredRequests = useCallback(async () => {
    try {
      setLoading(true)

      // Pedidos entregues aguardando confirmação de recebimento. Qualquer usuário
      // logado pode confirmar — quem marca a entrega e quem confere os itens
      // costumam ser pessoas diferentes (a RLS permite delivered -> completed).
      const { data, error } = await supabase
        .from('requests')
        .select(`
          id,
          request_number,
          created_at,
          delivered_at,
          requester:users!requests_requester_id_fkey(full_name),
          department:departments!requests_department_id_fkey(name),
          delivered_by_user:users!requests_delivered_by_fkey(full_name),
          request_items(
            id,
            quantity,
            pharmacy_item:pharmacy_items(id, name, code, unit),
            warehouse_item:warehouse_items(id, name, code, unit)
          )
        `)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: true, nullsFirst: false })

      if (error) throw error

      const mapped: DeliveredRequest[] = (data || []).map((req: any) => ({
        id: req.id,
        request_number: req.request_number,
        requester_name: req.requester?.full_name ?? '—',
        department_name: req.department?.name ?? '—',
        delivered_at: req.delivered_at,
        delivered_by_name: req.delivered_by_user?.full_name ?? '—',
        created_at: req.created_at,
        items: (req.request_items || []).map((ri: any) => {
          const item = ri.pharmacy_item ?? ri.warehouse_item
          return {
            id: ri.id,
            quantity: ri.quantity,
            item_name: item?.name ?? '—',
            item_code: item?.code ?? '—',
            item_unit: item?.unit,
          } as RequestItem
        }),
      }))

      setRequests(mapped)
    } catch (err) {
      console.error('ReceiptConfirmation.loadDeliveredRequests:', err)
      showToast('Erro ao carregar pedidos entregues.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadDeliveredRequests()
  }, [loadDeliveredRequests])

  async function handleConfirm(req: DeliveredRequest) {
    try {
      setConfirming(req.id)
      await requestService.confirmReceipt(req.id)
      showToast('Recebimento confirmado com sucesso!', 'success')
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
    } catch (err: any) {
      console.error('ReceiptConfirmation.handleConfirm:', err)
      showToast(err?.message ?? 'Erro ao confirmar recebimento.', 'error')
    } finally {
      setConfirming(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Carregando pedidos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-green-100 rounded-lg">
            <PackageCheck className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Confirmar Recebimento</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Pedidos entregues aguardando confirmação. Confira os itens e confirme o recebimento.
            </p>
          </div>
        </div>

        {requests.length > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-700 font-medium">
              {requests.length} pedido{requests.length !== 1 ? 's' : ''} aguardando confirmação
            </span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {requests.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <PackageCheck className="w-10 h-10 text-gray-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-700">Nenhum pedido aguardando confirmação</h2>
              <p className="text-sm text-gray-500 mt-1">
                Quando um pedido for marcado como entregue, ele aparecerá aqui para confirmação.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Requests list */}
      {requests.length > 0 && (
        <div className="space-y-4">
          {requests.map((req, index) => (
            <div
              key={req.id}
              className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${
                index % 2 === 0 ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-blue-400'
              }`}
            >
              {/* Card Header */}
              <div className="p-5 border-b border-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Request number */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <span className="text-xs text-gray-500">Pedido Nº</span>
                      <span className="text-base font-semibold text-gray-900">
                        {req.request_number ?? formatRequestNumber(req.id)}
                      </span>
                    </div>

                    {/* Requester */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-400">Solicitante:</span>
                      <span className="text-sm font-medium text-gray-700">{req.requester_name}</span>
                    </div>

                    {/* Department */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
                      <Building2 className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-green-400">Setor:</span>
                      <span className="text-sm font-medium text-green-700">{req.department_name}</span>
                    </div>

                    {/* Delivered at */}
                    {req.delivered_at && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">
                          Entregue em{' '}
                          {format(new Date(req.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirm button */}
                  <Button
                    onClick={() => handleConfirm(req)}
                    disabled={confirming === req.id}
                    className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                    size="sm"
                  >
                    {confirming === req.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Confirmar Recebimento
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Items */}
              <div className="p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Itens ({req.items.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {req.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{item.item_name}</p>
                        <span className="text-xs px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-500">
                          {item.item_code}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="text-sm font-semibold text-gray-800">
                          {item.quantity}
                          {item.item_unit ? ` ${item.item_unit}` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
