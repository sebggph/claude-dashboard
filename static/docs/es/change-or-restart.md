# ¿Cambiar a mitad de sesión o empezar de cero?

> Algunos cambios salen gratis a mitad de sesión, otros encarecen y frenan el siguiente turno, y otros solo aplican tras `/clear`.

## Por qué importa

Cada mensaje reenvía la conversación completa. La **caché de prompts** permite que la API reutilice la parte que no cambió, así que se lee más rápido y se cobra a una tarifa menor. La coincidencia empieza desde arriba y tiene que ser exacta: si cambia algo del principio, como el modelo o la lista de herramientas, todo lo que viene después se procesa de nuevo. Ese **fallo de caché** hace que el siguiente turno sea más lento y más caro. Después, la nueva versión queda en caché.

La caché también caduca cuando dejas de trabajar. Con una suscripción de Claude, la conversación principal la mantiene alrededor de **una hora**. Con una clave de API, créditos de uso o un proveedor cloud dura **cinco minutos**. Los subagentes tienen cinco minutos en cualquier caso.

Algunos cambios no rompen la caché porque ni siquiera llegan a la sesión en curso. Las ediciones de CLAUDE.md, por ejemplo, esperan a `/clear`, `/compact` o a reiniciar.

## Tabla de decisión rápida

| Cambio | Qué pasa | ¿Rompe la caché? | Lo recomendable |
| --- | --- | --- | --- |
| `/model` | Cada modelo tiene su propia caché | Sí | Elígelo al inicio |
| `/effort` | El nuevo nivel aplica desde tu siguiente mensaje | Se mantiene en Opus, Sonnet, Haiku 5.5 y Fable 5.1 (clave de API o suscripción). Sí en casi todos los demás | Fíjalo al inicio |
| `/fast` | Caché aparte. Al activarlo por primera vez, la conversación se cobra a tarifa rápida | Sí | Actívalo al inicio |
| `ultrathink` en un prompt | Razonamiento más profundo solo en ese turno | No documentado | Úsalo en vez de cambiar `/effort` para una sola pregunta |
| Activar o quitar un servidor MCP (`/mcp`) | Con tool search (por defecto) la lista de herramientas no cambia. Editar la config espera a reiniciar | Se mantiene con tool search. Sí sin él | Conéctalos antes de empezar |
| Instalar o activar un plugin o skill | Skills, comandos, agentes y hooks se añaden al final | Se mantiene, salvo que añada servidores MCP | Adelante |
| Editar CLAUDE.md | No se aplica a la sesión en curso | Se mantiene | `/clear` para cargarlo |
| Modo de permisos, `Shift+Tab`, modo plan | Aplica al momento | Se mantiene, salvo con `opusplan` | Cámbialo sin miedo |
| `/add-dir` | Acceso a archivos al momento. Casi toda la config de `.claude/` no se carga desde ahí | No documentado | Añádelo cuando lo necesites |
| Estilo de salida | Aplica desde tu siguiente mensaje | Se mantiene | Cámbialo sin miedo |
| Ajustes de `/config` | Casi todos se recargan en vivo. `model` y el esfuerzo se leen al inicio | Depende del ajuste | Usa `/model` y `/effort` para esos dos |
| Cambiar de rama de git | Los archivos cambiados reciben un aviso. La rama es una foto del inicio | Se mantiene | Tarea nueva en esa rama: `/clear` |
| Tarea sin relación | El historial viejo se reenvía en cada turno | No, pero lo pagas | `/clear` |
| Volver tras una pausa larga | La caché caducó | Sí | `/clear` si no necesitas el historial |
| Ventana de `/autocompact` | Se guarda y aplica a esta sesión | No documentado | Configúrala una vez |

## Los cambios importantes

### Modelo

`/model` cambia de modelo y lo guarda como predeterminado. Pulsa `s` en el selector para cambiar solo en esta sesión.

- **Impacto:** la siguiente petición relee todo el historial sin caché. Mientras la caché sigue activa, Claude Code te pide confirmación.
- **Ventajas:** el modelo adecuado para la tarea. **Desventajas:** un turno lento y a precio completo, peor cuanto más larga es la sesión.
- **Recomendación:** elígelo al inicio. Para un encargo puntual con otro modelo, usa un subagente (puede fijar `model: haiku`); la caché principal no se toca. Para usar dos modelos a la vez, abre otra terminal con su propio `--model`.

### Esfuerzo

Define cuánto piensa Claude, de `low` a `max`.

- **Impacto:** la caché se mantiene en los modelos de la tabla. En Bedrock, Google Cloud, gateways y otros modelos, se relee todo.
- **Recomendación:** empieza con el `medium` por defecto. Para una pregunta difícil, añade `ultrathink` a ese prompt.

### Modo rápido

El mismo Opus, hasta 2,5 veces más rápido y con un precio por token mayor. Con suscripción, se paga con créditos de uso.

- **Impacto:** la primera vez que lo activas, todo lo anterior se cobra sin caché a tarifa rápida. Cada cambio posterior vuelve a releer.
- **Recomendación:** decídelo al inicio. Por defecto sigue activo en las siguientes sesiones.

### Servidores MCP

- **Impacto:** con tool search (por defecto en los modelos compatibles), los cambios a mitad de sesión no tocan la caché. Sin él, conectar o desactivar un servidor la invalida. Editar la config de MCP no hace nada hasta reiniciar.
- **Recomendación:** conecta lo que necesites antes del primer mensaje.

### CLAUDE.md

- **Impacto:** se lee una vez al inicio. Editarlo a mitad de sesión mantiene la caché, pero Claude sigue usando la versión vieja.
- **Recomendación:** edítalo y haz `/clear` en una pausa natural. Mira [CLAUDE.md y memoria](/learn/03-claude-md-memory).

### Modo de permisos y modo plan

- **Impacto:** no rompe la caché. Las instrucciones del modo plan llegan como mensajes. La excepción es `opusplan`, que alterna Opus y Sonnet al entrar y salir del modo plan.
- **Recomendación:** cambia cuando te ayude.

### Tarea nueva

- **Impacto:** una sesión con tres tareas sin relación relee las tres en cada turno de la cuarta.
- **Recomendación:** `/clear`, que es gratis. Ponle nombre a lo que dejas: `/clear oauth-migration`.

### Pausa larga

- **Impacto:** el primer turno al volver relee todo. Ahora `/compact` sale más caro que nunca, porque su resumen no puede usar la caché. Con la caché de una hora, una sesión inactiva de más de unos 200K tokens se compacta antes de que caduque.
- **Recomendación:** si no necesitas el historial, `/clear`.

## Reglas prácticas

- Elige modelo, esfuerzo y modo rápido al principio de la sesión.
- Configura los servidores MCP antes de empezar. Reinicia tras editar su config.
- `/clear` entre tareas sin relación, y tras dos correcciones fallidas.
- Una pregunta difícil: `ultrathink`. Una duda rápida sobre la sesión: `/btw`, que queda fuera del historial.
- Trabajo con otro modelo: un subagente u otra terminal, no `/model`.
- Para abandonar un camino, `/rewind`: vuelve a un punto que ya está en caché. Para probar otra dirección sin perder esta, `/branch`.
- `/compact` en pausas naturales mientras la caché sigue activa.

## Cómo verlo en el panel

- **Cambio de modelo a mitad de sesión**: una sesión usó más de un modelo.
- **La caché expiró tras una pausa**: una pausa larga seguida de una gran escritura en caché.
- Tarjeta **Aciertos de caché**: parte de la entrada leída desde caché. Cuanto más alta, mejor.
- Gráfico **Crecimiento del contexto**: pasa el ratón por un punto. Un valor alto en **Nuevo (escritura en caché)** en un turno normal indica un fallo de caché.

Más en [Cómo leer este panel](/learn/06-reading-the-dashboard) y [Compactación explicada](/learn/compaction).

## Consejos rápidos

- `/usage` muestra tu tasa de aciertos de caché y la causa probable del último fallo.
- `/recap` resume la sesión sin tocar la caché.
- Escribe un plan grande en un archivo de especificación y constrúyelo en una sesión nueva.

## Aprende más

- [Cómo usa Claude Code la caché de prompts](https://code.claude.com/docs/en/prompt-caching)
- [Configuración de modelos](https://code.claude.com/docs/en/model-config)
- [Modo rápido](https://code.claude.com/docs/en/fast-mode)
- [Cómo recuerda Claude tu proyecto](https://code.claude.com/docs/en/memory)
- [Ajustes](https://code.claude.com/docs/en/settings)
- [Modo interactivo](https://code.claude.com/docs/en/interactive-mode)
- [Comandos](https://code.claude.com/docs/en/commands)
- [Buenas prácticas](https://code.claude.com/docs/en/best-practices)
