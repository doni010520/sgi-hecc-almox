import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, FileText, Pill, AlertTriangle } from 'lucide-react'
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
import type { ItemCategory, UnitType } from '@/lib/services/items'
import { suppliersService } from '@/lib/services/farmacia-cadastros'
import type { Supplier, MedicationClass, Presentation } from '@/lib/types/farmacia'
import {
  MEDICATION_CLASS_LABEL,
  CONTROLLED_SUBCLASSES,
  PRESENTATION_LABEL,
} from '@/lib/types/farmacia'

const itemSchema = z.object({
  code: z.string().min(1, 'Codigo e obrigatorio'),
  name: z.string().min(3, 'Nome deve ter no minimo 3 caracteres'),
  description: z.string().optional(),
  category: z.string(),
  unit: z.string(),
  min_stock: z.number().min(0, 'Estoque minimo deve ser maior ou igual a 0'),
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
  last_purchase_price: z.number().min(0).optional(),
  reference_price: z.number().min(0).optional(),
  // Estoque inicial + NF (opcionais — só preenche se já tem estoque)
  initial_stock: z.number().min(0).optional(),
  acquisition_type: z.enum(['Compra', 'Empréstimo', 'Doação', 'Permuta']).optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().optional(),
  invoice_total_value: z.number().min(0).optional(),
  unit_price: z.number().min(0).optional(),
  afm_number: z.string().optional(),
  supplier_cnpj: z.string().optional(),
  supplier_name: z.string().optional(),
  // Farmacia (so usados quando type='pharmacy')
  supplier_id: z.string().optional(),
  medication_class: z.enum(['uso_geral', 'antimicrobianos', 'controlados', 'mav']).optional(),
  controlled_subclass: z.enum(['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4']).optional(),
  presentation: z.enum([
    'comprimidos', 'injetaveis', 'solucoes_orais', 'topicos', 'aerosol',
    'xarope', 'supositorio', 'gotas', 'outros',
  ]).optional(),
  is_mav: z.boolean().optional(),
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      category: type === 'pharmacy' ? 'MEDICAMENTO' : 'MATERIAL HOSPITALAR',
      unit: 'Un',
      min_stock: 0,
      medication_class: type === 'pharmacy' ? 'uso_geral' : undefined,
      is_mav: false,
    }
  })

  const medClass = watch('medication_class')
  const isMav = watch('is_mav')

  // Carrega fornecedores quando o dialog abre (so para pharmacy)
  useEffect(() => {
    if (open && type === 'pharmacy') {
      suppliersService.list().then(setSuppliers).catch((e) => {
        console.error('Erro ao carregar fornecedores:', e)
      })
    }
  }, [open, type])

  const onSubmit = async (data: ItemFormData) => {
    try {
      setLoading(true)
      setError(null)

      const hasInitial = (data.initial_stock ?? 0) > 0
      await itemsService.create({
        code: data.code,
        name: data.name,
        description: data.description,
        category: data.category as ItemCategory,
        unit: data.unit as UnitType,
        min_stock: data.min_stock,
        current_stock: hasInitial ? data.initial_stock : 0,
        price: 0,
        batch_number: data.batch_number,
        expiry_date: data.expiry_date,
        last_purchase_price: data.last_purchase_price,
        reference_price: data.reference_price,
        // Dados de origem (NF) — preenchidos só se houver estoque inicial
        acquisition_type: hasInitial ? data.acquisition_type : undefined,
        invoice_number: hasInitial ? data.invoice_number : undefined,
        invoice_date: hasInitial ? data.invoice_date : undefined,
        unit_price: hasInitial ? data.unit_price : undefined,
        afm_number: hasInitial ? data.afm_number : undefined,
        supplier_cnpj: hasInitial ? data.supplier_cnpj : undefined,
        supplier_name: hasInitial ? data.supplier_name : undefined,
        invoice_total_value: hasInitial ? data.invoice_total_value : undefined,
        // Farmacia
        supplier_id: type === 'pharmacy' ? (data.supplier_id || undefined) : undefined,
        medication_class: type === 'pharmacy' ? data.medication_class : undefined,
        controlled_subclass: type === 'pharmacy' && data.medication_class === 'controlados'
          ? data.controlled_subclass : null,
        presentation: type === 'pharmacy' ? data.presentation : undefined,
        is_mav: type === 'pharmacy' ? !!data.is_mav : undefined,
      }, type)

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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="batch_number">Numero do Lote</Label>
              <Input
                id="batch_number"
                {...register('batch_number')}
                className="mt-1"
                placeholder="Ex: LOTE-2024-001"
              />
            </div>

            <div>
              <Label htmlFor="expiry_date">Data de Validade</Label>
              <Input
                id="expiry_date"
                type="date"
                {...register('expiry_date')}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="last_purchase_price">Valor da Última Compra</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">R$</span>
                <Input
                  id="last_purchase_price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('last_purchase_price', { valueAsNumber: true })}
                  className="pl-9"
                  placeholder="0,00"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reference_price">Valor Referencial</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">R$</span>
                <Input
                  id="reference_price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('reference_price', { valueAsNumber: true })}
                  className="pl-9"
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          {/* Secao: Classificacao Farmaceutica — so para pharmacy */}
          {type === 'pharmacy' && (
            <div className="border border-blue-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-200">
                <Pill className="w-4 h-4 text-blue-700" />
                <span className="text-sm font-medium text-blue-900">
                  Classificação Farmacêutica
                </span>
              </div>
              <div className="p-4 space-y-4 bg-white">
                <div>
                  <Label>Classe do medicamento *</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                    {(Object.entries(MEDICATION_CLASS_LABEL) as Array<[MedicationClass, string]>).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setValue('medication_class', k, { shouldDirty: true })}
                        className={`px-2 py-2 text-xs rounded-lg border text-center transition-colors ${
                          medClass === k
                            ? 'bg-blue-100 border-blue-500 text-blue-900 font-semibold'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {medClass === 'controlados' && (
                  <div>
                    <Label>Lista (Portaria 344/98) *</Label>
                    <select
                      {...register('controlled_subclass')}
                      className="w-full mt-1 h-9 rounded-md border border-input px-3 py-1 bg-white"
                    >
                      <option value="">Selecione a lista</option>
                      {CONTROLLED_SUBCLASSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      A1/A2/A3=entorpecentes · B1/B2=psicotrópicos · C1=outros · C2=retinoicos · C3=imunossupressores · C4=antirretrovirais
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="presentation">Apresentação *</Label>
                    <select
                      id="presentation"
                      {...register('presentation')}
                      className="w-full mt-1 h-9 rounded-md border border-input px-3 py-1 bg-white"
                    >
                      <option value="">Selecione...</option>
                      {(Object.entries(PRESENTATION_LABEL) as Array<[Presentation, string]>).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        {...register('is_mav')}
                        className="w-4 h-4 mt-0.5"
                      />
                      <span className="text-sm">
                        <span className="font-medium flex items-center gap-1">
                          <AlertTriangle size={14} className="text-amber-500" />
                          É Medicamento de Alta Vigilância (MAV)
                        </span>
                        <span className="text-xs text-gray-500">
                          MAVs exigem dupla checagem na dispensação
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
                {isMav && (
                  <div className="p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    ⚠️ Esse medicamento será marcado como MAV. Na dispensação, o farmacêutico
                    será obrigado a digitar "CONFIRMO" antes de salvar.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Seção: Estoque Inicial + Origem (NF/fornecedor) — sempre visível */}
          <div className="border border-emerald-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border-b border-emerald-200">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span className="text-sm font-medium text-emerald-900">
                Origem do material (Nota Fiscal e Fornecedor)
              </span>
            </div>

            <div className="p-4 space-y-4 bg-white">
              <p className="text-xs text-gray-500">
                Preencha se o item está sendo cadastrado <strong>com estoque inicial</strong>. Deixe em branco se for só cadastro do item (sem estoque).
              </p>

              {/* Tipo de aquisição — sempre visível */}
              <div>
                <Label htmlFor="acquisition_type">Como o material chegou? *</Label>
                <select
                  id="acquisition_type"
                  {...register('acquisition_type')}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm"
                  defaultValue=""
                >
                  <option value="">— Selecione o tipo —</option>
                  <option value="Compra">Compra</option>
                  <option value="Doação">Doação</option>
                  <option value="Empréstimo">Empréstimo</option>
                  <option value="Permuta">Permuta</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Define a origem do estoque inicial (aparece nos relatórios).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="initial_stock">Quantidade Inicial</Label>
                  <Input
                    id="initial_stock"
                    type="number"
                    min="0"
                    {...register('initial_stock', { valueAsNumber: true })}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="mt-1"
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label htmlFor="unit_price">Valor Unitário</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">R$</span>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('unit_price', { valueAsNumber: true })}
                      className="pl-9"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoice_total_value">Valor Total da NF</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">R$</span>
                    <Input
                      id="invoice_total_value"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('invoice_total_value', { valueAsNumber: true })}
                      className="pl-9"
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoice_number">Número da NF</Label>
                  <Input
                    id="invoice_number"
                    {...register('invoice_number')}
                    className="mt-1"
                    placeholder="Ex: NF-123456"
                  />
                </div>

                <div>
                  <Label htmlFor="afm_number">Número da AFM</Label>
                  <Input
                    id="afm_number"
                    {...register('afm_number')}
                    className="mt-1"
                    placeholder="Ex: AFM-2026-001"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="invoice_date">Data da NF</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  {...register('invoice_date')}
                  className="mt-1"
                />
              </div>

              {type === 'pharmacy' ? (
                <div>
                  <Label htmlFor="supplier_id">Fornecedor</Label>
                  <select
                    id="supplier_id"
                    {...register('supplier_id')}
                    onChange={(e) => {
                      setValue('supplier_id', e.target.value, { shouldDirty: true })
                      // Auto-preenche name/cnpj a partir do supplier selecionado
                      const sup = suppliers.find((s) => s.id === e.target.value)
                      if (sup) {
                        setValue('supplier_name', sup.name)
                        setValue('supplier_cnpj', sup.cnpj)
                      }
                    }}
                    className="w-full mt-1 h-9 rounded-md border border-input px-3 py-1 bg-white"
                  >
                    <option value="">Selecione um fornecedor...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Não está na lista? Cadastre em <strong>/farmacia/fornecedores</strong>.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="supplier_cnpj">CNPJ do Fornecedor</Label>
                    <Input
                      id="supplier_cnpj"
                      {...register('supplier_cnpj')}
                      className="mt-1"
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="supplier_name">Nome do Fornecedor</Label>
                    <Input
                      id="supplier_name"
                      {...register('supplier_name')}
                      className="mt-1"
                      placeholder="Nome da empresa"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-700">
            Dica: depois de cadastrado, você pode registrar mais entradas pelo botão <strong>"Registrar Entrada"</strong> na lista do item.
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
