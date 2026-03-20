import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useTheme } from '@/contexts/theme'
import {
  User,
  LogOut,
  Settings,
  Search,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  toggleSidebar: () => void
  isSidebarOpen: boolean
}

export function Header({ toggleSidebar, isSidebarOpen }: HeaderProps) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { mode, toggle, colors } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <header
      style={{
        background: colors.headerBg,
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderBottom: `1px solid ${colors.headerBorder}`,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background 0.4s, border-color 0.4s',
      }}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="md:hidden"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: colors.headerText, padding: 4,
          }}
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <form onSubmit={handleSearch} className="hidden md:flex relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
            style={{ color: mode === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(13,46,28,0.4)' }}
          />
          <input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
              width: 256, fontSize: 14, borderRadius: 10, outline: 'none',
              background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
              border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
              color: colors.headerText,
              transition: 'all 0.4s',
            }}
          />
        </form>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggle}
          title={mode === 'dark' ? 'Tema claro' : 'Tema escuro'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
            background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
            color: colors.headerText,
            transition: 'all 0.4s',
          }}
        >
          {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                background: 'linear-gradient(135deg, #2db48c, #38bdaa)',
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
              }}
            >
              {user?.full_name.charAt(0).toUpperCase() || 'U'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
