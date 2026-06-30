# Backlog — próximas features

Três frentes pendentes. Ordem sugerida: **1 → 2 → 3** (a 1 tem o backend pronto).

## 1. Dispensação por Requisição (UI)

**Estado:** banco/RPC **prontos e testados** — falta só o fluxo na tela.

A dispensação tem dois tipos: **prescrição** (paciente + prescritor) e **requisição** (sem paciente — só o **setor solicitante**).

- [ ] Em "Nova Dispensação", escolher o **tipo** logo no início (Prescrição / Requisição).
- [ ] Fluxo **Requisição**: passo **"Setor solicitante"** (select de setores) → **Medicamentos** → **Resumo**. Sem paciente, sem prescritor.
- [ ] No envio, chamar `criar_dispensacao` com `p_tipo='requisicao'` e `p_sector=<setor>` (paciente/prescritor nulos).
- [ ] Exibir o tipo (Prescrição/Requisição) na lista, no detalhe e no histórico.

> Backend já suporta: `pharmacy_dispensations.tipo`, colunas de paciente/prescritor nuláveis, e `criar_dispensacao(..., p_tipo)` validando que requisição exige setor.

## 2. Tela de Cadastro (catálogo) + classificação múltipla

**Objetivo:** separar **cadastro** (catálogo de itens) da tela de **estoque**.

- [ ] Nova tela **"Cadastro"** listando todos os itens cadastrados: **código, nome, categoria, unidade, classificação(ões) farmacêutica(s)**, padronizado, status.
- [ ] Busca/filtro; criar/editar/inativar a partir dessa tela (reusando o diálogo de cadastro).
- [ ] Mover o "Novo Item" da tela de estoque para esta tela (estoque fica só com Entrada/Saída/saldos).
- [ ] **Classificação múltipla:** um item pode ter **mais de uma** classificação farmacêutica (hoje é única).
  - [ ] Banco: coluna `pharmacy_items.medication_classes text[]` (+ backfill a partir de `medication_class`).
  - [ ] Diálogo de cadastro: trocar o seletor único por **checkboxes** de classes.
  - [ ] Ajustar `criar_dispensacao` (needsApproval) para considerar o **array** (controlados/antimicrobianos/mav).
  - [ ] Exibir as classes (chips) na lista do catálogo.

## 3. Histórico / Auditoria global

**Objetivo:** uma trilha única de **tudo** que acontece no sistema — **quem fez, quando, o quê** — unificando os históricos de prescrições e de solicitações.

**Já existe:** tabela `audit_logs` (`user_id`, `action`, `table_name`, `old_data/new_data`, `created_at`) e triggers de auditoria nas tabelas **regulatórias** (controlados, talidomida, BMPO, perdas, notificação, antimicrobianos, intervenção, loans, LGPD).

- [ ] **Estender as triggers** de auditoria às tabelas **operacionais**: `pharmacy_dispensations`, `requests`, `stock_entries`, `pharmacy_items`, `warehouse_items`, `patients`, `external_units`, etc.
- [ ] **View unificada** (ex.: `v_historico_global`) que une `audit_logs` + `stock_movements` (ledger imutável) num formato comum: `usuario, data_hora, acao, entidade, detalhe`.
- [ ] Tela **"Histórico Global"** com filtros (usuário, período, tipo de ação/entidade) — abrangendo/substituindo os históricos de prescrições e solicitações.
- [ ] Garantir nomes legíveis (join com `users`) e rótulos amigáveis para ações.

---

### Itens menores / dívidas observadas

- [ ] Conformidade ANVISA (telas regulatórias): campos obrigatórios faltantes (ex.: Talidomida sem validação de gestação; Perdas sem documento obrigatório para controlados; CRF do RT opcional no Livro de Controlados). Ver análise.
- [ ] Versionar o **schema real** do banco (há *schema drift* — RPCs/tabelas só em produção).
- [ ] Saída de **almoxarifado** não tem trilha de auditoria própria (só decrementa `current_stock`).
