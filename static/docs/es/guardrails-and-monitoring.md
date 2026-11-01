# Mantén a los agentes en su carril: barreras y agentes de supervisión

> CLAUDE.md orienta, los hooks y los permisos obligan: combínalos y añade un agente revisor que compruebe el trabajo.

## Por qué los agentes se desvían o ignoran las reglas

Claude suele seguir tus instrucciones, pero ese "suele" tiene causas corregibles:

- **Compactación.** Las sesiones largas se resumen. Las reglas que solo escribiste en el chat pueden perderse; el CLAUDE.md raíz se vuelve a leer del disco.
- **Un CLAUDE.md largo o vago.** Apunta a menos de 200 líneas. "Usa sangría de 2 espacios" funciona mejor que "formatea bien el código".
- **Instrucciones contradictorias.** Claude puede elegir una al azar.
- **Reglas sin excepciones.** CLAUDE.md es contexto, no configuración obligatoria. Claude puede decidir que una pauta no aplica.

La idea clave: **CLAUDE.md orienta; los hooks y los permisos obligan.** Sobre lo primero decide Claude; lo segundo lo aplica Claude Code siempre. Construye capas:

1. **Instrucciones**: CLAUDE.md y `.claude/rules/`.
2. **Permisos**: reglas deny y ask.
3. **Hooks**: scripts en puntos fijos, como antes de usar una herramienta o antes de que Claude termine.
4. **Agentes revisores**: un contexto limpio que revisa el trabajo.
5. **CI**: tests y comprobaciones en cada push o pull request.
6. **Revisión humana**: una persona aprueba el merge.

## Paso 1: Escribe reglas que Claude pueda seguir

Cada regla, corta, concreta y comprobable. `/doctor prompt-audit` encuentra instrucciones obsoletas o contradictorias y propone cambios.

Mueve las reglas de una zona concreta a `.claude/rules/`. Una regla con `paths` en el frontmatter solo se carga cuando Claude lee o edita un archivo que coincide:

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# Reglas de la API
- Valida cada body con el esquema de src/api/schemas/
- Devuelve los errores con sendError() de src/api/errors.ts
```

La compactación resume las reglas con `paths` hasta que Claude toque otra vez un archivo que coincida. Lo que deba sobrevivir, al CLAUDE.md raíz. También puedes indicar qué conservar:

```markdown
# Compact instructions

Al compactar, conserva los comandos de test, la lista de archivos cambiados y cualquier regla que el usuario haya dicho en el chat.
```

¿Y IMPORTANT o YOU MUST? Si sigues añadiendo énfasis y Claude sigue saltándose la línea, el archivo es demasiado largo o esa línea debe ser un hook. Mira [CLAUDE.md y memoria](/learn/03-claude-md-memory).

- [ ] Dejé CLAUDE.md en menos de 200 líneas de reglas concretas
- [ ] Moví las reglas de zonas concretas a `.claude/rules/` con `paths`
- [ ] Añadí una sección "Compact instructions"

## Paso 2: Bloquea lo que nunca debe pasar con permisos

Los permisos deciden qué puede ejecutar, leer y editar Claude. Se evalúan en orden deny, ask, allow, y **las reglas deny se cumplen en todos los modos de permisos**, incluidos auto y `bypassPermissions`. Añádelas a `.claude/settings.json`:

```json
{
  "permissions": {
    "ask": ["Bash(git push *)"],
    "deny": [
      "Read(./.env)",
      "Read(./secrets/**)",
      "Edit(/src/gen/**)"
    ]
  }
}
```

Ahora Claude no puede leer `.env` (ni con `cat .env`), ni editar código generado, y pregunta antes de `git push`. Las reglas miran llamadas, no intenciones: `Bash(git push *)` no detecta `git -C . push` y `Read` no frena un script que abra el archivo. Mantén la protección de rama en `main`.

- [ ] Denegué los secretos y las carpetas que Claude nunca debe editar
- [ ] Puse `git push` en ask (o deny)

## Paso 3: Obliga a cumplir pasos con hooks

Los hooks son comandos que Claude Code ejecuta en eventos fijos. Los útiles aquí:

| Evento | Cuándo se dispara | ¿Puede bloquear? |
| --- | --- | --- |
| `PreToolUse` | Antes de usar una herramienta | Sí, bloquea la llamada |
| `PostToolUse` | Después de una llamada correcta | No, ya se ejecutó; stderr llega a Claude |
| `Stop` | Cuando Claude termina de responder | Sí, Claude sigue trabajando |
| `SubagentStop` | Cuando termina un subagente | Sí, el subagente sigue trabajando |
| `UserPromptSubmit` | Antes de que Claude vea tu prompt | Sí, y puede añadir contexto |

El hook recibe JSON por stdin. **Exit 0** significa sin objeciones. **Exit 2** bloquea, y lo que escribas en stderr le llega a Claude como motivo.

**Bloquea ediciones en archivos protegidos.** Guarda esto como `.claude/hooks/protect-files.sh` y ejecuta `chmod +x` sobre él:

```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

for pattern in ".env" "package-lock.json" ".git/" "migrations/"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH is protected ($pattern)" >&2
    exit 2
  fi
done
exit 0
```

**Exige que los tests pasen antes de terminar.** Registra los dos hooks en `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "pnpm test 1>&2 || exit 2" }
        ]
      }
    ]
  }
}
```

Si los tests fallan, Claude recibe la salida y sigue. Tras ocho bloqueos seguidos sin llamadas a herramientas entre medias, Claude Code le deja terminar, así que no hay bucle infinito.

También útiles: un hook `PostToolUse` que formatea (mira [Empieza un proyecto nuevo](/learn/start-new-project)) y un hook `SessionStart` con matcher `compact` que repite los recordatorios clave tras cada compactación.

Dos avisos. Los hooks `prompt` y `agent` dejan decidir a un modelo: para reglas firmes, usa `command`. Y **los hooks de comando se ejecutan con todos tus permisos de usuario.** Léelos antes de activarlos; `claude -p` ejecuta los hooks de un repo sin pedir confianza.

- [ ] Añadí un hook PreToolUse para rutas protegidas
- [ ] Añadí un hook Stop que ejecuta tests o typecheck
- [ ] Revisé cada script de hook antes de activarlo

## Paso 4: Añade un subagente revisor

Un subagente tiene su propio contexto: revisa el trabajo sin el razonamiento que lo produjo, pero carga tu CLAUDE.md y tus reglas. Guarda esto como `.claude/agents/rules-reviewer.md`:

```markdown
---
name: rules-reviewer
description: Revisa los archivos cambiados contra CLAUDE.md y .claude/rules. Úsalo de forma proactiva tras cambiar código, antes de hacer commit.
tools: Read, Grep, Glob
model: sonnet
---

Revisas código que no escribiste. Recibes una lista de archivos cambiados.

1. Lee CLAUDE.md y cada archivo de .claude/rules/ que aplique.
2. Lee cada archivo cambiado.
3. Para cada regla, decide: cumplida, incumplida o no aplica.

Informa solo de las reglas incumplidas: archivo, línea, regla, arreglo breve.
Ignora preferencias de estilo que ninguna regla mencione.
Si no hay incumplimientos, di "Sin incumplimientos".
```

Claude Code obliga a respetar la lista `tools`: este revisor puede leer pero no editar. Si añades `Bash` para `git diff`, también podrá cambiar archivos.

Cómo se ejecuta:

- **Automáticamente**: Claude delega cuando la tarea encaja con la `description`; "de forma proactiva" lo favorece.
- **Por nombre**: "pide al rules-reviewer que revise mis cambios".
- **Garantizado**: escribe `@` y elígelo, o escribe `@agent-rules-reviewer`.

Otro útil: un `test-runner` con Bash y `model: haiku` que solo informe de fallos. Para bugs en general, `/code-review` revisa tu diff en un subagente limpio. Mira [MCP, skills y subagentes](/learn/04-mcp-skills-subagents).

- [ ] Creé `.claude/agents/rules-reviewer.md` con herramientas de solo lectura
- [ ] Lo ejecuté una vez sobre un cambio real

## Paso 5: Supervisa flujos entre sesiones y equipos

- **Registra cada comando.** Un hook `PostToolUse` con matcher `Bash` y el comando `jq -r '.tool_input.command' >> ~/.claude/command-log.txt` deja un registro sencillo.
- **OpenTelemetry.** Define `CLAUDE_CODE_ENABLE_TELEMETRY=1` y un exportador (`OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER`). Los eventos `claude_code.tool_result` y `claude_code.tool_decision` muestran qué se ejecutó y qué se aceptó o rechazó. Los settings del repo no pueden activarla: usa tu shell o los settings de usuario o gestionados.
- **Comprobaciones headless en CI.** `claude -p` se ejecuta una vez y sale con código distinto de cero si falla. Añade `--bare` para saltarte hooks locales y CLAUDE.md, `--allowedTools` con `--permission-mode dontAsk` para limitar herramientas y `--max-turns` para acotarlo.
- **Pull requests.** `/install-github-app` configura GitHub Actions. Code Review (Team y Enterprise) comenta las pull requests, pero nunca las aprueba ni las bloquea.
- **Equipos de agentes** (experimental, desactivado por defecto): los hooks `TeammateIdle` y `TaskCompleted` pueden salir con 2 para devolver a un compañero al trabajo.

- [ ] Añadí un hook que registra comandos u OpenTelemetry
- [ ] Añadí una comprobación de Claude en CI o en pull requests (opcional)

## Paso 6: Comprueba que funciona

No te fíes de una barrera que no has visto saltar.

1. Ejecuta `/hooks` y confirma que cada hook aparece en el evento correcto.
2. Pide a Claude algo prohibido, como "añade un comentario a .env". Deberías ver el mensaje `Blocked:`.
3. Pulsa `Ctrl+O` para ver la transcripción, o arranca con `claude --debug` para más detalle.
4. Ejecuta `/context` y mira **Memory files** para confirmar que CLAUDE.md se cargó.
5. `/agents` ahora solo muestra un recordatorio para pedírselo a Claude o editar `.claude/agents/` directamente. Menciona el agente con `@` para probarlo.

Después abre este panel. **Herramientas usadas** muestra qué herramientas se ejecutaron, **Subagentes** muestra el contexto máximo y las llamadas de cada subagente, y la fila **Salida de hooks** muestra lo que añadieron tus hooks. Mira [Cómo leer este panel](/learn/06-reading-the-dashboard).

- [ ] Vi a un hook bloquear una acción mala a propósito
- [ ] Encontré el revisor y la salida de hooks en este panel

## Problema que ves, mejor barrera

| Problema que ves | Mejor barrera |
| --- | --- |
| Edita archivos prohibidos | Regla deny `Edit(...)` o hook PreToolUse (exit 2) |
| Lee secretos | Regla deny `Read(...)`, más el sandbox |
| Olvida ejecutar los tests | Hook Stop que ejecuta los tests |
| Ignora el formato | Hook PostToolUse con formateador |
| Ejecuta comandos arriesgados | Permiso `ask` o `deny` |
| Hace push a main | `ask` en `git push`, más protección de rama |
| Se desvía tras compactar | CLAUDE.md corto, Compact instructions, hook SessionStart `compact` |
| Rompe las convenciones del proyecto | Subagente rules-reviewer antes del commit |
| Un subagente se porta mal | Restringe sus `tools`, añade hooks en su frontmatter |

## Consejos rápidos

- Mantén pocas reglas obligatorias. Un hook es para una regla sin excepciones; las preferencias se quedan en CLAUDE.md.
- ¿Repites una regla en el chat? Ponla en CLAUDE.md, que sobrevive a la compactación. Mira [Compactación](/learn/compaction).
- Pide a Claude que te escriba los hooks ("escribe un hook que bloquee ediciones en migrations/") y luego léelos.

## Más información

- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Configure permissions](https://code.claude.com/docs/en/permissions)
- [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Monitoring](https://code.claude.com/docs/en/monitoring-usage)
- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Code Review](https://code.claude.com/docs/en/code-review)
