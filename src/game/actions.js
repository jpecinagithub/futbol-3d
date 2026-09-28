// Fase B: traduce la entrada del frame (teclado/gamepad) en acciones de juego.
// Se ejecuta una vez por frame (no por subpaso fijo): los eventos son de
// flanco y se consumen aquí. El movimiento continuo lo consume stepEngine.

import { getControlled } from "./engine";
import { possessorOf } from "./possession";
import { doGroundPass, doThroughBall, doCross } from "./passing";
import { startShotCharge, updateCharge, releaseShot } from "./shooting";
import { startTackle } from "./tackling";
import { switchPlayer } from "./playerSwitch";
import { tryBurst } from "./dribbling";
import { computeMove } from "./input";
// Fase D: la entrada durante el balón parado la gestiona la mini-máquina
import { DB, processDeadBallActions } from "./deadball";

/** Compañero de campo más cercano al poseedor rival (para la tecla E). */
function nearestHelper(engine, ctrl) {
  const poss = possessorOf(engine);
  const tx = poss ? poss.x : engine.ball.x;
  const tz = poss ? poss.z : engine.ball.z;
  let best = null, bd = Infinity;
  for (const p of engine.players) {
    if (p.side !== ctrl.side || p === ctrl || p.role === "GK") continue;
    const d = Math.hypot(p.x - tx, p.z - tz);
    if (d < bd) { bd = d; best = p; }
  }
  return best ? best.uid : null;
}

export function processActions(engine, fin, dt) {
  if (engine.frozen) return;
  // Fase D: con el balón parado la entrada la gestiona la mini-máquina
  // (SETUP: colocación automática; READY: apuntar y ejecutar el saque).
  const dbState = engine.deadBall ? engine.deadBall.state : DB.OPEN;
  if (dbState === DB.SETUP) return;
  if (dbState === DB.READY) {
    processDeadBallActions(engine, fin, dt);
    return;
  }
  const ctrl = getControlled(engine);
  if (!ctrl) return;
  const hasBall = possessorOf(engine) === ctrl;

  // Carga de tiro en curso: actualizar, apuntar o cancelar
  if (engine.charge) {
    const charger = engine.players.find((p) => p.uid === engine.charge.uid);
    if (!charger || charger !== ctrl || possessorOf(engine) !== charger) {
      engine.charge = null; // perdió el balón o cambió de jugador
    } else {
      updateCharge(engine, dt, fin.shootHeld, fin.move);
    }
  }

  // Tecla A con balón: mantener >0,35 s empieza la carga de tiro
  const aHeld = !!fin.downCodes["KeyA"];
  if (hasBall && aHeld && !engine.charge) {
    engine.actionHoldT = (engine.actionHoldT || 0) + dt;
    if (engine.actionHoldT > 0.35) {
      startShotCharge(engine, ctrl, fin.move);
      engine.actionHoldT = 0;
    }
  } else if (!aHeld) {
    engine.actionHoldT = 0;
  }

  for (const ev of fin.events) {
    switch (ev) {
      case "pass":
        if (hasBall) doGroundPass(engine, ctrl, fin.move);
        break;
      case "through":
        if (hasBall) doThroughBall(engine, ctrl);
        break;
      case "cross":
        if (hasBall) doCross(engine, ctrl);
        break;
      case "shootDown":
        if (hasBall) startShotCharge(engine, ctrl, fin.move);
        else startTackle(engine, ctrl, fin.move);
        break;
      case "shootUp":
        if (engine.charge) releaseShot(engine);
        break;
      case "actionDown":
        // A pulsada sin balón => entrada inmediata
        if (!hasBall) startTackle(engine, ctrl, fin.move);
        break;
      case "actionUp":
        // A soltada con balón: si se estaba cargando el tiro, disparar;
        // si fue un toque, pase raso al compañero
        if (hasBall) {
          if (engine.charge) releaseShot(engine);
          else doGroundPass(engine, ctrl, fin.move);
        }
        break;
      case "switch":
        switchPlayer(engine, fin.move);
        break;
      default:
        break;
    }
  }

  // Cambio de ritmo: amago de sprint con Ctrl mantenido y balón
  if (fin.sprintPressed && fin.dribbleMod && hasBall) {
    tryBurst(engine, ctrl, fin.move);
  }

  // Segundo defensor (E mantenido): el compañero más cercano presiona también
  engine.helperUid = fin.helper ? nearestHelper(engine, ctrl) : null;

  // Mientras se carga el tiro, A no mueve (usa IJKL/flechas para apuntar)
  if (engine.charge) {
    fin.move = computeMove(fin.downCodes, ["KeyA"]);
  }
}
