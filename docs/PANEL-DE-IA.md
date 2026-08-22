---
title: El panel del asistente de IA
lang: es
fecha: 2026-08-21
ultima_revision: 2026-08-21
---

# El panel del asistente de IA

| Campo | Valor |
|-------|-------|
| **Fecha** | `2026-08-21` |
| **Alcance** | Modelo, jerarquía visual y formato de las respuestas |
| **Motivo** | «Se ve muy plano y el estilo medio chafa», y el modelo se había quedado dos generaciones atrás |

## 1. Un solo modelo, y actual

Antes había dos: `gpt-4o-mini` para texto y `gpt-4o` en cuanto llegaba una imagen.
Esa bifurcación existía solo porque el barato no veía, y traía el riesgo callado
de que las dos mitades del panel se comportaran distinto sin que nadie supiera
por qué.

Ahora es **`gpt-5.6-luna`** para todo. Se comprobó contra la cuenta antes de
cablearlo —no de memoria— que sabe hacer las dos cosas que este panel necesita:

```
llamada a herramientas .... sí (por /v1/responses)
lectura de imágenes ....... sí
```

> **Detalle que costó encontrar:** por `/v1/chat/completions`, este modelo rechaza
> las herramientas salvo con `reasoning_effort: "none"`. Da igual, porque
> `openai(modelId)` del SDK usa la API **Responses**, donde funcionan sin
> configuración. Si alguien mueve esto a `openai.chat(...)`, se romperá con un
> «Function tools with reasoning_effort are not supported» que no dice de dónde
> viene.

## 2. Por qué se veía plano

No era falta de adornos. Era que **todo pesaba lo mismo**: las palabras del
usuario, las del asistente y un cambio de verdad en su calendario llevaban
exactamente la misma caja gris (`rounded-lg border-white/10 bg-white/[0.06]`).
Cuando nada destaca, lo único que importaba —que acaba de aparecer un evento el
jueves— quedaba enterrado entre dos párrafos.

Y encima el nombre de la herramienta salía en crudo: `createEvent`,
`searchContact`. Eso es el nombre que le pusimos los programadores, en inglés;
leerlo es ver el registro del servidor asomando por la interfaz.

## 3. Tres pesos, y solo tres

`components/ai-chat-stream.tsx`:

1. **El usuario** habla dentro de una burbuja alineada a la derecha. Es lo que
   dijo y ya pasó.
2. **El asistente no lleva burbuja.** Su texto va a todo el ancho, como voz del
   panel. Quitarle la caja es lo que deja sitio para lo tercero, y es la decisión
   de la que cuelga todo el rediseño.
3. **Lo que cambió** se pinta como **ficha del evento**: la misma barra de color
   del calendario al que fue, el título, y la fecha y hora en monoespaciada con
   cifras tabulares. Es una miniatura de la cosa que ahora existe en la agenda.

La hora en monoespaciada no es un capricho: dos fichas seguidas alinean sus
columnas y el hilo se lee hacia abajo como una agenda.

El nombre del calendario («Personal», «Familia») va escrito además del color,
porque el color solo no sirve para quien no lo distingue.

## 4. Lo que se quitó

Tanto como lo que se añadió:

- **El párrafo de ayuda permanente.** Ocupaba cuatro líneas para siempre; ahora es
  el estado vacío y desaparece en cuanto hay conversación.
- **El detalle de las herramientas de consulta.** «Hay solapamientos en ese
  horario» iba seguido del asistente diciendo «a esa hora choca con otra cosa»:
  el mismo hecho contado dos veces, y la segunda es la que se iba a leer de todos
  modos. Ahora solo queda la etiqueta de estado, en gris pequeño.
- **El texto largo del botón de borrar historial**, que ocupaba media cabecera.
  Reducido a su icono, con `aria-label`.

## 5. Arreglos de bulto

- **El título se salía por arriba** y quedaba pisado por el botón de borrar. Una
  sola fila, sin envolver, con `pt-1` y `pr-8` para dejar sitio a la ✕.
- **El panel no tenía suelo propio**: con `bg-slate-950/98` se transparentaba el
  calendario de detrás, y el FAB azul del «+» se veía como una mancha encima del
  campo de escritura. Ahora lleva un degradado opaco propio, que además es parte
  de darle profundidad.
- **El marcador del campo se cortaba** a media palabra en el móvil, donde comparte
  fila con tres botones. «Escribe o dicta…» cabe; adjuntar y dictar ya tienen su
  botón al lado con su icono.
- **Las respuestas salían con los asteriscos a la vista.** `gpt-5.6-luna` escribe
  en Markdown y lo pintábamos en crudo. No se reusa `MarkdownContent` porque ese
  está afinado para la página de notas, con títulos grandes y espaciado de
  artículo; aquí hace falta lo contrario, prosa apretada y sin márgenes.

## 6. Dónde está

| Qué | Dónde |
|-----|-------|
| El hilo | `components/ai-chat-stream.tsx` |
| Nombres de herramientas, fichas y fechas | `lib/ai-chat-format.ts` |
| El modelo y las herramientas | `app/api/chat/route.ts` |
| La hoja lateral, cabecera y campo | `app/page.tsx` |

## 7. Lo que sigue pendiente

Se ofrecieron cuatro arreglos más y no se pidieron; quedan anotados porque el
primero empeora solo con el tiempo:

1. **El prompt lleva TODOS los eventos en cada mensaje.** `listEventsForUser()`
   entero va en el mensaje de sistema: tras conectar Google Calendar son 35
   eventos y **16 KB de títulos y notas, de 2023 a 2026**, en cada cosa que se
   escribe. Y crece sin techo. Lo que toca es acotarlo a una ventana de fechas y
   darle al modelo una herramienta de búsqueda para lo de fuera.
2. **La IA no sabe que Google Calendar existe.** No puede decir «esto también
   aparecerá en tu teléfono».
3. **Puede editar un evento recurrente de Google y el cambio desaparece.** El
   motor no sube los recurrentes y la siguiente pasada los sobrescribe: dice que
   sí y no pasa nada. Debería negarse y explicarlo.
4. **No hay búsqueda de eventos**: solo `getEventsForDate`, que es un día suelto.

## 8. Nota sobre la paleta

Este panel se diseñó con los acentos que había entonces —azul para la voz del
usuario, rosa para la del asistente y para lo destructivo— y con los cuatro
colores de calendario, que sí son datos y no decoración. Si la paleta de la
aplicación cambia (ver `docs/UI-PALETA-*`), los azules y rosas de
`ai-chat-stream.tsx` hay que re-tokenizarlos a mano; las barras de color de las
fichas, no: esas deben seguir a `lib/calendar-lanes.ts`.
