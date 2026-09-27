// Reproductor de la repetición automática de gol (Fase E).
// Se monta solo durante la fase "replay": la simulación está congelada,
// interpola los fotogramas grabados y mueve la cámara entre 3 ángulos
// estilo retransmisión con transiciones suaves. Saltable con cualquier tecla.
// Al terminar (o al saltar) hace kickoff y devuelve a "playing": no rompe
// el estado del partido porque el saque de centro recoloca todo.

import { useRef, useEffect, useMemo, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMatchStore } from "../stores/useMatchStore";
import { kickoff } from "../game/engine";
import { applyReplayFrame, REPLAY_HZ } from "./goalReplay";

/** 3 ángulos sobre la portería donde se marcó. meta: { gx, atk, x, z }. */
function buildAngles(meta) {
  const { gx, atk, x, z } = meta;
  return [
    { pos: [gx - atk * 15, 7.5, 19], look: [gx - atk * 5, 1, 0] },      // lateral cercano
    { pos: [gx + atk * 12, 3.4, z * 0.3], look: [gx - atk * 9, 1.2, 0] }, // detrás de la portería
    { pos: [x - atk * 4, 25, 13], look: [gx - atk * 7, 0, 0] },           // cenital parcial
  ];
}

function ReplayCamera({ meta, dur }) {
  const { camera } = useThree();
  const angles = useMemo(() => buildAngles(meta), [meta]);
  const t = useRef(0);
  const look = useRef(new THREE.Vector3(meta.x, 1, meta.z));
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    t.current += dt;
    const seg = dur / angles.length;
    const idx = Math.min(angles.length - 1, Math.floor(t.current / seg));
    const a = angles[idx];
    // Transición suave: el amortiguado enlaza los ángulos sin cortes
    const k = 1 - Math.exp(-3.4 * dt);
    tmp.set(a.pos[0], a.pos[1], a.pos[2]);
    camera.position.lerp(tmp, k);
    tmp.set(a.look[0], a.look[1], a.look[2]);
    look.current.lerp(tmp, k);
    camera.lookAt(look.current);
  });
  return null;
}

export function ReplayPlayer({ engine }) {
  // Foto de los ÚLTIMOS ~3 s del buffer (lo inmediatamente anterior al gol),
  // no del principio: el buffer circular puede contener hasta 18 s.
  const frames = useMemo(() => {
    const buf = engine.replayBuf.frames;
    return buf.slice(Math.max(0, buf.length - REPLAY_HZ * 3));
  }, [engine]);
  const meta = engine.replayMeta || { gx: 52.5, atk: 1, x: 0, z: 0 };
  // Duración 2–3 s: el metraje manda (gol muy pronto = menos fuente).
  const dur = Math.min(3, Math.max(2, frames.length / REPLAY_HZ));
  const t = useRef(0);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    kickoff(engine); // recoloca a los 22 y el balón al centro
    useMatchStore.getState().resumeAfterGoal();
  }, [engine]);

  // Limpieza al entrar: la pose de celebración era del directo, no del replay.
  useEffect(() => {
    for (const p of engine.players) {
      p.anim.action = null;
      p.anim.timer = 0;
    }
  }, [engine]);

  // Saltable con cualquier tecla (incluido Esc).
  useEffect(() => {
    const h = () => finish();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [finish]);

  useFrame((_, rawDt) => {
    if (done.current) return;
    t.current += Math.min(rawDt, 0.05);
    if (t.current >= dur) {
      finish();
      return;
    }
    applyReplayFrame(engine, frames, t.current);
  });

  return <ReplayCamera meta={meta} dur={dur} />;
}
