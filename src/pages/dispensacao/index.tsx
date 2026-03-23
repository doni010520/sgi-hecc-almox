import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/theme'
import { Plus, Search, Calendar, RefreshCw, XCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { pharmacyDispensationService } from '@/lib/services/pharmacy-dispensation'
import type { PharmacyDispensation } from '@/lib/types/dispensation'

export function DispensationList() {
  const navigate = useNavigate()
  const { mode } = useTheme()
  const [dispensations, setDispensations] = useState<PharmacyDispensation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const txt = mode === 'dark' ? '#fff' : '#0d2e1c'
  const txtSec = mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(13,46,28,0.65)'
  const txtMut = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(13,46,28,0.45)'

  const glass: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(10,15,20,0.55)' : 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
    borderRadius: 16,
    transition: 'background 0.4s, border-color 0.4s',
  }

  const inputStyle: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 10, padding: '8px 12px', fontSize: 14,
    color: txt, outline: 'none',
  }

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await pharmacyDispensationService.getAll({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
      })
      setDispensations(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 300)
    return () => clearTimeout(timer)
  }, [search, dateFrom, dateTo])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: txt }}>Dispensacoes</h1>
          <p className="text-sm mt-1" style={{ color: txtSec }}>
            Registro de medicamentos dispensados por prescricao medica
          </p>
        </div>
        <Button
          className="bg-primary-500 hover:bg-primary-600 text-white"
          onClick={() => navigate('/dispensacao/new')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Dispensacao
        </Button>
      </div>

      {/* Filters */}
      <div className="p-4 flex flex-wrap items-center gap-3" style={glass}>
        <div className="relative flex-1 min-w-[250px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
          <input
            type="text"
            placeholder="Buscar por paciente, prontuario, medico, prescricao..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 34, width: '100%' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: txtMut }} />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          <span style={{ color: txtMut, fontSize: 12 }}>ate</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        </div>
        <button onClick={loadData} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
          background: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
          border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
          color: txt,
        }}><RefreshCw size={16} /></button>
      </div>

      {/* Table */}
      <div style={glass} className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
              {['N\u00ba', 'Data', 'Paciente', 'Prontuario', 'Medico', 'Itens', 'Status'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: txtMut }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: txtMut }}>Carregando...</td></tr>
            ) : dispensations.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: txtMut }}>Nenhuma dispensacao encontrada</td></tr>
            ) : (
              dispensations.map((d, i) => (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/dispensacao/${d.id}`)}
                  className="cursor-pointer transition-colors"
                  style={{
                    borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
                    background: i % 2 === 0 ? (mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? (mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent' }}
                >
                  <td className="px-4 py-3 font-bold text-sm" style={{ color: txt }}>#{d.dispensation_number}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: txtSec }}>
                    {format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: txt }}>{d.patient_name}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: txtSec }}>{d.medical_record_number}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: txtSec }}>{d.prescribing_doctor}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: txtSec }}>
                    {d.items.length} {d.items.length === 1 ? 'item' : 'itens'}
                  </td>
                  <td className="px-4 py-3">
                    {d.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle2 size={12} /> Concluida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle size={12} /> Cancelada
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm" style={{ color: txtMut }}>
        {dispensations.length} dispensacao(oes) encontrada(s)
      </div>
    </div>
  )
}
