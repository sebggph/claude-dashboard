# Compactación: qué es y cómo usarla

> La compactación cambia tu conversación larga por un resumen para que la sesión pueda seguir. Aquí ves qué conserva, qué pierde y cuándo hacerla tú.

## Qué es la compactación

A medida que una sesión crece, la ventana de contexto se llena (ver [¿Qué es la ventana de contexto?](#/guides/01-what-is-context.md)). La **compactación** sustituye el historial de mensajes por un resumen estructurado. El resumen guarda tus peticiones y los fragmentos de código clave, así que sigues en la misma sesión con mucho menos contexto ocupado.

Hay dos tipos:

- **Autocompactación**: Claude Code la hace por su cuenta cuando te acercas al límite, así que una ventana llena no termina tu sesión.
- **Manual**: ejecutas `/compact`, con instrucciones de enfoque si quieres, como `/compact focus on the auth bug fix`.

## Cuándo salta la autocompactación

Si no has cambiado nada, el punto de disparo depende del modelo:

- Los modelos con ventana nativa de 1M (modelos Fable, Sonnet 5 y posteriores, Haiku 5.5, Opus 4.7 y posteriores) compactan hacia los **967K tokens**.
- Sonnet 4.6 y Opus 4.6 sin el contexto extendido `[1m]` compactan en el límite de **200K**.
- Las sesiones en la nube compactan cuando la conversación se acerca al límite del modelo.

Puedes mover ese punto:

- `/autocompact 500k` guarda una ventana para el modelo actual. `/autocompact auto` vuelve al valor por defecto.
- `claude --autocompact 300k` aplica solo a ese arranque.
- `"autoCompactWindow": 200000` en `settings.json` aplica a todos los modelos.
- La variable de entorno `CLAUDE_CODE_AUTO_COMPACT_WINDOW` manda sobre todo lo anterior (útil en scripts).

Los valores van de 100K a 1M tokens. Para desactivar la autocompactación, cambia **Auto-compact** en `/config`.

**Compactación en reposo.** Si una sesión de más de unos 200K tokens queda inactiva cerca de una hora con la caché de una hora, Claude Code puede compactarla justo antes de que caduque la caché. Verás un aviso que empieza por `Compacted while idle`. Desactívala con `"idleCompaction": false` o con la fila **Idle compaction** de `/config`.

Aparte de esto, Claude Code también puede borrar por su cuenta resultados de herramientas antiguos del contexto. Eso no es una compactación completa.

## Qué sobrevive y qué se pierde

Se recarga o se mantiene tras compactar:

- El `CLAUDE.md` de la raíz del proyecto, las reglas sin ámbito y la memoria automática, releídos del disco.
- Las descripciones de skills, más el cuerpo de las skills que usaste (máximo 5.000 tokens cada una y 25.000 en total; las más antiguas se descartan primero).
- Hasta **cinco** archivos modificados recientemente que Claude leyó o editó. Un archivo de más de 5.000 tokens vuelve solo como ruta.
- El plan escrito en modo plan, y los comandos y subagentes que siguen en segundo plano.

Solo queda un resumen de:

- Mensajes de error exactos y salidas largas de comandos.
- Decisiones anteriores y sus motivos ("probamos X y rompió Y").
- Contenido de archivos leídos hace mucho.
- Los matices de instrucciones que diste en el chat, como "no toques nunca la carpeta de migraciones".
- Los `CLAUDE.md` anidados y las reglas con ámbito de ruta. Vuelven cuando Claude toca de nuevo un archivo que coincide.

## Impacto en tu sesión

- **Deriva**: si una regla solo estaba en el chat, Claude puede dejar de seguirla.
- **Relecturas**: Claude puede tener que abrir archivos otra vez, lo que vuelve a sumar tokens.
- **Coste y caché**: el resumen es una petición aparte que lee toda la conversación. Con la caché caliente sale bastante barata. Tras una pausa larga, la caché ya no está y cuesta mucho más. La compactación también reinicia la caché de la conversación, así que el siguiente turno la reconstruye (pero solo para el resumen corto).
- **El bucle de compactación**: en sesiones muy largas, o cuando un archivo o una salida enorme vuelve a llenar el contexto enseguida, compactas una y otra vez y pierdes más detalle cada vez. Claude Code deja de autocompactar tras unos pocos intentos fallidos y muestra un error.

## Ventajas e inconvenientes

| Ventajas | Inconvenientes |
|---|---|
| Sigues sin empezar de cero | Los detalles y matices se pierden en el resumen |
| Libera mucho contexto de golpe | La petición de resumen puede ser cara con la caché fría |
| Con instrucciones de enfoque eliges qué conservar | Las reglas dadas solo en el chat pueden dejar de cumplirse |
| CLAUDE.md y la memoria se recargan solos | Cada compactación repetida difumina más el historial |

## ¿Compactar, limpiar, sesión nueva, rewind o subagente?

| Situación | Mejor opción | Por qué |
|---|---|---|
| Misma tarea, historial largo, necesitas continuidad | `/compact <enfoque>` | Guarda lo importante y libera espacio |
| Pasas a algo sin relación | `/clear` | Es gratis y el historial viejo solo mete ruido |
| Tarea terminada, o la sesión se ha liado | Sesión nueva (o `/clear`) | Empezar limpio es mejor que un resumen borroso |
| Los últimos turnos fueron por mal camino | `/rewind` | Recorta hasta un prefijo que ya está en caché |
| Solo una parte del chat es ruido | `/rewind` + **Summarize from here** | Una compactación dirigida |
| Viene una búsqueda grande, logs o muchas lecturas | Subagente | Las lecturas se quedan en su propia ventana |

Para profundizar en esta elección, mira [¿Cambiar a mitad de sesión o empezar de nuevo?](#/guides/change-or-restart.md).

## Cómo compactar bien

**Elige el momento.** Compacta en una pausa natural: al terminar una función, antes de una fase nueva. Si esperas a la autocompactación, puede saltar en mitad de un paso delicado.

**Di qué conservar.** Sé concreto:

```
/compact keep the final API design, the failing test name and the exact error message
```

```
/compact focus on the decisions we made about the database schema and why; drop the exploration
```

```
/compact keep the list of files changed so far and the remaining TODO steps
```

**Haz que las reglas duren.** Todo lo que deba cumplirse en todo el proyecto va en `CLAUDE.md` (ver [CLAUDE.md y memoria](#/guides/03-claude-md-memory.md)). También puedes añadir ahí una sección "Compact Instructions" que guíe cada resumen:

```
# Compact instructions
When compacting, focus on test output and code changes.
```

Ojo: los cambios en `CLAUDE.md` a mitad de sesión solo se aplican tras `/clear`, `/compact` o un reinicio.

## Cómo detectar la compactación en este panel

- **Gráfico Crecimiento del contexto**: los marcadores **Compactación** muestran dónde se resumió el historial y bajó el tamaño del contexto.
- **Lista de sesiones**: la columna **Compactaciones** las cuenta por sesión.
- **Tarjeta de contexto**: la fila **Resumen de compactación** muestra cuánto ocupa el propio resumen.
- **Recomendaciones**: **Compactas a menudo** aparece cuando una sesión compactó dos o más veces. Es señal de que conviene dividir el trabajo en sesiones más cortas.

Mira [Cómo leer este panel](#/guides/06-reading-the-dashboard.md) para el resto de la pantalla.

## Consejos rápidos

- Compacta en pausas naturales, no a mitad de tarea.
- Añade siempre un enfoque: `/compact keep ...`.
- Si no necesitas continuidad, `/clear` sale más barato que `/compact`.
- Compacta antes de irte, mientras la caché sigue caliente.
- Pasa las reglas del chat a `CLAUDE.md` para que sobrevivan.
- ¿Varias compactaciones en una sesión? Empieza de nuevo.

## Aprende más

- [Explore the context window: qué sobrevive a la compactación](https://code.claude.com/docs/en/context-window)
- [Ajustar la ventana de autocompactación](https://code.claude.com/docs/en/model-config)
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
- [Checkpointing](https://code.claude.com/docs/en/checkpointing)
- [Settings reference](https://code.claude.com/docs/en/settings-reference)
