# Calendario Android (nativo)

Cliente **Kotlin + Jetpack Compose** alineado con el estilo oscuro de la web (slate + acentos cielo/violeta).

## Requisitos

- Android Studio Ladybug o superior (JDK 17).
- Servidor con HTTPS y la API del monorepo desplegada (incluye `POST /api/mobile/login` y JWT Bearer).

## Configurar la URL del servidor (importante)

La app **no** habla con PostgreSQL ni con Adminer por HTTPS: habla con la **misma API REST que la página web** (`/api/events`, `/api/mobile/login`, etc.). Esa API es la que usa la base de datos por detrás.

| Debes usar | No uses para la app |
|------------|---------------------|
| La URL en la que **abres el calendario en el navegador** (origen `https://…` donde responde Next.js) | Una URL que sea **solo** la base de datos o solo Adminer (suelen ser otros host o puertos) |

Por defecto el proyecto usa `https://calendar-db.dvguzman.com` como `API_BASE_URL`. **Solo es correcto** si ese dominio hace de proxy a la aplicación Next.js (mismas rutas `/api/...` que en la web). Si tu web está en otro host (por ejemplo solo `https://calendario.dvguzman.com`), cambia el valor por defecto en `app/build.gradle.kts` o pásalo al compilar:

```bash
./gradlew :app:assembleDebug -PCALENDARIO_API_BASE_URL=https://tu-dominio-real
```

(Sin barra final.)

**Cómo comprobar:** en el navegador abre `https://TU-DOMINIO/api/events` sin sesión: debe responder `401` o JSON de error de auth, **no** una página de Adminer ni error de conexión a Postgres.

## Abrir el proyecto

1. **File → Open** y elige la carpeta `android-app`.
2. Si falta el *Gradle Wrapper*, Android Studio ofrece generarlo; acepta, o ejecuta en la raíz `android-app`: `gradle wrapper` (si tienes Gradle instalado).
3. Sincroniza Gradle y ejecuta en un dispositivo o emulador **API 26+**.

## Funciones

- **Login** con el mismo correo y contraseña que en la web.
- **Lista de eventos** desde `GET /api/events` (autenticación `Authorization: Bearer <jwt>`).
- **Recordatorios locales:** al iniciar sesión y al pulsar la campana se programan alarmas con `AlarmManager`:
  - aviso el **día del evento ~8:00** (hora local del teléfono);
  - aviso **X minutos antes** si el evento tiene `reminderMinutesBefore` y `emailRemindersEnabled` no es `false`.
- Tras **reiniciar el teléfono**, `BootReceiver` vuelve a cargar eventos y reprograma alarmas si hay token guardado.

## Permisos

- `POST_NOTIFICATIONS` (Android 13+): se solicita al abrir la app.
- **Alarmas exactas:** en Android 12+ puede hacer falta conceder “Alarmas y recordatorios” en Ajustes del sistema para que las horas sean fiables.

## Notas

- Las notificaciones son **locales en el móvil**; los correos Resend siguen dependiendo del servidor. Ambos pueden convivir.
- La zona horaria usada es la del dispositivo; alineala con `EVENT_TIMEZONE` del backend si necesitas coincidencia exacta con los correos.
