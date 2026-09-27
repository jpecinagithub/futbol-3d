// Gestor de entrada unificado: teclado (WASD/flechas + teclas de acción) y
// gamepad (Gamepad API, sondeado cada frame). Produce por frame:
//   { move:{x,z}, downCodes, sprint, sprintPressed, dribbleMod, helper,
//     shootHeld, events[] }
//
// Decisiones de diseño (documentadas también en CONTROLES.md):
// - W: si el controlado TIENE el balón al pulsar => pase al hueco (evento
//   'through'); si no lo tiene => solo movimiento hacia arriba. Con balón,
//   W hace ambas cosas: dispara el pase una vez y sigue moviendo arriba.
// - A: igual que W pero con centro / pase alto (evento 'cross').
// - D: con balón => tiro (pulsar = empezar a cargar, soltar = golpear;
//   mientras se carga, D no mueve a la derecha — usa la flecha →).
//   Sin balón => entrada (evento 'tackle') al pulsar; mantener D sigue
//   moviendo a la derecha.
// - X: pase raso (solo con balón). Q: cambio de jugador. E (mantener):
//   segundo defensor. Ctrl (mantener): modificador de regate.
//   Shift (mantener): sprint.
// - Gamepad estándar: stick izquierdo = mover, RT = sprint, A = pase raso,
//   Y = pase al hueco, B = tiro (mantener para cargar), X = centro/alto,
//   LB = cambio de jugador, RB = segundo defensor, LT = regate.
//   Sin gamepad se ignora sin errores.

const GAME_KEYS = [
  "KeyW", "KeyA", "KeyS", "KeyD", "KeyX", "KeyQ", "KeyE",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight",
];

export function createInputState() {
  return {
    keys: {},      // code -> true mientras pulsada
    queue: [],     // pulsaciones desde el último poll ("^CODE" = soltado)
    padPrev: [],   // botones del gamepad en el frame anterior
    padSeen: -999, // último frame con actividad de gamepad
    frame: 0,
  };
}

export function attachKeyboard(st) {
  const down = (e) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (!st.keys[e.code]) st.queue.push(e.code);
    st.keys[e.code] = true;
  };
  const up = (e) => {
    st.keys[e.code] = false;
    if (GAME_KEYS.includes(e.code)) st.queue.push("^" + e.code);
  };
  const blur = () => { st.keys = {}; };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  st._detach = () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}

export function detachKeyboard(st) {
  if (st._detach) st._detach();
}

/** Movimiento 2D desde el mapa de teclas (relativo a cámara broadcast: W = -Z). */
export function computeMove(keys, exclude = []) {
  const ex = new Set(exclude);
  const has = (c) => keys[c] && !ex.has(c);
  let x = 0, z = 0;
  if (has("KeyA") || has("ArrowLeft")) x -= 1;
  if (has("KeyD") || has("ArrowRight")) x += 1;
  if (has("KeyW") || has("ArrowUp")) z -= 1;
  if (has("KeyS") || has("ArrowDown")) z += 1;
  const l = Math.hypot(x, z);
  if (l > 1) { x /= l; z /= l; }
  return { x, z };
}

/** Sondea el gamepad una vez por frame. Sin gamepad devuelve valores neutros. */
function pollGamepad(st) {
  const out = {
    move: null, sprint: false, sprintPressed: false, dribbleMod: false,
    helper: false, shootHeld: false, events: [],
  };
  let pads = null;
  try {
    pads = typeof navigator !== "undefined" && navigator.getGamepads
      ? navigator.getGamepads()
      : null;
  } catch {
    return out;
  }
  if (!pads) return out;
  let gp = null;
  for (const p of pads) {
    if (p && p.connected) { gp = p; break; }
  }
  if (!gp) return out;

  const b = gp.buttons.map((x) => x.pressed || x.value > 0.35);
  const prev = st.padPrev;
  const edge = (i) => b[i] && !prev[i];

  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  const mag = Math.hypot(ax, ay);
  if (mag > 0.22 || b.some(Boolean)) st.padSeen = st.frame;
  if (mag > 0.22) {
    const k = Math.min(1, (mag - 0.22) / 0.6);
    out.move = { x: (ax / mag) * k, z: (ay / mag) * k };
  }
  out.sprint = !!b[7];            // RT
  out.sprintPressed = edge(7);
  out.dribbleMod = !!b[6];        // LT = regate
  out.helper = !!b[5];            // RB = segundo defensor
  out.shootHeld = !!b[1];         // B = tiro
  if (edge(0)) out.events.push("pass");       // A = pase raso
  if (edge(3)) out.events.push("through");    // Y = pase al hueco
  if (edge(2)) out.events.push("cross");      // X = centro/alto
  if (edge(1)) out.events.push("shootDown");  // B pulsado
  if (prev[1] && !b[1]) out.events.push("shootUp"); // B soltado
  if (edge(4)) out.events.push("switch");     // LB = cambio de jugador
  st.padPrev = b;
  return out;
}

/** Construye la entrada del frame: movimiento + estados + eventos de flanco. */
export function pollFrameInput(st) {
  st.frame++;
  const k = st.keys;
  const q = st.queue;
  st.queue = [];

  const pad = pollGamepad(st);
  const usePadMove = pad.move && st.frame - st.padSeen < 30;

  const fin = {
    move: usePadMove ? pad.move : computeMove(k),
    downCodes: k,
    sprint: !!(k["ShiftLeft"] || k["ShiftRight"]) || pad.sprint,
    sprintPressed:
      q.includes("ShiftLeft") || q.includes("ShiftRight") || pad.sprintPressed,
    dribbleMod: !!(k["ControlLeft"] || k["ControlRight"]) || pad.dribbleMod,
    helper: !!k["KeyE"] || pad.helper,
    shootHeld: !!k["KeyD"] || pad.shootHeld,
    events: [...pad.events],
  };
  for (const code of q) {
    if (code === "KeyX") fin.events.push("pass");
    else if (code === "KeyW") fin.events.push("through");
    else if (code === "KeyA") fin.events.push("cross");
    else if (code === "KeyD") fin.events.push("shootDown");
    else if (code === "^KeyD") fin.events.push("shootUp");
    else if (code === "KeyQ") fin.events.push("switch");
  }
  return fin;
}
