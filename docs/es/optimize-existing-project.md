# Optimiza un proyecto existente para Claude Code

> Una auditoría de 30 minutos que recorta lo que se carga antes de escribir, para que cada sesión empiece más ligera.

Este tutorial es para ti si un proyecto ya usa Claude Code (o vas a meter a Claude en una base de código grande que ya existe) y las sesiones se sienten pesadas, lentas o caras. Vas a medir un punto de partida, recortar la carga fija, corregir algunos hábitos y compartir el resultado con tu equipo. Calcula unos 30 minutos, más un repaso rápido una semana después.

¿Nuevo con el contexto? Lee [¿Qué es la ventana de contexto?](#/guides/01-what-is-context.md). ¿Empiezas desde cero? Mira [Empieza un proyecto nuevo con Claude Code](#/guides/start-new-project.md).

---

## Paso 1: Mide tu punto de partida

**Por qué:** no sabrás qué funcionó si no sabes de dónde partiste. Todo lo que se carga antes de tu primer mensaje (prompt del sistema, herramientas, MCP, skills, archivos de memoria) se paga otra vez en cada petición.

**Qué revisar:** abre una terminal en el proyecto, empieza una sesión nueva con `claude` y ejecuta:

```
/context
```

Apunta el total y las partes fijas más grandes: prompt del sistema, herramientas del sistema, herramientas MCP, skills y **Memory files**. Esa última lista también muestra qué archivos CLAUDE.md y de reglas se cargaron de verdad.

Después abre en este panel una sesión reciente y típica, y mira:

- La fila **Prompt del sistema, herramientas y memoria**: tu carga fija.
- El grupo **Skills, MCP y recordatorios**: las filas **Lista de skills**, **Instrucciones de servidores MCP** y **Lista de herramientas diferidas**.
- **Elementos más grandes**: los resultados sueltos que más espacio ocuparon.

[Cómo leer este panel](#/guides/06-reading-the-dashboard.md) explica cada fila. Recuerda que el panel muestra estimaciones; `/context` es la fuente de verdad.

- [ ] Ejecuté `/context` en una sesión nueva y apunté los números
- [ ] Abrí una sesión típica en el panel y apunté la carga fija

## Paso 2: Audita CLAUDE.md y los archivos de memoria

**Por qué:** los archivos de memoria se cargan completos al empezar, en cada sesión.

**Qué revisar:** ejecuta `/memory` para ver tus archivos de memoria y abrirlos. Busca en todos los sitios donde pueden estar:

- `~/.claude/CLAUDE.md` (tú, en todos los proyectos)
- `./CLAUDE.md` o `./.claude/CLAUDE.md` (el equipo)
- `./CLAUDE.local.md` (tú, en este proyecto)
- Archivos `CLAUDE.md` en subcarpetas (se cargan cuando Claude trabaja con archivos de ahí)
- `.claude/rules/` y `~/.claude/rules/`
- Memoria automática: `MEMORY.md` carga sus primeras 200 líneas o 25KB

**Qué cambiar:**

- Borra lo obsoleto, repetido, contradictorio o lo que ya se ve en el código.
- Mantén cada archivo **por debajo de 200 líneas**, el objetivo oficial.
- Pasa las instrucciones que solo importan para una parte del código a una regla con el campo `paths`. Solo se carga cuando Claude toca archivos que coinciden:

```markdown
---
paths:
  - "src/api/**/*.ts"
---

- All API endpoints must include input validation
```

- Pasa los procedimientos largos (pasos de release, migraciones) a una skill.
- Revisa tus imports `@path`: los archivos importados se cargan completos junto al archivo que los importa, así que no ahorran contexto.
- En un monorepo, usa el ajuste `claudeMdExcludes` para saltarte los CLAUDE.md de otros equipos.

Para una segunda opinión, `/doctor prompt-audit` busca instrucciones desactualizadas o contradictorias (v2.1.283 o posterior). Más en [CLAUDE.md y memoria](#/guides/03-claude-md-memory.md).

- [ ] Encontré todos los archivos de memoria con `/memory` y `/context`
- [ ] Cada CLAUDE.md tiene menos de 200 líneas
- [ ] Moví las reglas de áreas concretas a `.claude/rules/` con `paths`

## Paso 3: Audita los servidores MCP

**Por qué:** con **tool search** (activado por defecto), al empezar solo se cargan los nombres de las herramientas y las instrucciones de cada servidor, así que un servidor sin usar cuesta poco. Poco no es nada, y los resultados grandes de las herramientas siguen llegando a tu contexto.

**Qué revisar:** ejecuta `/mcp` para ver cada servidor, su estado y cuántas herramientas tiene. Fíjate en el alcance de cada uno:

| Alcance | Se carga en | Se guarda en |
| --- | --- | --- |
| Local (por defecto) | Este proyecto, solo tú | `~/.claude.json` |
| Proyecto | Este proyecto, todo el equipo | `.mcp.json` en el repo |
| Usuario | Todos tus proyectos | `~/.claude.json` |

**Qué cambiar:**

- Desactiva desde `/mcp` los servidores que no usas. Elimina los que nunca vas a usar.
- Saca del alcance de usuario los servidores que solo necesita un proyecto.
- Si existe un buen CLI (`gh`, `aws`, `gcloud`), úsalo: no añade ninguna lista de herramientas.
- Comprueba que nadie puso `ENABLE_TOOL_SEARCH=false`, que carga todas las definiciones de herramientas desde el inicio.
- Conoce los límites de salida: Claude Code avisa cuando un resultado MCP pasa de 10.000 tokens y, por defecto, un resultado de más de 25.000 tokens se guarda en un archivo en vez de llenar tu contexto. `MAX_MCP_OUTPUT_TOKENS` cambia ese límite.

Las instrucciones de un servidor se cortan a 4.096 caracteres por defecto, así que alargarlas no ayuda. Activar o quitar servidores a mitad de sesión también reinicia la caché del prompt, así que haz esta auditoría entre sesiones.

- [ ] Revisé cada servidor en `/mcp` y desactivé los que no uso
- [ ] Comprobé que tool search no está desactivado

## Paso 4: Audita skills, plugins y subagentes

**Por qué:** la descripción de cada skill está en la lista de skills en cada turno, se use o no. La lista tiene un presupuesto de alrededor del 1% de la ventana de contexto; si se pasa, las skills menos usadas pierden su descripción y dejan de activarse bien.

**Qué revisar:** ejecuta `/skill-doctor` para ver cuánto cuesta cada skill y cada cuánto la usas. También lista los plugins que no has usado últimamente. Revisa `.claude/skills/`, `~/.claude/skills/`, `.claude/agents/` y `~/.claude/agents/`, y los plugins en `/plugin`.

**Qué cambiar:**

- Borra o desactiva las skills, plugins y subagentes que nadie usa.
- Pon el caso de uso principal al principio de cada `description`: la descripción más `when_to_use` se corta a 1.536 caracteres.
- Para las skills que solo ejecutas a mano (deploy, release), añade esto al frontmatter. Así la descripción queda fuera del contexto hasta que escribas `/nombre`:

```yaml
disable-model-invocation: true
```

Más en [MCP, skills y subagentes](#/guides/04-mcp-skills-subagents.md).

- [ ] Ejecuté `/skill-doctor` y quité skills y plugins sin uso
- [ ] Marqué las skills manuales con `disable-model-invocation: true`

## Paso 5: Reduce la salida de las herramientas

**Por qué:** después de la carga fija, los resultados de herramientas suelen ser la parte más grande de una sesión: logs largos, ejecuciones completas de tests, archivos enormes.

**Qué cambiar:**

- **Filtra los comandos.** Pide "solo los fallos", o usa `grep`, `tail` o `head`. La salida de Bash de más de unos 30.000 caracteres se guarda en un archivo con una vista previa, pero un log de 25.000 caracteres sigue costando mucho.
- **Manda el trabajo ruidoso a un subagente.** "Use a subagent to run the test suite and report only the failing tests." La salida se queda en la ventana del subagente.
- **Bloquea los archivos que Claude nunca debe leer** con reglas `Read` en `deny` dentro de `.claude/settings.json`, como `Read(./.env)` o `Read(./dist/**)`. Un archivo `.claudeignore` no tiene ningún efecto.
- **Filtra con un hook.** Un hook `PreToolUse` puede reescribir los comandos de tests para mostrar solo los fallos. Mira el ejemplo en la documentación de costes.

```json
{
  "permissions": {
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./dist/**)"]
  }
}
```

- [ ] Añadí reglas `Read` en `deny` para secretos y archivos generados
- [ ] Apunté qué comandos filtrar siempre o mandar a un subagente

## Paso 6: Corrige los hábitos que ves en el panel

**Por qué:** la configuración es solo la mitad. Las recomendaciones del panel muestran cómo fueron de verdad tus sesiones. Abre las más pesadas y busca lo que ves:

| Ves… | Causa probable | Solución |
| --- | --- | --- |
| **Salidas de herramientas grandes** | Logs completos, tests o lecturas de archivos grandes | Filtra la salida o usa un subagente (Paso 5) |
| **Compactas a menudo** | Varias tareas en una sesión larga | `/clear` entre tareas; mira [Compactación: qué es y cómo usarla](#/guides/compaction.md) |
| **La caché expiró tras una pausa** | Volviste cuando la caché ya había caducado | Si no necesitas el historial, `/clear` sale más barato; mira [¿Cambiar a mitad de sesión o empezar de cero?](#/guides/change-or-restart.md) |
| **Cambio de modelo a mitad de sesión** | Cambiaste con `/model`; cada modelo tiene su propia caché | Elige el modelo al empezar la sesión |
| **Muchas lecturas de archivos** | Prompts vagos, Claude buscando por todas partes | Nombra archivos con `@path`, escribe prompts concretos, delega la exploración |
| **Costo inicial alto** | CLAUDE.md, skills o MCP pesados | Pasos 2 a 4 |

Los hábitos del día a día están en [Mantén tu contexto ligero](#/guides/02-keep-context-lean.md) y [Flujos de trabajo del día a día](#/guides/05-workflows.md).

- [ ] Revisé mis tres sesiones más pesadas y elegí un hábito que cambiar

## Paso 7: Que dure para todo el equipo

**Por qué:** los archivos compartidos mantienen ligero a todo el equipo.

**Qué cambiar:**

- Haz commit de `.claude/settings.json` (permisos, reglas `deny`, hooks), `CLAUDE.md`, `.claude/rules/`, las skills compartidas y `.mcp.json`.
- Guarda lo personal en `CLAUDE.local.md` y `.claude/settings.local.json`. Claude Code deja el archivo de ajustes local fuera de git cuando lo crea él; si creas alguno de los dos a mano, añádelo a `.gitignore`.
- Añade al README una sección corta "Cómo usamos Claude": dónde están las reglas, qué skills hay, "una tarea por sesión, `/clear` entre tareas".
- Después de una semana, vuelve a medir con `/context` en una sesión nueva y compara en el panel.

- [ ] Hice commit de los ajustes y archivos de memoria compartidos
- [ ] Añadí "Cómo usamos Claude" al README
- [ ] Puse un recordatorio para volver a medir en una semana

---

## Lista de antes / después

- [ ] Punto de partida apuntado con `/context` y el panel
- [ ] Cada CLAUDE.md con menos de 200 líneas, sin reglas obsoletas ni repetidas
- [ ] Reglas de áreas concretas movidas a `.claude/rules/` con `paths`
- [ ] Servidores MCP sin uso desactivados, tool search activado
- [ ] Skills y plugins sin uso quitados, skills manuales ocultas
- [ ] Reglas `Read` en `deny` para secretos y archivos generados
- [ ] Comandos ruidosos filtrados o mandados a subagentes
- [ ] Archivos del equipo en el repo, archivos personales en local
- [ ] Medí otra vez tras una semana: la carga fija bajó

## Aprende más

- [Gestiona los costes: reduce el uso de tokens](https://code.claude.com/docs/en/costs#reduce-token-usage)
- [Entiende el coste de contexto](https://code.claude.com/docs/en/features-overview#understand-context-costs)
- [Reglas por ruta](https://code.claude.com/docs/en/memory#path-specific-rules)
- [Escala con MCP tool search](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search)
- [Límites y avisos de salida MCP](https://code.claude.com/docs/en/mcp#mcp-output-limits-and-warnings)
- [Controla quién invoca una skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)
- [Aísla operaciones con mucha salida](https://code.claude.com/docs/en/sub-agents#isolate-high-volume-operations)
- [Permisos](https://code.claude.com/docs/en/permissions)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
