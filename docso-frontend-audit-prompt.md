# Prompt: Revisão Completa do Frontend Docso

> Cole este prompt diretamente no Claude Code (`claude`) na raiz do monorepo.

---

## Contexto do Produto

Você está revisando o frontend completo do **Docso** — plataforma B2B SaaS para PMEs brasileiras (5–50 funcionários) que documenta processos de negócio via extensão Chrome com IA, automatiza treinamentos e retém conhecimento institucional.

**Público-alvo:** Gestores e analistas de operações em empresas brasileiras de médio porte. Usuários que vivem em planilhas e precisam de uma ferramenta que transmita confiança, clareza e profissionalismo — não uma startup americanas de design playground.

**Referências de marca:** RD Station, Conta Azul. Tom: "autoridade acessível" — especialista, direto, nunca informal.

---

## Stack Técnico (não altere sem perguntar)

- **Framework:** React + Vite (SPA)
- **Roteamento:** TanStack Router
- **Server state:** TanStack Query
- **UI base:** shadcn/ui + Radix UI
- **Styling:** Tailwind CSS
- **Auth:** Clerk com Organizations
- **Animações:** Motion (Framer Motion)

---

## Sistema de Design Docso (aplique rigorosamente)

### Tipografia
| Papel | Fonte | Peso |
|---|---|---|
| Display / headlines | Syne | 700, 800 |
| Body / interface | DM Sans | 400, 500 |
| Labels / código / mono | DM Mono | 400 |

### Paleta Funcional
```
--color-blue:   #30BCFE   /* ação principal, links */
--color-green:  #39BD3D   /* sucesso, status ativo */
--color-yellow: #FADB02   /* atenção, rascunho */
--color-red:    #FE7451   /* erro, alerta crítico */

/* Neutros */
--color-ink:    #0D0D0D   /* texto primário */
--color-surface:#F5F5F5   /* fundo de página */
--color-white:  #FFFFFF   /* cards, modais */
--color-border: #E2E2E2   /* divisores, bordas */
```

As cores funcionais **sempre** aparecem sobre fundo neutro (preto, branco, cinza). Nunca duas cores funcionais lado a lado.

### Espaçamento e Raio
- Grid base: 4px
- Border radius padrão: `rounded-lg` (8px) para cards, `rounded-md` (6px) para inputs
- Border radius pequeno: `rounded-sm` (4px) para badges/tags

---

## Telas Existentes (escopo da revisão)

1. **Login / Onboarding** — autenticação via Clerk
2. **Dashboard** — visão geral do workspace
3. **Studio** — editor manual de processos (tela mais complexa)
   - Campos: `title`, `objective`, `executor`, `frequency`, `status`
   - Card de Responsáveis com color picker
   - Builder dinâmico de seções e steps
4. **Biblioteca** — listagem de processos documentados
5. **Processo** — visualização de um processo individual

---

## O Que Revisar (ordem de prioridade)

### 1. Auditoria de Consistência Visual
- [ ] Todas as telas usam as fontes corretas (Syne para titles, DM Sans para body)?
- [ ] Cores aplicadas semanticamente (blue = ação, green = sucesso, etc.)?
- [ ] Espaçamentos seguem o grid de 4px?
- [ ] Border radius consistente entre componentes equivalentes?
- [ ] Estados de hover, focus e disabled estão implementados em todos os elementos interativos?

### 2. Qualidade dos Componentes
- [ ] Componentes shadcn/ui estão customizados para o tema Docso ou estão com o estilo padrão?
- [ ] Existe um `components/ui/` com tokens do Docso aplicados globalmente via `tailwind.config`?
- [ ] Variantes de botão (primary, secondary, ghost, destructive) refletem a paleta?
- [ ] Formulários têm feedback visual claro: loading, erro, sucesso?

### 3. Hierarquia e Layout
- [ ] O Studio tem hierarquia clara entre seções, steps e campos?
- [ ] A Biblioteca tem estados vazios (empty state) implementados e com copy adequado?
- [ ] Existe feedback visual durante operações assíncronas (TanStack Query loading states)?
- [ ] A navegação (sidebar/topbar) está visualmente coerente com o restante?

### 4. Micro-interações e Motion
- [ ] Transições de rota estão implementadas?
- [ ] Cards e itens de lista têm hover states com transição suave?
- [ ] Modais e drawers entram/saem com animação?
- [ ] O Studio tem feedback animado ao adicionar/remover steps?

### 5. Responsividade e Acessibilidade Básica
- [ ] Layout funciona em viewports de 1280px e 1440px (foco desktop)?
- [ ] Contraste de texto atende WCAG AA no mínimo?
- [ ] Inputs têm labels acessíveis (não só placeholders)?

---

## Instruções de Execução

**Fase 1 — Mapeamento (não edite nada ainda)**
1. Leia todos os arquivos em `src/` recursivamente
2. Liste todos os componentes de UI encontrados
3. Identifique quais telas estão implementadas
4. Gere um relatório de inconsistências contra o sistema de design acima

**Fase 2 — Plano de Ação**
Com base no mapeamento, proponha:
- Lista priorizada de mudanças (alto/médio/baixo impacto)
- Estimativa de arquivos afetados por mudança
- Se alguma mudança exige refactor estrutural, sinalize antes de executar

**Fase 3 — Execução (aprovação por bloco)**
Execute as mudanças em blocos temáticos, aguardando confirmação antes de avançar:
1. Tokens de design (`tailwind.config`, CSS variables, tema shadcn)
2. Componentes base (`Button`, `Input`, `Card`, `Badge`)
3. Layout e navegação
4. Telas em ordem de prioridade
5. Motion e micro-interações

---

## Restrições

- **Não quebre** a integração com Clerk — não toque em componentes de auth sem perguntar
- **Não mude** a estrutura de rotas do TanStack Router
- **Não instale** novas dependências sem propor e aguardar aprovação
- **Preserve** toda lógica de negócio — esta revisão é exclusivamente visual/UX
- Se encontrar código com `TODO` ou `// FIXME`, liste mas não altere

---

## Entregáveis Esperados

Ao final da revisão completa:
1. Relatório resumido das mudanças aplicadas (por tela)
2. Componentes base documentados com suas variantes
3. Checklist acima com status atualizado
4. Sugestões de próximos passos para polish adicional (fora do escopo desta sessão)
