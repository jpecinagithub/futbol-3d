# CONTROLES — FÚTBOL 3D

Toda la UI del juego está en español. Los controles también se muestran en el
menú de pausa (tecla `Esc` durante el partido).

## Teclado (PC)

| Tecla | Acción |
|---|---|
| `IJKL` / Flechas | Moverse (relativo a cámara broadcast: `I` = atacar, hacia arriba en pantalla) |
| `Shift` | Sprint. Consume stamina; si baja de 25, pierdes punta y calidad técnica |
| `A` (con balón) | Toque: pase raso al compañero (siempre va a un compañero). **Mantener** >0,35 s: cargar tiro; **soltar**: disparar |
| `A` (sin balón) | Entrada / presión hacia la dirección pulsada (o hacia el balón) |
| `Q` | Cambiar de jugador |
| `Tab` | Mostrar / ocultar las estadísticas del partido |
| `Esc` | Pausa |

## Decisiones de diseño: la tecla A

`A` es la única tecla de acción (además de `Q`):

- **Con balón**, un toque dispara el pase raso al compañero mejor colocado
  (y si no hay nadie en la dirección del movimiento, al compañero más
  cercano: el pase nunca se tira al vacío). Si se **mantiene** más de 0,35 s,
  empieza la carga de tiro; al soltar, se golpea. Mientras se carga, `A`
  **no** mueve (usa `IJKL`/flechas para apuntar).
- **Sin balón**, pulsar `A` hace la entrada inmediatamente.
- **A balón parado**: apuntar con `IJKL`/flechas; `A` ejecuta el saque
  (córner por alto, resto raso); en libres y penaltis, mantener `A` carga
  el tiro. Con el portero en un penalti en contra, `A` es lanzarse.

## Mando (Gamepad API)

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

## Sistemas de juego (resumen)

- **Pases** (3 tipos, interceptables): el balón puede cortarlo cualquier
  jugador cuyo cilindro intercepte la trayectoria con el balón bajo (<1,25 m)
  y a velocidad controlable. Flecha azul en el suelo (0,4 s) marca la dirección.
- **Tiro**: la dispersión depende del `shooting` del tirador, la distancia, el
  ángulo, la presión defensiva (<3 m), si va en carrera y la stamina. La
  elevación (raso/medio/alto) la marca la carga, con aleatoriedad controlada.
- **Control**: al recibir, la calidad del primer toque depende del `dribbling`,
  la velocidad del balón, la orientación del cuerpo y la presión. Un mal
  control despide el balón 0,5–2 m.
- **Conducción**: toques dinámicos, nunca pegada al pie. Esprintar con balón
  por encima del umbral, girar >120° a alta velocidad o tener poco `dribbling`
  produce toques largos que se pueden perder.
- **Robo**: si un rival toca tu balón en conducción con buen timing, te lo
  puede llevar o desviar. Acercarse sin barrer también permite disputar.
- **Entradas**: balón antes que jugador = robo limpio (falta improbable);
  jugador antes que balón o con mucha intensidad = falta (pitido, 1,5 s de
  pausa, aviso "Falta de X"; la Fase D añadirá tarjetas y libres).
- **Cambio de jugador**: con dirección pulsada elige al compañero más
  alineado con ella; sin dirección, al más cercano al balón.
- **Stamina**: barra fina bajo la etiqueta del controlado. <25 = fundido.
