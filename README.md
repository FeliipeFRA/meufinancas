# MEUFInanças — Migração para Cloudflare (Workers + D1)

Este pacote já contém:
- `schema.sql` (estrutura do D1)
- `import.sql` (seus dados exportados do Dynamo, prontos para inserir no D1)
- `src/index.js` (API Worker)
- `wrangler.toml` (ajustar o `database_id`)

## Passos rápidos (CLI)

1) Instalar Wrangler
   npm i -g wrangler

2) Login
   wrangler login

3) Criar o D1
   wrangler d1 create meufinancas_db

   Copie o `database_id` retornado e cole no `wrangler.toml`.

4) Criar as tabelas
   wrangler d1 execute meufinancas_db --remote --file=./schema.sql

5) Importar os dados
   wrangler d1 execute meufinancas_db --remote --file=./import.sql

6) Definir a chave
   wrangler secret put ACCESS_KEY

7) Deploy
   wrangler deploy

## Front-end
- No seu `config.js`, aponte `API_BASE_URL` para a URL do Worker.
- Mantenha `ACCESS_KEY` igual ao secret que você definiu no Worker.
