// Cámara broadcast: lateral elevada (lado +Z), inclinada al campo.
// Target = balón*0.65 + jugadorControlado*0.20 + centroDeAcción*0.15,
// con interpolación suave. Zoom dinámico: se aleja con el balón rápido o en
// contraataques, se acerca en las áreas y a balón parado. Sin brusquedades.

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { actionCenter, getControlled } from "../game/engine";
import { useMatchStore } from "../stores/useMatchStore";
import { clamp, damp } from "../utils/math";

const BASE_OFFSET = new THREE.Vector3(0, 26, 40);

export function BroadcastCamera({ engine }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const zoom = useRef(1);
  const lookNow = useRef(new THREE.Vector3(0, 0, 0));
  const initialized = useRef(false);

  useFrame((_, rawDt) => {
    // Fase E: durante la repetición la cámara la lleva el ReplayPlayer.
    if (useMatchStore.getState().phase === "replay") return;
    const dt = Math.min(rawDt, 0.05);
    const b = engine.ball;
    const ctrl = getControlled(engine);
    const ac = actionCenter(engine);

    // Punto de interés ponderado
    const tx = b.x * 0.65 + (ctrl ? ctrl.x * 0.2 : 0) + ac.x * 0.15;
    const tz = b.z * 0.65 + (ctrl ? ctrl.z * 0.2 : 0) + ac.z * 0.15;
    // El target no sale del rectángulo de juego (la cámara no se pierde)
    const cx = clamp(tx, -45, 45);
    const cz = clamp(tz, -30, 30);

    // Zoom dinámico
    const ballSpeed = Math.hypot(b.vx, b.vz);
    let z = 1;
    z += clamp(ballSpeed / 30, 0, 0.28);          // balón rápido => abrir
    const nearBox = Math.abs(b.x) > 34;           // cerca de un área...
    if (nearBox && ballSpeed < 4) z -= 0.16;      // ...y juego pausado => acercar
    if (ballSpeed < 0.6) z -= 0.1;                // balón parado => acercar
    // Contraataque: balón en campo rival moviéndose rápido hacia la portería
    const attacking = (b.x > 12 && b.vx > 5) || (b.x < -12 && b.vx < -5);
    if (attacking) z += 0.08;
    // "Kick" de cámara en tiros a puerta (Fase B): zoom-in breve de 0.3 s
    if (engine.camKick > 0) z *= 1 - 0.13 * (engine.camKick / 0.3);
    z = clamp(z, 0.82, 1.32);

    // Suavizado (sin movimientos bruscos)
    const kPos = 1 - Math.exp(-2.6 * dt);
    target.current.x = damp(target.current.x, cx, kPos);
    target.current.z = damp(target.current.z, cz, kPos);
    zoom.current = damp(zoom.current, z, 1 - Math.exp(-2.2 * dt));

    const off = BASE_OFFSET.clone().multiplyScalar(zoom.current);
    const desired = new THREE.Vector3(
      target.current.x + off.x,
      off.y,
      target.current.z + off.z
    );
    if (!initialized.current) {
      camera.position.copy(desired);
      lookNow.current.set(target.current.x, 0, target.current.z);
      initialized.current = true;
    } else {
      camera.position.lerp(desired, kPos);
    }
    lookNow.current.x = damp(lookNow.current.x, target.current.x, kPos);
    lookNow.current.z = damp(lookNow.current.z, target.current.z, kPos);
    camera.lookAt(lookNow.current.x, 0.5, lookNow.current.z);
  });

  return null;
}
