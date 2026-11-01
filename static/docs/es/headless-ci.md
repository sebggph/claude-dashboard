# Claude en scripts y CI (modo headless)

> Ejecuta Claude una sola vez, sin ventana de chat, para que scripts, git hooks y jobs de CI lo usen como cualquier otra herramienta de línea de comandos.

## Qué es el modo headless

Añade `-p` (o `--print`) a cualquier comando `claude` y se ejecuta **en modo no interactivo**: toma tu prompt, hace el trabajo, imprime el resultado y termina.

```bash
claude -p "What does the auth module do?"
```

Lee de stdin, así que puedes pasarle datos con una tubería y redirigir la respuesta. Sale con código `0` si todo va bien y con un código distinto de cero si la ejecución falla, así que tus scripts pueden actuar según el resultado.

Encaja bien en:

- **Scripts y pasos de build**: un linter o revisor propio del proyecto.
- **Git hooks**: resumir o comprobar un cambio antes de que vaya a ningún sitio.
- **CI**: revisar pull requests, responder a menciones `@claude`, generar informes.
- **Tareas por lotes**: lanzar la misma tarea concreta sobre muchos archivos por la noche.

## Qué cambia respecto al uso interactivo

**No hay nadie para aprobar nada.** En una ejecución `-p` que no fija modo de permisos, una llamada a una herramienta que necesita aprobación simplemente se deniega. Los permisos se deciden de antemano, con `--allowedTools` o con un modo de permisos. Las herramientas que no necesitan aprobación, como leer archivos de tu directorio de trabajo, siguen funcionando.

**Sigue cargando tu configuración, salvo que digas lo contrario.** Sin flags extra, `claude -p` descubre hooks, skills, plugins, servidores MCP, memoria automática y CLAUDE.md igual que una sesión interactiva. Incluso ejecuta los hooks del `.claude/settings.json` del proyecto y conecta los servidores de su `.mcp.json` en una carpeta en la que nunca confiaste, sin diálogo de confianza.

**`--bare` te da una ejecución limpia y repetible.** Se salta todo ese descubrimiento automático, así que un hook en el `~/.claude` de un compañero o un servidor en `.mcp.json` no se ejecutan. Claude tiene las herramientas Bash, lectura y edición de archivos, y todo lo demás lo pasas de forma explícita (`--append-system-prompt`, `--settings`, `--mcp-config`, `--agents`). Dos detalles:

- El modo bare no usa el inicio de sesión de tu suscripción. Define `ANTHROPIC_API_KEY` (o usa las credenciales de tu proveedor cloud).
- Claude no puede lanzar comandos ni subagentes en segundo plano.

La documentación recomienda `--bare` para llamadas desde scripts, y dice que será el comportamiento por defecto de `-p` en una versión futura.

## Los flags que de verdad vas a usar

| Flag | Qué hace |
| --- | --- |
| `-p`, `--print` | Ejecuta una vez, sin interacción, y termina |
| `--bare` | Se salta hooks, skills, plugins, MCP, memoria automática y CLAUDE.md |
| `--output-format` | `text` (por defecto), `json` (resultado más metadatos) o `stream-json` (un evento JSON por línea) |
| `--json-schema` | Con salida `json`, devuelve datos que cumplen tu esquema en `structured_output` |
| `--allowedTools` | Herramientas que se ejecutan sin preguntar, p. ej. `"Read,Edit"` o `"Bash(git diff *)"` |
| `--disallowedTools` | Reglas de denegación: `"Edit"` quita la herramienta, `"Bash(rm *)"` bloquea las llamadas que coinciden |
| `--tools` | Limita qué herramientas integradas existen; `""` las desactiva todas |
| `--permission-mode` | Punto de partida como `dontAsk`, `acceptEdits` o `auto` |
| `--max-turns` | Limita los turnos del agente; termina con error al alcanzarlo |
| `--max-budget-usd` | Se detiene cuando el gasto estimado llega a esa cantidad |
| `--model` / `--effort` | Elige el modelo (`sonnet`, `opus`, `haiku`...) y cuánto piensa |
| `--append-system-prompt` | Añade instrucciones manteniendo el comportamiento por defecto |
| `--continue` / `--resume <id>` | Continúa la última conversación, o una concreta |
| `--no-session-persistence` | No guarda la sesión en disco |

Algunas notas:

- `--permission-mode dontAsk` deniega todo lo que normalmente pediría confirmación. Es la opción más cerrada para CI. `acceptEdits` deja que Claude escriba archivos y ejecute comandos habituales del sistema de archivos como `mkdir` y `mv`.
- En `--allowedTools`, el espacio antes de `*` importa: `Bash(git diff *)` coincide con `git diff ...`, pero `Bash(git diff*)` también coincidiría con `git diff-index`.
- `--max-turns`, `--max-budget-usd`, `--json-schema` y `--no-session-persistence` solo funcionan con `-p`.

## Recetas

### 1. Revisar un diff

Si le pasas el diff por la tubería, Claude no necesita permiso de Bash para leerlo:

```bash
git diff main | claude -p "You are a typo linter. For each typo in this diff, report filename:line on one line and the issue on the next. Return nothing else."
```

Para una revisión de seguridad centrada en una PR, añade un rol con `--append-system-prompt`:

```bash
gh pr diff "$1" | claude -p \
  --append-system-prompt "You are a security engineer. Review for vulnerabilities." \
  --output-format json
```

La entrada por tubería tiene un límite de 10MB. Para entradas mayores, guárdalas en un archivo y menciona la ruta en tu prompt.

### 2. Procesar JSON con jq

Con `--output-format json`, la respuesta en texto está en `result`, junto al ID de sesión y los datos de coste:

```bash
claude -p "Summarize this project" --output-format json | jq -r '.result'
```

Si tu script necesita datos fiables, añade un esquema. La respuesta llega en `structured_output`:

```bash
claude -p "Extract the main function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}' \
  | jq '.structured_output'
```

Si Claude rechaza la petición o la ejecución termina sin una salida válida, `structured_output` no aparece, así que compruébalo antes de usarlo.

Para continuar en un paso posterior, guarda el ID de sesión:

```bash
session_id=$(claude -p "Start a review" --output-format json | jq -r '.session_id')
claude -p "Continue that review" --resume "$session_id"
```

### 3. GitHub Actions

El camino documentado es la action oficial, `anthropics/claude-code-action`. La forma más rápida es ejecutar `/install-github-app` dentro de Claude Code: instala la Claude GitHub App, guarda tu credencial como secreto del repositorio y abre una pull request con el workflow. Necesitas acceso de administrador al repo.

¿Lo haces a mano? Instala la Claude GitHub App, añade un secreto (`ANTHROPIC_API_KEY`, o `CLAUDE_CODE_OAUTH_TOKEN` generado con `claude setup-token` si usas una suscripción) y añade un workflow. Este responde a las menciones `@claude` en comentarios de issues y PRs:

```yaml
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
      id-token: write
      actions: read
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

Conviene saber:

- Sin el input `prompt`, Claude espera a `@claude`. Con un `prompt`, se ejecuta con cualquier evento, también con un `schedule`.
- Los flags de la CLI se pasan con `claude_args`, por ejemplo `claude_args: "--max-turns 5 --model claude-sonnet-5"`.
- Con un `prompt` de texto, Claude no tiene acceso a la shell ni a la API de GitHub hasta que le concedas herramientas con `--allowedTools` en `claude_args`.
- En eventos de issues y PRs, quien lanza la ejecución necesita acceso de escritura al repo, y los bots se rechazan salvo que estén en `allowed_bots`.

### 4. Un script nocturno por lotes

Lánzalo desde cron o desde un job programado de CI. Cada archivo tiene su propia ejecución, pequeña y limitada:

```bash
#!/usr/bin/env bash
# Needs ANTHROPIC_API_KEY: bare mode doesn't use your subscription login.
mkdir -p reports
for f in src/*.py; do
  claude --bare -p "Review $f for unclear error handling. Answer in at most 10 bullet points." \
    --allowedTools "Read" \
    --max-turns 5 \
    --max-budget-usd 0.50 \
    --no-session-persistence \
    --output-format json > "reports/$(basename "$f").json" \
    || echo "failed: $f" >&2
done
jq -s 'map(.total_cost_usd) | add' reports/*.json
```

La última línea suma el `total_cost_usd` de todos los informes. Esa cifra es una estimación del cliente y puede no coincidir con tu factura.

## Coste y contexto en la automatización

- **Cada ejecución empieza de cero.** Una ejecución `-p` solo sabe lo que le pasas, más lo que cargue (CLAUDE.md, skills...) si no usas `--bare`. Pon lo esencial en el prompt y mantén corto cualquier CLAUDE.md que cargue el job, porque se lee en cada ejecución.
- **Mantén la tarea pequeña.** Un archivo, un diff, una pregunta. Pasa por la tubería justo lo necesario en lugar de pedirle a Claude que explore.
- **Ponle un techo.** `--max-turns` corta bucles sin fin. `--max-budget-usd` corta por gasto estimado, que puede pasarse un poco del límite, así que deja margen. En GitHub Actions, define también timeouts del workflow y límites de concurrencia.
- **Elige modelo y esfuerzo a propósito.** Usa `--model` y `--effort` según el job. Para comprobaciones concretas, un modelo más barato suele bastar.
- **La caché funciona dentro de cada ejecución.** Con una API key, las ejecuciones `-p` tienen por defecto una caché de prompt de cinco minutos. Los turnos de una misma ejecución la reutilizan, pero un job nocturno no se beneficia de la caché de ayer. Con una suscripción, dentro del uso del plan, la conversación principal tiene una caché de una hora.
- **Dos facturas en CI.** GitHub Actions consume minutos de runner y tokens. Con un token OAuth, las ejecuciones usan tu suscripción de Claude en lugar de la facturación de la API.

## Seguridad

La automatización quita a la persona que normalmente diría "espera, no". Compénsalo:

- **Mínimo privilegio.** Concede solo las herramientas que la tarea necesita. Un job de revisión necesita `Read`, no `Bash` ni `Edit`. Prefiere reglas acotadas como `Bash(git diff *)` y `--permission-mode dontAsk` para ejecuciones cerradas.
- **Una persona antes del merge.** Da a los workflows solo los permisos de GitHub que necesitan y revisa los cambios de Claude antes de hacer merge. Nunca dejes que un job de CI haga push o merge sin revisión.
- **Los secretos, en secretos.** Nunca hagas commit de API keys ni tokens OAuth. Guárdalos como secretos de CI y haz referencia a ellos, p. ej. `${{ secrets.ANTHROPIC_API_KEY }}`.
- **Trata el contenido de las PRs como no fiable.** Diffs, textos de issues y comentarios pueden llevar instrucciones dirigidas a Claude. La documentación de seguridad desaconseja pasar contenido no fiable directamente. Sé aún más estricto con las herramientas en jobs que leen contribuciones externas. Consulta [Prompt injection](/learn/prompt-injection).
- **Usa `--bare` para que sea repetible.** Evita que el `.mcp.json` o los hooks de un repo se ejecuten en tu pipeline sin que te des cuenta.

## Consejos rápidos

- Empieza con salida `text` y pasa a `json` cuando un script necesite procesarla.
- Prueba el comando exacto en local antes de llevarlo a CI.
- Actúa según el código de salida y comprueba que `structured_output` existe.
- Nombra las herramientas con precisión: `Bash(git diff *)` es mejor que `Bash`.
- Pon `--max-turns` y `--max-budget-usd` en cada job programado.

## Antes de automatizar

- [ ] La tarea es pequeña y concreta, con todo lo necesario en el prompt o en stdin
- [ ] Las herramientas permitidas son las mínimas que la tarea necesita
- [ ] La ejecución usa `--bare`, o sabes qué hooks, servidores MCP y CLAUDE.md carga
- [ ] Los turnos y el presupuesto tienen límite, y los jobs de CI tienen timeout
- [ ] Las credenciales están en secretos de CI, nunca en el repo
- [ ] El texto no fiable de PRs o issues no puede activar acceso de escritura ni de shell
- [ ] Una persona revisa cada cambio antes del merge

## Más información

- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- [CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Permission modes](https://code.claude.com/docs/en/permission-modes)
- [Permissions](https://code.claude.com/docs/en/permissions)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
- [Manage costs](https://code.claude.com/docs/en/costs)
- [Security](https://code.claude.com/docs/en/security)
- [Flujos de trabajo del día a día](/learn/05-workflows)
