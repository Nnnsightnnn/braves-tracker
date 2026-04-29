import { useState, useMemo, useEffect } from "react";
import _ from "lodash";
import {
  PLAYERS,
  RSS_FEEDS,
  NEXT_GAME,
  RESULTS,
  TEAM_LOGOS,
  NEWS_DIGEST,
  NL_EAST_STANDINGS,
  UPCOMING_SCHEDULE,
} from "./playerData.js";

// ─── Atlanta Braves Tracker ─────────────────────────────────────────────────
// 2026 regular season. Early April, streaking hot, leading NL East.
// Single-page dashboard with Dashboard / Rotation / News views.

const BRAVES_NAVY = "#13274F";
const BRAVES_RED = "#CE1141";
const BRAVES_CREAM = "#EAAA00";   // tomahawk gold
const BRAVES_DARK = "#0d1b2a";
const BRAVES_CARD = "#162238";
const BRAVES_PANEL = "#1b2b47";

// MLB position → color
const POS_COLORS = {
  C:   "#9b59b6",
  "1B": "#2ecc71",
  "2B": "#3498db",
  SS:  "#f1c40f",
  "3B": "#e67e22",
  LF:  "#1abc9c",
  CF:  "#16a085",
  RF:  "#27ae60",
  DH:  "#e74c3c",
  UT:  "#95a5a6",
  SP:  "#c0392b",
  RP:  "#d35400",
  CP:  "#e74c3c",
};

// MLB status taxonomy: active | day-to-day | questionable | il-10 | il-15 | il-60 | suspended | departed
function statusUIConfig(status) {
  switch (status) {
    case "active":       return { borderColor: BRAVES_RED, icon: null, iconBg: null };
    case "day-to-day":   return { borderColor: "#ffc107", icon: "~", iconBg: "#ffc107" };
    case "questionable": return { borderColor: "#ffc107", icon: "?", iconBg: "#ffc107" };
    case "il-10":        return { borderColor: "#fd7e14", icon: "+", iconBg: "#fd7e14" };
    case "il-15":        return { borderColor: "#fd7e14", icon: "+", iconBg: "#fd7e14" };
    case "il-60":        return { borderColor: "#dc3545", icon: "+", iconBg: "#dc3545" };
    case "suspended":    return { borderColor: "#6c757d", icon: "!", iconBg: "#6c757d" };
    case "departed":     return { borderColor: "#495057", icon: "x", iconBg: "#495057" };
    default:             return { borderColor: BRAVES_RED, icon: null, iconBg: null };
  }
}

// ─── PlayerAvatar ───────────────────────────────────────────────────────────
function PlayerAvatar({ player, size = 56 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const accent = POS_COLORS[player.position] || "#888";
  const initials = player.name.split(" ").map((w) => w[0]).join("").slice(0, 2);
  const ui = statusUIConfig(player.status);
  return (
    <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
      <div style={{
        width: size, height: size, borderRadius: "50%", overflow: "hidden",
        border: `3px solid ${ui.borderColor}`, background: "#2a2a3a",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {player.image && !imgFailed ? (
          <img
            src={player.image} alt={player.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(135deg, ${accent}55, ${BRAVES_RED}88)`,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 1,
          }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: size * 0.3, lineHeight: 1 }}>{initials}</span>
            <span style={{ color: "#ffffffaa", fontWeight: 700, fontSize: size * 0.17 }}>#{player.number}</span>
          </div>
        )}
      </div>
      {ui.icon && (
        <div style={{
          position: "absolute", bottom: -1, right: -1,
          width: size * 0.32, height: size * 0.32, borderRadius: "50%",
          background: ui.iconBg, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: size * 0.2, fontWeight: 900, color: "#fff",
          border: `2px solid ${BRAVES_CARD}`, lineHeight: 1,
        }}>
          {ui.icon}
        </div>
      )}
    </div>
  );
}

function PositionTag({ position }) {
  return (
    <span style={{
      background: POS_COLORS[position] || "#888", color: "#fff", fontSize: 10,
      padding: "2px 8px", borderRadius: 10, fontWeight: 700, letterSpacing: 1,
    }}>
      {position}
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === "active") return null;
  const cfg = {
    "day-to-day":  { bg: "#ffc10722", border: "#ffc107", color: "#ffe066", label: "DAY-TO-DAY" },
    questionable:  { bg: "#ffc10722", border: "#ffc107", color: "#ffe066", label: "QUESTIONABLE" },
    "il-10":       { bg: "#fd7e1422", border: "#fd7e14", color: "#ffa94d", label: "IL-10" },
    "il-15":       { bg: "#fd7e1422", border: "#fd7e14", color: "#ffa94d", label: "IL-15" },
    "il-60":       { bg: "#dc354522", border: "#dc3545", color: "#ff6b6b", label: "IL-60" },
    suspended:     { bg: "#6c757d22", border: "#6c757d", color: "#adb5bd", label: "SUSPENDED" },
    departed:      { bg: "#49505722", border: "#495057", color: "#888",   label: "DEPARTED" },
  };
  const c = cfg[status] || cfg["il-60"];
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      fontSize: 9, padding: "2px 8px", borderRadius: 10, fontWeight: 700, letterSpacing: 1.2,
    }}>
      {c.label}
    </span>
  );
}

// ─── Team Header (top banner) ───────────────────────────────────────────────
function TeamHeader({ view, setView }) {
  const leader = NL_EAST_STANDINGS[0];
  const views = [
    { key: "dashboard", label: "Dashboard" },
    { key: "rotation", label: "Rotation" },
    { key: "news", label: "News" },
  ];
  return (
    <div style={{
      background: `linear-gradient(135deg, ${BRAVES_NAVY} 0%, #0a1530 100%)`,
      padding: "18px 24px", borderBottom: `3px solid ${BRAVES_RED}`,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <img src={TEAM_LOGOS.ATL} alt="Braves" style={{ width: 54, height: 54 }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>
            Atlanta Braves
          </div>
          <div style={{ fontSize: 12, color: "#aec4e0", marginTop: 2, fontWeight: 600 }}>
            2026 Regular Season · {leader.w}-{leader.l} · NL East leaders
          </div>
        </div>
        <div style={{
          background: `${BRAVES_RED}22`, border: `1px solid ${BRAVES_RED}55`,
          padding: "6px 14px", borderRadius: 20,
          fontSize: 11, fontWeight: 700, color: BRAVES_CREAM, letterSpacing: 1,
        }}>
          W-STREAK {leader.streak}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2,
              background: view === v.key ? BRAVES_RED : "#ffffff10",
              color: view === v.key ? "#fff" : "#aec4e0",
              transition: "all 0.2s",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── NextGameCard ───────────────────────────────────────────────────────────
function NextGameCard() {
  if (!NEXT_GAME) return null;
  const oppLogo = TEAM_LOGOS[NEXT_GAME.opp];
  const homeAwayLabel = NEXT_GAME.home ? "vs" : "@";
  return (
    <div style={{
      background: `linear-gradient(135deg, ${BRAVES_RED} 0%, #8a0f2a 100%)`,
      borderRadius: 16, padding: "20px 22px", marginBottom: 16,
      boxShadow: "0 8px 32px #0006",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10, color: "#ffffffaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>
            Next Game
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginTop: 4, letterSpacing: -0.5 }}>
            {homeAwayLabel} {NEXT_GAME.opp}
          </div>
          <div style={{ fontSize: 13, color: "#ffffffcc", marginTop: 4 }}>
            {NEXT_GAME.date} · {NEXT_GAME.time}
          </div>
          <div style={{ fontSize: 11, color: "#ffffff99", marginTop: 2 }}>
            {NEXT_GAME.venue} · {NEXT_GAME.tv}
          </div>
        </div>
        {oppLogo && (
          <img src={oppLogo} alt={NEXT_GAME.opp}
               style={{ width: 72, height: 72, background: "#ffffff15", borderRadius: 12, padding: 6 }} />
        )}
      </div>

      {NEXT_GAME.probables && (
        <div style={{
          marginTop: 16, background: "#00000033",
          borderRadius: 10, padding: "10px 14px",
          display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center",
        }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{NEXT_GAME.probables.atl.pitcher}</div>
            <div style={{ color: "#ffffffaa", fontSize: 11, marginTop: 2 }}>
              ATL · {NEXT_GAME.probables.atl.record} · {NEXT_GAME.probables.atl.era} ERA
            </div>
          </div>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "#ffffff22", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 10, fontWeight: 800,
          }}>VS</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{NEXT_GAME.probables.opp.pitcher}</div>
            <div style={{ color: "#ffffffaa", fontSize: 11, marginTop: 2 }}>
              {NEXT_GAME.opp} · {NEXT_GAME.probables.opp.record} · {NEXT_GAME.probables.opp.era} ERA
            </div>
          </div>
        </div>
      )}

      {NEXT_GAME.note && (
        <div style={{
          marginTop: 12, padding: "8px 12px", background: "#00000022",
          borderRadius: 8, fontSize: 12, color: "#ffffffcc", lineHeight: 1.5,
        }}>
          {NEXT_GAME.note}
        </div>
      )}
    </div>
  );
}

// ─── RecentResultsStrip ─────────────────────────────────────────────────────
function RecentResultsStrip() {
  return (
    <div style={{
      background: BRAVES_CARD, borderRadius: 14, padding: "14px 18px", marginBottom: 16,
      border: `1px solid ${BRAVES_NAVY}55`,
    }}>
      <div style={{ fontSize: 11, color: BRAVES_CREAM, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
        Recent Games
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {RESULTS.map((g, i) => {
          const isWin = g.result === "W";
          return (
            <div key={i} style={{
              flex: "0 0 auto", minWidth: 140,
              background: BRAVES_PANEL, borderRadius: 10,
              padding: "10px 12px",
              borderLeft: `3px solid ${isWin ? "#28a745" : "#dc3545"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#aec4e0", fontWeight: 700 }}>
                  {g.home ? "vs" : "@"} {g.opp}
                </span>
                <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 800,
                  background: isWin ? "#28a74533" : "#dc354533",
                  color: isWin ? "#28a745" : "#dc3545",
                  letterSpacing: 1,
                }}>
                  {g.result} {g.atlScore}-{g.oppScore}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "#7f95b5", fontWeight: 600 }}>{g.date}</div>
              {g.note && (
                <div style={{ fontSize: 11, color: "#ccc", marginTop: 4, lineHeight: 1.4 }}>
                  {g.note}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Standings Table ────────────────────────────────────────────────────────
function StandingsCard() {
  return (
    <div style={{
      background: BRAVES_CARD, borderRadius: 14, padding: "14px 18px", marginBottom: 16,
      border: `1px solid ${BRAVES_NAVY}55`,
    }}>
      <div style={{ fontSize: 11, color: BRAVES_CREAM, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
        NL East Standings
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 48px 48px 64px 56px 56px",
          fontSize: 9, color: "#7f95b5", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
          padding: "4px 8px",
        }}>
          <span>Team</span>
          <span style={{ textAlign: "right" }}>W</span>
          <span style={{ textAlign: "right" }}>L</span>
          <span style={{ textAlign: "right" }}>PCT</span>
          <span style={{ textAlign: "right" }}>GB</span>
          <span style={{ textAlign: "right" }}>STRK</span>
        </div>
        {NL_EAST_STANDINGS.map((t) => {
          const isBraves = t.team === "ATL";
          return (
            <div key={t.team} style={{
              display: "grid", gridTemplateColumns: "1fr 48px 48px 64px 56px 56px", gap: 0,
              padding: "8px 8px", borderRadius: 6,
              background: isBraves ? `${BRAVES_RED}18` : "transparent",
              borderLeft: isBraves ? `3px solid ${BRAVES_RED}` : "3px solid transparent",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={TEAM_LOGOS[t.team]} alt="" style={{ width: 22, height: 22 }} />
                <span style={{ color: "#fff", fontWeight: isBraves ? 800 : 600, fontSize: 12 }}>
                  {t.name}
                </span>
              </div>
              <span style={{ color: "#fff", textAlign: "right", fontWeight: 700, fontSize: 12 }}>{t.w}</span>
              <span style={{ color: "#aec4e0", textAlign: "right", fontWeight: 600, fontSize: 12 }}>{t.l}</span>
              <span style={{ color: "#fff", textAlign: "right", fontSize: 12 }}>{t.pct.toFixed(3)}</span>
              <span style={{ color: "#aec4e0", textAlign: "right", fontSize: 12 }}>{t.gb === 0 ? "—" : t.gb}</span>
              <span style={{
                textAlign: "right", fontSize: 11, fontWeight: 700,
                color: t.streak.startsWith("W") ? "#28a745" : "#dc3545",
              }}>
                {t.streak}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Player Card (compact) ──────────────────────────────────────────────────
function PlayerCard({ player, expanded, onToggle }) {
  const [activeTab, setActiveTab] = useState("stats");
  useEffect(() => { if (!expanded) setActiveTab("stats"); }, [expanded]);

  const formColor = player.form >= 8.0 ? "#28a745"
    : player.form >= 7.5 ? "#5cb85c"
    : player.form >= 7.0 ? "#ffc107"
    : player.form >= 6.5 ? "#fd7e14"
    : "#dc3545";

  const isAvailable = player.status === "active" || player.status === "day-to-day" || player.status === "questionable";
  const isPitcher = player.positionGroup === "pitcher";

  // Build the compact 4-up stat strip depending on role
  const statStrip = useMemo(() => {
    if (!player.stats) return [];
    if (isPitcher) {
      return [
        { label: "ERA",  value: player.stats.era != null ? player.stats.era.toFixed(2) : "—" },
        { label: "WHIP", value: player.stats.whip != null ? player.stats.whip.toFixed(2) : "—" },
        { label: "IP",   value: player.stats.ip != null ? player.stats.ip : "—" },
        { label: "K",    value: player.stats.k ?? "—" },
      ];
    }
    return [
      { label: "AVG", value: player.stats.avg != null ? player.stats.avg.toFixed(3).replace(/^0/, "") : "—" },
      { label: "HR",  value: player.stats.hr ?? "—" },
      { label: "RBI", value: player.stats.rbi ?? "—" },
      { label: "G",   value: player.stats.games ?? "—" },
    ];
  }, [player, isPitcher]);

  return (
    <div
      onClick={onToggle}
      style={{
        background: expanded ? `linear-gradient(135deg, ${BRAVES_CARD}, ${BRAVES_NAVY})` : BRAVES_CARD,
        borderRadius: 14, cursor: "pointer",
        border: expanded ? `2px solid ${BRAVES_RED}` : `2px solid ${BRAVES_NAVY}55`,
        transition: "all 0.3s ease", overflow: "hidden",
        boxShadow: expanded ? `0 8px 32px ${BRAVES_RED}22` : "0 2px 12px #0004",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 8px" }}>
        <PlayerAvatar player={player} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: BRAVES_RED, fontWeight: 800, fontSize: 11 }}>#{player.number}</span>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {player.name}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
            <PositionTag position={player.position} />
            <StatusBadge status={player.status} />
            {player.bullpenRole === "closer" && (
              <span style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 4, letterSpacing: 0.5,
                color: BRAVES_CREAM, background: `${BRAVES_CREAM}22`, fontWeight: 800,
              }}>CL</span>
            )}
            {player.assignment === "aaa" && (
              <span style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 4, letterSpacing: 0.8,
                color: "#b8d4ff", background: "#3b82f622",
                border: "1px solid #3b82f655", fontWeight: 800,
              }}>AAA</span>
            )}
            {player.assignment === "rehab" && (
              <span style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 4, letterSpacing: 0.8,
                color: "#ffd166", background: "#f59e0b22",
                border: "1px solid #f59e0b55", fontWeight: 800,
              }}>REHAB @ AAA</span>
            )}
          </div>
        </div>
        {isAvailable && player.form > 0 ? (
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: formColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0,
            boxShadow: `0 0 8px ${formColor}55`,
          }}>
            {player.form.toFixed(1)}
          </div>
        ) : (
          <div style={{
            fontSize: 9, color: "#ff6b6b", fontWeight: 700, textAlign: "center",
            background: "#dc354515", padding: "4px 8px", borderRadius: 6,
            border: "1px solid #dc354533", lineHeight: 1.2, flexShrink: 0,
          }}>
            {player.status === "il-60" ? "IL-60" : player.status === "suspended" ? "SUSP" : "OUT"}
          </div>
        )}
      </div>

      {/* Injury / note banner */}
      {player.injuryNote && (
        <div style={{
          margin: "0 14px 6px", padding: "5px 8px", borderRadius: 6,
          background: player.status.startsWith("il") ? "#dc354512" : "#ffc10712",
          border: `1px solid ${player.status.startsWith("il") ? "#dc354533" : "#ffc10733"}`,
          fontSize: 10,
          color: player.status.startsWith("il") ? "#ff6b6b" : "#ffe066",
          lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {player.injuryNote}
        </div>
      )}

      {/* Stat strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        padding: "6px 14px 10px",
        borderTop: "1px solid #ffffff0a", marginTop: "auto",
      }}>
        {statStrip.map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{s.value}</div>
            <div style={{ color: "#7f95b5", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: "6px 18px 18px", borderTop: "1px solid #ffffff08" }}>
          {player.statNote && (
            <div style={{
              background: "#ffffff08", borderRadius: 8, padding: "10px 12px",
              fontSize: 12, color: "#cfd8e3", lineHeight: 1.5, marginBottom: 12,
            }}>
              {player.statNote}
            </div>
          )}

          <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#ffffff08", borderRadius: 8, padding: 3 }}>
            {[
              { key: "stats", label: "Stats" },
              { key: "bio", label: "Bio" },
              { key: "career", label: "Career" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={(e) => { e.stopPropagation(); setActiveTab(t.key); }}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 6, border: "none", cursor: "pointer",
                  fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1,
                  background: activeTab === t.key ? BRAVES_RED : "transparent",
                  color: activeTab === t.key ? "#fff" : "#7f95b5",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "stats" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }}>
              {Object.entries(player.stats || {})
                .filter(([, v]) => v != null)
                .map(([k, v]) => (
                  <div key={k} style={{
                    background: "#0c1729", borderRadius: 8,
                    padding: "8px 10px", textAlign: "center",
                  }}>
                    <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>
                      {typeof v === "number" && !Number.isInteger(v) ? v.toFixed(v < 10 ? 2 : 0) : v}
                    </div>
                    <div style={{ color: "#7f95b5", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
                      {k}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {activeTab === "bio" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
              <BioBox label="Age" value={player.age} />
              <BioBox label="Bats / Throws" value={`${player.bats ?? "?"} / ${player.throws ?? "?"}`} />
              <BioBox label="Origin" value={player.nationality || "—"} />
              <BioBox label="MLB Yrs" value={player.experience ?? "—"} />
              {player.contract && (
                <BioBox
                  label="Contract"
                  value={`${player.contract.years}y · $${(player.contract.total/1_000_000).toFixed(1)}M`}
                />
              )}
            </div>
          )}

          {activeTab === "career" && player.career && (
            <div style={{ paddingLeft: 16, position: "relative" }}>
              <div style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 2, background: "#2a3a54" }} />
              {[...player.career].reverse().map((entry, i) => {
                const isCurrent = entry.years.endsWith("–");
                return (
                  <div key={i} style={{ position: "relative", marginBottom: 12 }}>
                    <div style={{
                      position: "absolute", left: -15, top: 4,
                      width: 10, height: 10, borderRadius: "50%",
                      background: isCurrent ? BRAVES_RED : "#2a3a54",
                      border: `2px solid ${isCurrent ? BRAVES_RED : "#2a3a54"}`,
                      boxShadow: isCurrent ? `0 0 8px ${BRAVES_RED}66` : "none",
                    }} />
                    <div style={{ color: isCurrent ? BRAVES_RED : "#fff", fontWeight: 700, fontSize: 12 }}>
                      {entry.team}
                    </div>
                    <div style={{ fontSize: 10, color: "#7f95b5", marginTop: 2 }}>
                      {entry.years} · {entry.type}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BioBox({ label, value }) {
  return (
    <div style={{
      background: "#0c1729", borderRadius: 8, padding: "10px 12px", textAlign: "center",
    }}>
      <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{value}</div>
      <div style={{ color: "#7f95b5", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

// ─── UpcomingScheduleCard (rotation map · probable pitchers · next 5 games) ─
function UpcomingScheduleCard({ schedule }) {
  if (!schedule || !schedule.length) return null;
  const fmtRecord = (sp) => {
    const parts = [];
    if (sp.record) parts.push(sp.record);
    if (sp.era != null) parts.push(`${sp.era.toFixed(2)} ERA`);
    return parts.join(" · ");
  };
  return (
    <div style={{
      background: BRAVES_CARD, borderRadius: 14, padding: "14px 18px", marginBottom: 16,
      border: `1px solid ${BRAVES_NAVY}55`,
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 4, gap: 12, flexWrap: "wrap",
      }}>
        <div style={{
          fontSize: 11, color: BRAVES_CREAM, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 1.5,
        }}>
          Probable Pitchers · Next {schedule.length} Games
        </div>
        <div style={{ fontSize: 10, color: "#7f95b5", display: "flex", gap: 12 }}>
          <span><span style={{ color: BRAVES_CREAM }}>■</span> home</span>
          <span><span style={{ color: BRAVES_RED }}>■</span> road</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#8ea4c2", marginBottom: 10, lineHeight: 1.4 }}>
        Rotation map for the next turn through the staff. Updated daily by the tracker skill.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {schedule.map((g) => {
          const oppLogo = TEAM_LOGOS[g.opp];
          const accentColor = g.home ? BRAVES_CREAM : BRAVES_RED;
          const atlLine = fmtRecord(g.atlSP);
          const oppLine = fmtRecord(g.oppSP);
          return (
            <div key={g.date} style={{
              display: "grid",
              gridTemplateColumns: "70px auto 1fr auto",
              gap: 12, alignItems: "center",
              padding: "10px 12px",
              background: BRAVES_PANEL,
              borderLeft: `4px solid ${accentColor}`,
              borderRadius: 6,
            }}>
              {/* date column */}
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#cfd8e3" }}>
                <div style={{ fontSize: 10, color: "#8ea4c2", textTransform: "uppercase", letterSpacing: 1 }}>{g.weekday}</div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{g.date.slice(5).replace("-", "/")}</div>
                <div style={{ fontSize: 9, color: "#8ea4c2", marginTop: 1 }}>{g.time}</div>
              </div>

              {/* opp logo + label */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {oppLogo && (
                  <img src={oppLogo} alt={g.opp} style={{
                    width: 36, height: 36, background: "#ffffff10",
                    borderRadius: 8, padding: 4,
                  }} />
                )}
                <div>
                  <div style={{ fontSize: 10, color: "#8ea4c2", textTransform: "uppercase", letterSpacing: 1 }}>{g.home ? "vs" : "@"}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{g.opp}</div>
                </div>
              </div>

              {/* matchup */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, lineHeight: 1.4 }}>
                  <span style={{ color: BRAVES_CREAM }}>
                    {g.atlSP.name}
                    {g.atlSP.hand && (
                      <span style={{
                        color: "#8ea4c2", fontSize: 10, marginLeft: 4,
                        fontWeight: 700, padding: "1px 4px", background: "#ffffff10", borderRadius: 3,
                      }}>{g.atlSP.hand}HP</span>
                    )}
                  </span>
                  <span style={{ color: "#8ea4c2", margin: "0 6px", fontWeight: 400 }}>vs</span>
                  <span style={{ color: "#fff" }}>
                    {g.oppSP.name}
                    {g.oppSP.hand && (
                      <span style={{
                        color: "#8ea4c2", fontSize: 10, marginLeft: 4,
                        fontWeight: 700, padding: "1px 4px", background: "#ffffff10", borderRadius: 3,
                      }}>{g.oppSP.hand}HP</span>
                    )}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#8ea4c2", marginTop: 2 }}>
                  {atlLine && <span style={{ color: "#cfd8e3" }}>{atlLine}</span>}
                  {g.atlSP.daysRest != null && (
                    <span style={{ marginLeft: 8 }}>{g.atlSP.daysRest}d rest</span>
                  )}
                  {oppLine && (
                    <span style={{ marginLeft: 12, color: "#7f95b5" }}>opp: {oppLine}</span>
                  )}
                </div>
                {g.note && (
                  <div style={{ fontSize: 11, color: "#a8b8d0", marginTop: 4, lineHeight: 1.4 }}>
                    {g.note}
                  </div>
                )}
              </div>

              {/* venue */}
              <div style={{ fontSize: 10, color: "#7f95b5", textAlign: "right", whiteSpace: "nowrap" }}>
                {g.venue}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── LineupCard (tonight's batting order, 1-9) ──────────────────────────────
function LineupCard({ batters, opp, home, oppPitcherHand }) {
  if (!batters || !batters.length) return null;
  const fmtAvg = (avg) => avg == null ? null : avg.toFixed(3).replace(/^0\./, ".");
  return (
    <div style={{
      background: BRAVES_CARD, borderRadius: 14, padding: "14px 18px", marginBottom: 16,
      border: `1px solid ${BRAVES_NAVY}55`,
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 10, gap: 12, flexWrap: "wrap",
      }}>
        <div style={{
          fontSize: 11, color: BRAVES_CREAM, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 1.5,
        }}>
          Tonight's Lineup
        </div>
        <div style={{ fontSize: 11, color: "#8ea4c2" }}>
          {opp && <>{home ? "vs" : "@"} {opp}</>}
          {oppPitcherHand && (
            <span style={{ marginLeft: 8, color: "#7f95b5" }}>
              vs {oppPitcherHand}HP
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {batters.map((p) => {
          const posColor = POS_COLORS[p.position] || "#888";
          const stats = p.stats || {};
          const avg = fmtAvg(stats.avg);
          const homers = stats.hr != null ? `${stats.hr} HR` : null;
          const rbi = stats.rbi != null ? `${stats.rbi} RBI` : null;
          const tail = [homers, rbi].filter(Boolean).join(" · ");
          const statLine = [avg, tail].filter(Boolean).join(" · ") || "—";
          return (
            <div key={p.id} style={{
              display: "grid",
              gridTemplateColumns: "28px 42px 1fr auto",
              alignItems: "center", gap: 10,
              padding: "8px 10px",
              background: BRAVES_PANEL,
              borderRadius: 6,
              borderLeft: `3px solid ${posColor}`,
            }}>
              <div style={{
                fontSize: 16, fontWeight: 900, color: BRAVES_CREAM,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", textAlign: "center",
              }}>{p.lineupSpot}</div>
              <div style={{
                fontSize: 11, fontWeight: 800, color: "#fff",
                background: posColor, padding: "3px 6px",
                borderRadius: 4, textAlign: "center", letterSpacing: 0.5,
              }}>{p.position}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: "#fff",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {p.name}
                  {p.bats && (
                    <span style={{
                      marginLeft: 8, fontSize: 9, color: "#8ea4c2", fontWeight: 700,
                      padding: "1px 4px", background: "#ffffff08", borderRadius: 3,
                    }}>
                      bats {p.bats}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#8ea4c2", marginTop: 1 }}>
                  {statLine}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#7f95b5", whiteSpace: "nowrap" }}>
                #{p.number}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RosterSection ──────────────────────────────────────────────────────────
function RosterSection({ title, subtitle, players, expandedId, setExpandedId }) {
  if (!players.length) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 12, color: BRAVES_CREAM, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 1.5, marginBottom: subtitle ? 4 : 10,
        borderBottom: subtitle ? "none" : `1px solid ${BRAVES_CREAM}33`,
        paddingBottom: subtitle ? 0 : 6,
      }}>
        {title} <span style={{ color: "#7f95b5", marginLeft: 6, fontWeight: 600 }}>({players.length})</span>
      </div>
      {subtitle && (
        <div style={{
          fontSize: 11, color: "#8ea4c2", marginBottom: 10, lineHeight: 1.4,
          borderBottom: `1px solid ${BRAVES_CREAM}33`, paddingBottom: 8,
        }}>
          {subtitle}
        </div>
      )}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 10,
      }}>
        {players.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            expanded={expandedId === p.id}
            onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── News Digest ────────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  injuries:  "#fd7e14",
  games:     "#3498db",
  roster:    "#2ecc71",
  contracts: BRAVES_CREAM,
  offense:   "#9b59b6",
  standings: BRAVES_RED,
  general:   "#7f95b5",
};

function NewsDigestSection() {
  if (!NEWS_DIGEST) return null;
  const timeAgoStr = (() => {
    const diff = Date.now() - new Date(NEWS_DIGEST.generatedAt).getTime();
    const mins = Math.max(1, Math.floor(diff / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  })();
  return (
    <div style={{
      background: `linear-gradient(135deg, ${BRAVES_CARD}, ${BRAVES_NAVY})`,
      borderRadius: 14, padding: 20, marginBottom: 16,
      border: `1px solid ${BRAVES_RED}33`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: BRAVES_CREAM, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>
          AI News Digest
        </span>
        <span style={{
          fontSize: 9, color: "#7f95b5", background: "#0c1729",
          padding: "3px 8px", borderRadius: 6, fontWeight: 600,
        }}>
          Powered by Claude
        </span>
        <span style={{ fontSize: 10, color: "#556a8c", marginLeft: "auto" }}>
          Updated {timeAgoStr}
        </span>
      </div>

      <p style={{ fontSize: 14, color: "#cfd8e3", lineHeight: 1.7, margin: "0 0 16px 0" }}>
        {NEWS_DIGEST.summary}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {NEWS_DIGEST.keyTopics.map((topic, i) => (
          <div key={i} style={{
            background: "#0c1729", borderRadius: 10, padding: 14,
            borderLeft: `3px solid ${CATEGORY_COLORS[topic.category] || "#888"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, flex: 1, minWidth: 0 }}>
                {topic.title}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                color: CATEGORY_COLORS[topic.category] || "#888",
                background: `${CATEGORY_COLORS[topic.category] || "#888"}22`,
                padding: "2px 7px", borderRadius: 4, letterSpacing: 0.5,
              }}>
                {topic.category}
              </span>
            </div>
            <div style={{ color: "#aec4e0", fontSize: 12, lineHeight: 1.5 }}>
              {topic.detail}
            </div>
          </div>
        ))}
      </div>

      {NEWS_DIGEST.sources?.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 10, color: "#556a8c" }}>
          Sources: {NEWS_DIGEST.sources.join(" · ")}
        </div>
      )}
    </div>
  );
}

// ─── Live RSS News Feed ─────────────────────────────────────────────────────
function LiveRSSFeed() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    async function load() {
      setLoading(true);
      const all = [];
      for (const feed of RSS_FEEDS) {
        try {
          let parsedItems = [];
          if (isDev) {
            const resp = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);
            const xml = await resp.text();
            const doc = new DOMParser().parseFromString(xml, "application/xml");
            const nodes = doc.querySelectorAll("item, entry");
            nodes.forEach((n) => {
              const title = n.querySelector("title")?.textContent ?? "";
              const linkEl = n.querySelector("link");
              const link = linkEl?.getAttribute("href") ?? linkEl?.textContent ?? "";
              const pub = n.querySelector("pubDate, updated, published")?.textContent ?? "";
              parsedItems.push({ title, link, pub, source: feed.name, category: feed.category });
            });
          } else {
            const resp = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`);
            const json = await resp.json();
            (json.items || []).slice(0, 5).forEach((it) => {
              parsedItems.push({
                title: it.title, link: it.link, pub: it.pubDate,
                source: feed.name, category: feed.category,
              });
            });
          }
          all.push(...parsedItems.slice(0, 5));
        } catch (e) {
          // silent skip per-feed — showing partial results beats showing nothing
        }
      }
      if (cancelled) return;
      // sort by pubDate desc
      all.sort((a, b) => new Date(b.pub).getTime() - new Date(a.pub).getTime());
      setItems(all.slice(0, 24));
      setLoading(false);
    }
    load().catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{
      background: BRAVES_CARD, borderRadius: 14, padding: 20, marginBottom: 16,
      border: `1px solid ${BRAVES_NAVY}55`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: BRAVES_CREAM, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>
          Live News Feed
        </span>
        {loading && <span style={{ fontSize: 10, color: "#7f95b5" }}>Loading…</span>}
      </div>

      {error && (
        <div style={{ color: "#ff6b6b", fontSize: 12 }}>Failed to load feeds: {error}</div>
      )}

      {!loading && items.length === 0 && !error && (
        <div style={{ color: "#7f95b5", fontSize: 12 }}>No recent items returned.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it, i) => (
          <a key={i} href={it.link} target="_blank" rel="noreferrer" style={{
            display: "block", background: "#0c1729", borderRadius: 10, padding: "10px 14px",
            textDecoration: "none", color: "#fff", borderLeft: `3px solid ${BRAVES_RED}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{it.title}</div>
            <div style={{ fontSize: 10, color: "#7f95b5", marginTop: 4 }}>
              {it.source}{it.pub && ` · ${new Date(it.pub).toLocaleDateString()}`}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Views ──────────────────────────────────────────────────────────────────
//
// Assignment model:
//   "mlb"   → on the active roster with the big club (shown in Lineup/Rotation/Bullpen)
//   "aaa"   → healthy depth stashed at Triple-A Gwinnett (shown in Triple-A Depth)
//   "rehab" → on IL + currently on a minor-league rehab assignment (shown in IL with REHAB badge)
//
function DashboardView({ expandedId, setExpandedId }) {
  const lineupBatters = PLAYERS
    .filter((p) =>
      p.positionGroup === "batter" &&
      p.lineupSpot != null &&
      !p.status.startsWith("il") &&
      p.status !== "departed" &&
      p.assignment !== "aaa" && p.assignment !== "aa"
    )
    .sort((a, b) => a.lineupSpot - b.lineupSpot);
  const lineup = PLAYERS
    .filter((p) =>
      p.positionGroup === "batter" &&
      !p.status.startsWith("il") &&
      p.status !== "departed" &&
      p.assignment !== "aaa" && p.assignment !== "aa"
    )
    .sort((a, b) => (a.lineupSpot ?? 99) - (b.lineupSpot ?? 99));
  const rotation = PLAYERS
    .filter((p) =>
      p.position === "SP" &&
      !p.status.startsWith("il") &&
      p.assignment !== "aaa" && p.assignment !== "aa"
    )
    .sort((a, b) => (a.rotationSpot ?? 99) - (b.rotationSpot ?? 99));
  const bullpen = PLAYERS.filter((p) =>
    (p.position === "RP" || p.position === "CP") &&
    !p.status.startsWith("il") &&
    p.assignment !== "aaa" && p.assignment !== "aa"
  );
  const aaaDepth = PLAYERS.filter((p) =>
    (p.assignment === "aaa" || p.assignment === "aa") && p.status !== "departed"
  );
  const il = PLAYERS.filter((p) => p.status.startsWith("il"));

  return (
    <div>
      <NextGameCard />
      <LineupCard
        batters={lineupBatters}
        opp={NEXT_GAME?.opp}
        home={NEXT_GAME?.home}
        oppPitcherHand={UPCOMING_SCHEDULE?.[0]?.oppSP?.hand}
      />
      <UpcomingScheduleCard schedule={UPCOMING_SCHEDULE} />
      <StandingsCard />
      <RecentResultsStrip />
      <NewsDigestSection />
      <RosterSection title="Position Players · Roster Detail" players={lineup} expandedId={expandedId} setExpandedId={setExpandedId} />
      <RosterSection title="Starting Rotation" players={rotation} expandedId={expandedId} setExpandedId={setExpandedId} />
      <RosterSection title="Bullpen" players={bullpen} expandedId={expandedId} setExpandedId={setExpandedId} />
      {aaaDepth.length > 0 && (
        <RosterSection
          title="Triple-A Depth · Gwinnett"
          subtitle="Healthy 40-man depth optioned to Triple-A. First recall candidates in an emergency."
          players={aaaDepth}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
        />
      )}
      <RosterSection title="Injured List" players={il} expandedId={expandedId} setExpandedId={setExpandedId} />
    </div>
  );
}

function RotationView({ expandedId, setExpandedId }) {
  const rotation = PLAYERS
    .filter((p) => p.position === "SP" && p.assignment !== "aaa" && p.assignment !== "aa")
    .sort((a, b) => {
      const ra = a.rotationSpot ?? 99;
      const rb = b.rotationSpot ?? 99;
      if (ra !== rb) return ra - rb;
      return a.status.localeCompare(b.status);
    });
  const bullpen = PLAYERS.filter((p) =>
    (p.position === "RP" || p.position === "CP") && p.assignment !== "aaa" && p.assignment !== "aa"
  );
  const aaaPitchers = PLAYERS.filter((p) =>
    p.positionGroup === "pitcher" &&
    (p.assignment === "aaa" || p.assignment === "aa") &&
    p.status !== "departed"
  );

  return (
    <div>
      <div style={{
        background: BRAVES_CARD, borderRadius: 14, padding: "14px 18px", marginBottom: 16,
        border: `1px solid ${BRAVES_NAVY}55`,
      }}>
        <div style={{ fontSize: 11, color: BRAVES_CREAM, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
          Pitching Staff · 2026
        </div>
        <div style={{ fontSize: 14, color: "#cfd8e3", lineHeight: 1.6 }}>
          Sale / Holmes / Elder anchor a top of the rotation that's been the steadiest in baseball through April.
          Reynaldo López was moved to the bullpen on Apr 27 to reset mechanical flaws — Pérez and Ritchie cover the back end while Spencer Strider lines up to debut at Coors Field this weekend.
          Robert Suarez closes while Iglesias (right shoulder inflammation) is eligible to return May 5.
        </div>
      </div>
      <UpcomingScheduleCard schedule={UPCOMING_SCHEDULE} />
      <RosterSection title="Rotation" players={rotation} expandedId={expandedId} setExpandedId={setExpandedId} />
      <RosterSection title="Bullpen" players={bullpen} expandedId={expandedId} setExpandedId={setExpandedId} />
      {aaaPitchers.length > 0 && (
        <RosterSection
          title="Triple-A Arms · Gwinnett"
          subtitle="Recall candidates — 40-man depth currently stashed at Triple-A."
          players={aaaPitchers}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
        />
      )}
    </div>
  );
}

function NewsView() {
  return (
    <div>
      <NewsDigestSection />
      <LiveRSSFeed />
    </div>
  );
}

// ─── ROOT ───────────────────────────────────────────────────────────────────
export default function BravesTracker() {
  const [view, setView] = useState("dashboard");
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div style={{
      background: BRAVES_DARK, minHeight: "100vh",
      color: "#fff", fontFamily: "'Inter', sans-serif",
    }}>
      <TeamHeader view={view} setView={setView} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 16px 60px" }}>
        {view === "dashboard" && <DashboardView expandedId={expandedId} setExpandedId={setExpandedId} />}
        {view === "rotation" && <RotationView expandedId={expandedId} setExpandedId={setExpandedId} />}
        {view === "news" && <NewsView />}
      </div>

      <footer style={{
        padding: "24px 16px", textAlign: "center",
        borderTop: `1px solid ${BRAVES_NAVY}55`,
        color: "#556a8c", fontSize: 11,
      }}>
        Atlanta Braves Tracker · 2026 Season · Data refreshed daily via scheduled task · Sources: MLB.com, ESPN, Battery Power, AJC
      </footer>
    </div>
  );
}
