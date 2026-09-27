// Animación procedural del humanoide (sin mocap ni assets externos).
// - Carrera: balanceo de brazos y piernas; amplitud y frecuencia proporcionales a la velocidad.
// - Idle: respiración leve (torso) y balanceo mínimo.
// - Acciones: "kick" (levantar pierna al golpear) disparada por eventos del motor.
//
// parts: { torso, head, armL, armR, thighL, thighR, shinL, shinR }
// state: objeto mutable { phase } que persiste entre fotogramas.

export function createAnimState() {
  return { phase: Math.random() * Math.PI * 2 };
}

export function posePlayer(parts, p, dt, state) {
  const speed = Math.hypot(p.vx, p.vz);
  const run = Math.min(1, speed / 4);          // 0 = quieto, 1 = corriendo
  const freq = 4 + speed * 1.9;                // frecuencia proporcional a la velocidad
  state.phase += freq * dt;
  const ph = state.phase;

  const swing = 0.12 + run * 0.62;             // amplitud de zancada
  const armSwing = 0.08 + run * 0.5;

  const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);

  // Piernas: muslo oscila, espinilla flexiona al pasar atrás
  if (parts.thighL) parts.thighL.rotation.x = sL * swing;
  if (parts.thighR) parts.thighR.rotation.x = sR * swing;
  if (parts.shinL) parts.shinL.rotation.x = Math.max(0, -sL) * swing * 1.4 + run * 0.12;
  if (parts.shinR) parts.shinR.rotation.x = Math.max(0, -sR) * swing * 1.4 + run * 0.12;

  // Brazos: opuestos a las piernas
  if (parts.armL) {
    parts.armL.rotation.x = sR * armSwing;
    parts.armL.rotation.z = 0.12 + run * 0.08;
  }
  if (parts.armR) {
    parts.armR.rotation.x = sL * armSwing;
    parts.armR.rotation.z = -0.12 - run * 0.08;
  }

  // Torso: leve inclinación al correr + "respiración" en idle
  if (parts.torso) {
    parts.torso.rotation.x = run * 0.14 + Math.sin(ph * 0.5) * 0.012;
    parts.torso.position.y = parts.torso.userData.baseY + Math.abs(Math.sin(ph)) * 0.028 * run;
  }
  if (parts.head) {
    parts.head.rotation.x = -run * 0.1;
  }

  // Acción de golpeo: pierna derecha se levanta al frente y vuelve
  if (p.anim.action === "kick" && p.anim.timer > 0) {
    const total = 0.28;
    const k = 1 - p.anim.timer / total; // 0 -> 1
    const lift = Math.sin(k * Math.PI) * 1.1;
    if (parts.thighR) parts.thighR.rotation.x = -lift;
    if (parts.shinR) parts.shinR.rotation.x = Math.sin(k * Math.PI) * 0.5;
    if (parts.torso) parts.torso.rotation.x = -0.12 * Math.sin(k * Math.PI);
  }

  // Celebración de gol (Fase E): brazos en alto con leve bote del torso.
  // Las piernas siguen el ciclo de carrera (el goleador corre unos metros).
  if (p.anim.action === "celebrate" && p.anim.timer > 0) {
    if (parts.armL) {
      parts.armL.rotation.z = 2.75;
      parts.armL.rotation.x = Math.sin(ph * 2) * 0.12;
    }
    if (parts.armR) {
      parts.armR.rotation.z = -2.75;
      parts.armR.rotation.x = Math.sin(ph * 2 + Math.PI) * 0.12;
    }
    if (parts.torso) {
      parts.torso.rotation.x = -0.08;
      parts.torso.position.y = parts.torso.userData.baseY + Math.abs(Math.sin(ph * 2)) * 0.05;
    }
    if (parts.head) parts.head.rotation.x = -0.18; // mira al cielo
  }
}
