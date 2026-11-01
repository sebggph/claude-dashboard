# Claude Context Dashboard

[English](README.md) · **Español**

Un panel pequeño y sencillo que muestra **cuánto contexto usan tus sesiones de Claude Code, qué lo ocupa y cómo mantenerlo ligero**. Pensado para ayudar a la gente a aprender a usar Claude de forma optimizada.

- **Resumen de sesiones**: cada sesión local de Claude Code, qué tan lleno está su contexto y cuándo se usó por última vez.
- **Desglose del contexto**: una lista detallada como `/context`: prompt del sistema, herramientas, skills, MCP, tus mensajes, respuestas de Claude, razonamiento, llamadas y resultados de herramientas, reserva para autocompactar y espacio libre.
- **Explicaciones con pruebas**: haz clic en cualquier fila para ver qué es, cómo reducirlo y enlaces a la documentación oficial.
- **Recomendaciones**: reglas sencillas que detectan salidas grandes, compactaciones frecuentes, poca caché y más.
- **Informe de sesión**: cada sesión recibe un estado (Ligera, Aceptable, Pesada) con sus 3 mejoras principales y un resumen para *copiar al chat*.
- **Memoria y MCP**: qué CLAUDE.md, reglas e imports se cargan, y cuánto cuestan las herramientas de cada servidor MCP.
- **Actualización en vivo**: el panel se actualiza en cuanto cambia una sesión (punto verde *En vivo*).
- **Coste estimado y Tendencias**: coste por sesión con los precios oficiales de la API, cuánto ahorró la caché y gráficos diarios de peticiones, coste y aciertos de caché.
- **Alertas de presupuesto**: presupuestos diario, semanal y por sesión en dólares o tokens, con línea de presupuesto en los gráficos, avisos al 80% y al 100% y notificaciones de escritorio opcionales.
- **Recorrido guiado**: un paseo de 1 minuto en la primera visita (repítelo desde Inicio o Ajustes).
- **Línea de tiempo de la sesión**: recorre una sesión petición a petición y mira qué hizo crecer el contexto (mayores saltos, compactaciones, tu mensaje, resultados de herramientas).
- **Comparar sesiones**: dos sesiones lado a lado (coste de arranque, conversación, cifras clave, herramientas) con conclusiones en palabras sencillas, por ejemplo antes y después de quitar servidores MCP.
- **Modo privado** (icono del ojo): oculta títulos, proyectos, ramas, rutas y el texto de los mensajes para compartir capturas sin riesgo.
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

Abre **http://localhost:3000**. Si el puerto 3000 ya está en uso, Docker elige el siguiente libre hasta el 3010. Para ver cuál:

```bash
docker compose port dashboard 3000
```

**Consejo:** si tienes Node.js, usa `npm run docker`. Usa el 3000 cuando está libre (o el siguiente libre), mantiene la misma dirección al reiniciar y muestra el enlace para abrir.

Lee `~/.claude` en Mac/Linux y `%USERPROFILE%\.claude` en Windows automáticamente. Para usar otra carpeta, copia `.env.example` a `.env` y define `CLAUDE_HOME`.

Para detenerlo: `docker compose down`.

### Usar la imagen publicada (sin clonar)

```bash
# Mac / Linux
docker run -d --name claude-context-dashboard -p 127.0.0.1:3000:3000 \
  -v ~/.claude:/data/claude:ro ghcr.io/sebggph/claude-dashboard:latest
```

```powershell
# Windows (PowerShell)
docker run -d --name claude-context-dashboard -p 127.0.0.1:3000:3000 `
  -v "$env:USERPROFILE\.claude:/data/claude:ro" ghcr.io/sebggph/claude-dashboard:latest
```

Abre **http://localhost:3000**. Para actualizar: `docker pull ghcr.io/sebggph/claude-dashboard:latest`, luego elimina el contenedor y vuelve a ejecutarlo.

### Sin Docker (Mac o PC)

Necesita [Node.js](https://nodejs.org/) 22 o superior. Hecho con [SvelteKit](https://svelte.dev/docs/kit) y Vite; sin framework de CSS.

```bash
npm install
npm run dev        # desarrollo con recarga en vivo → http://localhost:5173
```

Para ejecutarlo como en producción:

```bash
npm run build
npm start          # lee ~/.claude → http://localhost:3000
npm run demo       # solo datos de ejemplo
```

Otros ajustes (`CLAUDE_DIR`, `PORT`, `NEWS=off`) son variables de entorno, por ejemplo `CLAUDE_DIR=/ruta/a/.claude npm start`.

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
| Página de precios (docs) | Coste estimado por sesión y por día | diaria |
| Registro de npm | "Hay una actualización" si una sesión usó una versión antigua | 6 h |
| Página de estado | Estado del servicio en Novedades (se oculta si no responde) | 5 min |

Son las únicas peticiones a internet y no envían nada sobre ti. Pon `NEWS=off` en `.env` para desactivarlas; el panel usará la copia incluida en `static/data/`.

## Mantenerlo al día

Este repositorio incluye una skill de Claude Code, **`/update-dashboard`** (`.claude/skills/update-dashboard/`). Ejecútala en Claude Code dentro de este proyecto después de una versión nueva de Claude. Revisa las fuentes oficiales, actualiza datos, guías, chuleta y código en los dos idiomas, ejecuta `npm test` y `npm run check`, y luego actualiza su propia lista de datos (`facts.md`) y fuentes (`sources.md`).

## Archivos de memoria del proyecto (opcional)

La vista de sesión muestra los archivos de memoria que carga Claude Code: tu `~/.claude/CLAUDE.md`, la memoria automática y el `CLAUDE.md`, `CLAUDE.local.md`, `.claude/rules/` e `@imports` del proyecto, con líneas, tokens y si cargan al inicio.

- **Sin Docker** funciona automáticamente.
- **Con Docker**, el contenedor no ve tus carpetas de código hasta que las montas (en solo lectura): pon `PROJECTS_HOME=/ruta/a/tu/codigo` en `.env` y descomenta la línea `/data/projects` en `docker-compose.yml`.

Los servidores MCP no necesitan configuración: el panel los lee de la propia sesión.

## Solución de problemas

- **Veo "Modo demo" pero sí uso Claude Code.** Comprueba que `CLAUDE_HOME` apunta a la carpeta que contiene `projects/`.
- **Linux: "no se puede leer la carpeta".** El contenedor usa un usuario sin privilegios. Añade `UID_GID=1000:1000` (tu `id -u`:`id -g`) a `.env` y vuelve a ejecutar `docker compose up -d`.
- **Windows con WSL.** Si Claude Code corre dentro de WSL, usa `CLAUDE_HOME=//wsl$/Ubuntu/home/<tu-usuario>/.claude`.
- **El puerto 3000 está ocupado.** Se resuelve solo (mira Inicio rápido). Para usar siempre un puerto fijo, pon por ejemplo `PORT=8080` en `.env`. `npm run dev` también pasa solo al siguiente puerto libre.

## Añadir una guía o tutorial

1. Escribe `static/docs/en/<nombre>.md` y `static/docs/es/<nombre>.md` (misma estructura en ambos).
2. Añade una entrada en `static/docs/en/index.json` y `static/docs/es/index.json`:
   `{"file": "<nombre>.md", "title": "…", "summary": "…", "icon": "book", "section": "start|concepts|habits|security", "type": "tutorial|guide", "minutes": 6, "level": "beginner|intermediate"}`
3. Markdown soportado: títulos, listas, tablas, código, citas y enlaces. `- [ ] paso` se convierte en una casilla que la app recuerda. Enlaza otras guías con `[título](/learn/<nombre>)`.
4. Ejecuta `npm run check`.

## Contribuir

Mira [ROADMAP.md](ROADMAP.md) para ideas y en qué parte del código iría cada una. Textos cortos y claros, siempre en los dos idiomas, y enlaza las afirmaciones a la documentación oficial.

## Licencia

[MIT](LICENSE): libre para usar, modificar y compartir, también con fines comerciales. Mantén el aviso de copyright.
