import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Package, FileText, ClipboardList } from 'lucide-react'
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
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/utils/error-messages'
import type { Item } from '@/lib/services/items'

const entrySchema = z.object({
  quantity: z.number().min(1, 'Quantidade deve ser maior que 0'),
  acquisition_type: z.enum(['Compra', 'Empréstimo', 'Doação', 'Permuta', 'Inventário']),
  invoice_number: z.string().min(1, 'Código da NF é obrigatório'),
  afm_number: z.string().min(1, 'Código da AFM é obrigatório'),
  supplier_name: z.string().optional(),
  notes: z.string().optional(),
})

type EntryFormData = z.infer<typeof entrySchema>

interface RegisterEntryDialogProps {
  item: Item
  type: 'pharmacy' | 'warehouse'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function RegisterEntryDialog({ item, type, open, onOpenChange, onSuccess }: RegisterEntryDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      quantity: 1,
      acquisition_type: 'Compra',
      invoice_number: '',
      afm_number: '',
      supplier_name: '',
      notes: '',
    }
  })

  const watchedQty = watch('quantity')
  const newStock = item.current_stock + (watchedQty || 0)

  const onSubmit = async (data: EntryFormData) => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Usuário não autenticado')
        setLoading(false)
        return
      }

      const today = new Date().toISOString().split('T')[0]

      if (type === 'pharmacy') {
        // Farmácia (multi-estoque): entrada via RPC atômica — grava stock_entries
        // (auditoria) e insere stock_movements (ENTRADA_NF), que credita item_stocks
        // e espelha current_stock pelos triggers. Não escrever current_stock direto.
        const { error: rpcError } = await supabase.rpc('registrar_entrada_estoque', {
          p_item_id: item.id,
          p_item_type: type,
          p_quantity: data.quantity,
          p_invoice_number: data.invoice_number,
          p_invoice_date: today,
          p_afm_number: data.afm_number,
          p_supplier_cnpj: '00.000.000/0000-00',
          p_supplier_name: data.supplier_name || 'Não informado',
          p_unit_price: 0,
          p_invoice_total_value: 0,
          p_acquisition_type: data.acquisition_type,
          p_notes: data.notes || null,
        })
        if (rpcError) {
          console.error('Error registering entry:', rpcError)
          throw new Error('Erro ao registrar entrada: ' + rpcError.message)
        }
      } else {
        // Almoxarifado (modelo legado): current_stock direto.
        const { error: entryError } = await supabase.from('stock_entries').insert({
          item_id: item.id,
          item_type: type,
          quantity: data.quantity,
          acquisition_type: data.acquisition_type,
          invoice_number: data.invoice_number,
          invoice_date: today,
          invoice_total_value: 0,
          afm_number: data.afm_number,
          supplier_cnpj: '00.000.000/0000-00',
          supplier_name: data.supplier_name || 'Não informado',
          unit_price: 0,
          notes: data.notes || null,
          created_by: user.id,
        })
        if (entryError) {
          console.error('Error registering entry:', entryError)
          throw new Error('Erro ao registrar entrada: ' + entryError.message)
        }

        const { error: updateError } = await supabase
          .from('warehouse_items')
          .update({ current_stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', item.id)
        if (updateError) {
          console.error('Error updating stock:', updateError)
          throw new Error('Erro ao atualizar estoque: ' + updateError.message)
        }
      }

      reset()
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error registering entry:', error)
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Registrar Entrada de Material
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Toda entrada de material deve ser registrada com NF e AFM para auditoria.
          </p>
        </DialogHeader>

        {/* Item Info */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
          <p className="text-sm">
            <span className="text-gray-500">Item:</span>
            <span className="font-medium text-gray-900 ml-2">{item.name}</span>
          </p>
          <p className="text-sm">
            <span className="text-gray-500">Código:</span>
            <span className="font-medium text-gray-900 ml-2">{item.code}</span>
          </p>
          <p className="text-sm">
            <span className="text-gray-500">Estoque atual:</span>
            <span className="font-medium text-gray-900 ml-2">{item.current_stock} {item.unit}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo de Aquisição */}
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
              <ClipboardList className="w-4 h-4" />
              Dados da Aquisição
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
                <option value="Inventário">Inventário</option>
              </select>
              {errors.acquisition_type && (
                <p className="text-sm text-red-500 mt-1">{errors.acquisition_type.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice_number">
                  Código da Nota Fiscal (NF) *
                </Label>
                <Input
                  id="invoice_number"
                  {...register('invoice_number')}
                  className="mt-1"
                  placeholder="Ex: NF-123456"
                />
                <p className="text-xs text-gray-500 mt-1">Número da Nota Fiscal</p>
                {errors.invoice_number && (
                  <p className="text-sm text-red-500 mt-1">{errors.invoice_number.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="afm_number">
                  Código da AFM *
                </Label>
                <Input
                  id="afm_number"
                  {...register('afm_number')}
                  className="mt-1"
                  placeholder="Ex: AFM-2026-001"
                />
                <p className="text-xs text-gray-500 mt-1">Autorização de Fornecimento de Material</p>
                {errors.afm_number && (
                  <p className="text-sm text-red-500 mt-1">{errors.afm_number.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="supplier_name">Fornecedor (opcional)</Label>
              <Input
                id="supplier_name"
                {...register('supplier_name')}
                className="mt-1"
                placeholder="Nome do fornecedor"
              />
            </div>
          </div>

          {/* Quantidade e Observações */}
          <div className="space-y-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
              <FileText className="w-4 h-4" />
              Quantidade e Observações
            </div>

            <div>
              <Label htmlFor="quantity">Quantidade Recebida *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                {...register('quantity', { valueAsNumber: true })}
                className="mt-1"
              />
              {errors.quantity && (
                <p className="text-sm text-red-500 mt-1">{errors.quantity.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Observações (opcional)</Label>
              <textarea
                id="notes"
                {...register('notes')}
                className="w-full mt-1 rounded-md border border-input px-3 py-2 min-h-[60px] bg-white text-sm"
                placeholder="Observações sobre a entrada..."
              />
            </div>
          </div>

          {/* Resumo */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <p className="text-gray-600">
              <span className="font-medium">Resumo:</span> Será adicionado{' '}
              <span className="font-bold text-emerald-700">+{watchedQty || 0} {item.unit}</span> ao estoque.
              Novo estoque total: <span className="font-bold">{newStock} {item.unit}</span>
            </p>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Entrada
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
