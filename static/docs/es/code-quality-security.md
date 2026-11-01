# Mejor código y menos vulnerabilidades con Claude

> Trata el código de Claude como el pull request de un compañero rápido: planifícalo, pruébalo, escanéalo y lee tú el diff.

## Por qué el código escrito por IA también necesita revisión

Claude escribe código que parece terminado. Ahí está el riesgo: el código **plausible pero incorrecto** pasa un vistazo rápido. Problemas típicos:

- **Bugs sutiles**: un error por uno, un permiso sin comprobar, un error silenciado.
- **APIs desactualizadas**: una función obsoleta o distinta en tu versión.
- **Paquetes dudosos**: una dependencia mal escrita, abandonada o inexistente. Comprueba que cada paquete nuevo existe, es el que querías y se mantiene.
- **Secretos en el código**: una API key "solo para probar" que acaba en un commit.
- **Valores por defecto inseguros**: CORS abierto, modo debug activo, sin límite de peticiones, errores muy detallados.

La documentación oficial es clara: tú revisas el código y los comandos propuestos antes de aprobarlos. Hasta las herramientas de Claude avisan: una revisión sin hallazgos no garantiza código seguro. Aun así, Claude puede hacer mucha de la comprobación.

## Las ayudas que trae Claude Code

| Herramienta | Qué hace |
| --- | --- |
| `/security-review` | Busca inyección, fallos de autenticación, exposición de datos y más en el diff entre tu rama y la rama por defecto de origin. Necesita un remoto `origin`. |
| `/code-review` | Busca bugs en tu rama con un subagente nuevo que no vio tu conversación. `--fix` aplica los hallazgos. `/review` es un alias. |
| Plugin security-guidance | Revisa la seguridad de los cambios de Claude mientras trabaja: en cada edición, turno y commit. |
| Modo plan | `Shift+Tab` o `/plan`: Claude lee y propone, pero no edita hasta que apruebes. |
| `/rewind` | Vuelve a un checkpoint de código y conversación. También `Esc` dos veces. |
| Hooks | Ejecutan formateador, linter o tests en puntos fijos, siempre. |
| `/sandbox` | Limita a qué archivos y hosts de red llegan los comandos de shell. |

Instala el plugin con:

```text
/plugin install security-guidance@claude-plugins-official
```

En GitHub, `/install-github-app` configura la GitHub Action de Claude Code, y los planes Team y Enterprise pueden activar **Code Review**, que comenta cada pull request. Ninguno aprueba ni bloquea un PR: el merge lo decides tú.

Los checkpoints ignoran archivos que solo cambió Bash y no sustituyen a git. Haz commits a menudo.

## Un flujo que detecta problemas pronto

1. **Planifica.** Usa el modo plan para lo arriesgado. Léelo, sobre todo si toca autenticación, pagos, rutas de archivos o entrada del usuario.
2. **Escribe los tests primero (o junto al código).** Pide tests que fallen, con casos de abuso. Son la prueba que Claude se aplica a sí mismo.
3. **Implementa.** Aprueba el plan y deja que Claude programe.
4. **Ejecuta tests y linters.** Pide el comando exacto y su salida, no solo "todo pasa".
5. **Revisión de seguridad.** `/security-review` y luego `/code-review` para la corrección.
6. **Revisa tú el diff.** Con `/diff` o en tu editor.
7. **Haz commit.** Pequeños, con mensajes claros, en una rama.

Más patrones en [Flujos de trabajo del día a día](/learn/05-workflows).

## Automatiza las comprobaciones con hooks

Una línea en CLAUDE.md funciona casi siempre; un hook, siempre. Este hook `Stop`, de las buenas prácticas oficiales, no deja terminar a Claude mientras falle el typecheck (la salida 2 le devuelve los errores):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "pnpm tsc --noEmit 1>&2 || exit 2" }
        ]
      }
    ]
  }
}
```

Cámbialo por tu comando de lint o tests. Un hook `PostToolUse` con matcher `Edit|Write` pasa un formateador tras cada edición.

En CI, pasa un diff al modo headless. `--bare` omite los hooks, plugins y CLAUDE.md del repo, como recomienda la documentación para scripts:

```bash
git diff main | claude --bare -p "review this diff for security issues. list file:line, the risk and a fix. return nothing else."
```

## Patrones de prompt

**Revisión de seguridad de un diff con amenazas concretas:**

```text
Review the diff on this branch for security issues. Check specifically:
injection (SQL, shell, template), broken auth or missing authorization checks,
hard-coded secrets, missing input validation, path traversal, SSRF, XSS,
unsafe deserialization, and risky new dependencies.
For each finding: file:line, how it could be exploited, severity, and a fix.
Skip style issues. Say "no findings" for a category if you checked it.
```

**Que te explique el código arriesgado antes de aceptarlo:**

```text
Explain what src/api/upload.ts does with user input, step by step.
Where does untrusted data enter, where is it validated, and where does it
reach the filesystem, a database or a shell? What would an attacker try first?
```

**Tests de casos límite y de abuso:**

```text
Write tests for the password reset flow before changing it. Cover:
empty and very long input, unicode, expired and reused tokens,
another user's token, many requests in a row, and missing fields.
Run them and show me which fail.
```

**Comprobar dependencias nuevas:**

```text
List every dependency this change adds. For each one, check the registry:
does it exist under exactly this name, who maintains it, when was the last
release, and is there a well-known alternative we already use?
Flag anything new, unmaintained or with a name close to a popular package.
```

## Checklist estilo OWASP

| Riesgo | Qué revisar | Pídele a Claude |
| --- | --- | --- |
| Inyección | Consultas y comandos construidos con cadenas | "Busca consultas o comandos hechos con entrada del usuario." |
| Autenticación rota | Sesiones, tokens, gestión de contraseñas | "¿Cómo se crean, caducan y revocan las sesiones?" |
| Secretos y exposición de datos | Claves en código, logs, mensajes de error | "Busca secretos en el diff y qué datos registramos." |
| Control de acceso | Cada endpoint comprueba usuario y propiedad | "Lista los endpoints sin comprobación de propiedad." |
| Mala configuración | CORS, debug, contraseñas por defecto, cabeceras | "¿Qué ajustes son inseguros en producción?" |
| XSS | HTML crudo, `innerHTML`, plantillas sin escape | "¿Dónde llega contenido del usuario sin escapar?" |
| Deserialización insegura | `pickle`, `eval`, YAML o JSON no fiable a objetos | "¿Dónde convertimos datos no fiables en objetos?" |
| Dependencias vulnerables | Versiones viejas, paquetes abandonados o raros | "¿Qué dependencias están viejas o abandonadas?" |
| Logs y monitorización | Logins fallidos y errores registrados, sin secretos | "¿Qué eventos de seguridad no veríamos hoy?" |
| SSRF | El servidor pide URLs que controla el usuario | "¿Dónde puede un usuario hacer que el servidor pida una URL?" |

## Hábitos de equipo

**Reglas en CLAUDE.md**, cortas y concretas:

```markdown
# Security and code style
- Validate all request input with the schemas in src/schemas/
- Use parameterized queries only, never string concatenation
- Never log tokens, passwords or full request bodies
- Secrets come from environment variables, never from code
- New dependencies need a reason in the PR description
```

CLAUDE.md es una guía, y Claude puede decidir que una línea no aplica. Lo que nunca debe pasar va en **reglas deny** o hooks. Las reglas deny valen en todos los modos:

```json
{
  "permissions": {
    "ask": ["Bash(git push *)"],
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"]
  }
}
```

- **Sube `.claude/settings.json` al repo** para compartir reglas y hooks.
- **Protege main** con revisiones y checks obligatorios. Nunca dejes que un agente haga push a main sin revisión.
- **Guarda los secretos en un gestor** (GitHub Secrets en los workflows) y da a CI los permisos mínimos.
- **Mantén las dependencias al día** y revisa sus PR como cualquier cambio.

Para proteger el entorno, lee [Protege tu configuración de Claude Code](/learn/secure-setup); para contenido externo, [Inyección de prompts: trabaja seguro con contenido externo](/learn/prompt-injection).

## Consejos rápidos

- Nombra las amenazas: una lista da una revisión más precisa.
- Añade "skip style" a las revisiones para evitar ruido.
- Pide pruebas: comando y salida.
- No arregles todo a ciegas. Pide a Claude que muestre cómo se explotaría cada hallazgo.

## Antes de hacer merge

- [ ] Leí el plan antes de que Claude editara algo arriesgado
- [ ] Los tests cubren el caso normal, límites y abusos
- [ ] Tests, linter y typecheck pasan, y vi la salida
- [ ] Pasé `/security-review` y `/code-review` y atendí los hallazgos
- [ ] Las dependencias nuevas existen, se mantienen y hacen falta
- [ ] No hay secretos, flags de debug ni valores abiertos en el diff
- [ ] Leí yo todo el diff
- [ ] El cambio entra por pull request, no directo a main

## Aprende más

- [Seguridad](https://code.claude.com/docs/en/security)
- [Revisa en local con /code-review](https://code.claude.com/docs/en/code-review-local)
- [Seguridad mientras Claude escribe código](https://code.claude.com/docs/en/security-guidance)
- [Code Review](https://code.claude.com/docs/en/code-review)
- [GitHub Actions de Claude Code](https://code.claude.com/docs/en/github-actions)
- [Buenas prácticas](https://code.claude.com/docs/en/best-practices)
- [Automatiza acciones con hooks](https://code.claude.com/docs/en/hooks-guide)
- [Configura los permisos](https://code.claude.com/docs/en/permissions)
- [Checkpoints](https://code.claude.com/docs/en/checkpointing)
