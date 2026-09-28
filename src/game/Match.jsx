// Escena del partido: monta el motor determinista y lo avanza con paso fijo.
// - Entrada unificada (teclado + gamepad) vía src/game/input.js.
// - Las acciones (pases, tiros, entradas, cambios) se procesan una vez por
//   frame en processActions; el movimiento continuo va a stepEngine.
// - Sincroniza el reloj con el store (limitado, sin re-renders por frame).
// - Detecta goles y fin del partido.
// React solo PINTA: las posiciones se escriben directamente en los meshes.

import { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMatchStore } from "../stores/useMatchStore";
import { createMatch, stepEngine, kickoff, getControlled, substitutePlayer } from "./engine";
import { createInputState, attachKeyboard, detachKeyboard, pollFrameInput } from "./input";
import { processActions } from "./actions";import { FIXED_DT, FIELD, BALL } from "./constants";
import { clamp } from "../utils/math";
import { Field } from "../stadium/Field";
import { Stadium } from "../stadium/Stadium";
import { Ball } from "../ball/Ball";
import { PlayerModel } from "../players/PlayerModel";
import { BroadcastCamera } from "../camera/BroadcastCamera";
import { ReplayPlayer } from "../replay/ReplayPlayer";
import { recordTick } from "../replay/goalReplay";
import { startCrowd, stopCrowd, playWhistle, playCrowdGoal, playNet, setCrowdExcitement } from "../audio/audioEngine";

// ---------- Bucle de simulación ----------
function Simulation({ engine }) {
  const inputRef = useRef(null);
  if (!inputRef.current) inputRef.current = createInputState();
  const acc = useRef(0);
  const lastClockSync = useRef(0);
  const heatRef = useRef(0.22); // emoción del ambiente (Fase E)
  const phase = useMatchStore((s) => s.phase);

  useEffect(() => {
    attachKeyboard(inputRef.current);
    return () => detachKeyboard(inputRef.current);
  }, []);

  useFrame((_, rawDt) => {
    const st = useMatchStore.getState();
    if (st.phase !== "playing") return;

    const dt = Math.min(rawDt, 0.1);
    // Entrada del frame (movimiento + eventos de flanco) y acciones de juego
    const fin = pollFrameInput(inputRef.current);
    processActions(engine, fin, dt);

    acc.current += dt;
    const simInput = {
      x: fin.move.x,
      z: fin.move.z,
      sprint: fin.sprint,
      dribble: fin.dribbleMod,
    };
    let tick = 0;
    while (acc.current >= FIXED_DT && tick < 5) {
      stepEngine(engine, FIXED_DT, simInput, {
        onGoal: (side, scorer) => {
          // Meta para los ángulos de la repetición (portería atacada)
          const atk = side === "home" ? 1 : -1;
          engine.replayMeta = {
            gx: atk * FIELD.halfLength,
            atk,
            x: engine.ball.x,
            z: engine.ball.z,
          };
          // Limpieza del hook de test provokeGoal (restaura al portero)
          if (engine._gkAway) {
            engine._gkAway.sentOff = false;
            engine._gkAway = null;
          }
          st.goal(side, scorer);
          playCrowdGoal();
          playNet();
          playWhistle("gol");
          heatRef.current = 1; // el ambiente se viene arriba con el gol
        },
      });
      acc.current -= FIXED_DT;
      tick++;
    }
    // Fase E: la repetición graba estados a 30 Hz durante el juego
    recordTick(engine);

    // Reloj -> store (como mucho ~2 veces por segundo real)
    if (engine.matchTime - lastClockSync.current > 1.2) {
      lastClockSync.current = engine.matchTime;
      useMatchStore.setState({ clock: engine.matchTime });
      // Fase E: sincroniza la posesión acumulada por el motor
      useMatchStore.getState().setPossession(
        engine.possTime.home,
        engine.possTime.away
      );
      // Fase E: el ambiente respira con el partido — pico en los goles,
      // decae despacio y crece en el tramo final.
      const baseHeat = 0.22 + 0.3 * (engine.matchTime / (st.durationMin * 60));
      heatRef.current = Math.max(baseHeat, heatRef.current - 0.12);
      setCrowdExcitement(heatRef.current);
    }

    // Fin del partido
    if (engine.matchTime >= st.durationMin * 60) {
      useMatchStore.setState({ clock: st.durationMin * 60 });
      engine.frozen = true;
      playWhistle("final");
      st.finish();
    }
  });

  // La tecla Esc pausa / reanuda
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== "Escape") return;
      const s = useMatchStore.getState();
      if (s.phase === "playing") s.pause();
      else if (s.phase === "paused") s.resume();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Tras el gol: 1.6 s de celebración y entra la repetición automática
  // (al terminar la repetición se hace kickoff y se vuelve a "playing").
  useEffect(() => {
    if (phase !== "goal") return;
    const t = setTimeout(() => {
      useMatchStore.getState().startReplay();
    }, 1600);
    return () => clearTimeout(t);
  }, [phase, engine]);

  return null;
}

// ---------- Anillo + nombre del jugador controlado ----------
// El anillo es un mesh 3D; el nombre es un div HTML posicionado por proyección
// manual (evita el coste y los matices del componente Html de drei).
function ControlledMarker({ engine }) {
  const group = useRef();
  useFrame(() => {
    if (!group.current) return;
    const c = getControlled(engine);
    group.current.position.set(c.x, 0.03, c.z);
  });
  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.68, 32]} />
        <meshBasicMaterial color="#ffd21f" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ControlledLabel({ engine }) {
  const { camera, size } = useThree();
  const elRef = useRef(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  const lastUid = useRef(null);
  const lastName = useRef(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.className = "player-label";
    el.innerHTML =
      '<span class="pl-name"></span>' +
      '<div class="pl-bars">' +
      '<div class="pl-stam"><div class="pl-stam-fill"></div></div>' +
      '<div class="pl-power"><div class="pl-power-fill"></div></div>' +
      "</div>";
    document.getElementById("label-layer")?.appendChild(el);
    elRef.current = {
      el,
      name: el.querySelector(".pl-name"),
      stam: el.querySelector(".pl-stam-fill"),
      power: el.querySelector(".pl-power-fill"),
      powerWrap: el.querySelector(".pl-power"),
    };
    return () => el.remove();
  }, []);

  useFrame(() => {
    const r = elRef.current;
    if (!r) return;
    const c = getControlled(engine);
    if (c.uid !== lastUid.current || c.data.name !== lastName.current) {
      lastUid.current = c.uid;
      lastName.current = c.data.name;
      r.name.textContent = `${c.data.name} · ${c.data.number}`;
    }
    // Barra de stamina (roja si está fundido)
    const st = Math.max(0, Math.min(100, c.stamina));
    r.stam.style.width = `${st.toFixed(0)}%`;
    r.stam.style.background = st < 25 ? "#ff5d5d" : "#9fe870";
    // Barra de potencia del tiro mientras se carga (D)
    if (engine.charge && engine.charge.uid === c.uid) {
      r.powerWrap.style.display = "block";
      r.power.style.width = `${(engine.charge.t * 100).toFixed(0)}%`;
    } else {
      r.powerWrap.style.display = "none";
    }
    v.set(c.x, 2.55, c.z).project(camera);
    if (v.z > 1 || v.z < -1) {
      r.el.style.display = "none";
      return;
    }
    r.el.style.display = "block";
    const x = (v.x * 0.5 + 0.5) * size.width;
    const y = (-v.y * 0.5 + 0.5) * size.height;
    r.el.style.transform = `translate(-50%,-100%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  });
  return null;
}

// ---------- Celebración de gol (Fase E) ----------
// Durante la fase "goal" el motor está congelado: este componente anima a
// mano al goleador (corre unos metros con los brazos en alto, pose
// "celebrate" del animator) y los compañeros cercanos se acercan a felicitar.
function GoalCelebration({ engine }) {
  const t = useRef(0);
  const init = useRef(false);

  useFrame((_, rawDt) => {
    if (useMatchStore.getState().phase !== "goal") return;
    const dt = Math.min(rawDt, 0.05); // el motor está congelado: animación manual
    if (!init.current) {
      init.current = true;
      t.current = 0;
      const scorer = engine.players.find((p) => p.uid === engine.lastScorerUid);
      if (scorer && !scorer.sentOff) {
        scorer.anim.action = "celebrate";
        scorer.anim.timer = 10; // no decae: el motor está congelado
        const sp = 3.6;
        scorer.vx = Math.cos(scorer.facing) * sp;
        scorer.vz = Math.sin(scorer.facing) * sp;
      }
    }
    t.current += dt;
    const scorer = engine.players.find((p) => p.uid === engine.lastScorerUid);
    if (scorer && !scorer.sentOff) {
      if (t.current < 1.5) {
        // Corre con los brazos en alto
        scorer.x = clamp(scorer.x + scorer.vx * dt, -55, 55);
        scorer.z = clamp(scorer.z + scorer.vz * dt, -36, 36);
      } else {
        scorer.vx = 0;
        scorer.vz = 0;
      }
      // Compañeros cercanos (no portero) se acercan a felicitar
      for (const p of engine.players) {
        if (p.side !== scorer.side || p === scorer || p.sentOff || p.role === "GK") continue;
        const dx = scorer.x - p.x, dz = scorer.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 13 && d > 1.7) {
          const sp = Math.min(p.maxSpeed * 0.85, d * 3);
          p.x += (dx / d) * sp * dt;
          p.z += (dz / d) * sp * dt;
          p.vx = (dx / d) * sp;
          p.vz = (dz / d) * sp;
          p.facing = Math.atan2(dz, dx);
        } else if (d <= 1.7) {
          p.vx = 0;
          p.vz = 0;
        }
      }
    }
  });
  return null;
}

// ---------- Etiquetas de debug de la IA (Fase C / útil en Fase F) ----------
// Se activa con window.__AI_DEBUG = true (apagado por defecto). Pinta sobre
// cada jugador de la IA su estado actual y la fase colectiva de su equipo.
function AiDebugLabels({ engine }) {
  const { camera, size } = useThree();
  const els = useRef(new Map());
  const v = useMemo(() => new THREE.Vector3(), []);

  // Cleanup al desmontar: retirar los nodos creados.
  useEffect(() => {
    const map = els.current;
    return () => {
      for (const rec of map.values()) rec.remove();
      map.clear();
    };
  }, []);

  useFrame(() => {
    const on = typeof window !== "undefined" && !!window.__AI_DEBUG;
    for (const p of engine.players) {
      if (p.controlled) continue;
      let rec = els.current.get(p.uid);
      if (!on) {
        if (rec) rec.style.display = "none";
        continue;
      }
      if (!rec) {
        rec = document.createElement("div");
        rec.className = "ai-debug-label";
        document.getElementById("label-layer")?.appendChild(rec);
        els.current.set(p.uid, rec);
      }
      const dbg = engine.aiDebug?.[p.uid];
      rec.textContent = dbg ? `${dbg.ph.split("_")[0]}·${dbg.s.replace("GK_", "")}` : "?";
      v.set(p.x, 2.3, p.z).project(camera);
      if (v.z > 1 || v.z < -1) {
        rec.style.display = "none";
        continue;
      }
      rec.style.display = "block";
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      rec.style.transform = `translate(-50%,-100%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    }
  });
  return null;
}

// ---------- Indicador visual del pase: línea en el suelo (0.4 s) ----------
function PassIndicator({ engine }) {
  const g = useRef();
  useFrame(() => {
    if (!g.current) return;
    const fx = engine.passFx;
    if (!fx || fx.t <= 0) {
      g.current.visible = false;
      return;
    }
    g.current.visible = true;
    g.current.position.set(fx.x + fx.dx * fx.len / 2, 0.05, fx.z + fx.dz * fx.len / 2);
    g.current.rotation.y = Math.atan2(fx.dx, fx.dz);
    g.current.scale.set(1, 1, Math.max(0.5, fx.len));
    const mat = g.current.children[0].material;
    mat.opacity = Math.max(0, Math.min(0.85, (fx.t / 0.4) * 0.9));
  });
  return (
    <group ref={g} visible={false}>
      <mesh>
        <boxGeometry args={[0.4, 0.03, 1]} />
        <meshBasicMaterial color="#8fd4ff" transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---------- Puntería en balón parado (Fase D) ----------
// Flecha amarilla desde el balón en la dirección de la puntería del
// usuario (IJKL) mientras prepara un saque (DEAD_BALL_READY).
function DeadBallAim({ engine }) {
  const g = useRef();
  useFrame(() => {
    if (!g.current) return;
    const db = engine.deadBall;
    const show = db && db.state === "DEAD_BALL_READY" && db.userKicking;
    g.current.visible = !!show;
    if (!show) return;
    const b = engine.ball;
    g.current.position.set(b.x + db.aim.x * 3.2, 0.06, b.z + db.aim.z * 3.2);
    g.current.rotation.y = Math.atan2(db.aim.x, db.aim.z);
  });
  return (
    <group ref={g} visible={false}>
      <mesh>
        <boxGeometry args={[0.5, 0.04, 6]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 3.5]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.55, 1.3, 12]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---------- Escena completa ----------
export function Match() {
  const homeTeam = useMatchStore((s) => s.getHomeTeam());
  const awayTeam = useMatchStore((s) => s.getAwayTeam());
  const phase = useMatchStore((s) => s.phase);

  const engine = useMemo(
    () => createMatch(homeTeam, awayTeam),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [homeTeam.id, awayTeam.id]
  );

  useEffect(() => {
    startCrowd(0.05);
    return () => stopCrowd();
  }, []);

  // Saque inicial al montar el partido (Fase F: antes solo se hacía kickoff
  // tras la repetición; el partido empezaba sin colocación de saque).
  useEffect(() => {
    kickoff(engine);
  }, [engine]);

  // Gancho para tests automatizados (headless): expone el motor y el paso.
  useEffect(() => {
    window.__store = useMatchStore; // el store tal cual lo usa la app (misma instancia)
    window.__match = {
      engine, stepEngine, processActions, getControlled,
      get stats() { return engine.stats; }, // Fase D: faltas, tarjetas, córners, fueras de juego, penaltis
      get phase() { return useMatchStore.getState().phase; },
      /** Provoca un gol determinista (solo tests): coloca el balón a 4 m de
       *  la portería rival a 26 m/s y aparta al portero (lo restaura al marcar). */
      provokeGoal: (side = "home") => {
        const atk = side === "home" ? 1 : -1;
        const gx = atk * FIELD.halfLength;
        const gk = engine.players.find(
          (p) => p.role === "GK" && p.side !== side && !p.sentOff
        );
        if (gk) {
          gk.sentOff = true; // temporal: lo ignora el contacto y la IA
          engine._gkAway = gk;
        }
        const b = engine.ball;
        b.x = gx - atk * 4.2;
        b.z = 0;
        b.y = BALL.radius;
        b.vx = atk * 26;
        b.vy = 0;
        b.vz = 0;
        b.spin = 0;
        b.touchCooldown = 0;
        const att =
          engine.players.find((p) => p.side === side && p.role === "ST" && !p.sentOff) ||
          engine.players.find((p) => p.side === side && !p.sentOff);
        b.lastTouch = att ? att.uid : null;
        return true;
      },
      /** Sustitución desde la UI de pausa (también usable en tests). */
      doSubstitution: (side, titularUid, subDataId) => {
        const r = substitutePlayer(engine, side, titularUid, subDataId);
        if (r.ok) {
          const st = useMatchStore.getState();
          st.bumpSub(side);
          st.setNotice(`Cambio: sale ${r.out}, entra ${r.in}`);
        }
        return r;
      },
    };
    return () => { delete window.__match; delete window.__store; };
  }, [engine]);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 50, near: 0.5, far: 600, position: [0, 31, 47] }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#0a0f1e"]} />
      <fog attach="fog" args={["#0a0f1e", 160, 420]} />
      <Stadium />
      <Field />
      <Ball engine={engine} />
      {engine.players.map((p) => (
        <PlayerModel key={p.uid} player={p} teamId={p.side === "home" ? homeTeam.id : awayTeam.id} />
      ))}
      <ControlledMarker engine={engine} />
      <ControlledLabel engine={engine} />
      <AiDebugLabels engine={engine} />
      <PassIndicator engine={engine} />
      <DeadBallAim engine={engine} />
      <GoalCelebration engine={engine} />
      {phase === "replay" && <ReplayPlayer engine={engine} />}
      <BroadcastCamera engine={engine} />
      <Simulation engine={engine} />
    </Canvas>
  );
}
