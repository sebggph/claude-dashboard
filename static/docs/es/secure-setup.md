# Asegura tu configuración de Claude Code

> Un repaso de seguridad paso a paso: el modo adecuado, reglas ajustadas, sandbox, secretos a salvo y extensiones de confianza.

## Qué vas a configurar

Claude Code puede ejecutar comandos, editar archivos y salir a la red por ti. Unos pocos ajustes deciden cuánto puede hacer sin preguntar y hasta dónde llega si algo sale mal, por ejemplo después de leer una página con instrucciones ocultas (mira [Inyección de prompts](/learn/prompt-injection)). Vas a elegir un modo de permisos, escribir reglas allow, ask y deny, activar el sandbox, proteger tus secretos, revisar servidores MCP y hooks, y mantener Claude Code al día.

Tiempo de lectura: unos 8 minutos. Marca las casillas a medida que avanzas.

## Paso 1: Conoce tu modo de permisos

El modo de permisos decide qué puede hacer Claude sin preguntarte. Pulsa `Shift+Tab` para cambiar de modo; la barra de estado muestra el activo.

| Modo | Qué se ejecuta sin preguntar | Úsalo para |
| --- | --- | --- |
| `default` (Manual) | Solo lecturas | Trabajo delicado, código desconocido |
| `acceptEdits` | Lecturas, ediciones y comandos de archivos habituales | Iterar sobre código que revisas |
| `plan` | Lecturas; las ediciones esperan a que apruebes un plan | Explorar antes de cambiar |
| `auto` | Todo, con un clasificador revisando las acciones | Tareas largas en cuyo rumbo confías |
| `dontAsk` | Solo herramientas preaprobadas; el resto se deniega | CI y scripts cerrados |
| `bypassPermissions` | Todo | Solo contenedores y máquinas virtuales aisladas |

Desde la v2.1.283, las sesiones interactivas en terminal y VS Code empiezan en **modo auto** por defecto. La documentación avisa de que "no garantiza la seguridad", así que con código desconocido empieza en modo Manual:

```bash
claude --permission-mode default
```

No uses nunca `bypassPermissions` (ni `--dangerously-skip-permissions`) en tu propia máquina: no ofrece protección contra la inyección de prompts. En los demás modos, las escrituras en rutas protegidas como `.git`, `.claude` o `.vscode` nunca se aprueban solas.

- [ ] Comprobé en qué modo empiezan mis sesiones
- [ ] Uso el modo Manual o plan con código que no conozco

## Paso 2: Escribe reglas allow, ask y deny

Las reglas se aplican encima del modo. Claude Code mira **primero deny, luego ask y luego allow**, y gana la primera que coincide. Las reglas deny valen en todos los modos; las ask siguen preguntando incluso en modo auto. Las aplica Claude Code, no el modelo, así que son más fuertes que una línea en CLAUDE.md.

Un `.claude/settings.json` pequeño y seguro:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(npm test)",
      "Bash(npm run lint)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(curl *)",
      "Bash(wget *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)"
    ]
  }
}
```

Dos límites que conviene saber:

- Una regla de Bash compara el comando tal como está escrito. `Bash(curl *)` no detecta `/usr/bin/curl` ni `sh -c 'curl ...'`.
- Las reglas `Read` en deny cubren las herramientas de archivos de Claude y comandos como `cat`, pero no un script que abre archivos por su cuenta. El sandbox (paso 3) cierra ese hueco.

Las reglas `allow` de un proyecto solo se aplican cuando aceptas el diálogo de confianza del espacio de trabajo, que antes te las enseña. Léelas cuando abras el repositorio de otra persona. Ejecuta `/permissions` para ver todas las reglas y de qué archivo sale cada una.

- [ ] Añadí reglas deny para `.env` y las carpetas de secretos
- [ ] Puse `git push` y los comandos de red en `ask`
- [ ] Revisé mis reglas con `/permissions`

## Paso 3: Activa el sandbox

El sandbox es una barrera del sistema operativo alrededor de los comandos de shell que ejecuta Claude y de los procesos que lanzan. Viene desactivado. Actívalo en una sesión:

```text
/sandbox
```

Elige **auto-allow** (los comandos dentro del sandbox se ejecutan sin preguntar) o **regular permissions** (se pregunta como siempre). Por defecto, los comandos aislados solo pueden escribir en el directorio de trabajo y en una carpeta temporal, y el tráfico de red pasa por un proxy que solo deja pasar los dominios que apruebes. Las lecturas siguen llegando a casi toda la máquina, así que protege tus credenciales de forma explícita:

```json
{
  "sandbox": {
    "enabled": true,
    "credentials": {
      "files": [
        { "path": "~/.aws/credentials", "mode": "deny" },
        { "path": "~/.ssh", "mode": "deny" }
      ]
    }
  }
}
```

Lo que no cubre: las herramientas de archivos y web de Claude, los servidores MCP y los hooks se ejecutan fuera. Funciona en macOS, Linux y WSL2 (en Linux necesita `bubblewrap` y `socat`), no en Windows nativo. Si no puede arrancar, Claude Code ejecuta los comandos sin sandbox, salvo que pongas `sandbox.failIfUnavailable` a `true`.

- [ ] Ejecuté `/sandbox` y elegí un modo
- [ ] Bloqueé mis archivos de credenciales para los comandos aislados

## Paso 4: Aísla el código no fiable

Para ir más allá de los comandos de shell, mete todo el proceso de Claude Code dentro de una barrera. La documentación compara las opciones:

- **Dev container**: un entorno aislado y común para el equipo. Aun así, la documentación dice que se use con repositorios de confianza y que no montes dentro secretos del equipo anfitrión como `~/.ssh`.
- **Máquina virtual o sesión en la nube**: la recomendación para un **repositorio no fiable**.
- **Sandbox runtime**: envuelve todo el proceso, servidores MCP y hooks incluidos, sin Docker.

Si lanzas `claude -p` sobre un repositorio que no has escrito, recuerda que no muestra diálogo de confianza. Empieza con `--bare` o pasa `--settings '{"disableAllHooks": true}'` para que no se ejecuten los hooks ni los servidores del repositorio.

- [ ] Decidí dónde se abren los repositorios no fiables (máquina virtual o nube)

## Paso 5: Gestiona los secretos

- Guarda los secretos en variables de entorno o archivos `.env`, nunca en el código, en CLAUDE.md ni en los prompts. CLAUDE.md se carga en cada sesión y suele compartirse por git.
- Añade `.env`, `.claude/settings.local.json` y `CLAUDE.local.md` al `.gitignore`.
- En un `.mcp.json` compartido, referencia las claves como `${API_KEY}` en lugar de pegarlas. Claude Code expande la variable.
- Define `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` para quitar las credenciales del entorno de los comandos Bash, los hooks y los servidores MCP stdio.

- [ ] No hay secretos en CLAUDE.md, en los ajustes ni en `.mcp.json`
- [ ] `.env` y los archivos locales están en `.gitignore`

## Paso 6: Confía con cuidado en los servidores MCP

Usa servidores escritos por ti o de proveedores de confianza. Anthropic revisa los conectores del Directorio, pero no audita la seguridad de ningún servidor MCP, y los que traen contenido externo pueden exponerte a inyección de prompts.

| Ámbito | Dónde se carga | Dónde se guarda |
| --- | --- | --- |
| Local (por defecto) | Este proyecto, solo para ti | `~/.claude.json` |
| Proyecto | Este proyecto, para todo el equipo | `.mcp.json` (en el repositorio) |
| Usuario | Todos tus proyectos | `~/.claude.json` |

Claude Code pregunta antes de usar los servidores del `.mcp.json` de un proyecto. Un repositorio clonado no puede aprobar sus propios servidores. También puedes limitar sus herramientas con reglas como `mcp__github__*` y ver su estado con `/mcp`.

- [ ] Todos los servidores conectados vienen de una fuente de confianza
- [ ] Revisé en `/mcp` que no haya servidores que yo no añadí

## Paso 7: Usa hooks como barreras

Los hooks ejecutan tu propio código en momentos fijos. Un hook `PreToolUse` puede bloquear una herramienta antes de que se ejecute, y su `"deny"` vale en todos los modos de permisos. Este, sacado de la documentación, manda los comandos `rm` a un script:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh"
          }
        ]
      }
    ]
  }
}
```

El script lee el comando con `jq` y devuelve `"permissionDecision": "deny"` si contiene `rm -rf`. Tienes el script completo en la referencia de hooks.

Los hooks también tienen su riesgo: **los hooks de comando se ejecutan con todos los permisos de tu usuario.** Lee cada hook antes de añadirlo, sobre todo en un repositorio clonado. Revísalos con `/hooks`.

- [ ] Añadí un hook de bloqueo (opcional)
- [ ] Revisé todos los hooks de mis ajustes

## Paso 8: Mantente al día y revisa qué subes

La instalación nativa se actualiza sola; con Homebrew o WinGet necesitas `brew upgrade claude-code` o `winget upgrade Anthropic.ClaudeCode`. El changelog recoge los arreglos de seguridad. Ejecuta `claude --version` para ver tu versión.

| Archivo | ¿Subirlo al repositorio? |
| --- | --- |
| `.claude/settings.json` (reglas y hooks compartidos) | Sí, tras revisarlo |
| `.mcp.json` (con referencias `${VAR}`) | Sí |
| `.claude/settings.local.json`, `CLAUDE.local.md` | No |
| `.env`, claves, credenciales | Nunca |

**Equipos y empresas** pueden desplegar ajustes gestionados que ni los usuarios ni los proyectos pueden anular, por ejemplo para bloquear la lectura de secretos o poner `disableBypassPermissionsMode` a `"disable"`. Ejecuta `/status` para ver qué fuentes de ajustes se te aplican.

- [ ] Claude Code está actualizado
- [ ] Solo subo archivos compartidos y sin secretos

## Tu lista de seguridad

- [ ] El modo adecuado para cada tarea, nunca bypass en mi máquina
- [ ] Reglas deny para secretos y ask para push y red
- [ ] Sandbox activado y archivos de credenciales bloqueados
- [ ] Repositorios no fiables en una máquina virtual o en la nube
- [ ] Secretos fuera de git, de CLAUDE.md y de `.mcp.json`
- [ ] Solo servidores MCP de confianza y hooks revisados
- [ ] Claude Code actualizado

Siguiente paso: revisa lo que escribe Claude con [Calidad de código y revisiones de seguridad](/learn/code-quality-security).

## Aprende más

- [Seguridad](https://code.claude.com/docs/en/security)
- [Elegir un modo de permisos](https://code.claude.com/docs/en/permission-modes)
- [Configurar permisos](https://code.claude.com/docs/en/permissions)
- [Configurar el sandbox de Bash](https://code.claude.com/docs/en/sandboxing)
- [Elegir un entorno aislado](https://code.claude.com/docs/en/sandbox-environments)
- [Contenedores de desarrollo](https://code.claude.com/docs/en/devcontainer)
- [Conectar Claude Code a herramientas con MCP](https://code.claude.com/docs/en/mcp)
- [Referencia de hooks](https://code.claude.com/docs/en/hooks)
- [Desplegar ajustes gestionados](https://code.claude.com/docs/en/managed-settings)
- [Changelog de Claude Code](https://code.claude.com/docs/en/changelog)
