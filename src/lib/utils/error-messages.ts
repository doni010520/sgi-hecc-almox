// Maps internal/backend error details to safe user-facing messages.
// NEVER expose raw error objects or stack traces to the UI.

const CODE_MAP: Record<string, string> = {
  '23505': 'Este registro já existe no sistema.',
  '23503': 'Operação inválida: registro referenciado em outro cadastro.',
  '23502': 'Campo obrigatório não preenchido.',
  '42501': 'Você não tem permissão para realizar esta operação.',
  'PGRST116': 'Registro não encontrado.',
  'PGRST301': 'Sessão expirada. Faça login novamente.',
}

const MESSAGE_PATTERNS: Array<[RegExp, string]> = [
  [/duplicate key|unique constraint/i, 'Este registro já existe no sistema.'],
  [/foreign key/i, 'Operação inválida: registro referenciado em outro cadastro.'],
  [/not.null constraint/i, 'Campo obrigatório não preenchido.'],
  [/check constraint/i, 'Valor inválido para o campo. Verifique os dados informados.'],
  [/permission denied|insufficient privilege/i, 'Você não tem permissão para realizar esta operação.'],
  [/jwt|token.*expired|pgrst301/i, 'Sessão expirada. Faça login novamente.'],
  [/not found|PGRST116/i, 'Registro não encontrado.'],
  [/network|fetch|conexão/i, 'Erro de conexão. Verifique sua internet e tente novamente.'],
  [/timeout/i, 'O servidor demorou muito para responder. Tente novamente.'],
]

export function getErrorMessage(error: unknown): string {
  if (!error) return 'Erro desconhecido. Tente novamente.'

  // Always log full error server-side for debugging
  console.error('[SGI-HECC]', error)

  const code = (error as any)?.code as string | undefined
  if (code && CODE_MAP[code]) return CODE_MAP[code]

  const raw = (error as any)?.message ?? (error as any)?.error_description ?? ''

  for (const [pattern, msg] of MESSAGE_PATTERNS) {
    if (pattern.test(raw)) return msg
  }

  return 'Ocorreu um erro inesperado. Se o problema persistir, contate o suporte.'
}
