// =====================================================================
// Controle de Talidomida
// Portaria SVS/MS 344/98 — Anexo IV — FASE 12 do redesenho da Farmácia
// =====================================================================

import { useEffect, useState, useMemo } from 'react'
import {
  AlertOctagon, Plus, Printer, Search, Loader2, AlertCircle, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/theme'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/utils/error-messages'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TalidomidaNotification {
  id: string
  data_dispensacao: string
  paciente_nome: string
  prontuario: string
  data_nascimento: string | null
  sexo: 'M' | 'F' | null
  cpf: string | null
  cid10: string | null
  diagnostico: string | null
  nome_responsavel: string | null
  numero_notificacao: string
  quantidade_comprimidos: number
  lote: string | null
  validade: string | null
  prescriber_nome: string | null
  prescriber_crm: string | null
  termo_responsabilidade: boolean
  observacoes: string | null
  created_at: string
}

type FormData = Omit<TalidomidaNotification, 'id' | 'created_at'>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR')
}

function blankForm(): FormData {
  return {
    data_dispensacao: new Date().toISOString().slice(0, 10),
    paciente_nome: '',
    prontuario: '',
    data_nascimento: '',
    sexo: null,
    cpf: '',
    cid10: '',
    diagnostico: '',
    nome_responsavel: '',
    numero_notificacao: '',
    quantidade_comprimidos: 0,
    lote: '',
    validade: '',
    prescriber_nome: '',
    prescriber_crm: '',
    termo_responsabilidade: false,
    observacoes: '',
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function Talidomida() {
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

  const [rows, setRows]       = useState<TalidomidaNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]       = useState<FormData>(blankForm())
  const [saving, setSaving]   = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const { data, error: err } = await supabase
        .from('talidomida_notifications')
        .select('*')
        .order('data_dispensacao', { ascending: false })
      if (err) throw err
      setRows((data || []) as TalidomidaNotification[])
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.paciente_nome.toLowerCase().includes(q) ||
      r.prontuario.toLowerCase().includes(q) ||
      r.numero_notificacao.toLowerCase().includes(q) ||
      (r.prescriber_nome || '').toLowerCase().includes(q)
    )
  }, [rows, search])

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function openNew() {
    setForm(blankForm()); setFormError(''); setShowModal(true)
  }

  async function save() {
    if (!form.paciente_nome.trim()) { setFormError('Nome do paciente é obrigatório'); return }
    if (!form.prontuario.trim())    { setFormError('Prontuário é obrigatório'); return }
    if (!form.numero_notificacao.trim()) { setFormError('Número da notificação é obrigatório'); return }
    // RDC 11/2011: idade, sexo e CID são exigidos pra identificação do paciente em risco teratogênico
    if (!form.data_nascimento)      { setFormError('Data de nascimento é obrigatória (RDC 11/2011)'); return }
    if (!form.sexo)                 { setFormError('Sexo é obrigatório (RDC 11/2011 — risco teratogênico)'); return }
    if (!form.cid10?.trim())        { setFormError('CID-10 é obrigatório (RDC 11/2011 — indicação clínica)'); return }
    if (!form.prescriber_nome?.trim()) { setFormError('Nome do prescritor é obrigatório'); return }
    if (!form.prescriber_crm?.trim())  { setFormError('CRM do prescritor é obrigatório'); return }
    if (!form.lote?.trim())         { setFormError('Lote é obrigatório (rastreabilidade)'); return }
    if (!form.validade)             { setFormError('Validade do lote é obrigatória'); return }
    // Mulher em idade fértil (12-50) exige justificativa/contracepção
    if (form.sexo === 'F' && form.data_nascimento) {
      const idade = Math.floor((Date.now() - new Date(form.data_nascimento).getTime()) / (365.25 * 86400000))
      if (idade >= 12 && idade < 50 && !form.observacoes?.trim()) {
        setFormError('Para paciente do sexo feminino em idade fértil (12-50 anos), as observações devem registrar o método contraceptivo e/ou justificativa clínica (RDC 11/2011)'); return
      }
    }
    if (!form.quantidade_comprimidos || form.quantidade_comprimidos <= 0) {
      setFormError('Quantidade de comprimidos deve ser maior que zero'); return
    }
    if (!form.termo_responsabilidade) {
      setFormError('O Termo de Responsabilidade deve ser confirmado'); return
    }
    setSaving(true); setFormError('')
    try {
      const { data: authData } = await supabase.auth.getUser()
      const { error: err } = await supabase.from('talidomida_notifications').insert({
        ...form,
        cpf: form.cpf || null,
        data_nascimento: form.data_nascimento || null,
        sexo: form.sexo || null,
        cid10: form.cid10 || null,
        diagnostico: form.diagnostico || null,
        nome_responsavel: form.nome_responsavel || null,
        lote: form.lote || null,
        validade: form.validade || null,
        prescriber_nome: form.prescriber_nome || null,
        prescriber_crm: form.prescriber_crm || null,
        observacoes: form.observacoes || null,
        created_by: authData?.user?.id ?? null,
      })
      if (err) throw err
      setShowModal(false)
      await load()
    } catch (e: any) {
      setFormError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // Print livro de talidomida
  function handlePrint() {
    const dataRows = rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${fmtDate(r.data_dispensacao)}</td>
        <td>${r.numero_notificacao}</td>
        <td>${r.paciente_nome}</td>
        <td>${r.prontuario}</td>
        <td>${r.sexo ?? '—'}</td>
        <td>${r.cid10 ?? '—'}</td>
        <td>${r.diagnostico ?? '—'}</td>
        <td>${r.quantidade_comprimidos}</td>
        <td>${r.lote ?? '—'}</td>
        <td>${fmtDate(r.validade)}</td>
        <td>${r.prescriber_nome ?? '—'} ${r.prescriber_crm ? '(CRM ' + r.prescriber_crm + ')' : ''}</td>
        <td>${r.termo_responsabilidade ? 'Sim' : 'Não'}</td>
      </tr>
    `).join('')

    const html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Livro de Notificação de Talidomida</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; padding: 20px; color: #000; }
          h1 { font-size: 13px; text-align: center; margin: 0 0 4px; }
          h2 { font-size: 11px; text-align: center; margin: 0 0 8px; }
          p.meta { font-size: 9px; text-align: center; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 9px; }
          th { background: #f0f0f0; padding: 3px 5px; border: 1px solid #ccc; text-align: left; }
          td { padding: 3px 5px; border: 1px solid #ddd; vertical-align: top; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .footer { margin-top: 24px; font-size: 9px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>HOSPITAL ESTADUAL COSTA DAS COQUEIROS — HECC</h1>
        <h2>LIVRO DE NOTIFICAÇÃO DE TALIDOMIDA</h2>
        <p class="meta">Portaria SVS/MS 344/98 — Anexo IV · Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
        <table>
          <thead>
            <tr>
              <th>Nº</th><th>Data</th><th>Nº Notif.</th><th>Paciente</th><th>Prontuário</th>
              <th>Sexo</th><th>CID-10</th><th>Diagnóstico</th><th>Comprimidos</th>
              <th>Lote</th><th>Validade</th><th>Prescritor</th><th>Termo</th>
            </tr>
          </thead>
          <tbody>
            ${dataRows || '<tr><td colspan="13" style="text-align:center;padding:10px">Sem registros</td></tr>'}
          </tbody>
        </table>
        <div class="footer">
          <p>_________________________________________ &nbsp;&nbsp; _______________________________</p>
          <p>Responsável Técnico — CRF &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Data</p>
        </div>
      </body>
      </html>
    `
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 500)
  }

  // ----- Render -----
  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-red-100">
            <AlertOctagon className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: txt }}>Controle de Talidomida</h1>
            <p className="text-sm" style={{ color: txtSec }}>
              Portaria SVS/MS 344/98 — Anexo IV · Livro de Notificação de Dispensação
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir Livro
          </Button>
          <Button onClick={openNew} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Nova Notificação
          </Button>
        </div>
      </div>

      {/* Alerta legal */}
      <div className="p-4 rounded-xl flex items-start gap-3"
        style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
        <AlertOctagon className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
        <p className="text-sm" style={{ color: txt }}>
          <strong>Atenção:</strong> A dispensação de talidomida exige notificação obrigatória e
          assinatura do Termo de Responsabilidade. Proibida para mulheres em idade fértil sem
          anticoncepcional e gestantes. Portaria 344/98 — Subst. Sujeitas a Controle Especial.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-100 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Busca */}
      <div className="p-4" style={card}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: txtMut }} />
          <input
            placeholder="Buscar por paciente, prontuário ou nº de notificação..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inp, paddingLeft: 34 }}
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto" style={card}>
        {loading ? (
          <div className="flex items-center justify-center p-12" style={{ color: txtMut }}>
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-sm text-center" style={{ color: txtMut }}>
            {search ? 'Nenhum resultado para a busca.' : 'Nenhuma notificação registrada.'}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                {[
                  'Nº Notif.', 'Data', 'Paciente', 'Prontuário', 'CID-10',
                  'Comprimidos', 'Lote', 'Prescritor', 'Termo', 'Observações'
                ].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase whitespace-nowrap"
                    style={{ color: txtSec }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}
                  style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}` }}>
                  <td className="px-3 py-3 font-mono text-xs font-medium" style={{ color: '#ef4444' }}>
                    {r.numero_notificacao}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" style={{ color: txtSec }}>
                    {fmtDate(r.data_dispensacao)}
                  </td>
                  <td className="px-3 py-3" style={{ color: txt }}>
                    <p className="font-medium">{r.paciente_nome}</p>
                    {r.sexo && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${r.sexo === 'F' ? 'bg-pink-50 text-pink-700 border-pink-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {r.sexo === 'F' ? 'Feminino' : 'Masculino'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-sm" style={{ color: txtSec }}>{r.prontuario}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: txtSec }}>{r.cid10 ?? '—'}</td>
                  <td className="px-3 py-3 text-center font-bold" style={{ color: txt }}>
                    {r.quantidade_comprimidos}
                  </td>
                  <td className="px-3 py-3 text-xs font-mono" style={{ color: txtSec }}>
                    {r.lote ?? '—'}
                    {r.validade ? <span className="block">{fmtDate(r.validade)}</span> : null}
                  </td>
                  <td className="px-3 py-3 text-xs" style={{ color: txtSec }}>
                    {r.prescriber_nome ?? '—'}
                    {r.prescriber_crm ? <span className="block opacity-70">CRM {r.prescriber_crm}</span> : null}
                  </td>
                  <td className="px-3 py-3">
                    {r.termo_responsabilidade
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Assinado</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Pendente</span>
                    }
                  </td>
                  <td className="px-3 py-3 text-xs max-w-[150px] truncate" style={{ color: txtMut }}>
                    {r.observacoes ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Nova Notificação */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-2xl my-6 p-6 space-y-5" style={{
            background: mode === 'dark' ? 'rgba(10,15,20,0.97)' : '#fff',
            borderRadius: 18,
            border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
          }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: txt }}>
                Nova Notificação de Talidomida
              </h2>
              <button onClick={() => setShowModal(false)} style={{ color: txtMut }}><X size={18} /></button>
            </div>

            {formError && (
              <div className="p-2 rounded bg-red-100 border border-red-200 text-red-800 text-sm">{formError}</div>
            )}

            {/* Seção Notificação */}
            <SectionTitle label="Dados da Notificação" txt={txt} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Fld label="Nº da Notificação *" style={lbl}>
                <input value={form.numero_notificacao}
                  onChange={e => set('numero_notificacao', e.target.value)} style={inp}
                  placeholder="Ex: NOT-2026-001" />
              </Fld>
              <Fld label="Data da Dispensação *" style={lbl}>
                <input type="date" value={form.data_dispensacao}
                  onChange={e => set('data_dispensacao', e.target.value)} style={inp} />
              </Fld>
            </div>

            {/* Seção Paciente */}
            <div style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, paddingTop: 12 }} />
            <SectionTitle label="Paciente" txt={txt} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Fld label="Nome do Paciente *" style={lbl}>
                <input value={form.paciente_nome}
                  onChange={e => set('paciente_nome', e.target.value)} style={inp} />
              </Fld>
              <Fld label="Prontuário *" style={lbl}>
                <input value={form.prontuario}
                  onChange={e => set('prontuario', e.target.value)} style={inp} />
              </Fld>
              <Fld label="Data de Nascimento" style={lbl}>
                <input type="date" value={form.data_nascimento || ''}
                  onChange={e => set('data_nascimento', e.target.value)} style={inp} />
              </Fld>
              <Fld label="Sexo" style={lbl}>
                <select value={form.sexo || ''} onChange={e => set('sexo', (e.target.value as 'M' | 'F') || null)}
                  style={inp as React.CSSProperties}>
                  <option value="">— selecionar —</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </Fld>
              <Fld label="CPF" style={lbl}>
                <input value={form.cpf || ''}
                  onChange={e => set('cpf', e.target.value)} style={inp} placeholder="000.000.000-00" />
              </Fld>
              <Fld label="Nome do Responsável (menores/incapazes)" style={lbl}>
                <input value={form.nome_responsavel || ''}
                  onChange={e => set('nome_responsavel', e.target.value)} style={inp} />
              </Fld>
            </div>

            {/* Seção Clínica */}
            <div style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, paddingTop: 12 }} />
            <SectionTitle label="Dados Clínicos" txt={txt} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Fld label="CID-10" style={lbl}>
                <input value={form.cid10 || ''}
                  onChange={e => set('cid10', e.target.value)} style={inp} placeholder="Ex: L10.0" />
              </Fld>
              <Fld label="Diagnóstico" style={lbl}>
                <input value={form.diagnostico || ''}
                  onChange={e => set('diagnostico', e.target.value)} style={inp} />
              </Fld>
            </div>

            {/* Seção Medicamento */}
            <div style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, paddingTop: 12 }} />
            <SectionTitle label="Medicamento" txt={txt} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Fld label="Qtde. Comprimidos *" style={lbl}>
                <input type="number" min="1" value={form.quantidade_comprimidos || ''}
                  onChange={e => set('quantidade_comprimidos', parseInt(e.target.value) || 0)} style={inp} />
              </Fld>
              <Fld label="Lote" style={lbl}>
                <input value={form.lote || ''}
                  onChange={e => set('lote', e.target.value)} style={inp} />
              </Fld>
              <Fld label="Validade" style={lbl}>
                <input type="date" value={form.validade || ''}
                  onChange={e => set('validade', e.target.value)} style={inp} />
              </Fld>
            </div>

            {/* Seção Prescritor */}
            <div style={{ borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, paddingTop: 12 }} />
            <SectionTitle label="Prescritor" txt={txt} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Fld label="Nome do Prescritor" style={lbl}>
                <input value={form.prescriber_nome || ''}
                  onChange={e => set('prescriber_nome', e.target.value)} style={inp} />
              </Fld>
              <Fld label="CRM" style={lbl}>
                <input value={form.prescriber_crm || ''}
                  onChange={e => set('prescriber_crm', e.target.value)} style={inp} placeholder="CRM-BA/12345" />
              </Fld>
            </div>

            {/* Observações */}
            <Fld label="Observações" style={lbl}>
              <textarea rows={2} value={form.observacoes || ''}
                onChange={e => set('observacoes', e.target.value)}
                style={{ ...inp, resize: 'vertical' as const }} />
            </Fld>

            {/* Termo de responsabilidade */}
            <div className="p-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.termo_responsabilidade}
                  onChange={e => set('termo_responsabilidade', e.target.checked)}
                  className="mt-1 w-4 h-4 accent-red-600"
                />
                <span className="text-sm" style={{ color: txt }}>
                  <strong>Confirmo</strong> que o paciente/responsável foi orientado sobre os riscos
                  teratogênicos da talidomida, assinou o Termo de Responsabilidade previsto na
                  Portaria 344/98, e a receita está conforme as exigências legais. *
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
                {saving && <Loader2 size={14} className="mr-2 animate-spin" />} Registrar Notificação
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionTitle({ label, txt }: { label: string; txt: string }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: txt }}>{label}</h3>
  )
}

function Fld({ label, style, children }: { label: string; style: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div>
      <label style={style}>{label}</label>
      {children}
    </div>
  )
}
