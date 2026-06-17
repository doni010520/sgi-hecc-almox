import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'

export type ModuleType = 'farmacia' | 'almoxarifado' | null

interface ModuleContextType {
  activeModule: ModuleType
  setActiveModule: (m: ModuleType) => void
  isModuleUser: boolean
}

const ModuleContext = createContext<ModuleContextType | null>(null)

const STORAGE_KEY = 'sgi-active-module'

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

  function setActiveModule(m: ModuleType) {
    setActiveModuleState(m)
    if (m) {
      localStorage.setItem(STORAGE_KEY, m)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  useEffect(() => {
    if (!isModuleUser) {
      setActiveModuleState(null)
      return
    }
    const path = location.pathname
    if (path.startsWith('/farmacia')) {
      setActiveModuleState('farmacia')
      localStorage.setItem(STORAGE_KEY, 'farmacia')
    } else if (path.startsWith('/almox')) {
      setActiveModuleState('almoxarifado')
      localStorage.setItem(STORAGE_KEY, 'almoxarifado')
    }
  }, [location.pathname, isModuleUser])

  return (
    <ModuleContext.Provider value={{ activeModule, setActiveModule, isModuleUser }}>
      {children}
    </ModuleContext.Provider>
  )
}
