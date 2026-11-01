# Cómo leer este panel

> Un recorrido por cada pantalla, qué significan los números y cómo convertirlos en mejores hábitos.

## De dónde salen los datos

Claude Code guarda cada sesión como un archivo JSONL en `~/.claude/projects/`, y este panel lo lee en local.

**Importante:** los números de aquí son **estimaciones**. Salen de los campos de uso de tokens de la transcripción y del recuento de caracteres de cada mensaje. Su formato es interno y puede cambiar entre versiones. Para ver la foto exacta de una sesión en curso, ejecuta `/context` dentro de Claude Code.

## Lista de sesiones

Una fila por cada sesión local:

- **Contexto usado frente a la ventana**: cuánto contexto había en la última petición, comparado con el tamaño de ventana del modelo.
- **Mensajes y compactaciones**: cuántos mensajes enviaste y cuántas veces se resumió el historial. Los totales de tokens (entrada, salida, lectura y escritura en caché) están en el detalle de cada sesión.
- **Última actividad**: cuándo se usó la sesión por última vez.

## Detalle de sesión: el desglose

Una barra y una tabla reparten el contexto en partes, de forma parecida a `/context`:

| Parte | Qué significa |
| --- | --- |
| Prompt del sistema, herramientas y memoria | La parte fija: prompt del sistema, definiciones de herramientas (integradas y MCP) y archivos de memoria. Se calcula como el total menos todos los mensajes, así que las herramientas añadidas a mitad de sesión también aparecen aquí. |
| Tus mensajes | Lo que escribiste. |
| Respuestas de Claude | Lo que Claude contestó. |
| Razonamiento | Los tokens de pensamiento de Claude. |
| Llamadas a herramientas | Las peticiones de Claude para leer archivos, ejecutar comandos, etc. |
| Resultados de herramientas | Lo que devolvieron esas herramientas. La tabla **Herramientas usadas** lo separa por herramienta (Read, Bash, MCP…). |
| Margen de autocompactación | Espacio reservado para que la compactación automática pueda ejecutarse antes de que la ventana se llene. |
| Espacio libre | Lo que queda. |

Si dominan los **resultados de herramientas**, Claude leyó archivos grandes o recibió salidas largas de comandos. Si el **prompt del sistema, herramientas y memoria** es grande, revisa tu CLAUDE.md, los servidores MCP y las skills.

## Elementos más grandes

Los resultados de herramientas y mensajes más grandes. Suele ser la mejora más rápida: un solo log enorme puede ocupar más que el resto del chat. La próxima vez, pide una salida filtrada o manda ese trabajo a un subagente.

## Línea de tiempo

Un gráfico del tamaño del contexto en cada turno. Fíjate en:

- **Saltos bruscos**: un turno añadió mucho, normalmente un resultado de herramienta grande.
- **Marcas de compactación**: puntos donde se resumió el historial y el contexto bajó.
- **Crecimiento lento y constante**: una sesión larga que mezcla varias tareas. Plantéate usar `/clear` entre tareas.

## Lectura de caché frente a escritura

- **Lectura de caché**: tokens servidos desde la caché, facturados a una tarifa menor.
- **Escritura en caché**: tokens que se escriben en la caché.

Una relación alta entre lecturas y escrituras indica que la caché funciona bien. Si las escrituras siguen altas turno tras turno, algo está cambiando el inicio del prompt, por ejemplo cambiar de modelo a mitad de sesión o hacer pausas largas después de que caduque la caché.

## Recomendaciones

Consejos sencillos basados en reglas, como "resultados de herramientas grandes: prueba un subagente" o "contexto cerca del límite: prueba `/compact` con un enfoque". Son sugerencias basadas en las estimaciones anteriores, no diagnósticos oficiales.

## Consejos rápidos

- Empieza por la lista de elementos más grandes.
- Compara el prompt del sistema, herramientas y memoria entre sesiones para detectar una configuración pesada.
- Usa la línea de tiempo para encontrar el turno donde todo se torció.
- Confirma lo importante con `/context` y `/usage` en Claude Code.

## Más información

- [Explore the context window](https://code.claude.com/docs/en/context-window)
- [Manage sessions](https://code.claude.com/docs/en/sessions)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
- [Model configuration](https://code.claude.com/docs/en/model-config)
