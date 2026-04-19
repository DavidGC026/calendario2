---
title: Despliegue del calendario en el servidor `completa` (Docker)
lang: es
fecha_termino: 2026-04-18
ultima_revision: 2026-04-18
---

# Despliegue del calendario en el servidor `completa` (Docker)

| Campo | Valor |
|-------|-------|
| **Servidor** | `completa` (alias SSH) |
| **Acceso** | `ssh root@completa` (autenticación por **llave SSH**, sin contraseña) |
| **Sistema** | Debian 13 (Linux 6.12.x) |
| **Repositorio** | `https://github.com/DavidGC026/calendario2.git` (rama `main`) |
| **Fecha de término** (trabajo documentado) | `2026-04-18` |
| **Última revisión del documento** | `2026-04-18` |

Este documento describe **dónde** vive la aplicación en el servidor, **cómo** conectarse, **qué rutas** ocupa, **qué se modificó respecto al repositorio** y **cómo subir cambios posteriores** sin romper nada.

> Documento complementario: [`GUIA-DESPLIEGUE-SERVIDOR-CORREOS.md`](./GUIA-DESPLIEGUE-SERVIDOR-CORREOS.md) (configuración de Resend, cron y correos).

---

## Índice

- [1. Conexión por SSH](#1-conexión-por-ssh)
- [2. Estructura en el servidor](#2-estructura-en-el-servidor)
- [3. Contenedores Docker](#3-contenedores-docker)
- [4. Modificaciones respecto al repositorio](#4-modificaciones-respecto-al-repositorio)
- [5. Cómo desplegar nuevos cambios](#5-cómo-desplegar-nuevos-cambios)
- [6. Operaciones útiles](#6-operaciones-útiles)
- [7. Backups y datos persistentes](#7-backups-y-datos-persistentes)
- [8. Solución de problemas](#8-solución-de-problemas)

---

## 1. Conexión por SSH

```bash
ssh root@completa
```

El alias `completa` debe estar configurado en `~/.ssh/config` del equipo local (con su `HostName`, `User root` y la `IdentityFile` correspondiente). La autenticación es por **llave SSH**, no se necesita contraseña.

> Si la llave no está cargada: `ssh-add ~/.ssh/<tu_llave>` antes de conectar.

---

## 2. Estructura en el servidor

Todo vive bajo `/opt/`, en **dos proyectos Compose separados**:

```
/opt/
├── calendar-db/                 # Base de datos PostgreSQL (independiente)
│   ├── docker-compose.yml
│   └── .env                     # Credenciales de Postgres
│
└── calendar-web/                # Aplicación web (Next.js) + Adminer
    ├── docker-compose.yml       # Servicio principal calendar-web
    ├── docker-compose.adminer.yml  # Adminer (interfaz web para Postgres)
    ├── .env                     # Variables de entorno de la app
    ├── .env.bak.manual          # Backup manual del .env anterior
    └── repo/                    # ← Clon de github.com/DavidGC026/calendario2
        ├── Dockerfile.runtime   # ⚠ Solo en el servidor (no versionado)
        └── ... (resto del código)
```

### `/opt/calendar-db/docker-compose.yml`

Levanta **PostgreSQL 16** como contenedor independiente, expuesto en el puerto **`55433`** del host, con volumen persistente `calendar_pgdata`.

### `/opt/calendar-web/docker-compose.yml`

```yaml
services:
  calendar-web:
    build:
      context: ./repo
      dockerfile: Dockerfile.runtime
    container_name: calendar-app-web
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - 55600:3000
    extra_hosts:
      - host.docker.internal:host-gateway
```

- Construye la imagen a partir de `./repo` con un `Dockerfile.runtime` propio del servidor.
- La app queda escuchando en `http://<servidor>:55600`.
- Para conectar con la base de datos usa `host.docker.internal:55433` (en el `DATABASE_URL` del `.env`).

### `/opt/calendar-web/docker-compose.adminer.yml`

Adminer expuesto solo a `127.0.0.1:55880` (acceso únicamente vía túnel SSH):

```bash
ssh -L 55880:127.0.0.1:55880 root@completa
# Luego abrir http://localhost:55880
```

---

## 3. Contenedores Docker

| Contenedor | Imagen | Puerto host → contenedor | Función |
|------------|--------|---------------------------|---------|
| `calendar-app-web` | `calendar-web-calendar-web` | `55600 → 3000` | App Next.js |
| `calendar-app-postgres` | `postgres:16-alpine` | `55433 → 5432` | Base de datos |
| `calendar-app-adminer` | `adminer:latest` | `127.0.0.1:55880 → 8080` | UI de administración de la BD |

Verificación rápida:

```bash
ssh root@completa "docker ps --filter name=calendar-app"
```

---

## 4. Modificaciones respecto al repositorio

El repositorio en `/opt/calendar-web/repo` es un clon directo de GitHub, en la rama `main`, **sin modificaciones de código rastreadas**. Sin embargo hay tres elementos que **viven solo en el servidor**:

### 4.1. `Dockerfile.runtime` (no versionado)

Aparece como *untracked* en `git status`. Su contenido actual es:

```dockerfile
FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
ENV RESEND_API_KEY=dummy-build-key
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

> El `RESEND_API_KEY=dummy-build-key` es **solo para la fase de build**: evita que Next.js falle en `next build` cuando un módulo intenta instanciar el cliente de Resend en tiempo de compilación. En tiempo de ejecución, la clave real proviene del `.env`.

### 4.2. `/opt/calendar-web/.env`

Variables que **no están** (ni deben estar) en el repositorio:

```
NODE_ENV
PORT
NEXTAUTH_URL
NEXTAUTH_SECRET
DATABASE_URL              # apunta a host.docker.internal:55433
OPENAI_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
PUBLIC_APP_URL
EVENT_TIMEZONE
```

Ejemplo / referencia: `repo/.env.example` en el repo.

### 4.3. `/opt/calendar-db/.env`

Credenciales de Postgres (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).

> Cualquier cambio en el código se hace **siempre en el repo de GitHub**; los únicos archivos que se editan directamente en el servidor son los `.env` y, eventualmente, el `Dockerfile.runtime`.

---

## 5. Cómo desplegar nuevos cambios

El flujo es **manual**: no hay CI/CD ni webhooks. El procedimiento estándar es:

### 5.1. Antes de desplegar (en local)

```bash
git status                       # asegúrate de tener todo limpio
git push origin main             # los cambios deben estar en GitHub
```

### 5.2. En el servidor

```bash
ssh root@completa

# 1) Traer el código nuevo
cd /opt/calendar-web/repo
git fetch --all
git status                       # comprobar rama y limpieza
git pull --ff-only origin main

# 2) (Opcional) Aplicar migraciones de Prisma si cambió el schema
#    Se ejecutan dentro del contenedor tras reconstruirlo, ver paso 4.

# 3) Reconstruir y relanzar el contenedor
cd /opt/calendar-web
docker compose up -d --build

# 4) Migraciones Prisma (solo si el schema cambió)
docker compose exec calendar-web npx prisma migrate deploy

# 5) Comprobar que arrancó bien
docker compose ps
docker compose logs -f --tail=100 calendar-web
```

### 5.3. Verificación final

- Abrir `http://<servidor>:55600` y comprobar la versión / cambios.
- Si tocó cron o correos, validar con `npm run test:resend` (ver [guía de correos](./GUIA-DESPLIEGUE-SERVIDOR-CORREOS.md)).

### 5.4. Si hubo cambios en el `Dockerfile.runtime`

Como **no está versionado**, hay que editarlo a mano en el servidor:

```bash
ssh root@completa
nano /opt/calendar-web/repo/Dockerfile.runtime
cd /opt/calendar-web && docker compose up -d --build
```

> **Recomendación a futuro**: versionar `Dockerfile.runtime` en el repo (o renombrarlo a `Dockerfile`) para que no se pierda y para que los cambios queden en el historial de git.

### 5.5. Si hubo cambios en el `.env`

```bash
ssh root@completa
cd /opt/calendar-web
cp .env .env.bak.$(date +%Y%m%d-%H%M%S)   # backup antes de tocar
nano .env
docker compose up -d                       # recrea el contenedor con el nuevo env
```

---

## 6. Operaciones útiles

```bash
# Ver estado de los tres contenedores
ssh root@completa "docker ps --filter name=calendar-app"

# Logs en vivo de la app
ssh root@completa "cd /opt/calendar-web && docker compose logs -f --tail=200 calendar-web"

# Reiniciar solo la web (sin rebuild)
ssh root@completa "cd /opt/calendar-web && docker compose restart calendar-web"

# Entrar al contenedor de la app
ssh root@completa "docker exec -it calendar-app-web sh"

# Conectar a Postgres (psql desde el contenedor de la BD)
ssh root@completa "docker exec -it calendar-app-postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB>"

# Adminer vía túnel SSH (luego abrir http://localhost:55880)
ssh -L 55880:127.0.0.1:55880 root@completa
```

---

## 7. Backups y datos persistentes

- **Datos de Postgres**: volumen Docker `calendar-db_calendar_pgdata` (en `/var/lib/docker/volumes/`).
- **No** hay backup automático configurado. Para hacer un dump manual:

```bash
ssh root@completa "docker exec calendar-app-postgres \
  pg_dump -U <POSTGRES_USER> <POSTGRES_DB>" \
  > backup-$(date +%Y%m%d).sql
```

Restaurar:

```bash
cat backup-YYYYMMDD.sql | ssh root@completa \
  "docker exec -i calendar-app-postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB>"
```

> Recomendado: programar un `cron` semanal que haga `pg_dump` y lo copie fuera del servidor.

---

## 8. Solución de problemas

| Síntoma | Diagnóstico / acción |
|---------|----------------------|
| `docker compose up --build` falla en `next build` | Comprobar que `RESEND_API_KEY=dummy-build-key` siga en el `Dockerfile.runtime`. Revisar logs: `docker compose logs calendar-web`. |
| La app responde pero no hay datos | El contenedor no llega a Postgres. Verifica `DATABASE_URL` en `.env` y que `calendar-app-postgres` esté **healthy**. |
| Error de migraciones / columnas faltantes | `docker compose exec calendar-web npx prisma migrate deploy`. |
| Correos no se envían | Ver [`GUIA-DESPLIEGUE-SERVIDOR-CORREOS.md`](./GUIA-DESPLIEGUE-SERVIDOR-CORREOS.md), sección de Resend. |
| `git pull` rechaza con conflicto | El servidor solo debe tener el `Dockerfile.runtime` untracked. Si aparecen otros cambios locales, **no** hacer `reset` sin antes preguntar: pueden ser parches manuales en caliente. |
| Quedó una imagen vieja ocupando espacio | `docker image prune -f` (cuidado: borra todas las imágenes huérfanas). |

---

## Resumen en una línea

> El código vive en `/opt/calendar-web/repo` (clon de `main` desde GitHub), se construye con un `Dockerfile.runtime` local y se despliega con `git pull && docker compose up -d --build` desde `/opt/calendar-web` tras conectarse por `ssh root@completa`.
