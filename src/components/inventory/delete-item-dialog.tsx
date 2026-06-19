import { useState } from 'react'
import { Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { itemsService } from '@/lib/services/items'
import { getErrorMessage } from '@/lib/utils/error-messages'
import type { Item } from '@/lib/services/items'
import { toast } from 'sonner'

interface DeleteItemDialogProps {
  item: Item
  type: 'pharmacy' | 'warehouse'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// Palavra que o usuário precisa digitar exatamente para confirmar.
// O nível de acesso (admin) já é validado antes do botão aparecer; isto
// é só uma trava contra clique acidental.
const CONFIRMATION_WORD = 'EXCLUIR'

export function DeleteItemDialog({
  item,
  type,
  open,
  onOpenChange,
  onSuccess,
}: DeleteItemDialogProps) {
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConfirmed = confirmation.trim().toUpperCase() === CONFIRMATION_WORD

  const handleDelete = async () => {
    setError(null)
    if (!isConfirmed) return

    try {
      setLoading(true)
      await itemsService.delete(item.id, type)
      toast.success('Item excluído com sucesso')
      setConfirmation('')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      console.error('Error deleting item:', err)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setConfirmation('')
      setError(null)
    }
    onOpenChange(isOpen)
  }

  // Mostra só os primeiros 120 caracteres do nome (alguns têm descrição enorme)
  const shortName =
    item.name.length > 120 ? item.name.slice(0, 120) + '…' : item.name

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Excluir Item
          </DialogTitle>
          <DialogDescription>
            O item será removido das listagens. Se o item já tiver histórico de solicitações ou movimentações, ele será desativado (não aparece mais nas listas) mas o histórico fica preservado para auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium mb-1">Item a ser excluído:</p>
            <p className="text-sm text-red-700">
              <span className="font-mono">{item.code}</span> — {shortName}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">
              Para confirmar, digite <span className="font-mono font-bold text-red-700">EXCLUIR</span> abaixo
            </Label>
            <Input
              id="delete-confirmation"
              type="text"
              autoComplete="off"
              placeholder="Digite EXCLUIR"
              value={confirmation}
              onChange={(e) => {
                setConfirmation(e.target.value)
                setError(null)
              }}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || !isConfirmed}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Item
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
