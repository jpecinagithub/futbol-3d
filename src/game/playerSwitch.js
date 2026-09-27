// Selección de jugador (Q, Fase B).
// Con dirección pulsada: el compañero (no portero) más cercano a esa
// dirección desde el controlado (alineación > 0.25, prima cercanía).
// Sin dirección: el compañero más cercano al balón.
// Nunca aleatorio: criterio futbolístico.

import { getControlled } from "./engine";

export function switchPlayer(engine, move) {
  const cur = getControlled(engine);
  if (!cur) return;
  const mates = engine.players.filter(
    (p) => p.side === cur.side && p !== cur && p.role !== "GK"
  );
  if (mates.length === 0) return;

  let best = null;
  const m = Math.hypot(move.x, move.z);
  if (m > 0.25) {
    const dx = move.x / m, dz = move.z / m;
    let bestScore = -Infinity;
    for (const p of mates) {
      const vx = p.x - cur.x, vz = p.z - cur.z;
      const d = Math.hypot(vx, vz) || 1;
      const align = (vx * dx + vz * dz) / d;
      if (align < 0.25) continue;
      const score = align * 2 - d * 0.04;
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  if (!best) {
    const b = engine.ball;
    let bd = Infinity;
    for (const p of mates) {
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d < bd) { bd = d; best = p; }
    }
  }
  if (best && best !== cur) {
    cur.controlled = false;
    best.controlled = true;
    engine.controlledUid = best.uid;
    engine.charge = null; // cancelar carga de tiro al cambiar
  }
}
