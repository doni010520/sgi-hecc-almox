import { Package2, Pill, ArrowRight, AlertTriangle, Lock } from 'lucide-react'
import type { RequestType } from '../types'

interface RequestTypeProps {
  type: RequestType | null
  onTypeSelect: (type: RequestType) => void
}

// Flag central de bloqueio. Quando o sistema de farmacia estiver pronto
// pra producao (estoque CAF carregado, roteamento de departamentos
// completo, RLS finalizado), troque para `false` e remova o banner.
const PHARMACY_REQUESTS_BLOCKED = true

export function RequestTypeStep({ type, onTypeSelect }: RequestTypeProps) {
  const handlePharmacyClick = () => {
    if (PHARMACY_REQUESTS_BLOCKED) return
    onTypeSelect('pharmacy')
  }

  return (
    <div className="space-y-4">
      {PHARMACY_REQUESTS_BLOCKED && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">
              Solicitações de Farmácia temporariamente bloqueadas
            </p>
            <p className="text-sm text-amber-800 mt-1">
              O sistema de farmácia está em fase de migração para o novo modelo de
              múltiplos estoques (CAF + Satélites). Use o canal alternativo definido
              pela coordenação para solicitar medicamentos neste período.
              <strong className="block mt-2">
                Solicitações de Almoxarifado continuam normalmente.
              </strong>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pharmacy Card */}
        <div
          className={`relative group rounded-xl border-2 transition-all ${
            PHARMACY_REQUESTS_BLOCKED
              ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
              : type === 'pharmacy'
                ? 'border-primary-500 bg-primary-50 shadow-lg cursor-pointer'
                : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50 cursor-pointer'
          }`}
          onClick={handlePharmacyClick}
          aria-disabled={PHARMACY_REQUESTS_BLOCKED}
        >
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg transition-colors ${
                PHARMACY_REQUESTS_BLOCKED
                  ? 'bg-gray-200'
                  : type === 'pharmacy' ? 'bg-primary-100' : 'bg-gray-100 group-hover:bg-primary-50'
              }`}>
                <Pill className={`w-8 h-8 ${
                  PHARMACY_REQUESTS_BLOCKED
                    ? 'text-gray-400'
                    : type === 'pharmacy' ? 'text-primary-600' : 'text-gray-500 group-hover:text-primary-500'
                }`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className={`text-lg font-semibold transition-colors ${
                    PHARMACY_REQUESTS_BLOCKED
                      ? 'text-gray-500'
                      : type === 'pharmacy' ? 'text-primary-900' : 'text-gray-900'
                  }`}>
                    Farmácia
                  </h3>
                  {PHARMACY_REQUESTS_BLOCKED && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      <Lock className="w-3 h-3" />
                      Indisponível
                    </span>
                  )}
                </div>
                <p className={PHARMACY_REQUESTS_BLOCKED ? 'text-gray-400 mt-1' : 'text-gray-500 mt-1'}>
                  {PHARMACY_REQUESTS_BLOCKED
                    ? 'Em manutenção — sistema sendo migrado'
                    : 'Solicite medicamentos e materiais hospitalares'}
                </p>
              </div>
            </div>
            <ul className={`mt-4 space-y-2 text-sm ${PHARMACY_REQUESTS_BLOCKED ? 'text-gray-400' : 'text-gray-500'}`}>
              <li className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${PHARMACY_REQUESTS_BLOCKED ? 'bg-gray-300' : 'bg-primary-500'}`} />
                Medicamentos
              </li>
              <li className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${PHARMACY_REQUESTS_BLOCKED ? 'bg-gray-300' : 'bg-primary-500'}`} />
                Materiais hospitalares
              </li>
              <li className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${PHARMACY_REQUESTS_BLOCKED ? 'bg-gray-300' : 'bg-primary-500'}`} />
                Insumos médicos
              </li>
            </ul>
          </div>
          {!PHARMACY_REQUESTS_BLOCKED && type === 'pharmacy' && (
            <div className="absolute -right-2 -top-2 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white">
              <ArrowRight className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Warehouse Card */}
        <div
          className={`relative group cursor-pointer rounded-xl border-2 transition-all ${
            type === 'warehouse'
              ? 'border-primary-500 bg-primary-50 shadow-lg'
              : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50'
          }`}
          onClick={() => onTypeSelect('warehouse')}
        >
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg transition-colors ${
                type === 'warehouse' ? 'bg-primary-100' : 'bg-gray-100 group-hover:bg-primary-50'
              }`}>
                <Package2 className={`w-8 h-8 ${
                  type === 'warehouse' ? 'text-primary-600' : 'text-gray-500 group-hover:text-primary-500'
                }`} />
              </div>
              <div>
                <h3 className={`text-lg font-semibold transition-colors ${
                  type === 'warehouse' ? 'text-primary-900' : 'text-gray-900'
                }`}>
                  Almoxarifado
                </h3>
                <p className="text-gray-500 mt-1">
                  Solicite materiais de escritório e outros insumos
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-gray-500">
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary-500 mr-2" />
                Material de escritório
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary-500 mr-2" />
                Material de limpeza
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary-500 mr-2" />
                Equipamentos
              </li>
            </ul>
          </div>
          {type === 'warehouse' && (
            <div className="absolute -right-2 -top-2 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white">
              <ArrowRight className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
