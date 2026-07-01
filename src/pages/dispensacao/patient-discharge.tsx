import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTheme } from '@/contexts/theme'
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Heart, Skull } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/utils/error-messages'
import { format } from 'date-fns'

import { ActiveStockBadge } from '@/components/active-stock-badge'
type DischargeReason = 'alta' | 'obito'

export function PatientDischarge() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { mode } = useTheme()

  const txt = mode === 'dark' ? '#fff' : '#0d2e1c'
  const txtSec = mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(13,46,28,0.65)'

  const glass: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(10,15,20,0.55)' : 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
    borderRadius: 16,
  }

  const inputStyle: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 10, padding: '10px 14px', fontSize: 14,
    color: txt, outline: 'none', width: '100%',
  }

  const labelStyle: React.CSSProperties = {
    color: txtSec, fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block'
  }

  const [dischargeDate, setDischargeDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [reason, setReason] = useState<DischargeReason | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    if (!reason || !dischargeDate) {
      setError('Preencha a data e o motivo da saída.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          discharge_date: dischargeDate,
          discharge_reason: reason,
        })
        .eq('id', id)
      if (error) throw error
      setSuccess(true)
      setTimeout(() => navigate('/dispensacao'), 1500)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center space-y-4">
        <div className="flex justify-center">
          <div style={{
            width: 64, height: 64, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(22,163,74,0.1)',
          }}>
            <CheckCircle2 size={32} style={{ color: '#16a34a' }} />
          </div>
        </div>
        <h2 className="text-xl font-bold" style={{ color: txt }}>Saída registrada com sucesso</h2>
        <p className="text-sm" style={{ color: txtSec }}>Redirecionando...</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
            background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
            color: txt,
          }}
        ><ArrowLeft size={18} /></button>
        <div>
          <h1 className="inline-flex items-center gap-2 flex-wrap text-2xl font-bold" style={{ color: txt }}>Registrar Saída <ActiveStockBadge /></h1>
          <p className="text-sm" style={{ color: txtSec }}>Alta ou óbito do paciente</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-100 border border-red-200 flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="p-6 space-y-6" style={glass}>
        {/* Data da saída */}
        <div>
          <label style={labelStyle}>Data da Saída *</label>
          <input
            type="date"
            value={dischargeDate}
            onChange={e => setDischargeDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Motivo */}
        <div>
          <label style={labelStyle}>Motivo *</label>
          <div className="grid grid-cols-2 gap-4 mt-1">
            {/* Alta */}
            <button
              onClick={() => setReason('alta')}
              style={{
                padding: '20px 16px',
                borderRadius: 12,
                border: `2px solid ${reason === 'alta' ? '#16a34a' : (mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                background: reason === 'alta'
                  ? 'rgba(22,163,74,0.1)'
                  : (mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: reason === 'alta' ? 'rgba(22,163,74,0.15)' : (mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
              }}>
                <Heart size={22} style={{ color: reason === 'alta' ? '#16a34a' : txtSec }} />
              </div>
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: reason === 'alta' ? '#16a34a' : txt,
              }}>Alta</span>
              <span style={{ fontSize: 12, color: txtSec, textAlign: 'center' }}>
                Paciente recebeu alta médica
              </span>
            </button>

            {/* Óbito */}
            <button
              onClick={() => setReason('obito')}
              style={{
                padding: '20px 16px',
                borderRadius: 12,
                border: `2px solid ${reason === 'obito' ? '#6b7280' : (mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                background: reason === 'obito'
                  ? 'rgba(107,114,128,0.1)'
                  : (mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: reason === 'obito' ? 'rgba(107,114,128,0.15)' : (mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
              }}>
                <Skull size={22} style={{ color: reason === 'obito' ? '#6b7280' : txtSec }} />
              </div>
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: reason === 'obito' ? '#6b7280' : txt,
              }}>Óbito</span>
              <span style={{ fontSize: 12, color: txtSec, textAlign: 'center' }}>
                Registro de falecimento
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || !reason || !dischargeDate}
          style={{
            background: reason === 'obito' ? '#6b7280' : '#16a34a',
            color: '#fff',
            opacity: (!reason || !dischargeDate) ? 0.5 : 1,
          }}
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin mr-2" /> Registrando...</>
            : 'Confirmar Saída'
          }
        </Button>
      </div>
    </div>
  )
}
