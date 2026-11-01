# Flujos de trabajo del día a día

> Unas cuantas rutinas sencillas hacen que Claude Code sea más rápido, más barato y más seguro cada día.

## Explorar, planificar, programar, hacer commit

Un ciclo fiable para la mayoría de cambios:

1. **Explorar.** Pide a Claude que lea primero el código relevante. Para búsquedas grandes, pídele que use un subagente para que la lectura no llene tu contexto.
2. **Planificar.** Cambia al modo plan con `Shift+Tab` (o `/plan`). Claude propone un plan y no edita nada hasta que lo apruebes.
3. **Programar.** Aprueba el plan y deja que Claude lo implemente. Dale algo con lo que comprobar su trabajo, como tu comando de tests.
4. **Commit.** Pide a Claude que haga commit con un mensaje claro, o que abra una pull request.

Vigila el primer minuto. Pulsa `Esc` en cuanto Claude se desvíe. Se detiene y conserva lo hecho hasta ese momento.

## Retoma donde lo dejaste

Las sesiones se guardan en local, así que no hace falta volver a explicarlo todo.

| Comando | Qué hace |
| --- | --- |
| `claude -c` / `claude --continue` | Reabre la sesión más reciente de esta carpeta |
| `claude -r` / `claude --resume` | Abre el selector de sesiones |
| `claude --resume <name>` | Retoma una sesión con nombre |
| `/resume` | Cambia de sesión desde dentro de Claude Code |

Ponles nombre a las sesiones para encontrarlas fácilmente: `/rename auth-refactor`, o arranca con `claude -n auth-refactor`.

## Deshaz con checkpoints

Cada prompt que envías crea un checkpoint. Ejecuta `/rewind` (o pulsa `Esc` dos veces con el prompt vacío) para:

- Restaurar el código, la conversación o ambos a un punto anterior.
- Resumir parte de la conversación para liberar espacio.

Así puedes probar primero la idea más atrevida sin miedo. Ojo: los checkpoints registran las ediciones hechas con las herramientas de archivos de Claude. Los cambios hechos con comandos Bash no se registran, así que sigue usando git.

## Ejecuta Claude desde scripts

Usa `-p` para ejecutar una vez y salir. Va genial para CI, git hooks y bucles en la terminal:

```bash
git log --oneline -20 | claude -p "summarize these recent commits"
```

Opciones útiles:

- `--output-format json` para obtener un resultado que puedas procesar.
- `--allowedTools "Read,Edit"` para preaprobar herramientas.
- `--max-turns 20` para limitar una ejecución.
- `--bare` para saltarse CLAUDE.md, skills, hooks y MCP y tener ejecuciones repetibles (necesita una API key).

## Elige el modelo adecuado

- Cambia con `/model`. Los alias `sonnet`, `opus` y `haiku` eligen la versión más reciente.
- Sonnet resuelve bien la mayoría de tareas de programación y cuesta menos que Opus.
- Haiku encaja bien en subagentes con trabajos sencillos.
- `/effort` controla cuánto piensa Claude. Súbelo para bugs difíciles y bájalo para idas y venidas rápidas.

Cada modelo tiene su propia caché de prompts, así que cambiar de modelo a mitad de tarea hace que el siguiente turno sea más lento y caro. Elige el modelo al empezar la sesión.

## Consejos rápidos

- Planifica primero cualquier cosa mayor que un arreglo pequeño.
- `Esc` para parar, `/rewind` para deshacer, `/clear` para empezar de cero.
- Ponle nombre a las sesiones a las que vas a volver.
- Usa `claude -p` para tareas repetibles.
- Fija modelo y esfuerzo al principio, no a mitad de tarea.

## Más información

- [Common workflows](https://code.claude.com/docs/en/common-workflows)
- [Best practices](https://code.claude.com/docs/en/best-practices)
- [Manage sessions](https://code.claude.com/docs/en/sessions)
- [Checkpointing](https://code.claude.com/docs/en/checkpointing)
- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- [CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Model configuration](https://code.claude.com/docs/en/model-config)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
