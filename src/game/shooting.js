// Sistema de tiro (Fase B): D con balón.
// Pulsar D empieza a cargar (0–1 s); soltar (o llegar a 1 s) golpea.
// Potencia: 0–0.2 suave, 0.2–0.6 medio, 0.6–1.0 fuerte.
// Dirección = input del jugador; sin input, al centro de la portería.
// Dispersión según shooting, distancia, ángulo, presión (<3 m), en carrera
// vs parado, y stamina baja. Elevación: raso/medio/alto según la carga.
// Al golpear: pose de tiro (animator), sonido y "kick" de cámara.

import { FIELD } from "./constants";
import { kickBall } from "../physics/ballPhysics";
import { isGassed } from "./stamina";
import { thump, crowdOoh } from "../audio/audioEngine";
import { useMatchStore } from "../stores/useMatchStore";

/** Estadística local (evita ciclo de imports con deadball.js). */
function bumpLocalStat(engine, side, key) {
  if (engine.stats && engine.stats[side]) {
    engine.stats[side][key] = (engine.stats[side][key] || 0) + 1;
  }
  try {
    useMatchStore.getState().bumpStat(side, key);
  } catch { /* sin store (tests puros) */ }
}

/**
 * Cuenta un tiro y detecta si va a puerta proyectando la trayectoria
 * inicial hasta el plano de la portería (aproximación sin rozamiento:
 * |z| < 3.66 m y 0 < y < 2.44 m). Los goles también cuentan como a puerta.
 */
export function countShot(engine, p, dx, dz, power, vy) {
  const atk = p.isHome ? 1 : -1;
  const gx = atk * FIELD.halfLength;
  const b = engine.ball;
  let onTarget = false;
  if (dx * atk > 0.05 && power > 0.1) {
    const t = (gx - b.x) / (dx * power);
    if (t > 0 && t < 8) {
      const zAt = b.z + dz * power * t;
      const yAt = b.y + vy * t - 0.5 * 9.81 * t * t;
      onTarget = Math.abs(zAt) < 3.66 && yAt > 0 && yAt < 2.44;
    }
  }
  bumpLocalStat(engine, p.side, "shots");
  if (onTarget) {
    bumpLocalStat(engine, p.side, "shotsOnTarget");
    // Ocasión clara desde lejos: la grada contiene la respiración.
    const dist = Math.hypot(gx - p.x, p.z);
    if (dist > 10) {
      try { crowdOoh(); } catch { /* sin audio */ }
    }
  }
  return onTarget;
}

function countPressure(engine, p, radius) {
  let n = 0;
  for (const o of engine.players) {
    if (o.side === p.side || o === p) continue;
    if (Math.hypot(o.x - p.x, o.z - p.z) < radius) n++;
  }
  return n;
}

export function startShotCharge(engine, p, move) {
  if (engine.charge) return;
  const m = Math.hypot(move.x, move.z);
  engine.charge = {
    uid: p.uid,
    t: 0,
    dx: m > 0.2 ? move.x / m : Math.cos(p.facing),
    dz: m > 0.2 ? move.z / m : Math.sin(p.facing),
  };
  p.anim.action = "kick";
  p.anim.timer = 0.15;
}

/** Avanza la carga; se puede apuntar con el input mientras se carga. */
export function updateCharge(engine, dt, held, move) {
  const c = engine.charge;
  if (!c) return;
  const m = Math.hypot(move.x, move.z);
  if (m > 0.25) {
    c.dx = move.x / m;
    c.dz = move.z / m;
  }
  if (!held || c.t >= 1) {
    releaseShot(engine);
    return;
  }
  c.t = Math.min(1, c.t + dt);
  if (c.t >= 1) releaseShot(engine);
}

export function releaseShot(engine) {
  const c = engine.charge;
  if (!c) return;
  engine.charge = null;
  const p = engine.players.find((q) => q.uid === c.uid);
  if (!p || !p.hasBall) return; // perdió el balón mientras cargaba

  const b = engine.ball;
  const rng = engine.rng;
  const atk = p.isHome ? 1 : -1;
  const gx = atk * FIELD.halfLength;

  // Dirección: input, o centro de la portería con ajuste por ángulo
  let dx = c.dx, dz = c.dz;
  const aimMag = Math.hypot(dx, dz);
  if (aimMag < 0.25) {
    const gx0 = gx - p.x, gz0 = 0 - p.z;
    const l = Math.hypot(gx0, gz0) || 1;
    dx = gx0 / l; dz = gz0 / l;
  } else {
    // Mezcla un 30 % hacia la portería: el tiro "busca" portería
    const gx0 = gx - p.x, gz0 = 0 - p.z;
    const l = Math.hypot(gx0, gz0) || 1;
    dx = dx * 0.7 + (gx0 / l) * 0.3;
    dz = dz * 0.7 + (gz0 / l) * 0.3;
    const l2 = Math.hypot(dx, dz) || 1;
    dx /= l2; dz /= l2;
  }

  const dist = Math.hypot(gx - p.x, p.z);
  const charge = c.t;
  const shooting = p.data.shooting / 100;

  // Potencia 9 (suave) – 28 (fuerte) m/s
  let power = (9 + charge * 19) * (0.92 + shooting * 0.16);
  if (isGassed(p)) power *= 0.92;

  // Dispersión angular: que se note que no todo va donde se apunta
  const pressure = countPressure(engine, p, 3);
  const onRun = Math.hypot(p.vx, p.vz) > 4;
  const angleToGoal = Math.abs(
    Math.atan2(dz, dx) - Math.atan2(0 - p.z, gx - p.x)
  );
  let spread =
    0.028 +
    (1 - shooting) * 0.11 +
    dist * 0.0011 +
    Math.min(angleToGoal, 1) * 0.05 +
    pressure * 0.028 +
    (onRun ? 0.035 : 0);
  if (isGassed(p)) spread *= 1.4;
  const a =
    Math.atan2(dz, dx) +
    (((rng() + rng() + rng()) / 3 - 0.5) * 2 * spread * 1.4);

  // Elevación: raso con poca carga, medio/alto con carga alta (+ aleatoriedad)
  const vy = 0.8 + Math.pow(charge, 1.4) * 7.5 * (0.55 + 0.45 * rng());

  kickBall(b, Math.cos(a), Math.sin(a), power, vy, (rng() - 0.5) * 1.6, p.uid);
  countShot(engine, p, Math.cos(a), Math.sin(a), power, vy);

  p.hasBall = false;
  p.kickCooldown = 0.4;
  p.touchTimer = 0.3;
  p.anim.action = "kick";
  p.anim.timer = 0.32;
  engine.camKick = 0.3; // zoom-in breve de la broadcast
  try { thump(0.6 + charge * 0.4); } catch { /* sin audio */ }
}

/** ¿Hay una carga de tiro en curso del jugador dado? */
export function chargingShot(engine, p) {
  return !!engine.charge && engine.charge.uid === p.uid;
}
