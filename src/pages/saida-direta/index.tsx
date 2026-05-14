import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2, Package2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import {
  warehouseDispatchService,
  type WarehouseDispatchSummary,
} from '@/lib/services/warehouse-dispatch'

export function WarehouseDispatchList() {
  const navigate = useNavigate()
  const [dispatches, setDispatches] = useState<WarehouseDispatchSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      const data = await warehouseDispatchService.list()
      setDispatches(data)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (s: string) => {
    try {
      return format(new Date(s), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    } catch {
      return '-'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100 rounded-lg">
            <Package2 className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Saídas Diretas — Almoxarifado</h1>
            <p className="text-sm text-gray-500">
              Saídas registradas sem solicitação prévia. O estoque é abatido automaticamente no momento do registro.
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/saida-direta/new')}
          className="bg-primary-500 hover:bg-primary-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Saída
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" /> Carregando...
          </div>
        ) : dispatches.length === 0 ? (
          <div className="text-center py-12">
            <Package2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">Nenhuma saída direta registrada ainda.</p>
            <Button onClick={() => navigate('/saida-direta/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Registrar primeira saída
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nº</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Data</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Destino</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Responsável</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Itens</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Qtd total</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">
                      #{d.dispatch_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {d.destination_department_name || d.destination_department_text || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {d.created_by_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {d.items_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {d.total_quantity ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {d.status === 'completed' ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Concluída
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                          Cancelada
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
