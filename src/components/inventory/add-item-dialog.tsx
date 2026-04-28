import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, FileText, Package2 } from 'lucide-react'
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
import { itemsService } from '@/lib/services/items'
import { supabase } from '@/lib/supabase'
import type { ItemCategory, UnitType } from '@/lib/services/items'

const itemSchema = z.object({
  code: z.string().min(1, 'Codigo e obrigatorio'),
  name: z.string().min(3, 'Nome deve ter no minimo 3 caracteres'),
  description: z.string().optional(),
  category: z.string(),
  unit: z.string(),
  min_stock: z.number().min(0, 'Estoque minimo deve ser maior ou igual a 0'),
  initial_stock: z.number().min(0, 'Estoque inicial deve ser maior ou igual a 0'),
  acquisition_type: z.enum(['Compra', 'Empréstimo', 'Doação', 'Permuta']).optional(),
  invoice_number: z.string().optional(),
  afm_number: z.string().optional(),
  supplier_name: z.string().optional(),
})

type ItemFormData = z.infer<typeof itemSchema>

interface AddItemDialogProps {
  type: 'pharmacy' | 'warehouse'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const unitOptions = [
  { value: 'Un', label: 'Unidade (Un)' },
  { value: 'Pc', label: 'Peca (Pc)' },
  { value: 'Cx', label: 'Caixa (Cx)' },
  { value: 'Fr', label: 'Frasco (Fr)' },
  { value: 'Amp', label: 'Ampola (Amp)' },
  { value: 'Tb', label: 'Tubo (Tb)' },
  { value: 'Rl', label: 'Rolo (Rl)' },
  { value: 'Lt', label: 'Litro (Lt)' },
  { value: 'Kg', label: 'Quilograma (Kg)' },
  { value: 'Gl', label: 'Galao (Gl)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'Pr', label: 'Par (Pr)' },
  { value: 'Cj', label: 'Conjunto (Cj)' },
  { value: 'Sc', label: 'Saco (Sc)' },
  { value: 'Rm', label: 'Resma (Rm)' },
  { value: 'Ct', label: 'Cento (Ct)' },
  { value: 'FL', label: 'Folha (FL)' },
]

export function AddItemDialog({ type, open, onOpenChange, onSuccess }: AddItemDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      category: type === 'pharmacy' ? 'MEDICAMENTO' : 'MATERIAL HOSPITALAR',
      unit: 'Un',
      min_stock: 0,
      initial_stock: 0,
      acquisition_type: 'Compra',
      invoice_number: '',
      afm_number: '',
      supplier_name: '',
    }
  })

  const watchedInitialStock = watch('initial_stock')
  const hasInitialStock = (watchedInitialStock || 0) > 0

  const onSubmit = async (data: ItemFormData) => {
    try {
      setLoading(true)
      setError(null)

      // Validate entry fields when initial stock is informed
      if ((data.initial_stock || 0) > 0) {
        if (!data.invoice_number?.trim()) {
          setError('Número da Nota Fiscal é obrigatório quando há estoque inicial')
          setLoading(false)
          return
        }
        if (!data.afm_number?.trim()) {
          setError('Número da AFM é obrigatório quando há estoque inicial')
          setLoading(false)
          return
        }
      }

      const newItem = await itemsService.create({
        code: data.code,
        name: data.name,
        description: data.description,
        category: data.category as ItemCategory,
        unit: data.unit as UnitType,
        min_stock: data.min_stock,
        current_stock: data.initial_stock || 0,
        price: 0,
      }, type)

      // Register stock entry if there's initial stock
      if ((data.initial_stock || 0) > 0 && newItem?.id) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const today = new Date().toISOString().split('T')[0]
          await supabase.from('stock_entries').insert({
            item_id: newItem.id,
            item_type: type,
            quantity: data.initial_stock,
            acquisition_type: data.acquisition_type,
            invoice_number: data.invoice_number,
            invoice_date: today,
            invoice_total_value: 0,
            afm_number: data.afm_number,
            supplier_cnpj: '00.000.000/0000-00',
            supplier_name: data.supplier_name || 'Não informado',
            unit_price: 0,
            notes: 'Entrada inicial do item',
            created_by: user.id,
          })
        }
      }

      reset()
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error creating item:', error)
      const errorMessage = error?.message || 'Erro ao criar item. Por favor, tente novamente.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryOptions = () => {
    if (type === 'pharmacy') {
      return [
        { value: 'MEDICAMENTO', label: 'Medicamento' },
        { value: 'MAT/MED', label: 'Material/Medicamento' },
        { value: 'HIGIENE E LIMPEZA', label: 'Higiene e Limpeza' }
      ]
    } else {
      return [
        { value: 'MATERIAL HOSPITALAR', label: 'Material Hospitalar' },
        { value: 'MATERIAL DE EXPEDIENTE', label: 'Material de Expediente' },
        { value: 'MATERIAL DE HIGIENIZAÇÃO', label: 'Material de Higienização' },
        { value: 'HIGIENIZAÇÃO E LIMPEZA', label: 'Higienização e Limpeza' },
        { value: 'EPI', label: 'EPI' },
        { value: 'OUTROS', label: 'Outros' }
      ]
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Item</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Cadastre as informações do item. Se já houver estoque inicial, preencha os dados da NF abaixo.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Codigo *</Label>
              <Input
                id="code"
                {...register('code')}
                className="mt-1"
                placeholder="Ex: MED-001"
              />
              {errors.code && (
                <p className="text-sm text-red-500 mt-1">{errors.code.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="category">Categoria *</Label>
              <select
                id="category"
                {...register('category')}
                className="w-full mt-1 h-9 rounded-md border border-input px-3 py-1 bg-white"
              >
                {getCategoryOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-sm text-red-500 mt-1">{errors.category.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              {...register('name')}
              className="mt-1"
              placeholder="Digite o nome do item"
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Descricao</Label>
            <textarea
              id="description"
              {...register('description')}
              className="w-full mt-1 rounded-md border border-input px-3 py-2 min-h-[80px] bg-white"
              placeholder="Digite uma descricao para o item (opcional)"
            />
            {errors.description && (
              <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unit">Unidade de Fornecimento *</Label>
              <select
                id="unit"
                {...register('unit')}
                className="w-full mt-1 h-9 rounded-md border border-input px-3 py-1 bg-white"
              >
                {unitOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.unit && (
                <p className="text-sm text-red-500 mt-1">{errors.unit.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="min_stock">Estoque Minimo *</Label>
              <Input
                id="min_stock"
                type="number"
                min="0"
                {...register('min_stock', { valueAsNumber: true })}
                className="mt-1"
                placeholder="0"
              />
              {errors.min_stock && (
                <p className="text-sm text-red-500 mt-1">{errors.min_stock.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Package2 className="w-4 h-4" />
              Estoque Inicial (opcional)
            </div>

            <div>
              <Label htmlFor="initial_stock">Quantidade Inicial em Estoque</Label>
              <Input
                id="initial_stock"
                type="number"
                min="0"
                {...register('initial_stock', { valueAsNumber: true })}
                className="mt-1"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Deixe 0 se for cadastrar apenas o item sem estoque.
              </p>
              {errors.initial_stock && (
                <p className="text-sm text-red-500 mt-1">{errors.initial_stock.message}</p>
              )}
            </div>

            {hasInitialStock && (
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                  <FileText className="w-4 h-4" />
                  Dados da Entrada de Material
                </div>

                <div>
                  <Label htmlFor="acquisition_type">Tipo de Aquisição *</Label>
                  <select
                    id="acquisition_type"
                    {...register('acquisition_type')}
                    className="w-full mt-1 h-9 rounded-md border border-input px-3 py-1 bg-white text-sm"
                  >
                    <option value="Compra">Compra</option>
                    <option value="Empréstimo">Empréstimo</option>
                    <option value="Doação">Doação</option>
                    <option value="Permuta">Permuta</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="invoice_number">Nº Nota Fiscal *</Label>
                    <Input
                      id="invoice_number"
                      {...register('invoice_number')}
                      className="mt-1"
                      placeholder="Ex: NF-123456"
                    />
                  </div>
                  <div>
                    <Label htmlFor="afm_number">Nº AFM *</Label>
                    <Input
                      id="afm_number"
                      {...register('afm_number')}
                      className="mt-1"
                      placeholder="Ex: AFM-2026-001"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="supplier_name">Fornecedor</Label>
                  <Input
                    id="supplier_name"
                    {...register('supplier_name')}
                    className="mt-1"
                    placeholder="Nome do fornecedor (opcional)"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
