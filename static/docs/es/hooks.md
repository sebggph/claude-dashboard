# Automatiza con hooks

> Deja que Claude Code formatee, avise, registre y compruebe por ti en momentos fijos, sin gastar prompts en ello.

## Qué vas a configurar

Los hooks son comandos que Claude Code ejecuta en momentos fijos: después de una edición, cuando Claude te necesita, al iniciar la sesión, antes de que Claude pare. No los decide el modelo, así que se ejecutan siempre. Esta guía los usa para ser más **productivo**: escribir menos, esperar menos y obtener una salida más limpia. Para bloquear acciones peligrosas, mira [Barreras y supervisión](/learn/guardrails-and-monitoring) y [Asegura tu configuración](/learn/secure-setup).

Tiempo de lectura: unos 9 minutos. Casi todas las recetas necesitan `jq` (`brew install jq` o `apt-get install jq`).

## Paso 1: Conoce las piezas

Los hooks van bajo una clave `hooks` en un archivo de ajustes. Cada evento contiene una lista de grupos, cada uno con un `matcher` opcional y los hooks que se ejecutan:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "echo edited" }
        ]
      }
    ]
  }
}
```

Los eventos que más vas a usar:

| Evento | Cuándo se dispara | Qué filtra el matcher |
| --- | --- | --- |
| `SessionStart` | Empieza o se reanuda una sesión | `startup`, `resume`, `clear`, `compact`, `fork` |
| `UserPromptSubmit` | Envías un prompt, antes de que Claude lo vea | Sin matcher |
| `PreToolUse` | Antes de una llamada a herramienta (puede bloquearla) | Nombre de la herramienta |
| `PostToolUse` | Después de una llamada a herramienta que sale bien | Nombre de la herramienta |
| `Notification` | Claude Code envía una notificación | `permission_prompt`, `idle_prompt`, ... |
| `Stop` | Claude termina de responder | Sin matcher |
| `SubagentStop` | Termina un subagente | Tipo de agente |
| `PreCompact` | Antes de la compactación | `manual`, `auto` |
| `SessionEnd` | Termina la sesión | Por qué terminó |

La referencia incluye más. Los matchers distinguen mayúsculas; `Edit|Write` coincide con cualquiera de las dos herramientas, y un matcher vacío se dispara siempre.

**Cómo se comunica un hook con Claude Code.** Los datos del evento llegan como JSON por stdin, por ejemplo `tool_name`, `tool_input` y `cwd`. Tu comando responde con su código de salida:

- **Exit 0**: sin objeciones. Claude Code también puede leer un objeto JSON que imprimas en stdout para un control más fino.
- **Exit 2**: bloquea (en los eventos que se pueden bloquear). Lo que escribas en stderr se devuelve como motivo.
- **Otros códigos**: normalmente un error no bloqueante; la acción sigue adelante.

- [ ] Sé qué evento corresponde a "después de editar", "cuando Claude me necesita" y "antes de que Claude pare"

## Paso 2: Elige dónde vive el hook

| Archivo | Alcance | ¿Lo subo al repo? |
| --- | --- | --- |
| `~/.claude/settings.json` | Todos tus proyectos | No, está en tu máquina |
| `.claude/settings.json` | Este proyecto, todo el equipo | Sí, después de revisarlo |
| `.claude/settings.local.json` | Este proyecto, solo tú | No |

Pon tus costumbres personales (notificaciones, tus propios registros) en los ajustes de usuario, y las convenciones del equipo (formato, tests) en el archivo del proyecto. Los ajustes son JSON estricto: sin comentarios ni comas finales. Si el archivo ya tiene una clave `hooks`, añade el nuevo evento junto a los que ya hay en vez de sustituir el objeto.

Ejecuta `/hooks` para ver todos los hooks configurados por evento y de qué archivo viene cada uno. O pídele a Claude que escriba el hook por ti.

- [ ] Elegí ajustes de usuario o de proyecto para cada hook

## Paso 3: Formatea automáticamente tras cada edición

Este hook `PostToolUse` pasa cada archivo editado a Prettier. Ponlo en `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

Cambia Prettier por tu formateador. Un hook que funciona no muestra nada, así que revisa el archivo. Las ediciones hechas con comandos de shell no coinciden con este matcher.

- [ ] Añadí un hook de formateo y vi un archivo reformateado

## Paso 4: Recibe avisos en vez de vigilar la terminal

Añade esto a `~/.claude/settings.json` para que Claude te avise cuando te espera. En macOS usa `osascript`; en Linux, `notify-send`:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

`permission_prompt` se dispara cuando una aprobación lleva unos seis segundos esperando; `idle_prompt`, unos 60 segundos después de que Claude termine si no has escrito nada. ¿Quieres un aviso justo al acabar cada turno? Pon el mismo comando en `Stop`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "notify-send 'Claude Code' 'Done'" }
        ]
      }
    ]
  }
}
```

En macOS, si no aparece nada, permite las notificaciones de **Script Editor** en Ajustes del Sistema. `notify-send` necesita un escritorio, no funciona en una sesión SSH.

- [ ] Recibí un aviso mientras trabajaba en otra ventana

## Paso 5: Añade contexto al iniciar la sesión

En `SessionStart`, el texto plano que tu comando imprime en stdout se añade al contexto de Claude. Así Claude ve un resumen corto de tu árbol de trabajo:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          { "type": "command", "command": "git status --short | head -20" }
        ]
      }
    ]
  }
}
```

**Esto cuesta contexto.** Lo que imprime el hook se queda en la conversación desde ese momento, así que limítalo a unas pocas líneas; de ahí el `head -20`. Para datos que no cambian, usa CLAUDE.md. Para recuperar recordatorios clave tras compactar, usa el matcher `compact` (mira [Compactación](/learn/compaction)).

- [ ] Añadí un hook SessionStart corto y revisé su salida

## Paso 6: Registra lo que hace Claude

Un hook `PostToolUse` sin matcher se ejecuta tras cada llamada a herramienta. Este añade una línea por llamada a un archivo de registro:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "jq -c '{time: now | todate, tool: .tool_name}' >> ~/.claude/tool-log.jsonl",
            "async": true
          }
        ]
      }
    ]
  }
}
```

`"async": true` lo ejecuta en segundo plano, así Claude no espera. Los hooks async no pueden bloquear nada, lo cual está bien para un registro. Usa `"matcher": "Bash"` y `.tool_input.command` para registrar solo comandos de shell.

- [ ] Añadí un hook de registro y leí el archivo tras una sesión

## Paso 7: Ejecuta los tests antes de que Claude pare

Un hook `Stop` que sale con 2 manda a Claude de vuelta al trabajo. Envía la salida de los tests a stderr para que Claude vea el motivo:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "npm test 1>&2 || exit 2" }
        ]
      }
    ]
  }
}
```

`Stop` se dispara cada vez que Claude termina de responder, no solo al acabar una tarea, así que usa un comando rápido. Tras ocho bloqueos seguidos sin ninguna llamada a herramienta entre medias, Claude Code le deja parar igualmente. Los scripts pueden leer `stop_hook_active` de la entrada para evitar bucles. Tienes más patrones en [Barreras y supervisión](/learn/guardrails-and-monitoring).

- [ ] Añadí un hook Stop con un test o typecheck rápido

## Paso 8: Mantén los hooks baratos en contexto y tokens

Los hooks se ejecutan fuera del modelo, así que la mayoría no cuestan nada. La salida solo importa cuando llega a Claude:

- **Llega a Claude**: el stdout en texto plano de `SessionStart` y `UserPromptSubmit`, `additionalContext` en JSON, y stderr con exit 2 (por ejemplo, unos tests que fallan).
- **Se queda fuera**: el stdout de casi todos los demás eventos, como el formateador y el registro, que solo va al log de depuración.
- **Con límite**: el texto que añade un hook está limitado a 10.000 caracteres. Si se pasa, se guarda en un archivo y Claude recibe una vista previa de 2.000 caracteres.

Los hooks también pueden **ahorrar** tokens: la guía de costes muestra uno que filtra la salida de los tests y deja solo los fallos. En este panel, la fila **Salida de hooks** muestra lo que añadieron tus hooks (mira [Cómo leer este panel](/learn/06-reading-the-dashboard)).

- [ ] Revisé la fila Salida de hooks de una sesión

## Paso 9: Úsalos con seguridad

- **Los hooks de comando se ejecutan con todos tus permisos de usuario.** Pueden leer, cambiar o borrar todo lo que tu cuenta puede. Lee cada hook antes de activarlo.
- En una sesión interactiva, los hooks esperan a que aceptes el diálogo de confianza del espacio de trabajo. `claude -p` no muestra ese diálogo y ejecuta los hooks del repo, así que revisa `.claude/` antes o pasa `--settings '{"disableAllHooks": true}'`.
- Sube `.claude/settings.json` solo con hooks que tu equipo haya revisado. Deja los personales en los ajustes de usuario o locales.
- En los scripts, pon las variables entre comillas (`"$VAR"`), usa `"$CLAUDE_PROJECT_DIR"` para las rutas y no toques `.env` ni las claves.

- [ ] Revisé todos los hooks de mis archivos de ajustes

## Paso 10: Prueba y depura un hook

1. Ejecuta `/hooks` y confirma que aparece en el evento correcto.
2. Prueba el script a mano con una entrada de ejemplo:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | ./my-hook.sh
echo $?
```

3. Haz los scripts ejecutables con `chmod +x`.
4. Pulsa `Ctrl+O` para ver la transcripción. Los errores aparecen como `<hook name> hook error`.
5. Para ver todo el detalle, arranca con `claude --debug-file /tmp/claude.log` o ejecuta `/debug` en mitad de la sesión.

Si la salida JSON no tiene efecto, comprueba que nada imprime antes (como un `echo` en el perfil de tu shell) y que campos como `additionalContext` van dentro de `hookSpecificOutput`.

- [ ] Ejecuté un hook a mano con JSON de ejemplo

## Consejos rápidos

- Empieza con un hook, comprueba que se dispara y luego añade el siguiente.
- Los hooks son para lo que tiene que pasar siempre. Las preferencias van en [CLAUDE.md](/learn/03-claude-md-memory).
- Para pausar todos los hooks, pon `"disableAllHooks": true`.

## Más información

- [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Settings](https://code.claude.com/docs/en/settings)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)
