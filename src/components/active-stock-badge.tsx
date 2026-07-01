import { Package2, AlertCircle } from 'lucide-react'
import { useModule } from '@/contexts/module'

/**
 * Badge que mostra em qual estoque farmacêutico (CAF/SAT_1/SAT_2/SAT_T)
 * o usuário está trabalhando. Vai no cabeçalho das telas de estoque,
 * dispensação, movimentação, entrada, saída — pra remover a dúvida
 * "estou vendo/mexendo em qual estoque?".
 *
 * Se o usuário está no módulo farmácia SEM estoque escolhido, mostra
 * warning âmbar pedindo pra selecionar.
 * Se está fora do módulo farmácia (almoxarifado), não mostra nada.
 */
export function ActiveStockBadge({ compact = false }: { compact?: boolean }) {
  const { activeModule, activeStock } = useModule()
  if (activeModule !== 'farmacia') return null

  if (!activeStock) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${
        compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      } bg-amber-100 text-amber-800 border-amber-300`}>
        <AlertCircle className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        Nenhum estoque selecionado
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${
      compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
    } bg-blue-100 text-blue-800 border-blue-300`}
      title={activeStock.name}
    >
      <Package2 className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {activeStock.label}
    </span>
  )
}
