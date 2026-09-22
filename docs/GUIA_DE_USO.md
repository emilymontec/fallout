# Guía de uso (paso a paso)

## Qué hace, en una frase
Mira los cambios de un proyecto (una rama, o lo que aún no has guardado con commit) y te dice **qué otras partes
pueden romperse por ese cambio**: otros archivos que lo usan, documentación desactualizada, tests que no lo cubren.
Luego prepara a IBM Bob para revisarlo y arreglarlo.

## Antes de empezar
- Node.js instalado (ya lo tienes) y git.
- Tus proyectos deben ser repositorios git con al menos un commit (`git init`, `git add .`, `git commit -m "inicio"`).

## Paso 1 · Instalar (una sola vez)
Abre una terminal en la carpeta de este proyecto (`fallout`):
```
npm install
```

## Paso 2 · Probarlo con uno de tus proyectos
```
node bin/guardian.mjs analyze --repo "C:\ruta\a\tu-proyecto"
```
Cambia una función o borra algo en ese proyecto (sin hacer commit) antes de correr el comando, para tener
algo que analizar. El resultado aparece en pantalla y también queda guardado en
`tu-proyecto\.guardian\report.md` (carpeta oculta que git ignora automáticamente).

## Paso 3 · Dejar los modos de Bob disponibles en cualquier proyecto (una sola vez)
```
node bin/guardian.mjs install-modes
```
Copia 4 "roles" para Bob (jefe del comité, analista, guardián de docs, sintetizador de tests) a tu configuración
global de Bob. Así estarán disponibles sin importar qué proyecto tengas abierto en Bob — no solo este.
Guarda una copia de seguridad de tu archivo anterior y conserva tus modos propios. Reinicia la ventana de Bob
después de correrlo.

## Paso 4 · Analizar todos tus proyectos de una vez
```
node bin/guardian.mjs scan "C:\Users\TU_USUARIO\Desktop"
```
(cambia la ruta por la carpeta donde guardas tus proyectos; busca hasta 2 niveles de profundidad, `--depth 3` para más).
Verás una tabla ordenada por riesgo:

| Riesgo | Significa |
| --- | --- |
| 🔴 HIGH / BLOCK | Algo que el cambio quitó o modificó todavía lo usan otros archivos. Revisar antes de fusionar. |
| 🟠 MEDIUM / REVIEW | Hay partes que dependen del cambio, docs desactualizadas o código sin tests. |
| 🟢 LOW / OK | No se detectó impacto. |
| ⚪ | No había nada que comparar (sin cambios). |

Cada proyecto tiene su informe detallado en `reports/scan-.../<proyecto>/report.md`, dentro de la carpeta
de `fallout`. `scan` no escribe nada dentro de tus otros proyectos.

**¿Qué compara?** Lo decide solo: si estás en una rama distinta de `main`/`master`, compara contra `main`/`master`;
si estás en `main` con cambios sin commit, analiza esos cambios; si no, analiza el último commit.
Puedes forzarlo: `--base main`, `--working` (solo cambios sin commit) o `--last 3` (últimos 3 commits).

Añade `--run-tests` a `analyze` o `scan` para que además ejecute los tests del propio proyecto
(usa su `npm test`, `python manage.py test` o `pytest`, lo que encuentre).

## Paso 5 · Pasarle el caso a Bob
```
node bin/guardian.mjs prompt --repo "C:\ruta\a\tu-proyecto" --copy
```
Hace el análisis, genera el mensaje para Bob (con los hallazgos, las docs que debe leer y los pasos) y lo copia al portapapeles.
1. Abre la carpeta de ese proyecto en Bob.
2. Elige el modo **🛡️ PR Guardian (Orchestrator)**.
3. Pega el mensaje.
4. Bob te pedirá aprobar el lanzamiento de 3 subagentes en paralelo: apruébalos.

## Paso 6 · Qué revisar al final
- `.guardian/pr-review-<rama>.md`: veredicto de Bob con evidencia.
- Rama `bob/guardian-fix/<rama>`: documentación y tests corregidos (tu rama original no se toca).
- `.guardian/suggested-fix.patch`: cambio de código propuesto; tú decides si lo aplicas.

## Qué es automático y qué es manual
| Automático | Manual (no se puede automatizar) |
| --- | --- |
| Detectar qué comparar en cada proyecto | Aprobar los subagentes en Bob (Bob lo exige) |
| Encontrar consumidores, docs, specs, env, tests | Pegar el mensaje en Bob (ya está copiado) |
| Analizar todos tus proyectos en un comando | Decidir si aplicas el parche propuesto |
| Generar el mensaje para Bob y los modos | Revisar y fusionar la rama de corrección |

## Si algo falla
- `not inside a git repository`: haz `git init`, `git add .`, `git commit -m "inicio"` en ese proyecto.
- `nothing to compare`: no hay cambios. Crea una rama, cambia algo, o usa `--last 1`.
- Rutas con espacios: ponlas entre comillas.
- Los modos no aparecen en Bob: reinicia la ventana. Si tu versión de Bob no lee la configuración global,
  usa `node bin/guardian.mjs install-modes --project "C:\ruta\proyecto"` para instalarlos dentro de ese
  proyecto puntual en vez de globalmente.

## Límites (para no prometer de más)
Es análisis estático con heurísticas (JS/TS y Python): encuentra candidatos con archivo y línea, no demuestra que algo se rompe.
No resuelve alias de monorepos ni imports construidos en tiempo de ejecución, ni dependencias entre repositorios distintos.
Para eso está Bob: lee la documentación y razona lo que el script no ve.
