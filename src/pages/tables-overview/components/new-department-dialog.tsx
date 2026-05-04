import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { departmentsService } from '@/lib/services/departments'

const departmentSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
})

type DepartmentFormData = z.infer<typeof departmentSchema>

interface NewDepartmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function NewDepartmentDialog({ open, onOpenChange, onSuccess }: NewDepartmentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema)
  })

  const generateCode = (name: string): string => {
    // Remove acentos, converte pra maiusculo, mantem so letras/numeros e limita 10 chars
    const clean = name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .substring(0, 8)
    // Adiciona timestamp pra evitar duplicatas
    const suffix = Date.now().toString().slice(-3)
    return clean + suffix
  }

  const onSubmit = async (data: DepartmentFormData) => {
    try {
      setLoading(true)
      setSubmitError(null)
      await departmentsService.create({
        ...data,
        code: generateCode(data.name),
        is_active: true,
      } as any)
      reset()
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error creating department:', error)
      setSubmitError(error?.message || 'Erro ao criar setor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Setor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label htmlFor="name">Nome do Setor</Label>
              <Input
                id="name"
                {...register('name')}
                className="mt-1"
                placeholder="Digite o nome do setor"
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                {...register('description')}
                className="mt-1"
                placeholder="Digite uma descrição para o setor"
              />
              {errors.description && (
                <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
              )}
            </div>
          </div>

          {submitError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {submitError}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Setor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}