// HUD y overlays del partido, todo en español (Fase E: estilo retransmisión
// propio). Marcador con escudos, reloj en minutos de partido, banners de
// eventos, indicador de balón parado, overlay de estadísticas (Tab), pausa
// con pestañas (controles / estadísticas / cambios) y pantalla final.

import { useState, useEffect } from "react";
import { useMatchStore } from "../stores/useMatchStore";
import { TeamCrest } from "../data/teams";
import { StatsTable } from "./StatsTable";
import { substitutionCandidates, availableSubs } from "../game/engine";

// ---------- Marcador estilo retransmisión ----------
export function HUD() {
  const { score, clock, getHomeTeam, getAwayTeam } = useMatchStore();
  const home = getHomeTeam();
  const away = getAwayTeam();
  const min = Math.floor(clock / 60);
  return (
    <>
      <div className="hud">
        <div className="scoreboard">
          <TeamCrest crest={home.crest} size={30} />
          <span className="abr">{home.abbreviation}</span>
          <span className="goals">{score.home} - {score.away}</span>
          <span className="abr">{away.abbreviation}</span>
          <TeamCrest crest={away.crest} size={30} />
          <span className="clock">{min}&prime;</span>
        </div>
      </div>
      <DeadBallIndicator />
      <div className="hud-hint">
        <b>IJKL/Flechas:</b> mover · <b>Shift:</b> sprint ·{" "}
        <b>A:</b> pasar / entrada (mantener: tiro) · <b>Q:</b> cambiar ·{" "}
        <b>Tab:</b> estadísticas · <b>Esc:</b> pausa
      </div>
    </>
  );
}

// ---------- Indicador de balón parado ----------
const KIND_TEXT = {
  "throw-in": "Saque de banda",
  corner: "Córner",
  "goal-kick": "Saque de puerta",
  "free-kick": "Tiro libre",
  penalty: "Penalti",
};

export function DeadBallIndicator() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    const id = setInterval(() => {
      const db = window.__match?.engine?.deadBall;
      if (db && (db.state === "DEAD_BALL_SETUP" || db.state === "DEAD_BALL_READY")) {
        setInfo((v) =>
          v && v.kind === db.kind && v.userKicking === db.userKicking && v.userKeeping === db.userKeeping
            ? v
            : { kind: db.kind, userKicking: db.userKicking, userKeeping: db.userKeeping }
        );
      } else {
        setInfo((v) => (v ? null : v));
      }
    }, 250);
    return () => clearInterval(id);
  }, []);
  if (!info) return null;
  let instr = "Apunta con IJKL · A para sacar";
  if (info.kind === "penalty" && info.userKeeping) {
    instr = "Mueve al portero con J/L · A para lanzarte";
  } else if (info.kind === "penalty") {
    instr = "Apunta con IJKL · A para tirar (mantener: con carga)";
  } else if (info.kind === "free-kick") {
    instr = "Apunta con IJKL · A para sacar (mantener: tiro con carga)";
  }
  return (
    <div className="deadball-indicator">
      <b>{KIND_TEXT[info.kind] || "Balón parado"}</b>
      <span>{instr}</span>
    </div>
  );
}

// ---------- Aviso temporal (faltas, tarjetas, fueras de juego, penaltis) ----------
export function NoticeToast() {
  const notice = useMatchStore((s) => s.notice);
  if (!notice) return null;
  return <div className="notice-toast">{notice}</div>;
}

// ---------- Banner de gol ----------
export function GoalBanner() {
  const lastGoal = useMatchStore((s) => s.lastGoal);
  const { getHomeTeam, getAwayTeam } = useMatchStore();
  if (!lastGoal) return null;
  const team = lastGoal.team === "home" ? getHomeTeam() : getAwayTeam();
  return (
    <div className="goal-banner">
      <h1>¡GOOOL!</h1>
      <p>¡Gol de {lastGoal.scorer}!</p>
      <p className="goal-sub">
        {team.abbreviation} · {lastGoal.minute}&prime;
      </p>
    </div>
  );
}

// ---------- Rótulo de la repetición ----------
export function ReplayLabel() {
  const lastGoal = useMatchStore((s) => s.lastGoal);
  const { getHomeTeam, getAwayTeam } = useMatchStore();
  if (!lastGoal) return null;
  const team = lastGoal.team === "home" ? getHomeTeam() : getAwayTeam();
  return (
    <div className="replay-label">
      <div className="replay-tag">REPETICIÓN · CÁMARA LENTA</div>
      <div className="replay-scorer">
        ⚽ {lastGoal.scorer} · {team.abbreviation} {lastGoal.minute}&prime;
      </div>
      <div className="replay-hint">Pulsa cualquier tecla para saltarla</div>
    </div>
  );
}

/** Botón para descargar la última repetición como vídeo (.webm). Aparece
 *  al terminar la repetición y queda disponible hasta el siguiente gol. */
export function ReplayDownloadButton() {
  const url = useMatchStore((s) => s.replayVideo);
  if (!url) return null;
  const download = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = "repeticion-gol.webm";
    document.body.appendChild(a);
    a.click();
    a.remove();
    try { URL.revokeObjectURL(url); } catch { /* nada */ }
    useMatchStore.getState().setReplayVideo(null);
  };
  return (
    <button className="replay-download" onClick={download}>
      ⬇ Descargar repetición (.webm)
    </button>
  );
}

// ---------- Overlay de estadísticas (tecla Tab) ----------
export function StatsOverlay() {
  const showStats = useMatchStore((s) => s.showStats);
  const phase = useMatchStore((s) => s.phase);
  if (!showStats || (phase !== "playing" && phase !== "paused")) return null;
  return (
    <div className="stats-overlay">
      <h3>
        ESTADÍSTICAS <span className="stats-tab-hint">— Tab para cerrar</span>
      </h3>
      <StatsTable />
    </div>
  );
}

// ---------- Tabla de controles (integrada en la pausa) ----------
const CONTROL_ROWS = [
  ["IJKL / Flechas", "Moverse (I = atacar, hacia arriba en pantalla)"],
  ["Shift", "Sprint (consume stamina; fundido = menos punta)"],
  ["A (con balón)", "Toque: pase raso al compañero · Mantener: cargar tiro, soltar: disparar"],
  ["A (sin balón)", "Entrada / presión hacia el input o el balón"],
  ["Q", "Cambiar de jugador (hacia la dirección pulsada o el más cercano al balón)"],
  ["Tab", "Mostrar / ocultar las estadísticas del partido"],
  ["Esc", "Pausa"],
];

export function ControlsTable() {
  return (
    <div className="controls-table">
      <h3>CONTROLES</h3>
      {CONTROL_ROWS.map(([key, desc]) => (
        <div className="controls-row" key={key}>
          <span className="controls-key">{key}</span>
          <span className="controls-desc">{desc}</span>
        </div>
      ))}
      <p className="controls-pad">
        Mando: stick izq. mover · RT sprint · A pase · Y hueco · B tiro ·
        X centro · LB cambiar · RB 2º defensor · LT regate
      </p>
    </div>
  );
}

// ---------- Sustituciones (pausa): titular por suplente, máx. 5 por equipo ----------
function SubstitutionPanel() {
  const subs = useMatchStore((s) => s.subs);
  const [side, setSide] = useState("home");
  const [titular, setTitular] = useState("");
  const [suplente, setSuplente] = useState("");
  const [msg, setMsg] = useState("");
  const engine = window.__match?.engine;
  if (!engine) return <p className="hint">Motor no disponible</p>;

  const cands = substitutionCandidates(engine, side);
  const bench = availableSubs(engine, side);
  const left = 5 - (subs[side] || 0);

  const doIt = () => {
    const r = window.__match.doSubstitution(side, titular, suplente);
    if (r.ok) {
      setMsg(`Cambio realizado: sale ${r.out}, entra ${r.in}.`);
      setTitular("");
      setSuplente("");
    } else {
      setMsg(`No se pudo hacer el cambio: ${r.error}.`);
    }
  };

  return (
    <div className="subs-panel">
      <div className="subs-teams">
        <button
          className={`duration-btn${side === "home" ? " active" : ""}`}
          onClick={() => { setSide("home"); setTitular(""); setSuplente(""); setMsg(""); }}
        >
          Local
        </button>
        <button
          className={`duration-btn${side === "away" ? " active" : ""}`}
          onClick={() => { setSide("away"); setTitular(""); setSuplente(""); setMsg(""); }}
        >
          Visitante
        </button>
        <span className="subs-left">Cambios restantes: {left}/5</span>
      </div>
      <div className="subs-row">
        <label>
          Sale (titular)
          <select value={titular} onChange={(e) => setTitular(e.target.value)}>
            <option value="">— elige —</option>
            {cands.map((p) => (
              <option key={p.uid} value={p.uid}>
                {p.data.number} · {p.data.name} ({p.role})
              </option>
            ))}
          </select>
        </label>
        <label>
          Entra (suplente)
          <select value={suplente} onChange={(e) => setSuplente(e.target.value)}>
            <option value="">— elige —</option>
            {bench.map((d) => (
              <option key={d.id} value={d.id}>
                {d.number} · {d.name} ({d.position})
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="btn"
        disabled={!titular || !suplente || left <= 0}
        onClick={doIt}
      >
        Hacer cambio
      </button>
      {msg && <p className="subs-msg">{msg}</p>}
    </div>
  );
}

// ---------- Menú de pausa con pestañas ----------
export function PauseMenu() {
  const { resume, quitToMenu } = useMatchStore();
  const [tab, setTab] = useState("controles"); // controles | stats | cambios
  return (
    <div className="overlay">
      <h2>PAUSA</h2>
      <p className="hint">Tómate un respiro, míster</p>
      <div className="pause-tabs">
        <button
          className={`duration-btn${tab === "controles" ? " active" : ""}`}
          onClick={() => setTab("controles")}
        >
          Controles
        </button>
        <button
          className={`duration-btn${tab === "stats" ? " active" : ""}`}
          onClick={() => setTab("stats")}
        >
          Estadísticas
        </button>
        <button
          className={`duration-btn${tab === "cambios" ? " active" : ""}`}
          onClick={() => setTab("cambios")}
        >
          Cambios
        </button>
      </div>
      {tab === "controles" && <ControlsTable />}
      {tab === "stats" && <StatsTable />}
      {tab === "cambios" && <SubstitutionPanel />}
      <div>
        <button className="btn" onClick={resume}>Continuar</button>
        <button className="btn btn-secondary" onClick={quitToMenu}>Salir al menú</button>
      </div>
    </div>
  );
}

// ---------- Pantalla final: resultado, goleadores y comparativa ----------
export function FullTimeScreen() {
  const { score, events, getHomeTeam, getAwayTeam, quitToMenu, setPhase, startMatch } =
    useMatchStore();
  const home = getHomeTeam();
  const away = getAwayTeam();
  const winner =
    score.home > score.away ? home.name : score.away > score.home ? away.name : null;
  return (
    <div className="overlay">
      <h2>FINAL DEL PARTIDO</h2>
      <div className="final-score">
        <TeamCrest crest={home.crest} size={44} /> {home.abbreviation}{" "}
        <span className="goals">{score.home} - {score.away}</span>{" "}
        {away.abbreviation} <TeamCrest crest={away.crest} size={44} />
      </div>
      <p className="hint">{winner ? `Victoria de ${winner}` : "Empate"}</p>
      {events.length > 0 && (
        <>
          <h3 className="final-h3">Goleadores</h3>
          <ul className="events">
            {events.map((e, i) => (
              <li key={i}>
                ⚽ {e.minute}&prime; — {e.scorer} (
                {e.team === "home" ? home.abbreviation : away.abbreviation})
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className="final-h3">Estadísticas</h3>
      <StatsTable />
      <div>
        <button className="btn" onClick={startMatch}>Revancha</button>
        <button className="btn btn-secondary" onClick={() => setPhase("select")}>
          Cambiar equipos
        </button>
        <button className="btn btn-secondary" onClick={quitToMenu}>
          Menú principal
        </button>
      </div>
    </div>
  );
}
