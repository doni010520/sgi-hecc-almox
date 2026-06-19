import {
  Building2,
  ClipboardList,
  UserCircle,
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
  Tv,
  Syringe,
  PackageMinus,
  Undo2,
  ArrowRightLeft,
  Handshake,
  CalendarX,
  Stethoscope,
  UsersRound,
  CalendarClock,
  Clock,
  BookOpen,
  AlertOctagon,
  Shield,
  PackageCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type SidebarModule = 'farmacia' | 'almoxarifado' | 'shared' | 'admin'

export interface SidebarItem {
  name: string
  icon: LucideIcon
  href: string
  show: (flags: VisibilityFlags) => boolean
  submenu?: { name: string; href: string; icon: LucideIcon }[]
}

export interface SidebarSection {
  title: string
  module: SidebarModule
  items: SidebarItem[]
}

export interface VisibilityFlags {
  isAdmin: boolean
  isManager: boolean
  isAtendente: boolean
  isEnfermagem: boolean
  canManageRequests: boolean
}

export function buildSidebarSections(): SidebarSection[] {
  return [
    {
      title: 'Principal',
      module: 'shared',
      items: [
        { name: 'Dashboard', icon: LayoutDashboard, href: '/', show: (f) => !f.isEnfermagem },
      ],
    },
    {
      title: 'Painel TV',
      module: 'almoxarifado',
      items: [
        { name: 'Painel TV - Almoxarifado', icon: Tv, href: '/tv/warehouse', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
      ],
    },
    {
      title: 'Painel TV',
      module: 'farmacia',
      items: [
        { name: 'Painel TV - Farmácia', icon: Tv, href: '/tv/pharmacy', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
      ],
    },
    {
      title: 'Solicitações',
      module: 'shared',
      items: [
        { name: 'Minhas Solicitações', icon: ClipboardList, href: '/requests', show: () => true },
        { name: 'Nova Solicitação', icon: ListChecks, href: '/requests/new', show: () => true },
      ],
    },
    {
      title: 'Cadastros Farmácia',
      module: 'farmacia',
      items: [
        { name: 'Fornecedores', icon: Building2, href: '/farmacia/fornecedores', show: (f) => f.canManageRequests },
        { name: 'Prescritores', icon: Stethoscope, href: '/farmacia/prescritores', show: (f) => f.canManageRequests },
        { name: 'Pacientes', icon: UsersRound, href: '/farmacia/pacientes', show: (f) => f.canManageRequests },
      ],
    },
    {
      title: 'Controle Legal — Portaria 344/98',
      module: 'farmacia',
      items: [
        { name: 'Livro de Controlados', icon: BookOpen, href: '/farmacia/livro-controlados', show: (f) => f.canManageRequests },
        { name: 'Notificação de Receita', icon: FileText, href: '/farmacia/notificacao-receita', show: (f) => f.canManageRequests },
        { name: 'BMPO — Balanço', icon: BarChart3, href: '/farmacia/bmpo', show: (f) => f.canManageRequests },
        { name: 'Perdas / Inutilização', icon: PackageMinus, href: '/farmacia/perdas', show: (f) => f.canManageRequests },
        { name: 'Talidomida', icon: AlertOctagon, href: '/farmacia/talidomida', show: (f) => f.canManageRequests },
      ],
    },
    {
      title: 'Conformidade e CCIH',
      module: 'farmacia',
      items: [
        { name: 'Controle de Antimicrobianos', icon: Shield, href: '/farmacia/antimicrobianos', show: (f) => f.canManageRequests },
        { name: 'Intervenção Farmacêutica', icon: Stethoscope, href: '/farmacia/intervencao-farmaceutica', show: (f) => f.canManageRequests },
      ],
    },
    {
      title: 'Dispensação',
      module: 'farmacia',
      items: [
        { name: 'Dispensações', icon: Syringe, href: '/dispensacao', show: (f) => f.canManageRequests },
        { name: 'Nova Dispensação', icon: ListChecks, href: '/dispensacao/paciente', show: (f) => f.canManageRequests },
        { name: 'Fila de Aprovação', icon: Clock, href: '/dispensacao/fila-aprovacao', show: (f) => f.canManageRequests },
        { name: 'Histórico de Prescrições', icon: History, href: '/dispensacao/historico', show: (f) => f.canManageRequests },
      ],
    },
    {
      title: 'Movimentação entre Unidades — Farmácia',
      module: 'farmacia',
      items: [
        { name: 'Formulários', icon: ArrowRightLeft, href: '/farmacia/movimentacoes', show: (f) => f.canManageRequests },
        { name: 'Nova Movimentação', icon: ListChecks, href: '/farmacia/movimentacoes/new', show: (f) => f.canManageRequests },
      ],
    },
    {
      title: 'Movimentação entre Unidades — Almoxarifado',
      module: 'almoxarifado',
      items: [
        { name: 'Formulários', icon: ArrowRightLeft, href: '/almoxarifado/movimentacoes', show: (f) => f.canManageRequests },
        { name: 'Nova Movimentação', icon: ListChecks, href: '/almoxarifado/movimentacoes/new', show: (f) => f.canManageRequests },
      ],
    },
    {
      title: 'Saída Direta — Almoxarifado',
      module: 'almoxarifado',
      items: [
        { name: 'Saídas Registradas', icon: Package2, href: '/saida-direta', show: (f) => f.canManageRequests },
        { name: 'Nova Saída', icon: ListChecks, href: '/saida-direta/new', show: (f) => f.canManageRequests },
      ],
    },
    {
      title: 'Gestão de Solicitações',
      module: 'shared',
      items: [
        { name: 'Caixa de Entrada', icon: InboxIcon, href: '/requests/inbox', show: (f) => f.canManageRequests },
        { name: 'Em Processamento', icon: CheckSquare, href: '/requests/processing', show: (f) => f.canManageRequests },
        { name: 'Histórico', icon: History, href: '/requests/history', show: (f) => f.canManageRequests },
        { name: 'Pendências', icon: AlertCircle, href: '/requests/pending', show: (f) => f.canManageRequests },
        { name: 'Confirmação de Recebimento', icon: PackageCheck, href: '/requests/receipt-confirmation', show: (f) => f.canManageRequests },
      ],
    },
    {
      title: 'Estoques',
      module: 'farmacia',
      items: [
        { name: 'CAF', icon: Building2, href: '/inventory/stock/42c3b239-c354-4b5b-a2eb-d42b7a9edc10', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
        { name: 'Satélite 1', icon: Pill, href: '/inventory/stock/fa96acab-9065-44ee-aeae-b87c5af8110a', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
        { name: 'Satélite 2', icon: Pill, href: '/inventory/stock/cf2d0681-0cdd-48b4-9431-73c09e853048', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
        { name: 'Satélite T', icon: Pill, href: '/inventory/stock/6f3fdf99-829a-46bb-b354-19a44fa36324', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
      ],
    },
    {
      title: 'Estoque',
      module: 'almoxarifado',
      items: [
        { name: 'Almoxarifado', icon: Package2, href: '/inventory/warehouse', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
      ],
    },
    {
      title: 'Operações de Estoque',
      module: 'shared',
      items: [
        { name: 'Quebras e Avarias', icon: PackageMinus, href: '/estoque/saida-avulsa', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
        { name: 'Devoluções', icon: Undo2, href: '/estoque/devolucao', show: () => true },
        { name: 'Empréstimos', icon: Handshake, href: '/estoque/emprestimos', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
        { name: 'Vencimentos', icon: CalendarX, href: '/estoque/vencimentos', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
      ],
    },
    {
      title: 'Relatórios',
      module: 'farmacia',
      items: [
        { name: 'Estoque - Farmácia', icon: Pill, href: '/reports/pharmacy-stock', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
        { name: 'Consumo - Farmácia', icon: BarChart3, href: '/reports/pharmacy-consumption', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
        { name: 'Gestão Consumo - Farmácia', icon: FileText, href: '/reports/pharmacy-admin-consumption', show: (f) => f.isAdmin },
        { name: 'Farmácia (Multi-Estoque)', icon: BarChart3, href: '/reports/farmacia-multi-estoque', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
      ],
    },
    {
      title: 'Relatórios',
      module: 'almoxarifado',
      items: [
        { name: 'Estoque - Almoxarifado', icon: Package2, href: '/reports/warehouse-stock', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
        { name: 'Consumo - Almoxarifado', icon: BarChart3, href: '/reports/warehouse-consumption', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
        { name: 'Gestão Consumo - Almoxarifado', icon: FileText, href: '/reports/warehouse-admin-consumption', show: (f) => f.isAdmin },
      ],
    },
    {
      title: 'Relatórios',
      module: 'shared',
      items: [
        { name: 'Validade de Estoque', icon: CalendarClock, href: '/reports/stock-expiry', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
        { name: 'Movimentações e Consumo', icon: BarChart3, href: '/reports/movimentacoes', show: (f) => f.isManager || f.isAdmin || f.isAtendente },
      ],
    },
    {
      title: 'Administração',
      module: 'admin',
      items: [
        { name: 'Usuários', icon: Users, href: '/users-advanced', show: (f) => f.isAdmin },
        {
          name: 'Tabelas', icon: Database, href: '/tables', show: (f) => f.isAdmin,
          submenu: [{ name: 'Setores', href: '/tables/departments', icon: Building2 }],
        },
      ],
    },
    {
      title: 'Configurações',
      module: 'shared',
      items: [
        { name: 'Meu Perfil', icon: UserCircle, href: '/profile', show: () => true },
        { name: 'Configurações', icon: Settings, href: '/settings', show: (f) => !f.isEnfermagem },
      ],
    },
  ]
}
