import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { useModule } from '@/contexts/module'
import { useTheme } from '@/contexts/theme'
import { Pill, Package2, ArrowRight } from 'lucide-react'

export function ModuleSelector() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setActiveModule } = useModule()
  const { mode } = useTheme()

  const firstName = user?.full_name?.split(' ')[0] || 'Usuário'

  const glass = mode === 'dark'
    ? 'rgba(30, 46, 38, 0.7)'
    : 'rgba(255, 255, 255, 0.7)'

  const textColor = mode === 'dark' ? '#e8f0ec' : '#1a2a22'
  const mutedColor = mode === 'dark' ? '#98b0a4' : '#64748b'

  function handleSelect(mod: 'farmacia' | 'almoxarifado') {
    setActiveModule(mod)
    navigate(`/${mod === 'farmacia' ? 'farmacia' : 'almox'}/dashboard`)
  }

  const modules = [
    {
      key: 'farmacia' as const,
      title: 'Farmácia',
      description: 'Dispensação, cadastros, estoque de medicamentos, prescrições e controle de validades',
      icon: Pill,
      color: '#2da362',
      gradient: 'linear-gradient(135deg, #2da362, #38bdaa)',
      bgHover: mode === 'dark' ? 'rgba(45, 163, 98, 0.12)' : 'rgba(45, 163, 98, 0.08)',
    },
    {
      key: 'almoxarifado' as const,
      title: 'Almoxarifado',
      description: 'Saídas diretas, movimentações, estoque de materiais, consumo e relatórios',
      icon: Package2,
      color: '#00CCBB',
      gradient: 'linear-gradient(135deg, #00CCBB, #38bdaa)',
      bgHover: mode === 'dark' ? 'rgba(0, 204, 187, 0.12)' : 'rgba(0, 204, 187, 0.08)',
    },
  ]

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: textColor, marginBottom: 8 }}>
          Olá, {firstName}!
        </h1>
        <p style={{ fontSize: 16, color: mutedColor }}>
          Selecione o módulo que deseja acessar
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {modules.map((mod) => (
          <button
            key={mod.key}
            onClick={() => handleSelect(mod.key)}
            style={{
              background: glass,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 16,
              padding: 32,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = mod.bgHover
              e.currentTarget.style.borderColor = mod.color
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = `0 12px 32px ${mod.color}20`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = glass
              e.currentTarget.style.borderColor = mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: mod.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${mod.color}30`,
            }}>
              <mod.icon className="w-7 h-7" style={{ color: '#fff' }} />
            </div>

            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: textColor, marginBottom: 6 }}>
                {mod.title}
              </h2>
              <p style={{ fontSize: 13, color: mutedColor, lineHeight: 1.5 }}>
                {mod.description}
              </p>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: mod.color,
              marginTop: 'auto',
            }}>
              Acessar
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
