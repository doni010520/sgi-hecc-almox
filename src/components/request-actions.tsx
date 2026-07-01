import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '@/lib/utils/error-messages'
import { useAuth } from '@/contexts/auth'
import { useModule } from '@/contexts/module'
import { PHARMACY_STOCKS, departmentBelongsToStock } from '@/lib/constants/stock-locations'
import {
  CheckCircle2, XCircle, PlayCircle,
  CheckSquare, Ban, Loader2, Truck, PackageCheck, Search, User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

import { requestService } from '@/lib/services/requests'
import type { Request } from '@/lib/services/requests'
import { employeesService } from '@/lib/services/employees'
import type { Employee } from '@/lib/types/employees'

interface RequestActionsProps {
  request: Request
  onUpdate: (request: Request) => void
}

export function RequestActions({ request, onUpdate }: RequestActionsProps) {
  const { user } = useAuth()
  const { setActiveStock } = useModule()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [showApprovalToast, setShowApprovalToast] = useState(false)
  const [action, setAction] = useState<'approve' | 'reject' | 'cancel' | 'deliver' | 'confirm_receipt' | null>(null)
  const [reason, setReason] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [searchResults, setSearchResults] = useState<Employee[]>([])
  const [searchingEmployee, setSearchingEmployee] = useState(false)
  const [employeeError, setEmployeeError] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(() => {
    // Initialize with current quantities or approved quantities if they exist
    if (!request?.request_items?.length) {
      return {}
    }
    
    try {
      return request.request_items.reduce((acc, item) => {
        if (!item || !item.id || typeof item.quantity !== 'number' || item.quantity < 0) return acc
        
        const quantity = Math.max(0, Math.floor(item.quantity))
        const approvedQuantity = (typeof item.approved_quantity === 'number' && item.approved_quantity !== null && item.approved_quantity >= 0) ? Math.max(0, Math.floor(item.approved_quantity)) : null
        
        acc[item.id] = approvedQuantity !== null 
          ? approvedQuantity 
          : quantity
        return acc
      }, {} as Record<string, number>)
    } catch (error) {
      console.error('Error initializing item quantities:', error)
      return {}
    }
  })

  // Validate request data on mount
  useEffect(() => {
    if (!request || !request.request_items) return
    
    // Validate request structure
    if (!request?.request_items?.length) {
      return
    }
    
    try {
      const validatedQuantities = request.request_items.reduce((acc, item) => {
        if (!item?.id || !item.quantity) return acc
        
        const quantity = typeof item.quantity === 'number' ? item.quantity : 0
        const approvedQuantity = (typeof item.approved_quantity === 'number' && 
          item.approved_quantity !== null && 
          item.approved_quantity >= 0) ? item.approved_quantity : null
        
        acc[item.id] = approvedQuantity !== null ? approvedQuantity : quantity
        return acc
      }, {} as Record<string, number>)
      
      setItemQuantities(validatedQuantities)
    } catch (error) {
      console.error('Error validating request data:', error)
    }
  }, [request])

  const isManager = user?.role === 'gestor' || user?.role === 'administrador' || user?.role === 'atendente'
  const canManage = isManager && request?.status === 'pending'
  // Fluxo simplificado: aprovar ja registra como entregue. Nao existem mais
  // botoes "Marcar como Entregue" — a farmacia solicitante confirma
  // recebimento e o pedido fecha (status='completed').
  const canDeliver = false
  const canProcess = false
  // Recebimento pode ser confirmado por QUALQUER usuário logado — quem aprova
  // e quem confere os itens costumam ser pessoas diferentes. Quem confirma
  // fica registrado em received_by. Aprovar (acima) segue restrito.
  const canConfirmReceipt = !!user && request?.status === 'delivered'
  const canComplete = false
  const canCancel = (user?.id === request?.requester_id || isManager) &&
    ['pending', 'approved'].includes(request.status)

  const searchEmployee = async () => {
    if (!searchQuery.trim()) {
      setEmployeeError('Digite a matricula ou nome')
      return
    }
    setSearchingEmployee(true)
    setEmployeeError('')
    setEmployee(null)
    setSearchResults([])
    setShowResults(false)
    try {
      const query = searchQuery.trim()
      // Check if it looks like a matricula (only numbers)
      const isMatricula = /^\d+$/.test(query)

      if (isMatricula) {
        const found = await employeesService.getByMatricula(query)
        if (found) {
          setEmployee(found)
        } else {
          setEmployeeError('Colaborador nao encontrado')
        }
      } else {
        // Search by name
        const results = await employeesService.searchByName(query)
        if (results.length === 1) {
          setEmployee(results[0])
        } else if (results.length > 1) {
          setSearchResults(results)
          setShowResults(true)
        } else {
          setEmployeeError('Nenhum colaborador encontrado')
        }
      }
    } catch {
      setEmployeeError('Erro ao buscar colaborador')
    } finally {
      setSearchingEmployee(false)
    }
  }

  const handleAction = async () => {
    if (!action) return

    // Validate employee for delivery
    if (action === 'deliver' && !employee) {
      setEmployeeError('Informe a matrícula do recebedor')
      return
    }

    try {
      setLoading(true)
      let updatedRequest: Request

      switch (action) {
        case 'approve':
          updatedRequest = await requestService.approve(request.id, itemQuantities, reason)
          setShowApprovalToast(true)
          break
        case 'reject':
          updatedRequest = await requestService.reject(request.id, reason)
          break
        case 'cancel':
          updatedRequest = await requestService.cancel(request.id, reason)
          break
        case 'deliver':
          updatedRequest = await requestService.markAsDelivered(
            request.id,
            reason,
            employee?.id
          )
          break
        case 'confirm_receipt':
          updatedRequest = await requestService.confirmReceipt(request.id, reason)
          break
        default:
          return
      }

      requestService.clearCache()
      onUpdate(updatedRequest)
      setShowDialog(false)
      setReason('')
      setSearchQuery('')
      setSearchResults([])
      setShowResults(false)
      setEmployee(null)
    } catch (error) {
      setEmployeeError(getErrorMessage(error))
    } finally {
      setLoading(false)
      if (action !== 'deliver') setAction(null)
    }
  }

  // handleProcessing removido: aprovar → entregue direto agora (sem etapa
  // "processing"). Mantemos o fluxo antigo apenas via lista de "pending" em
  // requests/processing.tsx pra requests que já estão em 'processing'.

  const handleDeliver = () => {
    setAction('deliver')
    setSearchQuery('')
    setEmployee(null)
    setEmployeeError('')
    setSearchResults([])
    setShowResults(false)
    // No dialog - uses inline form
  }

  const handleConfirmReceipt = () => {
    setAction('confirm_receipt')
    setShowDialog(true)
  }



  const handleComplete = async () => {
    try {
      setLoading(true)
      const updatedRequest = await requestService.complete(request.id)
      onUpdate(updatedRequest)
    } catch (error) {
      console.error('Error completing request:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* flex-wrap pra os botões quebrarem linha em tela estreita — antes
          ficavam em UMA linha só e os últimos (ex: "Confirmar Recebimento")
          saíam de vista. justify-end pra alinhar à direita como CTA. */}
      <div className="flex flex-wrap items-center gap-2 justify-end pt-2">
        {/* Approve/Reject Actions */}
        {canManage && (
          <>
            <Button
              size="sm"
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={async () => {
                try {
                  setLoading(true)
                  const updatedRequest = await requestService.approve(request.id, itemQuantities, '')
                  // Abre o modal ANTES de chamar onUpdate — se o parent
                  // remontar o componente durante o reload, o modal ja tera
                  // pintado. Reload subsequente e silencioso na pagina.
                  setShowApprovalToast(true)
                  onUpdate(updatedRequest)
                } catch (error) {
                  console.error('Error approving:', error)
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setAction('reject')
                setShowDialog(true)
              }}
              disabled={loading}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Rejeitar
            </Button>
          </>
        )}

        {/* Processing skip — direto pra entrega. Fluxo antigo "approved →
            processing → delivered" foi encurtado pra "approved → delivered". */}
        {canProcess && (
          <Button
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white"
            onClick={handleDeliver}
            disabled={loading}
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            Marcar como entregue
          </Button>
        )}

        {/* Deliver Action */}
        {canDeliver && (
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={handleDeliver}
            disabled={loading}
          >
            <Truck className="w-4 h-4 mr-2" />
            Marcar como Entregue
          </Button>
        )}

        {/* Confirm Receipt Action */}
        {canConfirmReceipt && (
          <Button
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={handleConfirmReceipt}
            disabled={loading}
          >
            <PackageCheck className="w-4 h-4 mr-2" />
            Confirmar Recebimento
          </Button>
        )}

        {/* Complete Action */}
        {canComplete && (
          <Button
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={handleComplete}
            disabled={loading}
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            Concluir
          </Button>
        )}

        {/* Cancel Action */}
        {canCancel && (
          <Button
            size="sm"
            variant="outline"
            className="text-gray-600 hover:text-gray-700"
            onClick={() => {
              setAction('cancel')
              setShowDialog(true)
            }}
            disabled={loading}
          >
            <Ban className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        )}

        {/* Loading Indicator */}
        {loading && (
          <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
        )}
      </div>

      {/* Inline Delivery Form (no dialog - works on mobile) */}
      {action === 'deliver' && !showDialog && (
        <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-4">
          <h3 className="font-semibold text-orange-700 text-lg">Marcar como Entregue</h3>

          <div className="space-y-2">
            <Label className="font-medium text-gray-900">Recebedor</Label>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setEmployee(null)
                  setEmployeeError('')
                  setSearchResults([])
                  setShowResults(false)
                }}
                onKeyDown={(e) => e.key === 'Enter' && searchEmployee()}
                placeholder="Digite matricula ou nome..."
                className="flex-1 bg-white"
              />
              <Button type="button" variant="outline" onClick={searchEmployee} disabled={searchingEmployee}>
                {searchingEmployee ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {employeeError && <p className="text-sm text-red-600">{employeeError}</p>}
            {showResults && searchResults.length > 0 && (
              <select
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white"
                defaultValue=""
                onChange={(e) => {
                  const selected = searchResults.find(emp => emp.id === e.target.value)
                  if (selected) {
                    setEmployee(selected)
                    setShowResults(false)
                    setSearchResults([])
                    setSearchQuery(selected.full_name)
                  }
                }}
              >
                <option value="" disabled>Selecione o recebedor...</option>
                {searchResults.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}{emp.matricula ? ` (Mat: ${emp.matricula})` : ''}
                  </option>
                ))}
              </select>
            )}
            {employee && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <User className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">{employee.full_name}</p>
                  <p className="text-sm text-gray-500">
                    {employee.matricula && `Mat: ${employee.matricula}`}
                    {employee.department_name && ` • ${employee.department_name}`}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-gray-900">Observações (opcional)</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full min-h-[80px] p-3 rounded-lg border border-gray-200 text-sm bg-white"
              placeholder="Adicione observações sobre a entrega..."
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setAction(null); setReason(''); setEmployee(null); setSearchQuery('') }}>
              Cancelar
            </Button>
            <Button
              onClick={handleAction}
              disabled={loading || !employee}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
              Confirmar Entrega
            </Button>
          </div>
        </div>
      )}

      {/* Action Dialog (for non-delivery actions only) */}
      <Dialog open={showDialog && action !== 'deliver'} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className={`text-xl font-semibold ${
              action === 'approve' ? 'text-green-600' :
              action === 'reject' ? 'text-red-600' :
              action === 'confirm_receipt' ? 'text-emerald-600' :
              'text-gray-600'
            }`}>
              {action === 'approve' && 'Aprovar Solicitação'}
              {action === 'reject' && 'Rejeitar Solicitação'}
              {action === 'cancel' && 'Cancelar Solicitação'}
              {action === 'confirm_receipt' && 'Confirmar Recebimento'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Comments/Reason */}
            <div className="space-y-2">
              <Label className="text-base font-medium text-gray-900">
                {action === 'approve' && 'Comentários (opcional)'}
                {action === 'reject' && 'Motivo da Rejeição'}
                {action === 'cancel' && 'Motivo do Cancelamento'}
                {action === 'confirm_receipt' && 'Observações sobre o Recebimento (opcional)'}
              </Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full min-h-[100px] p-3 rounded-lg border border-gray-200 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={
                  action === 'approve'
                    ? 'Adicione um comentário...'
                    : action === 'confirm_receipt'
                    ? 'Adicione observações sobre o recebimento...'
                    : 'Descreva o motivo...'
                }
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false)
                setReason('')
                setAction(null)
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAction}
              disabled={loading || (['reject', 'cancel'].includes(action || '') && !reason.trim())}
              className={`px-6 ${
                action === 'approve'
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : action === 'reject'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : action === 'deliver'
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : action === 'confirm_receipt'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-gray-500 hover:bg-gray-600 text-white'
              }`}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {action === 'approve' && 'Aprovar'}
              {action === 'reject' && 'Rejeitar'}
              {action === 'cancel' && 'Cancelar'}
              {action === 'confirm_receipt' && 'Confirmar Recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de sucesso após aprovar — leva pra Confirmar Recebimento no
          contexto da FARMACIA SOLICITANTE (o setor que fez o pedido).
          Autocountdown de 3s pra ir direto; user pode cancelar. */}
      <ApprovalSuccessDialog
        open={showApprovalToast}
        onOpenChange={setShowApprovalToast}
        requestNumber={request?.request_number ?? request?.id?.slice(0, 8)}
        departmentName={request?.department}
        onGo={() => {
          setShowApprovalToast(false)
          // Descobre o estoque que corresponde ao setor solicitante e troca o
          // contexto — assim /requests/receipt-confirmation ja abre filtrado
          // pra farmacia certa e a request aparece imediatamente.
          const target = PHARMACY_STOCKS.find((s) => departmentBelongsToStock(request?.department, s))
          if (target) setActiveStock(target)
          navigate('/requests/receipt-confirmation')
        }}
      />
    </>
  )
}

// Dialog de sucesso da aprovacao. Autoredireciona apos 3s pra
// Confirmar Recebimento no contexto da farmacia solicitante — user
// pode cancelar durante o countdown se quiser continuar aprovando
// outras solicitacoes.
function ApprovalSuccessDialog({
  open, onOpenChange, requestNumber, departmentName, onGo,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  requestNumber?: number | string
  departmentName?: string
  onGo: () => void
}) {
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (!open) return
    setCountdown(3)
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t)
          onGo()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-6 h-6" /> Solicitação aprovada
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-gray-700 space-y-2">
          <p>
            O pedido <strong>#{requestNumber}</strong> foi aprovado com sucesso.
          </p>
          <p>
            Redirecionando pra <strong>Confirmar Recebimento</strong>
            {departmentName ? <> — <strong>{departmentName}</strong></> : null} em{' '}
            <strong>{countdown}s</strong>...
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continuar aqui
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={onGo}
          >
            Ir agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}