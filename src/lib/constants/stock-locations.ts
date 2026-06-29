// Estoques de farmácia (stock_locations). IDs fixos do banco — fonte única para
// o seletor de módulo, o indicador do topo e as telas de estoque.
export interface PharmacyStock {
  id: string
  code: string
  label: string // curto, para chips/indicador
  name: string  // completo
}

export const PHARMACY_STOCKS: PharmacyStock[] = [
  { id: '42c3b239-c354-4b5b-a2eb-d42b7a9edc10', code: 'CAF',   label: 'CAF',         name: 'CAF — Central de Abastecimento Farmacêutico' },
  { id: 'fa96acab-9065-44ee-aeae-b87c5af8110a', code: 'SAT_1', label: 'Satélite 1',  name: 'Farmácia Satélite 1º Andar' },
  { id: 'cf2d0681-0cdd-48b4-9431-73c09e853048', code: 'SAT_2', label: 'Satélite 2',  name: 'Farmácia Satélite 2º Andar' },
  { id: '6f3fdf99-829a-46bb-b354-19a44fa36324', code: 'SAT_T', label: 'Satélite T',  name: 'Farmácia Satélite Térreo' },
]

export function pharmacyStockById(id?: string | null): PharmacyStock | null {
  if (!id) return null
  return PHARMACY_STOCKS.find((s) => s.id === id) ?? null
}
