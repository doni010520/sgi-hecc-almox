import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import {
  Package2,
  Pill,
  ClipboardList,
  Users,
  BarChart3,
  PlayCircle,
  ArrowRight,
  CheckSquare,
  BookOpen,
  ChevronDown,
  Settings,
  AlertTriangle,
  CalendarX,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/theme'
import { supabase } from '@/lib/supabase'

interface DashboardProps {
  module?: 'farmacia' | 'almoxarifado'
}

export function Dashboard({ module: activeModule }: DashboardProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { mode } = useTheme()

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500">Carregando...</p>
        </div>
      </div>
    )
  }

  const isAdmin = user?.role === 'administrador'
  const isManager = user?.role === 'gestor'
  const isAtendente = user?.role === 'atendente'
  const canManageRequests = isAdmin || isManager || isAtendente
  const [showGuide, setShowGuide] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [expiringItems, setExpiringItems] = useState<any[]>([])
  const [loadingExpiry, setLoadingExpiry] = useState(false)

  // Buscar itens com validade próxima (2 meses) ou já vencidos
  useEffect(() => {
    if (!canManageRequests) return
    ;(async () => {
      setLoadingExpiry(true)
      try {
        const twoMonthsFromNow = new Date()
        twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2)
        const cutoff = twoMonthsFromNow.toISOString().split('T')[0]

        let warehouseExpiring: any[] = []
        let pharmacyExpiring: any[] = []

        if (activeModule !== 'farmacia') {
          const { data } = await supabase
            .from('warehouse_items')
            .select('id, name, code, expiry_date, current_stock')
            .eq('is_active', true)
            .not('expiry_date', 'is', null)
            .lte('expiry_date', cutoff)
            .gt('current_stock', 0)
            .order('expiry_date', { ascending: true })
            .limit(50)
          warehouseExpiring = data || []
        }

        if (activeModule !== 'almoxarifado') {
          const { data } = await supabase
            .from('pharmacy_items')
            .select('id, name, code, expiry_date, current_stock')
            .eq('is_active', true)
            .not('expiry_date', 'is', null)
            .lte('expiry_date', cutoff)
            .gt('current_stock', 0)
            .order('expiry_date', { ascending: true })
            .limit(50)
          pharmacyExpiring = data || []
        }

        const all = [
          ...warehouseExpiring.map(i => ({ ...i, source: 'almoxarifado' })),
          ...pharmacyExpiring.map(i => ({ ...i, source: 'farmacia' })),
        ].sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())

        setExpiringItems(all)
      } catch (e) {
        console.error('Error loading expiring items:', e)
      } finally {
        setLoadingExpiry(false)
      }
    })()
  }, [canManageRequests, activeModule])

  const glass: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(10,15,20,0.55)' : 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
    borderRadius: 16,
    transition: 'background 0.4s, border-color 0.4s',
  }
  const txt = mode === 'dark' ? '#fff' : '#0d2e1c'
  const txtSec = mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(13,46,28,0.65)'
  const txtMut = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(13,46,28,0.45)'

  const cardStyle: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    transition: 'background 0.3s',
  }
  const iconBg: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(45,180,140,0.15)' : 'rgba(16,185,129,0.12)',
  }
  const iconColor: React.CSSProperties = {
    color: mode === 'dark' ? '#5ee8b8' : '#059669',
  }
  const btnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '8px 16px', fontSize: 13, fontWeight: 600,
    borderRadius: 8, cursor: 'pointer',
    background: mode === 'dark' ? 'rgba(45,180,140,0.15)' : 'rgba(16,185,129,0.1)',
    color: mode === 'dark' ? '#5ee8b8' : '#059669',
    border: `1px solid ${mode === 'dark' ? 'rgba(45,180,140,0.3)' : 'rgba(16,185,129,0.25)'}`,
    transition: 'all 0.2s',
  }

  return (
    <ErrorBoundary>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: txt }}>
            Ola, {user?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-sm mt-1" style={{ color: txtSec }}>
            Sistema de Gestao de Insumos — HECC
          </p>
        </div>
        <Button
          className="bg-primary-500 hover:bg-primary-600 text-white"
          onClick={() => navigate('/requests/new')}
        >
          Nova Solicitacao
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Alerta de Validade */}
      {canManageRequests && !loadingExpiry && expiringItems.length > 0 && (() => {
        const today = new Date().toISOString().split('T')[0]
        const expired = expiringItems.filter(i => i.expiry_date <= today)
        const expiringSoon = expiringItems.filter(i => i.expiry_date > today)
        return (
          <div className="rounded-2xl overflow-hidden" style={{
            background: mode === 'dark' ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)',
            border: `1px solid ${mode === 'dark' ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{
              background: mode === 'dark' ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
            }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: mode === 'dark' ? '#fca5a5' : '#991b1b' }}>
                    Alerta de Validade
                  </h3>
                  <p className="text-sm" style={{ color: mode === 'dark' ? 'rgba(252,165,165,0.7)' : 'rgba(153,27,27,0.7)' }}>
                    {expired.length > 0 && <span className="font-bold">{expired.length} vencido(s)</span>}
                    {expired.length > 0 && expiringSoon.length > 0 && ' · '}
                    {expiringSoon.length > 0 && <span>{expiringSoon.length} vencendo em até 2 meses</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/estoque/vencimentos')}
                className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  color: mode === 'dark' ? '#fca5a5' : '#991b1b',
                  background: mode === 'dark' ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${mode === 'dark' ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'}`,
                }}
              >
                Ver todos <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-3 space-y-2 max-h-64 overflow-y-auto">
              {expiringItems.slice(0, 8).map((item) => {
                const isExpired = item.expiry_date <= today
                const expiryDate = new Date(item.expiry_date + 'T00:00:00')
                const daysUntil = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={`${item.source}-${item.id}`} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{
                    background: mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                    border: `1px solid ${isExpired
                      ? (mode === 'dark' ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)')
                      : (mode === 'dark' ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.15)')
                    }`,
                  }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: txt }}>{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: txtMut }}>{item.code}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{
                          background: item.source === 'farmacia'
                            ? (mode === 'dark' ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)')
                            : (mode === 'dark' ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'),
                          color: item.source === 'farmacia'
                            ? (mode === 'dark' ? '#c084fc' : '#7c3aed')
                            : (mode === 'dark' ? '#93c5fd' : '#2563eb'),
                        }}>
                          {item.source === 'farmacia' ? 'Farmácia' : 'Almoxarifado'}
                        </span>
                        <span className="text-xs" style={{ color: txtMut }}>Estoque: {item.current_stock}</span>
                      </div>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <CalendarX className="w-3.5 h-3.5" style={{ color: isExpired ? '#ef4444' : '#f59e0b' }} />
                        <span className="text-sm font-semibold" style={{ color: isExpired ? '#ef4444' : '#f59e0b' }}>
                          {expiryDate.toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <span className="text-xs font-medium" style={{
                        color: isExpired ? '#ef4444' : '#f59e0b',
                      }}>
                        {isExpired ? `Vencido há ${Math.abs(daysUntil)} dias` : `Vence em ${daysUntil} dias`}
                      </span>
                    </div>
                  </div>
                )
              })}
              {expiringItems.length > 8 && (
                <p className="text-center text-sm py-2" style={{ color: txtMut }}>
                  + {expiringItems.length - 8} item(ns) · <button onClick={() => navigate('/estoque/vencimentos')} className="underline" style={{ color: mode === 'dark' ? '#fca5a5' : '#991b1b' }}>Ver todos</button>
                </p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Main Features */}
      <div className="p-6" style={glass}>
        <h2 className="text-xl font-semibold mb-6" style={{ color: txt }}>Principais Funcionalidades</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Requests */}
          <div className="p-5 rounded-xl flex flex-col" style={cardStyle}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg" style={iconBg}><ClipboardList className="w-5 h-5" style={iconColor} /></div>
              <h3 className="font-semibold" style={{ color: txt }}>Solicitacoes</h3>
            </div>
            <p className="text-sm mb-4 flex-1" style={{ color: txtSec }}>
              Crie e acompanhe solicitacoes de materiais e medicamentos para seu setor.
            </p>
            <div>
              <button onClick={() => navigate('/requests')} style={btnStyle}>
                Acessar <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>

          {/* Inventory */}
          {(isManager || isAdmin || isAtendente) && (
            <div className="p-5 rounded-xl flex flex-col" style={cardStyle}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg" style={iconBg}>
                  {activeModule === 'farmacia'
                    ? <Pill className="w-5 h-5" style={iconColor} />
                    : <Package2 className="w-5 h-5" style={iconColor} />
                  }
                </div>
                <h3 className="font-semibold" style={{ color: txt }}>
                  {activeModule === 'farmacia' ? 'Estoque — Farmácia'
                    : activeModule === 'almoxarifado' ? 'Estoque — Almoxarifado'
                    : 'Estoque'}
                </h3>
              </div>
              <p className="text-sm mb-4 flex-1" style={{ color: txtSec }}>
                {activeModule === 'farmacia'
                  ? 'Gerencie o estoque de medicamentos. Acompanhe niveis, validades e movimentacoes.'
                  : activeModule === 'almoxarifado'
                  ? 'Gerencie o estoque de materiais. Acompanhe niveis e movimentacoes.'
                  : 'Gerencie o estoque de materiais e medicamentos. Acompanhe niveis e movimentacoes.'}
              </p>
              <div className="flex gap-2">
                {activeModule !== 'almoxarifado' && (
                  <button onClick={() => navigate(activeModule ? '/farmacia/inventory' : '/inventory/pharmacy')} style={btnStyle}>
                    <Pill className="w-4 h-4 mr-1" /> Farmacia
                  </button>
                )}
                {activeModule !== 'farmacia' && (
                  <button onClick={() => navigate(activeModule ? '/almox/inventory' : '/inventory/warehouse')} style={btnStyle}>
                    <Package2 className="w-4 h-4 mr-1" /> Almoxarifado
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Reports */}
          {(isManager || isAdmin || isAtendente) && (
            <div className="p-5 rounded-xl flex flex-col" style={cardStyle}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg" style={iconBg}><BarChart3 className="w-5 h-5" style={iconColor} /></div>
                <h3 className="font-semibold" style={{ color: txt }}>Relatorios</h3>
              </div>
              <p className="text-sm mb-4 flex-1" style={{ color: txtSec }}>
                Visualize relatorios de consumo, estoque e solicitacoes. Exporte dados.
              </p>
              <div className="flex gap-2">
                {activeModule !== 'almoxarifado' && (
                  <button onClick={() => navigate(activeModule ? '/farmacia/reports/pharmacy-consumption' : '/reports/pharmacy-consumption')} style={btnStyle}>Farmacia</button>
                )}
                {activeModule !== 'farmacia' && (
                  <button onClick={() => navigate(activeModule ? '/almox/reports/warehouse-consumption' : '/reports/warehouse-consumption')} style={btnStyle}>Almoxarifado</button>
                )}
              </div>
            </div>
          )}

          {/* Request Management */}
          {canManageRequests && (
            <div className="p-5 rounded-xl flex flex-col" style={cardStyle}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg" style={iconBg}><CheckSquare className="w-5 h-5" style={iconColor} /></div>
                <h3 className="font-semibold" style={{ color: txt }}>Gestao de Solicitacoes</h3>
              </div>
              <p className="text-sm mb-4 flex-1" style={{ color: txtSec }}>
                Aprove, rejeite e processe solicitacoes. Acompanhe o fluxo completo.
              </p>
              <div>
                <button onClick={() => navigate('/requests/inbox')} style={btnStyle}>
                  Caixa de Entrada <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* User Management */}
          {isAdmin && (
            <div className="p-5 rounded-xl flex flex-col" style={cardStyle}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg" style={iconBg}><Users className="w-5 h-5" style={iconColor} /></div>
                <h3 className="font-semibold" style={{ color: txt }}>Gestao de Usuarios</h3>
              </div>
              <p className="text-sm mb-4 flex-1" style={{ color: txtSec }}>
                Gerencie usuarios, defina permissoes e controle acessos.
              </p>
              <div>
                <button onClick={() => navigate('/users-advanced')} style={btnStyle}>
                  Gerenciar <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="p-5 rounded-xl flex flex-col" style={cardStyle}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg" style={iconBg}><Settings className="w-5 h-5" style={iconColor} /></div>
              <h3 className="font-semibold" style={{ color: txt }}>Configuracoes</h3>
            </div>
            <p className="text-sm mb-4 flex-1" style={{ color: txtSec }}>
              Personalize preferencias, perfil e notificacoes.
            </p>
            <div>
              <button onClick={() => navigate('/settings')} style={btnStyle}>
                Acessar <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Guide - Collapsible */}
      <div style={glass}>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full p-4 flex items-center justify-between cursor-pointer"
          style={{ background: 'transparent', border: 'none' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <BookOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-base font-semibold" style={{ color: txt }}>Guia Rapido</span>
          </div>
          <ChevronDown size={20} style={{ color: txtMut, transform: showGuide ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s' }} />
        </button>
        {showGuide && (
          <div className="px-6 pb-6 space-y-4">
            <div className="p-4 rounded-lg" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
              <h3 className="font-medium mb-1 flex items-center gap-2 text-sm" style={{ color: txt }}>
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-semibold">1</span>
                Como criar uma nova solicitacao
              </h3>
              <p className="text-sm ml-7" style={{ color: txtSec }}>
                Acesse "Nova Solicitacao", selecione Farmacia ou Almoxarifado, preencha os detalhes e adicione os itens.
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
              <h3 className="font-medium mb-1 flex items-center gap-2 text-sm" style={{ color: txt }}>
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-semibold">2</span>
                Como acompanhar suas solicitacoes
              </h3>
              <p className="text-sm ml-7" style={{ color: txtSec }}>
                Acesse "Minhas Solicitacoes" para ver status, filtrar e visualizar detalhes.
              </p>
            </div>
            {canManageRequests && (
              <div className="p-4 rounded-lg" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
                <h3 className="font-medium mb-1 flex items-center gap-2 text-sm" style={{ color: txt }}>
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-semibold">3</span>
                  Como aprovar ou rejeitar solicitacoes
                </h3>
                <p className="text-sm ml-7" style={{ color: txtSec }}>
                  Acesse "Caixa de Entrada", selecione a solicitacao e use os botoes de acao.
                </p>
              </div>
            )}
            {(isManager || isAdmin || isAtendente) && (
              <div className="p-4 rounded-lg" style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
                <h3 className="font-medium mb-1 flex items-center gap-2 text-sm" style={{ color: txt }}>
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-semibold">4</span>
                  Como gerenciar o estoque
                </h3>
                <p className="text-sm ml-7" style={{ color: txtSec }}>
                  Acesse "Farmacia" ou "Almoxarifado" no menu de Estoque.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Video Tutorial - Collapsible */}
      <div style={glass}>
        <button
          onClick={() => setShowVideo(!showVideo)}
          className="w-full p-4 flex items-center justify-between cursor-pointer"
          style={{ background: 'transparent', border: 'none' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <PlayCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-base font-semibold" style={{ color: txt }}>Tutorial em Video</span>
          </div>
          <ChevronDown size={20} style={{ color: txtMut, transform: showVideo ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s' }} />
        </button>
        {showVideo && (
          <div className="px-6 pb-6">
            <p className="mb-4 text-sm" style={{ color: txtSec }}>
              Assista ao tutorial completo para aprender a utilizar o sistema.
            </p>
            <div className="aspect-video rounded-lg flex items-center justify-center mb-4" style={{ background: mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)', border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
              <div className="text-center">
                <PlayCircle className="w-16 h-16 text-red-500 mx-auto mb-3" />
                <p className="font-medium" style={{ color: txt }}>Tutorial do Sistema de Gestao de Insumos</p>
                <p className="text-sm" style={{ color: txtMut }}>Duracao: 10:25</p>
              </div>
            </div>
            <div className="flex justify-center">
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank')}
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                Assistir no YouTube
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
    </ErrorBoundary>
  )
}