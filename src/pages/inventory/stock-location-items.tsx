import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { PharmacyItems } from './pharmacy-items'
import { useModule } from '@/contexts/module'
import { pharmacyStockById } from '@/lib/constants/stock-locations'

export function StockLocationItems() {
  const { locationId } = useParams<{ locationId: string }>()
  const { setActiveStock } = useModule()
  const stock = pharmacyStockById(locationId)

  // Mantém o estoque ativo (topo/sidebar) em sincronia ao entrar direto pela URL.
  useEffect(() => {
    if (stock) setActiveStock(stock)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId])

  return <PharmacyItems locationId={locationId} locationName={stock?.name} />
}
