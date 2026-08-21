---
title: Paleta rojo-azul y fondo personalizable
lang: es
fecha: 2026-08-21
ultima_revision: 2026-08-21
---

# Paleta rojo-azul y fondo personalizable

| Campo | Valor |
|-------|-------|
| **Fecha** | `2026-08-21` |
| **Ámbito** | UI web (Next.js) y app Android |
| **Motivo** | El chrome era azul + violeta (se leía morado). Se pidió rojo con azul, y poder cambiar la imagen de fondo desde Ajustes. |

Este documento cubre **qué** cambió, **por qué**, y **dónde** está el código. No hace falta migración de base de datos ni variables de entorno nuevas.

---

## Índice

- [1. Decisión](#1-decisión)
- [2. Paleta](#2-paleta)
- [3. Fondo personalizable (web)](#3-fondo-personalizable-web)
- [4. Android](#4-android)
- [5. Archivos tocados](#5-archivos-tocados)
- [6. Límites conocidos](#6-límites-conocidos)

---

## 1. Decisión

El calendario ya tenía un look oscuro con cristal (`glass`) y una foto de fondo. El acento del chrome (botones, FABs, “hoy”, overlays, login) era **sky + violet**. Eso se veía azul-morado, no rojo-azul.

**Qué se cambió**

- Acentos de interfaz: `rose` (rojo) + `blue`.
- Overlay del fondo: halo rojo arriba-izquierda y azul abajo-derecha.
- Foto por defecto: atardecer (faro / costa), más coherente con la paleta.
- En Ajustes (web): elegir escena, subir foto propia o volver al fondo por defecto.

**Qué no se cambió**

Los **carriles de eventos** siguen igual, porque son semántica de calendario, no de marca:

| Clase Tailwind | Uso |
|----------------|-----|
| `bg-blue-500` | Mi calendario |
| `bg-green-500` | Trabajo |
| `bg-orange-500` | Personal |
| `bg-purple-500` | Familia |

El botón de Google se deja blanco (branding de Google).

**Por qué no se guarda el fondo en Postgres**

En Android el fondo ya vivía en preferencias locales. En web se replica el mismo criterio: es una preferencia de dispositivo. Una foto comprimida cabe en `localStorage`; subirlo al servidor implicaría storage, CORS y copias por usuario sin que nadie lo pidiera.

---

## 2. Paleta

Tokens que usa el chrome. Los hex coinciden con Tailwind `rose-*` y `blue-*`.

| Rol | Tailwind / Compose | Hex |
|-----|--------------------|-----|
| Rojo CTA | `rose-600` | `#e11d48` |
| Rojo acento | `rose-500` / `rose-400` | `#f43f5e` / `#fb7185` |
| Azul CTA | `blue-600` | `#2563eb` |
| Azul acento | `blue-500` / `blue-400` | `#3b82f6` / `#60a5fa` |
| Base | `slate-950` | `#020617` |

Degradado primario (botones, FAB de IA, CTAs):

```
from-rose-600 to-blue-600
```

En Android: `primaryGradient()` en `Glass.kt` (`Rose600` → `Blue600`). El FAB de crear evento es azul sólido (`Blue600`) para distinguirlo del de IA.

Pantallas con overlay de carga (admin, notas, spinner de sesión):

```
from-rose-950/90 via-slate-950 to-blue-950/90
```

Correos transaccionales (`lib/email.ts`): acento por defecto `#e11d48` → `#2563eb`. El color del evento (carril) sigue mandando cuando el mail es de un evento concreto.

---

## 3. Fondo personalizable (web)

### Dónde se cambia

Panel **Ajustes** (sheet de la derecha en el calendario). Sección **Fondo**.

Tres acciones:

1. Elegir una de las 4 escenas (miniaturas).
2. **Subir foto** (JPG/PNG u otro `image/*` del dispositivo).
3. **Por defecto** (vuelve al atardecer).

### Escenas

Definidas en `lib/wallpaper.ts`:

| id | Etiqueta ES / EN | Foto |
|----|------------------|------|
| `dusk` | Atardecer / Dusk | Unsplash `photo-1495616811223-4d98c6e9c869` (por defecto) |
| `peaks` | Cumbres / Peaks | Unsplash `photo-1506905925346-21bda4d32df4` (fondo anterior) |
| `coast` | Costa / Coast | Unsplash `photo-1507525428034-b723cf961d3e` |
| `night` | Noche / Night | Unsplash `photo-1419242902214-272b3f66ee7a` |

### Persistencia

Clave en `localStorage`:

```
calendar-app-wallpaper:<userId>
```

Si no hay sesión, el sufijo es `anon`. El valor es o una URL `https://` (escena) o un `data:image/jpeg;base64,...` (foto subida).

La foto propia se comprime en canvas a JPEG: lado máximo 1920 px, calidad ~0.78 (baja hasta 0.4 si hace falta). Si el data URL supera ~4 MB, se rechaza y se pide una imagen más ligera.

### Componentes

| Archivo | Rol |
|---------|-----|
| `lib/wallpaper.ts` | Presets, lectura/escritura, compresión |
| `components/app-wallpaper.tsx` | Capa de fondo + overlays rojo/azul |
| `components/wallpaper-picker.tsx` | UI de Ajustes |
| `app/page.tsx` | Estado `wallpaperSrc` y el picker en el sheet |

`AppWallpaper` también cubre login, registro y recuperar contraseña (fondo por defecto, más oscuro: `dimmer`). Admin y notas no usan foto; solo el degradado rose → blue sobre slate.

`next.config.mjs` ya tiene `images.unoptimized: true`, así que las URLs de Unsplash y los data URL no requieren `remotePatterns` extra. El data URL se pinta con `<img>`, no con `next/image`.

---

## 4. Android

El selector de fondo **ya existía** en el menú del calendario (“Cambiar fondo…” / “Restablecer fondo”) vía `PreferencesStore` (`background_uri`). Este cambio solo alinea paleta y foto por defecto.

| Pieza | Cambio |
|-------|--------|
| `DvgColors` / `Theme.kt` | Primario `Rose500`, secundario `Blue500` |
| `Glass.kt` `primaryGradient()` | `Rose600` → `Blue600` (antes violet → sky) |
| `AppBackground.kt` | Halos rose y blue; URL por defecto = atardecer |
| `PreferencesStore.DEFAULT_BACKGROUND_URL` | Misma URL que `DEFAULT_WALLPAPER` en web |
| Vistas / FABs / login | `Sky*` y `Violet*` de chrome sustituidos por `Rose*` / `Blue*` |

Un fondo elegido en el teléfono **no** se sincroniza con la web (ni al revés). Cada cliente guarda el suyo.

Los colores de carril en `CalendarUtils.kt` (incluido el morado de Familia) no se tocan.

---

## 5. Archivos tocados

**Nuevos**

- `lib/wallpaper.ts`
- `components/app-wallpaper.tsx`
- `components/wallpaper-picker.tsx`
- `docs/UI-PALETA-ROJO-AZUL-Y-FONDO.md` (este archivo)

**Web (paleta + fondo)**

- `app/page.tsx`
- `app/login/page.tsx`, `app/register/page.tsx`, `app/login/forgot-password/page.tsx`
- `app/admin/page.tsx`, `app/notas/page.tsx`
- `components/calendar-sidebar.tsx`, `calendar-week-grid.tsx`, `mobile-bottom-nav.tsx`
- `components/contacts-manager.tsx`, `admin-users-panel.tsx`, `admin-notes-manager.tsx`, `markdown-content.tsx`
- `lib/email.ts`

**Android**

- `ui/theme/Theme.kt`
- `ui/components/Glass.kt`, `AppBackground.kt`, `BottomNav.kt`
- `data/PreferencesStore.kt`
- `ui/calendar/CalendarScreen.kt`, `DayView.kt`, `WeekView.kt`, `MonthView.kt`
- `ui/event/EventSheet.kt`, `ui/ai/ChatSheet.kt`
- `MainActivity.kt`

---

## 6. Límites conocidos

- El fondo web es **por navegador y por `userId`**. Borrar datos del sitio lo restablece.
- Un JPG enorme o un HEIC que el canvas no sepa pintar falla con el mensaje de “prueba con un JPG o PNG más ligero”.
- `localStorage` tiene techo (~5 MB por origen). Por eso se comprime; no hay fallback a IndexedDB.
- Login / registro / recuperar contraseña muestran el fondo **por defecto**, no el de la cuenta (aún no hay `userId`).
- Quien ya tenía el fondo de montañas en Android sigue viéndolo hasta que pulse “Restablecer fondo”.
