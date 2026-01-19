# Credit Analyzer Pro

Sistema profissional de análise de crédito e gestão de leads para instituições financeiras.

## Funcionalidades

- **Dashboard Analítico**: Visualização completa de métricas e KPIs
- **Gestão de Leads**: Importação, análise e acompanhamento de leads
- **Análise de Crédito CLT**: Simulações e aprovações de crédito consignado
- **Relatórios**: Gráficos e estatísticas detalhadas
- **Multi-banco**: Suporte a múltiplas instituições financeiras

## Tecnologias

- **Frontend**: React 18 + TypeScript
- **Build**: Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Gráficos**: Recharts
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State Management**: TanStack Query

## Instalação

```bash
# Clonar o repositório
git clone https://github.com/ryanribeiro9877/bi-System.git

# Entrar no diretório
cd bi-System

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Gera build de produção
- `npm run preview` - Preview do build de produção
- `npm run lint` - Executa o linter

## Deploy

### Netlify

1. Conecte seu repositório GitHub ao Netlify
2. Configure:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Adicione as variáveis de ambiente do Supabase

### Vercel

1. Importe o projeto do GitHub
2. O Vercel detectará automaticamente as configurações do Vite
3. Adicione as variáveis de ambiente do Supabase

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

## Estrutura do Projeto

```
src/
├── components/     # Componentes React
├── contexts/       # Contextos React
├── hooks/          # Custom hooks
├── integrations/   # Integrações (Supabase)
├── pages/          # Páginas da aplicação
└── lib/            # Utilitários
```

## Licença

Projeto proprietário - Todos os direitos reservados.
