// =====================================================================
// BMPO — Balanço de Medicamentos Psicoativos
// Portaria SVS/MS 344/98, Art. 64
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardList, Play, Download, Lock, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/theme'
import {
  bmpoService,
  type BalancoRow,
  type BmpoBalanco,
  type BmpoTipo,
} from '@/lib/services/bmpo'
import { getErrorMessage } from '@/lib/utils/error-messages'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmtNum = (n: number | null | undefined) =>
  n == null ? '0' : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR')
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('pt-BR')
  } catch {
    return '—'
  }
}

/** Calcula data_inicio / data_fim (YYYY-MM-DD) a partir da seleção. */
function periodoDatas(tipo: BmpoTipo, ano: number, trimestre: number): { inicio: string; fim: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (tipo === 'anual') {
    return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` }
  }
  // Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
  const startMonth = (trimestre - 1) * 3 + 1
  const endMonth = startMonth + 2
  const lastDay = new Date(ano, endMonth, 0).getDate() // dia 0 do mês seguinte = último dia
  return {
    inicio: `${ano}-${pad(startMonth)}-01`,
    fim: `${ano}-${pad(endMonth)}-${pad(lastDay)}`,
  }
}

function periodoLabel(b: BmpoBalanco): string {
  if (b.tipo === 'anual' || b.trimestre == null) return `Anual ${b.ano}`
  return `${b.ano} · ${b.trimestre}º trimestre`
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function BMPO() {
  const { mode } = useTheme()

  const txt    = mode === 'dark' ? '#fff' : '#0d2e1c'
  const txtSec = mode === 'dark' ? 'rgba(255,255,255,0.7)'  : 'rgba(13,46,28,0.65)'
  const txtMut = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(13,46,28,0.45)'

  const card: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(10,15,20,0.55)' : 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
    borderRadius: 16,
  }
  const inp: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 10, padding: '9px 12px', fontSize: 14,
    color: txt, outline: 'none', width: '100%',
  }
  const lbl: React.CSSProperties = {
    color: txtSec, fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4,
  }

  // ---- Period selector state ----
  const anoAtual = new Date().getFullYear()
  const [tipo, setTipo] = useState<BmpoTipo>('trimestral')
  const [ano, setAno] = useState<number>(anoAtual)
  const [trimestre, setTrimestre] = useState<number>(1)

  const { inicio, fim } = useMemo(
    () => periodoDatas(tipo, ano, trimestre),
    [tipo, ano, trimestre]
  )

  // ---- Computed balanço ----
  const [rows, setRows] = useState<BalancoRow[] | null>(null)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  // ---- Saved balanços ----
  const [saved, setSaved] = useState<BmpoBalanco[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadSaved()
  }, [])

  async function loadSaved() {
    setLoadingSaved(true)
    try {
      setSaved(await bmpoService.getSaved())
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoadingSaved(false)
    }
  }

  // Quando muda o período, invalida o balanço calculado (evita salvar período errado)
  useEffect(() => {
    setRows(null)
    setOkMsg('')
  }, [tipo, ano, trimestre])

  async function gerar() {
    setComputing(true); setError(''); setOkMsg('')
    try {
      const result = await bmpoService.computeBalanco(inicio, fim)
      setRows(result)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setComputing(false)
    }
  }

  function exportXLSX() {
    if (!rows || rows.length === 0) return
    const headers = [
      'Item', 'Lista', 'Estoque anterior', 'Entradas', 'Saídas', 'Perdas', 'Saldo final',
    ]
    const body = rows.map((r) => [
      r.item_nome,
      r.lista,
      r.estoque_anterior,
      r.entradas,
      r.saidas,
      r.perdas,
      r.saldo_final,
    ])
    const data = [headers, ...body]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [
      { wch: 40 }, { wch: 10 }, { wch: 16 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'BMPO')

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true })
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const periodo = tipo === 'anual' ? `${ano}` : `${ano}-T${trimestre}`
    saveAs(blob, `bmpo_${periodo}.xlsx`)
  }

  async function fechar() {
    if (!rows || rows.length === 0) return
    const periodoTxt = tipo === 'anual' ? `Anual ${ano}` : `${trimestre}º trimestre de ${ano}`
    if (!window.confirm(
      `Fechar e salvar o balanço (${periodoTxt})? ` +
      `O snapshot ficará registrado e não poderá ser alterado.`
    )) return

    setSaving(true); setError(''); setOkMsg('')
    try {
      await bmpoService.saveBalanco({
        tipo,
        ano,
        trimestre: tipo === 'anual' ? null : trimestre,
        lista: 'todas',
        data_inicio: inicio,
        data_fim: fim,
        dados: rows,
        observacao: null,
      })
      setOkMsg('Balanço fechado e salvo com sucesso.')
      await loadSaved()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // Totais do balanço calculado
  const totais = useMemo(() => {
    const t = { estoque_anterior: 0, entradas: 0, saidas: 0, perdas: 0, saldo_final: 0 }
    if (rows) {
      for (const r of rows) {
        t.estoque_anterior += r.estoque_anterior
        t.entradas += r.entradas
        t.saidas += r.saidas
        t.perdas += r.perdas
        t.saldo_final += r.saldo_final
      }
    }
    return t
  }, [rows])

  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-teal-100">
          <ClipboardList className="w-6 h-6 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: txt }}>
            BMPO — Balanço de Medicamentos Psicoativos
          </h1>
          <p className="text-sm" style={{ color: txtSec }}>
            Portaria SVS/MS 344/98, Art. 64 — balanço periódico de substâncias controladas
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-100 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {okMsg && (
        <div className="p-3 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {okMsg}
        </div>
      )}

      {/* Period selector */}
      <div className="p-4 space-y-4" style={card}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <label style={lbl}>Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as BmpoTipo)}
              style={inp as React.CSSProperties}
            >
              <option value="trimestral">Trimestral</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Ano</label>
            <input
              type="number"
              min="2000"
              max="2100"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value) || anoAtual)}
              style={inp}
            />
          </div>
          {tipo === 'trimestral' && (
            <div>
              <label style={lbl}>Trimestre</label>
              <select
                value={trimestre}
                onChange={(e) => setTrimestre(Number(e.target.value))}
                style={inp as React.CSSProperties}
              >
                <option value={1}>1º (Jan–Mar)</option>
                <option value={2}>2º (Abr–Jun)</option>
                <option value={3}>3º (Jul–Set)</option>
                <option value={4}>4º (Out–Dez)</option>
              </select>
            </div>
          )}
          <div>
            <label style={lbl}>Período</label>
            <div className="text-sm font-medium" style={{ color: txtSec, padding: '9px 0' }}>
              {fmtDate(inicio)} — {fmtDate(fim)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={exportXLSX}
            disabled={!rows || rows.length === 0}
          >
            <Download className="w-4 h-4 mr-2" /> Exportar XLSX
          </Button>
          <Button
            variant="outline"
            onClick={fechar}
            disabled={saving || !rows || rows.length === 0}
            className="border-teal-300 text-teal-700 hover:bg-teal-50"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
            Fechar Balanço
          </Button>
          <Button
            onClick={gerar}
            disabled={computing}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {computing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Gerar Balanço
          </Button>
        </div>
      </div>

      {/* Computed balanço table */}
      <div style={card}>
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: txtSec }}>
            Balanço calculado
          </h2>
          {rows && (
            <span className="text-xs" style={{ color: txtMut }}>
              {rows.length} item(ns) controlado(s)
            </span>
          )}
        </div>

        {computing ? (
          <div className="flex items-center justify-center p-12" style={{ color: txtMut }}>
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calculando balanço...
          </div>
        ) : rows == null ? (
          <p className="p-10 text-sm text-center" style={{ color: txtMut }}>
            Selecione o período e clique em "Gerar Balanço".
          </p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-sm text-center" style={{ color: txtMut }}>
            Nenhum medicamento controlado encontrado no período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                  {['Item', 'Lista', 'Estoque ant.', 'Entradas', 'Saídas', 'Perdas', 'Saldo final'].map((h, i) => (
                    <th key={h}
                      className={`px-3 py-3 text-xs font-semibold uppercase whitespace-nowrap ${i >= 2 ? 'text-right' : 'text-left'}`}
                      style={{ color: txtSec }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.item_id}
                    style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}` }}>
                    <td className="px-3 py-2 font-medium" style={{ color: txt }}>{r.item_nome}</td>
                    <td className="px-3 py-2" style={{ color: txtSec }}>{r.lista}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: txtSec }}>{fmtNum(r.estoque_anterior)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: '#10b981' }}>{fmtNum(r.entradas)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: '#ef4444' }}>{fmtNum(r.saidas)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: '#f59e0b' }}>{fmtNum(r.perdas)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: txt }}>{fmtNum(r.saldo_final)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{
                  borderTop: `2px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                  background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                }}>
                  <td className="px-3 py-2 font-bold uppercase text-xs" style={{ color: txt }} colSpan={2}>Total</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: txt }}>{fmtNum(totais.estoque_anterior)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: txt }}>{fmtNum(totais.entradas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: txt }}>{fmtNum(totais.saidas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: txt }}>{fmtNum(totais.perdas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: txt }}>{fmtNum(totais.saldo_final)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Saved balanços */}
      <div style={card}>
        <div className="px-4 py-3"
          style={{ borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: txtSec }}>
            Balanços salvos
          </h2>
        </div>

        {loadingSaved ? (
          <div className="flex items-center justify-center p-10" style={{ color: txtMut }}>
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : saved.length === 0 ? (
          <p className="p-10 text-sm text-center" style={{ color: txtMut }}>
            Nenhum balanço fechado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                  {['Tipo', 'Período', 'Lista', 'Status', 'Gerado em'].map((h) => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase whitespace-nowrap"
                      style={{ color: txtSec }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {saved.map((b) => (
                  <tr key={b.id}
                    style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}` }}>
                    <td className="px-3 py-2 capitalize" style={{ color: txt }}>{b.tipo}</td>
                    <td className="px-3 py-2" style={{ color: txtSec }}>
                      {periodoLabel(b)}
                      <span className="block text-xs" style={{ color: txtMut }}>
                        {fmtDate(b.data_inicio)} — {fmtDate(b.data_fim)}
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ color: txtSec }}>{b.lista || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border bg-gray-100 text-gray-600 border-gray-200">
                        {b.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: txtSec }}>{fmtDateTime(b.gerado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
