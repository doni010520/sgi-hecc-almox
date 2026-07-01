import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { pharmacyStockById, type PharmacyStock } from '@/lib/constants/stock-locations'

export type ModuleType = 'farmacia' | 'almoxarifado' | null

interface ModuleContextType {
  activeModule: ModuleType
  setActiveModule: (m: ModuleType) => void
  isModuleUser: boolean
  // Estoque de farmácia atualmente selecionado (CAF / Satélites)
  activeStock: PharmacyStock | null
  setActiveStock: (s: PharmacyStock | null) => void
}

const ModuleContext = createContext<ModuleContextType | null>(null)

const STORAGE_KEY = 'sgi-active-module'
const STOCK_KEY = 'sgi-active-stock'

export function useModule() {
  const context = useContext(ModuleContext)
  if (!context) {
    throw new Error('useModule must be used within a ModuleProvider')
  }
  return context
}

export function ModuleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  const isModuleUser = user?.role === 'administrador' || user?.role === 'gestor'

  const [activeModule, setActiveModuleState] = useState<ModuleType>(() => {
    if (!isModuleUser) return null
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'farmacia' || stored === 'almoxarifado') return stored
    return null
  })

  const [activeStock, setActiveStockState] = useState<PharmacyStock | null>(() =>
    pharmacyStockById(localStorage.getItem(STOCK_KEY))
  )

  function setActiveModule(m: ModuleType) {
    setActiveModuleState(m)
    if (m) {
      localStorage.setItem(STORAGE_KEY, m)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    // Sair da farmácia limpa o estoque selecionado
    if (m !== 'farmacia') {
      setActiveStockState(null)
      localStorage.removeItem(STOCK_KEY)
    }
  }

  function setActiveStock(s: PharmacyStock | null) {
    setActiveStockState(s)
    if (s) {
      localStorage.setItem(STOCK_KEY, s.id)
    } else {
      localStorage.removeItem(STOCK_KEY)
    }
  }

  useEffect(() => {
    if (!isModuleUser) {
      setActiveModuleState(null)
      return
    }
    const path = location.pathname
    // Path dita o modulo quando explicito (/farmacia/* ou /almox/*)
    if (path.startsWith('/farmacia')) {
      setActiveModuleState('farmacia')
      localStorage.setItem(STORAGE_KEY, 'farmacia')
      return
    }
    if (path.startsWith('/almox')) {
      setActiveModuleState('almoxarifado')
      localStorage.setItem(STORAGE_KEY, 'almoxarifado')
      return
    }
    // Path neutro (ex.: /requests/*, /dashboard) — restaura do localStorage.
    // Sem esse fallback, um F5/Ctrl+Shift+R fora de /farmacia deixava o
    // header sem dropdown de estoque porque o initial useState rodou
    // enquanto user ainda estava null (auth async).
    setActiveModuleState((current) => {
      if (current) return current
      const stored = localStorage.getItem(STORAGE_KEY)
      return (stored === 'farmacia' || stored === 'almoxarifado') ? stored : null
    })
  }, [location.pathname, isModuleUser])

  // activeStock tambem depende da hidratacao do localStorage; caso o
  // initial useState tenha rodado antes do provider estar pronto, revalida.
  useEffect(() => {
    if (!activeStock) {
      const restored = pharmacyStockById(localStorage.getItem(STOCK_KEY))
      if (restored) setActiveStockState(restored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModuleUser])

  return (
    <ModuleContext.Provider value={{ activeModule, setActiveModule, isModuleUser, activeStock, setActiveStock }}>
      {children}
    </ModuleContext.Provider>
  )
}
