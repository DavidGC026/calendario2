---
title: Guía de despliegue en servidor y correos (Resend)
lang: es
# Fecha en que quedó cerrado el trabajo descrito (ISO 8601; útil para ordenar y buscar).
fecha_termino: 2026-04-17
# Actualiza esta fecha cuando revises o amplíes el documento.
ultima_revision: 2026-04-17
---

# Guía: despliegue en el servidor y correos (Resend)

| Campo | Valor |
|-------|-------|
| **Fecha de término** (trabajo documentado) | `2026-04-17` |
| **Última revisión del documento** | `2026-04-17` |

Esta guía documenta lo que se hizo para que los correos de confirmación, actualización, eliminación y recordatorios funcionaran en producción, y cómo repetir el proceso si el servidor se queda atrás respecto a `main` o si vuelve a fallar el envío.

> En visores que soportan frontmatter (p. ej. algunas extensiones de VS Code, Obsidian o herramientas estáticas), los metadatos del bloque `---` arriba suelen aparecer como propiedades del documento. En GitHub el frontmatter no se renderiza como tabla, pero **sigue siendo Markdown válido** y la tabla de arriba muestra las fechas de forma clara.

## Qué pasó (causa habitual)

1. **El código en el servidor no era el mismo que en GitHub.** El repositorio en el servidor (`/opt/calendar-web/repo`) estaba varios commits detrás de `origin/main`. Los cambios que hacían que los correos se enviaran de forma fiable (`await` a las notificaciones, `maxDuration` en rutas API, etc.) **no estaban en la imagen Docker** que corría en producción.
2. **La imagen Docker se construye desde el código local del repo en el servidor.** Si no haces `git pull` (o `reset` a `origin/main`) y **no reconstruyes** la imagen, seguirás ejecutando el binario antiguo aunque el `.env` tenga `RESEND_API_KEY` correcto.
3. **Migraciones de Prisma:** en una base que ya tenía objetos creados “a mano” (por ejemplo el enum `FriendRequestStatus`), una migración antigua puede fallar al reaplicarse. Hay que usar `prisma migrate resolve` cuando corresponda (ver más abajo).

## Requisitos en el servidor

- Ruta típica del despliegue: `/opt/calendar-web/`
- `docker-compose.yml` que construye el servicio desde `./repo` con `Dockerfile.runtime` (u otro Dockerfile que ejecute `npm run build`).
- Archivo de entorno: `/opt/calendar-web/.env` (no versionar secretos en Git).

### Variables importantes en `.env`

| Variable | Uso |
|----------|-----|
| `RESEND_API_KEY` | Clave de la API de Resend (obligatoria para enviar). |
| `RESEND_FROM_EMAIL` | Remitente, p. ej. `Calendario <calendar@tudominio.com>` (dominio verificado en Resend). |
| `PUBLIC_APP_URL` | URL pública de la app (enlaces en los correos). |
| `EVENT_TIMEZONE` | Zona horaria para recordatorios “el día del evento”, p. ej. `America/Mexico_City`. |
| `DATABASE_URL` | Conexión PostgreSQL (en Docker suele apuntar a `host.docker.internal` o al servicio de BD). |
| `CRON_SECRET` | (Opcional pero recomendado) Secreto para proteger `POST /api/cron/event-reminders` si programas un cron externo. |

Tras editar `.env`, recrea el contenedor para que cargue los valores:

```bash
cd /opt/calendar-web
docker compose up -d --force-recreate calendar-web
```

## Procedimiento estándar: actualizar código y volver a desplegar

Ejecutar en el servidor (usuario con acceso a Docker y al repo), por SSH:

```bash
cd /opt/calendar-web/repo

# Ver si hay cambios locales o archivos sin seguimiento
git status

# Si hay cambios que quieras guardar temporalmente:
git stash push -u -m "backup antes de deploy"

# Traer la última versión de main
git fetch origin
git checkout main
git reset --hard origin/main

# Ver el commit activo (debe coincidir con GitHub)
git log -1 --oneline
```

Construir imagen nueva (obligatorio tras cambios de código):

```bash
cd /opt/calendar-web
docker compose build calendar-web
```

Aplicar migraciones de Prisma **desde un contenedor que use el mismo código y `.env`**:

```bash
cd /opt/calendar-web
docker compose run --rm --no-deps calendar-web npx prisma migrate deploy
```

Si una migración falla porque **el cambio ya existe en la base** (p. ej. tipo enum duplicado):

```bash
# Sustituye NOMBRE_MIGRACION por la carpeta exacta en prisma/migrations
docker compose run --rm --no-deps calendar-web npx prisma migrate resolve --applied NOMBRE_MIGRACION
docker compose run --rm --no-deps calendar-web npx prisma migrate deploy
```

Levantar el servicio con la imagen nueva:

```bash
docker compose up -d --force-recreate calendar-web
docker logs --tail 30 calendar-app-web
```

## Verificación rápida

1. **Variables dentro del contenedor** (sin imprimir secretos completos):

   ```bash
   docker exec calendar-app-web sh -c 'env | grep -E "^(RESEND_|PUBLIC_APP_URL|EVENT_TIMEZONE)="'
   ```

2. **Prueba directa a Resend** (desde el contenedor, usa la misma clave y remitente que la app):

   ```bash
   docker exec calendar-app-web node -e "
   const { Resend } = require('resend');
   const r = new Resend(process.env.RESEND_API_KEY);
   r.emails.send({
     from: process.env.RESEND_FROM_EMAIL,
     to: 'tu-correo@ejemplo.com',
     subject: '[Prueba] ' + new Date().toISOString(),
     html: '<p>Prueba desde el contenedor en producción.</p>'
   }).then(console.log).catch(console.error);
   "
   ```

   Si la respuesta incluye `data.id` y no hay `error`, Resend aceptó el envío. Revisa también el panel de Resend → **Emails / Logs**.

3. **Prueba funcional:** crea, edita y elimina un evento desde la web o desde el asistente; deberían dispararse los correos según la lógica actual del código.

## Si “no llegan correos” pero Resend responde bien

- Confirma que **acabas de reconstruir** la imagen tras `git pull` (el fallo más común es código viejo).
- Revisa `docker logs calendar-app-web` buscando `[notifyEvent` o mensajes sobre `RESEND_API_KEY` faltante.
- En Resend, un dominio no verificado o un `from` incorrecto provocan errores de validación; el remitente debe usar un dominio verificado.

## Recordatorios del día del evento

El endpoint suele ser `POST /api/cron/event-reminders` con cabecera `Authorization: Bearer <CRON_SECRET>`. Necesitas:

- `CRON_SECRET` en `.env`
- Un cron del sistema (systemd timer, crontab del servidor o servicio externo) que llame a esa URL una vez al día en la hora deseada.

Sin eso, los correos de **confirmación / actualización / borrado** pueden funcionar, pero los **recordatorios diarios** no se dispararán solos.

## Recomendaciones adicionales

- **Despliegue repetible:** automatiza con un script en el servidor (o CI) que ejecute en orden: `git fetch` + `reset --hard origin/main`, `docker compose build`, `prisma migrate deploy`, `docker compose up -d --force-recreate`. Así reduces el riesgo de olvidar el `build` tras un `pull`.
- **Comprobar commit en producción:** tras desplegar, `docker exec calendar-app-web sh -c 'cat /app/package.json | head -1'` no basta; mejor guardar en un fichero `VERSION` o `GIT_SHA` en el build (Docker `ARG` + `echo`) o anotar en notas el `git log -1` del servidor.
- **Cuotas y límites de Resend:** revisa en el panel límites diarios/mensuales y los logs si hay `429`; en desarrollo evita spamear la API.
- **Dominio y SPF/DKIM:** mantén el dominio verificado en Resend; si cambias el remitente, prueba un envío de prueba antes de avisar a usuarios.
- **Secretos:** respaldo cifrado o gestor de secretos para `/opt/calendar-web/.env`; nunca lo subas a Git.
- **Base de datos:** antes de `migrate deploy` en producción, backup de PostgreSQL si el cambio es grande.
- **Salud del contenedor:** `docker compose ps` y alertas si el contenedor reinicia en bucle tras un deploy fallido.

## Notas

Espacio libre para anotar lo que quieras recordar en el siguiente mantenimiento (IPs, nombres de host, incidencias, números de ticket, etc.):

- …
- …

*(Cuando actualices el contenido sustancial de la guía, sube también `ultima_revision` en el frontmatter y, si aplica, la tabla de fechas bajo el título.)*

## Resumen en una línea

**Siempre:** `origin/main` en el servidor → `docker compose build` → `prisma migrate deploy` → `docker compose up -d --force-recreate` → probar Resend y un flujo de evento real.
