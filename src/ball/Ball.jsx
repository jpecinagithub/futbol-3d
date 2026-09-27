// Balón de fútbol procedural (diseño propio: esfera blanca con parches oscuros).
// La malla se coloca cada fotograma desde el motor (sin React state).

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BALL } from "../game/constants";
import { playBounce } from "../audio/audioEngine";

/** Textura procedural de balón: base blanca con manchas pentagonales oscuras. */
function makeBallTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#f4f4f2";
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#1c1c22";
  // Parches distribuidos de forma regular (no es un balón oficial, es genérico)
  const spots = [
    [32, 32], [96, 20], [160, 34], [224, 26],
    [64, 74], [128, 66], [192, 78], [240, 96],
    [16, 104], [104, 108], [168, 110], [224, 60], [0, 60], [256, 110],
  ];
  for (const [x, y] of spots) {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * 13, py = y + Math.sin(a) * 13;
      i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let cachedTex = null;

export function Ball({ engine }) {
  const ref = useRef();
  const tex = useMemo(() => {
    if (!cachedTex) cachedTex = makeBallTexture();
    return cachedTex;
  }, []);

  useFrame(() => {
    const b = engine.ball;
    if (!ref.current) return;
    ref.current.position.set(b.x, b.y, b.z);
    // Fase E: sonido de bote (la física marca b.bounced al impactar)
    if (b.bounced > 0) {
      try {
        playBounce(Math.min(6, b.bounced));
      } catch { /* sin audio */ }
      b.bounced = 0;
    }
    // Rodadura visual: gira según la velocidad horizontal
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0.05) {
      const axis = new THREE.Vector3(b.vz, 0, -b.vx).normalize();
      ref.current.rotateOnWorldAxis(axis, (sp / BALL.radius) * 0.016);
    }
  });

  return (
    <mesh ref={ref} castShadow>
      <sphereGeometry args={[BALL.radius, 20, 14]} />
      <meshStandardMaterial map={tex} roughness={0.55} />
    </mesh>
  );
}
