// Estado global del partido (zustand).
// Solo estado "alto nivel": fase, equipos, marcador, reloj, eventos.
// La simulación por fotograma (posiciones, balón) vive en el motor mutable
// de src/game/engine.js para no re-renderizar React a 60 FPS.

import { create } from "zustand";
import { DURATION_OPTIONS, MATCH_TIME_SCALE } from "../game/constants";
import { getTeam } from "../data/teams";

const initialScore = () => ({ home: 0, away: 0 });
// Fase D: estadísticas arbitrales y de balón parado por equipo
// (el motor las actualiza vía bumpStat; la Fase E las mostrará).
// Fase E: se añaden posesión (segundos con balón), tiros y tiros a puerta.
const initialStats = () => ({
  home: { fouls: 0, yellow: 0, red: 0, corners: 0, offsides: 0, penalties: 0, possession: 0, shots: 0, shotsOnTarget: 0 },
  away: { fouls: 0, yellow: 0, red: 0, corners: 0, offsides: 0, penalties: 0, possession: 0, shots: 0, shotsOnTarget: 0 },
});

export const useMatchStore = create((set, get) => ({
  // ---- flujo de pantallas ----
  phase: "menu", // menu | select | versus | lineups | playing | paused | goal | replay | fulltime
  showStats: false, // overlay de estadísticas (tecla Tab)

  // ---- configuración ----
  homeTeamId: "real-madrid",
  awayTeamId: "barcelona",
  durationMin: 5, // minutos de partido (tiempo real)
  matchId: 0, // crece en cada startMatch: App remonta <Match> (revancha limpia)

  // ---- partido ----
  score: initialScore(),
  clock: 0,            // segundos de partido transcurridos
  events: [],          // { type:'goal', team:'home'|'away', scorer, minute }
  lastGoal: null,      // último gol (para el banner y la repetición)
  controlledId: null,  // id del jugador controlado con el teclado
  notice: null,        // aviso temporal en el HUD (p. ej. "Falta de X")
  replayVideo: null,   // blob URL del vídeo de la última repetición (descargable)
  stats: initialStats(), // faltas, tarjetas, córners, fueras de juego, penaltis, posesión, tiros
  subs: { home: 0, away: 0 }, // sustituciones usadas (máx. 5 por equipo)

  // ---- acciones ----
  setPhase: (phase) => set({ phase }),
  setHomeTeam: (homeTeamId) => set({ homeTeamId }),
  setAwayTeam: (awayTeamId) => set({ awayTeamId }),
  setDuration: (durationMin) => set({ durationMin }),
  setControlled: (controlledId) => set({ controlledId }),
  setNotice: (notice) => set({ notice }),
  /** Guarda la URL del vídeo de la última repetición (o null para ocultarlo). */
  setReplayVideo: (replayVideo) => set({ replayVideo }),
  toggleStats: () =>
    set((s) =>
      s.phase === "playing" || s.phase === "paused"
        ? { showStats: !s.showStats }
        : {}
    ),
  setShowStats: (showStats) => set({ showStats }),
  /** Suma segundos de posesión a un equipo (la llama la sincronización del reloj). */
  setPossession: (home, away) =>
    set((s) => ({
      stats: {
        home: { ...s.stats.home, possession: home },
        away: { ...s.stats.away, possession: away },
      },
    })),
  /** Incrementa una estadística de un equipo ('home'|'away'). */
  bumpStat: (side, key) =>
    set((s) => ({
      stats: {
        ...s.stats,
        [side]: { ...s.stats[side], [key]: (s.stats[side][key] || 0) + 1 },
      },
    })),
  /** Cuenta una sustitución (máx. 5 por equipo y partido). */
  bumpSub: (side) =>
    set((s) => ({ subs: { ...s.subs, [side]: (s.subs[side] || 0) + 1 } })),

  startMatch: () =>
    set((s) => ({
      matchId: s.matchId + 1,
      phase: "playing",
      score: initialScore(),
      clock: 0,
      events: [],
      lastGoal: null,
      controlledId: null,
      notice: null,
      replayVideo: null,
      stats: initialStats(),
      subs: { home: 0, away: 0 },
      showStats: false,
    })),

  pause: () => get().phase === "playing" && set({ phase: "paused" }),
  resume: () => get().phase === "paused" && set({ phase: "playing" }),
  quitToMenu: () =>
    set({
      phase: "menu",
      score: initialScore(),
      clock: 0,
      events: [],
      lastGoal: null,
      controlledId: null,
      notice: null,
      replayVideo: null,
      stats: initialStats(),
      subs: { home: 0, away: 0 },
      showStats: false,
    }),

  /** Registra un gol y abre la fase de celebración. */
  goal: (side, scorerName) => {
    const { score, clock, events, replayVideo } = get();
    if (replayVideo) {
      try { URL.revokeObjectURL(replayVideo); } catch { /* nada */ }
    }
    const minute = Math.floor(clock / 60) + 1;
    const entry = { type: "goal", team: side, scorer: scorerName, minute };
    set({
      score: { ...score, [side]: score[side] + 1 },
      events: [...events, entry],
      lastGoal: entry,
      replayVideo: null,
      phase: "goal",
    });
  },

  /** Tras la celebración: entra la repetición automática. */
  startReplay: () => get().phase === "goal" && set({ phase: "replay" }),

  /** Vuelve a "playing" tras la repetición (el motor re-saca de centro). */
  resumeAfterGoal: () => set({ phase: "playing", lastGoal: null, showStats: false }),

  finish: () => set({ phase: "fulltime" }),

  // ---- relojes derivados (solo lectura) ----
  /** Segundos de partido restantes (cuenta atrás). */
  getRemaining: () => {
    const { clock, durationMin } = get();
    return Math.max(0, durationMin * 60 - clock);
  },
  getHomeTeam: () => getTeam(get().homeTeamId),
  getAwayTeam: () => getTeam(get().awayTeamId),
  getTimeScale: () => MATCH_TIME_SCALE,
  getDurationOptions: () => DURATION_OPTIONS,
}));
