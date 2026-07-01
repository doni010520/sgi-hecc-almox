# Plano de Execução — Farmácia SGI-HECC v2

> Spec autoritativa. Executar via Workflow multi-agente. Build com `npm run build`,
> commit, e **push para os DOIS remotes**: `git push origin main && git push vercel main`.
> (Vercel deploya do remote `vercel` = sgihecc-hue/almoxarifado.)
> NÃO rodar preview local — verificação é via deploy Vercel.
> NUNCA quebrar o fluxo do almoxarifado.

## Decisões travadas
- **B1 (UF):** usar as 27 UFs padrão do Brasil (frontend). ⚠️ AJUSTAR DEPOIS se necessário.
- **B2 (motivos de devolução):** enum provisório → `melhora_clinica`, `suspensao_medica`,
  `erro_dispensacao`, `alta_paciente`, `obito`, `troca_terapeutica`, `outro`. ⚠️ AJUSTAR DEPOIS.
- **B3 (justificativa na solicitação):** exigir apenas para `controlados` + `antimicrobianos`. ⚠️ AJUSTAR DEPOIS.
- **Talidomida:** fluxo COMPLETO (RDC 11/2011).
- Critério da fila de aprovação de dispensação: **apenas antibiótico + controlado** (remover MAV/anticoagulante do gatilho).

---

## FASE 1 — Migration de banco (G2) [fundação]

Aplicar via `mcp__supabase__apply_migration` nome `g2_farmacia_v2`.

### 1.1 Cadastros
- `patients`: ADD `endereco text`.
- `pharmacy_items`:
  - ADD `dcb text` (Denominação Comum Brasileira) ⚠️ recatalogação manual depois.
  - ADD `nome_comercial text`.
  - ADD `requires_justification boolean DEFAULT false`.
  - ADD `is_talidomida boolean DEFAULT false`.
- `controlled_subclass` enum: ADD valor `C5`.

### 1.2 Escrituração de controlados (Portaria 344/737)
- `stock_movements`: ADD
  - `notificacao_receita_tipo text` (amarela_A | azul_B | branca | null)
  - `notificacao_receita_numero text`
  - `historico text` (prontuário/prescrição + nº NF — Art. 7c)
  - `livro_seq integer` (numeração sequencial por lista)
- Tabela `livros_controlados`:
  `id uuid pk, lista text, termo_abertura_data date, termo_abertura_by uuid,
   termo_encerramento_data date, termo_encerramento_by uuid, status text DEFAULT 'aberto',
   folhas integer, cnpj text, razao_social text, created_at timestamptz DEFAULT now()`
- Função/trigger para preencher `livro_seq` sequencial por lista quando movimento é de item controlado.

### 1.3 Talidomida (RDC 11/2011) — completo
- Tabela `talidomida_notifications`:
  `id, dispensation_id uuid, data_dispensacao date, paciente_nome text, paciente_idade int,
   paciente_sexo text, cid text, quantidade_comprimidos int, medico_nome text, medico_crm text,
   tecnico_responsavel_id uuid, termo_responsabilidade_paciente boolean DEFAULT false,
   created_at timestamptz DEFAULT now()`
- Retenção 10 anos (ledger imutável já garante; documentar não-expurgo).

### 1.4 Antimicrobianos (livro próprio — Anexo I + RDC 471/2021)
- Tabela `antimicrobial_controls`:
  `id, dispensation_id uuid null, paciente_nome text, prontuario text, setor_leito text,
   data_internacao date, dias_internacao int, status_paciente text, data_alta_obito date,
   antibiotico_item_id uuid, antibiotico_nome text, via text, indicacao text, justificativa text,
   origem_infeccao text, dose text, posologia text, tempo_previsto_dias int, data_inicio date,
   data_final_prevista date, prescritor text, dias_em_uso int, data_final date,
   status_antimicrobiano text, data_ultima_atualizacao date, observacoes text,
   ccih_data_avaliacao date, ccih_parecer text, ccih_observacao text,
   created_by uuid, created_at timestamptz DEFAULT now()`
- Auto-criar registro quando dispensa antimicrobiano.

### 1.5 Intervenção Farmacêutica
- Tabela `pharmaceutical_interventions`:
  `id, data date, paciente text, unidade text, leito text, prontuario text, contato text,
   prm text (ADESAO|EFETIVIDADE|INDICACAO|SEGURANCA), causa text, tipo_intervencao text,
   medicamento text, descricao text, acatado text (SIM|NAO_C_JUST|NAO_S_JUST),
   justificativa text, desfecho_clinico text, gravidade text, farmaceutico text,
   data_ultima_verificacao date, observacao text, created_by uuid, created_at timestamptz DEFAULT now()`

### 1.6 Devolução da Enfermagem
- `stock_returns`: garantir `patient_prontuario` (já existe G1) — frontend torna obrigatório.
  - `return_reason` passa a ser enum provisório (B2). ADD coluna `observacao text` (opcional).
  - `returned_by_user_id` já existe.

### 1.7 Empréstimos
- Tabela `loans`:
  `id, loan_number serial, destino text, categoria text (emprestimo|doacao|permuta|troca_validade),
   status text DEFAULT 'pending', observacao text, created_by uuid, created_at timestamptz DEFAULT now()`
- Tabela `loan_items`:
  `id, loan_id uuid, item_id uuid, item_nome text, batch_number text, expiry_date date,
   quantity int, valor_unit numeric null, valor_total numeric null`
  (troca_validade: valor_unit/total nulos)

### 1.8 Solicitações entre estoques
- `requests`: ADD `needs_receipt_confirmation boolean DEFAULT false`.
  - Estado novo de fluxo: `pending_receipt`.
  - Regra: needs_receipt = true SE origem é local de estoque E destino ∈ {SAT_1, SAT_2}.
  - Confirmação pelo usuário do estoque destino → cria stock_movement de entrada no destino.

### 1.9 Entrada NF flexível
- `stock_entries`: tornar `invoice_number` opcional quando aquisição ≠ Compra.
  - Garantir colunas: `valor_unit numeric, valor_total numeric, origem text, observacao text`
    (lote/validade já via expiry_tracking).

---

## FASE 2 — Quick wins + bugs [sem dependência, paralelo]
- Remover coluna "Última Compra" da tabela de itens.
- Sidebar: "Empréstimos em Aberto"→"Empréstimos"; "Baixas"→"Quebras e Avarias";
  remover "Transferência para CAF".
- Corrigir título da página de devolução → "Devolução da Enfermagem".
- Fila de aprovação: critério = **apenas antimicrobianos + controlados**
  (editar `REQUIRES_APPROVAL_CLASSES` em `pharmacy-dispensation.ts`).
- BUG: fila de aprovação não atualiza após "Aprovar" (recarregar lista no `.then`).

---

## FASE 3 — Separação de solicitações por estoque [dep: F1]
- BUG: solicitações de almoxarifado vazando para farmácia → filtrar por tipo/local.
- Cada estoque (CAF/SAT_1/SAT_2/SAT_T) vê só solicitações destinadas a ele (`target_location_id`).

## FASE 4 — Confirmação de recebimento entre estoques [dep: F1, F3]
- Só quando origem=estoque E destino ∈ {SAT_1, SAT_2}.
- Pedido de posto/setor → entrega direta (sem confirmação), como almoxarifado.
- Usuário do estoque destino confirma → itens entram automaticamente no estoque destino.
- Curativo (matmed) pedido por posto → exige nome completo + prontuário do paciente.

## FASE 5 — Estoques separados na sidebar [dep: F1]
- 4 telas/rotas: CAF · Satélite 1 · Satélite 2 · Satélite T.
- Reusa tabela de Itens da Farmácia, parametrizada por `location_id`.

## FASE 6 — Multi-lote (dropdown + modal por lote) [dep: F1]
- Tabela: número de estoque clicável → modal com quantidade por lote.
- Múltiplos lotes → dropdown listando todos.
- Atendimento de solicitação: dropdown lote → validade automática.
- Dispensação: dropdown lote → validade automática.

## FASE 7 — Dispensação (correções) [dep: F1, F6]
- Modal de confirmação do paciente ao digitar nome.
- Dropdown lote+validade nos itens.
- Resumo com botão "Editar dispensação" (editar qualquer item).
- Fila só antimicrobiano/controlado.

## FASE 8 — Devolução da Enfermagem (rework) [dep: F1]
- Prontuário obrigatório.
- Motivo → dropdown (enum provisório B2). ⚠️ AJUSTAR.
- "Motivo" texto livre antigo → "Observação" (opcional).
- Registrar usuário que devolveu.

## FASE 9 — Empréstimos + Entrada NF flexível [dep: F1]
- Tela "Empréstimos": registrar novo → destino, itens, lote/validade, valor unit+total,
  qtd, observação, categoria (Doação/Permuta/Empréstimo/Troca de validade).
- Troca de validade: sem valores.
- Status pending.
- Gera PDF para impressão (modelo HEML: cabeçalho institucional, "Enviamos/Solicitamos",
  caráter Empréstimo/Doação, tabela Produto·Qtd·Apresentação·Lote/Validade,
  3 assinaturas: Solicitado/Atendido/Recebido por).
- Entrada NF: empréstimo/doação/permuta sem NF obrigatória + valor unit, total, origem,
  lote, validade, data entrada, observação.

## FASE 10 — Controle de Antimicrobianos [dep: F1] (REQUISITO LEGAL — Anexo I)
- Tela espelhando a planilha: preenchimento Farmácia + seção CCIH.
- Auto-popular quando dispensa antimicrobiano.
- Listas de apoio: vias (IV/VO/IM/SC/Tópico), status, motivos.
- Dashboard: total, pacientes ativos, ATB em uso, pendentes CCIH.

## FASE 11 — Intervenção Farmacêutica [dep: F1]
- Tela de registro: PRM→Causa (dropdown dependente), tipo, medicamento, acatado, desfecho, gravidade.
- Tabela de classificação PRM (1A–4x).
- Dashboard próprio.

## FASE 12 — Conformidade Portaria 344/737 [dep: F1, F10]
- **12.1 Livro de Registro Específico** (relatório PDF imprimível) separado por lista:
  A1/A2 · A3/B1/B2 · C1/C2/C4/C5 · C3 · Antimicrobianos. Colunas: nº seq, data, histórico,
  entrada, saída, perda+justificativa, saldo, lote, validade, assinatura RT.
- **12.2** = Fase 10 (antimicrobianos).
- **12.3 Notificação de Receita**: campo tipo (amarela A/azul B/branca) + número na dispensação de controlados.
- **12.4** Ajustes cadastro: C5 (F1), endereço paciente (F1), DCB+nome comercial (F1) ⚠️ recatalogação manual.
- **12.5** Termo de Abertura/Encerramento (gerar+numerar) + gerar Declaração de Responsabilidade (Anexo II) para RT assinar.
- **12.6 Talidomida** completo: livro de notificação próprio (CID, idade, sexo, qtd, médico+CRM,
  técnico), termo de responsabilidade do paciente, retenção 10 anos.

---

## Ordem de execução
```
F1 (banco) ──┬─→ F3 → F4
             ├─→ F5
             ├─→ F6 → F7
             ├─→ F8
             ├─→ F9
             ├─→ F10 → F12
             └─→ F11
F2 roda em paralelo a F1
```

## ⚠️ Itens que precisarão de ajuste posterior (sinalizar ao usuário)
1. **B2** — motivos de devolução: enum provisório, validar com a farmácia.
2. **B3** — quais medicamentos exigem justificativa: aplicado "controlados+antimicrobianos".
3. **DCB** — recatalogação manual dos 331 itens (campo criado, conteúdo a preencher).
4. **Nº Notificação de Receita** — preenchimento humano por dispensação.
5. **Formato do Livro** — validar layout com a RT/inspetor VISA.
6. **Autorização VISA** — trâmite externo (peticionamento), responsabilidade da RT Lais.
7. **Termos de Abertura/Encerramento** — assinatura da autoridade sanitária.

## Não-código (responsabilidade da farmácia/RT)
- Autorização do sistema na Vigilância Sanitária (Art. 15).
- Assinatura da Declaração de Responsabilidade (Anexo II).
- Recatalogação de DCB.
- Validação em uso real pelo time.
