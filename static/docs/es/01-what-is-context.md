# ¿Qué es la ventana de contexto?

> La ventana de contexto es la memoria de trabajo de Claude en una sesión: todo lo que puede "ver" en este momento, medido en tokens.

## Una analogía sencilla

Imagina un escritorio. Todo lo que Claude necesita para tu tarea tiene que caber encima: sus instrucciones, las notas de tu proyecto, los archivos que ha abierto y toda la conversación hasta ahora. El escritorio tiene un tamaño fijo. Cuando se llena, los papeles más antiguos se resumen en una nota corta para dejar sitio a los nuevos.

Ese escritorio es la **ventana de contexto**. Su tamaño se mide en **tokens** (pequeños fragmentos de texto). Según el modelo, la ventana puede llegar a 1 millón de tokens.

## Qué la llena

Algunas cosas se cargan antes de que escribas nada:

- **System prompt**: las instrucciones base de Claude Code.
- **Herramientas**: las definiciones de las herramientas integradas, como leer archivos o ejecutar comandos.
- **Herramientas MCP**: de cada servidor MCP conectado solo se cargan al principio los nombres de las herramientas y sus instrucciones. El esquema completo se carga cuando Claude necesita una herramienta concreta.
- **Skills**: la descripción corta de cada skill. El contenido completo solo se carga cuando se usa.
- **Memoria**: tus archivos `CLAUDE.md` y la memoria automática.

Después, mientras trabajas, se añade más:

- **Tus mensajes** y **las respuestas de Claude**.
- **Llamadas a herramientas y sus resultados**: cada archivo que Claude lee y cada salida de comando acaba en el contexto. Suelen ser lo que más ocupa.

## Por qué importa

En cada petición se vuelve a enviar toda la conversación. Así que un contexto más grande significa:

- Más tokens en cada turno, incluso con la caché de prompts.
- Más ruido. El contenido viejo o sin relación puede distraer a Claude de lo que importa ahora.

## Autocompactación

Normalmente no te chocarás contra un muro. Cuando la conversación se acerca al límite, Claude Code **compacta automáticamente**: sustituye el historial antiguo por un resumen estructurado. El resumen conserva tus peticiones y los fragmentos de código clave, pero las instrucciones detalladas del principio pueden perderse. Por eso las reglas permanentes van en `CLAUDE.md`, que se vuelve a cargar desde disco tras compactar.

El momento exacto en que se compacta depende del modelo y de tu configuración. Puedes cambiarlo con `/autocompact`.

## Revisa tu propia sesión

Ejecuta esto dentro de Claude Code cuando quieras:

```
/context
```

Muestra en vivo qué está ocupando espacio, por categorías, con sugerencias de optimización. También indica qué archivos `CLAUDE.md` y de memoria automática se cargaron. Usa `/context all` para ver el desglose elemento por elemento.

## Consejos rápidos

- Ejecuta `/context` cuando una sesión vaya lenta o parezca "olvidar" cosas.
- Las lecturas de archivos grandes y las salidas largas de comandos son lo que más espacio come.
- Pon las reglas que siempre deben cumplirse en `CLAUDE.md`, no en un mensaje al principio del chat.
- Empieza con un contexto limpio usando `/clear` cuando cambies a otra tarea.

## Más información

- [Explore the context window](https://code.claude.com/docs/en/context-window)
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [Extend Claude Code: context costs](https://code.claude.com/docs/en/features-overview)
- [Commands reference](https://code.claude.com/docs/en/commands)
