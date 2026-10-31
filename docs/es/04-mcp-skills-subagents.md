# MCP, skills y subagentes

> MCP conecta a Claude con herramientas externas, las skills le enseñan a hacer cosas y los subagentes trabajan en un contexto aparte.

## La versión corta

| Función | Úsala para | Coste de contexto |
| --- | --- | --- |
| Servidor MCP | Acceder a un sistema externo: gestor de incidencias, base de datos, navegador | Bajo hasta que se usa una herramienta (primero nombres, esquemas bajo demanda) |
| Skill | Instrucciones reutilizables, checklists, documentación de referencia | Bajo: solo se cargan las descripciones hasta que se usa |
| Subagente | Tareas que leen muchos archivos o generan mucha salida | Aislado: trabaja en su propia ventana y solo vuelve un resumen |

## MCP: conecta herramientas

Conecta un servidor MCP cuando te veas copiando datos de otra herramienta al chat. Así Claude puede leer y actuar en ese sistema directamente.

- Añade un servidor con `claude mcp add`.
- Ejecuta `/mcp` para ver su estado y desactivar los que no necesites.
- Gracias a la **búsqueda de herramientas** (tool search), al principio solo se cargan los nombres y las instrucciones del servidor. Las definiciones completas llegan cuando Claude necesita una.
- Si existe una buena CLI (`gh`, `aws`, `gcloud`), a menudo es aún más eficiente, porque no añade ningún listado de herramientas.

## Skills: conocimiento bajo demanda

Una skill es una carpeta con un archivo `SKILL.md`. Tiene una `description` corta y las instrucciones completas.

- Al empezar la sesión, Claude solo ve la **descripción**.
- El **contenido completo** se carga cuando escribes `/nombre-skill` o cuando Claude decide que es relevante.
- Una vez cargada, se queda en la conversación.

Dónde viven:

- Personales: `~/.claude/skills/<name>/SKILL.md`
- De proyecto: `.claude/skills/<name>/SKILL.md`

Los comandos personalizados ahora son skills. Un archivo en `.claude/commands/deploy.md` sigue funcionando y crea `/deploy`.

Truco: para skills que solo lanzas a mano, añade `disable-model-invocation: true` al frontmatter. Así ni siquiera la descripción entra en el contexto hasta que la invocas.

## Subagentes: tu contexto principal, limpio

Un subagente es un ayudante con su propia ventana de contexto, su propio system prompt y sus propias herramientas. Hace la lectura pesada y devuelve un resumen.

```
Use a subagent to run the test suite and report only the failing tests with their error messages
```

- Claude ya usa el agente integrado **Explore** para búsquedas amplias en el código.
- Los subagentes personalizados son archivos markdown en `.claude/agents/` (proyecto) o `~/.claude/agents/` (personales). Lo más fácil es pedirle a Claude que lo escriba.
- Los subagentes también gastan tokens y cuentan para tu uso. Para trabajos sencillos puedes poner un modelo más barato, como `haiku`, en su configuración.

## Cómo elegir

- ¿Necesitas datos de Slack, una base de datos o el navegador? **MCP**.
- ¿Pegas las mismas instrucciones una y otra vez? **Skill**.
- ¿Vas a leer decenas de archivos o ejecutar comandos ruidosos? **Subagente**.
- Se combinan: un subagente puede precargar skills, y una skill puede usar herramientas MCP.

## Consejos rápidos

- Ejecuta `/context` para ver cuánto cuestan las herramientas MCP y las skills en tu sesión.
- Mantén cortas las descripciones de skills y subagentes: se cargan en cada sesión.
- Pasa las secciones largas de CLAUDE.md a skills.
- Pide un subagente siempre que la salida vaya a ser grande y solo necesites la conclusión.

## Más información

- [Extend Claude Code](https://code.claude.com/docs/en/features-overview)
- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- [Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
