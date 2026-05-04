import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { departmentsService } from '@/lib/services/departments'
import type { Department } from '@/lib/types/departments'

interface DeleteDepartmentDialogProps {
  department: Department
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteDepartmentDialog({
  department,
  open,
  onOpenChange,
  onSuccess
}: DeleteDepartmentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    try {
      setLoading(true)
      setError(null)
      await departmentsService.delete(department.id)
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Error deleting department:', err)
      const msg = err?.message || ''
      // Detectar erro de FK
      if (msg.toLowerCase().includes('foreign key') || msg.toLowerCase().includes('violates') || msg.toLowerCase().includes('referenced')) {
        setError('Este setor não pode ser excluído porque está vinculado a usuários ou solicitações. Remova essas vinculações primeiro.')
      } else {
        setError(msg || 'Erro ao excluir setor')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Excluir Setor
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-3">
          <p className="text-gray-700">
            Tem certeza que deseja excluir o setor <strong>{department.name}</strong>?
          </p>
          <div className="text-sm text-gray-600 space-y-1 bg-amber-50 border border-amber-200 rounded p-3">
            <p>Ao excluir:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>O setor sairá das listas e não poderá receber novas solicitações</li>
              <li>Os usuários vinculados ficarão <strong>sem setor</strong> (você pode realocá-los depois)</li>
              <li>O histórico de solicitações antigas é <strong>preservado</strong></li>
            </ul>
          </div>
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Excluir Setor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}