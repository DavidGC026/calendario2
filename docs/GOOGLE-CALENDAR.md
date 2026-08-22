---
title: Sincronización con Google Calendar
lang: es
fecha: 2026-08-21
ultima_revision: 2026-08-21
---

# Sincronización con Google Calendar

| Campo | Valor |
|-------|-------|
| **Fecha** | `2026-08-21` |
| **Alcance** | Dos direcciones, cada 5 minutos, por cron |
| **Recurrentes** | Se ven aquí (instancias expandidas), pero son de solo lectura |

## Lo que hay que hacer en Google Cloud

Sin estos cinco pasos no funciona nada, y el tercero es el que se olvida.

1. **Habilitar la Google Calendar API** en el proyecto.
2. **Añadir la URI de redirección** `{NEXTAUTH_URL}/api/google-calendar/callback`
   al cliente OAuth de tipo «Aplicación web». En producción:
   `https://calendario.dvguzman.com/api/google-calendar/callback`. Es **distinta**
   de la del login (`/api/auth/callback/google`); hacen falta las dos.
3. **Publicar la app como «In Production»** en la pantalla de consentimiento.
   Esto es lo importante: con el estado en *Testing*, Google **revoca el refresh
   token a los siete días**, así que la sincronización funcionaría una semana y
   moriría. En producción ese límite no existe.
4. **Añadir el scope** `https://www.googleapis.com/auth/calendar.events`.
5. Nada más. **La verificación de Google es opcional**: sin ella, quien conecte su
   cuenta verá una pantalla de «Google no ha verificado esta app» y el proyecto
   tiene un tope de 100 usuarios para toda su vida. Para uso personal sobra.
   `calendar.events` es un scope *sensible*, no *restringido*: si algún día se
   verifica, hace falta formulario, vídeo y política de privacidad, pero **no**
   auditoría de seguridad externa.

> El atajo de «Internal» (sin verificación ni tope) solo existe si el dominio
> está en Google Workspace. `dvguzman.com` tiene el correo en Hostinger, así que
> aquí la app es «External» y toca lo de arriba.

En el `.env` no hace falta nada nuevo: se reutilizan `GOOGLE_CLIENT_ID` y
`GOOGLE_CLIENT_SECRET` del login. Sí importa que **`EVENT_TIMEZONE` sea correcta**
(ver más abajo).

## Cómo se conecta

El permiso de calendario **no** se pide dentro del «Entrar con Google». Es un
flujo aparte, en **Ajustes → Google Calendar → Conectar con Google**, por dos
razones: quien solo quiere iniciar sesión no tiene por qué dar acceso a su
agenda, y quien entra con correo y contraseña también puede sincronizar.

La vuelta guarda un *refresh token* cifrado (`lib/secret-box.ts`, AES-256-GCM).
Ese token es la llave de la agenda de una persona durante meses: en claro, una
copia de la base de datos sería una copia de las agendas de todo el mundo.

## Desde el teléfono

La app de Android no habla con Google ni guarda credenciales suyas: quien
sincroniza sigue siendo el servidor, cada pocos minutos. Desde el móvil solo se
conecta la cuenta, se empuja una pasada y —sobre todo— **se ve si funciona**.

### El nudo: un JWT no viaja en una pestaña del navegador

En la web, conectar es redirigir a `/api/google-calendar/connect`, que sabe quién
eres porque el navegador lleva la cookie de sesión. La app no tiene cookie: lleva
un JWT en una cabecera. Si abriera `/connect` en el navegador del teléfono,
llegaría sin identificar y Google no sabría de quién es el permiso.

La salida es un traspaso firmado, y cabe en la llamada que la app ya necesita
hacer:

1. La app pide `GET /api/google-calendar` **con su Bearer**.
2. La respuesta trae, además del estado, un `connectUrl`: la dirección de Google
   ya montada, con un `state` firmado que identifica al usuario durante diez
   minutos.
3. La app abre esa dirección **en el navegador del sistema**.
4. Google vuelve a `/api/google-calendar/callback`, que se identifica por ese
   `state` y **no necesita ninguna sesión** — ya funcionaba así desde el principio.

No hizo falta un flujo aparte ni una ruta nueva: el `connectUrl` viaja en el
estado, que es justo lo que la pantalla iba a pedir de todas formas.

### En el navegador, no en un WebView

El permiso se concede en el dominio de Google, con la barra de direcciones a la
vista. Meterlo en un WebView dentro de la app se ve más integrado y es
exactamente lo que enseña a la gente a escribir su contraseña de Google en
cualquier pantalla que se la pida.

### Qué se ve

`ui/google/GoogleCalendarSheet.kt`, desde el menú ⋮ → **Google Calendar**:
la cuenta conectada, **la última sincronización correcta** y **el último fallo**,
más conectar, sincronizar ahora y desconectar. Los dos datos del medio son la
razón de que la pantalla exista: una sincronización rota no se nota —el
calendario sigue lleno— hasta que falta una cita.

| Qué | Dónde |
|-----|-------|
| Estado y `connectUrl` | `app/api/google-calendar/route.ts` |
| Llamadas de la app | `data/ApiService.kt`, `data/Models.kt` |
| La hoja | `ui/google/GoogleCalendarSheet.kt` |
| El enganche | `ui/calendar/CalendarScreen.kt` (menú ⋮) |

## Las zonas horarias, que es donde esto se rompe

El contenedor de producción corre en **UTC** y `EVENT_TIMEZONE` es
`America/Mexico_City`. La convención, ahora explícita:

> **La hora guardada es hora de pared en `EVENT_TIMEZONE`.** Un evento a las
> "14:00" son las dos de la tarde donde vive su dueño.

Por eso al subir se le dice a Google la zona en voz alta
(`{ dateTime: "2026-08-25T14:00:00", timeZone: "America/Mexico_City" }`) y al
bajar se traduce el instante de Google a hora de pared de esa misma zona. Sin ese
par de conversiones, una comida de las dos aparece en el teléfono a las ocho de
la mañana.

> **Pendiente, previo a esto:** `eventDateInAppTimezone()` (en
> `lib/event-timezone.ts`) convierte el instante guardado a `EVENT_TIMEZONE` como
> si estuviera en UTC, así que a un evento entre las 00:00 y las 05:59 le atribuye
> el día anterior y su recordatorio diario sale el día equivocado. Afecta solo a
> los recordatorios por correo de eventos de madrugada. No se ha tocado aquí.

## Cómo funciona una pasada

Siempre en este orden, y no es casual: bajar primero pisaría lo que el usuario
acaba de escribir aquí, porque su cambio todavía no ha llegado allá.

1. **Borrados de aquí → Google.** Al borrar un evento se deja una *lápida*
   (`GoogleDeletion`), porque con la fila desaparece el `googleEventId` y sin él
   nadie sabe qué borrar. Llamar a Google en el momento del borrado tampoco
   bastaría: si esa petición falla, el evento se queda vivo en Google para
   siempre y nadie se entera.
2. **Cambios de aquí → Google.** «Cambiado» es `updatedAt > googleSyncedAt`.
3. **Cambios de Google → aquí**, con `syncToken` incremental: Google devuelve solo
   lo que cambió. Sin testigo —la primera vez, o tras un 410— una pasada completa
   acotada a −90 / +400 días.

> **Corregido el 2026-08-21.** La ventana se aplicaba solo al recuperarse de un
> 410, no en la primera sincronización: la primera pasada pedía el calendario
> entero y en la agenda aparecieron eventos de 2023. Con `singleEvents: true` eso
> es peor de lo que suena —una serie «todos los lunes desde 2019» se expande
> instancia por instancia— y además cada evento viejo se queda después en el
> contexto de la IA, que lo manda entero en cada mensaje. Se detectó midiendo
> cuánto ocupaba ese contexto, no por un fallo visible.

### El eco

Al subir un evento, Google lo devuelve en la bajada siguiente. Aplicarlo sin
mirar movería `updatedAt`, el evento volvería a parecer modificado, se subiría
otra vez y así **doce veces por hora, para siempre**. Se corta con dos cosas:

- **Comparación de contenido**: si lo que baja es igual a lo que hay, no se
  escribe nada; solo se marca como igualado.
- **`markSynced` con SQL directo**: `SET "googleSyncedAt" = "updatedAt"`. Por el
  camino normal de Prisma sería imposible, porque `@updatedAt` lo aplica el
  cliente en cada `update` y la propia marca de «ya está sincronizado» volvería a
  ensuciar el evento.

`npm run test:google-sync` comprueba justamente eso: tres pasadas seguidas sin que
nada rebote.

## Lo que no cabe

El modelo `Event` guarda un evento **dentro de un día**, así que:

| Caso | Qué pasa |
|------|----------|
| Evento normal | Sincroniza en los dos sentidos. |
| Todo el día | Entra como 00:00–23:59 de ese día. |
| **De varios días** | **Se omite**, y se cuenta en `skipped`. Antes que recortarlo a las 23:59 y que parezca otra cosa, se deja fuera. |
| Recurrente de Google | Entra expandido en instancias sueltas (`singleEvents: true`), marcado `googleRecurring`. **No se sube de vuelta**: devolver el cambio de una repetición suelta a su serie rompe el calendario del otro lado. |

Soportar de verdad los recurrentes y los de varios días significa añadir `RRULE` y
eventos multidía al modelo y a la interfaz: es una función del calendario, más
grande que esta sincronización.

## Al desplegar

```bash
docker compose exec calendar-web npx prisma migrate deploy
```

Y una línea más en el crontab, junto a las que ya hay:

```cron
*/5 * * * * /opt/calendar-web/cron/run-cron.sh /api/cron/google-sync
```

## Dónde está

| Qué | Dónde |
|-----|-------|
| Modelos | `GoogleCalendarLink`, `GoogleDeletion` y los campos `google*` de `Event` |
| Migración | `prisma/migrations/20260821180000_google_calendar_sync/` |
| Cliente de la API | `lib/google-calendar-api.ts` (con `fetch`, sin `googleapis`) |
| Motor | `lib/google-calendar-sync.ts` |
| Estado del OAuth | `lib/google-calendar-link.ts` (el `state` firmado) |
| Rutas | `app/api/google-calendar/…` y `app/api/cron/google-sync/` |
| Interfaz | `components/google-calendar-card.tsx` |
| Comprobación | `npm run test:google-sync` |
| El panel de IA que lee estos eventos | [`PANEL-DE-IA.md`](./PANEL-DE-IA.md) |

## Qué hacer cuando falle

Ajustes enseña siempre **la última sincronización correcta** y **el último fallo**.
Es a propósito: una sincronización rota no se nota —el calendario sigue ahí, con
sus eventos— hasta que falta una cita, así que un «conectado» a secas puede llevar
tres semanas mintiendo.

Si Google retira el permiso (`invalid_grant`), la sincronización **se apaga** en vez
de reintentar cada cinco minutos, y la tarjeta pide reconectar. Insistir no lo
arregla nunca; reconectar sí.
