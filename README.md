# SGI-HECC — Gestão de Insumos (Farmácia + Almoxarifado)

Sistema de gestão de estoque, dispensação e suprimentos do **Hospital Estadual Costa dos Coqueiros (HECC)**. Cobre dois módulos — **Farmácia** e **Almoxarifado** — com controle multi-estoque, dispensação por prescrição/requisição, solicitações entre setores, e módulos de conformidade sanitária (ANVISA / Portaria 344/98).

## Stack

- **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS + shadcn/ui (Radix), React Router, React Query, react-hook-form + zod.
- **Backend:** Supabase — PostgreSQL (com RLS), Auth (PKCE), Storage. Lógica de negócio sensível em **funções RPC `SECURITY DEFINER`** (transações atômicas).

## Módulos e papéis

- **Farmácia** e **Almoxarifado** são escolhidos por usuários `administrador`/`gestor` num seletor inicial.
- Na Farmácia, escolhe-se também **em qual estoque** entrar: **CAF** (central) ou satélites **SAT_1 / SAT_2 / SAT_T**. O estoque atual fica indicado no topo (com troca rápida).
- Papéis: `administrador`, `gestor`, `atendente`, `solicitante`, e setores de enfermagem.

## Modelo de estoque (multi-localização)

- `stock_locations`: CAF, ALMOX, SAT_1, SAT_2, SAT_T.
- `item_stocks(item, tipo, local)`: **saldo por local** — fonte de verdade da farmácia.
- `stock_movements`: **livro-razão imutável** (entradas, prescrições, solicitações, transferências, saídas, ajustes). O trigger `fn_apply_stock_movement` atualiza `item_stocks`; `fn_sync_legacy_stock_columns` espelha em `pharmacy_items.current_stock` (CAF).
- **Almoxarifado** opera no modelo legado (`warehouse_items.current_stock` direto).
- `expiry_tracking`: lotes e validade (FEFO).

> **Toda alteração de saldo passa por RPCs atômicas** — o cliente nunca escreve saldo direto.

## Principais fluxos

- **Cadastro de itens** (catálogo): identificação, classificação farmacêutica, estoque mín/máx, padronizado, e **setores que podem solicitar**. O cadastro é **separado da entrada de estoque**.
- **Entradas em lote** (`registrar_entrada_nf`): tela "Nova Entrada" com tipo (Compra/NF, Empréstimo, Doação, Consignado, Troca de validade); lança vários itens de uma vez (lote/validade/valor) → credita `item_stocks` (farmácia) ou `current_stock` (almox) + grava `stock_entries`.
- **Saídas em lote** (`registrar_saida_lote`): tela "Registrar Saída" com motivo (quebra, vencimento, transferência, doação, permuta, consignado, troca de validade, empréstimo, devolução…) e **Destino** (fornecedores / unidades externas / setores).
- **Dispensação** (`criar_dispensacao` / `aprovar_dispensacao` / `cancelar_dispensacao`): dois tipos — **prescrição** (paciente + prescritor) e **requisição** (só setor solicitante). Itens **MAV / controlados / antimicrobianos** caem em **fila de aprovação farmacêutica**; baixa pelo ledger no CAF. Disponível nos estoques **satélites**.
- **Solicitações** entre setores: criar → aprovar → processar → entregar → **confirmar recebimento** (qualquer usuário logado). Para farmácia, ao confirmar, move o estoque **CAF → satélite solicitante** (`confirmar_recebimento_solicitacao`).
- **Conformidade (Farmácia):** Livro de Controlados, Notificação de Receita, BMPO, Perdas, Talidomida, Antimicrobianos (CCIH), Intervenção Farmacêutica — com auditoria em `audit_logs`.

## Rodando localmente

```bash
npm install
# defina as variáveis de ambiente (.env) abaixo
npm run dev            # http://localhost:5173
npm run build          # tsc && vite build
```

Variáveis de ambiente (`.env`):

```
VITE_SUPABASE_URL=...        # URL do projeto Supabase
VITE_SUPABASE_ANON_KEY=...   # anon key
```

## Banco de dados (importante)

- O **schema canônico vive no banco de produção** (Supabase). As migrations versionadas em `supabase/migrations/` **não cobrem** todo o motor multi-estoque/RPCs — há *schema drift*. Para reproduzir, prefira `supabase db pull` / `pg_dump --schema-only` do projeto real.
- RPCs principais: `registrar_entrada_nf`, `registrar_saida_lote`, `confirmar_recebimento_solicitacao`, `criar_dispensacao`, `aprovar_dispensacao`, `cancelar_dispensacao`, `registrar_entrada_estoque`.

## Deploy (Vercel) — atenção ao repositório

A produção é publicada pela **Vercel** a partir do repositório **`github.com/sgihecc-hue/almoxarifado`** (branch `main`). Existe também o espelho `github.com/doni010520/sgi-hecc-almox`. **Para o deploy ocorrer, o push precisa chegar em `sgihecc-hue/almoxarifado`.** O build é `tsc && vite build` (com `noUnusedLocals` — imports não usados quebram o build).

## Documentação

- `docs/RESUMO-2026-06-30.md` — resumo das alterações desta rodada.
- `docs/BACKLOG.md` — próximas features.
