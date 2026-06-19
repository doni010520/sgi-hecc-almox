import { useParams } from 'react-router-dom'
import { PharmacyItems } from './pharmacy-items'

const LOCATION_NAMES: Record<string, string> = {
  '42c3b239-c354-4b5b-a2eb-d42b7a9edc10': 'CAF — Central de Abastecimento Farmacêutico',
  'fa96acab-9065-44ee-aeae-b87c5af8110a': 'Satélite 1',
  'cf2d0681-0cdd-48b4-9431-73c09e853048': 'Satélite 2',
  '6f3fdf99-829a-46bb-b354-19a44fa36324': 'Satélite T',
}

export function StockLocationItems() {
  const { locationId } = useParams<{ locationId: string }>()
  const locationName = locationId ? LOCATION_NAMES[locationId] : undefined
  return <PharmacyItems locationId={locationId} locationName={locationName} />
}
