import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useModule, type ModuleType } from '@/contexts/module'
import { ProtectedRoute } from '@/components/protected-route'
import { MainLayout } from '@/pages/main-layout'

interface ModuleLayoutProps {
  module: ModuleType
}

export function ModuleLayout({ module }: ModuleLayoutProps) {
  const { setActiveModule } = useModule()

  useEffect(() => {
    if (module) setActiveModule(module)
  }, [module, setActiveModule])

  return (
    <ProtectedRoute>
      <MainLayout>
        <Outlet />
      </MainLayout>
    </ProtectedRoute>
  )
}
