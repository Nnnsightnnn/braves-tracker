import { useState, useMemo, useEffect } from "react";
import {
  PLAYERS,
  NEXT_GAME,
  RESULTS,
  NEWS_DIGEST,
  NL_EAST_STANDINGS,
  UPCOMING_SCHEDULE,
} from "./playerData.js";

// ─── Atlanta & Baseball Tracker — Heritage Scorebook ────────────────────
// 2026 regular season tracker, redesigned as a cream-paper / navy-ink
// newspaper scorebook. All visual rules live in src/styles.css; the
// component tree below derives view-models from playerData.js.

const initials = (name) =>
  (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const fmt = {
  avg: (v) => (v == null ? "—" : v.toFixed(3).replace(/^0/, "")),
  era: (v) => (v == null ? "—" : v.toFixed(2)),
  whip: (v) => (v == null ? "—" : v.toFixed(2)),
  num: (v) => (v == null ? "—" : String(v)),
  ip: (v) => (v == null ? "—" : Number.isInteger(v) ? `${v}.0` : v.toFixed(1)),
  pct: (v) => (v == null ? "—" : v.toFixed(3).replace(/^0/, "")),
  gb: (v) => (v === 0 ? "—" : String(v)),
};

// "2026-05-02" → "May 02"
function fmtScheduleDate(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}
// "2026-04-30" → "Apr 30"
const fmtResultDate = fmtScheduleDate;

// "8:40 PM ET" → "8:40p" (compact ticket form)
function compactTime(t) {
  if (!t) return "";
  return t.replace(/\s*PM\s*ET/i, "p")
          .replace(/\s*AM\s*ET/i, "a")
          .replace(/\s*PM/i, "p")
          .replace(/\s*AM/i, "a");
}

// Today's nameplate date — derived from NEWS_DIGEST.generatedAt so the
// header always reflects the data refresh, not the visitor's wall clock.
function nameplateToday() {
  const d = NEWS_DIGEST?.generatedAt ? new Date(NEWS_DIGEST.generatedAt) : new Date();
  const wk = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const yr = d.getFullYear();
  return `${wk} · ${md.toUpperCase()}, ${yr}`;
}

function Nameplate() {
  return (
    <header>
      <div className="nameplate">
        <div className="vol">
          <span>VOL. CXXVI · No. 32</span>
          <span>2026 SEASON</span>
          <span>EST. 1871</span>
        </div>
        <div className="title-block">
          <h1>Atlanta <span className="ampersand">&amp;</span> Baseball Tracker</h1>
          <div className="tagline">— A heritage scorebook for the modern season —</div>
        </div>
        <div className="meta">
          <div><strong>{nameplateToday()}</strong></div>
          <div>Truist Park · Cobb County</div>
          <div className="price">FIVE CENTS</div>
        </div>
      </div>
      <div className="nameplate-rule" />
    </header>
  );
}

function Nav({ view, setView, tonightLabel }) {
  const items = [
    { key: "field",    label: "On the Field" },
    { key: "roster",   label: "Roster" },
    { key: "rotation", label: "Pitching Staff" },
    { key: "beat",     label: "Braves Beat" },
  ];
  return (
    <nav className="nav">
      {items.map((it) => (
        <button key={it.key} className={view === it.key ? "active" : ""} onClick={() => setView(it.key)}>
          {it.label}
        </button>
      ))}
      <div className="nav-spacer" />
      <div className="nav-meta">
        <span className="live-pill"><span className="dot" />{tonightLabel}</span>
      </div>
    </nav>
  );
}

function TicketStub() {
  // Prefer UPCOMING_SCHEDULE[0] — it carries handedness; fall back to NEXT_GAME.
  const sched = UPCOMING_SCHEDULE?.[0];
  const team = NL_EAST_STANDINGS.find((t) => t.team === "ATL");
  const oppName = sched?.opp || NEXT_GAME.opp;
  const oppLong = {
    COL: "Colorado", PHI: "Philadelphia", NYM: "New York", WSH: "Washington",
    MIA: "Miami", SEA: "Seattle", LAD: "Los Angeles", SD: "San Diego",
    NYY: "New York", HOU: "Houston", KC: "Kansas City", DET: "Detroit",
  }[oppName] || oppName;

  const venue = sched?.venue || NEXT_GAME.venue;
  const tv = NEXT_GAME.tv;
  const date = (() => {
    const d = new Date((sched?.date || NEXT_GAME.date) + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  })();
  const time = sched?.time || NEXT_GAME.time;

  const atlSP = sched?.atlSP || {
    name: NEXT_GAME.probables?.atl?.pitcher,
    record: NEXT_GAME.probables?.atl?.record,
    era: NEXT_GAME.probables?.atl?.era,
    hand: null,
  };
  const oppSP = sched?.oppSP || {
    name: NEXT_GAME.probables?.opp?.pitcher,
    record: NEXT_GAME.probables?.opp?.record,
    era: NEXT_GAME.probables?.opp?.era,
    hand: null,
  };

  const atlLine = [
    "ATL",
    atlSP.record,
    atlSP.era != null ? `${fmt.era(atlSP.era)} ERA` : null,
    atlSP.hand ? `${atlSP.hand}HP` : null,
  ].filter(Boolean).join(" · ");
  const oppLine = [
    oppName,
    oppSP.record,
    oppSP.era != null ? `${fmt.era(oppSP.era)} ERA` : null,
    oppSP.hand ? `${oppSP.hand}HP` : null,
  ].filter(Boolean).join(" · ");

  const stampTime = compactTime(time);

  return (
    <section className="ticket">
      {stampTime && (
        <div className="stamp">
          <span className="small">Tonight</span>
          {stampTime.replace(/[ap]$/, "")}
          <span style={{ fontSize: "14px", verticalAlign: "top" }}>★</span>
        </div>
      )}
      <div className="ticket-grid">
        <div className="ticket-side away">
          <div className="city">Visitors</div>
          <div className="team">Atlanta</div>
          <div className="record">
            {team.w} – {team.l} · {fmt.pct(team.pct)} · NL East ★ Leaders
          </div>
        </div>
        <div className="ticket-vs">{NEXT_GAME.home ? "vs." : "@"}</div>
        <div className="ticket-side home">
          <div className="city">{NEXT_GAME.home ? "Hosting" : `Hosts at ${venue.split(" · ")[0].split(" ")[0]}`}</div>
          <div className="team">{oppLong}</div>
          <div className="record">{venue}</div>
        </div>
        <div className="ticket-meta">
          <div className="row"><span className="k">Date</span><strong>{date}</strong></div>
          <div className="row"><span className="k">First pitch</span><strong>{time}</strong></div>
          {tv && <div className="row"><span className="k">Wire</span><strong>{tv}</strong></div>}
          <div className="row"><span className="k">Series</span><strong>1 of 3 · weekend</strong></div>
        </div>
      </div>

      <div className="probables">
        <div className="left">
          <div className="name">{atlSP.name || "TBA"}</div>
          <div className="line">{atlLine}</div>
        </div>
        <div className="vs">— probables —</div>
        <div className="right">
          <div className="name">{oppSP.name || "TBA"}</div>
          <div className="line">{oppLine}</div>
        </div>
      </div>

      <div className="ticket-note">{NEXT_GAME.note}</div>
    </section>
  );
}

function SectionHead({ label, meta }) {
  return (
    <div className="section-head">
      <div className="label">— {label} —</div>
      <div className="rule" />
      <div className="meta">{meta}</div>
    </div>
  );
}

function Standings() {
  const cityOnly = (full) =>
    full.replace(/\s+(Braves|Marlins|Nationals|Phillies|Mets|Yankees|Dodgers|Padres|Astros)$/i, "");
  return (
    <table className="boxscore">
      <caption>National League · Eastern Division · through April 30</caption>
      <thead>
        <tr><th>Club</th><th>W</th><th>L</th><th>Pct</th><th>GB</th><th>Strk</th></tr>
      </thead>
      <tbody>
        {NL_EAST_STANDINGS.map((t) => (
          <tr key={t.team} className={t.team === "ATL" ? "leader" : ""}>
            <td><span className="abbr">{t.team}</span>{cityOnly(t.name)}</td>
            <td>{t.w}</td>
            <td>{t.l}</td>
            <td>{fmt.pct(t.pct)}</td>
            <td>{fmt.gb(t.gb)}</td>
            <td>{t.streak}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RecentResults() {
  const recent = RESULTS.slice(0, 8);
  // Trim long incident notes so they fit a single line of newspaper italic.
  const trimNote = (n) => {
    if (!n) return "";
    const firstSentence = n.split(/(?<=\.)\s+/)[0];
    return firstSentence.length > 110 ? firstSentence.slice(0, 107) + "…" : firstSentence;
  };
  return (
    <ul className="results-line">
      {recent.map((g, i) => (
        <li key={i}>
          <span className="date">{fmtResultDate(g.date)}</span>
          <span className="opp">{g.home ? "vs" : "@"} {g.opp}</span>
          <span className="score">
            <span className={"res " + g.result}>{g.result}</span>
            {g.atlScore}–{g.oppScore}
          </span>
          <span className="note">{trimNote(g.note)}</span>
        </li>
      ))}
    </ul>
  );
}

function Schedule() {
  // Show the four games after tonight's opener (ticket stub already covers it).
  const upcoming = UPCOMING_SCHEDULE.slice(1, 5);
  return (
    <ul className="sched">
      {upcoming.map((g, i) => {
        const sp = g.atlSP || {};
        const line = [sp.record, sp.era != null ? `${fmt.era(sp.era)} ERA` : null]
          .filter(Boolean).join(", ");
        return (
          <li key={i}>
            <span className="when">
              <span className="day">{(g.weekday || "").toUpperCase()}</span>
              {fmtScheduleDate(g.date)}
            </span>
            <span className="matchup">
              <span className="opp">{g.home ? "vs" : "@"} {g.opp}</span>
              <span className="pitcher">
                {sp.name || "TBA"}
                {sp.hand ? ` (${sp.hand}HP)` : ""}
                {line ? ` · ${line}` : ""}
              </span>
              <span className="note">{g.note}</span>
            </span>
            <span className="time">
              {compactTime(g.time)}<br />{g.venue}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function LineupList({ batters, onSelect }) {
  return (
    <div className="lineup-list">
      {batters.map((p) => (
        <button
          type="button"
          className="row"
          key={p.id}
          onClick={() => onSelect && onSelect(p)}
          aria-label={`View ${p.name} details`}
        >
          <span className="spot">{p.lineupSpot}</span>
          <span className="pos">{p.position}</span>
          <span className="player">
            <span className="num">№ {p.number}</span>
            {p.name}
            <span className="bats">bats {p.bats}</span>
          </span>
          <span className="stat">
            <span className="v">{fmt.avg(p.stats.avg)}</span><span className="k">avg</span>
          </span>
          <span className="stat">
            <span className="v">{fmt.num(p.stats.hr)}</span><span className="k">hr</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Portrait({ player }) {
  const [failed, setFailed] = useState(false);
  if (player.image && !failed) {
    return (
      <div className="portrait">
        <img src={player.image} alt={player.name} onError={() => setFailed(true)} />
      </div>
    );
  }
  return <div className="portrait">{initials(player.name)}</div>;
}

function PlayerCard({ p, kind, leader, onSelect }) {
  // kind: 'batter' | 'pitcher' | 'reliever' | 'il'
  const stats = useMemo(() => {
    const s = p.stats || {};
    if (kind === "batter") {
      return [
        { k: "AVG", v: fmt.avg(s.avg) },
        { k: "HR",  v: fmt.num(s.hr) },
        { k: "RBI", v: fmt.num(s.rbi) },
        { k: "POS", v: p.position },
      ];
    }
    if (kind === "pitcher") {
      const wl = (s.w == null && s.l == null) ? "—" : `${s.w ?? "—"}–${s.l ?? "—"}`;
      return [
        { k: "ERA", v: fmt.era(s.era) },
        { k: "W–L", v: wl },
        { k: "K",   v: fmt.num(s.k) },
        { k: "WHIP",v: fmt.whip(s.whip) },
      ];
    }
    if (kind === "reliever") {
      const isCloser = p.bullpenRole === "closer";
      return [
        { k: "ERA", v: fmt.era(s.era) },
        { k: "IP",  v: fmt.ip(s.ip) },
        { k: "K",   v: fmt.num(s.k) },
        { k: isCloser ? "SV" : "HD", v: isCloser ? fmt.num(s.sv) : fmt.num(s.hold) },
      ];
    }
    // il
    const statusUpper = (p.status || "").toUpperCase();
    const tag = (p.injuryNote || "").toLowerCase().includes("rehab") ||
                (p.statNote || "").toLowerCase().includes("rehab") ? "REHAB" : "—";
    return [
      { k: "POS",   v: p.position },
      { k: "STATUS",v: statusUpper.replace("IL-", "IL · ") },
      { k: "TAG",   v: tag },
      { k: "№",     v: String(p.number) },
    ];
  }, [p, kind]);

  const roleLabel = {
    closer: "Closer",
    lhp: "Lefty Specialist",
    long: "Long Relief",
    middle: "Middle Relief",
  }[p.bullpenRole] || "Relief";

  const clickable = typeof onSelect === "function";
  return (
    <article
      className={"card" + (leader ? " leader-card" : "") + (clickable ? " clickable" : "")}
      onClick={clickable ? () => onSelect(p) : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p); } } : undefined}
      tabIndex={clickable ? 0 : undefined}
      role={clickable ? "button" : undefined}
      aria-label={clickable ? `View ${p.name} details` : undefined}
    >
      <div className="name-banner">
        <span>{p.name}</span>
        <span className="num">№ {p.number}</span>
      </div>
      <div className="frame">
        <Portrait player={p} />
        <div className="meta">
          <span className="pos-chip">
            <span>{p.position}</span>
            {(p.bats || p.throws) && <span className="bar" />}
            <span className="bats">
              {kind === "batter" && p.bats ? `B/${p.bats}` : null}
              {kind !== "batter" && p.throws ? `${p.throws}HP` : null}
              {kind === "reliever" ? ` · ${roleLabel}` : null}
            </span>
          </span>
          <span className="note">{p.statNote || p.injuryNote || ""}</span>
          {kind === "il" && (
            <span className="status-tag">
              {(p.status || "").toUpperCase().replace("IL-", "IL · ")}
              {(p.injuryNote || "").toLowerCase().includes("rehab") ||
               (p.statNote || "").toLowerCase().includes("rehab") ? " · REHAB" : ""}
            </span>
          )}
          {leader && <span className="status-tag">League leader · HR</span>}
        </div>
      </div>
      <div className="ledger">
        {stats.map((s) => (
          <div className="cell" key={s.k}>
            <span className="label">{s.k}</span>
            <span className="value">{s.v}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function FieldView({ batters, onSelect }) {
  const todayOppHand = UPCOMING_SCHEDULE?.[0]?.oppSP?.hand;
  const oppName = UPCOMING_SCHEDULE?.[0]?.oppSP?.name?.split(" ").slice(-1)[0] || "";
  return (
    <div className="view">
      <TicketStub />
      <div className="cols-2">
        <div>
          <SectionHead
            label="Tonight's Lineup"
            meta={todayOppHand ? `vs ${todayOppHand}HP ${oppName}` : "tonight"}
          />
          <LineupList batters={batters} onSelect={onSelect} />
          <SectionHead label="Recent Results" meta="last eight games" />
          <RecentResults />
        </div>
        <div>
          <SectionHead label="Standings" meta="NL East" />
          <Standings />
          <SectionHead label="Forthcoming" meta="next four" />
          <Schedule />
        </div>
      </div>
    </div>
  );
}

function RosterView({ batters, ilList, leaderId, onSelect }) {
  return (
    <div className="view">
      <SectionHead label="Position Players" meta="active roster · nine in the order" />
      <div className="cards">
        {batters.map((p) => (
          <PlayerCard key={p.id} p={p} kind="batter" leader={p.id === leaderId} onSelect={onSelect} />
        ))}
      </div>
      <SectionHead label="Injured List" meta={`${ilList.length} on the books`} />
      <div className="cards">
        {ilList.map((p) => (
          <PlayerCard key={p.id} p={p} kind="il" onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function RotationView({ rotation, bullpen, onSelect }) {
  return (
    <div className="view">
      <SectionHead label="Starting Rotation" meta="six-deep with Strider returning Sunday" />
      <div className="cards">
        {rotation.map((p) => <PlayerCard key={p.id} p={p} kind="pitcher" onSelect={onSelect} />)}
      </div>
      <SectionHead label="Bullpen" meta="Suarez closing while Iglesias rests" />
      <div className="cards">
        {bullpen.map((p) => <PlayerCard key={p.id} p={p} kind="reliever" onSelect={onSelect} />)}
      </div>
    </div>
  );
}

// ─── Player Modal ───────────────────────────────────────────────────────
// Opens when a lineup row or roster card is clicked. Renders the full
// scorebook player profile: name banner, portrait, position chip, stat
// note, and a richer ledger than the card grid (full slash + counting).
function inferPlayerKind(p) {
  if (p?.positionGroup === "pitcher") {
    if (p.bullpenRole) return "reliever";
    return "pitcher";
  }
  return "batter";
}

function PlayerModal({ player, onClose }) {
  useEffect(() => {
    if (!player) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [player, onClose]);

  if (!player) return null;
  const p = player;
  const kind = inferPlayerKind(p);
  const s = p.stats || {};

  // Build a comprehensive ledger by kind.
  let cells;
  if (kind === "batter") {
    cells = [
      { k: "AVG",  v: fmt.avg(s.avg) },
      { k: "OBP",  v: fmt.avg(s.obp) },
      { k: "SLG",  v: fmt.avg(s.slg) },
      { k: "OPS",  v: fmt.avg(s.ops) },
      { k: "HR",   v: fmt.num(s.hr) },
      { k: "RBI",  v: fmt.num(s.rbi) },
      { k: "SB",   v: fmt.num(s.sb) },
      { k: "BB",   v: fmt.num(s.bb) },
      { k: "SO",   v: fmt.num(s.so) },
      { k: "G",    v: fmt.num(s.games) },
    ];
  } else if (kind === "pitcher") {
    const wl = (s.w == null && s.l == null) ? "—" : `${s.w ?? "—"}–${s.l ?? "—"}`;
    cells = [
      { k: "ERA",  v: fmt.era(s.era) },
      { k: "WHIP", v: fmt.whip(s.whip) },
      { k: "W–L",  v: wl },
      { k: "IP",   v: fmt.ip(s.ip) },
      { k: "K",    v: fmt.num(s.k) },
      { k: "BB",   v: fmt.num(s.bb) },
      { k: "GS",   v: fmt.num(s.starts) },
      { k: "G",    v: fmt.num(s.games) },
    ];
  } else {
    // reliever
    const wl = (s.w == null && s.l == null) ? "—" : `${s.w ?? "—"}–${s.l ?? "—"}`;
    cells = [
      { k: "ERA",  v: fmt.era(s.era) },
      { k: "WHIP", v: fmt.whip(s.whip) },
      { k: "IP",   v: fmt.ip(s.ip) },
      { k: "K",    v: fmt.num(s.k) },
      { k: "BB",   v: fmt.num(s.bb) },
      { k: "SV",   v: fmt.num(s.sv) },
      { k: "HD",   v: fmt.num(s.hold) },
      { k: "W–L",  v: wl },
    ];
  }

  const roleLabel = {
    closer: "Closer",
    lhp: "Lefty Specialist",
    long: "Long Relief",
    middle: "Middle Relief",
  }[p.bullpenRole] || (kind === "reliever" ? "Relief" : null);

  const handsLine = [
    p.bats ? `Bats ${p.bats}` : null,
    p.throws ? `Throws ${p.throws}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div
      className="player-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${p.name} player details`}
    >
      <div className="player-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close player details">×</button>
        <div className="modal-banner">
          <span className="modal-name">{p.name}</span>
          <span className="modal-num">№ {p.number}</span>
        </div>
        <div className="modal-frame">
          <Portrait player={p} />
          <div className="modal-meta">
            <div className="modal-pos-chip">
              <span>{p.position}</span>
              {handsLine && <span className="bar" />}
              {handsLine && <span className="hands">{handsLine}</span>}
              {roleLabel && kind === "reliever" && <span className="bar" />}
              {roleLabel && kind === "reliever" && <span className="hands">{roleLabel}</span>}
            </div>
            {p.lineupSpot != null && (
              <div className="modal-tag">Batting #{p.lineupSpot} in tonight's order</div>
            )}
            {p.rotationSpot != null && (
              <div className="modal-tag">No. {p.rotationSpot} in the rotation</div>
            )}
            {(p.status && p.status !== "active") && (
              <div className="modal-tag tag-status">
                {p.status.toUpperCase().replace("IL-", "IL · ")}
                {((p.injuryNote || "") + (p.statNote || "")).toLowerCase().includes("rehab") ? " · REHAB" : ""}
              </div>
            )}
            {p.nationality && <div className="modal-line"><span className="label">From</span> {p.nationality}</div>}
            {p.age != null && <div className="modal-line"><span className="label">Age</span> {p.age}{p.experience != null ? ` · ${p.experience} yrs MLB` : ""}</div>}
            {p.statNote && <p className="modal-note">{p.statNote}</p>}
            {p.injuryNote && p.statNote !== p.injuryNote && (
              <p className="modal-note injury">{p.injuryNote}</p>
            )}
          </div>
        </div>
        <div className="modal-ledger">
          {cells.map((c) => (
            <div className="modal-cell" key={c.k}>
              <span className="modal-label">{c.k}</span>
              <span className="modal-value">{c.v}</span>
            </div>
          ))}
        </div>
        {Array.isArray(p.career) && p.career.length > 0 && (
          <div className="modal-career">
            <div className="modal-career-head">Career</div>
            <ul>
              {p.career.map((row, i) => (
                <li key={i}><strong>{row.years}</strong> · {row.team} <span className="career-type">{row.type}</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// "DENVER, May 1" / "ATLANTA, Apr 30" — fabricated from the digest's
// generatedAt + the topic category, since the digest doesn't carry a dateline.
function makeDateline(category, idx) {
  const d = NEWS_DIGEST?.generatedAt ? new Date(NEWS_DIGEST.generatedAt) : new Date();
  // Walk back a day for each non-lede article so the column reads like a beat.
  const offset = idx === 0 ? 0 : Math.min(idx, 4);
  const dt = new Date(d.getTime() - offset * 86400000);
  const md = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const place = {
    rotation: idx === 0 ? "DENVER" : "ATLANTA",
    result:   "ATLANTA",
    injury:   "ATLANTA",
    transaction: "ATLANTA",
    milestone: "ATLANTA",
    standings: "NL EAST",
    narrative: "ATLANTA",
  }[category] || "ATLANTA";
  return `${place}, ${md}`;
}

function BeatView() {
  const topics = NEWS_DIGEST?.keyTopics || [];
  const [lede, ...rest] = topics;
  if (!lede) return <div className="view"><p>No beat copy filed today.</p></div>;
  return (
    <div className="view">
      <div className="beat-masthead">
        <h2>The Braves Beat</h2>
        <div className="sub">— filed daily from the press box · weather permitting —</div>
      </div>
      <div className="beat">
        <article className="lede">
          <div className="dateline">
            {makeDateline(lede.category, 0)}
            <span className="cat"> · {(lede.category || "").toUpperCase()}</span>
          </div>
          <h3>{lede.title}</h3>
          <p>{lede.detail}</p>
        </article>
        {rest.map((a, i) => (
          <article key={i}>
            <div className="dateline">
              {makeDateline(a.category, i + 1)}
              <span className="cat"> · {(a.category || "").toUpperCase()}</span>
            </div>
            <h3>{a.title}</h3>
            <p>{a.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function Colophon() {
  return (
    <footer className="colophon">
      <span className="gloss-baseball" /> Set in Oswald, Source Serif &amp; JetBrains Mono.
      Printed on cream stock, navy ink, with red ink reserved for stamps and leaders.
      <span className="glyph" />
      Refreshed each morning · Sources: MLB.com, ESPN, AJC, Battery Power, MLB Trade Rumors.
    </footer>
  );
}

export default function BravesTracker() {
  const [view, setView] = useState("field");
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // ── derive view-models from PLAYERS ──────────────────────────────────
  const batters = useMemo(
    () => PLAYERS
      .filter((p) => p.positionGroup === "batter" && p.lineupSpot != null && p.status === "active")
      .sort((a, b) => a.lineupSpot - b.lineupSpot),
    []
  );

  const rotation = useMemo(
    () => PLAYERS
      .filter((p) => p.positionGroup === "pitcher" && p.rotationSpot != null && p.status !== "departed")
      .sort((a, b) => a.rotationSpot - b.rotationSpot),
    []
  );

  // Bullpen ordered: closers, lefties, middle, long
  const bullpen = useMemo(() => {
    const order = { closer: 0, lhp: 1, middle: 2, long: 3 };
    return PLAYERS
      .filter((p) => p.positionGroup === "pitcher" && p.bullpenRole && p.status === "active")
      .sort((a, b) => (order[a.bullpenRole] ?? 9) - (order[b.bullpenRole] ?? 9));
  }, []);

  const ilList = useMemo(
    () => PLAYERS.filter((p) => /^il-/.test(p.status || "")),
    []
  );

  // League leader: active batter with the most HR (Olson at .388/9 today).
  const leaderId = useMemo(() => {
    let top = null;
    for (const p of batters) {
      if (p.stats?.hr != null && (top == null || p.stats.hr > top.stats.hr)) top = p;
    }
    return top?.id;
  }, [batters]);

  // Tonight pill label e.g. "Tonight 8:40p ET"
  const tonightLabel = (() => {
    const t = NEXT_GAME?.time;
    if (!t) return "Tonight";
    const compact = t.replace(/\s*PM\s*ET/i, "p ET").replace(/\s*AM\s*ET/i, "a ET");
    return `Tonight ${compact}`;
  })();

  return (
    <div className="page" data-screen-label={`view-${view}`}>
      <Nameplate />
      <Nav view={view} setView={setView} tonightLabel={tonightLabel} />
      {view === "field"    && <FieldView batters={batters} onSelect={setSelectedPlayer} />}
      {view === "roster"   && <RosterView batters={batters} ilList={ilList} leaderId={leaderId} onSelect={setSelectedPlayer} />}
      {view === "rotation" && <RotationView rotation={rotation} bullpen={bullpen} onSelect={setSelectedPlayer} />}
      {view === "beat"     && <BeatView />}
      <Colophon />
      <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  );
}
