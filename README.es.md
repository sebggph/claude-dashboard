# Claude Context Dashboard

[English](README.md) · **Español**

Un panel pequeño y sencillo que muestra **cuánto contexto usan tus sesiones de Claude Code, qué lo ocupa y cómo mantenerlo ligero**. Pensado para ayudar a la gente a aprender a usar Claude de forma optimizada.

- **Resumen de sesiones**: cada sesión local de Claude Code, qué tan lleno está su contexto y cuándo se usó por última vez.
- **Desglose del contexto**: una lista detallada como `/context`: prompt del sistema, herramientas, skills, MCP, tus mensajes, respuestas de Claude, razonamiento, llamadas y resultados de herramientas, reserva para autocompactar y espacio libre.
- **Explicaciones con pruebas**: haz clic en cualquier fila para ver qué es, cómo reducirlo y enlaces a la documentación oficial.
- **Recomendaciones**: reglas sencillas que detectan salidas grandes, compactaciones frecuentes, poca caché y más.
- **Gráficos**: crecimiento del contexto por petición, elementos más grandes, herramientas, subagentes y totales de tokens.
- **Sección Aprender**: tutoriales paso a paso (*Empezar un proyecto nuevo*, *Optimizar un proyecto existente*) con listas de pasos marcables, y guías sobre contexto, compactación, CLAUDE.md, MCP/skills/subagentes, flujos de trabajo y *¿Cambiar a mitad de sesión o empezar de cero?*. Recuerda lo que ya leíste.
- **Chuleta imprimible**: más de 50 comandos y atajos con una nota de por qué ayudan.
- **Modo claro y oscuro**, **inglés y español**, funciona en Mac, Windows y Linux.

Funciona solo en tu equipo. Tus historiales se montan **en solo lectura** y nunca salen de tu máquina.

## Inicio rápido (Docker)

Necesitas [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac o Windows) o Docker Engine (Linux).

```bash
git clone https://github.com/sebggph/claude-dashboard.git
cd claude-dashboard
docker compose up -d --build
```

Abre **http://localhost:3000**.

Lee `~/.claude` en Mac/Linux y `%USERPROFILE%\.claude` en Windows automáticamente. Para usar otra carpeta, copia `.env.example` a `.env` y define `CLAUDE_HOME`.

Para detenerlo: `docker compose down`.

### Sin Docker

Necesita Node.js 18 o superior. No hace falta `npm install`: no tiene dependencias.

```bash
npm start          # lee ~/.claude
npm run demo       # solo datos de ejemplo
```

## De dónde salen los datos

Claude Code guarda cada sesión como un archivo `.jsonl` en `~/.claude/projects/`. Cada respuesta de Claude registra el uso real de tokens que informa la API. El panel lo usa así:

| Dato | Cómo se calcula | Precisión |
|---|---|---|
| Contexto usado | `entrada + escritura en caché + lectura de caché` de la última petición (la misma fórmula que la barra de estado de Claude Code) | Medido |
| Respuestas y razonamiento de Claude | `output_tokens` de cada respuesta | Medido |
| Tus mensajes, resultados de herramientas, listas | Longitud del texto, calibrada por sesión según cuánto creció el contexto entre peticiones | Estimado |
| Prompt del sistema, herramientas y memoria | Lo que queda: total menos todos los mensajes | Estimado |
| Tamaño de la ventana | Según el modelo, como dice la [documentación oficial](https://code.claude.com/docs/en/model-config) (cámbialo en ⚙ Ajustes) | Por reglas |

Para cifras exactas dentro de una sesión, usa `/context` en Claude Code.

**¿Qué sesiones aparecen?** Las que se ejecutaron en este equipo: la CLI, la app de escritorio y las extensiones del IDE. Las sesiones en la nube (claude.ai/code) se ejecutan en servidores de Anthropic, así que sus historiales no están en tu disco.

## Novedades y datos en vivo

La página **Novedades** muestra el changelog oficial de Claude Code y las notas de versión de Claude Platform, actualizadas cada 6 horas, con los cambios sobre el contexto resaltados. El panel también lee algunas fuentes oficiales y gratuitas para mantenerse preciso:

| Fuente | Para qué | Frecuencia |
|---|---|---|
| Changelog de Claude Code y notas de Claude Platform | Página Novedades y "Novedades" en Inicio | 6 h |
| Página de modelos (docs) | Ventana de contexto correcta por modelo, tarjeta "Modelos actuales" | diaria |
| Registro de npm | "Hay una actualización" si una sesión usó una versión antigua | 6 h |
| Página de estado | Estado del servicio en Novedades (se oculta si no responde) | 5 min |

Son las únicas peticiones a internet y no envían nada sobre ti. Pon `NEWS=off` en `.env` para desactivarlas; el panel usará la copia incluida en `public/data/`.

## Mantenerlo al día

Este repositorio incluye una skill de Claude Code, **`/update-dashboard`** (`.claude/skills/update-dashboard/`). Ejecútala en Claude Code dentro de este proyecto después de una versión nueva de Claude. Revisa las fuentes oficiales, actualiza datos, guías, chuleta y código en los dos idiomas, ejecuta `npm test` y `npm run check`, y luego actualiza su propia lista de datos (`facts.md`) y fuentes (`sources.md`).

## Solución de problemas

- **Veo "Modo demo" pero sí uso Claude Code.** Comprueba que `CLAUDE_HOME` apunta a la carpeta que contiene `projects/`.
- **Linux: "no se puede leer la carpeta".** El contenedor usa un usuario sin privilegios. Añade `UID_GID=1000:1000` (tu `id -u`:`id -g`) a `.env` y vuelve a ejecutar `docker compose up -d`.
- **Windows con WSL.** Si Claude Code corre dentro de WSL, usa `CLAUDE_HOME=//wsl$/Ubuntu/home/<tu-usuario>/.claude`.
- **El puerto 3000 está ocupado.** Pon `PORT=3001` en `.env`.

## Añadir una guía o tutorial

1. Escribe `docs/en/<nombre>.md` y `docs/es/<nombre>.md` (misma estructura en ambos).
2. Añade una entrada en `docs/en/index.json` y `docs/es/index.json`:
   `{"file": "<nombre>.md", "title": "…", "summary": "…", "icon": "book", "section": "start|concepts|habits|dashboard", "type": "tutorial|guide", "minutes": 6, "level": "beginner|intermediate"}`
3. Markdown soportado: títulos, listas, tablas, código, citas y enlaces. `- [ ] paso` se convierte en una casilla que la app recuerda. Enlaza otras guías con `[título](#/guides/<nombre>.md)`.

## Contribuir

Mira [ROADMAP.md](ROADMAP.md) para ideas y en qué parte del código iría cada una. Textos cortos y claros, siempre en los dos idiomas, y enlaza las afirmaciones a la documentación oficial.
