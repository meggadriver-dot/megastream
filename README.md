# MegaStream — Sua diversão em um só lugar!

Plataforma profissional de streaming com catálogo TMDB, reprodução integrada via MegaEmbed, Inteligência Artificial (Gemini no servidor), autenticação Firebase, Cloud Firestore e painel administrativo.

## Arquitetura Modular

- **Frontend**: React, TypeScript, Tailwind CSS, React Router, Lucide Icons, Motion.
- **Backend (`server.ts` + `server/services/`)**: Node.js + Express + TypeScript com módulos independentes:
  - `AuthenticationService` · `UserService` · `TMDBService` · `MegaEmbedService`
  - `CatalogService` · `PlayerService` · `FavoritesService` · `HistoryService`
  - `RecommendationService` · `SubscriptionService` · `ChannelService` · `AdminService`
- **Banco de Dados**: Firebase Authentication + Cloud Firestore (`firestore.rules` endurecidas) + abstração de repositórios (`server/repositories/interfaces.ts`) e esquema SQL (`server/db/postgres-schema.sql`) pronto para migração futura para PostgreSQL.

## Variáveis de Ambiente (Secrets)

Configure no painel **Settings > Secrets** do servidor (nunca no frontend):

- `TMDB_ACCESS_TOKEN`: Token Bearer da API v3 do TMDB (`https://developer.themoviedb.org/`). Enquanto não configurado, o aplicativo opera em **Modo Demonstração** claramente sinalizado.
- `GEMINI_API_KEY`: Chave da Gemini API usada exclusivamente pelo backend em `/api/ai/recommend`.
- `APP_URL`: URL pública do aplicativo.

## Player MegaEmbed

Configurado em `server/config/playerConfig.ts` com suporte a:
- Domínios: `mgeb.lat` e `mgeb.space`
- Players: `vidstack`, `megaplay`, `megatube`, `clappr` (`?player=...`)
- Personalização de cor via fragmento `#color:HEX`
- Séries: utiliza `/embed/{TMDB_ID}` mantendo a limitação de temporada/episódio transparente caso o provedor não documente parâmetros específicos.

## Comandos

```bash
npm run dev      # Inicia Express + Vite na porta 3000
npm run build    # Compila o frontend para produção
npm run lint     # Verificação TypeScript
npx --yes tsx --test shared/logic.test.ts
```
