# Mantén tu contexto ligero

> Las sesiones pequeñas y enfocadas cuestan menos y dan mejores respuestas. Estos hábitos mantienen tu contexto limpio.

## Limpia entre tareas

Cuando pases a algo que no tiene relación, ejecuta `/clear`. Empieza una conversación nueva y vacía, y no cuesta nada. Tu sesión anterior queda guardada y puedes volver con `/resume`.

Ponle nombre a la sesión que dejas para encontrarla después:

```
/clear oauth-migration
```

## Compacta con un enfoque

Si quieres seguir pero el historial es largo, ejecuta `/compact` y dile qué conservar:

```
/compact keep the API changes and the test commands
```

Ojo: en una sesión larga, `/compact` es en sí una petición grande, porque lee toda la conversación para resumirla. Si no necesitas continuidad, `/clear` sale más barato.

También puedes resumir solo una parte: ejecuta `/rewind`, elige un mensaje y selecciona **Summarize from here** o **Summarize up to here**.

## Planifica antes de editar

Para cambios grandes, usa el **modo plan**. Claude lee archivos y propone un plan, pero no edita nada hasta que lo apruebes. Pulsa `Shift+Tab` hasta que la barra de estado muestre el modo plan, o arranca con:

```bash
claude --permission-mode plan
```

Un buen plan evita desvíos, y los desvíos llenan tu contexto de trabajo que acabarás tirando.

## Señala los archivos correctos

- Menciona archivos directamente con `@`, por ejemplo `Explain the logic in @src/utils/auth.js`. Claude recibe ese archivo en lugar de ponerse a buscar.
- Mencionar una carpeta como `@src/components` da un listado de archivos, no su contenido.
- Sé concreto. "Arregla el bug de fechas en `invoice.ts`" funciona mejor que "arregla el bug".

## No vuelques salidas enormes

Los logs largos y las ejecuciones completas de tests entran en el contexto y se quedan ahí. Mejor:

- Pide solo lo importante: "ejecuta los tests y muestra solo los fallos".
- Pasa un log filtrado desde tu terminal: `cat error.log | claude -p "what's going on here"`.
- Para trabajo ruidoso, usa un subagente (siguiente sección).

## Usa subagentes para explorar

Un subagente trabaja en su propia ventana de contexto y solo devuelve un resumen:

```
use a subagent to investigate how our auth system handles token refresh
```

Las lecturas de archivos se quedan en la ventana del subagente, no en la tuya.

## Recorta servidores MCP

Las definiciones de herramientas MCP se cargan bajo demanda por defecto, así que los servidores inactivos cuestan poco. Aun así, ejecuta `/mcp` para ver tus servidores y desactiva los que no uses. Cuando existe una buena CLI (como `gh`), Claude suele poder usarla directamente sin listar herramientas.

## Preguntas rápidas al margen

Usa `/btw` para una pregunta rápida. Responde sin añadir nada al historial de la conversación.

## Consejos rápidos

- Una tarea por sesión. `/clear` cuando cambie el tema.
- Tras dos correcciones fallidas, `/clear` y escribe un prompt mejor.
- Usa `/compact <enfoque>` en pausas naturales, no a mitad de tarea.
- Usa menciones `@archivo` en vez de "mira por el repo".
- Manda búsquedas grandes, logs y tests a un subagente.
- Ejecuta `/context` para ver qué ocupa espacio de verdad.

## Más información

- [Explore the context window](https://code.claude.com/docs/en/context-window)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
- [Best practices](https://code.claude.com/docs/en/best-practices)
- [Common workflows](https://code.claude.com/docs/en/common-workflows)
- [Checkpointing](https://code.claude.com/docs/en/checkpointing)
