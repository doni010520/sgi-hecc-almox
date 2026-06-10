import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/theme'
import { useAuth } from '@/contexts/auth'
import { ArrowLeft, Clock, CheckCircle2, Loader2, AlertCircle, Pill } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pharmacyDispensationService } from '@/lib/services/pharmacy-dispensation'
import type { PharmacyDispensation } from '@/lib/types/dispensation'

const APPROVAL_ROLES = new Set(['pharmacist', 'gestor', 'administrador'])

function classBadge(cls: string | null | undefined, isMav: boolean | undefined) {
  if (isMav || cls === 'mav') return { label: 'MAV', bg: 'rgba(245,158,11,0.15)', color: '#92400e', border: 'rgba(245,158,11,0.4)' }
  if (cls === 'controlados') return { label: 'Controlado', bg: 'rgba(139,92,246,0.12)', color: '#5b21b6', border: 'rgba(139,92,246,0.35)' }
  if (cls === 'antimicrobianos') return { label: 'Antimicrobiano', bg: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: 'rgba(59,130,246,0.35)' }
  if (cls === 'anticoagulante') return { label: 'Anticoagulante', bg: 'rgba(239,68,68,0.12)', color: '#991b1b', border: 'rgba(239,68,68,0.35)' }
  return null
}

function fmt(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function FilaAprovacaoFarmaceutica() {
  const navigate = useNavigate()
  const { mode } = useTheme()
  const { user } = useAuth()

  const txt = mode === 'dark' ? '#fff' : '#0d2e1c'
  const txtSec = mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(13,46,28,0.65)'
  const txtMut = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(13,46,28,0.45)'

  const card: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(10,15,20,0.55)' : 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
    borderRadius: 16,
  }

  const [list, setList] = useState<PharmacyDispensation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [approving, setApproving] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const canApprove = user?.role ? APPROVAL_ROLES.has(user.role) : false

  async function load() {
    setLoading(true); setError('')
    try {
      setList(await pharmacyDispensationService.getPendingApprovals())
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Erro ao carregar fila')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function handleApprove(id: string) {
    setApproving(id); setError('')
    try {
      await pharmacyDispensationService.approveDispensation(id)
      setConfirmId(null)
      await load()
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Erro ao aprovar dispensação')
    } finally {
      setApproving(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dispensacao')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
            background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
            color: txt,
          }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: txt }}>Fila de Aprovação</h1>
          <p className="text-sm" style={{ color: txtSec }}>Dispensações aguardando aprovação farmacêutica</p>
        </div>
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Clock size={14} className="text-amber-600" />
          <span className="text-sm font-semibold text-amber-700">{list.length} pendente{list.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-100 border border-red-200 flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 flex items-center justify-center gap-3" style={card}>
          <Loader2 size={20} className="animate-spin" style={{ color: txtMut }} />
          <span style={{ color: txtMut }}>Carregando fila...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="p-10 flex flex-col items-center gap-3" style={card}>
          <CheckCircle2 size={40} className="text-emerald-500" />
          <p className="text-lg font-semibold" style={{ color: txt }}>Nenhuma dispensação aguardando aprovação</p>
          <p className="text-sm" style={{ color: txtMut }}>A fila está limpa. Todas as dispensações foram processadas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((d) => (
            <div key={d.id} className="p-5 space-y-4" style={card}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-bold" style={{ color: txt }}>
                    Dispensação #{d.dispensation_number}
                  </p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: txt }}>{d.patient_name}</p>
                  <p className="text-xs" style={{ color: txtSec }}>
                    Prontuário {d.medical_record_number}
                    {d.prescription_date ? ` · Prescrição: ${fmtDate(d.prescription_date)}` : ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: txtMut }}>
                    Criado por {d.created_by_name} · {fmt(d.created_at)}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e', border: '1px solid rgba(245,158,11,0.3)' }}>
                    Aguardando aprovação
                  </span>
                  {canApprove && (
                    <Button
                      size="sm"
                      onClick={() => setConfirmId(d.id)}
                      disabled={approving === d.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      {approving === d.id
                        ? <Loader2 size={13} className="mr-1 animate-spin" />
                        : <CheckCircle2 size={13} className="mr-1" />}
                      Aprovar
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: txtMut }}>
                  Itens que requerem aprovação
                </p>
                {d.items.map((item) => {
                  const badge = classBadge(item.medication_class, item.is_mav)
                  if (!badge) return null
                  return (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg"
                      style={{ background: badge.bg, border: `1px solid ${badge.border}` }}>
                      <Pill size={13} style={{ color: badge.color }} />
                      <span className="text-sm font-medium flex-1" style={{ color: txt }}>{item.item_name}</span>
                      <span className="text-xs" style={{ color: txtSec }}>{item.quantity} {item.item_unit}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                        {badge.label}
                      </span>
                    </div>
                  )
                })}
                {d.items.filter((i) => classBadge(i.medication_class, i.is_mav)).length === 0 && (
                  <p className="text-xs italic" style={{ color: txtMut }}>Todos os itens foram identificados para aprovação.</p>
                )}
              </div>

              <div className="pt-1" style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                <p className="text-xs" style={{ color: txtMut }}>
                  <strong style={{ color: txtSec }}>Prescritor:</strong> {d.prescribing_doctor}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal confirmação de aprovação */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-sm p-6 space-y-4" style={card}>
            <h3 className="text-lg font-bold" style={{ color: txt }}>Confirmar aprovação</h3>
            <p className="text-sm" style={{ color: txtSec }}>
              Confirma a aprovação da dispensação{' '}
              <strong>#{list.find((d) => d.id === confirmId)?.dispensation_number}</strong>?
              O estoque será debitado imediatamente.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmId(null)} disabled={!!approving}>
                Cancelar
              </Button>
              <Button
                onClick={() => handleApprove(confirmId)}
                disabled={!!approving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {approving === confirmId
                  ? <Loader2 size={14} className="mr-2 animate-spin" />
                  : <CheckCircle2 size={14} className="mr-2" />}
                Aprovar dispensação
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
