// Entradas (Fase B): D sin balón.
// Barrida corta hacia el input (o hacia el balón si no hay input).
// La resolución vive en ballContact.js: si toca el BALÓN antes que al jugador
// => robo limpio; si toca al jugador primero o con mucha intensidad => falta
// (vía registerFoul, gancho para la Fase D).

export function startTackle(engine, p, move) {
  if (p.tackleCd > 0 || p.tackleT > 0) return;
  const m = Math.hypot(move.x, move.z);
  let dx, dz;
  if (m > 0.2) {
    dx = move.x / m;
    dz = move.z / m;
  } else {
    // Sin input: hacia el balón
    const b = engine.ball;
    const d = Math.hypot(b.x - p.x, b.z - p.z) || 1;
    dx = (b.x - p.x) / d;
    dz = (b.z - p.z) / d;
  }
  p.tackleT = 0.3;      // duración de la barrida
  p.tackleCd = 0.9;     // no se puede barrer en cadena
  p.tackleDx = dx;
  p.tackleDz = dz;
  p.tackleSpeed = 8.5;  // velocidad comprometida del lunge (la usa el árbitro)
  p.anim.action = "kick";
  p.anim.timer = 0.3;
}
