# Escribe tu propia skill

> Convierte una tarea que repites en una skill: un SKILL.md corto que solo se carga cuando hace falta.

## Qué vas a construir

Vas a escribir una skill real, `release-notes`, ejecutarla, probarla y compartirla con tu equipo. Por el camino verás los campos del frontmatter que importan, cómo mantener una skill barata en contexto y cómo revisarla en este panel. Para lo básico de las skills frente a MCP y subagentes, mira [MCP, skills y subagentes](/learn/04-mcp-skills-subagents).

Tiempo de lectura: unos 9 minutos. Marca las casillas a medida que avanzas.

## Paso 1: Saber cuándo una skill es la herramienta adecuada

Crea una skill cuando pegas una y otra vez las mismas instrucciones, checklist o procedimiento en el chat, o cuando una sección de CLAUDE.md se ha convertido en un procedimiento en vez de un dato.

| Función | Cuándo se carga | Ideal para |
| --- | --- | --- |
| CLAUDE.md | En cada sesión, automáticamente | Reglas de "haz siempre X", comandos, convenciones |
| Skill | Nombre y descripción en la lista; el texto completo bajo demanda | Material de referencia y flujos que lanzas con `/nombre` |
| Comando personalizado (`.claude/commands/*.md`) | Igual que una skill | El formato antiguo. Sigue funcionando, pero las skills admiten archivos de apoyo |
| Subagente | Su propia ventana de contexto | Lecturas pesadas; solo vuelve un resumen |

Por qué las skills cuidan el contexto: al empezar la sesión, Claude solo ve el **nombre y la descripción** de cada skill. El `SKILL.md` completo se carga cuando escribes `/nombre` o cuando Claude decide que es relevante. Los archivos de apoyo solo se cargan si Claude los lee. Así, una referencia larga casi no cuesta nada hasta que la necesitas.

- [ ] Elegí una tarea que repito lo bastante como para convertirla en skill

## Paso 2: Dónde viven las skills y qué llevan dentro

Una skill es una carpeta con un archivo `SKILL.md`. Dónde la guardas decide quién la recibe:

| Ubicación | Ruta | Se carga en |
| --- | --- | --- |
| Proyecto | `.claude/skills/<nombre>/SKILL.md` | Este repositorio. Haz commit para compartirla |
| Personal | `~/.claude/skills/<nombre>/SKILL.md` | Todos tus proyectos en esta máquina |
| Plugin | `<plugin>/skills/<nombre>/SKILL.md` | Donde el plugin esté activo, como `/plugin-name:skill-name` |

`SKILL.md` tiene frontmatter YAML entre marcadores `---` y después instrucciones en markdown. Todos los campos son opcionales; `description` es el que deberías escribir siempre. Campos útiles:

- `name`: el comando que escribes. Por defecto, el nombre de la carpeta.
- `description`: qué hace y cuándo usarla. Claude la usa para decidir cuándo cargarla.
- `when_to_use`: frases de activación extra, que se añaden a la descripción.
- `argument-hint`: se muestra al autocompletar, por ejemplo `[version]`.
- `disable-model-invocation: true`: solo tú puedes lanzarla con `/nombre`.
- `allowed-tools`: herramientas que Claude puede usar sin preguntar durante el turno en que se ejecuta la skill.
- `model` y `effort`: los cambian durante el resto de ese turno.
- `context: fork`: ejecuta la skill en un subagente.

Los nombres de los campos deben coincidir exactamente: Claude Code ignora sin avisar un campo que no reconoce.

**Argumentos.** `$ARGUMENTS` se sustituye por lo que escribas después del nombre. `$0`, `$1` toman argumentos sueltos.

**Salida de comandos en vivo.** Una línea que empieza por `!` seguida de un comando entre comillas invertidas (verás una en el paso 3) se ejecuta antes de que Claude vea la skill, y su salida reemplaza la línea. Si el comando falla, se cancela toda la invocación de la skill.

- [ ] Decidí entre una skill de proyecto y una personal

## Paso 3: Construir una skill release-notes

Crea la carpeta y dos archivos:

```text
.claude/skills/release-notes/
├── SKILL.md
└── template.md
```

`SKILL.md`:

```markdown
---
name: release-notes
description: Drafts release notes from recent git commits. Use when the user asks for release notes, a changelog entry, or "what's new" for a version.
argument-hint: [version]
allowed-tools: Bash(git log *)
---

## Recent commits

!`git log --oneline -30`

## Your task

Write release notes for version $ARGUMENTS from the commits above.

1. Group changes into Added, Changed, Fixed. Skip merge commits and chores.
2. One plain-language line per change, written for users, not developers.
3. Follow the format in [template.md](template.md).
4. If a commit is unclear, list it under "Needs review" instead of guessing.
```

`template.md`:

```markdown
## [version] - [date]

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

La línea `allowed-tools` aprueba de antemano el comando `git log`, así el comando inyectado no se frena en una comprobación de permisos. La plantilla vive en su propio archivo, así que solo se carga cuando Claude sigue el enlace. Puedes escribir las instrucciones en español si tu equipo lo prefiere.

- [ ] Creé `SKILL.md` y `template.md` en `.claude/skills/release-notes/`

## Paso 4: Ejecutarla y probarla

Hay dos formas de ejecutar una skill:

```text
/release-notes 1.4.0
```

O simplemente pídelo con palabras que encajen con la descripción, y Claude la carga por su cuenta:

```text
¿Puedes escribir las release notes de la 1.4.0?
```

Para probarla bien:

1. Abre una **sesión nueva**. El contexto que queda de escribir la skill tapa huecos en las instrucciones.
2. Pregunta `What skills are available?` y comprueba que aparece `release-notes`.
3. Prueba tanto `/release-notes` como una petición natural.
4. Prueba una petición que **no** debería activarla, como "explica esta función".

Claude Code vigila las carpetas de skills, así que los cambios en `SKILL.md` se aplican en la sesión actual. Si Claude no encaja la descripción pero `/release-notes` funciona, puede que el YAML esté roto: arranca con `claude --debug` para ver el error, o ejecuta `claude plugin validate .claude/skills`.

- [ ] La ejecuté con `/release-notes` y con una petición natural
- [ ] Comprobé que no se activa con peticiones que no tienen que ver

## Paso 5: Escribir una gran descripción y mantener el cuerpo corto

La descripción es lo único que Claude ve antes de decidir. Que cuente:

- **Pon primero el caso de uso principal.** Las descripciones largas se recortan en la lista.
- **Usa las palabras que la gente dice de verdad**: "release notes", "changelog", "novedades".
- **Di cuándo no usarla** si se solapa con otra skill.
- **¿Se activa demasiado?** Hazla más específica, o añade `disable-model-invocation: true`.

Mantén el cuerpo ligero. Cuando una skill se carga, su contenido se queda en la conversación, así que cada línea es un coste que se repite. Di qué hacer, no por qué. La documentación sugiere mantener `SKILL.md` por debajo de 500 líneas y pasar la referencia detallada a archivos aparte enlazados desde `SKILL.md`, para que Claude sepa qué contiene cada uno y cuándo leerlo.

Pon las instrucciones más importantes arriba: tras una compactación, Claude Code solo conserva los primeros 5.000 tokens de cada skill invocada. Y si una regla debe cumplirse siempre, usa un hook, no una skill.

- [ ] Reescribí la descripción con el caso de uso principal al principio
- [ ] Pasé el material de referencia largo a un archivo aparte

## Paso 6: Versionarla y compartirla

Una skill de proyecto son solo archivos. Haz commit de `.claude/skills/` y todo el que clone el repo tendrá `/release-notes`. Revisa los cambios de skills en pull requests, como si fueran código.

Dos cosas antes de compartir:

- **Revisa `allowed-tools`** en las skills que vienen de un repositorio. Una skill puede darse acceso a herramientas, así que léela antes de ejecutar Claude Code ahí.
- **Los plugins** empaquetan skills con subagentes, hooks y servidores MCP en una sola unidad instalable, útil cuando varios repositorios necesitan las mismas skills. Las skills de plugin llevan prefijo, como `/my-plugin:review`.

Un ejemplo real: este panel se mantiene al día con una skill. Mira `.claude/skills/update-dashboard/SKILL.md` en el repositorio. Tiene un `SKILL.md` corto con los pasos, deja la larga lista de datos en `facts.md` y `sources.md`, recibe un foco con `$ARGUMENTS` y usa `disable-model-invocation: true` porque solo debe ejecutarse cuando se pide.

- [ ] Hice commit de la carpeta de la skill
- [ ] Leí la skill update-dashboard como modelo

## Paso 7: Revisar cuánto cuesta

Cada skill que Claude puede invocar por su cuenta añade su nombre y descripción a cada petición.

- **Presupuesto de la lista**: la lista de skills tiene alrededor del 1% de la ventana de contexto del modelo. Si se desborda, Claude Code quita las descripciones de las skills que menos usas.
- **Límite por skill**: `description` más `when_to_use` se cortan a 1.536 caracteres.
- **Skills que lanzas tú**: con `disable-model-invocation: true`, la descripción queda fuera del contexto hasta que la invocas.
- **Encuentra skills sin uso**: `/skill-doctor` muestra lo que cuesta cada skill y cuánto se usa.
- **Mira el total**: la fila Skills de `/context` muestra el tamaño de la lista.

En este panel, abre una sesión y mira el grupo **Skills, MCP y recordatorios**. La fila **Lista de skills** es el tamaño de tu lista. Compárala antes y después de añadir skills. Si **Prompt del sistema, herramientas y memoria** también es grande, la tarjeta de **Archivos de memoria** muestra si la causa es CLAUDE.md, y las secciones largas de CLAUDE.md son buenas candidatas a skills nuevas. Mira [Cómo leer este panel](/learn/06-reading-the-dashboard).

- [ ] Ejecuté `/context` y revisé la fila Skills
- [ ] Comparé la fila Lista de skills en este panel

## Errores comunes

| Error | Qué pasa | Solución |
| --- | --- | --- |
| Descripción vaga ("ayuda con cosas") | Claude nunca la carga, o la carga cuando no toca | Nombra la tarea y las palabras que usa la gente |
| Errata en un campo (`allowed_tools`) | El campo se ignora sin avisar | Copia los nombres exactos de la documentación |
| `SKILL.md` enorme | Cada línea se queda en contexto tras cargarse | Pasa el detalle a archivos enlazados |
| Efectos secundarios con invocación automática | Claude puede desplegar o publicar por su cuenta | Añade `disable-model-invocation: true` |
| Comando inyectado que puede fallar | Se cancela toda la skill | Asegúrate de que el comando sale con 0 cuando no hay problema |
| Una regla que nunca debe romperse, en una skill | Claude puede dejar de seguirla más tarde | Usa un hook |

## Consejos rápidos

- Escribe la skill después de hacer la tarea a mano una o dos veces con Claude.
- Prueba en una sesión nueva, con y sin la skill.
- Usa `$ARGUMENTS` en vez de fijar versiones, archivos o números de issue.
- Convierte los procedimientos largos de CLAUDE.md en skills; deja CLAUDE.md para los datos.
- Ejecuta `/skill-doctor` de vez en cuando y quita las skills que nunca usas.

## Más información

- [Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [Extend Claude Code](https://code.claude.com/docs/en/features-overview)
- [Commands](https://code.claude.com/docs/en/commands)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Plugins overview](https://code.claude.com/docs/en/plugins/overview)
- [Create a plugin](https://code.claude.com/docs/en/plugins/create)
- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
