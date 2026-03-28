/* ============================================================
   APEX ANALYTICS v4 — Core JavaScript
   Modular renderers. Easy to extend.
   ============================================================ */

'use strict';

/* ── UTILITIES ──────────────────────────────────────────── */
const $ = id => document.getElementById(id);

async function loadJSON(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  } catch(e) {
    console.error('[APEX] loadJSON:', path, e.message);
    return null;
  }
}

function params() {
  const p = new URLSearchParams(location.search);
  return {
    series: p.get('series') || 'f1',
    year:   parseInt(p.get('year'))  || new Date().getFullYear(),
    round:  parseInt(p.get('round')) || null,
    id:     p.get('id')   || null,
    a:      p.get('a')    || null,
    b:      p.get('b')    || null,
    tool:   p.get('tool') || null,
  };
}

function fmtDate(str) {
  if (!str) return 'TBD';
  return new Date(str + 'T12:00:00Z').toLocaleDateString('en-US', {
    month:'short', day:'numeric', year:'numeric'
  });
}

function fmtDateShort(str) {
  if (!str) return '—';
  return new Date(str + 'T12:00:00Z').toLocaleDateString('en-US', {
    month:'short', day:'numeric'
  });
}

function setAccent(color) {
  if (!color) return;
  const c = color.replace('#','');
  const [r,g,b] = c.match(/.{2}/g).map(x=>parseInt(x,16));
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-rgb', `${r},${g},${b}`);
}

/* ── RESULT CELL HELPERS ─────────────────────────────────── */
function posClass(fin) {
  if (fin === null || fin === undefined) return 'pos-out';
  const f = String(fin).toUpperCase();
  if (f === 'DNF') return 'pos-dnf';
  if (f === 'DNS') return 'pos-dns';
  const n = parseInt(fin);
  if (n === 1)  return 'pos-1';
  if (n === 2)  return 'pos-2';
  if (n === 3)  return 'pos-3';
  if (n <= 10)  return 'pos-pts';
  return 'pos-out';
}
function posLabel(fin) {
  if (fin === null || fin === undefined) return '·';
  return String(fin).slice(0, 3);
}

/* ── FAVORITES ───────────────────────────────────────────── */
const Favs = {
  get() {
    try { return JSON.parse(localStorage.getItem('apex-favorites') || '{"drivers":[],"teams":[]}'); }
    catch { return { drivers:[], teams:[] }; }
  },
  save(f) { localStorage.setItem('apex-favorites', JSON.stringify(f)); },
  hasDriver(id)    { return this.get().drivers.includes(id); },
  toggleDriver(id) {
    const f = this.get();
    const idx = f.drivers.indexOf(id);
    if (idx > -1) f.drivers.splice(idx, 1);
    else f.drivers.push(id);
    this.save(f);
    return idx === -1; // true = now favorited
  },
};

/* ── SHARE ───────────────────────────────────────────────── */
function shareURL(params) {
  const url = new URL(location.href);
  Object.entries(params).forEach(([k,v]) => {
    if (v !== null && v !== undefined) url.searchParams.set(k, v);
  });
  navigator.clipboard.writeText(url.toString()).then(() => {
    // Brief visual feedback
    document.querySelectorAll('.share-btn').forEach(btn => {
      btn.classList.add('copied');
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = '🔗 Share';
      }, 2000);
    });
  });
}

/* ── COUNTDOWN ───────────────────────────────────────────── */
function countdown(dateStr, timeUtc) {
  const raceTime = new Date(`${dateStr}T${timeUtc || '06:00:00'}Z`);
  const now = new Date();
  const diff = raceTime - now;
  if (diff <= 0) return { days:0, hours:0, mins:0, secs:0, past:true };
  const days  = Math.floor(diff / 864e5);
  const hours = Math.floor((diff % 864e5) / 36e5);
  const mins  = Math.floor((diff % 36e5) / 6e4);
  const secs  = Math.floor((diff % 6e4) / 1e3);
  return { days, hours, mins, secs, past:false };
}

function pad(n) { return String(n).padStart(2, '0'); }

/* ══════════════════════════════════════════════════════════
   F1 HUB
══════════════════════════════════════════════════════════ */
async function initF1Hub() {
  const [config, comp, sched] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON('data/competitors-f1-2026.json'),
    loadJSON('data/f1-2026.json'),
  ]);
  if (!config || !comp) return;

  const series    = config.series.f1;
  const drivers   = comp.competitors;
  const schedule  = sched?.schedule || [];
  const completed = schedule.filter(r => r.complete);
  const nextRace  = schedule.find(r => !r.complete);
  const lastRace  = completed[completed.length - 1];
  const year      = 2026;

  const sorted = [...drivers].sort((a,b) =>
    (b.season_2026?.pts||0) - (a.season_2026?.pts||0));

  document.title = `Formula 1 ${year} — APEX Analytics`;

  /* ── Next race countdown ── */
  let cdHtml = '';
  if (nextRace) {
    const cd = countdown(nextRace.date, nextRace.time_utc);
    cdHtml = `
      <div class="fh-next-race">
        <div class="fnr-label">Next Race · R${nextRace.round}</div>
        <div class="fnr-name">${nextRace.name || nextRace.venue}</div>
        <div class="fnr-venue">${nextRace.venue} · ${fmtDate(nextRace.date)}</div>
        <div class="fnr-countdown">
          <div><div class="fnr-unit-v" id="cd-d">${pad(cd.days)}</div><div class="fnr-unit-l">Days</div></div>
          <div><div class="fnr-unit-v" id="cd-h">${pad(cd.hours)}</div><div class="fnr-unit-l">Hrs</div></div>
          <div><div class="fnr-unit-v" id="cd-m">${pad(cd.mins)}</div><div class="fnr-unit-l">Min</div></div>
          <div><div class="fnr-unit-v" id="cd-s">${pad(cd.secs)}</div><div class="fnr-unit-l">Sec</div></div>
        </div>
      </div>`;
    // Live countdown tick
    setInterval(() => {
      const c = countdown(nextRace.date, nextRace.time_utc);
      if ($('cd-d')) $('cd-d').textContent = pad(c.days);
      if ($('cd-h')) $('cd-h').textContent = pad(c.hours);
      if ($('cd-m')) $('cd-m').textContent = pad(c.mins);
      if ($('cd-s')) $('cd-s').textContent = pad(c.secs);
    }, 1000);
  }

  /* ── Championship strip (top 4) ── */
  const maxPts = sorted[0]?.season_2026?.pts || 1;
  const champStrip = sorted.slice(0, 4).map((d, i) => {
    const pts  = d.season_2026?.pts || 0;
    const gap  = i === 0 ? 0 : maxPts - pts;
    const pct  = Math.round((pts / maxPts) * 100);
    return `
      <a href="competitor.html?series=f1&id=${d.id}" class="cs-item">
        <div class="cs-bar" style="--c:#${d.color};width:${pct}%"></div>
        <div class="cs-pos ${i===0?'p1':i===1?'p2':''}">${i+1}</div>
        <div style="width:5px;height:5px;border-radius:50%;background:#${d.color};flex-shrink:0"></div>
        <div class="cs-info">
          <div class="cs-name">${d.name}</div>
          <div class="cs-team">${d.team_name} · #${d.number}</div>
        </div>
        <div>
          <div class="cs-pts ${i===0?'leader':''}">${pts}</div>
          <div class="cs-gap">${gap > 0 ? '−'+gap : 'Ldr'}</div>
        </div>
      </a>`;
  }).join('');

  /* ── Last race card ── */
  let lastRaceHtml = '';
  if (lastRace) {
    const tags = (lastRace.story_cards||[]).slice(0,2).map(s =>
      `<span class="tag accent">${s.title}</span>`).join('');

    lastRaceHtml = `
      <a class="race-card" href="race.html?series=f1&round=${lastRace.round}" style="--acc:var(--accent)">
        <div class="rc-body">
          <div class="rc-meta">
            <div class="rc-series-dot" style="background:var(--red)"></div>
            <span class="rc-meta-txt">F1 · R${lastRace.round} · ${lastRace.venue} · ${fmtDate(lastRace.date)}</span>
          </div>
          <div class="rc-title">${lastRace.name}</div>
          <div class="rc-summary">${lastRace.summary || ''}</div>
          <div class="rc-tags">${tags}</div>
        </div>
        <div class="rc-aside">
          <div>
            <div class="rc-winner-name" style="color:var(--accent)">${lastRace.race?.winner || '—'}</div>
            <div class="rc-winner-lbl">Winner</div>
          </div>
          <div class="rc-arrow">Analysis →</div>
        </div>
      </a>`;
  }

  /* ── Preview card (next race) ── */
  let previewHtml = '';
  if (nextRace) {
    const bullets = (nextRace.story_cards||[]).slice(0,3).map(s =>
      `<div class="pc-bullet">${s.title}</div>`).join('');
    previewHtml = `
      <div class="preview-card">
        <div class="pc-badge">
          <div style="width:5px;height:5px;border-radius:50%;background:var(--accent)"></div>
          Next Race · R${nextRace.round}
        </div>
        <div class="pc-title">${nextRace.flag || '🏁'} ${nextRace.name || nextRace.venue}</div>
        <div class="pc-body">${nextRace.summary || `Round ${nextRace.round} of the ${year} Formula 1 World Championship.`}</div>
        ${bullets ? `<div class="pc-bullets">${bullets}</div>` : ''}
      </div>`;
  }

  /* ── All completed races ── */
  const pastRaces = completed.map(r => {
    const tags = (r.insights||[]).slice(0,2).map(ins =>
      `<span class="tag">${ins.headline || ins.type}</span>`).join('');
    return `
      <a class="race-card" href="race.html?series=f1&round=${r.round}" style="--acc:var(--red)">
        <div class="rc-body">
          <div class="rc-meta">
            <div class="rc-series-dot" style="background:var(--red)"></div>
            <span class="rc-meta-txt">R${r.round} · ${r.flag||'🏁'} ${r.venue} · ${fmtDate(r.date)}</span>
          </div>
          <div class="rc-title">${r.name}</div>
          <div class="rc-summary">${(r.summary||'').slice(0,120)}${r.summary?.length>120?'…':''}</div>
          <div class="rc-tags">${tags}</div>
        </div>
        <div class="rc-aside">
          <div>
            <div class="rc-winner-name">${r.race?.winner||'—'}</div>
            <div class="rc-winner-lbl">Winner</div>
          </div>
          <div class="rc-arrow">Full Analysis →</div>
        </div>
      </a>`;
  }).reverse().join('');

  /* ── Standings sidebar ── */
  const standingsSb = sorted.slice(0, 10).map((d, i) => {
    const pts  = d.season_2026?.pts || 0;
    const pct  = Math.round((pts / maxPts) * 100);
    const fav  = Favs.hasDriver(d.id);
    return `
      <div class="stand-row" onclick="location.href='competitor.html?series=f1&id=${d.id}'">
        <div class="stand-row-bg" style="width:${pct}%;background:#${d.color}"></div>
        <div class="sr-pos ${i===0?'p1':i===1?'p2':''}">${i+1}</div>
        <div class="sr-dot" style="background:#${d.color}"></div>
        <div class="sr-name">${d.name}</div>
        <div class="sr-pts ${i===0?'leader':''}">${pts}</div>
        <button class="sr-fav ${fav?'active':''}" title="${fav?'Remove from favorites':'Add to favorites'}"
          onclick="event.stopPropagation();toggleFavDriver('${d.id}',this)">
          ${fav ? '★' : '☆'}
        </button>
      </div>`;
  }).join('');

  /* ── Schedule sidebar ── */
  const schedSb = schedule.map(r => {
    const cls = r.complete ? 'done' : r === nextRace ? 'next' : '';
    return `
      <a href="race.html?series=f1&round=${r.round}" class="sched-item ${cls}">
        <div class="si-round">R${r.round}</div>
        <div class="si-flag">${r.flag||'🏁'}</div>
        <div class="si-name">${(r.venue||r.name||'').replace(' International','').replace(' Circuit','').replace(' Grand Prix','').slice(0,22)}</div>
        <div class="si-date">${r.complete ? 'Done' : fmtDateShort(r.date)}</div>
      </a>`;
  }).join('');

  /* ── BUILD PAGE ── */
  $('hub-root').innerHTML = `

    <!-- HERO -->
    <div class="f1-hero anim-fade-up">
      <div class="f1-hero-bg">F1</div>
      <div class="fh-left">
        <div class="fh-eyebrow">
          <div class="fh-series-dot"></div>
          <span class="fh-eyebrow-text">Formula 1 · ${year} World Championship</span>
        </div>
        <h1 class="fh-title">F1 <span class="acc">${year}</span></h1>
        <div class="fh-summary">
          ${completed.length} races complete. ${nextRace ? `Next: ${nextRace.name||nextRace.venue} in ${countdown(nextRace.date,nextRace.time_utc).days} days.` : ''}
          George Russell leads the drivers championship by 4 points over team-mate Kimi Antonelli. Mercedes have won every race so far.
        </div>
        <div class="fh-actions">
          <a href="datalab.html?series=f1" class="btn primary">Open Data Lab →</a>
          <a href="standings.html?series=f1" class="btn ghost">Full Standings</a>
          <button class="btn share-btn" onclick="shareURL({series:'f1'})">🔗 Share</button>
        </div>
      </div>
      <div class="fh-right">
        ${cdHtml}
      </div>
    </div>

    <!-- CHAMPIONSHIP STRIP -->
    <div class="champ-strip anim-fade-up delay-1">${champStrip}</div>

    <!-- MAIN LAYOUT -->
    <div class="hub-main">
      <div class="hub-feed">
        ${previewHtml}
        <div class="sec-head">
          <span class="sec-head-label">Race Reports</span>
          <a href="standings.html?series=f1" class="sec-head-link">Full Season →</a>
        </div>
        ${pastRaces || '<div style="padding:32px 24px;color:var(--dim);font-family:JetBrains Mono,monospace;font-size:9px">No completed races yet.</div>'}
      </div>

      <div class="hub-side">
        <div class="sb-block">
          <div class="sb-label">
            Drivers Championship
            <span style="float:right">
              <a href="standings.html?series=f1" style="font-size:8px;color:var(--accent);opacity:.6;font-family:JetBrains Mono,monospace;letter-spacing:1px">Full →</a>
            </span>
          </div>
          ${standingsSb}
        </div>

        <div class="sb-block">
          <div class="sb-label">2026 Calendar</div>
          ${schedSb}
        </div>

        <div class="sb-block">
          <div class="sb-label">Explore</div>
          <a href="datalab.html?series=f1" class="quick-link">APEX Data Lab <span class="ql-arrow">→</span></a>
          <a href="circuits.html?series=f1" class="quick-link">Circuit Guide <span class="ql-arrow">→</span></a>
          <a href="compare.html?series=f1"  class="quick-link">Compare Drivers <span class="ql-arrow">→</span></a>
          <a href="standings.html?series=f1" class="quick-link">Full Standings <span class="ql-arrow">→</span></a>
        </div>
      </div>
    </div>`;

  if ($('footer-copy')) $('footer-copy').textContent = `Formula 1 ${year} · ${completed.length} of ${schedule.length} rounds`;
}

/* ── Favorite toggle (called from hub) ── */
function toggleFavDriver(id, btn) {
  const now = Favs.toggleDriver(id);
  btn.textContent = now ? '★' : '☆';
  btn.classList.toggle('active', now);
}

/* ══════════════════════════════════════════════════════════
   STANDINGS PAGE
══════════════════════════════════════════════════════════ */
async function initStandingsPage() {
  const p = params();
  const [config, comp, sched] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/competitors-${p.series}-${p.year}.json`),
    loadJSON(`data/${p.series}-${p.year}.json`),
  ]);
  if (!config || !comp) {
    const root = $('page-root');
    if (root) root.innerHTML = '<div style="padding:60px var(--pad);text-align:center;font-family:JetBrains Mono,monospace;font-size:9px;color:var(--dim)">Failed to load standings data for ' + p.series + '.</div>';
    return;
  }

  // Handle NASCAR sub-series (nascar-cup, nascar-xfinity, nascar-trucks)
  const nascarMain = config.series.nascar;
  const isNascarSub = nascarMain && nascarMain.sub_series && nascarMain.sub_series.find(ss=>ss.id===p.series);
  const series   = isNascarSub || config.series[p.series];
  const drivers  = comp.competitors;
  const schedule = sched?.schedule || [];
  const completed= schedule.filter(r=>r.complete);
  setAccent(series.accent);
  document.title = `${series.name} ${p.year} Standings — APEX Analytics`;

  const sorted = [...drivers].sort((a,b)=>(b.season_2026?.pts||0)-(a.season_2026?.pts||0));
  const maxPts = sorted[0]?.season_2026?.pts || 1;

  // Constructors
  const teamMap = {};
  drivers.forEach(d => {
    if (!teamMap[d.team]) teamMap[d.team] = { name:d.team_name||d.team, color:'#'+d.color, pts:0 };
    teamMap[d.team].pts += d.season_2026?.pts || 0;
  });
  const constructors = Object.values(teamMap).sort((a,b)=>b.pts-a.pts);
  const maxConPts = constructors[0]?.pts || 1;

  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `
    <a href="index.html">Home</a><span class="sep">/</span>
    <a href="${(series.hub_url||(config.series.nascar&&config.series.nascar.hub_url)||'f1.html')}">${series.hub_url?series.name+' Hub':'NASCAR Hub'}</a><span class="sep">/</span>
    <span class="current">Standings</span>`;

  const root = $('page-root');
  if (!root) return;

  root.innerHTML = `
    <div style="padding:32px var(--pad) 24px;border-bottom:1px solid var(--border)">
      <div class="label accent" style="margin-bottom:8px">${series.name} · ${p.year}</div>
      <h1 style="font-family:'Bebas Neue',display;font-size:clamp(40px,6vw,72px);letter-spacing:2px">
        Championship Standings
      </h1>
    </div>

    <div class="tab-bar">
      <button class="tab-btn active" onclick="switchTab('drivers',this)">Drivers</button>
      <button class="tab-btn" onclick="switchTab('constructors',this)">${p.series&&p.series.includes('nascar')?'Teams':'Constructors'}</button>
      <button class="tab-btn" onclick="switchTab('schedule',this)">Schedule</button>
    </div>

    <!-- DRIVERS TAB -->
    <div class="tab-panel active" id="tab-drivers">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            ${['Pos','Driver','Team','Pts','W','P','FL','DNF','Avg'].map(h =>
              `<th style="padding:8px 14px;font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);text-align:${h==='Pos'||h==='Pts'||h==='W'||h==='P'||h==='FL'||h==='DNF'||h==='Avg'?'right':'left'}">${h}</th>`
            ).join('')}
            <th style="width:28px"></th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((d, i) => {
            const s   = d.season_2026;
            const pts = s?.pts || 0;
            const pct = Math.round((pts/maxPts)*100);
            const fins= (s?.results_by_round||[]).map(r=>parseInt(r.finish)).filter(n=>!isNaN(n));
            const avg = fins.length ? (fins.reduce((a,b)=>a+b,0)/fins.length).toFixed(1) : '—';
            const fav = Favs.hasDriver(d.id);
            return `
              <tr onclick="location.href='competitor.html?series=${p.series}&id=${d.id}'"
                  onmouseover="this.style.background='rgba(255,255,255,.014)'"
                  onmouseout="this.style.background=''"
                  style="cursor:pointer;border-bottom:1px solid rgba(255,255,255,.025);position:relative">
                <td style="padding:10px 14px;text-align:right;font-family:'Bebas Neue',display;font-size:18px;color:${i<2?'var(--accent)':'var(--dim)'}">${i+1}</td>
                <td style="padding:10px 14px;position:relative">
                  <div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:#${d.color};opacity:.07"></div>
                  <div style="position:relative;display:flex;align-items:center;gap:8px">
                    <div style="width:3px;height:32px;background:#${d.color};flex-shrink:0"></div>
                    <div>
                      <div style="font-family:'Bebas Neue',display;font-size:17px;letter-spacing:.3px">${d.name}</div>
                      <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim)">#${d.number}</div>
                    </div>
                  </div>
                </td>
                <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted)">${d.team_name}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'Bebas Neue',display;font-size:22px;color:${i===0?'var(--accent)':'var(--text)'}">${pts}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'Bebas Neue',display;font-size:18px;color:${s?.wins?'#FFD700':'var(--dim)'}">${s?.wins||'—'}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'Bebas Neue',display;font-size:18px;color:var(--muted)">${s?.podiums||'—'}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'Bebas Neue',display;font-size:18px;color:var(--muted)">${s?.fastest_laps||'—'}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'Bebas Neue',display;font-size:18px;color:${s?.dnfs?'var(--red)':'var(--dim)'}">${s?.dnfs||'—'}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted)">${avg}</td>
                <td style="padding:10px 14px">
                  <button class="sr-fav ${fav?'active':''}" onclick="event.stopPropagation();toggleFavDriver('${d.id}',this)">
                    ${fav?'★':'☆'}
                  </button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- CONSTRUCTORS TAB -->
    <div class="tab-panel" id="tab-constructors">
      ${constructors.map((t, i) => {
        const pct = Math.round((t.pts/maxConPts)*100);
        return `
          <div style="display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.025);position:relative">
            <div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${t.color};opacity:.07"></div>
            <div style="font-family:'Bebas Neue',display;font-size:20px;color:var(--dim);width:22px;text-align:center;position:relative">${i+1}</div>
            <div style="width:4px;height:36px;background:${t.color};flex-shrink:0;position:relative"></div>
            <div style="flex:1;position:relative">
              <div style="font-family:'Bebas Neue',display;font-size:20px;letter-spacing:.5px">${t.name}</div>
              <div style="height:4px;background:rgba(255,255,255,.06);margin-top:6px;border-radius:2px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${t.color};transition:width 1s var(--ease-out)"></div>
              </div>
            </div>
            <div style="font-family:'Bebas Neue',display;font-size:32px;color:${i===0?'var(--accent)':'var(--text)'};position:relative">${t.pts}</div>
          </div>`;
      }).join('')}
    </div>

    <!-- SCHEDULE TAB -->
    <div class="tab-panel" id="tab-schedule">
      ${schedule.map(r => {
        const done = r.complete;
        return `
          <a href="race.html?series=${p.series}&round=${r.round}"
             style="display:flex;align-items:center;gap:12px;padding:14px 20px;
                    border-bottom:1px solid rgba(255,255,255,.025);
                    text-decoration:none;color:inherit;transition:background .14s;
                    ${done ? 'opacity:.55' : ''}"
             onmouseover="this.style.background='rgba(255,255,255,.014)'"
             onmouseout="this.style.background=''">
            <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);width:24px">R${r.round}</div>
            <div style="font-size:18px;flex-shrink:0">${r.flag||'🏁'}</div>
            <div style="flex:1">
              <div style="font-family:'Bebas Neue',display;font-size:18px;letter-spacing:.3px">${r.name||r.venue}</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim)">${r.venue}</div>
            </div>
            <div style="text-align:right">
              <div style="font-family:'Bebas Neue',display;font-size:16px;color:${done?'var(--green)':'var(--muted)'}">${done ? (r.race?.winner||'—') : fmtDate(r.date)}</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim)">${done?'Winner':'Date'}</div>
            </div>
          </a>`;
      }).join('')}
    </div>`;
}

function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = $('tab-' + id);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
}

/* ══════════════════════════════════════════════════════════
   RACE PAGE
══════════════════════════════════════════════════════════ */
async function initRacePage() {
  const p = params();
  const [config, comp, sched, venues] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON('data/competitors-' + p.series + '-' + p.year + '.json'),
    loadJSON('data/' + p.series + '-' + p.year + '.json'),
    loadJSON('data/venues-' + p.series + '-' + p.year + '.json'),
  ]);
  if (!config || !sched) {
    const root = $('page-root');
    if (root) root.innerHTML = '<div style="padding:60px var(--pad);text-align:center;font-family:JetBrains Mono,monospace;font-size:9px;color:var(--dim);letter-spacing:2px">Failed to load race data.</div>';
    return;
  }

  // Resolve series config - handle NASCAR sub-series
  const nascarMain = config.series.nascar;
  const isNascarSub = nascarMain && nascarMain.sub_series && nascarMain.sub_series.find(function(ss){return ss.id===p.series;});
  const series = isNascarSub || config.series[p.series] || {name:p.series, accent:'#27F4D2', short:p.series.toUpperCase()};
  const race    = sched.schedule?.find(r => r.round === p.round);
  if (!race) {
    const root = $('page-root');
    if (root) root.innerHTML = '<div style="padding:60px var(--pad);text-align:center;font-family:JetBrains Mono,monospace;font-size:9px;color:var(--dim)">Race R' + p.round + ' not found in ' + p.series + ' ' + p.year + ' schedule.</div>';
    return;
  }

  setAccent(series.accent);
  document.title = `${race.name} ${p.year} — APEX Analytics`;

  const venue   = venues?.venues?.find(v => v.id === race.venue_id);
  const drivers = comp?.competitors || [];
  const results = race.race?.results || [];

  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `
    <a href="index.html">Home</a><span class="sep">/</span>
    <a href="${(series.hub_url||(config.series.nascar&&config.series.nascar.hub_url)||'f1.html')}">${series.hub_url?series.name+' Hub':'NASCAR Hub'}</a><span class="sep">/</span>
    <span class="current">R${race.round} · ${race.name}</span>`;

  const root = $('page-root');
  if (!root) return;

  /* ── Race results table ── */
  const resultsHTML = results.map((r, i) => {
    const driver = drivers.find(d => d.name === r.driver || d.id === r.driver_id);
    const color  = driver ? '#'+driver.color : '#888';
    const ptsStr = r.points > 0 ? '+'+r.points : '—';
    return `
      <tr onmouseover="this.style.background='rgba(255,255,255,.014)'"
          onmouseout="this.style.background=''"
          ${driver ? `onclick="location.href='competitor.html?series=${p.series}&id=${driver.id}'"` : ''}
          style="cursor:pointer;border-bottom:1px solid rgba(255,255,255,.025)">
        <td style="padding:10px 14px;text-align:center">
          <span style="display:inline-flex;align-items:center;justify-content:center;
                       width:32px;height:32px;font-family:'Bebas Neue',display;font-size:16px"
                class="${posClass(r.pos)}">
            ${posLabel(r.pos)}
          </span>
        </td>
        <td style="padding:10px 8px">
          <div style="width:3px;height:32px;background:${color};display:inline-block;vertical-align:middle;margin-right:10px"></div>
          <span style="font-family:'Bebas Neue',display;font-size:17px;letter-spacing:.3px;vertical-align:middle">${r.driver}</span>
        </td>
        <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted)">${r.team||'—'}</td>
        <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:9px;text-align:right;color:var(--muted)">${r.gap||'—'}</td>
        <td style="padding:10px 14px;text-align:right;font-family:'Bebas Neue',display;font-size:18px;color:${r.points>0?'var(--accent)':'var(--dim)'}">${ptsStr}</td>
        <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim)">${r.status||'—'}</td>
      </tr>`;
  }).join('');

  /* ── Story cards ── */
  const storiesHTML = (race.story_cards||[]).map(s => `
    <div class="card reveal" style="margin-bottom:2px">
      <div class="card-head">
        <span class="card-title">${s.title}</span>
      </div>
      <div class="card-body">
        <p style="font-size:13.5px;color:var(--muted);line-height:1.8;font-weight:300">${s.body}</p>
      </div>
    </div>`).join('');

  /* ── Insight cards ── */
  const insightsHTML = (race.insights||[]).map(ins => `
    <div class="card reveal" style="margin-bottom:2px">
      <div class="card-body">
        <div style="font-size:20px;margin-bottom:8px">${ins.icon||'💡'}</div>
        <div style="font-family:'Bebas Neue',display;font-size:20px;letter-spacing:.5px;margin-bottom:8px">${ins.headline}</div>
        <p style="font-size:12.5px;color:var(--muted);line-height:1.7;font-weight:300">${ins.body}</p>
      </div>
    </div>`).join('');

  /* ── Stats row ── */
  const statsHTML = (race.stats||[]).map(s => `
    <div class="stat-cell">
      <div class="stat-v" style="color:var(--accent)">${s.value}</div>
      <div class="stat-l">${s.label}</div>
      ${s.note ? `<div style="font-family:'JetBrains Mono',monospace;font-size:7px;color:var(--faint);margin-top:3px">${s.note}</div>` : ''}
    </div>`).join('');

  root.innerHTML = `
    <!-- HERO -->
    <div style="padding:48px var(--pad) 40px;border-bottom:1px solid var(--border);position:relative;overflow:hidden">
      <div style="position:absolute;right:-20px;bottom:-40px;font-family:'Bebas Neue',display;font-size:260px;color:rgba(255,255,255,.018);pointer-events:none;line-height:1">R${race.round}</div>
      <div style="position:relative;z-index:1">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--red)"></div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:2.5px;text-transform:uppercase;color:var(--dim)">
            Formula 1 · Round ${race.round} · ${race.venue}
            ${venue ? ` · <a href="venue.html?series=${p.series}&id=${venue.id}" style="color:var(--accent);opacity:.7;border-bottom:1px solid transparent;transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='transparent'">${venue.name}</a>` : ''}
          </span>
        </div>
        <h1 style="font-family:'Bebas Neue',display;font-size:clamp(52px,8vw,96px);letter-spacing:2px;line-height:.88;margin-bottom:14px">
          ${race.name}
        </h1>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted)">${fmtDate(race.date)}</span>
          ${race.complete ? `
            <span class="tag green">Complete</span>
            ${race.race?.winner ? `<span class="tag accent">Winner: ${race.race.winner}</span>` : ''}
          ` : `<span class="tag">Upcoming</span>`}
          <button class="share-btn" onclick="shareURL({series:'${p.series}',round:${race.round}})">🔗 Share</button>
          <a href="datalab.html?series=${p.series}&round=${race.round}" class="btn ghost btn-sm">Data Lab →</a>
        </div>
      </div>
    </div>

    <!-- STAT ROW -->
    ${statsHTML ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:1px;border-bottom:1px solid var(--border)">${statsHTML}</div>` : ''}

    <!-- TABS -->
    <div class="tab-bar">
      <button class="tab-btn active" onclick="switchTab('overview',this)">Overview</button>
      <button class="tab-btn" onclick="switchTab('results',this)">Results</button>
      ${race.quali ? `<button class="tab-btn" onclick="switchTab('qualifying',this)">Qualifying</button>` : ''}
      <button class="tab-btn" onclick="switchTab('insights',this)">Insights</button>
      ${venue ? `<button class="tab-btn" onclick="switchTab('circuit',this)">Circuit</button>` : ''}
    </div>

    <!-- OVERVIEW TAB -->
    <div class="tab-panel active" id="tab-overview">
      <div style="padding:28px var(--pad)">
        ${race.summary ? `<p style="font-size:15px;color:var(--muted);line-height:1.9;font-weight:300;max-width:720px;margin-bottom:28px">${race.summary}</p>` : ''}
        ${storiesHTML}
      </div>
    </div>

    <!-- RESULTS TAB -->
    <div class="tab-panel" id="tab-results">
      ${results.length ? `
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              ${['Pos','Driver','Team','Gap','Pts','Status'].map(h =>
                `<th style="padding:8px 14px;font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);text-align:${h==='Pos'||h==='Pts'?'center':h==='Gap'||h==='Status'?'right':'left'}">${h}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>${resultsHTML}</tbody>
        </table>` :
        `<div style="padding:40px var(--pad);text-align:center">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);letter-spacing:2px;text-transform:uppercase">
            ${race.complete ? 'Results not yet loaded' : 'Race not yet completed'}
          </div>
        </div>`}
    </div>

    <!-- INSIGHTS TAB -->
    <div class="tab-panel" id="tab-insights">
      <div style="padding:28px var(--pad)">
        ${insightsHTML || '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--dim);letter-spacing:2px;text-transform:uppercase">No insights available yet.</div>'}
      </div>
    </div>

    ${venue ? `
    <!-- CIRCUIT TAB -->
    <div class="tab-panel" id="tab-circuit">
      <div style="padding:28px var(--pad)">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:2px;margin-bottom:24px">
          ${[
            {v:venue.lap_length_km+'km', l:'Lap Length'},
            {v:venue.turns, l:'Turns'},
            {v:venue.drs_zones, l:'DRS Zones'},
            {v:venue.first_f1_gp, l:'First GP'},
            {v:venue.country, l:'Country'},
            {v:venue.circuit_type, l:'Type'},
          ].map(s => `
            <div class="stat-cell">
              <div class="stat-v">${s.v||'—'}</div>
              <div class="stat-l">${s.l}</div>
            </div>`).join('')}
        </div>
        ${venue.description ? `<p style="font-size:13.5px;color:var(--muted);line-height:1.85;font-weight:300;max-width:680px;margin-bottom:20px">${venue.description}</p>` : ''}
        ${venue.legendary_corners ? `
          <div class="label" style="margin-bottom:10px">Legendary Corners</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${venue.legendary_corners.map(c => `<span class="tag">${c}</span>`).join('')}
          </div>` : ''}
      </div>
    </div>` : ''}

    ${race.quali ? `
    <!-- QUALIFYING TAB -->
    <div class="tab-panel" id="tab-qualifying">
      <div style="padding:12px 0">
        ${(race.quali?.grid||[]).map((r, i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 20px;border-bottom:1px solid rgba(255,255,255,.025);cursor:pointer"
               onmouseover="this.style.background='rgba(255,255,255,.014)'" onmouseout="this.style.background=''">
            <div style="font-family:'Bebas Neue',display;font-size:20px;color:${i<3?'var(--accent)':'var(--dim)'};width:24px;text-align:center">${i+1}</div>
            <div style="flex:1;font-family:'Bebas Neue',display;font-size:17px;letter-spacing:.3px">${r.driver||r.name||'—'}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted)">${r.team||'—'}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);text-align:right">${r.time||r.gap||'—'}</div>
          </div>`).join('')}
      </div>
    </div>` : ''}
  `;

  // Reveal animations
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold:.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

/* ══════════════════════════════════════════════════════════
   COMPETITOR PAGE
══════════════════════════════════════════════════════════ */
async function initCompetitorPage() {
  const p = params();
  const [config, comp, sched] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/competitors-${p.series}-${p.year}.json`),
    loadJSON(`data/${p.series}-${p.year}.json`),
  ]);
  if (!config || !comp) return;

  const nascarMainX = config.series.nascar;
  const isNascarSubX = nascarMainX && nascarMainX.sub_series && nascarMainX.sub_series.find(function(ss){return ss.id===p.series;});
  const series = isNascarSubX || config.series[p.series] || {name:p.series,accent:'#27F4D2',short:p.series.toUpperCase()};
  const driver  = comp.competitors.find(d => d.id === p.id);
  if (!driver) return;

  setAccent('#'+driver.color);
  document.title = `${driver.name} — APEX Analytics`;

  const s       = driver.season_2026;
  const results = s?.results_by_round || [];
  const schedule= sched?.schedule || [];
  const teammate= comp.competitors.find(d => d.team === driver.team && d.id !== driver.id);
  const fav     = Favs.hasDriver(driver.id);

  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `
    <a href="index.html">Home</a><span class="sep">/</span>
    <a href="${(series.hub_url||(config.series.nascar&&config.series.nascar.hub_url)||'f1.html')}">${series.hub_url?series.name+' Hub':'NASCAR Hub'}</a><span class="sep">/</span>
    <span class="current">${driver.name}</span>`;

  const root = $('page-root');
  if (!root) return;

  // Head to head vs teammate
  let qH2H = 0, rH2H = 0, qTm = 0, rTm = 0;
  if (teammate) {
    const tmResults = teammate.season_2026?.results_by_round || [];
    const tmMap = {}; tmResults.forEach(r => tmMap[r.round] = r);
    results.forEach(r => {
      const t = tmMap[r.round];
      if (t) {
        if (r.grid && t.grid) { parseInt(r.grid) < parseInt(t.grid) ? qH2H++ : qTm++; }
        const rf = parseInt(r.finish), tf = parseInt(t.finish);
        if (!isNaN(rf) && !isNaN(tf)) { rf < tf ? rH2H++ : rTm++; }
      }
    });
  }

  const fins = results.map(r=>parseInt(r.finish)).filter(n=>!isNaN(n));
  const avg  = fins.length ? (fins.reduce((a,b)=>a+b,0)/fins.length).toFixed(1) : '—';

  root.innerHTML = `
    <!-- HERO -->
    <div style="padding:40px var(--pad);border-bottom:1px solid var(--border);position:relative;overflow:hidden;background:linear-gradient(135deg,rgba(0,0,0,0) 60%,rgba(${parseInt(driver.color.slice(0,2),16)},${parseInt(driver.color.slice(2,4),16)},${parseInt(driver.color.slice(4,6),16)},.05))">
      <div style="position:absolute;right:-20px;top:50%;transform:translateY(-50%);font-family:'Bebas Neue',display;font-size:240px;color:rgba(255,255,255,.025);pointer-events:none;line-height:1;letter-spacing:-4px">#${driver.number}</div>
      <div style="position:relative;z-index:1;display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap">
        <div style="flex:1;min-width:260px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:var(--dim);margin-bottom:12px">
            ${series.name} · ${driver.nationality||''} · #${driver.number}
          </div>
          <h1 style="font-family:'Bebas Neue',display;font-size:clamp(48px,7vw,88px);letter-spacing:1px;line-height:.88;color:#${driver.color};margin-bottom:10px">
            ${driver.name}
          </h1>
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);margin-bottom:20px">${driver.team_name}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn ${fav?'primary':'ghost'} btn-sm" id="fav-btn"
              onclick="toggleFavDriver('${driver.id}',this)">
              ${fav ? '★ Favorited' : '☆ Add to Favorites'}
            </button>
            <a href="compare.html?series=${p.series}&a=${driver.id}" class="btn btn-sm">Compare →</a>
            <button class="share-btn" onclick="shareURL({series:'${p.series}',id:'${driver.id}'})">🔗 Share</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;min-width:360px">
          ${[
            {v:s?.pts||0,    l:'Points',    c:'#'+driver.color},
            {v:s?.wins||0,   l:'Wins',      c:s?.wins?'#FFD700':null},
            {v:s?.podiums||0,l:'Podiums',   c:null},
            {v:avg,          l:'Avg Finish', c:null},
            {v:s?.poles||0,  l:'Poles',     c:null},
            {v:s?.fastest_laps||0,l:'FL',   c:null},
            {v:s?.dnfs||0,   l:'DNFs',      c:s?.dnfs?'var(--red)':null},
            {v:driver.career?.wins||0, l:'Career Wins', c:null},
          ].map(st=>`
            <div class="stat-cell">
              <div class="stat-v" style="${st.c?'color:'+st.c:''}">${st.v}</div>
              <div class="stat-l">${st.l}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- TABS -->
    <div class="tab-bar">
      <button class="tab-btn active" onclick="switchTab('season',this)">2026 Season</button>
      <button class="tab-btn" onclick="switchTab('rounds',this)">Round by Round</button>
      ${teammate ? `<button class="tab-btn" onclick="switchTab('teammate',this)">vs ${teammate.name.split(' ').pop()}</button>` : ''}
      <button class="tab-btn" onclick="switchTab('career',this)">Career</button>
    </div>

    <!-- SEASON TAB -->
    <div class="tab-panel active" id="tab-season">
      <div style="padding:28px var(--pad)">
        <div style="font-family:'Bebas Neue',display;font-size:28px;letter-spacing:1px;margin-bottom:16px">Form Guide</div>
        <div style="display:flex;gap:2px;flex-wrap:wrap;margin-bottom:28px">
          ${schedule.filter(r=>r.complete||results.find(res=>res.round===r.round)).map(round => {
            const res = results.find(r=>r.round===round.round);
            const fin = res?.finish;
            return `
              <div style="text-align:center;cursor:pointer" onclick="location.href='race.html?series=${p.series}&round=${round.round}'"
                   title="R${round.round} ${round.venue}: ${fin||'—'} (+${res?.pts||0} pts)">
                <div style="display:flex;align-items:center;justify-content:center;
                             width:40px;height:40px;font-family:'Bebas Neue',display;font-size:16px;margin-bottom:2px"
                     class="${posClass(fin)}">${posLabel(fin)}</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:6.5px;color:var(--dim)">${(round.venue||'').slice(0,3).toUpperCase()}</div>
              </div>`;
          }).join('')}
        </div>

        <!-- Points trajectory -->
        <div style="font-family:'Bebas Neue',display;font-size:28px;letter-spacing:1px;margin-bottom:12px">Points Trajectory</div>
        <canvas id="chart-trajectory" height="80"></canvas>
      </div>
    </div>

    <!-- ROUND BY ROUND TAB -->
    <div class="tab-panel" id="tab-rounds">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            ${['Rnd','Circuit','Grid','Finish','Pts','Gap'].map(h=>`
              <th style="padding:8px 14px;font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);text-align:left">${h}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${results.map(r => {
            const round = schedule.find(s=>s.round===r.round);
            return `
              <tr onclick="location.href='race.html?series=${p.series}&round=${r.round}'"
                  onmouseover="this.style.background='rgba(255,255,255,.014)'"
                  onmouseout="this.style.background=''"
                  style="cursor:pointer;border-bottom:1px solid rgba(255,255,255,.025)">
                <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:8.5px;color:var(--dim)">R${r.round}</td>
                <td style="padding:10px 14px">
                  <div style="font-family:'Bebas Neue',display;font-size:16px">${round?.venue||'—'}</div>
                  <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim)">${fmtDateShort(round?.date)}</div>
                </td>
                <td style="padding:10px 14px;font-family:'Bebas Neue',display;font-size:18px;color:var(--muted)">${r.grid||'—'}</td>
                <td style="padding:10px 14px">
                  <span class="${posClass(r.finish)}" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;font-family:'Bebas Neue',display;font-size:15px">${posLabel(r.finish)}</span>
                </td>
                <td style="padding:10px 14px;font-family:'Bebas Neue',display;font-size:20px;color:${r.pts>0?'var(--accent)':'var(--dim)'}">${r.pts>0?'+'+r.pts:'—'}</td>
                <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim)">${r.gap||'—'}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- TEAMMATE TAB -->
    ${teammate ? `
    <div class="tab-panel" id="tab-teammate">
      <div style="padding:28px var(--pad)">
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:0;margin-bottom:24px;border:1px solid var(--border)">
          <div style="padding:20px;background:rgba(${parseInt(driver.color.slice(0,2),16)},${parseInt(driver.color.slice(2,4),16)},${parseInt(driver.color.slice(4,6),16)},.06)">
            <div style="font-family:'Bebas Neue',display;font-size:32px;color:#${driver.color};line-height:.9">${driver.name}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);margin-top:4px">#${driver.number}</div>
          </div>
          <div style="display:flex;align-items:center;padding:0 20px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--dim)">VS</div>
          <div style="padding:20px;text-align:right;background:rgba(${parseInt(teammate.color.slice(0,2),16)},${parseInt(teammate.color.slice(2,4),16)},${parseInt(teammate.color.slice(4,6),16)},.06)">
            <div style="font-family:'Bebas Neue',display;font-size:32px;color:#${teammate.color};line-height:.9">${teammate.name}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);margin-top:4px">#${teammate.number}</div>
          </div>
        </div>
        ${[
          {label:'QUALIFYING ('+qH2H+'–'+qTm+')', a:qH2H, b:qTm, tot:Math.max(qH2H+qTm,1)},
          {label:'RACE RESULTS ('+rH2H+'–'+rTm+')', a:rH2H, b:rTm, tot:Math.max(rH2H+rTm,1)},
        ].map(row => `
          <div style="margin-bottom:14px">
            <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:6px;display:flex;justify-content:space-between">
              <span>${row.label}</span>
            </div>
            <div style="height:6px;display:flex;border-radius:3px;overflow:hidden;background:var(--bg3)">
              <div style="width:${(row.a/row.tot)*100}%;background:#${driver.color};opacity:.7;transition:width .8s"></div>
              <div style="width:${(row.b/row.tot)*100}%;background:#${teammate.color};opacity:.7;margin-left:auto;transition:width .8s"></div>
            </div>
          </div>`).join('')}
        ${[
          {label:'Points',    vA:s?.pts||0,           vB:teammate.season_2026?.pts||0,          higher:true},
          {label:'Wins',      vA:s?.wins||0,          vB:teammate.season_2026?.wins||0,         higher:true},
          {label:'Podiums',   vA:s?.podiums||0,       vB:teammate.season_2026?.podiums||0,      higher:true},
          {label:'DNFs',      vA:s?.dnfs||0,          vB:teammate.season_2026?.dnfs||0,         higher:false},
          {label:'Career W',  vA:driver.career?.wins||0, vB:teammate.career?.wins||0,           higher:true},
        ].map(row => {
          const win = row.higher ? (row.vA>row.vB?'a':row.vA<row.vB?'b':'') : (row.vA<row.vB?'a':row.vA>row.vB?'b':'');
          return `
            <div style="display:grid;grid-template-columns:1fr 120px 1fr;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.025)">
              <div style="font-family:'Bebas Neue',display;font-size:${win==='a'?26:20}px;color:${win==='a'?'#'+driver.color:'var(--dim)'}">${row.vA}</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim);text-align:center">${row.label}</div>
              <div style="font-family:'Bebas Neue',display;font-size:${win==='b'?26:20}px;color:${win==='b'?'#'+teammate.color:'var(--dim)'};text-align:right">${row.vB}</div>
            </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- CAREER TAB -->
    <div class="tab-panel" id="tab-career">
      <div style="padding:28px var(--pad)">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:2px;margin-bottom:24px">
          ${[
            {v:driver.career?.wins||0,          l:'Career Wins'},
            {v:driver.career?.podiums||0,        l:'Career Podiums'},
            {v:driver.career?.poles||0,          l:'Career Poles'},
            {v:driver.career?.championships||0,  l:'Championships'},
            {v:driver.career?.races||0,          l:'Races Started'},
            {v:driver.career?.points||0,         l:'Career Points'},
          ].map(st=>`
            <div class="stat-cell">
              <div class="stat-v">${st.v||'—'}</div>
              <div class="stat-l">${st.l}</div>
            </div>`).join('')}
        </div>
        ${driver.bio ? `<p style="font-size:13.5px;color:var(--muted);line-height:1.85;font-weight:300;max-width:680px">${driver.bio}</p>` : ''}
      </div>
    </div>
  `;

  // Trajectory chart
  setTimeout(() => {
    const ctx = $('chart-trajectory');
    if (!ctx || typeof Chart === 'undefined') return;
    let cum = 0;
    const ptData = schedule.filter(r=>r.complete).map(round => {
      const res = results.find(r=>r.round===round.round);
      cum += res?.pts || 0;
      return cum;
    });
    new Chart(ctx, {
      type:'line',
      data: {
        labels: schedule.filter(r=>r.complete).map(r=>(r.venue||r.name||'').slice(0,3).toUpperCase()),
        datasets:[{
          data: ptData,
          borderColor: '#'+driver.color,
          backgroundColor: '#'+driver.color+'22',
          borderWidth:2, pointRadius:4, fill:true, tension:.3
        }]
      },
      options:{
        responsive:true, plugins:{legend:{display:false}},
        scales:{
          x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9}}},
          y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9}},beginAtZero:true}
        }
      }
    });
  }, 100);
}

/* ══════════════════════════════════════════════════════════
   COMPARE PAGE
══════════════════════════════════════════════════════════ */
async function initComparePage() {
  const p = params();
  const [config, comp] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/competitors-${p.series}-${p.year}.json`),
  ]);
  if (!config || !comp) return;

  const nascarMainCp = config.series.nascar;
  const isNascarSubCp = nascarMainCp && nascarMainCp.sub_series && nascarMainCp.sub_series.find(function(ss){return ss.id===p.series;});
  const series = isNascarSubCp || config.series[p.series] || {name:p.series,accent:'#27F4D2',short:p.series.toUpperCase()};
  const drivers = comp.competitors;
  setAccent(series.accent);
  document.title = 'Compare Drivers — APEX Analytics';

  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `
    <a href="index.html">Home</a><span class="sep">/</span>
    <a href="${(series.hub_url||(config.series.nascar&&config.series.nascar.hub_url)||'f1.html')}">${series.hub_url?series.name+' Hub':'NASCAR Hub'}</a><span class="sep">/</span>
    <span class="current">Compare</span>`;

  const opts = drivers.map(d => `<option value="${d.id}" ${d.id===p.a?'selected':''}>${d.name} (#${d.number})</option>`).join('');
  const optsB = drivers.map(d => `<option value="${d.id}" ${d.id===p.b?'selected':''?'selected':d.id===drivers[1]?.id&&!p.b?'selected':''}>${d.name} (#${d.number})</option>`).join('');

  const root = $('page-root');
  if (!root) return;

  root.innerHTML = `
    <div style="padding:32px var(--pad) 24px;border-bottom:1px solid var(--border)">
      <div class="label accent" style="margin-bottom:8px">Head-to-Head</div>
      <h1 style="font-family:'Bebas Neue',display;font-size:clamp(40px,6vw,72px);letter-spacing:2px;margin-bottom:20px">Compare Drivers</h1>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <select id="sel-a" onchange="updateCompare()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:8px 14px;font-family:'JetBrains Mono',monospace;font-size:9px;min-width:200px">${opts}</select>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--dim)">VS</span>
        <select id="sel-b" onchange="updateCompare()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:8px 14px;font-family:'JetBrains Mono',monospace;font-size:9px;min-width:200px">${optsB}</select>
        <button class="share-btn" onclick="shareURL({series:'${p.series}',a:$('sel-a').value,b:$('sel-b').value})">🔗 Share</button>
      </div>
    </div>
    <div id="compare-content"></div>`;

  function updateCompare() {
    const dA = drivers.find(d=>d.id===$('sel-a').value);
    const dB = drivers.find(d=>d.id===$('sel-b').value);
    if (!dA||!dB||dA.id===dB.id) return;

    const sA = dA.season_2026, sB = dB.season_2026;
    const finsA = (sA?.results_by_round||[]).map(r=>parseInt(r.finish)).filter(n=>!isNaN(n));
    const finsB = (sB?.results_by_round||[]).map(r=>parseInt(r.finish)).filter(n=>!isNaN(n));
    const avgA  = finsA.length ? (finsA.reduce((a,b)=>a+b,0)/finsA.length).toFixed(1) : '—';
    const avgB  = finsB.length ? (finsB.reduce((a,b)=>a+b,0)/finsB.length).toFixed(1) : '—';

    const row = (label, vA, vB, higher=true) => {
      const nA = parseFloat(vA)||0, nB = parseFloat(vB)||0;
      const win = higher ? (nA>nB?'a':nA<nB?'b':'') : (nA<nB?'a':nA>nB?'b':'');
      return `
        <div style="display:grid;grid-template-columns:1fr 140px 1fr;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.025)">
          <div style="font-family:'Bebas Neue',display;font-size:${win==='a'?30:22}px;color:${win==='a'?'#'+dA.color:'var(--dim)'}">${vA??'—'}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim);text-align:center">${label}</div>
          <div style="font-family:'Bebas Neue',display;font-size:${win==='b'?30:22}px;color:${win==='b'?'#'+dB.color:'var(--dim)'};text-align:right">${vB??'—'}</div>
        </div>`;
    };

    $('compare-content').innerHTML = `
      <div style="padding:24px var(--pad)">
        <div style="display:grid;grid-template-columns:1fr auto 1fr;margin-bottom:24px;border:1px solid var(--border)">
          <div style="padding:20px;background:rgba(${parseInt(dA.color.slice(0,2),16)},${parseInt(dA.color.slice(2,4),16)},${parseInt(dA.color.slice(4,6),16)},.06)">
            <div style="font-family:'Bebas Neue',display;font-size:36px;color:#${dA.color};line-height:.9">${dA.name}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);margin-top:4px">${dA.team_name} · #${dA.number}</div>
          </div>
          <div style="display:flex;align-items:center;padding:0 24px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--dim)">VS</div>
          <div style="padding:20px;text-align:right;background:rgba(${parseInt(dB.color.slice(0,2),16)},${parseInt(dB.color.slice(2,4),16)},${parseInt(dB.color.slice(4,6),16)},.06)">
            <div style="font-family:'Bebas Neue',display;font-size:36px;color:#${dB.color};line-height:.9">${dB.name}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);margin-top:4px">${dB.team_name} · #${dB.number}</div>
          </div>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:3px;text-transform:uppercase;color:var(--dim);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)">2026 Season</div>
        ${row('POINTS',       sA?.pts||0,         sB?.pts||0)}
        ${row('WINS',         sA?.wins||0,        sB?.wins||0)}
        ${row('PODIUMS',      sA?.podiums||0,     sB?.podiums||0)}
        ${row('FASTEST LAPS', sA?.fastest_laps||0,sB?.fastest_laps||0)}
        ${row('DNF / DNS',    sA?.dnfs||0,        sB?.dnfs||0,        false)}
        ${row('AVG FINISH',   avgA,               avgB,               false)}
        <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:3px;text-transform:uppercase;color:var(--dim);margin:16px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)">Career</div>
        ${row('CAREER WINS',    dA.career?.wins||0,  dB.career?.wins||0)}
        ${row('CHAMPIONSHIPS',  dA.career?.championships||0, dB.career?.championships||0)}
        <canvas id="chart-compare" height="60" style="margin-top:24px"></canvas>
      </div>`;

    // Points chart
    setTimeout(() => {
      const ctx = $('chart-compare');
      if (!ctx || typeof Chart === 'undefined') return;
      // Build from completed rounds
      const schedData = []; // would need sched data - simplified for now
      let cA=0, cB=0;
      const rounds = (sA?.results_by_round||[]).map(r=>r.round).sort();
      const pA = rounds.map(r => { const res=(sA?.results_by_round||[]).find(x=>x.round===r); cA+=res?.pts||0; return cA; });
      const pB = rounds.map(r => { const res=(sB?.results_by_round||[]).find(x=>x.round===r); cB+=res?.pts||0; return cB; });
      new Chart(ctx, {
        type:'line',
        data:{ labels:rounds.map(r=>'R'+r),
          datasets:[
            {label:dA.name,data:pA,borderColor:'#'+dA.color,backgroundColor:'#'+dA.color+'18',borderWidth:2,pointRadius:4,fill:true,tension:.3},
            {label:dB.name,data:pB,borderColor:'#'+dB.color,backgroundColor:'#'+dB.color+'18',borderWidth:2,pointRadius:4,fill:true,tension:.3},
          ]
        },
        options:{responsive:true,plugins:{legend:{display:true,labels:{color:'rgba(237,234,246,.45)',font:{family:'JetBrains Mono',size:9},boxWidth:12}}},
          scales:{
            x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9}}},
            y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9}},beginAtZero:true}
          }}
      });
    }, 50);
  }

  // Make updateCompare global
  window.updateCompare = updateCompare;
  updateCompare();
}

/* ══════════════════════════════════════════════════════════
   VENUE PAGE
══════════════════════════════════════════════════════════ */
async function initVenuePage() {
  const p = params();
  const [config, venues, sched, comp] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/venues-${p.series}-${p.year}.json`),
    loadJSON(`data/${p.series}-${p.year}.json`),
    loadJSON(`data/competitors-${p.series}-${p.year}.json`),
  ]);
  if (!config || !venues) return;

  const nascarMainV = config.series.nascar;
  const isNascarSubV = nascarMainV && nascarMainV.sub_series && nascarMainV.sub_series.find(function(ss){return ss.id===p.series;});
  const series = isNascarSubV || config.series[p.series] || {name:p.series,accent:'#27F4D2',short:p.series.toUpperCase()};
  const venue  = venues.venues?.find(v => v.id === p.id);
  if (!venue) return;

  setAccent(series.accent);
  document.title = `${venue.name} — APEX Analytics`;

  const race = sched?.schedule?.find(r => r.venue_id === venue.id);
  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `
    <a href="index.html">Home</a><span class="sep">/</span>
    <a href="${(series.hub_url||(config.series.nascar&&config.series.nascar.hub_url)||'f1.html')}">${series.hub_url?series.name+' Hub':'NASCAR Hub'}</a><span class="sep">/</span>
    <a href="circuits.html?series=${p.series}">Circuits</a><span class="sep">/</span>
    <span class="current">${venue.short}</span>`;

  const root = $('page-root');
  if (!root) return;

  const tierLabel = {1:'⭐ Iconic Circuit',2:'Established Venue',3:'Modern Circuit'}[venue.tier||3];

  root.innerHTML = `
    <div style="padding:48px var(--pad) 40px;border-bottom:1px solid var(--border);position:relative;overflow:hidden">
      <div style="position:absolute;right:-20px;bottom:-40px;font-family:'Bebas Neue',display;font-size:260px;color:rgba(255,255,255,.018);pointer-events:none;line-height:1;letter-spacing:-4px">${venue.short}</div>
      <div style="position:relative;z-index:1">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span style="font-size:28px">${venue.flag}</span>
          <span class="tag">${tierLabel}</span>
          ${race ? `<a href="race.html?series=${p.series}&round=${race.round}" class="tag accent">R${race.round} ${race.complete?'— Analysis':'— Preview'} →</a>` : ''}
        </div>
        <h1 style="font-family:'Bebas Neue',display;font-size:clamp(40px,7vw,88px);letter-spacing:2px;line-height:.88;margin-bottom:10px">${venue.name}</h1>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim)">${venue.location} · Est. ${venue.first_f1_gp}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1px;border-bottom:1px solid var(--border)">
      ${[
        {v:venue.lap_length_km+'km',  l:'Lap Length'},
        {v:venue.turns,               l:'Turns'},
        {v:venue.drs_zones,           l:'DRS Zones'},
        {v:venue.race_distance_km+'km',l:'Race Distance'},
        {v:venue.first_f1_gp,         l:'First F1 GP'},
        {v:venue.country,             l:'Country'},
      ].map(s=>`<div class="stat-cell"><div class="stat-v">${s.v||'—'}</div><div class="stat-l">${s.l}</div></div>`).join('')}
    </div>

    <div class="tab-bar">
      <button class="tab-btn active" onclick="switchTab('overview',this)">Overview</button>
      <button class="tab-btn" onclick="switchTab('history',this)">History</button>
      ${race ? `<button class="tab-btn" onclick="switchTab('race26',this)">2026 Race</button>` : ''}
    </div>

    <div class="tab-panel active" id="tab-overview">
      <div style="padding:28px var(--pad)">
        ${venue.description ? `<p style="font-size:14px;color:var(--muted);line-height:1.85;font-weight:300;max-width:680px;margin-bottom:24px">${venue.description}</p>` : ''}
        ${venue.legendary_corners?.length ? `
          <div class="label" style="margin-bottom:10px">Legendary Corners</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">
            ${venue.legendary_corners.map(c=>`<span class="tag">${c}</span>`).join('')}
          </div>` : ''}
        ${venue.strategic_notes ? `
          <div class="label" style="margin-bottom:10px">Strategic Notes</div>
          <p style="font-size:13px;color:var(--muted);line-height:1.75;font-weight:300;max-width:680px">${venue.strategic_notes}</p>` : ''}
      </div>
    </div>

    <div class="tab-panel" id="tab-history">
      <div style="padding:28px var(--pad)">
        ${venue.notable_races?.length ? `
          <div class="label" style="margin-bottom:16px">Notable Races</div>
          ${venue.notable_races.map(r=>`
            <div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.025)">
              <div style="font-family:'Bebas Neue',display;font-size:18px;letter-spacing:.5px;margin-bottom:4px">${r.year} — ${r.title||'Grand Prix'}</div>
              <div style="font-size:12.5px;color:var(--muted);font-weight:300">${r.description||''}</div>
            </div>`).join('')}` : '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--dim);letter-spacing:2px;text-transform:uppercase">Historical data coming soon.</div>'}
      </div>
    </div>

    ${race ? `
    <div class="tab-panel" id="tab-race26">
      <div style="padding:28px var(--pad)">
        ${race.complete ?
          `<p style="font-size:14px;color:var(--muted);line-height:1.85;font-weight:300;max-width:680px;margin-bottom:20px">${race.summary||''}</p>
           <a href="race.html?series=${p.series}&round=${race.round}" class="btn primary">Full Race Analysis →</a>` :
          `<p style="font-size:14px;color:var(--muted);line-height:1.85;font-weight:300;max-width:680px;margin-bottom:20px">${race.summary||'Preview coming soon.'}</p>
           <a href="race.html?series=${p.series}&round=${race.round}" class="btn ghost">Race Preview →</a>`}
      </div>
    </div>` : ''}
  `;
}

/* ══════════════════════════════════════════════════════════
   CIRCUITS INDEX
══════════════════════════════════════════════════════════ */
async function initCircuitsPage() {
  const p = params();
  const [config, venues, sched] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/venues-${p.series}-${p.year}.json`),
    loadJSON(`data/${p.series}-${p.year}.json`),
  ]);
  if (!config || !venues) return;

  const nascarMainC = config.series.nascar;
  const isNascarSubC = nascarMainC && nascarMainC.sub_series && nascarMainC.sub_series.find(function(ss){return ss.id===p.series;});
  const series = isNascarSubC || config.series[p.series] || {name:p.series,accent:'#27F4D2',short:p.series.toUpperCase()};
  setAccent(series.accent);
  document.title = series.name + ' Circuits — APEX Analytics';

  const raceResults = {};
  (sched?.schedule||[]).forEach(r => {
    if (r.complete && r.venue_id) raceResults[r.venue_id] = { winner:r.race?.winner, round:r.round };
  });

  const byTier = {1:[],2:[],3:[]};
  venues.venues.forEach(v => byTier[v.tier||3].push(v));

  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `<a href="index.html">Home</a><span class="sep">/</span><a href="${(series.hub_url||(config.series.nascar&&config.series.nascar.hub_url)||'f1.html')}">${series.hub_url?series.name+' Hub':'NASCAR Hub'}</a><span class="sep">/</span><span class="current">Circuits</span>`;

  const root = $('page-root');
  if (!root) return;

  const tierNames = {1:'Iconic Circuits',2:'Established Venues',3:'Modern Circuits'};
  const tierLabels = {1:'⭐ Iconic',2:'Established',3:'Modern'};

  root.innerHTML = `
    <div style="padding:40px var(--pad) 32px;border-bottom:1px solid var(--border)">
      <div class="label accent" style="margin-bottom:8px">${series.name} · ${p.year}</div>
      <h1 style="font-family:'Bebas Neue',display;font-size:clamp(44px,7vw,80px);letter-spacing:2px">
        Circuit Guide
      </h1>
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);margin-top:6px">${venues.venues.length} venues profiled</div>
    </div>

    ${[1,2,3].map(tier => {
      if (!byTier[tier].length) return '';
      return `
        <div style="padding:24px var(--pad) 8px;border-bottom:1px solid rgba(255,255,255,.03)">
          <div style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:var(--dim);margin-bottom:12px">
            ${tierLabels[tier]} — ${tierNames[tier]}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:2px;margin-bottom:16px">
            ${byTier[tier].map(v => {
              const result = raceResults[v.id];
              const race2026 = v['2026_race'];
              return `
                <a href="venue.html?series=${p.series}&id=${v.id}" style="display:block;background:var(--bg3);border:1px solid var(--border);border-left:3px solid ${tier===1?'#FFD700':tier===2?'var(--border-hi)':'var(--border)'};padding:16px 18px;text-decoration:none;color:inherit;transition:border-color .18s;position:relative;overflow:hidden"
                   onmouseover="this.style.borderColor='rgba(var(--accent-rgb),.3)'" onmouseout="this.style.borderColor='${tier===1?'#FFD700':tier===2?'var(--border-hi)':'var(--border)'}'">
                  <div style="position:absolute;right:-6px;top:-8px;font-family:'Bebas Neue',display;font-size:70px;color:rgba(255,255,255,.025);line-height:1;pointer-events:none">${v.short.slice(0,3).toUpperCase()}</div>
                  <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:6px;position:relative">
                    ${race2026?.round ? `R${race2026.round} · ` : ''}${v.flag} ${v.country}
                  </div>
                  <div style="font-family:'Bebas Neue',display;font-size:18px;letter-spacing:.5px;margin-bottom:4px;position:relative">${v.name}</div>
                  <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--muted);margin-bottom:10px;position:relative">${v.location}</div>
                  <div style="display:flex;gap:12px;font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);position:relative">
                    <span><strong style="color:var(--text)">${v.lap_length_km}km</strong> lap</span>
                    <span><strong style="color:var(--text)">${v.turns}</strong> turns</span>
                    <span><strong style="color:var(--text)">${v.drs_zones}</strong> DRS</span>
                  </div>
                  ${result ? `
                    <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04);font-family:'JetBrains Mono',monospace;font-size:8.5px;position:relative">
                      🏆 <span style="color:var(--accent)">${result.winner}</span>
                    </div>` : ''}
                </a>`;
            }).join('')}
          </div>
        </div>`;
    }).join('')}`;
}

/* ══════════════════════════════════════════════════════════
   SHARED: TAB SWITCHING + FAV TOGGLE
══════════════════════════════════════════════════════════ */
function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = $('tab-' + id);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
}

function toggleFavDriver(id, btn) {
  const now = Favs.toggleDriver(id);
  if (btn) {
    btn.textContent  = now ? '★' : '☆';
    btn.classList.toggle('active', now);
    // If it's the main fav-btn on competitor page, update text
    if (btn.id === 'fav-btn') {
      btn.textContent = now ? '★ Favorited' : '☆ Add to Favorites';
      btn.classList.toggle('primary', now);
      btn.classList.toggle('ghost', !now);
    }
  }
}
function dlReplayInit() {
  const el = $('replay-round-btns');
  if (el) {
    el.innerHTML = DL.completed.map((r, i) => `
      <button class="btn sm ${i===DL.completed.length-1?'active':''}" onclick="dlReplayRound(${r.round},this)">
        R${r.round} ${(r.venue||r.name||'').slice(0,3).toUpperCase()}
      </button>`).join('');
  }
  if (DL.completed.length) {
    dlReplaySetRound(DL.completed[DL.completed.length - 1].round);
  } else {
    dlReplayDrawEmpty();
  }
}

function dlReplayRound(round, btn) {
  if (btn) dlABtn(btn);
  dlReplayPause();
  dlReplaySetRound(round);
}

let _replayChart = null;
let _replayInterval = null;
let _replayFrame = 0;
let _replayData = null;

function dlReplaySetRound(round) {
  const race = DL.schedule.find(r => r.round === round);
  if (!race) return;

  const pt = race.position_tracker;
  if (!pt || !pt.drivers || !pt.labels) {
    dlReplayDrawEmpty(race.name || race.venue);
    return;
  }

  _replayFrame = 0;
  _replayData = {
    labels: pt.labels,
    drivers: pt.drivers,
    race
  };

  // Populate round select label
  const lapEl = $('replay-lap-num');
  if (lapEl) lapEl.textContent = pt.labels[0];

  const slider = $('replay-lap');
  if (slider) { slider.min = 0; slider.max = pt.labels.length - 1; slider.value = 0; }

  dlReplayDraw(0);
}

function dlReplayDraw(frame) {
  if (!_replayData) return;
  const { labels, drivers, race } = _replayData;
  const ctx = $('replay-canvas');
  if (!ctx) return;

  // Destroy old chart
  if (_replayChart) { _replayChart.destroy(); _replayChart = null; }

  const frameIdx = Math.min(frame, labels.length - 1);

  // Build current positions at this frame
  const current = drivers.map(d => ({
    name: d.name,
    color: (() => {
      const dr = DL.drivers.find(x => x.name === d.name || x.name.includes(d.name.split(' ').pop()));
      return dr ? '#' + dr.color : '#888888';
    })(),
    pos: d.positions[frameIdx] ?? d.positions[d.positions.length - 1]
  })).sort((a, b) => a.pos - b.pos);

  // Update positions sidebar
  const posEl = $('replay-positions');
  if (posEl) {
    posEl.innerHTML = current.map((d, i) => `
      <div style="display:flex;align-items:center;gap:5px;padding:3px 8px;background:var(--bg3);border:1px solid ${d.color}33">
        <span style="font-family:'Bebas Neue',display;font-size:14px;color:${i===0?'var(--accent)':'var(--dim)'};width:16px;text-align:center">${i+1}</span>
        <span style="font-family:'Bebas Neue',display;font-size:13px;color:${d.color}">${d.name.split(' ').pop()}</span>
      </div>`).join('');
  }

  // Update lap label
  const lapEl = $('replay-lap-num');
  if (lapEl) lapEl.textContent = labels[frameIdx];

  // Build chart — show position history up to current frame for each driver
  const datasets = drivers.slice(0, 10).map(d => {
    const dr = DL.drivers.find(x => x.name === d.name || x.name.includes(d.name.split(' ').pop()));
    const color = dr ? '#' + dr.color : '#888888';
    return {
      label: d.name.split(' ').pop(),
      data: d.positions.slice(0, frameIdx + 1),
      borderColor: color,
      backgroundColor: color + '18',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: color,
      fill: false,
      tension: 0.3,
    };
  });

  _replayChart = new Chart(ctx, {
    type: 'line',
    data: { labels: labels.slice(0, frameIdx + 1), datasets },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => 'Lap ' + items[0].label,
            label: item => `P${item.raw} — ${item.dataset.label}`,
          }
        }
      },
      scales: {
        x: { grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9}} },
        y: {
          reverse: true,
          min: 1, max: drivers.length,
          grid:{color:'rgba(255,255,255,.04)'},
          ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9},stepSize:1},
          title:{display:true,text:'Position',color:'rgba(237,234,246,.25)',font:{family:'JetBrains Mono',size:9}}
        }
      }
    }
  });
}

function dlReplayDrawEmpty(name) {
  const ctx = $('replay-canvas');
  if (!ctx) return;
  if (_replayChart) { _replayChart.destroy(); _replayChart = null; }
  const c = ctx.getContext('2d');
  ctx.width = ctx.offsetWidth || 800;
  ctx.height = 340;
  c.clearRect(0, 0, ctx.width, ctx.height);
  c.fillStyle = 'rgba(237,234,246,.15)';
  c.font = '11px JetBrains Mono, monospace';
  c.textAlign = 'center';
  c.fillText(name ? `No position data for ${name}` : 'No race data available', ctx.width/2, ctx.height/2);
}

function dlReplayUpdate(val) {
  _replayFrame = parseInt(val);
  dlReplayDraw(_replayFrame);
}

function dlReplayPlay() {
  if (_replayInterval) return;
  if (!_replayData) return;
  _replayInterval = setInterval(() => {
    _replayFrame++;
    if (_replayFrame >= _replayData.labels.length) {
      dlReplayPause(); return;
    }
    const slider = $('replay-lap');
    if (slider) slider.value = _replayFrame;
    dlReplayDraw(_replayFrame);
  }, 600);
}

function dlReplayPause() {
  clearInterval(_replayInterval);
  _replayInterval = null;
}

function dlReplayReset() {
  dlReplayPause();
  _replayFrame = 0;
  const slider = $('replay-lap');
  if (slider) slider.value = 0;
  dlReplayDraw(0);
}



/* ══════════════════════════════════════════════════════════
   APEX DATA LAB — Full renderer
══════════════════════════════════════════════════════════ */

const DL = {
  drivers:[], schedule:[], completed:[],
  series:'f1', year:2026,
  charts:{}, simBonus:{},
};

async function initDataLab() {
  const p = params();
  const [config, comp, sched] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/competitors-${p.series}-${p.year}.json`),
    loadJSON(`data/${p.series}-${p.year}.json`),
  ]);
  if (!config || !comp) {
    const root = $('lab-root');
    if (root) root.innerHTML = '<div style="padding:60px var(--pad);text-align:center;font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--dim);letter-spacing:2px;text-transform:uppercase">Failed to load data. Please refresh.</div>';
    return;
  }

  const series = config.series[p.series];
  setAccent(series.accent);
  DL.drivers   = comp.competitors;
  DL.schedule  = sched?.schedule || [];
  DL.completed = DL.schedule.filter(r => r.complete);
  DL.series    = p.series;
  DL.year      = p.year;
  DL.drivers.forEach(d => { DL.simBonus[d.id] = 0; });

  document.title = `APEX Data Lab — ${series.name} ${p.year}`;
  const labBadge = $('lab-nav-badge');
  if (labBadge) labBadge.innerHTML = `<div class="nav-series-dot"></div>${series.name} Data Lab`;

  const completed = DL.completed.length;
  const total     = DL.schedule.length;

  $('lab-root').innerHTML = `
    <div style="padding:40px var(--pad) 28px;border-bottom:1px solid var(--border)">
      <div class="label accent" style="margin-bottom:8px">F1 ${p.year} · ${completed} of ${total} Rounds</div>
      <div style="font-family:'Bebas Neue',display;font-size:clamp(36px,5vw,60px);letter-spacing:3px;line-height:.9">
        APEX <span style="color:var(--accent)">Data Lab</span>
      </div>
      <div style="font-size:13px;color:var(--muted);font-weight:300;margin-top:6px">Every analytical tool. No limits. All interactive.</div>
    </div>

    <div style="padding:var(--pad);display:flex;flex-direction:column;gap:2px">

      <!-- STAT CHIPS -->
      <div class="card">
        <div class="card-head"><div class="card-title">Season at a Glance · After ${completed} Rounds</div></div>
        <div class="card-body"><div id="dl-chips" style="display:flex;flex-wrap:wrap;gap:2px"></div></div>
      </div>

      <!-- HEATMAP -->
      <div class="card">
        <div class="card-head">
          <div class="card-title">Results Heatmap — All Drivers × All Rounds</div>
          <div style="display:flex;gap:3px">
            <button class="btn sm active" id="hm-pts" onclick="dlHM('pts',this)">Points</button>
            <button class="btn sm" id="hm-name" onclick="dlHM('name',this)">Name</button>
            <button class="btn sm" id="hm-avg" onclick="dlHM('avg',this)">Avg Pos</button>
          </div>
        </div>
        <div style="overflow-x:auto" id="dl-hm"></div>
      </div>

      <!-- TRAJECTORY + GAP -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px">
        <div class="card">
          <div class="card-head">
            <div class="card-title">Championship Trajectory</div>
            <div id="traj-btns" style="display:flex;gap:3px;flex-wrap:wrap"></div>
          </div>
          <div class="card-body"><canvas id="chart-traj" height="140"></canvas></div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">Gap to Leader</div></div>
          <div class="card-body" id="dl-gap"></div>
        </div>
      </div>

      <!-- SIMULATOR -->
      <div class="card">
        <div class="card-head">
          <div class="card-title">Championship Simulator — Next Race</div>
          <button class="btn sm" onclick="dlSimReset()">Reset</button>
        </div>
        <div class="card-body">
          <p style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);margin-bottom:14px;letter-spacing:.5px">Drag sliders to assign points. Standings update live.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">Assign Points</div>
              <div id="sim-sliders"></div>
            </div>
            <div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">Projected Standings</div>
              <div id="sim-results"></div>
            </div>
          </div>
          <canvas id="chart-sim" height="60" style="margin-top:16px"></canvas>
        </div>
      </div>

      <!-- TEAMMATE MATRIX -->
      <div class="card">
        <div class="card-head">
          <div class="card-title">Team-mate Battle Matrix</div>
          <div style="display:flex;gap:3px">
            <button class="btn sm active" onclick="dlTM('both',this)">Both</button>
            <button class="btn sm" onclick="dlTM('quali',this)">Qualifying</button>
            <button class="btn sm" onclick="dlTM('race',this)">Race</button>
          </div>
        </div>
        <div class="card-body"><div id="dl-tm" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:2px"></div></div>
      </div>

      <!-- DNF + CONSTRUCTORS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px">
        <div class="card">
          <div class="card-head"><div class="card-title">DNF Impact Calculator</div></div>
          <div style="overflow-x:auto"><table id="dl-dnf" style="width:100%;border-collapse:collapse"></table></div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">Constructor Breakdown</div></div>
          <div class="card-body"><canvas id="chart-con" height="200"></canvas></div>
        </div>
      </div>

      <!-- QUALI + POSITIONS GAINED -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px">
        <div class="card">
          <div class="card-head">
            <div class="card-title">Qualifying Grid Order</div>
            <div id="qd-btns" style="display:flex;gap:3px;flex-wrap:wrap"></div>
          </div>
          <div class="card-body" id="dl-qd"></div>
        </div>
        <div class="card">
          <div class="card-head">
            <div class="card-title">Positions Gained / Lost</div>
            <div id="pg-btns" style="display:flex;gap:3px;flex-wrap:wrap"></div>
          </div>
          <div class="card-body"><canvas id="chart-pg" height="200"></canvas></div>
        </div>
      </div>

      <!-- FORM GUIDE + LEAGUE -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px">
        <div class="card">
          <div class="card-head">
            <div class="card-title">Form Guide</div>
            <div style="display:flex;gap:3px">
              <button class="btn sm active" onclick="dlForm('pts',this)">Points</button>
              <button class="btn sm" onclick="dlForm('avg',this)">Avg Finish</button>
            </div>
          </div>
          <div class="card-body" id="dl-form"></div>
        </div>
        <div class="card">
          <div class="card-head">
            <div class="card-title">League Table</div>
            <div style="display:flex;gap:3px">
              <button class="btn sm active" onclick="dlLeague('pts',this)">Pts</button>
              <button class="btn sm" onclick="dlLeague('wins',this)">Wins</button>
              <button class="btn sm" onclick="dlLeague('dnf',this)">DNFs</button>
            </div>
          </div>
          <div id="dl-league"></div>
        </div>
      </div>

      <!-- RACE POSITION TRACKER -->
      <div class="card">
        <div class="card-head">
          <div class="card-title">Race Position Tracker</div>
          <div id="replay-round-btns" style="display:flex;gap:3px;flex-wrap:wrap"></div>
        </div>
        <div>
          <div class="replay-wrap">
            <canvas class="replay-track" id="replay-canvas"></canvas>
            <div class="replay-controls">
              <div class="replay-lap-label">Lap <span id="replay-lap-num" style="color:var(--accent);font-weight:500">1</span></div>
              <input type="range" id="replay-lap" class="replay-lap-input" min="1" max="56" value="1" oninput="dlReplayUpdate(this.value)">
              <button class="btn sm" onclick="dlReplayPlay()">▶ Play</button>
              <button class="btn sm" onclick="dlReplayPause()">⏸ Pause</button>
              <button class="btn sm" onclick="dlReplayReset()">⏮ Reset</button>
            </div>
            <div class="replay-positions" id="replay-positions"></div>
          </div>
        </div>
      </div>

      <!-- H2H -->
      <div class="card">
        <div class="card-head">
          <div class="card-title">Head-to-Head Deep Dive</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <select id="h2h-a" onchange="dlH2H()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:5px 10px;font-family:'JetBrains Mono',monospace;font-size:8px"></select>
            <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim)">vs</span>
            <select id="h2h-b" onchange="dlH2H()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:5px 10px;font-family:'JetBrains Mono',monospace;font-size:8px"></select>
            <button class="share-btn" onclick="shareURL({series:'${p.series}',tool:'h2h',a:document.getElementById('h2h-a')?.value,b:document.getElementById('h2h-b')?.value})">🔗 Share</button>
          </div>
        </div>
        <div class="card-body" id="dl-h2h"></div>
      </div>

    </div>`;

  // Boot all tools
  dlChips(); dlHM('pts',null); dlTrajectory(); dlGap();
  dlSimInit(); dlTM('both',null); dlDNF(); dlConstructors();
  dlQDControls(); dlPGControls();
  dlForm('pts',null); dlLeague('pts',null); dlH2HInit();
  dlReplayInit();
  if ($('footer-copy')) $('footer-copy').textContent = `APEX Data Lab · F1 ${p.year} · ${completed} rounds`;
}

/* ── shared helpers ── */
function dlABtn(btn) {
  btn.closest('[style*="display:flex"]')?.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
function dlDestroy(id) { if(DL.charts[id]){DL.charts[id].destroy();delete DL.charts[id];} }
const DLC = {
  x:{ grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9}} },
  y:{ grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9}}, beginAtZero:true },
};

/* ── Stat chips ── */
function dlChips() {
  const sorted = [...DL.drivers].sort((a,b)=>(b.season_2026?.pts||0)-(a.season_2026?.pts||0));
  const leader=sorted[0], p2=sorted[1];
  const gap=(leader?.season_2026?.pts||0)-(p2?.season_2026?.pts||0);
  const conMap={};
  DL.drivers.forEach(d=>{conMap[d.team]=(conMap[d.team]||0)+(d.season_2026?.pts||0);});
  const conLeader=Object.entries(conMap).sort((a,b)=>b[1]-a[1])[0];
  const chips=[
    {v:leader?.season_2026?.pts||0, l:`${leader?.name.split(' ').pop()||'—'} leads`},
    {v:'+'+gap, l:'Gap to P2'},
    {v:DL.completed.length, l:'Rounds complete'},
    {v:DL.drivers.filter(d=>d.season_2026?.wins>0).length, l:'Different winners'},
    {v:DL.drivers.reduce((s,d)=>s+(d.season_2026?.dnfs||0),0), l:'Total DNF/DNS'},
    {v:conLeader?.[0]||'—', l:'Constructor leader'},
    {v:conLeader?.[1]||0, l:'Constructor pts'},
    {v:DL.drivers.filter(d=>!(d.season_2026?.pts||0)).length, l:'Scoreless drivers'},
  ];
  const el=$('dl-chips');
  if(el) el.innerHTML=chips.map(c=>`
    <div style="padding:10px 16px;background:var(--bg3);border:1px solid var(--border)">
      <div style="font-family:'Bebas Neue',display;font-size:26px;line-height:1;color:var(--accent)">${c.v}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim);margin-top:3px">${c.l}</div>
    </div>`).join('');
}

/* ── Heatmap ── */
function dlHM(sort, btn) {
  if(btn) dlABtn(btn);
  const drivers=[...DL.drivers];
  if(sort==='pts')  drivers.sort((a,b)=>(b.season_2026?.pts||0)-(a.season_2026?.pts||0));
  if(sort==='name') drivers.sort((a,b)=>a.name.localeCompare(b.name));
  if(sort==='avg')  drivers.sort((a,b)=>{
    const avg=d=>{const f=(d.season_2026?.results_by_round||[]).map(r=>parseInt(r.finish)).filter(n=>!isNaN(n));return f.length?f.reduce((s,v)=>s+v,0)/f.length:99;};
    return avg(a)-avg(b);
  });
  const rounds=DL.schedule;
  let html=`<table style="border-collapse:collapse;min-width:100%"><thead><tr>
    <th style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:1px;text-transform:uppercase;color:var(--dim);padding:5px 10px;border:1px solid rgba(255,255,255,.04);text-align:left;min-width:110px">Driver</th>
    ${rounds.map(r=>`<th style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:1px;text-transform:uppercase;color:var(--dim);padding:5px 7px;border:1px solid rgba(255,255,255,.04);text-align:center;white-space:nowrap" title="${r.venue||r.name}">${(r.venue||r.name||'').slice(0,3).toUpperCase()}</th>`).join('')}
    <th style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim);padding:5px 10px;border:1px solid rgba(255,255,255,.04);text-align:right">Pts</th>
    <th style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim);padding:5px 10px;border:1px solid rgba(255,255,255,.04);text-align:right">W</th>
    <th style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim);padding:5px 10px;border:1px solid rgba(255,255,255,.04);text-align:right">DNF</th>
  </tr></thead><tbody>`;
  drivers.forEach(d=>{
    const res=d.season_2026?.results_by_round||[];
    const rmap={}; res.forEach(r=>rmap[r.round]=r);
    html+=`<tr>
      <td style="padding:4px 10px;border:1px solid rgba(255,255,255,.025);border-left:3px solid #${d.color};vertical-align:middle">
        <div style="font-family:'Bebas Neue',display;font-size:13px">${d.name}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:6.5px;color:var(--dim)">${d.team_name}</div>
      </td>
      ${rounds.map(round=>{
        const r=rmap[round.round];
        const fin=r?r.finish:null;
        return `<td class="${posClass(fin)}" style="width:36px;height:34px;text-align:center;vertical-align:middle;font-family:'Bebas Neue',display;font-size:14px;border:1px solid rgba(255,255,255,.025);cursor:pointer" title="${d.name} R${round.round}: ${posLabel(fin)} (+${r?.pts||0}pts)">${posLabel(fin)}</td>`;
      }).join('')}
      <td style="padding:4px 10px;text-align:right;font-family:'Bebas Neue',display;font-size:16px;border:1px solid rgba(255,255,255,.025);color:${d.season_2026?.pts>0?'#'+d.color:'var(--dim)'}">${d.season_2026?.pts||0}</td>
      <td style="padding:4px 10px;text-align:right;font-family:'Bebas Neue',display;font-size:16px;border:1px solid rgba(255,255,255,.025);color:${d.season_2026?.wins?'#FFD700':'var(--dim)'}">${d.season_2026?.wins||'—'}</td>
      <td style="padding:4px 10px;text-align:right;font-family:'Bebas Neue',display;font-size:16px;border:1px solid rgba(255,255,255,.025);color:${d.season_2026?.dnfs?'var(--red)':'var(--dim)'}">${d.season_2026?.dnfs||'—'}</td>
    </tr>`;
  });
  html+='</tbody></table>';
  const el=$('dl-hm'); if(el) el.innerHTML=html;
}

/* ── Trajectory ── */
function dlTrajectory() {
  const top8=[...DL.drivers].sort((a,b)=>(b.season_2026?.pts||0)-(a.season_2026?.pts||0)).slice(0,8);
  const labels=DL.completed.map(r=>(r.venue||r.name||'').slice(0,3).toUpperCase());
  if(!labels.length) labels.push('—');
  const el=$('traj-btns');
  if(el) el.innerHTML=top8.map(d=>`<button class="btn sm active" data-id="${d.id}" onclick="dlTrajToggle('${d.id}',this)" style="border-color:#${d.color}55;color:#${d.color}">${d.name.split(' ').pop()}</button>`).join('');
  const datasets=top8.map(d=>{
    let cum=0;
    return{label:d.name,data:DL.completed.map(r=>{const res=(d.season_2026?.results_by_round||[]).find(x=>x.round===r.round);cum+=res?.pts||0;return cum;}),borderColor:'#'+d.color,backgroundColor:'#'+d.color+'18',borderWidth:2,pointRadius:4,fill:false,tension:.3};
  });
  dlDestroy('traj');
  const ctx=$('chart-traj'); if(!ctx) return;
  DL.charts.traj=new Chart(ctx,{type:'line',data:{labels,datasets},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:DLC.x,y:DLC.y}}});
}
function dlTrajToggle(id,btn) {
  btn.classList.toggle('active');
  const ch=DL.charts.traj; if(!ch) return;
  const d=DL.drivers.find(x=>x.id===id);
  const ds=ch.data.datasets.find(x=>x.label===d?.name);
  if(ds){ds.hidden=!btn.classList.contains('active');ch.update();}
}

/* ── Gap ── */
function dlGap() {
  const sorted=[...DL.drivers].sort((a,b)=>(b.season_2026?.pts||0)-(a.season_2026?.pts||0)).slice(0,10);
  const max=sorted[0]?.season_2026?.pts||1;
  const el=$('dl-gap'); if(!el) return;
  el.innerHTML=sorted.map((d,i)=>{
    const pts=d.season_2026?.pts||0;
    return`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.025)">
      <div style="font-family:'Bebas Neue',display;font-size:17px;color:${i===0?'var(--accent)':'var(--dim)'};width:18px;text-align:center">${i+1}</div>
      <div style="font-family:'Bebas Neue',display;font-size:15px;width:82px;flex-shrink:0">${d.name.split(' ').pop()}</div>
      <div style="flex:1;height:5px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${Math.round(pts/max*100)}%;background:#${d.color};border-radius:2px;transition:width .7s"></div>
      </div>
      <div style="font-family:'Bebas Neue',display;font-size:19px;color:${i===0?'var(--accent)':'var(--text)'};width:26px;text-align:right">${pts}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim);width:32px;text-align:right">${max-pts>0?'−'+(max-pts):'Ldr'}</div>
    </div>`;
  }).join('');
}

/* ── Simulator ── */
function dlSimInit() {
  const top10=[...DL.drivers].sort((a,b)=>(b.season_2026?.pts||0)-(a.season_2026?.pts||0)).slice(0,10);
  const el=$('sim-sliders'); if(!el) return;
  el.innerHTML=top10.map(d=>`
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.025)">
      <div style="width:7px;height:7px;border-radius:50%;background:#${d.color};flex-shrink:0"></div>
      <div style="font-family:'Bebas Neue',display;font-size:15px;flex:1;min-width:70px">${d.name.split(' ').pop()}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:8.5px;color:var(--dim);width:28px;text-align:right">${d.season_2026?.pts||0}</div>
      <input type="range" min="0" max="25" value="0" id="simr-${d.id}" oninput="dlSimUpdate('${d.id}',this.value)" style="flex:1;accent-color:var(--accent);max-width:130px">
      <div style="font-family:'Bebas Neue',display;font-size:17px;width:32px;text-align:right;color:#${d.color}" id="simv-${d.id}">+0</div>
    </div>`).join('');
  dlSimResults();
}
function dlSimUpdate(id,val) {
  DL.simBonus[id]=parseInt(val);
  const el=$(`simv-${id}`); if(el) el.textContent='+'+val;
  dlSimResults();
}
function dlSimReset() {
  DL.drivers.forEach(d=>{DL.simBonus[d.id]=0;});
  document.querySelectorAll('[id^="simr-"]').forEach(s=>{s.value=0;});
  document.querySelectorAll('[id^="simv-"]').forEach(e=>{e.textContent='+0';});
  dlSimResults();
}
function dlSimResults() {
  const proj=DL.drivers.map(d=>({...d,pp:(d.season_2026?.pts||0)+(DL.simBonus[d.id]||0)})).sort((a,b)=>b.pp-a.pp);
  const el=$('sim-results'); if(!el) return;
  el.innerHTML=proj.slice(0,8).map((d,i)=>{
    const delta=DL.simBonus[d.id]||0;
    const dc=delta>0?'var(--green)':delta<0?'var(--red)':'var(--dim)';
    return`<div style="display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.025)">
      <div style="font-family:'Bebas Neue',display;font-size:18px;color:${i===0?'var(--accent)':'var(--dim)'};width:20px;text-align:center">${i+1}</div>
      <div style="width:6px;height:6px;border-radius:50%;background:#${d.color};flex-shrink:0"></div>
      <div style="font-family:'Bebas Neue',display;font-size:15px;flex:1">${d.name.split(' ').pop()}</div>
      <div style="font-family:'Bebas Neue',display;font-size:20px;color:${i===0?'var(--accent)':'var(--text)'}">${d.pp}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:${dc};width:32px;text-align:right">${delta>0?'+'+delta:delta===0?'—':delta}</div>
    </div>`;
  }).join('');
  dlDestroy('sim');
  const ctx=$('chart-sim'); if(!ctx) return;
  const top8=proj.slice(0,8);
  DL.charts.sim=new Chart(ctx,{type:'bar',data:{labels:top8.map(d=>d.name.split(' ').pop()),datasets:[{label:'Current',data:top8.map(d=>d.season_2026?.pts||0),backgroundColor:top8.map(d=>'#'+d.color+'55'),borderColor:top8.map(d=>'#'+d.color),borderWidth:1},{label:'Added',data:top8.map(d=>DL.simBonus[d.id]||0),backgroundColor:top8.map(d=>'#'+d.color+'BB'),borderColor:top8.map(d=>'#'+d.color),borderWidth:1}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{...DLC.x,stacked:true},y:{...DLC.y,stacked:true}}}});
}

/* ── Teammates ── */
function dlTM(mode,btn) {
  if(btn) dlABtn(btn);
  const teamMap={};
  DL.drivers.forEach(d=>{if(!teamMap[d.team])teamMap[d.team]=[];teamMap[d.team].push(d);});
  const el=$('dl-tm'); if(!el) return;
  el.innerHTML=Object.entries(teamMap).filter(([,t])=>t.length>=2).map(([name,team])=>{
    const dA=team[0],dB=team[1];
    let qA=0,qB=0,rA=0,rB=0;
    DL.completed.forEach(round=>{
      const resA=(dA.season_2026?.results_by_round||[]).find(r=>r.round===round.round);
      const resB=(dB.season_2026?.results_by_round||[]).find(r=>r.round===round.round);
      if(resA?.grid&&resB?.grid){parseInt(resA.grid)<parseInt(resB.grid)?qA++:qB++;}
      const fA=parseInt(resA?.finish),fB=parseInt(resB?.finish);
      if(!isNaN(fA)&&!isNaN(fB)){fA<fB?rA++:rB++;}
    });
    const qT=Math.max(qA+qB,1),rT=Math.max(rA+rB,1);
    const showQ=mode!=='race',showR=mode!=='quali';
    return`<div style="background:var(--bg3);border:1px solid var(--border);padding:14px 16px">
      <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:#${dA.color};margin-bottom:8px">${dA.team_name}</div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;margin-bottom:10px">
        <div style="font-family:'Bebas Neue',display;font-size:17px;color:#${dA.color}">${dA.name.split(' ').pop()}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim)">vs</div>
        <div style="font-family:'Bebas Neue',display;font-size:17px;color:#${dB.color};text-align:right">${dB.name.split(' ').pop()}</div>
      </div>
      ${showQ?`<div style="font-family:'JetBrains Mono',monospace;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim);display:flex;justify-content:space-between;margin-bottom:3px"><span>QUALIFYING</span><span>${qA}–${qB}</span></div><div style="height:5px;display:flex;background:var(--bg2);border-radius:2px;overflow:hidden;margin-bottom:8px"><div style="width:${(qA/qT)*100}%;background:#${dA.color};opacity:.7"></div><div style="width:${(qB/qT)*100}%;background:#${dB.color};opacity:.7;margin-left:auto"></div></div>`:''}
      ${showR?`<div style="font-family:'JetBrains Mono',monospace;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim);display:flex;justify-content:space-between;margin-bottom:3px"><span>RACE</span><span>${rA}–${rB}</span></div><div style="height:5px;display:flex;background:var(--bg2);border-radius:2px;overflow:hidden;margin-bottom:8px"><div style="width:${(rA/rT)*100}%;background:#${dA.color};opacity:.7"></div><div style="width:${(rB/rT)*100}%;background:#${dB.color};opacity:.7;margin-left:auto"></div></div>`:''}
      <div style="display:flex;justify-content:space-between;font-family:'Bebas Neue',display;font-size:20px;margin-top:6px">
        <span style="color:#${dA.color}">${dA.season_2026?.pts||0}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim)">pts</span>
        <span style="color:#${dB.color}">${dB.season_2026?.pts||0}</span>
      </div>
    </div>`;
  }).join('');
}

/* ── DNF Calculator ── */
function dlDNF() {
  const el=$('dl-dnf'); if(!el) return;
  const affected=DL.drivers.filter(d=>d.season_2026?.dnfs>0).sort((a,b)=>b.season_2026.dnfs-a.season_2026.dnfs);
  const pot={DNF:4,DNS:2};
  el.innerHTML=`<thead><tr>${['Driver','Actual','Bonus','Potential','Incidents'].map(h=>`<th style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);padding:8px 14px;text-align:left;border-bottom:1px solid var(--border)">${h}</th>`).join('')}</tr></thead>
  <tbody>${affected.map(d=>{
    const res=d.season_2026?.results_by_round||[];
    const bonus=res.reduce((s,r)=>{const f=String(r.finish).toUpperCase();return f==='DNF'?s+pot.DNF:f==='DNS'?s+pot.DNS:s;},0);
    const incidents=res.filter(r=>['DNF','DNS'].includes(String(r.finish).toUpperCase())).map(r=>`R${r.round}:${r.finish}`).join(', ');
    return`<tr onmouseover="this.style.background='rgba(255,255,255,.014)'" onmouseout="this.style.background=''">
      <td style="padding:9px 14px;border-bottom:1px solid rgba(255,255,255,.025)"><div style="font-family:'Bebas Neue',display;font-size:17px;color:#${d.color}">${d.name}</div><div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim)">${d.team_name}</div></td>
      <td style="padding:9px 14px;font-family:'Bebas Neue',display;font-size:20px;border-bottom:1px solid rgba(255,255,255,.025)">${d.season_2026?.pts||0}</td>
      <td style="padding:9px 14px;font-family:'Bebas Neue',display;font-size:20px;color:var(--green);border-bottom:1px solid rgba(255,255,255,.025)">+${bonus}</td>
      <td style="padding:9px 14px;font-family:'Bebas Neue',display;font-size:20px;color:var(--green);border-bottom:1px solid rgba(255,255,255,.025)">${(d.season_2026?.pts||0)+bonus}</td>
      <td style="padding:9px 14px;font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--red);border-bottom:1px solid rgba(255,255,255,.025)">${incidents}</td>
    </tr>`;
  }).join('')}</tbody>
  <tfoot><tr><td colspan="5" style="padding:8px 14px;font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim);font-style:italic">DNF = P8 (4pts) · DNS = P15 (2pts) · Conservative estimate</td></tr></tfoot>`;
}

/* ── Constructors ── */
function dlConstructors() {
  const teamMap={};
  DL.drivers.forEach(d=>{if(!teamMap[d.team])teamMap[d.team]={name:d.team_name||d.team,drivers:[],color:'#'+d.color};teamMap[d.team].drivers.push(d);});
  const teams=Object.values(teamMap).map(t=>({...t,total:t.drivers.reduce((s,d)=>s+(d.season_2026?.pts||0),0)})).sort((a,b)=>b.total-a.total).slice(0,8);
  dlDestroy('con');
  const ctx=$('chart-con'); if(!ctx) return;
  DL.charts.con=new Chart(ctx,{type:'bar',data:{labels:teams.map(t=>t.name),datasets:[
    {label:'D1',data:teams.map(t=>t.drivers[0]?.season_2026?.pts||0),backgroundColor:teams.map(t=>t.drivers[0]?'#'+t.drivers[0].color+'CC':t.color),borderColor:teams.map(t=>t.drivers[0]?'#'+t.drivers[0].color:t.color),borderWidth:1},
    {label:'D2',data:teams.map(t=>t.drivers[1]?.season_2026?.pts||0),backgroundColor:teams.map(t=>t.drivers[1]?'#'+t.drivers[1].color+'66':t.color),borderColor:teams.map(t=>t.drivers[1]?'#'+t.drivers[1].color:t.color),borderWidth:1},
  ]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{...DLC.x,stacked:true},y:{...DLC.y,stacked:true}}}});
}

/* ── Qualifying delta ── */
let dlQDRound=null;
function dlQDControls() {
  const el=$('qd-btns'); if(!el) return;
  el.innerHTML=DL.completed.map((r,i)=>`<button class="btn sm ${i===0?'active':''}" onclick="dlQD(${r.round},this)">${(r.venue||r.name||'').slice(0,3).toUpperCase()}</button>`).join('');
  if(DL.completed.length){dlQDRound=DL.completed[0].round;dlQDRender();}
}
function dlQD(round,btn){dlQDRound=round;if(btn)dlABtn(btn);dlQDRender();}
function dlQDRender(){
  const el=$('dl-qd'); if(!el) return;
  const res=DL.drivers.map(d=>({d,res:(d.season_2026?.results_by_round||[]).find(r=>r.round===dlQDRound)})).filter(({res})=>res&&res.grid!=null&&!isNaN(parseInt(res.grid))).sort((a,b)=>a.res.grid-b.res.grid);
  if(!res.length){el.innerHTML='<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--dim)">No qualifying data</div>';return;}
  const maxG=Math.max(...res.map(({res})=>parseInt(res.grid)),1)-1||1;
  el.innerHTML=res.map(({d,res:r},i)=>{const g=parseInt(r.grid)-1,pct=Math.max((g/maxG)*100,2);return`<div style="display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.025)"><div style="font-family:'Bebas Neue',display;font-size:17px;color:var(--dim);width:18px;text-align:center">${r.grid}</div><div style="font-family:'Bebas Neue',display;font-size:14px;width:82px;flex-shrink:0;color:${i<3?'#'+d.color:'var(--text)'}">${d.name.split(' ').pop()}</div><div style="flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden"><div style="height:100%;width:${pct}%;background:#${d.color};opacity:${Math.max(.85-i*.04,.3)};transition:width .5s"></div></div><div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:${g===0?'var(--accent)':'var(--muted)'};width:46px;text-align:right">${g===0?'POLE':'+'+g}</div></div>`;}).join('');
}

/* ── Positions gained ── */
let dlPGMode='all';
function dlPGControls(){
  const el=$('pg-btns'); if(!el) return;
  el.innerHTML=`<button class="btn sm active" onclick="dlPG('all',this)">Season</button>${DL.completed.map(r=>`<button class="btn sm" onclick="dlPG(${r.round},this)">R${r.round}</button>`).join('')}`;
  dlPG('all',null);
}
function dlPG(mode,btn){
  dlPGMode=mode; if(btn)dlABtn(btn);
  const rounds=mode==='all'?DL.completed:DL.completed.filter(r=>r.round===mode);
  const data=DL.drivers.map(d=>{
    let g=0;rounds.forEach(round=>{const res=(d.season_2026?.results_by_round||[]).find(r=>r.round===round.round);if(res?.grid&&typeof res.finish==='number')g+=parseInt(res.grid)-res.finish;});
    return{d,g};
  }).filter(x=>x.g!==0).sort((a,b)=>b.g-a.g);
  dlDestroy('pg');
  const ctx=$('chart-pg'); if(!ctx||!data.length) return;
  DL.charts.pg=new Chart(ctx,{type:'bar',data:{labels:data.map(x=>x.d.name.split(' ').pop()),datasets:[{data:data.map(x=>x.g),backgroundColor:data.map(x=>x.g>0?'#00D47C88':'#E8002D88'),borderColor:data.map(x=>x.g>0?'#00D47C':'#E8002D'),borderWidth:1}]},options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false}},scales:{x:{...DLC.x,beginAtZero:true},y:DLC.x}}});
}

/* ── Form guide ── */
function dlForm(mode,btn){
  if(btn) dlABtn(btn);
  const sorted=[...DL.drivers].sort((a,b)=>{
    if(mode==='pts') return (b.season_2026?.pts||0)-(a.season_2026?.pts||0);
    const avg=d=>{const f=(d.season_2026?.results_by_round||[]).map(r=>parseInt(r.finish)).filter(n=>!isNaN(n));return f.length?f.reduce((s,v)=>s+v,0)/f.length:99;};
    return avg(a)-avg(b);
  });
  const el=$('dl-form'); if(!el) return;
  el.innerHTML=sorted.slice(0,14).map((d,i)=>{
    const res=d.season_2026?.results_by_round||[];
    const rmap={}; res.forEach(r=>rmap[r.round]=r);
    const fins=res.map(r=>parseInt(r.finish)).filter(n=>!isNaN(n));
    const avg=fins.length?(fins.reduce((s,v)=>s+v,0)/fins.length).toFixed(1):'—';
    const dots=DL.schedule.map(round=>{const r=rmap[round.round];const fin=r?r.finish:null;return`<span class="${posClass(fin)}" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;font-family:'Bebas Neue',display;font-size:12px;cursor:pointer" title="${round.venue||round.name}: ${posLabel(fin)}">${posLabel(fin)}</span>`;}).join('');
    return`<div style="display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.025)"><div style="font-family:'Bebas Neue',display;font-size:16px;color:${i===0?'var(--accent)':'var(--dim)'};width:18px;text-align:center">${i+1}</div><div style="font-family:'Bebas Neue',display;font-size:14px;width:82px;flex-shrink:0;color:#${d.color}">${d.name.split(' ').pop()}</div><div style="display:flex;gap:2px">${dots}</div><div style="font-family:'Bebas Neue',display;font-size:18px;color:${d.season_2026?.pts>0?'#'+d.color:'var(--dim)'};margin-left:auto;flex-shrink:0">${d.season_2026?.pts||0}</div><div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim);width:26px;text-align:right">~${avg}</div></div>`;
  }).join('');
}

/* ── League table ── */
function dlLeague(sort,btn){
  if(btn) dlABtn(btn);
  const sorted=[...DL.drivers].sort((a,b)=>{
    const sA=a.season_2026,sB=b.season_2026;
    if(sort==='pts') return (sB?.pts||0)-(sA?.pts||0);
    if(sort==='wins') return (sB?.wins||0)-(sA?.wins||0);
    if(sort==='dnf') return (sB?.dnfs||0)-(sA?.dnfs||0);
    return 0;
  });
  const max=Math.max(...sorted.map(d=>d.season_2026?.pts||0),1);
  const el=$('dl-league'); if(!el) return;
  el.innerHTML=`<table style="width:100%;border-collapse:collapse">
    <thead><tr>${['Pos','Driver','Pts','W','P','DNF'].map(h=>`<th style="padding:7px 12px;font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);text-align:left;border-bottom:1px solid var(--border)">${h}</th>`).join('')}<th style="border-bottom:1px solid var(--border)"></th></tr></thead>
    <tbody>${sorted.map((d,i)=>{
      const s=d.season_2026,pct=sort==='pts'?Math.round(((s?.pts||0)/max)*100):0;
      const fav=Favs.hasDriver(d.id);
      return`<tr onclick="location.href='competitor.html?series=${DL.series}&id=${d.id}'" onmouseover="this.style.background='rgba(255,255,255,.014)'" onmouseout="this.style.background=''" style="cursor:pointer;border-bottom:1px solid rgba(255,255,255,.025);position:relative">
        <td style="padding:8px 12px;font-family:'Bebas Neue',display;font-size:17px;color:${i<2?'var(--accent)':'var(--dim)'}">${i+1}</td>
        <td style="padding:8px 12px;position:relative">
          <div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:#${d.color};opacity:.07;pointer-events:none"></div>
          <div style="position:relative;display:flex;align-items:center;gap:6px">
            <div style="width:3px;height:28px;background:#${d.color};flex-shrink:0"></div>
            <div><div style="font-family:'Bebas Neue',display;font-size:15px">${d.name}</div><div style="font-family:'JetBrains Mono',monospace;font-size:7px;color:var(--dim)">${d.team_name}</div></div>
          </div>
        </td>
        <td style="padding:8px 12px;font-family:'Bebas Neue',display;font-size:19px;color:${i===0?'var(--accent)':'var(--text)'}">${s?.pts||0}</td>
        <td style="padding:8px 12px;font-family:'Bebas Neue',display;font-size:17px;color:${s?.wins?'#FFD700':'var(--dim)'}">${s?.wins||'—'}</td>
        <td style="padding:8px 12px;font-family:'Bebas Neue',display;font-size:17px;color:var(--muted)">${s?.podiums||'—'}</td>
        <td style="padding:8px 12px;font-family:'Bebas Neue',display;font-size:17px;color:${s?.dnfs?'var(--red)':'var(--dim)'}">${s?.dnfs||'—'}</td>
        <td style="padding:8px 12px"><button class="sr-fav ${fav?'active':''}" onclick="event.stopPropagation();toggleFavDriver('${d.id}',this)">${fav?'★':'☆'}</button></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

/* ── H2H ── */
function dlH2HInit(){
  const opts=DL.drivers.map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
  const a=$('h2h-a'),b=$('h2h-b'); if(!a||!b) return;
  a.innerHTML=opts; b.innerHTML=opts;
  const s=[...DL.drivers].sort((a,b)=>(b.season_2026?.pts||0)-(a.season_2026?.pts||0));
  a.value=s[0]?.id||''; b.value=s[1]?.id||'';
  dlH2H();
}
function dlH2H(){
  const dA=DL.drivers.find(d=>d.id===$('h2h-a')?.value);
  const dB=DL.drivers.find(d=>d.id===$('h2h-b')?.value);
  const el=$('dl-h2h'); if(!el) return;
  if(!dA||!dB||dA.id===dB.id){el.innerHTML='<p style="color:var(--dim);font-family:\'JetBrains Mono\',monospace;font-size:9px">Select two different drivers.</p>';return;}
  const sA=dA.season_2026,sB=dB.season_2026;
  let qA=0,qB=0,rA=0,rB=0;
  DL.completed.forEach(round=>{
    const resA=(sA?.results_by_round||[]).find(r=>r.round===round.round);
    const resB=(sB?.results_by_round||[]).find(r=>r.round===round.round);
    if(resA?.grid&&resB?.grid){parseInt(resA.grid)<parseInt(resB.grid)?qA++:qB++;}
    const fA=parseInt(resA?.finish),fB=parseInt(resB?.finish);
    if(!isNaN(fA)&&!isNaN(fB)){fA<fB?rA++:rB++;}
  });
  const finsA=(sA?.results_by_round||[]).map(r=>parseInt(r.finish)).filter(n=>!isNaN(n));
  const finsB=(sB?.results_by_round||[]).map(r=>parseInt(r.finish)).filter(n=>!isNaN(n));
  const avgA=finsA.length?(finsA.reduce((a,b)=>a+b,0)/finsA.length).toFixed(1):'—';
  const avgB=finsB.length?(finsB.reduce((a,b)=>a+b,0)/finsB.length).toFixed(1):'—';
  const row=(label,vA,vB,higher=true)=>{
    const nA=parseFloat(vA)||0,nB=parseFloat(vB)||0;
    const w=higher?(nA>nB?'a':nA<nB?'b':''):(nA<nB?'a':nA>nB?'b':'');
    return`<div style="display:grid;grid-template-columns:1fr 130px 1fr;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.025)">
      <div style="font-family:'Bebas Neue',display;font-size:${w==='a'?26:20}px;color:${w==='a'?'#'+dA.color:'var(--dim)'}">${vA??'—'}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim);text-align:center">${label}</div>
      <div style="font-family:'Bebas Neue',display;font-size:${w==='b'?26:20}px;color:${w==='b'?'#'+dB.color:'var(--dim)'};text-align:right">${vB??'—'}</div>
    </div>`;
  };
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr auto 1fr;border:1px solid var(--border);margin-bottom:16px">
      <div style="padding:16px;background:rgba(${parseInt(dA.color.slice(0,2),16)},${parseInt(dA.color.slice(2,4),16)},${parseInt(dA.color.slice(4,6),16)},.06)">
        <div style="font-family:'Bebas Neue',display;font-size:28px;color:#${dA.color};line-height:.9">${dA.name}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim);margin-top:3px">${dA.team_name} · #${dA.number}</div>
      </div>
      <div style="display:flex;align-items:center;padding:0 20px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--dim)">VS</div>
      <div style="padding:16px;text-align:right;background:rgba(${parseInt(dB.color.slice(0,2),16)},${parseInt(dB.color.slice(2,4),16)},${parseInt(dB.color.slice(4,6),16)},.06)">
        <div style="font-family:'Bebas Neue',display;font-size:28px;color:#${dB.color};line-height:.9">${dB.name}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:7.5px;color:var(--dim);margin-top:3px">${dB.team_name} · #${dB.number}</div>
      </div>
    </div>
    ${row('POINTS',sA?.pts||0,sB?.pts||0)}
    ${row('WINS',sA?.wins||0,sB?.wins||0)}
    ${row('PODIUMS',sA?.podiums||0,sB?.podiums||0)}
    ${row('DNF/DNS',sA?.dnfs||0,sB?.dnfs||0,false)}
    ${row('AVG FINISH',avgA,avgB,false)}
    ${row(`QUALIFYING ${qA}–${qB}`,qA,qB)}
    ${row(`RACE ${rA}–${rB}`,rA,rB)}
    ${row('CAREER WINS',dA.career?.wins||0,dB.career?.wins||0)}
    <canvas id="chart-h2h" height="60" style="margin-top:16px"></canvas>`;

  setTimeout(()=>{
    dlDestroy('h2h');
    let cA=0,cB=0;
    const labels=DL.completed.map(r=>(r.venue||r.name||'').slice(0,3).toUpperCase());
    const pA=DL.completed.map(r=>{const res=(sA?.results_by_round||[]).find(x=>x.round===r.round);cA+=res?.pts||0;return cA;});
    const pB=DL.completed.map(r=>{const res=(sB?.results_by_round||[]).find(x=>x.round===r.round);cB+=res?.pts||0;return cB;});
    const ctx=$('chart-h2h'); if(!ctx) return;
    DL.charts.h2h=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:dA.name,data:pA,borderColor:'#'+dA.color,backgroundColor:'#'+dA.color+'18',borderWidth:2,pointRadius:4,fill:true,tension:.3},{label:dB.name,data:pB,borderColor:'#'+dB.color,backgroundColor:'#'+dB.color+'18',borderWidth:2,pointRadius:4,fill:true,tension:.3}]},options:{responsive:true,plugins:{legend:{display:true,labels:{color:'rgba(237,234,246,.45)',font:{family:'JetBrains Mono',size:9},boxWidth:12}}},scales:{x:DLC.x,y:DLC.y}}});
  },50);
}

/* ══════════════════════════════════════════════════════════
   LANDING PAGE — initLandingPage()
   Called from index.html inline script
══════════════════════════════════════════════════════════ */
async function initLandingPage() {
  const [config] = await Promise.all([
    loadJSON('data/config.json'),
  ]);
  if (!config) return;

  // Load data for each active series
  const seriesDataMap = {};
  const activeSeries = Object.entries(config.series).filter(function(e){ return e[1].active; });
  await Promise.all(activeSeries.map(async function(entry) {
    const sid = entry[0], s = entry[1];
    const compFile = s.competitors_file || ('competitors-' + sid + '-' + (s.current_year||2026) + '.json');
    const schedFile = s.season_file ? s.season_file + '.json' : (sid + '-' + (s.current_year||2026) + '.json');
    const [comp, sched] = await Promise.all([
      loadJSON('data/' + compFile),
      loadJSON('data/' + schedFile),
    ]);
    seriesDataMap[sid] = { s, comp, sched };
  }));

  // Use F1 data for hero stats (first active series)
  const f1data = seriesDataMap['f1'] || Object.values(seriesDataMap)[0];
  const comp = f1data && f1data.comp;
  const sched = f1data && f1data.sched;
  const drivers   = comp ? (comp.competitors||[]).sort((a,b) => (b.season_2026?.pts||0) - (a.season_2026?.pts||0)) : [];
  const schedule  = sched?.schedule || [];
  const completed = schedule.filter(r => r.complete);
  const nextRace  = schedule.find(r => !r.complete);
  const lastRace  = completed[completed.length - 1];
  const leader    = drivers[0];
  const p2        = drivers[1];
  const gap       = leader && p2 ? (leader.season_2026?.pts||0) - (p2.season_2026?.pts||0) : 0;
  const maxPts    = leader?.season_2026?.pts || 1;

  // ── Hero stats
  const ge = id => document.getElementById(id);
  if (ge('stat-rounds'))   ge('stat-rounds').textContent   = completed.length;
  if (ge('stat-drivers'))  ge('stat-drivers').textContent  = drivers.length;
  if (ge('stat-circuits')) ge('stat-circuits').textContent = 21;

  // ── Live snapshot
  const liveEl = ge('live-content');
  if (liveEl) {
    let lastHtml = '';
    if (lastRace) {
      lastHtml = '<div style="margin-bottom:16px;padding:16px 20px;background:var(--bg3);border:1px solid var(--border);border-left:3px solid var(--red)">' +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:8px">' +
          'Last Race \u00b7 R' + lastRace.round + ' \u00b7 ' + (lastRace.venue||'') +
        '</div>' +
        '<div style="font-family:\'Bebas Neue\',display;font-size:26px;letter-spacing:.5px;margin-bottom:4px">' + (lastRace.name||'') + '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">' +
          '<div style="font-family:\'Bebas Neue\',display;font-size:20px;color:var(--accent)">' + (lastRace.race?.winner||'\u2014') + ' won</div>' +
          '<a href="race.html?series=f1&round=' + lastRace.round + '" class="btn ghost btn-sm">Full Analysis \u2192</a>' +
        '</div>' +
      '</div>';
    }

    let nextHtml = '';
    if (nextRace) {
      nextHtml = '<div style="padding:16px 20px;background:rgba(39,244,210,.04);border:1px solid rgba(39,244,210,.15)">' +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--accent);opacity:.7;margin-bottom:8px">' +
          'Next Race \u00b7 R' + nextRace.round +
        '</div>' +
        '<div style="font-family:\'Bebas Neue\',display;font-size:24px;letter-spacing:.5px;margin-bottom:4px">' + (nextRace.name||nextRace.venue||'') + '</div>' +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--muted)">' + (nextRace.venue||'') + ' \u00b7 ' + (nextRace.date||'TBD') + '</div>' +
      '</div>';
    }

    let standHtml = '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:10px">Championship \u00b7 After Round ' + completed.length + '</div>';
    drivers.slice(0, 5).forEach(function(d, i) {
      const pts = d.season_2026?.pts || 0;
      const pct = Math.round((pts / maxPts) * 100);
      standHtml += '<a href="competitor.html?series=f1&id=' + d.id + '" style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.025);text-decoration:none;color:inherit;position:relative;overflow:hidden" onmouseover="this.style.background=\'rgba(255,255,255,.014)\'" onmouseout="this.style.background=\'\'">' +
        '<div style="position:absolute;left:0;top:0;bottom:0;width:' + pct + '%;background:#' + d.color + ';opacity:.07;pointer-events:none"></div>' +
        '<div style="font-family:\'Bebas Neue\',display;font-size:20px;color:' + (i===0?'var(--accent)':'var(--dim)') + ';width:20px;text-align:center;position:relative">' + (i+1) + '</div>' +
        '<div style="width:3px;height:28px;background:#' + d.color + ';flex-shrink:0;position:relative"></div>' +
        '<div style="flex:1;min-width:0;position:relative">' +
          '<div style="font-family:\'Bebas Neue\',display;font-size:17px;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + d.name + '</div>' +
          '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;color:var(--dim)">' + d.team_name + '</div>' +
        '</div>' +
        '<div style="font-family:\'Bebas Neue\',display;font-size:24px;color:' + (i===0?'var(--accent)':'var(--text)') + ';position:relative">' + pts + '</div>' +
      '</a>';
    });
    standHtml += '<a href="standings.html?series=f1" style="display:block;padding:10px 0;font-family:\'JetBrains Mono\',monospace;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--accent);opacity:.6;text-decoration:none;transition:opacity .15s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6">Full Standings \u2192</a>';

    liveEl.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px"><div>' + lastHtml + nextHtml + '</div><div>' + standHtml + '</div></div>';
  }

  // ── Series grid
  const sgEl = ge('series-grid');
  if (sgEl) {
    const active = Object.entries(config.series).filter(function(e){ return e[1].active; });
    if (!active.length) {
      sgEl.innerHTML = '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--dim)">No active series.</div>';
    } else {
      let sgHtml = '';
      active.forEach(function(entry) {
        const id = entry[0], s = entry[1];
        const sData = seriesDataMap[id];
        const sDrivers = sData && sData.comp ? (sData.comp.competitors||[]).sort((a,b)=>(b.season_2026?.pts||0)-(a.season_2026?.pts||0)) : [];
        const sSched   = sData && sData.sched ? sData.sched.schedule||[] : [];
        const sCompleted = sSched.filter(function(r){return r.complete;});
        const sLeader = sDrivers[0], sP2 = sDrivers[1];
        const sGap = sLeader && sP2 ? (sLeader.season_2026?.pts||0)-(sP2.season_2026?.pts||0) : 0;
        const hasSubSeries = !!(s.sub_series && s.sub_series.length);
        const subSeriesChips = hasSubSeries ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px">' +
          s.sub_series.map(function(ss){ return '<a href="'+s.hub_url+'" style="font-family:\'JetBrains Mono\',monospace;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border:1px solid rgba(255,255,255,.15);color:'+ss.accent+';text-decoration:none;background:rgba(255,255,255,.03)">'+ss.short+'</a>'; }).join('') + '</div>' : '';
        const dispLeader = sLeader || leader;
        const dispGap = sLeader ? sGap : gap;
        const dispComp = sCompleted.length || completed.length;
        const dispTotal = sSched.length || schedule.length;
        let statsHtml = '';
        if (dispLeader) {
          statsHtml = subSeriesChips + '<div style="display:flex;gap:20px;flex-wrap:wrap;padding:12px 0;border-top:1px solid var(--border)">' +
            '<div><div style="font-family:\'Bebas Neue\',display;font-size:22px;color:' + s.accent + '">' + dispLeader.name.split(' ').pop() + '</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim)">' + (hasSubSeries?'Cup Leader':'Leader') + '</div></div>' +
            '<div><div style="font-family:\'Bebas Neue\',display;font-size:22px">' + (dispLeader.season_2026?.pts||0) + '</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim)">Points</div></div>' +
            '<div><div style="font-family:\'Bebas Neue\',display;font-size:22px">+' + gap + '</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim)">Gap to P2</div></div>' +
            '<div><div style="font-family:\'Bebas Neue\',display;font-size:22px">' + completed.length + '/' + schedule.length + '</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim)">Rounds</div></div>' +
          '</div>';
        }
        sgHtml += '<a href="' + s.hub_url + '" style="display:grid;grid-template-columns:1fr auto;background:var(--bg3);border:1px solid var(--border);border-left:3px solid ' + s.accent + ';text-decoration:none;color:inherit;position:relative;overflow:hidden;transition:background .2s"' +
          ' onmouseover="this.style.background=\'rgba(39,244,210,.02)\'" onmouseout="this.style.background=\'var(--bg3)\'">' +
          '<div style="position:absolute;right:-10px;bottom:-12px;font-family:\'Bebas Neue\',display;font-size:100px;letter-spacing:-2px;color:rgba(255,255,255,.03);line-height:1;pointer-events:none">' + s.short + '</div>' +
          '<div style="padding:24px 28px;position:relative">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
              '<div style="width:6px;height:6px;border-radius:50%;background:' + s.accent + ';animation:pulse 2s ease-in-out infinite"></div>' +
              '<div style="font-family:\'JetBrains Mono\',monospace;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:' + s.accent + ';opacity:.8">' + s.name + '</div>' +
            '</div>' +
            '<div style="font-family:\'Bebas Neue\',display;font-size:clamp(40px,6vw,64px);letter-spacing:2px;line-height:.9;color:' + s.accent + ';margin-bottom:8px">' + s.short + '</div>' +
            '<div style="font-size:13px;color:var(--muted);line-height:1.65;font-weight:300;margin-bottom:14px">' + s.description + '</div>' +
            statsHtml +
          '</div>' +
          '<div style="display:flex;align-items:center;padding:0 20px;font-family:\'JetBrains Mono\',monospace;font-size:8.5px;letter-spacing:2px;text-transform:uppercase;color:' + s.accent + ';border-left:1px solid var(--border);background:rgba(255,255,255,.015);min-width:52px;writing-mode:vertical-rl;transform:rotate(180deg)">' +
            'Enter ' + s.short + ' Hub \u2192' +
          '</div>' +
        '</a>';
      });
      sgEl.innerHTML = sgHtml;
    }
  }

  // ── Favorites
  const favKeys = (function() {
    try { return JSON.parse(localStorage.getItem('apex-favorites')||'{"drivers":[]}').drivers || []; }
    catch(e) { return []; }
  })();
  const favSection = ge('fav-section');
  const favEl = ge('fav-content');
  if (favSection && favEl) {
    const favDrivers = drivers.filter(function(d){ return favKeys.includes(d.id); });
    if (!favDrivers.length) {
      favSection.style.display = 'none';
    } else {
      favSection.style.display = 'block';
      let favHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:2px">';
      favDrivers.forEach(function(d) {
        const s = d.season_2026;
        const fins = (s.results_by_round||[]).map(function(r){ return parseInt(r.finish); }).filter(function(n){ return !isNaN(n); });
        const avg = fins.length ? (fins.reduce(function(a,b){ return a+b; },0)/fins.length).toFixed(1) : '\u2014';
        favHtml += '<div style="background:var(--bg3);border:1px solid var(--border);border-left:3px solid #' + d.color + ';padding:16px 18px">' +
          '<button style="float:right;background:none;border:none;color:var(--dim);cursor:pointer;font-size:11px" onclick="(function(){var f=JSON.parse(localStorage.getItem(\'apex-favorites\')||\'{}}\');f.drivers=(f.drivers||[]).filter(function(x){return x!==\'' + d.id + '\';});localStorage.setItem(\'apex-favorites\',JSON.stringify(f));location.reload()})()">&#x2715;</button>' +
          '<div style="font-family:\'Bebas Neue\',display;font-size:22px;letter-spacing:.5px;margin-bottom:4px;color:#' + d.color + '">' + d.name + '</div>' +
          '<div style="font-family:\'JetBrains Mono\',monospace;font-size:8px;color:var(--dim);margin-bottom:10px">' + d.team_name + ' \u00b7 #' + d.number + '</div>' +
          '<div style="display:flex;gap:12px">' +
            '<div><div style="font-family:\'Bebas Neue\',display;font-size:18px;line-height:1;color:#' + d.color + '">' + (s.pts||0) + '</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;text-transform:uppercase;color:var(--dim)">Pts</div></div>' +
            '<div><div style="font-family:\'Bebas Neue\',display;font-size:18px;line-height:1">' + (s.wins||0) + '</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;text-transform:uppercase;color:var(--dim)">Wins</div></div>' +
            '<div><div style="font-family:\'Bebas Neue\',display;font-size:18px;line-height:1">' + avg + '</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;text-transform:uppercase;color:var(--dim)">Avg</div></div>' +
          '</div>' +
        '</div>';
      });
      favHtml += '</div>';
      favEl.innerHTML = favHtml;
    }
  }
}

/* ══════════════════════════════════════════════════════════
   NASCAR HUB
   Three sub-series: Cup / Xfinity / Trucks
══════════════════════════════════════════════════════════ */
async function initNascarHub() {
  const config = await loadJSON('data/config.json');
  if (!config) return;

  const nascar = config.series.nascar;
  const subSeries = nascar.sub_series;

  // Load all three series in parallel
  const allData = {};
  await Promise.all(subSeries.map(async function(ss) {
    const [comp, sched] = await Promise.all([
      loadJSON('data/' + ss.competitors_file + '.json'),
      loadJSON('data/' + ss.season_file + '.json'),
    ]);
    allData[ss.id] = { ss, comp, sched };
  }));

  document.title = 'NASCAR 2026 — APEX Analytics';

  // Build the hero and sub-series tabs
  var root = $('nascar-root');
  if (!root) return;

  // Build tab buttons
  var tabBtns = subSeries.map(function(ss, i) {
    return '<button class="series-tab' + (i===0?' active':'') + '" onclick="nascarTab(\'' + ss.id + '\',this)" style="' + (i===0?'color:' + ss.accent + ';border-bottom-color:' + ss.accent:'') + '">' + ss.name + '</button>';
  }).join('');

  root.innerHTML = nascarHeroHTML(nascar, allData) +
    '<div class="series-tabs">' + tabBtns + '</div>' +
    '<div id="nascar-tab-content"></div>';

  // Render Cup Series first
  nascarRenderSeries(allData[subSeries[0].id]);
}

function nascarHeroHTML(nascar, allData) {
  var cup = allData['nascar-cup'];
  var cupDrivers = cup && cup.comp ? (cup.comp.competitors||[]).sort(function(a,b){ return (b.season_2026?.pts||0)-(a.season_2026?.pts||0); }) : [];
  var cupSched = cup && cup.sched ? cup.sched.schedule||[] : [];
  var completed = cupSched.filter(function(r){ return r.complete; });
  var nextRace = cupSched.find(function(r){ return !r.complete; });
  var leader = cupDrivers[0];

  var cdStr = '';
  if (nextRace) {
    var cd = countdown(nextRace.date, nextRace.time_utc);
    cdStr = '<div style="display:flex;gap:16px;margin-top:12px">' +
      [['Days',cd.days],['Hrs',cd.hours],['Min',cd.mins],['Sec',cd.secs]].map(function(u){
        return '<div><div style="font-family:\'Bebas Neue\',display;font-size:32px;color:var(--accent);line-height:1">' + pad(u[1]) + '</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim)">' + u[0] + '</div></div>';
      }).join('') + '</div>';
  }

  return '<div class="nascar-hero">' +
    '<div class="nascar-hero-bg">NASCAR</div>' +
    '<div style="position:relative;z-index:1">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
        '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);animation:pulse 2s ease-in-out infinite"></div>' +
        '<span style="font-family:\'JetBrains Mono\',monospace;font-size:8.5px;letter-spacing:3px;text-transform:uppercase;color:var(--dim)">NASCAR · 2026 Season · ' + completed.length + ' Races Complete</span>' +
      '</div>' +
      '<h1 style="font-family:\'Bebas Neue\',display;font-size:clamp(52px,8vw,96px);letter-spacing:2px;line-height:.88;margin-bottom:16px">' +
        'NASCAR <span style="color:var(--accent)">2026</span>' +
      '</h1>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start">' +
        '<div>' +
          '<div style="font-size:13.5px;color:var(--muted);line-height:1.75;font-weight:300;max-width:480px;margin-bottom:16px">' +
            'Three series. 40+ race weekends. ' + (leader ? leader.name + ' leads the Cup Series with ' + (leader.season_2026?.pts||0) + ' points after ' + completed.length + ' races.' : '') +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<a href="standings.html?series=nascar-cup" class="btn primary">Cup Standings →</a>' +
            '<a href="datalab.html?series=nascar-cup" class="btn ghost">Data Lab →</a>' +
            '<button class="btn share-btn" onclick="shareURL({series:\'nascar-cup\'})">🔗 Share</button>' +
          '</div>' +
        '</div>' +
        (nextRace ? '<div><div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;letter-spacing:3px;text-transform:uppercase;color:var(--accent);opacity:.7;margin-bottom:8px">Next Cup Race · R' + nextRace.round + '</div>' +
          '<div style="font-family:\'Bebas Neue\',display;font-size:26px;letter-spacing:.5px;margin-bottom:4px">' + (nextRace.name||nextRace.venue) + '</div>' +
          '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--dim);margin-bottom:8px">' + nextRace.venue + ' · ' + fmtDate(nextRace.date) + '</div>' +
          cdStr + '</div>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

function nascarTab(seriesId, btn) {
  // Update tab styling
  document.querySelectorAll('.series-tab').forEach(function(b) {
    b.classList.remove('active');
    b.style.color = '';
    b.style.borderBottomColor = '';
  });
  btn.classList.add('active');

  // Load config to get accent colour
  loadJSON('data/config.json').then(function(config) {
    var nascar = config && config.series && config.series.nascar;
    var ss = nascar && nascar.sub_series && nascar.sub_series.find(function(s){ return s.id === seriesId; });
    if (ss) {
      btn.style.color = ss.accent;
      btn.style.borderBottomColor = ss.accent;
    }
  });

  // Load and render the series
  Promise.all([
    loadJSON('data/' + seriesId.replace('nascar-','competitors-nascar-') + '-2026.json'),
    loadJSON('data/' + seriesId + '-2026.json'),
    loadJSON('data/config.json'),
  ]).then(function(results) {
    var comp = results[0], sched = results[1], config = results[2];
    var nascar = config && config.series && config.series.nascar;
    var ss = nascar && nascar.sub_series && nascar.sub_series.find(function(s){ return s.id === seriesId; });
    nascarRenderSeries({ ss: ss, comp: comp, sched: sched });
  });
}

function nascarRenderSeries(data) {
  var tabContent = $('nascar-tab-content');
  if (!tabContent) return;
  var ss = data.ss, comp = data.comp, sched = data.sched;
  if (!comp || !sched) {
    tabContent.innerHTML = '<div style="padding:40px var(--pad);font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--dim)">No data available.</div>';
    return;
  }

  var drivers = (comp.competitors||[]).sort(function(a,b){ return (b.season_2026?.pts||0)-(a.season_2026?.pts||0); });
  var schedule = sched.schedule||[];
  var completed = schedule.filter(function(r){ return r.complete; });
  var nextRace = schedule.find(function(r){ return !r.complete; });
  var maxPts = drivers[0]?.season_2026?.pts || 1;
  var accent = ss ? ss.accent : '#FFD100';

  // Championship strip - top 4
  var champStrip = drivers.slice(0,4).map(function(d,i) {
    var pts = d.season_2026?.pts||0;
    var gap = i===0 ? 0 : (drivers[0].season_2026?.pts||0) - pts;
    var pct = Math.round((pts/maxPts)*100);
    return '<div style="flex:1;padding:12px 16px;border-right:1px solid var(--border);position:relative;overflow:hidden;cursor:pointer" onclick="location.href=\'competitor.html?series=' + (ss?ss.id:'nascar-cup') + '&id=' + d.id + '\'">' +
      '<div style="position:absolute;left:0;bottom:0;height:2px;width:' + pct + '%;background:#' + d.color + ';transition:width 1s"></div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
        '<div style="font-family:\'Bebas Neue\',display;font-size:18px;color:' + (i===0?accent:'var(--dim)') + '">' + (i+1) + '</div>' +
        '<div style="width:5px;height:5px;border-radius:50%;background:#' + d.color + '"></div>' +
        '<div>' +
          '<div style="font-family:\'Bebas Neue\',display;font-size:16px;letter-spacing:.3px">' + d.name + '</div>' +
          '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;color:var(--dim)">#' + d.number + ' · ' + d.team_name + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:baseline;gap:8px">' +
        '<div style="font-family:\'Bebas Neue\',display;font-size:24px;color:' + (i===0?accent:'var(--text)') + '">' + pts + ' pts</div>' +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:8px;color:var(--dim)">' + (gap>0?'−'+gap:'Leader') + '</div>' +
        (d.season_2026?.playoff_pts ? '<div class="playoff-badge">' + d.season_2026.playoff_pts + ' playoff pts</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  // Recent races
  var raceCards = completed.slice().reverse().map(function(r) {
    return '<a class="race-card" href="race.html?series=' + (ss?ss.id:'nascar-cup') + '&round=' + r.round + '">' +
      '<div style="padding:18px 22px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
          '<div style="width:5px;height:5px;border-radius:50%;background:' + accent + '"></div>' +
          '<span style="font-family:\'JetBrains Mono\',monospace;font-size:8px;letter-spacing:1.5px;color:var(--dim)">R' + r.round + ' · ' + r.venue + ' · ' + fmtDate(r.date) + '</span>' +
        '</div>' +
        '<div style="font-family:\'Bebas Neue\',display;font-size:22px;letter-spacing:.5px;margin-bottom:4px">' + r.name + '</div>' +
        '<div style="font-size:12.5px;color:var(--muted);font-weight:300">' + (r.summary||'').slice(0,120) + (r.summary&&r.summary.length>120?'…':'') + '</div>' +
        (r.race ? '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
          '<span style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;padding:2px 8px;border:1px solid rgba(255,209,0,.25);color:' + accent + '">' + (r.race.lead_changes||0) + ' lead changes</span>' +
          '<span style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;padding:2px 8px;border:1px solid var(--border);color:var(--dim)">' + (r.race.cautions||0) + ' cautions</span>' +
          '</div>' : '') +
      '</div>' +
      '<div style="padding:18px 16px 18px 8px;display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;min-width:100px">' +
        '<div style="text-align:right">' +
          '<div style="font-family:\'Bebas Neue\',display;font-size:18px;color:' + accent + '">' + (r.race?.winner||'—') + '</div>' +
          '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;color:var(--dim)">Winner</div>' +
        '</div>' +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:8px;color:var(--dim);opacity:0;transition:opacity .18s" class="rc-arrow">Analysis →</div>' +
      '</div>' +
    '</a>';
  }).join('');

  // Upcoming
  var upcoming = schedule.filter(function(r){ return !r.complete; }).slice(0,5);
  var upcomingHTML = upcoming.map(function(r) {
    var isNext = r === nextRace;
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.025);' + (isNext?'background:rgba(255,209,0,.04);padding:8px 6px;margin:0 -6px;':'') + '">' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:8px;color:var(--dim);width:22px">R' + r.round + '</div>' +
      '<div style="font-size:14px">🇺🇸</div>' +
      '<div style="flex:1">' +
        '<div style="font-family:\'Bebas Neue\',display;font-size:15px;letter-spacing:.3px">' + (r.venue||r.name||'').replace(' Motor Speedway','').replace(' Raceway','').replace(' International Speedway','').slice(0,20) + '</div>' +
      '</div>' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;color:' + (isNext?accent:'var(--dim)') + '">' + fmtDateShort(r.date) + '</div>' +
    '</div>';
  }).join('');

  // Standings sidebar - top 12
  var standingsSb = drivers.slice(0,12).map(function(d,i) {
    var pts = d.season_2026?.pts||0;
    var pct = Math.round((pts/maxPts)*100);
    var fav = Favs.hasDriver(d.id);
    return '<div class="stand-row" onclick="location.href=\'competitor.html?series=' + (ss?ss.id:'nascar-cup') + '&id=' + d.id + '\'">' +
      '<div class="stand-row-bg" style="width:' + pct + '%;background:#' + d.color + '"></div>' +
      '<div style="font-family:\'Bebas Neue\',display;font-size:17px;color:' + (i===0?accent:i===1?'var(--text)':'var(--dim)') + ';width:18px;text-align:center;position:relative">' + (i+1) + '</div>' +
      '<div style="width:5px;height:5px;border-radius:50%;background:#' + d.color + ';flex-shrink:0;position:relative"></div>' +
      '<div style="flex:1;min-width:0;position:relative">' +
        '<div style="font-family:\'Bebas Neue\',display;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + d.name + '</div>' +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7px;color:var(--dim)">#' + d.number + (d.season_2026?.wins?' · ' + d.season_2026.wins + 'W':'') + (d.season_2026?.playoff_pts?' · ' + d.season_2026.playoff_pts + ' PPs':' · 0 PPs') + '</div>' +
      '</div>' +
      '<div style="font-family:\'Bebas Neue\',display;font-size:17px;color:' + (i===0?accent:'var(--text)') + ';position:relative">' + pts + '</div>' +
      '<button class="sr-fav' + (fav?' active':'') + '" onclick="event.stopPropagation();toggleFavDriver(\'' + d.id + '\',this)">' + (fav?'★':'☆') + '</button>' +
    '</div>';
  }).join('');

  tabContent.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--border)">' + champStrip + '</div>' +
    '<div class="nascar-main">' +
      '<div class="nascar-feed">' +
        (function(){
          if (!nextRace) return '';
          var cd = countdown(nextRace.date, nextRace.time_utc || '18:00:00');
          var cdHtml = !cd.past ? '<div style="display:flex;gap:16px;margin-top:10px">' +
            [['Days',cd.days],['Hrs',cd.hours],['Min',cd.mins],['Sec',cd.secs]].map(function(u){
              return '<div><div style="font-family:Bebas Neue,sans-serif;font-size:26px;color:'+accent+';line-height:1">'+pad(u[1])+'</div><div style="font-family:JetBrains Mono,monospace;font-size:6.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim)">'+u[0]+'</div></div>';
            }).join('') + '</div>' : '';
          return '<div style="padding:20px 22px;background:rgba(255,209,0,.04);border-bottom:1px solid var(--border);border-left:2px solid ' + accent + '">' +
            '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;letter-spacing:3px;text-transform:uppercase;color:' + accent + ';opacity:.7;margin-bottom:8px">Next Race · R' + nextRace.round + '</div>' +
            '<div style="font-family:\'Bebas Neue\',display;font-size:26px;letter-spacing:.5px;margin-bottom:4px">' + (nextRace.name||nextRace.venue) + '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">' +
              '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--muted)">' + nextRace.venue + ' · ' + fmtDate(nextRace.date) + '</div>' +
              '<a href="race.html?series=' + (ss?ss.id:'nascar-cup') + '&round=' + nextRace.round + '" class="btn ghost btn-sm">Preview →</a>' +
            '</div>' +
            cdHtml +
          '</div>';
        })() +
        '<div style="padding:12px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">' +
          '<span style="font-family:\'JetBrains Mono\',monospace;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:var(--dim)">Race Reports</span>' +
          '<a href="standings.html?series=' + (ss?ss.id:'nascar-cup') + '" style="font-family:\'JetBrains Mono\',monospace;font-size:8px;color:' + accent + ';opacity:.6">Full Season →</a>' +
        '</div>' +
        raceCards +
      '</div>' +
      '<div class="nascar-side">' +
        '<div style="padding:14px 18px;border-bottom:1px solid var(--border)">' +
          '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;letter-spacing:3px;text-transform:uppercase;color:var(--dim);margin-bottom:12px">' +
            'Standings <span style="float:right"><a href="standings.html?series=' + (ss?ss.id:'nascar-cup') + '" style="font-size:8px;color:' + accent + ';opacity:.6;font-family:\'JetBrains Mono\',monospace;letter-spacing:1px">Full →</a></span>' +
          '</div>' +
          standingsSb +
        '</div>' +
        '<div style="padding:14px 18px;border-bottom:1px solid var(--border)">' +
          '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;letter-spacing:3px;text-transform:uppercase;color:var(--dim);margin-bottom:10px">Schedule</div>' +
          upcomingHTML +
        '</div>' +
        '<div style="padding:14px 18px">' +
          '<div style="font-family:\'JetBrains Mono\',monospace;font-size:7.5px;letter-spacing:3px;text-transform:uppercase;color:var(--dim);margin-bottom:8px">Explore</div>' +
          '<a href="standings.html?series=' + (ss?ss.id:'nascar-cup') + '" style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);margin-bottom:2px;font-family:\'JetBrains Mono\',monospace;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor=\'var(--border-hi)\'" onmouseout="this.style.borderColor=\'var(--border)\'">Full Standings <span style="color:' + accent + '">→</span></a>' +
          '<a href="datalab.html?series=' + (ss?ss.id:'nascar-cup') + '" style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);margin-bottom:2px;font-family:\'JetBrains Mono\',monospace;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor=\'var(--border-hi)\'" onmouseout="this.style.borderColor=\'var(--border)\'">Data Lab <span style="color:' + accent + '">→</span></a>' +
          '<a href="circuits.html?series=' + (ss?ss.id:'nascar-cup') + '" style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);margin-bottom:2px;font-family:\'JetBrains Mono\',monospace;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);transition:border-color .15s;text-decoration:none" onmouseover="this.style.borderColor=\'var(--border-hi)\'" onmouseout="this.style.borderColor=\'var(--border)\'">Track Guide <span style="color:' + accent + '">→</span></a>' +
        '</div>' +
      '</div>' +
    '</div>';

  if ($('footer-copy')) $('footer-copy').textContent = 'NASCAR 2026 · ' + (ss?ss.name:'Cup Series') + ' · ' + completed.length + ' races';
}

/* ══════════════════════════════════════════════════════════
   NASCAR FORM ANALYSIS — Last 3 Races, All 3 Series
══════════════════════════════════════════════════════════ */
async function initNascarFormAnalysis() {
  var el = $('form-analysis-root');
  if (!el) return;

  var results = await Promise.all([
    loadJSON('data/competitors-nascar-cup-2026.json'),
    loadJSON('data/nascar-cup-2026.json'),
    loadJSON('data/competitors-nascar-xfinity-2026.json'),
    loadJSON('data/nascar-xfinity-2026.json'),
    loadJSON('data/competitors-nascar-trucks-2026.json'),
    loadJSON('data/nascar-trucks-2026.json'),
  ]);
  var cupComp=results[0], cupSched=results[1], xComp=results[2], xSched=results[3], tComp=results[4], tSched=results[5];
  if (!cupComp || !cupSched) return;

  function last3(sched) {
    return (sched.schedule||[]).filter(function(r){return r.complete;}).slice(-3);
  }
  function formTable(comps, indices) {
    return comps.competitors.map(function(d) {
      var rr = d.season_2026.results_by_round;
      var last = indices.map(function(i){return rr[i];}).filter(Boolean);
      var pts  = last.reduce(function(s,r){return s+(r.pts||0);},0);
      var wins = last.filter(function(r){return r.finish===1;}).length;
      var top5 = last.filter(function(r){return typeof r.finish==='number'&&r.finish<=5;}).length;
      var fins = last.map(function(r){return r.finish;}).filter(function(f){return typeof f==='number';});
      var avg  = fins.length ? (fins.reduce(function(a,b){return a+b;},0)/fins.length).toFixed(1) : '—';
      return {d:d, pts:pts, wins:wins, top5:top5, avg:avg};
    }).sort(function(a,b){return b.pts-a.pts;});
  }

  var cupRaces = last3(cupSched), xRaces = last3(xSched), tRaces = last3(tSched);
  var cupForm  = formTable(cupComp,[3,4,5]), xForm = formTable(xComp,[1,2,3]), tForm = formTable(tComp,[3,4,5]);

  function raceRow(r) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">' +
      '<div style="font-family:JetBrains Mono,monospace;font-size:8px;color:var(--dim);width:26px;flex-shrink:0">R'+r.round+'</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-family:Bebas Neue,display;font-size:15px;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (r.name||r.venue) + '</div>' +
        '<div style="font-family:JetBrains Mono,monospace;font-size:7px;color:var(--dim)">' + (r.venue||'') + (r.race ? ' · '+r.race.lead_changes+' lead changes · '+r.race.cautions+' cautions' : '') + '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0">' +
        '<div style="font-family:Bebas Neue,display;font-size:15px;color:var(--accent)">' + (r.race&&r.race.winner ? r.race.winner.split(' ').pop() : '—') + '</div>' +
      '</div>' +
    '</div>';
  }

  function formRow(row, i, accent) {
    var d = row.d, pct = (formTable && i===0) ? 100 : 0;
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.03);position:relative;overflow:hidden">' +
      '<div style="font-family:Bebas Neue,display;font-size:16px;color:'+(i===0?accent:'var(--dim)')+';width:18px;text-align:center">'+(i+1)+'</div>' +
      '<div style="width:4px;height:4px;border-radius:50%;background:#'+d.color+';flex-shrink:0"></div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-family:Bebas Neue,display;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + d.name + '</div>' +
        '<div style="font-family:JetBrains Mono,monospace;font-size:7px;color:var(--dim)">#'+d.number+' · '+d.team_name+'</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<div style="text-align:center;min-width:28px"><div style="font-family:Bebas Neue,display;font-size:16px;color:'+(i===0?accent:'var(--text)')+'">'+row.pts+'</div><div style="font-family:JetBrains Mono,monospace;font-size:6px;color:var(--dim)">PTS</div></div>' +
        '<div style="text-align:center;min-width:18px"><div style="font-family:Bebas Neue,display;font-size:16px;color:'+(row.wins?accent:'var(--dim)')+'">'+row.wins+'</div><div style="font-family:JetBrains Mono,monospace;font-size:6px;color:var(--dim)">W</div></div>' +
        '<div style="text-align:center;min-width:18px"><div style="font-family:Bebas Neue,display;font-size:16px">'+row.top5+'</div><div style="font-family:JetBrains Mono,monospace;font-size:6px;color:var(--dim)">T5</div></div>' +
        '<div style="text-align:center;min-width:26px"><div style="font-family:Bebas Neue,display;font-size:16px">'+row.avg+'</div><div style="font-family:JetBrains Mono,monospace;font-size:6px;color:var(--dim)">AVG</div></div>' +
      '</div>' +
    '</div>';
  }

  function insightCard(title, body, accent) {
    return '<div style="padding:12px 14px;border:1px solid var(--border);border-left:2px solid '+accent+'">' +
      '<div style="font-family:Bebas Neue,display;font-size:14px;letter-spacing:.5px;margin-bottom:4px;color:'+accent+'">' + title + '</div>' +
      '<div style="font-size:12px;color:var(--muted);line-height:1.7;font-weight:300">' + body + '</div>' +
    '</div>';
  }

  function block(title, accent, races, form, insights) {
    return '<div style="border:1px solid var(--border)">' +
      '<div style="padding:12px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.012)">' +
        '<div style="width:8px;height:8px;border-radius:50%;background:'+accent+'"></div>' +
        '<div style="font-family:Bebas Neue,display;font-size:20px;letter-spacing:1px;color:'+accent+'">'+title+'</div>' +
        '<div style="font-family:JetBrains Mono,monospace;font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-left:auto">Last 3 Races</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr">' +
        '<div style="padding:14px 18px;border-right:1px solid var(--border)">' +
          '<div style="font-family:JetBrains Mono,monospace;font-size:7px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:8px">Results</div>' +
          races.map(raceRow).join('') +
        '</div>' +
        '<div style="padding:14px 18px">' +
          '<div style="font-family:JetBrains Mono,monospace;font-size:7px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:8px">Form Table</div>' +
          form.slice(0,8).map(function(row,i){return formRow(row,i,accent);}).join('') +
        '</div>' +
      '</div>' +
      '<div style="padding:12px 18px;border-top:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">' +
        insights.map(function(ins){return insightCard(ins.t,ins.b,accent);}).join('') +
      '</div>' +
    '</div>';
  }

  var cup1 = cupForm[0], cup2 = cupForm[1];
  var x1   = xForm[0];
  var t1   = tForm[0], t2 = tForm[1];
  var bell = cupComp.competitors.find(function(d){return d.id==='bell-christopher';});

  var cupInsights = [
    {t:'Three different winners',b:'Phoenix (Blaney), Las Vegas (Hamlin), Darlington (Reddick). The field found answers after Reddick\'s historic 3-race sweep but he bounced back at Darlington to extend his championship lead to 95 points.'},
    {t:'Bell\'s laps-led problem',b: bell ? bell.season_2026.laps_led+' laps led on the season, '+bell.season_2026.wins+' wins. Led 176 laps at Phoenix from pole — lost. Pace is elite but he can\'t close.' : 'Bell leads laps but can\'t close races.'},
    {t:'Keselowski at Darlington',b:'Swept both stages and led the most laps. Finished 2nd. Peak Keselowski — dominant all race, nowhere at the end. His form table (101 pts, avg 9.7) shows the inconsistency.'},
  ];
  var xInsights = [
    {t:'Four-way title battle',b:'Only 5 points separate Allgaier (138), Hill (136), Creed (134) and Love (133) across the last 3. The tightest form fight in any of the three series right now.'},
    {t:'Allgaier closing',b:'2 wins in last 3 with a 3.3 average. At 35 years old with 500+ starts, his late-race execution is the edge no younger driver can match.'},
    {t:"SVG road specialist",b:'Won at COTA (led 31 laps) but averages 8.3 across the 3. His part-time road-course role works perfectly until the schedule goes oval-heavy.'},
  ];
  var tInsights = [
    {t:'6 races, 6 winners',b:'Every Truck race this season has had a different winner — the most wide-open racing in NASCAR. Three different winners just in the last three races.'},
    {t:'Smith fading from lead',b:'Leads overall standings but ranks 8th in recent form at 97 pts with a 9.0 average. A P17 at Darlington is a warning sign with Honeycutt (132 pts) closing hard.'},
    {t:t1.d.name.split(' ').pop()+' hottest right now',b:t1.pts+' pts, '+t1.wins+' win, '+t1.avg+' average — best recent form in the Truck field. '+t2.d.name.split(' ').pop()+' just behind at '+t2.pts+'.'},
  ];

  el.innerHTML =
    '<div style="padding:24px var(--pad) 14px;border-bottom:1px solid var(--border)">' +
      '<div style="font-family:JetBrains Mono,monospace;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:var(--dim);margin-bottom:6px">Form Analysis</div>' +
      '<h2 style="font-family:Bebas Neue,display;font-size:clamp(28px,4vw,42px);letter-spacing:1px;line-height:.9;margin-bottom:6px">Last 3 Races — All Three Series</h2>' +
      '<p style="font-size:13px;color:var(--muted);font-weight:300">Form tables, results and key storylines across Cup, O\'Reilly and Trucks.</p>' +
    '</div>' +
    '<div style="padding:var(--pad);display:flex;flex-direction:column;gap:2px">' +
      block('Cup Series', '#FFD100', cupRaces, cupForm, cupInsights) +
      block("O'Reilly Auto Parts Series", '#00A651', xRaces, xForm, xInsights) +
      block('Craftsman Truck Series', '#E8002D', tRaces, tForm, tInsights) +
    '</div>';
}
