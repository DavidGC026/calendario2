# Calendario Android (nativo)

Cliente **Kotlin + Jetpack Compose** alineado con el estilo oscuro de la web (slate + acentos cielo/violeta).

## Requisitos

- Android Studio Ladybug o superior (JDK 17).
- Servidor con HTTPS y la API del monorepo desplegada (incluye `POST /api/mobile/login` y JWT Bearer).

## Configurar la URL del servidor

En `app/build.gradle.kts`, `defaultConfig` usa `CALENDARIO_API_BASE_URL` o el valor por defecto `https://example.com`.

**Recomendado:** al generar el APK o desde la línea de comandos:

```bash
./gradlew :app:assembleDebug -PCALENDARIO_API_BASE_URL=https://tu-dominio.com
```

(Sin barra final; debe coincidir con el origen público de tu Next.js.)

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
