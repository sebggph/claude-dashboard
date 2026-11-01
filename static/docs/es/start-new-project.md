# Empieza un proyecto nuevo con Claude Code

> Una configuración paso a paso para un proyecto nuevo: contexto ligero, instrucciones claras y menos sorpresas.

## Qué vas a configurar

El inicio de un proyecto es el mejor momento para dejar Claude Code bien preparado. Unos minutos ahora te ahorran tokens, avisos de permisos y explicaciones repetidas en cada sesión. Vas a elegir un modelo, escribir un buen primer prompt, crear un CLAUDE.md corto, añadir ajustes útiles y revisar el resultado en este panel.

Tiempo de lectura: unos 8 minutos. Marca las casillas a medida que avanzas.

## Paso 1: Antes de empezar

Instala Claude Code (o comprueba que ya lo tienes) y arráncalo desde la carpeta del proyecto. Claude lee la carpeta en la que lo inicias, así que lánzalo siempre desde la raíz del proyecto.

```bash
curl -fsSL https://claude.ai/install.sh | bash
claude --version
cd /path/to/my-project
claude
```

En Windows PowerShell usa `irm https://claude.ai/install.ps1 | iex`. La instalación nativa se actualiza sola en segundo plano; con Homebrew o WinGet tienes que actualizar a mano.

Ahora elige **modelo y esfuerzo al principio**. Cada modelo tiene su propia caché de prompts, así que cambiar de modelo a mitad de sesión hace que la siguiente petición vuelva a leer toda la conversación sin caché. En muchas configuraciones, cambiar el esfuerzo tiene el mismo efecto. Puedes fijar ambos al arrancar:

```bash
claude --model opus --effort high
```

O usa `/model` y `/effort` justo después de empezar. El esfuerzo por defecto (`medium`) va bien para el trabajo diario; súbelo para bugs complicados. Más en [¿Cambiar a mitad de sesión o empezar de cero?](/learn/change-or-restart).

- [ ] Ejecuté `claude --version` e inicié `claude` en la raíz del proyecto
- [ ] Elegí modelo y esfuerzo antes del primer prompt de verdad

## Paso 2: Describe el proyecto en tu primer prompt

Claude puede leer código, pero un proyecto nuevo casi no tiene. No puede ver tus objetivos, tus preferencias ni qué consideras terminado. Cuéntaselo desde el principio. Los puntos que más ayudan:

- **Objetivo y usuarios**: qué construyes y para quién.
- **Stack y versiones**: lenguaje, framework, base de datos, gestor de paquetes.
- **Cómo ejecutar, compilar y probar**: aunque los comandos aún no existan, di qué herramientas quieres.
- **Estructura de carpetas**: dónde va el código, los tests y la documentación.
- **Convenciones de código**: estilo, nombres, manejo de errores, librerías preferidas.
- **Qué significa "terminado"**: los tests pasan, la página carga, el endpoint devuelve los datos correctos.
- **Qué NO tocar**: archivos generados, secretos, carpetas de otras personas.

Copia, rellena y pega esta plantilla:

```text
I'm starting a new project. Here is the context:

Goal: [one or two sentences: what it does and who uses it]
Stack: [e.g. TypeScript 5, Node 22, Fastify, PostgreSQL 16, pnpm]
Run / build / test: [e.g. pnpm dev, pnpm build, pnpm test with Vitest]
Structure: [e.g. src/ for code, tests/ next to it, docs/ for notes]
Conventions: [e.g. small functions, no default exports, errors via src/lib/errors.ts]
Done means: [e.g. tests pass, lint is clean, README explains how to run it]
Do not touch: [e.g. .env files, the vendor/ folder]

First, set up the project skeleton with a working test command.
Ask me questions if anything is unclear before you start.
```

Puedes escribirla en español si lo prefieres: Claude te entiende igual. ¿Aún no tienes claros los detalles? Pide a Claude que te entreviste: "Interview me until you could write the spec, then write it to SPEC.md." Después abre una sesión nueva para construir a partir de esa especificación.

- [ ] Escribí un primer prompt con objetivo, stack, comandos, convenciones y "terminado"
- [ ] Indiqué lo que Claude no debe tocar

## Paso 3: Crea CLAUDE.md con /init y recórtalo

Cuando ya haya algo de código, ejecuta `/init`. Claude analiza el proyecto y escribe un `CLAUDE.md` inicial con los comandos de compilación, las instrucciones de test y las convenciones que encuentra. Si ya existe un archivo, sugiere mejoras en lugar de sobrescribirlo.

```text
/init
```

Luego edítalo. El trabajo consiste sobre todo en **quitar líneas**.

- **Conserva**: los comandos exactos (instalar, tests, un solo archivo de test, lint, typecheck), las convenciones que Claude no puede adivinar y las trampas.
- **Deja fuera**: lo que Claude puede aprender del código, los procedimientos largos (conviértelos en skills) y las reglas que nunca deben romperse (usa un hook o una regla deny).
- **Mantenlo corto**: la guía oficial recomienda menos de 200 líneas por archivo. Cada línea se carga en cada sesión.

Un buen ejemplo:

```markdown
# Project
Recipe-sharing web app. Users save, tag and search recipes.

# Commands
- Install: pnpm install
- Dev server: pnpm dev
- All tests: pnpm test
- One test file: pnpm vitest run path/to/file.test.ts
- Lint and typecheck: pnpm lint && pnpm tsc --noEmit

# Conventions
- TypeScript strict mode, no `any`
- API handlers live in src/api/, one file per resource
- Throw errors with helpers in src/lib/errors.ts, never raw strings
- New features need a test in the same folder

# Gotchas
- Tests need DATABASE_URL, copy .env.example to .env
- src/gen/ is generated by `pnpm codegen`, never edit it by hand
```

Ojo: los cambios en CLAUDE.md se aplican tras `/clear`, `/compact` o un reinicio, no en la sesión en curso. Para notas personales, usa `CLAUDE.local.md`. Más en [CLAUDE.md y memoria](/learn/03-claude-md-memory).

- [ ] Ejecuté /init y revisé el CLAUDE.md que creó
- [ ] Lo recorté a comandos, convenciones y trampas

## Paso 4: Ajustes que merecen la pena

**Permisos.** Permite los comandos seguros que Claude usa todo el rato y bloquea la lectura de secretos. Usa `/permissions` en una sesión o edita `.claude/settings.json` en el proyecto:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(pnpm lint)",
      "Bash(pnpm test *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)"
    ]
  }
}
```

Los archivos de ajustes son JSON estricto: sin comentarios ni comas finales. Ejecuta `/status` para confirmar que el archivo se cargó.

**¿Qué archivo subir al repositorio?**

| Archivo | A quién afecta | ¿Commit? |
| --- | --- | --- |
| `.claude/settings.json` | A todo el proyecto | Sí |
| `.claude/settings.local.json` | Solo a ti, en este proyecto | No |
| `~/.claude/settings.json` | Solo a ti, en todos los proyectos | No va en el repo |

Claude Code deja `settings.local.json` fuera de git cuando crea el archivo él mismo. Si lo creas a mano, añádelo a `.gitignore`, junto con `CLAUDE.local.md` y tus archivos `.env`.

**Línea de estado.** Muestra en todo momento cuánto contexto llevas usado:

```text
/statusline show model name and context percentage with a progress bar
```

Claude Code escribe un script y actualiza tus ajustes de usuario por ti.

- [ ] Permití los comandos de test y lint, bloqueé la lectura de `.env`
- [ ] Subí `.claude/settings.json` e ignoré los archivos locales
- [ ] Configuré una línea de estado con el % de contexto

## Paso 5: Añade solo los servidores MCP y skills que necesitas

Cada servidor MCP y cada skill añade algo a todas las sesiones. Tool search mantiene MCP ligero (primero los nombres, las definiciones completas cuando hacen falta) y las skills solo cargan su descripción hasta que se usan, pero todo suma. Empieza sin nada y añade un servidor solo cuando te veas copiando datos de otra herramienta al chat una y otra vez. Una buena CLI como `gh` suele ser aún más barata.

```text
/context
/mcp
```

`/context` muestra qué llena tu contexto ahora mismo. `/mcp` muestra el estado de los servidores y te deja desactivar los que no uses. Detalles en [MCP, skills y subagentes](/learn/04-mcp-skills-subagents).

- [ ] Revisé /context después de añadir un servidor MCP o una skill
- [ ] Desactivé con /mcp los servidores que no uso

## Paso 6: Tu primera tarea, de forma eficiente

Usa un ciclo sencillo para cada tarea:

1. **Planifica**: pulsa `Shift+Tab` hasta activar el modo plan, o empieza un único prompt con `/plan`. Claude lee y propone, pero no edita.
2. **Revisa**: lee el plan. Elige "No, keep planning" para cambiarlo, o pulsa `Ctrl+G` para editarlo tú.
3. **Implementa**: aprueba el plan y deja que Claude haga los cambios.
4. **Prueba**: pide a Claude que ejecute el comando de test de tu CLAUDE.md.
5. **Haz commit**: "commit my changes with a descriptive message".

```text
/plan add a recipe search endpoint with tests, following CLAUDE.md
```

Al terminar la tarea, ejecuta `/clear` antes de la siguiente. No cuesta nada, y la próxima tarea no seguirá pagando el historial de esta. Más patrones en [Flujos de trabajo del día a día](/learn/05-workflows).

- [ ] Planifiqué, revisé, implementé, probé e hice commit de una tarea
- [ ] Ejecuté /clear antes de empezar la siguiente

## Paso 7: Haz reutilizable lo que repites

Si escribes las mismas instrucciones dos veces, crea una skill. Los comandos personalizados ahora son skills: un archivo en `.claude/skills/<name>/SKILL.md` crea `/name`. Los antiguos `.claude/commands/*.md` siguen funcionando.

```markdown
---
name: new-endpoint
description: Create a new API endpoint with a test
disable-model-invocation: true
---

Create an API endpoint for $ARGUMENTS:

1. Add the handler in src/api/
2. Add a test next to it
3. Run pnpm test and fix any failures
```

Guárdala como `.claude/skills/new-endpoint/SKILL.md` y ejecuta `/new-endpoint favorites`. Con `disable-model-invocation: true`, solo tú puedes lanzarla.

Para lo que debe pasar siempre, usa un **hook**. Este, en `.claude/settings.json`, ejecuta Prettier después de cada edición de archivo:

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

Necesita `jq` y Prettier instalados. Compruébalo con `/hooks`.

- [ ] Creé una skill para una tarea que repito
- [ ] Añadí un hook de formateo (opcional)

## Paso 8: Revisa tu configuración en este panel

Trabaja una o dos sesiones, abre este panel y elige la sesión.

- Mira **Prompt del sistema, herramientas y memoria**. Es el coste fijo que pagas en cada petición. Si es grande, recorta CLAUDE.md o quita servidores MCP.
- Mira **Skills, MCP y recordatorios** para ver lo que añaden tus skills y servidores.
- Compara una sesión nueva con otra antigua para ver si tus cambios ayudaron.

Lee [Cómo leer este panel](/learn/06-reading-the-dashboard) para recorrer cada pantalla.

- [ ] Abrí una sesión y revisé la parte fija del contexto
- [ ] Revisé las filas de skills y MCP

## Tu checklist de configuración

- [ ] Inicié `claude` en la raíz del proyecto con modelo y esfuerzo elegidos
- [ ] Escribí un primer prompt con objetivo, stack, comandos, convenciones, "terminado" y límites
- [ ] Creé CLAUDE.md con /init y lo mantuve corto
- [ ] Permití comandos seguros, bloqueé secretos y subí `.claude/settings.json`
- [ ] Añadí una línea de estado con el % de contexto
- [ ] Añadí solo los servidores MCP y skills que necesito
- [ ] Usé planificar, revisar, implementar, probar, commit y luego /clear
- [ ] Convertí una tarea repetida en una skill
- [ ] Revisé la configuración en este panel

¿Ya tienes un proyecto? Sigue [Optimiza un proyecto existente](/learn/optimize-existing-project).

## Más información

- [Quickstart](https://code.claude.com/docs/en/quickstart)
- [Buenas prácticas](https://code.claude.com/docs/en/best-practices)
- [Cómo recuerda Claude tu proyecto](https://code.claude.com/docs/en/memory)
- [Ajustes](https://code.claude.com/docs/en/settings)
- [Modos de permisos](https://code.claude.com/docs/en/permission-modes)
- [Personaliza tu línea de estado](https://code.claude.com/docs/en/statusline)
- [Amplía Claude con skills](https://code.claude.com/docs/en/skills)
- [Automatiza acciones con hooks](https://code.claude.com/docs/en/hooks-guide)
- [Cómo usa Claude Code la caché de prompts](https://code.claude.com/docs/en/prompt-caching)
