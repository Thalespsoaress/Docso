# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

The main app is in the `docso/` subdirectory. Run all commands from there:

```bash
cd docso
npm run dev      # Start dev server with HMR
npm run build    # tsc -b && vite build
npm run lint     # ESLint
npm run preview  # Preview production build
```

Backend is in the `backend/` subdirectory. Run all commands from there:

```bash
cd backend
npm run dev      # Start Hono dev server on port 3000
npm run build    # tsc
npm run start    # node dist/index.js
```

## Architecture

### Frontend
React 19 + TypeScript + Vite SPA with:
- **@tanstack/react-router** for routing
- **@tanstack/react-query** for server state
- **Tailwind CSS 4** via `@tailwindcss/vite` plugin (no config file needed)
- **shadcn/ui** with Radix primitives for components
- **clsx** + **tailwind-merge** for conditional class composition
- **Clerk** for authentication

Entry: `src/main.tsx` → `src/App.tsx`.

### Backend
Hono + Node.js with:
- **Clerk** JWT validation middleware on all protected routes
- **Prisma** as ORM
- **Supabase** (PostgreSQL) as database

Entry: `src/index.ts`. Port: 3000.

## TypeScript

Strict mode is enabled with `noUnusedLocals`, `noUnusedParameters`, and `noUncheckedSideEffectImports`. The build (`tsc -b`) will fail on these violations — fix them rather than suppressing.

Two tsconfig files: `tsconfig.app.json` (source, ES2022 target) and `tsconfig.node.json` (vite.config.ts only, ES2023 target).

---

## Produto — Docso

### O que é
SaaS B2B para PMEs brasileiras (5–50 funcionários) que documenta processos com IA via extensão Chrome, treina o time automaticamente e retém conhecimento quando alguém sai.

Três pilares:
1. **Documenta** — captura como o negócio funciona de verdade via extensão Chrome
2. **Treina** — novos funcionários aprendem o processo certo desde o primeiro dia
3. **Retém** — quando alguém sai, o conhecimento fica na empresa

### Público-alvo
Agências, consultorias e escritórios brasileiros com 5 a 50 funcionários.

---

## Design system

### Fontes
- Logo: arquivo SVG (`src/assets/logo-{preto,branco}.svg`) — nunca recriar em texto
- Títulos de tela e headlines (inclusive no painel escuro): **Plus Jakarta Sans** 700–800, tracking negativo
- Corpo/interface: **DM Sans** 300 ou 400, line-height 1.7
- Labels, eyebrow, tags, cabeçalhos de coluna, datas e números: **DM Sans** 500, 12px, sem caixa alta forçada e sem letter-spacing (DM Mono não é mais usada)
- Botão primário: **Plus Jakarta Sans** 600

Importar do Google Fonts (já está no `index.html`):
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap" rel="stylesheet">
```

### Cores
```
--preto:       #0A0A0A   /* fundo principal */
--branco:      #FAFAFA   /* fundo claro */
--cinza-sup:   #F0F0F0   /* superfície */
--cinza-borda: #E4E4E4   /* bordas */
--cinza-texto: #A0A0A0   /* texto secundário */
--cinza-medio: #666666   /* texto auxiliar em fundo claro (ex: checkbox) */
--cinza-fraco: #D0D0D0   /* texto muito sutil em fundo claro (ex: rodapé) */
--cinza-dark:  #1A1A1A   /* superfície escura */
--azul:        #30BCFE   /* fluxo ativo / ação primária */
--vermelho:    #FE7451   /* atenção / bloqueado */
--amarelo:     #FADB02   /* em revisão */
--verde:       #39BD3D   /* concluído */
```

### Tom visual
- Sério sem ser frio
- Sem emoji em contexto profissional
- Cor como sinalização, nunca como decoração
- Azul = ação primária
- Interface ensina pelo comportamento, não por jargão técnico

### Componentes da marca (logo "ponto fundido")
Reutilize estes em vez de criar variações:

- **Carregamento → `BrandLoader`** (`src/components/BrandLoader.tsx`): símbolo do logo com o ponto azul pulsando. Usar em toda espera por dados — nada de skeleton, spinner genérico ou texto "Carregando...".
  - Tela inteira: `<BrandLoader />` (fundo claro) ou `<BrandLoader dark />` (telas pretas: convite, onboarding)
  - Dentro de uma área da página: `<div style={{ height: 320 }}><BrandLoader inline /></div>` (ex.: lista de processos na Home e no Studio)
- **Ponto final de headline → `.brand-dot`**: envolve a última palavra; troca o "." pelo ponto azul da marca e nunca quebra linha sozinho. Ex.: `Olá, <span className="brand-dot">{nome}</span>`
- **Ponto fundido → `.brand-dot.fused`**: só para palavras terminadas em "o", em Plus Jakarta Sans 800. Reproduz o símbolo do logo no próprio "o". Em fundo claro, defina `--dot-cut` com a cor do fundo; se o texto tiver `letter-spacing`, informe em `--ls`. Ex.: login "processo." / "certo."
- **Status de processo → `.status-pill`** + `status-publicado` (verde) / `status-rascunho` (amarelo) / `status-desatualizado` (vermelho), com `<div className="dot" />`. DM Sans 500 12px, só a primeira letra maiúscula. Mesma tag em todas as telas.
- **E-mails → `emailLayout()`** (`backend/src/lib/email.ts`): layout único dos e-mails transacionais (logo, título, texto, botão, rodapé). Todo texto interpolado passa por `escapeHtml()`.
- **Assets**: logos em `src/assets/logo-{preto,branco}.svg`; kit completo em `Guias/logo-ponto-fundido/`. Não recriar o logo em texto.

---

## Stack completa

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Vite + React + TypeScript |
| Roteamento | TanStack Router |
| Server state | TanStack Query |
| UI components | shadcn/ui (Radix) |
| Estilo | Tailwind CSS 4 |
| Auth (frontend) | @clerk/clerk-react |
| Auth (backend) | @clerk/backend |
| Backend | Hono + Node.js |
| ORM | Prisma |
| Banco | Supabase (PostgreSQL) |
| Storage | Cloudflare R2 |
| Email | Resend |
| IA | Anthropic Claude Haiku 4.5 |
| Deploy frontend | Vercel |
| Deploy backend | Railway |
| Landing page | Framer (fora deste repositório) |

---

## Autenticação — Clerk

### Fluxo
1. Usuário faz login/signup no frontend via Clerk
2. Clerk emite JWT
3. Frontend envia JWT no header `Authorization: Bearer <token>` em toda requisição ao backend
4. Backend valida o JWT com `@clerk/backend` antes de processar qualquer rota protegida
5. O `userId` extraído do JWT é usado para buscar o `organization_id` do usuário

### Sincronização Clerk → Supabase via Webhook
Toda vez que um evento acontece no Clerk, um webhook dispara para `POST /webhooks/clerk` no backend:
- `user.created` → cria registro em `users`
- `user.updated` → atualiza registro em `users`
- `organization.created` → cria registro em `organizations`
- `organizationMembership.created` → cria registro em `organization_members`
- `organizationMembership.deleted` → remove registro de `organization_members`

### Roles
- `admin` — dono, configura plano, convida pessoas
- `manager` — cria e publica processos
- `member` — acessa treinamentos, lê processos

### Variáveis de ambiente — Frontend (`docso/.env`)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3000
```

### Variáveis de ambiente — Backend (`backend/.env`)
```
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
PORT=3000
```

---

## Banco de dados — Schema Prisma

```prisma
model Organization {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  plan      String   @default("trial") // trial | active | cancelled
  createdAt DateTime @default(now())

  members             OrganizationMember[]
  processes           Process[]
  captureSessions     CaptureSession[]
  trainingAssignments TrainingAssignment[]
}

model User {
  id        String   @id // mesmo ID do Clerk
  email     String   @unique
  name      String
  createdAt DateTime @default(now())

  memberships            OrganizationMember[]
  processesCreated       Process[]
  captureSessionsCreated CaptureSession[]
  assignedBy             TrainingAssignment[] @relation("AssignedBy")
  assignedTo             TrainingAssignment[] @relation("AssignedTo")
}

model OrganizationMember {
  id             String   @id @default(uuid())
  organizationId String
  userId         String
  role           String   // admin | manager | member
  invitedBy      String?
  joinedAt       DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])

  @@unique([organizationId, userId])
}

model Process {
  id             String    @id @default(uuid())
  organizationId String
  createdBy      String
  title          String
  objective      String?
  executor       String?
  frequency      String?
  status         String    @default("draft") // draft | published | archived
  steps          Json      // array de ProcessStep
  metadata       Json?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  publishedAt    DateTime?

  organization        Organization         @relation(fields: [organizationId], references: [id])
  creator             User                 @relation(fields: [createdBy], references: [id])
  captureSessions     CaptureSession[]
  trainingAssignments TrainingAssignment[]
}

model CaptureSession {
  id             String   @id @default(uuid())
  organizationId String
  createdBy      String
  processId      String?
  rawEvents      Json     // array de eventos capturados pela extensão
  contextForm    Json?    // formulário de enriquecimento preenchido pelo usuário
  aiInputHash    String?  // hash do input enviado pra IA (cache)
  status         String   @default("captured") // captured | processing | done | error
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  creator      User         @relation(fields: [createdBy], references: [id])
  process      Process?     @relation(fields: [processId], references: [id])
}

model TrainingAssignment {
  id             String    @id @default(uuid())
  organizationId String
  processId      String
  assignedTo     String
  assignedBy     String
  token          String    @unique // token do link enviado por email
  status         String    @default("pending") // pending | in_progress | completed
  progress       Json?     // flexível: {} hoje, {steps_done: [1,2,3]} amanhã
  startedAt      DateTime?
  completedAt    DateTime?
  createdAt      DateTime  @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  process      Process      @relation(fields: [processId], references: [id])
  assignee     User         @relation("AssignedTo", fields: [assignedTo], references: [id])
  assigner     User         @relation("AssignedBy", fields: [assignedBy], references: [id])
}
```

### Formato dos steps (campo `steps` em Process)
```json
[
  {
    "order": 1,
    "title": "Nome do passo",
    "description": "Descrição detalhada do que fazer",
    "url": "https://url-da-pagina.com",
    "notes": "Observações opcionais"
  }
]
```

---

## Multi-tenancy

- Toda tabela tem `organizationId`
- RLS ativado no Supabase em todas as tabelas
- Policy padrão: usuário só acessa dados da sua organização
- O backend nunca faz query sem filtrar por `organizationId`
- O `organizationId` vem sempre do JWT/sessão do Clerk, nunca do body da requisição

---

## Backend — estrutura de rotas Hono

```
POST   /webhooks/clerk               # público — sincroniza Clerk → Supabase
GET    /api/processes                # lista processos da organização
POST   /api/processes                # cria processo
GET    /api/processes/:id            # busca processo por ID
PATCH  /api/processes/:id            # atualiza processo
DELETE /api/processes/:id            # arquiva processo (status: archived)

POST   /api/capture-sessions         # salva sessão de captura da extensão
PATCH  /api/capture-sessions/:id     # vincula sessão a um processo

POST   /api/ai/generate-process      # recebe captureSessionId, gera documentação com IA
POST   /api/ai/generate-quiz         # fora do MVP

GET    /api/training/:token          # público — acessa treinamento via token
POST   /api/training/:token/start    # público — marca treinamento como iniciado
POST   /api/training/:token/complete # público — marca treinamento como concluído

GET    /api/members                  # lista membros da organização
POST   /api/members/invite           # convida membro
```

---

## IA — Anthropic Claude Haiku 4.5

### Modelo
`claude-haiku-4-5-20251001`

### SDK
```bash
npm install @anthropic-ai/sdk
```

### Uso
```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }],
})
```

---

## Extensão Chrome

- Manifest V3
- Gravação **manual** — usuário clica para iniciar e parar
- Captura: DOM events + texto dos elementos clicados (click, input, focus, submit)
- Keepalive: `chrome.alarms` disparando a cada 25s para manter o service worker ativo
- Após parar gravação: envia payload para `POST /api/capture-sessions` no backend
- Stack: WXT + React + Vite

### Formato de evento capturado
```json
{
  "type": "click",
  "timestamp": 1700000000000,
  "url": "https://app.exemplo.com/dashboard",
  "element": {
    "tag": "button",
    "text": "Salvar alterações",
    "id": "btn-save",
    "className": "btn-primary"
  }
}
```

---

## Email — Resend

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'Docso <noreply@docso.app>',
  to: email,
  subject: 'Você tem um novo treinamento',
  html: `<p>Acesse seu treinamento: <a href="${link}">${link}</a></p>`,
})
```

---

## Regras gerais de desenvolvimento

- Interface sempre em **português brasileiro**
- Nunca expor `organizationId` ou `userId` em URLs públicas — usar tokens opacos
- Nunca aceitar `organizationId` do body da requisição — sempre extrair do JWT
- Processos nunca são deletados — apenas arquivados (`status: archived`)
- Todo erro da API retorna `{ error: string, code: string }`
- Variáveis de ambiente nunca commitadas — sempre no `.env` (já no `.gitignore`)