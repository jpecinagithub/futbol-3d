# FÚTBOL 3D

Videojuego de fútbol 3D para navegador, **100 % original**. Inspirado solo en la
*sensación jugable* de los simuladores de fútbol clásicos (cámara de
retransmisión, ritmo arcade, drama de la repetición), pero con código,
modelos, estadio, escudos, plantillas y audio creados desde cero para este
proyecto. Ningún asset con licencia, ninguna recreación de marca oficial.

Stack: **Vite + React (JS) + three + @react-three/fiber + zustand**.

---

## Requisitos

- **Node.js 18+** y **npm** (compruébalo con `node --version`).
- Un navegador moderno (Chrome / Edge / Firefox) con WebGL.

## Cómo jugar (Windows / PowerShell)

```powershell
# 1. Entra en la carpeta del juego
cd ~\futbol-3d

# 2. Instala las dependencias (solo la primera vez)
npm install

# 3. Arranca el servidor de desarrollo
npm run dev
```

Vite te mostrará la dirección, normalmente:

```
➜  Local:   http://localhost:5199/
```

Ábrela en tu navegador. Para una versión optimizada de producción:

```powershell
npm run build    # debe terminar en verde, sin errores
npm run preview  # sirve la versión compilada en local
```

> El primer `npm install` tarda unos minutos; después el juego arranca en
> segundos. Todo corre en tu máquina: no hay servidores externos ni cuentas.

---

## Cómo se juega

1. **Menú principal** → *Jugar partido*.
2. Elige el **equipo local** y el **visitante** (no puede ser el mismo).
3. En el cartel del partido elige la **duración**: 3, 5, 10 o 15 minutos de
   reloj de partido (el reloj corre **6 veces más rápido** que el tiempo real:
   un partido de 5 min de marcador dura ~50 s reales).
4. Revisa las **alineaciones** en el minimapa táctico y pulsa **¡A jugar!**.
5. Controlas al jugador destacado (anillo amarillo + etiqueta con nombre,
   dorsal, barra de stamina y barra de potencia de tiro). Marca más goles que
   el rival antes del pitido final.

**Durante el partido:**

- **Pausa** (`Esc`): pestañas de *Controles*, *Estadísticas* y *Cambios*.
- **Cambios**: hasta 5 sustituciones por equipo (titular ↔ suplente) desde la
  pausa. Los expulsados y lesionados no pueden volver.
- **Balón parado**: el HUD te indica el tipo (saque de banda, córner, saque
  de puerta, tiro libre, penalti) y los controles disponibles en cada caso.
- **Repetición**: tras cada gol se reproduce automáticamente la jugada a
  cámara lenta (0,4x) con el rótulo *REPETICIÓN · CÁMARA LENTA*; pulsa
  cualquier tecla para saltarla. Al terminar aparece el botón
  *Descargar repetición (.webm)* para guardar el vídeo.
- **Pantalla final**: marcador, goleadores y comparativa de estadísticas, con
  opción de *Revancha* (reinicia limpio) o volver al menú.

**Reglas implementadas:** faltas y tarjetas (amarilla / roja, expulsiones),
fuera de juego (con aviso de la jugada), saques de banda, córners, saques de
puerta, tiros libres con barrera a 9,15 m y penaltis.

---

## Controles

### Teclado (PC)

| Tecla | Acción |
|---|---|
| `IJKL` / Flechas | Moverse (relativo a cámara broadcast: `I` = atacar, hacia arriba en pantalla) |
| `Shift` | Sprint. Consume stamina; si baja de 25, pierdes punta y calidad técnica |
| `A` (con balón) | Toque: pase raso al compañero (siempre a un compañero). **Mantener** >0,35 s: cargar tiro; **soltar**: disparar |
| `A` (sin balón) | Entrada / presión hacia la dirección pulsada (o hacia el balón) |
| `Q` | Cambiar de jugador (hacia la dirección pulsada, o el más cercano al balón) |
| `Z` | Cambiar cámara: TV ↔ cercana |
| `Tab` | Mostrar / ocultar las estadísticas del partido |
| `Esc` | Pausa |

**La tecla `A`:** con balón, un toque pasa y mantener carga el tiro (mientras
carga, `A` no mueve: apunta con `IJKL`/flechas). Sin balón, `A` es la entrada.
A balón parado se apunta con `IJKL` y `A` ejecuta el saque.

### Mando (Gamepad API)

Se sondea cada frame; si no hay mando conectado se ignora sin errores.

| Control | Acción |
|---|---|
| Stick izquierdo | Moverse |
| `RT` | Sprint |
| `A` | Pase raso |
| `Y` | Pase al hueco |
| `B` | Tiro (mantener para cargar, soltar para golpear) |
| `X` | Centro / pase alto |
| `LB` | Cambiar de jugador |
| `RB` (mantener) | Segundo defensor |
| `LT` (mantener) | Regate |

El menú de pausa incluye la tabla completa de controles (pestaña
*Controles*).

---

## Estructura del proyecto

```
futbol-3d/
├── index.html
├── vite.config.js
├── package.json
├── CONTROLES.md          # mapa detallado de teclas y sistemas de juego
├── test/                 # tests Playwright (fases B–E) + capturas en test/shots/
├── public/
└── src/
    ├── main.jsx / App.jsx / index.css
    ├── game/             # núcleo: engine.js (paso fijo 1/60), acciones,
    │                     #   pases, tiro, entradas, faltas, fuera de juego,
    │                     #   balón parado, stamina, Match.jsx (escena + bucle)
    ├── physics/          # física propia del balón (sin motor externo)
    ├── ai/               # tick.js (decisiones ~12 Hz), roles (13 estados),
    │                     #   teamPhases (7 fases colectivas), tactics,
    │                     #   goalkeeper (9 estados)
    ├── players/          # modelos procedurales de futbolistas
    ├── animation/        # animación procedural (carrera, idle, golpeo)
    ├── ball/             # balón procedural
    ├── stadium/          # campo 105×68 reglamentario, gradas con instancing
    ├── camera/           # cámara de retransmisión con zoom dinámico
    ├── stores/           # useMatchStore (zustand): fase, marcador, reloj, eventos
    ├── ui/               # HUD estilo retransmisión, pantallas, estadísticas
    ├── data/teams/       # 4 equipos con plantillas originales (18 jugadores)
    ├── audio/            # motor Web Audio 100 % procedural
    └── replay/           # grabación de estados y reproductor de repeticiones
```

Equipos incluidos: **Real Madrid** (4-3-3), **Barcelona** (4-3-3),
**Athletic Club** (4-4-2) y **Real Sociedad** (4-2-3-1), con plantillas de
18 jugadores cada uno (nombres y dorsales originales, escudos SVG propios).

---

## Decisiones de arquitectura

### Física propia determinista (sin rapier ni motor externo)

El balón es una esfera integrada a mano: gravedad, rebote (restitución 0,6),
fricción de rodadura, resistencia aerodinámica, spin básico (Magnus
simplificado) y colisión con postes/travesaño y redes. Los jugadores son
cápsulas lógicas 2D (posición x,z + radio).

**Por qué es mejor aquí:**
1. **Determinismo** — paso fijo de 1/60 s + semilla fija ⇒ simulación
   reproducible bit a bit, imprescindible para repeticiones fiables.
2. **Game feel** — rebotes y curvas ajustados a mano para un arcade con
   identidad propia, no un solver genérico.
3. **Rendimiento** — 1 esfera + 22 cápsulas cuesta microsegundos por paso.
4. **Sin dependencias pesadas** — el bundle final solo incluye lo que el
   juego necesita.

### IA a 12 Hz + steering continuo

La IA decide a ~12 Hz (`aiTick`): 13 estados de rol por jugador (presionar,
marcar, apoyar, desmarcarse…), 7 fases colectivas de equipo (bloque
defensivo, salir jugando, contraataque, presión alta…), táctica por
formación y porteros con 9 estados. Entre decisiones, un *steering* continuo
mueve a los jugadores cada frame hacia sus objetivos. Verificado con
métricas: la dispersión media del equipo es 32,8 m frente a 5,2 m del
comportamiento ingenuo "todos al balón".

### Repetición por grabación de estados

El motor graba el estado de la simulación (posiciones de jugadores y balón)
durante la jugada del gol; el reproductor la reconstruye con la cámara de
retransmisión a cámara lenta (0,4x), saltable con cualquier tecla. Durante la
repetición se graba el canvas con `MediaRecorder` y al terminar se ofrece la
descarga del vídeo (`.webm`).

### Renderizado eficiente

- Público: `InstancedMesh` (~12 000 espectadores en 2 draw calls).
- Una sola *directional light* con sombras (mapa 2048, frustum al campo);
  los focos del estadio son solo *emissive*, sin spotlights reales.
- Geometrías y materiales compartidos/cacheados en jugadores.
- React no re-renderiza por frame: el motor mutable escribe en los meshes
  vía `useFrame`; el store solo lleva fase/marcador/reloj/eventos.

---

## Tests

Batería automatizada con Playwright (headless) en `test/`:

| Test | Qué verifica |
|---|---|
| `phaseB.mjs` … `phaseB4.mjs` | controles: pases (3 tipos), tiro con carga, regate, entradas, stamina, cambio de jugador, faltas |
| `phaseC.mjs` | IA colectiva: dispersión, pases completados, tiros, goles, porteros, roles y fases |
| `phaseD.mjs` | arbitraje: banda, córner, puerta, falta+amarilla, doble amarilla→expulsión, fuera de juego, penalti, libre con barrera |
| `phaseE.mjs` | presentación: banner de gol, repetición automática saltable, estadísticas (Tab), pantalla final, revancha, sustituciones por UI |

Todos con **0 errores de consola**. Las capturas de verificación viven en
`test/shots/`. Nota: en headless con SwiftShader el renderizado va a
~0,5 FPS; los tests usan técnicas específicas para ese entorno (ver
`AGENTS.md` del workspace). El rendimiento real (objetivo 60 FPS) solo se
puede medir en hardware con GPU.

---

## Créditos y nota de originalidad

**FÚTBOL 3D** es un proyecto 100 % original: todo el código, los modelos
3D procedurales, el estadio, los escudos, las plantillas, el audio y la
interfaz fueron creados para este juego. Los nombres de los equipos se
inspiran en clubes reales solo como referencia de colores y formaciones;
jugadores, dorsales y escudos son invención propia. No utiliza assets,
marcas ni código con licencia de terceros más allá de las librerías de
código abierto declaradas en `package.json` (three, React, Vite, zustand).
