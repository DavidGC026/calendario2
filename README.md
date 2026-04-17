# Calendar App (Auth + PostgreSQL + IA)

## Requisitos
- Docker y Docker Compose
- Node.js 20+

## Variables de entorno
Usa `.env` o `.env.local` con:

```bash
DATABASE_URL="postgresql://calendar_user:calendar_password@localhost:5432/calendar_app?schema=public"
NEXTAUTH_SECRET="cambia-esto-por-un-secreto-largo"
OPENAI_API_KEY="tu-openai-key"
RESEND_API_KEY="tu-resend-key"
```

## Arranque local
1. Levantar base de datos:
   - `npm run db:up`
2. Crear tablas:
   - `npm run db:migrate`
3. (Opcional) Crear datos demo:
   - `npm run db:seed`
4. Iniciar aplicación:
   - `npm run dev`

## Scripts útiles
- `npm run db:up`: inicia PostgreSQL en Docker
- `npm run db:down`: detiene contenedores
- `npm run db:migrate`: ejecuta migraciones Prisma
- `npm run db:generate`: genera cliente Prisma
- `npm run db:seed`: inserta usuario demo y eventos

## Credenciales demo (si ejecutas seed)
- Email: `demo@calendar.local`
- Password: `demo1234`
