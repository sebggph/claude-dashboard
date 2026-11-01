# CLAUDE.md y memoria

> CLAUDE.md es una nota corta que Claude lee al empezar cada sesión. Mantenla pequeña, concreta y útil.

## Dos tipos de memoria

| | CLAUDE.md | Memoria automática |
| --- | --- | --- |
| Quién la escribe | Tú | Claude |
| Qué contiene | Instrucciones y reglas | Aprendizajes y preferencias |
| Cuándo se carga | En cada sesión | En cada sesión (primeras 200 líneas o 25KB de `MEMORY.md`) |

Las dos se cargan en el contexto al empezar, así que ambas consumen tokens en cada petición.

## Dónde viven los CLAUDE.md

| Ámbito | Ubicación | Compartido con |
| --- | --- | --- |
| Usuario | `~/.claude/CLAUDE.md` | Solo tú, en todos los proyectos |
| Proyecto | `./CLAUDE.md` o `./.claude/CLAUDE.md` | Tu equipo, vía git |
| Local | `./CLAUDE.local.md` (añádelo a `.gitignore`) | Solo tú, en este proyecto |

Las organizaciones también pueden desplegar un CLAUDE.md gestionado. Los archivos de subcarpetas se cargan bajo demanda, cuando Claude trabaja con archivos de esa carpeta.

La memoria automática vive en `~/.claude/projects/<project>/memory/` y es local a tu máquina.

## Qué poner

Apunta lo que Claude no puede deducir del código:

- Los comandos exactos para instalar, testear, comprobar tipos y lint.
- Sitios donde el código engaña.
- Decisiones del equipo que no están en el repo.
- Cualquier cosa que hayas tenido que corregir dos veces.

Sé concreto. "Run `npm test` before committing" funciona mejor que "Test your changes".

## Que sea corto

Cada línea se carga en cada sesión. La recomendación oficial es quedarse **por debajo de 200 líneas** por archivo. Los archivos largos gastan más contexto y se siguen peor.

Si algo es un procedimiento largo o solo importa a veces, muévelo a una **skill** (se carga bajo demanda) o a una regla con ruta en `.claude/rules/`.

## Ejemplo

```markdown
# Commands
- Install: pnpm install
- Run one test file: pnpm vitest run path/to/file.test.ts
- Typecheck: pnpm tsc --noEmit

# Conventions
- Use the error helpers in src/lib/errors.ts, never throw raw strings
- src/legacy/ is still live but don't copy its patterns into new code

# Gotchas
- Integration tests need DATABASE_URL set, see .env.example
```

## Comandos útiles

- `/init` crea un CLAUDE.md inicial a partir de tu código. Si ya existe uno, sugiere mejoras. A partir de ahí, el trabajo es sobre todo quitar líneas.
- `/memory` lista tus archivos de memoria, los abre en tu editor y te deja activar o desactivar la memoria automática.
- `/context` confirma qué archivos de memoria se cargaron.

## Importaciones

Un CLAUDE.md puede incluir otros archivos con `@ruta`:

```text
See @README for project overview and @package.json for available npm commands.
```

Las importaciones ayudan a organizar, pero no ahorran contexto: los archivos importados se cargan junto con el CLAUDE.md que los importa.

## Consejos rápidos

- Empieza con `/init` y luego recorta.
- Menos de 200 líneas.
- Usa `CLAUDE.local.md` para preferencias personales de un proyecto.
- Mueve flujos de trabajo y documentación de referencia a skills.
- Una regla que nunca debe romperse va en un hook, no en CLAUDE.md.
- Di "recuerda que..." y Claude lo guardará en la memoria automática.

## Más información

- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Best practices](https://code.claude.com/docs/en/best-practices)
- [Extend Claude Code](https://code.claude.com/docs/en/features-overview)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
