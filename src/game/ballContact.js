// Contacto balón-jugador (Fase B). Sustituye al contacto simple de la Fase A:
// - Control del balón con calidad de primer toque (perfecto / malo).
// - Intercepciones: cualquier jugador cuyo cilindro corte la trayectoria con
//   el balón bajo (<1.25 m) y a velocidad controlable, lo controla. Los
//   compañeros que no son el receptor dejan pasar los pases tensos.
// - Conducción por toques programados del poseedor (dribbling.js).
// - Robo: la entrada (tackleT activo) resuelve robo limpio o falta.
// - Disputa suave: acercarse al poseedor sin barrer puede desviar el balón.

import { BALL } from "./constants";
import { clamp, wrapAngle } from "../utils/math";
import { clearPossession } from "./possession";
import { dribbleTouch } from "./dribbling";
import { isGassed } from "./stamina";
import { registerFoul } from "./fouls";
import { thump } from "../audio/audioEngine";
// Fase D: fuera de juego (interferencia) y balón parado
import { clearOffsideWatch } from "./offside";
import { DB, whistleOffside } from "./deadball";

const CONTACT_R = 0.78;  // radio de control / intercepción
const BODY_R = BALL.radius + 0.35 + 0.12; // separación corporal

/** Velocidad máxima del balón controlable (m/s). El receptor esperado más. */
function controlLimit(p, isTarget) {
  const skill = p.role === "GK" ? p.data.goalkeeper : p.data.dribbling;
  let lim = 8 + skill / 12;
  if (isTarget) lim += 8;
  return lim;
}

/** Calidad del primer toque 0..1: dribbling (o `goalkeeper` en el portero:
 *  atrapar es su oficio), velocidad del balón, orientación del cuerpo y
 *  presión rival. */
function controlQuality(engine, p) {
  const b = engine.ball;
  // El portero controla con las manos: usa su stat de portero, no dribbling.
  // (Si no, un balón manso le "quema" y lo persigue sin atraparlo nunca.)
  const skill = p.role === "GK" ? p.data.goalkeeper : p.data.dribbling;
  let q = skill / 100;
  const ballSp = Math.hypot(b.vx, b.vz);
  q -= ballSp * 0.016;
  // Un balón (casi) parado no tiene "dirección de llegada": no se penaliza
  // la orientación (antes atan2(0,0) daba un ángulo arbitrario y un balón
  // quieto podía salir despedido por "recibir de espaldas").
  if (ballSp > 0.8) {
    const incoming = Math.atan2(-b.vz, -b.vx); // de dónde viene el balón
    const align = Math.cos(wrapAngle(incoming - p.facing));
    q -= (1 - align) * 0.22; // recibir de espaldas es peor
  }
  for (const o of engine.players) {
    if (o.side === p.side || o === p) continue;
    if (Math.hypot(o.x - p.x, o.z - p.z) < 2) { q -= 0.14; break; }
  }
  if (isGassed(p)) q -= 0.12;
  return clamp(q, 0.03, 1);
}

/** Primer toque: perfecto => balón a <0.6 m; malo => despedido 0.5–2 m. */
function doControl(engine, p) {
  const b = engine.ball;
  // Fase D: el receptor vigilado por fuera de juego la toca => se pita.
  const w = engine.offsideWatch;
  if (w && w.receiverUid === p.uid) {
    whistleOffside(engine, p);
    return;
  }
  // ...pero si un defensor la toca antes, la jugada sigue (se acabó el riesgo).
  if (w && p.side !== w.side) clearOffsideWatch(engine);
  const rng = engine.rng;
  const q = controlQuality(engine, p);
  clearPossession(engine);
  if (q > 0.55) {
    const a = p.facing;
    b.x = p.x + Math.cos(a) * 0.45;
    b.z = p.z + Math.sin(a) * 0.45;
    b.y = Math.min(b.y, 0.35);
    b.vx = p.vx * 0.6;
    b.vz = p.vz * 0.6;
    if (b.vy > 1) b.vy = 1;
    b.spin *= 0.3;
    p.hasBall = true;
    p.touchTimer = 0.12;
    b.lastTouch = p.uid;
    b.touchCooldown = 0.12;
  } else {
    const a = p.facing + (rng() * 2 - 1) * 0.9;
    const dist = 0.5 + (1 - q) * 1.5;
    b.x = p.x + Math.cos(a) * dist;
    b.z = p.z + Math.sin(a) * dist;
    // Un control fallido deja el balón cerca y manso (máx. 3 m/s), no lo
    // despide: así la jugada continúa y el fallo no encadena un "pinball"
    // irrecuperable cuando varios jugadores llegan al balón suelto.
    const sk = 1.2 + (1 - q) * 1.8;
    b.vx = Math.cos(a) * sk;
    b.vz = Math.sin(a) * sk;
    if (b.vy < 0.6) b.vy = 0.6;
    b.lastTouch = p.uid;
    b.touchCooldown = 0.2;
    p.hasBall = false;
  }
  engine.passTarget = null;
  p.anim.action = "kick";
  p.anim.timer = 0.22;
  try { thump(0.3); } catch { /* sin audio */ }
}

/** Bloqueo corporal: el balón rebota suave y no atraviesa al jugador. */
function bodyBlock(b, p, dx, dz, d) {
  const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
  b.x = p.x + nx * BODY_R;
  b.z = p.z + nz * BODY_R;
  const vn = b.vx * nx + b.vz * nz;
  if (vn < 0) {
    b.vx -= 1.35 * vn * nx;
    b.vz -= 1.35 * vn * nz;
    b.vx *= 0.75;
    b.vz *= 0.75;
    // El bloqueo cuenta como toque (p. ej. parada del portero: permite
    // detectar GK_SAVE y atribuye bien el último contacto).
    b.lastTouch = p.uid;
  }
}

/** Disputa suave: desvía el balón del poseedor sin barrida. */
function pokeBall(engine, p, poss) {
  const b = engine.ball;
  const rng = engine.rng;
  const a = Math.atan2(b.z - poss.z, b.x - poss.x) + (rng() * 2 - 1) * 1.2;
  b.vx = Math.cos(a) * 2.6;
  b.vz = Math.sin(a) * 2.6;
  b.lastTouch = p.uid;
  b.touchCooldown = 0.2;
  poss.hasBall = false;
  p.pokeCd = 0.8;
  try { thump(0.25); } catch { /* sin audio */ }
}

/** Resolución de una entrada: robo limpio o falta. */
function resolveTackle(engine, t) {
  const b = engine.ball;
  const rng = engine.rng;
  t.tackleT = 0; // la entrada se consume al contacto
  let opp = null, oppD = Infinity;
  for (const o of engine.players) {
    if (o.side === t.side || o === t || o.sentOff) continue;
    const d = Math.hypot(o.x - b.x, o.z - b.z);
    if (d < oppD) { oppD = d; opp = o; }
  }
  const dBall = Math.hypot(t.x - b.x, t.z - b.z);
  // Intensidad 0..1 para el árbitro (Fase D): la velocidad comprometida del
  // lunge, no la instantánea (que aún está acelerando en el contacto).
  const intensity = clamp((t.tackleSpeed || Math.hypot(t.vx, t.vz)) / 9, 0, 1);
  const ballFirst = !opp || oppD > 0.85 || dBall < oppD - 0.15;
  // ¿Entró por detrás? (el vector tackler->víctima, contra el facing de esta)
  let fromBehind = false;
  if (opp) {
    const dx = t.x - opp.x, dz = t.z - opp.z;
    const d = Math.hypot(dx, dz) || 1;
    fromBehind = (Math.cos(opp.facing) * dx + Math.sin(opp.facing) * dz) / d < -0.45;
  }

  if (opp && oppD < 0.85 && !ballFirst) {
    // Tocó al jugador antes que al balón => el árbitro juzga la entrada
    registerFoul(engine, {
      by: t, victim: opp, touchedBallFirst: false, intensity, fromBehind,
    });
    t.kickCooldown = 0.35;
    return;
  }
  // Balón primero => limpio (la Fase D eliminó la falta aleatoria del 10%).
  // Robo limpio: el balón queda en los pies del que entró
  clearPossession(engine);
  b.x = t.x + Math.cos(t.facing) * 0.45;
  b.z = t.z + Math.sin(t.facing) * 0.45;
  b.y = BALL.radius;
  b.vx = t.vx * 0.35;
  b.vz = t.vz * 0.35;
  b.vy = 0;
  b.spin *= 0.4;
  t.hasBall = true;
  t.touchTimer = 0.15;
  b.lastTouch = t.uid;
  b.touchCooldown = 0.15;
  engine.passTarget = null;
  t.anim.action = "kick";
  t.anim.timer = 0.25;
  try { thump(0.4); } catch { /* sin audio */ }
}

export function ballPlayerContact(engine, dt) {
  const b = engine.ball;

  // El poseedor pierde el balón si se escapa
  for (const p of engine.players) {
    if (!p.hasBall) continue;
    const d = Math.hypot(p.x - b.x, p.z - b.z);
    if (d > 1.7 || Math.hypot(b.vx, b.vz) > 12 || b.y > 1.4) p.hasBall = false;
  }
  if (engine.passTargetT > 0) {
    engine.passTargetT -= dt;
    if (engine.passTargetT <= 0) engine.passTarget = null;
  }

  let poss = null;
  for (const p of engine.players) {
    if (p.hasBall) { poss = p; break; }
  }
  const kickerSide = (() => {
    const k = engine.players.find((q) => q.uid === b.lastTouch);
    return k ? k.side : null;
  })();

  for (const p of engine.players) {
    // Fase D: con el balón parado no hay contacto; los expulsados no juegan.
    if (p.sentOff) continue;
    const dbState = engine.deadBall ? engine.deadBall.state : DB.OPEN;
    if (dbState === DB.SETUP || dbState === DB.READY) continue;
    const dx = b.x - p.x, dz = b.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.5) continue;

    // Poseedor: sin bloqueo corporal; toques de conducción programados
    if (p.hasBall) {
      if (p.touchTimer <= 0) dribbleTouch(engine, p);
      continue;
    }
    if (b.lastTouch === p.uid && b.touchCooldown > 0) continue;

    // Entrada en curso
    if (p.tackleT > 0) {
      if (d < 1.05) resolveTackle(engine, p);
      continue;
    }

    const ballSp = Math.hypot(b.vx, b.vz);
    const isTarget = engine.passTarget === p.uid;

    // Un portero en plena estirada "ocupa más": bloquea con el cuerpo en un
    // radio mayor (si no, los tiros tensos pasan a centímetros sin tocarle).
    const divingGk =
      p.role === "GK" && p.ai && p.ai.state === "GK_DIVE";
    const blockR = divingGk ? 1.15 : BODY_R;

    if (b.y < 1.25 && ballSp <= controlLimit(p, isTarget) && d < CONTACT_R) {
      // Compañero no destinatario: deja pasar los pases tensos por su carril
      if (!isTarget && kickerSide && p.side === kickerSide && ballSp > 3.5 && d > 0.55) {
        continue;
      }
      doControl(engine, p);
    } else if (d < blockR) {
      // Disputa suave del controlado/rival cercano antes que bloqueo
      if (poss && p.side !== poss.side && ballSp < 4 && d < 0.65 && p.pokeCd <= 0) {
        pokeBall(engine, p, poss);
      } else {
        bodyBlock(b, p, dx, dz, d);
      }
    }
  }
}
