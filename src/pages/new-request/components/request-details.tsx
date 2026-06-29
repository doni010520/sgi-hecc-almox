import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { departmentsService } from '@/lib/services/departments'
import { useAuth } from '@/contexts/auth'
import type { Department } from '@/lib/types/departments'

const detailsSchema = z.object({
  department: z.string().min(1, 'Setor do usuário é obrigatório'),
  requesting_department: z.string().min(1, 'Setor solicitante é obrigatório'),
  destination_department: z.string().min(1, 'Setor solicitado é obrigatório'),
  priority: z.enum(['low', 'medium', 'high']),
  // Justificativa não é mais obrigatória — qualquer item entra na solicitação sem ela.
  justification_option: z.string().optional(),
  requestDate: z.string(),
})

export type RequestDetails = z.infer<typeof detailsSchema>

interface RequestDetailsProps {
  onSubmit: (data: RequestDetails) => void
  defaultValues?: Partial<RequestDetails>
  requestType?: 'warehouse' | 'pharmacy' | null
}

export function RequestDetails({ onSubmit, defaultValues, requestType }: RequestDetailsProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [userDepartment, setUserDepartment] = useState<Department | null>(null)
  const [allDepartments, setAllDepartments] = useState<Department[]>([])
  const [loadingUserDepartment, setLoadingUserDepartment] = useState(true)
  const [warehouseDepartment, setWarehouseDepartment] = useState<Department | null>(null)
  const [cafDepartment, setCafDepartment] = useState<Department | null>(null)
  const [lockedDestination, setLockedDestination] = useState<Department | null>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<RequestDetails>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      priority: 'medium',
      requestDate: format(new Date(), 'yyyy-MM-dd'),
      ...defaultValues,
    },
  })

  // Trava ou filtra o setor solicitado conforme o setor solicitante selecionado
  const watchedRequestingDept = watch('requesting_department')
  useEffect(() => {
    if (!watchedRequestingDept || requestType === 'warehouse') return

    const selected = allDepartments.find(d => d.id === watchedRequestingDept)
    if (!selected) return

    const nameLower = selected.name.toLowerCase()

    if (nameLower.includes('satélite térreo') || nameLower.includes('satelite terreo')) {
      // Térreo → trava em Almoxarifado
      if (warehouseDepartment) {
        setValue('destination_department', warehouseDepartment.id, { shouldValidate: true })
        setLockedDestination(warehouseDepartment)
      }
    } else if (nameLower.includes('satélite') || nameLower.includes('satelite')) {
      // 1º ou 2º Andar → libera com opções restritas (CAF + o outro satélite)
      setValue('destination_department', '', { shouldValidate: false })
      setLockedDestination(null)
    } else {
      // Outros setores → libera o select completo
      setValue('destination_department', '', { shouldValidate: false })
      setLockedDestination(null)
    }
  }, [watchedRequestingDept, allDepartments, warehouseDepartment, cafDepartment, requestType, setValue])

  useEffect(() => {
    loadUserDepartment()
  }, [])

  // Sincroniza com defaultValues quando muda (ex: rascunho carregado depois)
  useEffect(() => {
    if (defaultValues && Object.keys(defaultValues).length > 0) {
      reset({
        priority: 'medium',
        requestDate: format(new Date(), 'yyyy-MM-dd'),
        ...defaultValues,
      })
    }
  }, [defaultValues, reset])

  async function loadUserDepartment() {
    try {
      setLoading(true)
      setLoadingUserDepartment(true)

      const departments = await departmentsService.getAll()
      setAllDepartments(departments)

      // Identifica o departamento almoxarifado
      const warehouseDept = departments.find(d =>
        d.name.toLowerCase().includes('almoxarifado')
      ) || null
      setWarehouseDepartment(warehouseDept)

      // Identifica o CAF
      const cafDept = departments.find(d =>
        d.name.toLowerCase().includes('caf')
      ) || null
      setCafDepartment(cafDept)

      // Se for pedido de almoxarifado, trava o setor solicitado automaticamente
      if (requestType === 'warehouse' && warehouseDept) {
        setValue('destination_department', warehouseDept.id, { shouldValidate: true })
      }

      if (!user?.department_id) {
        setUserDepartment(null)
        return
      }

      const department = departments.find(d => d.id === user.department_id)

      if (department) {
        setUserDepartment(department)
        setValue('department', department.id, { shouldValidate: true })
      } else {
        setUserDepartment(null)
      }
    } catch (error) {
      console.error('Error loading user department:', error)
      setUserDepartment(null)
    } finally {
      setLoading(false)
      setLoadingUserDepartment(false)
    }
  }

  if (loading || loadingUserDepartment) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Carregando informações do usuário...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <form id="requestDetailsForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Request Date */}
        <div className="space-y-2">
          <Label htmlFor="requestDate">Data da Solicitação</Label>
          <Input
            type="date"
            id="requestDate"
            {...register('requestDate')}
            disabled
            className="bg-gray-50 cursor-not-allowed"
          />
        </div>



        {/* Setor do Usuário (read-only) */}
        <div className="space-y-2">
          <Label htmlFor="department">Setor do Usuário</Label>
          <input
            type="hidden"
            {...register('department')}
          />

          {userDepartment ? (
            <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-primary-900">{userDepartment.name}</p>
                  {userDepartment.description && (
                    <p className="text-sm text-primary-700">{userDepartment.description}</p>
                  )}
                </div>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-600">
                  Seu Setor
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-800">
                  Departamento não encontrado
                </p>
                <p className="text-sm text-red-700">
                  Seu usuário não possui um departamento associado ou o departamento não foi encontrado.
                  Entre em contato com o administrador para configurar seu departamento.
                </p>
              </div>
            </div>
          )}

          {errors.department && (
            <p className="text-sm text-red-500 mt-1">{errors.department.message}</p>
          )}
        </div>

        {/* Setor Solicitante — onde o pedido será entregue */}
        <div className="space-y-2">
          <Label htmlFor="requesting_department">
            Setor Solicitante
            <span className="ml-1 text-xs font-normal text-gray-500">(Setor onde o pedido será entregue)</span>
          </Label>
          <select
            id="requesting_department"
            {...register('requesting_department')}
            className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Selecione o setor solicitante...</option>
            {allDepartments
              .filter(d => !d.name.toLowerCase().includes('satélite 2') && !d.name.toLowerCase().includes('satelite 2'))
              .map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          {errors.requesting_department && (
            <p className="text-sm text-red-500 mt-1">{errors.requesting_department.message}</p>
          )}
        </div>

        {/* Setor Solicitado — quem fará a entrega */}
        <div className="space-y-2">
          <Label htmlFor="destination_department">
            Setor Solicitado
            <span className="ml-1 text-xs font-normal text-gray-500">(Setor que fará a entrega do pedido)</span>
          </Label>
          {(() => {
            const selectedDept = allDepartments.find(d => d.id === watchedRequestingDept)
            const selectedName = selectedDept?.name.toLowerCase() ?? ''
            const isSatelite1 = selectedName.includes('satélite 1') || selectedName.includes('satelite 1')
            const isSatelite2 = selectedName.includes('satélite 2') || selectedName.includes('satelite 2')
            const isAndar = (selectedName.includes('satélite') || selectedName.includes('satelite')) &&
              (isSatelite1 || isSatelite2 || selectedName.includes('andar'))
            const isTerreo = selectedName.includes('satélite térreo') || selectedName.includes('satelite terreo')

            if (requestType === 'warehouse' && warehouseDepartment) {
              return (
                <>
                  <input type="hidden" {...register('destination_department')} />
                  <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-primary-900">{warehouseDepartment.name}</p>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-600">Fixo</span>
                    </div>
                  </div>
                </>
              )
            }

            if (isTerreo && lockedDestination) {
              return (
                <>
                  <input type="hidden" {...register('destination_department')} />
                  <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-primary-900">{lockedDestination.name}</p>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-600">Fixo</span>
                    </div>
                  </div>
                </>
              )
            }

            if (isAndar && !isTerreo) {
              // Satélite 1º → pode escolher CAF ou Satélite 2º
              // Satélite 2º → pode escolher CAF ou Satélite 1º
              const allowedOptions = allDepartments.filter(d => {
                const n = d.name.toLowerCase()
                const isCAF = n.includes('caf')
                const isSat1 = n.includes('satélite 1') || n.includes('satelite 1')
                const isSat2 = n.includes('satélite 2') || n.includes('satelite 2')
                if (isSatelite1) return isCAF || isSat2
                if (isSatelite2) return isCAF || isSat1
                return isCAF || isSat1 || isSat2
              })
              return (
                <select
                  id="destination_department"
                  {...register('destination_department')}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Selecione o setor solicitado...</option>
                  {allowedOptions.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              )
            }

            return (
              <select
                id="destination_department"
                {...register('destination_department')}
                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Selecione o setor solicitado...</option>
                {allDepartments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            )
          })()}
          {errors.destination_department && (
            <p className="text-sm text-red-500 mt-1">{errors.destination_department.message}</p>
          )}
        </div>

        {/* Priority Selection */}
        <div className="space-y-2">
          <Label>Prioridade</Label>
          <div className="grid grid-cols-3 gap-4">
            <div className="relative">
              <input
                type="radio"
                {...register('priority')}
                value="low"
                id="priority-low"
                className="peer sr-only"
              />
              <label
                htmlFor="priority-low"
                className="flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all peer-checked:border-green-500 peer-checked:bg-green-50 hover:bg-gray-50"
              >
                <span className="font-medium text-sm">Baixa</span>
              </label>
            </div>
            <div className="relative">
              <input
                type="radio"
                {...register('priority')}
                value="medium"
                id="priority-medium"
                className="peer sr-only"
              />
              <label
                htmlFor="priority-medium"
                className="flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all peer-checked:border-yellow-500 peer-checked:bg-yellow-50 hover:bg-gray-50"
              >
                <span className="font-medium text-sm">Média</span>
              </label>
            </div>
            <div className="relative">
              <input
                type="radio"
                {...register('priority')}
                value="high"
                id="priority-high"
                className="peer sr-only"
              />
              <label
                htmlFor="priority-high"
                className="flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all peer-checked:border-red-500 peer-checked:bg-red-50 hover:bg-gray-50"
              >
                <span className="font-medium text-sm">Alta</span>
              </label>
            </div>
          </div>
          {errors.priority && (
            <p className="text-sm text-red-500">{errors.priority.message}</p>
          )}
        </div>
      </form>

      {/* Submit Button */}
      <Button
        type="submit"
        form="requestDetailsForm"
        className="w-full bg-primary-500 hover:bg-primary-600 text-white"
        disabled={!userDepartment}
      >
        Próximo
      </Button>
    </div>
  )
}
