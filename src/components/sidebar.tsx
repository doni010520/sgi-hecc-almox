import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'
// Button removed - using native button with inline styles
import {
  Building2,
  ClipboardList,
  UserCircle,
  LogOut,
  LayoutDashboard,
  Settings,
  Users,
  FileText,
  BarChart3,
  InboxIcon,
  CheckSquare,
  History,
  AlertCircle,
  ListChecks,
  Database,
  Pill,
  Package2,
  X,
  Tv,
  Syringe
} from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, signOut } = useAuth()
  const { colors } = useTheme()
  const isAdmin = user?.role === 'administrador'
  const isManager = user?.role === 'gestor'
  const isAtendente = user?.role === 'atendente'
  const canManageRequests = isAdmin || isManager || isAtendente

  const menuItems = [
    {
      title: 'Principal',
      items: [
        { name: 'Dashboard', icon: LayoutDashboard, href: '/', show: true },
        { name: 'Painel TV - Almoxarifado', icon: Tv, href: '/tv/warehouse', show: isManager || isAdmin || isAtendente },
        { name: 'Painel TV - Farmácia', icon: Tv, href: '/tv/pharmacy', show: isManager || isAdmin || isAtendente }
      ]
    },
    {
      title: 'Solicitações',
      items: [
        { name: 'Minhas Solicitações', icon: ClipboardList, href: '/requests', show: true },
        { name: 'Nova Solicitação', icon: ListChecks, href: '/requests/new', show: true }
      ]
    },
    {
      title: 'Dispensação',
      items: [
        { name: 'Dispensações', icon: Syringe, href: '/dispensacao', show: canManageRequests },
        { name: 'Nova Dispensação', icon: ListChecks, href: '/dispensacao/new', show: canManageRequests }
      ]
    },
    {
      title: 'Gestão de Solicitações',
      items: [
        { name: 'Caixa de Entrada', icon: InboxIcon, href: '/requests/inbox', show: canManageRequests },
        { name: 'Em Processamento', icon: CheckSquare, href: '/requests/processing', show: canManageRequests },
        { name: 'Histórico', icon: History, href: '/requests/history', show: canManageRequests },
        { name: 'Pendências', icon: AlertCircle, href: '/requests/pending', show: canManageRequests }
      ]
    },
    {
      title: 'Estoque',
      items: [
        { name: 'Farmácia', icon: Pill, href: '/inventory/pharmacy', show: isManager || isAdmin || isAtendente },
        { name: 'Almoxarifado', icon: Package2, href: '/inventory/warehouse', show: isManager || isAdmin || isAtendente }
      ]
    },
    {
      title: 'Relatórios',
      items: [
        { name: 'Estoque - Farmácia', icon: Pill, href: '/reports/pharmacy-stock', show: isManager || isAdmin || isAtendente },
        { name: 'Estoque - Almoxarifado', icon: Package2, href: '/reports/warehouse-stock', show: isManager || isAdmin || isAtendente },
        { name: 'Consumo - Farmácia', icon: BarChart3, href: '/reports/pharmacy-consumption', show: isManager || isAdmin || isAtendente },
        { name: 'Consumo - Almoxarifado', icon: BarChart3, href: '/reports/warehouse-consumption', show: isManager || isAdmin || isAtendente },
        { name: 'Gestão Consumo - Farmácia', icon: FileText, href: '/reports/pharmacy-admin-consumption', show: isAdmin },
        { name: 'Gestão Consumo - Almoxarifado', icon: FileText, href: '/reports/warehouse-admin-consumption', show: isAdmin }
      ]
    },
    {
      title: 'Administração',
      items: [
        { name: 'Usuários', icon: Users, href: '/users-advanced', show: isAdmin },
        {
          name: 'Tabelas', icon: Database, href: '/tables', show: isAdmin,
          submenu: [{ name: 'Setores', href: '/tables/departments', icon: Building2 }]
        }
      ]
    },
    {
      title: 'Configurações',
      items: [
        { name: 'Meu Perfil', icon: UserCircle, href: '/profile', show: true },
        { name: 'Configurações', icon: Settings, href: '/settings', show: true }
      ]
    }
  ]

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col h-full transform transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}
      style={{
        background: colors.sidebarBg,
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderRight: `1px solid ${colors.sidebarBorder}`,
        padding: 24,
        transition: 'background 0.4s, border-color 0.4s',
      }}
    >
      {/* Close button for mobile */}
      <button className="absolute top-4 right-4 md:hidden" onClick={onClose}>
        <X className="h-5 w-5" style={{ color: colors.sidebarTextMuted }} />
      </button>

      {/* Logo & User Info */}
      <div className="mb-8 space-y-2">
        <div className="flex items-center space-x-2">
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #2db48c, #38bdaa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 12px rgba(45, 180, 140, 0.3)',
          }}>H</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.sidebarLogo, transition: 'color 0.4s' }}>
            HECC
          </h1>
        </div>
        <h2 style={{ fontSize: 12, fontWeight: 500, color: colors.sidebarTextMuted, transition: 'color 0.4s' }}>
          Hospital Estadual Costa dos Coqueiros
        </h2>
        <div style={{ paddingTop: 8, borderTop: `1px solid ${colors.sidebarBorder}` }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: colors.sidebarText, transition: 'color 0.4s' }}>{user?.full_name}</p>
          <p style={{ fontSize: 12, color: colors.sidebarTextMuted, textTransform: 'capitalize', transition: 'color 0.4s' }}>{user?.role}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto" style={{ marginRight: -8, paddingRight: 8 }}>
        {menuItems.map((section) => {
          const visibleItems = section.items.filter(item => item.show)
          if (visibleItems.length === 0) return null

          return (
            <div key={section.title}>
              <h3 style={{
                padding: '0 8px', fontSize: 11, fontWeight: 600,
                color: colors.sidebarTextMuted, textTransform: 'uppercase',
                letterSpacing: 1.2, transition: 'color 0.4s',
              }}>
                {section.title}
              </h3>
              <div className="mt-2 space-y-1">
                {visibleItems.map((item) => (
                  <div key={item.href}>
                    <NavLink
                      to={item.href}
                      style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', fontSize: 14, fontWeight: 500,
                        borderRadius: 10, transition: 'all 0.2s',
                        background: isActive ? colors.sidebarActive : 'transparent',
                        color: isActive ? colors.sidebarActiveText : colors.sidebarText,
                        textDecoration: 'none',
                      })}
                      onClick={item.submenu ? undefined : onClose}
                      onMouseEnter={(e) => {
                        if (!e.currentTarget.classList.contains('active'))
                          e.currentTarget.style.background = colors.sidebarHover
                      }}
                      onMouseLeave={(e) => {
                        const isActive = e.currentTarget.getAttribute('aria-current') === 'page'
                        e.currentTarget.style.background = isActive ? colors.sidebarActive : 'transparent'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className="w-5 h-5" />
                        {item.name}
                      </div>
                    </NavLink>
                    {item.submenu && (
                      <div className="ml-7 mt-1 space-y-1">
                        {item.submenu.map((subitem) => (
                          <NavLink
                            key={subitem.href}
                            to={subitem.href}
                            style={({ isActive }) => ({
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 10px', fontSize: 13,
                              borderRadius: 8, transition: 'all 0.2s',
                              background: isActive ? colors.sidebarActive : 'transparent',
                              color: isActive ? colors.sidebarActiveText : colors.sidebarText,
                              textDecoration: 'none',
                            })}
                            onClick={onClose}
                          >
                            <subitem.icon className="w-4 h-4" />
                            {subitem.name}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Logout Button */}
      <button
        onClick={() => signOut()}
        style={{
          marginTop: 24, display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '10px 10px', fontSize: 14, fontWeight: 500,
          borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'transparent', color: colors.sidebarText,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = colors.sidebarHover }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <LogOut className="w-5 h-5" />
        Sair
      </button>

      <style>{`
        nav::-webkit-scrollbar { width: 4px; }
        nav::-webkit-scrollbar-track { background: transparent; }
        nav::-webkit-scrollbar-thumb { background: ${colors.sidebarBorder}; border-radius: 2px; }
      `}</style>
    </div>
  )
}
