# Planifica antes de construir: el modo plan

> Deja que Claude explore y proponga un plan, acuerda con él el enfoque y solo entonces deja que edite.

## Qué es el modo plan

El modo plan le pide a Claude que investigue y proponga cambios sin hacerlos. En modo plan, Claude:

- **Puede** leer archivos, buscar en el código y ejecutar comandos de shell para explorar.
- **Puede** escribir un plan y hacerte preguntas.
- **No puede** editar tus archivos de código hasta que apruebes el plan.

Los comandos de shell siguen pasando por tus permisos. Con el modo auto disponible, su clasificador los revisa por defecto. Sin él, todo comando fuera del conjunto de solo lectura integrado pide aprobación.

Una excepción: si iniciaste la sesión de terminal con bypass permissions disponible, los bloqueos del modo plan no se aplican. Claude sigue sin deber editar, pero nada se lo impide.

Para investigar el código mientras planifica, Claude puede recurrir al subagente integrado **Plan**, que lee en su propia ventana de contexto. Así lo que explora no llena tu conversación principal.

## Entrar, salir y empezar en modo plan

| Cómo | Qué hace |
| --- | --- |
| `Shift+Tab` | Recorre los modos de permisos hasta que la barra de estado muestra `⏸ plan mode on` |
| `/plan <tu prompt>` | Ejecuta ese único prompt en modo plan |
| `claude --permission-mode plan` | Inicia la sesión en modo plan |
| `"defaultMode": "plan"` en `.claude/settings.json` | Hace que las sesiones de terminal de este proyecto empiecen en modo plan |
| `Shift+Tab` otra vez | Sale del modo plan sin aprobar ningún plan |

El ajuste va dentro de `permissions`:

```json
{
  "permissions": {
    "defaultMode": "plan"
  }
}
```

En la extensión de VS Code, usa `claudeCode.initialPermissionMode` con valor `plan` en tus ajustes de usuario: allí no se leen los del proyecto.

## Revisar, editar y aprobar

Cuando el plan está listo, Claude te lo enseña y te pregunta cómo seguir:

- **Yes, and use auto mode**: apruebas y Claude trabaja sin pedirte permiso para lo rutinario. Si el modo auto no está disponible, verás **Yes, auto-accept edits**.
- **Yes, manually approve edits**: apruebas y revisas tú cada edición.
- **No, keep planning**: sigues en modo plan y le dices a Claude qué cambiar.

Pulsa `Ctrl+G` para abrir el plan en tu editor de texto y cambiarlo directamente antes de que Claude empiece. Si tienes activado el ajuste `showClearContextOnPlanAccept`, aparece también una opción que aprueba el plan y borra el contexto de la planificación.

Al aprobar, sales del modo plan. Para volver a planificar, usa `Shift+Tab` o `/plan`.

## Cuándo usarlo y cuándo no

El modo plan sirve para cambios que quieres revisar antes de que lleguen al disco. En la práctica compensa cuando:

- El cambio toca varios archivos o módulos.
- Aún no conoces bien el código.
- La refactorización es arriesgada o difícil de deshacer.
- Los requisitos no están claros y quieres ver primero qué ha entendido Claude.

Sáltatelo para una errata, un arreglo de una línea o un renombrado que puedes describir en una frase. El plan costaría más que el cambio.

## Por qué ahorra contexto y dinero

- **Exploras una vez.** Claude lee el código relevante al planificar, mejor aún mediante el subagente Plan, en lugar de redescubrirlo en cada intento.
- **Acuerdas antes de pagar por código.** Corregir una suposición en un plan cuesta una respuesta corta. Tras editar diez archivos cuesta rehacerlo, y el intento fallido se queda en el historial y se reenvía cada turno.
- **Menos correcciones.** Tras dos correcciones fallidas, lo recomendado es hacer `/clear` y empezar de nuevo. Un buen plan hace que eso pase menos.
- **Respeta la caché.** El modo plan añade sus instrucciones como mensajes, así que entrar y salir conserva la caché de prompts. La excepción es el ajuste de modelo `opusplan`: usa Opus en modo plan y Sonnet al ejecutar, así que cada cambio es un cambio de modelo y empieza una caché nueva. Lo tienes en [¿Cambiar a mitad de sesión o empezar de cero?](/learn/change-or-restart).

## Un ejemplo práctico

Quieres añadir límite de peticiones a una API que no escribiste tú. Entra en modo plan y pide:

```text
/plan Add per-user rate limiting to the public API routes in src/api/.
Limit: 100 requests per minute, return 429 with a Retry-After header.
Find how auth and middleware work today before proposing anything.
Don't touch the admin routes. Tell me how you'll test it.
```

Un buen plan es corto, concreto y comprobable:

```text
1. Add src/api/middleware/rateLimit.ts: in-memory sliding window keyed by user id.
2. Register it in src/api/router.ts after authMiddleware, public routes only.
3. Return 429 + Retry-After when over the limit.
4. Tests in tests/api/rateLimit.test.ts: under limit, over limit, reset, admin unaffected.
5. Run npm test.
Open question: in-memory won't work with several servers. Redis later?
```

Ahora rebate lo que no encaje. Elige **No, keep planning** y responde, por ejemplo:

```text
We run three instances, so use the existing Redis client in src/lib/redis.ts.
Also add the limit to config instead of hard-coding 100.
```

Cuando el plan coincida con lo que harías tú, apruébalo.

## Planificar, implementar, probar, hacer commit

1. **Planifica** en modo plan hasta estar de acuerdo con el enfoque.
2. **Implementa**: aprueba y mira el primer minuto. `Esc` detiene a Claude si se desvía.
3. **Prueba**: el plan debería nombrar la comprobación. Pide a Claude que la ejecute y arregle los fallos.
4. **Haz commit** cuando pasen las pruebas, para tener un punto limpio al que volver.

Cada prompt crea un checkpoint, y `/rewind` (o `Esc` dos veces con el prompt vacío) restaura el código, la conversación o ambos. Solo registran las ediciones de las herramientas de archivos de Claude, no las de comandos Bash, así que haz commit igualmente. Más en [Flujos de trabajo del día a día](/learn/05-workflows).

Si el plan es grande, guárdalo en un archivo de especificación y constrúyelo en una sesión nueva.

## Errores comunes

| Error | Por qué perjudica | Mejor |
| --- | --- | --- |
| Aprobar un plan leído por encima | Las suposiciones erróneas se convierten en código erróneo en muchos archivos | Léelo y corrígelo con **No, keep planning** o `Ctrl+G` |
| Una petición vaga como "añade rate limiting" | Claude adivina el alcance y el plan sale genérico | Nombra archivos, límites, restricciones y cómo probarlo |
| Planificar un arreglo de una línea | Explorar cuesta más que el arreglo | Pide el cambio directamente |
| Entrar y salir del modo plan a menudo con `opusplan` | Cada cambio es un cambio de modelo y un fallo de caché | Planifica una vez y luego implementa |
| Tratar el modo plan como un candado con bypass permissions activo | Ahí los bloqueos no se aplican | Usa los permisos normales cuando el candado importa |

## Lista de comprobación del modo plan

- [ ] La tarea es más que un arreglo de una frase
- [ ] Mi prompt nombra el objetivo, los archivos y los límites
- [ ] El plan incluye archivos, pasos y una prueba
- [ ] He rebatido lo que estaba mal antes de aprobar
- [ ] He elegido ediciones auto o manuales a propósito
- [ ] Pasan las pruebas y entonces hago commit

## Consejos rápidos

- `/plan` para un solo prompt, `Shift+Tab` para quedarte en modo plan.
- `Ctrl+G` edita el plan en tu editor.
- Pide a Claude que liste las preguntas abiertas al final del plan.
- Más sobre subagentes en [MCP, skills y subagentes](/learn/04-mcp-skills-subagents).

## Aprende más

- [El modo plan en los modos de permisos](https://code.claude.com/docs/en/permission-modes)
- [Flujos de trabajo comunes](https://code.claude.com/docs/en/common-workflows)
- [Buenas prácticas](https://code.claude.com/docs/en/best-practices)
- [Modo interactivo](https://code.claude.com/docs/en/interactive-mode)
- [Subagentes](https://code.claude.com/docs/en/sub-agents)
- [Configuración de modelos](https://code.claude.com/docs/en/model-config)
- [Caché de prompts](https://code.claude.com/docs/en/prompt-caching)
- [Checkpoints](https://code.claude.com/docs/en/checkpointing)
