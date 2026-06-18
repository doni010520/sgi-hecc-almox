import { supabase } from '../supabase'

export type StatusAntimicrobiano = 'em_uso' | 'suspenso' | 'concluido'
export type StatusPaciente = 'internado' | 'alta' | 'obito'
export type CcihParecer = 'Aprovado' | 'Recusado' | 'Aguardando'
export type Via = 'IV' | 'VO' | 'IM' | 'SC' | 'Tópico'

export interface AntimicrobialControl {
  id: string
  // Paciente
  paciente_nome: string
  prontuario: string
  setor_leito: string | null
  data_internacao: string | null
  dias_internacao: number | null
  status_paciente: StatusPaciente | null
  data_alta_obito: string | null
  // Antibiótico
  pharmacy_item_id: string | null
  atb_nome: string | null
  via: Via | null
  indicacao: string | null
  justificativa: string | null
  origem_infeccao: string | null
  dose: string | null
  posologia: string | null
  // Tratamento
  tempo_previsto_dias: number | null
  data_inicio: string
  data_final_prevista: string | null
  data_final: string | null
  dias_em_uso: number | null
  status_antimicrobiano: StatusAntimicrobiano
  // CCIH
  ccih_data_avaliacao: string | null
  ccih_parecer: CcihParecer | null
  ccih_observacao: string | null
  // Misc
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string | null
}

export interface CreateAntimicrobialData {
  paciente_nome: string
  prontuario: string
  setor_leito?: string | null
  data_internacao?: string | null
  dias_internacao?: number | null
  status_paciente?: StatusPaciente | null
  data_alta_obito?: string | null
  pharmacy_item_id?: string | null
  atb_nome?: string | null
  via?: Via | null
  indicacao?: string | null
  justificativa?: string | null
  origem_infeccao?: string | null
  dose?: string | null
  posologia?: string | null
  tempo_previsto_dias?: number | null
  data_inicio: string
  data_final_prevista?: string | null
  data_final?: string | null
  dias_em_uso?: number | null
  status_antimicrobiano?: StatusAntimicrobiano
  ccih_data_avaliacao?: string | null
  ccih_parecer?: CcihParecer | null
  ccih_observacao?: string | null
  observacoes?: string | null
}

export type UpdateAntimicrobialData = Partial<CreateAntimicrobialData>

class AntimicrobialControlsService {
  private static instance: AntimicrobialControlsService
  static getInstance() {
    if (!AntimicrobialControlsService.instance) {
      AntimicrobialControlsService.instance = new AntimicrobialControlsService()
    }
    return AntimicrobialControlsService.instance
  }

  async getAll(): Promise<AntimicrobialControl[]> {
    const { data, error } = await supabase
      .from('antimicrobial_controls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Error listing antimicrobial controls:', error)
      throw new Error(error.message)
    }

    return (data || []) as AntimicrobialControl[]
  }

  async create(payload: CreateAntimicrobialData): Promise<AntimicrobialControl> {
    const { data: authData } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('antimicrobial_controls')
      .insert({
        paciente_nome: payload.paciente_nome.trim(),
        prontuario: payload.prontuario.trim(),
        setor_leito: payload.setor_leito?.trim() || null,
        data_internacao: payload.data_internacao || null,
        dias_internacao: payload.dias_internacao ?? null,
        status_paciente: payload.status_paciente || null,
        data_alta_obito: payload.data_alta_obito || null,
        pharmacy_item_id: payload.pharmacy_item_id || null,
        atb_nome: payload.atb_nome?.trim() || null,
        via: payload.via || null,
        indicacao: payload.indicacao?.trim() || null,
        justificativa: payload.justificativa?.trim() || null,
        origem_infeccao: payload.origem_infeccao?.trim() || null,
        dose: payload.dose?.trim() || null,
        posologia: payload.posologia?.trim() || null,
        tempo_previsto_dias: payload.tempo_previsto_dias ?? null,
        data_inicio: payload.data_inicio,
        data_final_prevista: payload.data_final_prevista || null,
        data_final: payload.data_final || null,
        dias_em_uso: payload.dias_em_uso ?? null,
        status_antimicrobiano: payload.status_antimicrobiano || 'em_uso',
        ccih_data_avaliacao: payload.ccih_data_avaliacao || null,
        ccih_parecer: payload.ccih_parecer || null,
        ccih_observacao: payload.ccih_observacao?.trim() || null,
        observacoes: payload.observacoes?.trim() || null,
        created_by: authData?.user?.id || null,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating antimicrobial control:', error)
      throw new Error(error.message)
    }

    return data as AntimicrobialControl
  }

  async update(id: string, payload: UpdateAntimicrobialData): Promise<AntimicrobialControl> {
    const patch: Record<string, unknown> = {}

    if (payload.paciente_nome !== undefined) patch.paciente_nome = payload.paciente_nome.trim()
    if (payload.prontuario !== undefined) patch.prontuario = payload.prontuario.trim()
    if (payload.setor_leito !== undefined) patch.setor_leito = payload.setor_leito?.trim() || null
    if (payload.data_internacao !== undefined) patch.data_internacao = payload.data_internacao || null
    if (payload.dias_internacao !== undefined) patch.dias_internacao = payload.dias_internacao ?? null
    if (payload.status_paciente !== undefined) patch.status_paciente = payload.status_paciente || null
    if (payload.data_alta_obito !== undefined) patch.data_alta_obito = payload.data_alta_obito || null
    if (payload.pharmacy_item_id !== undefined) patch.pharmacy_item_id = payload.pharmacy_item_id || null
    if (payload.atb_nome !== undefined) patch.atb_nome = payload.atb_nome?.trim() || null
    if (payload.via !== undefined) patch.via = payload.via || null
    if (payload.indicacao !== undefined) patch.indicacao = payload.indicacao?.trim() || null
    if (payload.justificativa !== undefined) patch.justificativa = payload.justificativa?.trim() || null
    if (payload.origem_infeccao !== undefined) patch.origem_infeccao = payload.origem_infeccao?.trim() || null
    if (payload.dose !== undefined) patch.dose = payload.dose?.trim() || null
    if (payload.posologia !== undefined) patch.posologia = payload.posologia?.trim() || null
    if (payload.tempo_previsto_dias !== undefined) patch.tempo_previsto_dias = payload.tempo_previsto_dias ?? null
    if (payload.data_inicio !== undefined) patch.data_inicio = payload.data_inicio
    if (payload.data_final_prevista !== undefined) patch.data_final_prevista = payload.data_final_prevista || null
    if (payload.data_final !== undefined) patch.data_final = payload.data_final || null
    if (payload.dias_em_uso !== undefined) patch.dias_em_uso = payload.dias_em_uso ?? null
    if (payload.status_antimicrobiano !== undefined) patch.status_antimicrobiano = payload.status_antimicrobiano
    if (payload.ccih_data_avaliacao !== undefined) patch.ccih_data_avaliacao = payload.ccih_data_avaliacao || null
    if (payload.ccih_parecer !== undefined) patch.ccih_parecer = payload.ccih_parecer || null
    if (payload.ccih_observacao !== undefined) patch.ccih_observacao = payload.ccih_observacao?.trim() || null
    if (payload.observacoes !== undefined) patch.observacoes = payload.observacoes?.trim() || null

    const { data, error } = await supabase
      .from('antimicrobial_controls')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating antimicrobial control:', error)
      throw new Error(error.message)
    }

    return data as AntimicrobialControl
  }
}

export const antimicrobialControlsService = AntimicrobialControlsService.getInstance()
