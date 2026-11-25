const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const form = $('form'), fileIn = $('file'), drop = $('drop');
const ICON = { YouTube: '\u25B6', Course: '\uD83C\uDF93', Docs: '\uD83D\uDCD8', Certification: '\uD83C\uDFC5', Practice: '\uD83D\uDCBB' };
let D = null, cf = { type: 'All', skill: 'All' };

fetch('/api/roles').then((r) => r.json()).then((l) => {
  $('roles').innerHTML = l.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
}).catch(() => { $('error').textContent = 'Could not load job roles. Is the server running?'; });

form.querySelectorAll('[name=mode]').forEach((r) => (r.onchange = () => { const jd = form.mode.value === 'jd'; $('jd').hidden = !jd; $('roles').hidden = jd; }));
form.hours.oninput = () => ($('hrsOut').textContent = form.hours.value + ' hrs');
fileIn.onchange = () => { const f = fileIn.files[0]; $('fileName').textContent = f ? f.name : 'Drop your resume here or click to browse'; drop.classList.toggle('has', !!f); };
['dragover', 'dragenter'].forEach((e) => drop.addEventListener(e, (v) => { v.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((e) => drop.addEventListener(e, () => drop.classList.remove('over')));
drop.addEventListener('drop', (v) => { v.preventDefault(); if (v.dataTransfer.files[0]) { fileIn.files = v.dataTransfer.files; fileIn.onchange(); } });

form.onsubmit = async (e) => {
  e.preventDefault(); $('error').textContent = '';
  if (!fileIn.files[0]) return ($('error').textContent = 'Choose a resume file first.');
  $('go').disabled = true; $('results').hidden = true; $('loading').hidden = false; $('loading').scrollIntoView({ behavior: 'smooth', block: 'center' });
  const li = [...$('steps').children]; li.forEach((x) => (x.className = '')); let i = 0; li[0].className = 'on';
  const tm = setInterval(() => { if (i < li.length - 1) { li[i].className = 'done'; li[++i].className = 'on'; } }, 450);
  try {
    const [res] = await Promise.all([fetch('/api/analyze', { method: 'POST', body: new FormData(form) }), new Promise((r) => setTimeout(r, 1800))]);
    const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Analysis failed.');
    D = d; cf = { type: 'All', skill: 'All' }; render(d); save(d);
  } catch (x) { $('error').textContent = x.message; }
  clearInterval(tm); $('loading').hidden = true; $('go').disabled = false;
};

function count(el, to) { const t0 = performance.now(); (function f(t) { const p = Math.min(1, (t - t0) / 1000); el.textContent = (to * p * (2 - p)).toFixed(1); if (p < 1) requestAnimationFrame(f); })(t0); }

function render(d) {
  $('results').hidden = false; $('roleName').textContent = d.role;
  const v = d.score >= 8 ? ['Strong match', ''] : d.score >= 6 ? ['Good, a few gaps', ''] : d.score >= 4 ? ['Getting there', 'mid'] : ['Needs work', 'low'];
  $('verdict').textContent = v[0]; $('verdict').className = 'verdict ' + v[1];
  count($('score'), d.score);
  $('arc').style.stroke = d.score >= 6 ? '#2BB39A' : d.score >= 4 ? '#F2B134' : '#D64545';
  requestAnimationFrame(() => ($('arc').style.strokeDashoffset = 339.3 * (1 - d.score / 10)));
  $('bars').innerHTML = [['Skills', d.breakdown.skills], ['Similarity', d.breakdown.similarity], ['ATS format', d.breakdown.format]].map((b) => `<div class="bar"><span>${b[0]}</span><div><i data-w="${b[1]}"></i></div><b>${b[1]}%</b></div>`).join('');
  setTimeout(() => $('bars').querySelectorAll('i').forEach((i) => (i.style.width = i.dataset.w + '%')), 60);
  $('facts').textContent = `${d.matched.length} skills found  \u00B7  ${d.missing.length} to learn  \u00B7  ${d.roadmap.length}-week plan`;
  const t = document.querySelector('[data-t=skills]'); t.innerHTML = 'Skills' + (d.missing.length ? `<em>${d.missing.length}</em>` : '');
  paneOverview(); paneSkills(); paneCourses(); paneRoad(); paneText(); tab('overview');
  setTimeout(() => $('results').scrollIntoView({ behavior: 'smooth' }), 100);
}

function tab(name) {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === name));
  ['overview', 'skills', 'courses', 'road', 'text'].forEach((n) => { const p = $('p-' + n); p.hidden = n !== name; if (n === name) { p.style.animation = 'none'; p.offsetHeight; p.style.animation = ''; } });
  const b = document.querySelector('#tabs button.on'); $('ind').style.left = b.offsetLeft + 'px'; $('ind').style.width = b.offsetWidth + 'px';
}
$('tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) tab(b.dataset.t); };
window.addEventListener('resize', () => D && tab(document.querySelector('#tabs button.on').dataset.t));

function paneOverview() {
  const bad = D.feedback.filter((f) => !f.ok), good = D.feedback.filter((f) => f.ok);
  const fix = bad.map((f, i) => `<li style="--i:${i}"><span class="mark">!</span><div><b>${esc(f.title || 'Heads up')}</b><p>${esc(f.text)}</p>${f.why ? `<p class="why">${esc(f.why)}</p>` : ''}</div>${f.pts ? `<span class="pts">+${f.pts} pts</span>` : ''}</li>`).join('');
  const ok = good.map((f, i) => `<li style="--i:${i}"><span class="mark">&#10003;</span><div><b>${esc(f.title)}</b><p>${esc(f.text)}</p></div></li>`).join('');
  const fits = (D.fits || []).map((r, i) => `<div class="fit ${r.name === D.role ? 'top' : ''}"><span>${esc(r.name)}</span><div><i style="width:${r.pct}%"></i></div><b>${r.pct}%</b></div>`).join('');
  $('p-overview').innerHTML = `<div class="audit"><div><h3>Needs attention <small>${bad.length} ${bad.length === 1 ? "fix" : "fixes"}${bad.length ? ', about +' + (Math.round(bad.reduce((a, f) => a + (f.pts || 0), 0) * 10) / 10) + ' pts' : ''}</small></h3><ul class="alist">${fix || '<li><span class="mark">&#10003;</span><div><b>Nothing to fix</b><p>Every format check passed.</p></div></li>'}</ul></div><div><h3>Looking good <small>${good.length}</small></h3><ul class="alist good">${ok || '<li><span class="mark">-</span><div><p>No checks passed yet.</p></div></li>'}</ul></div></div>${fits ? `<h3>Where your skills fit best <small>skill match across all roles</small></h3>${fits}` : ''}`;
}

function paneSkills() {
  const done = LS.get('atsified_skills', {}), n = D.missing.filter((m) => done[m.name]).length;
  $('p-skills').innerHTML = `<h3>Skills found in your resume <small>${D.matched.length}</small></h3><div class="cl">${D.matched.map((m) => `<span class="cp">${esc(m)}</span>`).join('') || 'None detected yet.'}</div>
  <h3>Skills to add <small>${D.missing.length}</small></h3>` + (D.missing.length ? `<div class="pbar"><i style="width:${(n / D.missing.length) * 100}%"></i></div><p class="pmeta">${n} of ${D.missing.length} marked as learned</p><div class="grid">${D.missing.map((m, i) => `<div class="skill ${done[m.name] ? 'ok' : ''}" style="--i:${i}"><label class="tick"><input type="checkbox" data-sk="${esc(m.name)}" ${done[m.name] ? 'checked' : ''}><span></span></label><div><b>${esc(m.name)}</b><small>${m.resources.length} free resources</small></div><button class="ghost" data-go="${esc(m.name)}">Learn &rarr;</button></div>`).join('')}</div>` : '<p>No missing skills. Great coverage for this role.</p>');
}

function paneCourses() {
  const all = D.missing.flatMap((m) => m.resources.map((r) => ({ ...r, skill: m.name })));
  const types = ['All', ...new Set(all.map((r) => r.type))], skills = ['All', ...D.missing.map((m) => m.name)];
  const list = all.filter((r) => (cf.type === 'All' || r.type === cf.type) && (cf.skill === 'All' || r.skill === cf.skill));
  const host = (u) => { try { return new URL(u).hostname.replace('www.', ''); } catch { return ''; } };
  const fl = (arr, key) => `<div class="fl">${arr.map((x) => `<button class="${cf[key] === x ? 'on' : ''}" data-f="${key}" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
  $('p-courses').innerHTML = all.length ? fl(skills, 'skill') + fl(types, 'type') + `<div class="grid">${list.map((r, i) => `<a class="res" style="--i:${i}" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="rt t-${esc(r.type)}">${ICON[r.type] || '\uD83D\uDD17'}</span><div><small>${esc(r.skill)} &middot; ${esc(r.type)}</small><b>${esc(r.title)}</b><em>${esc(host(r.url))}</em></div><i>&#8599;</i></a>`).join('')}</div>` : '<p>No resources needed because no skills are missing.</p>';
}

function paneRoad() {
  const rm = LS.get('atsified_rm', {}), id = (w, t) => `${D.role}|${w}|${t}`;
  const all = D.roadmap.flatMap((w) => w.tasks.map((t) => id(w.week, t))), n = all.filter((k) => rm[k]).length, pct = Math.round((n / all.length) * 100);
  $('p-road').innerHTML = `<div class="pbar"><i style="width:${pct}%"></i></div><p class="pmeta">${pct}% complete  \u00B7  tick tasks as you finish them</p><div class="tl">${D.roadmap.map((w, i) => `<div class="wk ${w.tasks.every((t) => rm[id(w.week, t)]) ? 'done' : ''}" style="--i:${i}"><div class="node">${w.week}</div><div class="wb"><h4>Week ${w.week}</h4>${w.tasks.map((t) => `<label class="task"><input type="checkbox" data-rm="${esc(id(w.week, t))}" ${rm[id(w.week, t)] ? 'checked' : ''}><span></span><u>${esc(t)}</u></label>`).join('')}</div></div>`).join('')}</div>`;
}

function paneText() {
  const safe = esc(D.preview); let hl = safe;
  D.matched.forEach((m) => { hl = hl.replace(new RegExp('(^|[^A-Za-z0-9+#])(' + esc(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-z0-9+#])', 'gi'), '$1<mark>$2</mark>'); });
  $('p-text').innerHTML = `<div class="tb"><label><input type="checkbox" id="hlT" checked> Highlight found skills</label><span>${D.preview.split(/\s+/).filter(Boolean).length} words shown</span><button class="ghost" id="cp">Copy text</button></div><div class="txt" id="txt">${hl}</div><p class="pmeta">Green = skills we found. Missing skills are not in your resume, so they cannot be highlighted.</p>`;
  $('hlT').onchange = (e) => ($('txt').innerHTML = e.target.checked ? hl : safe);
  $('cp').onclick = () => navigator.clipboard.writeText(D.preview).then(() => ($('cp').textContent = 'Copied!'));
}

document.addEventListener('change', (e) => {
  if (e.target.id === 'hsel') return history(e.target.value);
  const sk = e.target.dataset.sk, rm = e.target.dataset.rm;
  if (sk) { const d = LS.get('atsified_skills', {}); d[sk] = e.target.checked; LS.set('atsified_skills', d); paneSkills(); }
  if (rm) { const d = LS.get('atsified_rm', {}); d[rm] = e.target.checked; LS.set('atsified_rm', d); paneRoad(); }
});
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]'), f = e.target.closest('[data-f]');
  if (g) { cf = { type: 'All', skill: g.dataset.go }; paneCourses(); tab('courses'); }
  if (f) { cf[f.dataset.f] = f.dataset.v; paneCourses(); }
});

const rkey = () => { const raw = ($('label').value.trim() || fileIn.files[0].name.replace(/\.[^.]+$/, '')); const k = raw.toLowerCase().replace(/[\s_-]*(v\d+|final|copy|\(\d+\)|\d+)$/i, '').replace(/[\s_-]+/g, ' ').trim() || raw.toLowerCase(); return { k, name: raw }; };
function save(d) { const h = LS.get('atsified', []), r = rkey(); h.push({ k: r.k, name: r.name, t: new Date().toLocaleDateString(), role: d.role, score: d.score }); LS.set('atsified', h.slice(-60)); history(r.k); }
function history(sel) {
  const all = LS.get('atsified', []).map((p) => (p.k ? p : { ...p, k: 'earlier', name: 'Earlier uploads' }));
  $('history').hidden = !all.length; if (!all.length) return;
  const groups = [...new Map(all.map((p) => [p.k, p.name])).entries()];
  sel = groups.some((g) => g[0] === sel) ? sel : all[all.length - 1].k;
  const h = all.filter((p) => p.k === sel), delta = h.length > 1 ? Math.round((h[h.length - 1].score - h[0].score) * 10) / 10 : null;
  const W = 600, H = 150, x = (i) => 30 + (h.length > 1 ? (i * (W - 60)) / (h.length - 1) : (W - 60) / 2), y = (s) => H - 20 - (s / 10) * (H - 40);
  $('hist').innerHTML = `<div class="hhead"><label>Resume <select id="hsel">${groups.map((g) => `<option value="${esc(g[0])}" ${g[0] === sel ? 'selected' : ''}>${esc(g[1])}</option>`).join('')}</select></label>${delta === null ? '<span class="delta">First upload</span>' : `<span class="delta ${delta < 0 ? 'neg' : ''}">${delta >= 0 ? '+' : ''}${delta} since first upload</span>`}<button class="ghost" id="clr">Delete this resume's history</button></div>
  <svg viewBox="0 0 ${W} ${H}">${[0, 5, 10].map((g) => `<line x1="30" x2="${W - 30}" y1="${y(g)}" y2="${y(g)}" stroke="#E1E8EF"/><text x="4" y="${y(g) + 4}" font-size="11" fill="#5A6B75">${g}</text>`).join('')}<polyline points="${h.map((p, i) => `${x(i)},${y(p.score)}`).join(' ')}" fill="none" stroke="#065A82" stroke-width="3" stroke-linejoin="round"/>${h.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.score)}" r="5" fill="#2BB39A"><title>${esc(p.role)}: ${p.score}/10 (${esc(p.t)})</title></circle>`).join('')}</svg>
  <ul class="hl">${h.slice().reverse().map((p) => `<li><span>${esc(p.role)} &middot; ${esc(p.t)}</span><b>${p.score}/10</b></li>`).join('')}</ul>`;
  $('clr').onclick = () => { LS.set('atsified', all.filter((p) => p.k !== sel)); history(); };
}
history();
$('print').onclick = () => window.print();
