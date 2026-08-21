---
title: Llaves de API para programas
lang: es
fecha: 2026-08-21
ultima_revision: 2026-08-21
---

# Llaves de API para programas

| Campo | Valor |
|-------|-------|
| **Fecha** | `2026-08-21` |
| **Ámbito** | API (Next.js), base de datos (Prisma) y Ajustes de la web |
| **Motivo** | Para que un programa entrara al calendario había que darle el correo y la contraseña de la cuenta. Ahora se le da una llave que se revoca sola. |

## Para qué

Un programa que quiera leer o escribir en el calendario —Jarvis, un script, otra
máquina— necesita autenticarse. Las dos vías que ya había servían mal para esto:

- **La sesión web** vive en una cookie de NextAuth: es de un navegador, no de un
  proceso.
- **El JWT de la app móvil** (`POST /api/mobile/login`) sí sirve, pero se pide con
  el correo y la contraseña y caduca a los 60 días. Eso significa dejar la
  contraseña escrita en la configuración del programa, y que retirarle el acceso
  obligue a cambiarla —lo que además echa fuera al teléfono y a la web.

Una llave por programa arregla las dos cosas: no es la contraseña, y se revoca
una a una sin tocar a nadie más.

## Cómo se crea

**Ajustes → «Llaves de acceso para programas»**: se le pone un nombre («Jarvis»)
y se pulsa *Crear llave*.

La llave se enseña **una sola vez**, en ese momento. No se guarda en claro en
ninguna parte —en la base de datos vive su SHA-256—, así que no hay manera de
volver a leerla. Si se pierde, se revoca y se hace otra, que cuesta un botón.

## Cómo se usa

En cualquier ruta de la API, igual que el JWT móvil:

```bash
curl -s https://calendario.dvguzman.com/api/events \
  -H 'Authorization: Bearer cal_…'
```

También se acepta `X-Api-Key: cal_…`, por costumbre de otras APIs.

El prefijo `cal_` no es decorativo: deja distinguir una llave de un JWT en la
cabecera sin ir a la base de datos a probar, y permite que un buscador de
secretos filtrados sepa qué está mirando si alguna acaba en un repositorio
público.

## Qué puede y qué no

Una llave actúa **como su dueño**: ve y modifica sus eventos, sus contactos y sus
amistades, igual que si hubiera iniciado sesión.

Lo único que **no** puede es administrar llaves. Crear una llave nueva o revocar
una existente exige sesión web o JWT móvil —donde hay una contraseña detrás—.
Sin esa regla, una llave filtrada se multiplicaría sola y revocarla no serviría
de nada, porque a esas alturas ya habría hecho tres más.

Tope: 20 llaves activas por cuenta.

## Dónde está

| Qué | Dónde |
|-----|-------|
| Modelo | `prisma/schema.prisma` → `ApiKey` |
| Migración | `prisma/migrations/20260821170000_api_keys/` |
| Lógica | `lib/api-keys.ts` (crear, listar, revocar, resolver) |
| Autenticación | `lib/auth.ts` → `getCurrentUserId({ allowApiKey })` |
| Rutas | `app/api/user/api-keys/` (GET, POST) y `app/api/user/api-keys/[id]/` (DELETE) |
| Interfaz | `components/api-keys-card.tsx`, dentro del panel de Ajustes de `app/page.tsx` |

## Notas de implementación

**El hash es SHA-256 y no bcrypt, a propósito.** bcrypt está pensado para
secretos que elige una persona y adivina un diccionario; una llave son 32 bytes
de `randomBytes`, que no se adivinan. Lo que sí importa aquí es que el hash se
calcule en microsegundos, porque se hace en **cada** petición de la API: bcrypt
añadiría del orden de cien milisegundos a todas.

**`lastUsedAt` se refresca como mucho cada cinco minutos.** Saber qué día dejó de
usarse una llave sirve para decidir si revocarla; escribir en la base de datos en
cada petición no sirve para nada.

**Sin caducidad por omisión.** El modelo admite `expiresAt`, pero la interfaz no
lo pide: un servicio que se apaga solo a los noventa días, sin que nadie se
acuerde de por qué, no es un servicio.

## Al desplegar

Hay migración, así que después de subir el código:

```bash
docker compose exec calendar-web npx prisma migrate deploy
```

Sin eso, la web arranca y falla en cuanto alguien abre Ajustes, porque la tabla
`ApiKey` no existe todavía.
