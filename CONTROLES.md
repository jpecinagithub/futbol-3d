# CONTROLES — FÚTBOL 3D (Fase B)

Toda la UI del juego está en español. Los controles también se muestran en el
menú de pausa (tecla `Esc` durante el partido).

## Teclado (PC)

| Tecla | Acción |
|---|---|
| `WASD` / Flechas | Moverse (relativo a cámara broadcast: `W` = atacar, hacia arriba en pantalla) |
| `Shift` | Sprint. Consume stamina; si baja de 25, pierdes punta y calidad técnica |
| `X` | Pase raso al compañero mejor colocado en el cono frontal |
| `W` (con balón) | Pase al hueco: adelantado al espacio del que mejor desmarque tenga |
| `D` (con balón) | Tiro: **mantén** para cargar potencia (0–1 s), **suelta** para golpear |
| `D` (sin balón) | Entrada / barrida corta hacia la dirección pulsada (o hacia el balón) |
| `A` (con balón) | Centro / pase alto al área rival |
| `Q` | Cambiar de jugador |
| `E` (mantener) | Segundo defensor: el compañero de campo más cercano al poseedor rival presiona también |
| `Ctrl` (mantener) | Regate: toques más cortos y pegados, giros más cerrados, protege el balón con el cuerpo |
| `Ctrl` + `Shift` | Acelerón corto para superar al marcador (espera 1,5 s entre usos) |
| `Tab` | Mostrar / ocultar las estadísticas del partido |
| `Esc` | Pausa |

## Decisiones de diseño: teclas con doble función

`W`, `A` y `D` pertenecen a `WASD` **y** son teclas de acción. Se resuelve así:

- **W**: al **pulsar** con el balón, dispara el pase al hueco (una sola vez);
  mientras se mantenga pulsada, sigue moviendo hacia arriba. Sin balón, `W`
  solo mueve. (El pase al hueco es un evento de flanco; el movimiento es por
  nivel: no se estorban.)
- **A**: igual que `W`, pero con centro / pase alto.
- **D**: con balón, **pulsar** empieza a cargar el tiro y **soltar** lo ejecuta.
  Mientras se carga, `D` **no** mueve a la derecha (usa la flecha `→` para
  apuntar en movimiento). Sin balón, pulsar `D` hace la entrada; mantenerla
  sigue moviendo a la derecha.
- ⚠️ Evita `Ctrl`+`W`: el navegador lo interpreta como "cerrar pestaña" y no
  se puede bloquear desde el juego.

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
