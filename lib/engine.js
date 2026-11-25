const roles = require('../data/roles.json');
const curated = require('../data/courses.json');

const STOP = new Set('a an the and or of to in for with on at by from as is are be this that it we you your our their will can have has using use used work working experience years year strong good ability skills skill knowledge team etc also such other more including role candidate required preferred'.split(' '));
const VERBS = 'built developed designed created analyzed analysed led implemented managed improved optimized automated deployed delivered reduced increased launched collaborated mentored tested wrote'.split(' ');

// 1. text extraction (pdf-parse / mammoth)
async function extractText(buf, name) {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return (await require('pdf-parse/lib/pdf-parse.js')(buf)).text;
  if (n.endsWith('.docx')) return (await require('mammoth').extractRawText({ buffer: buf })).value;
  if (n.endsWith('.txt')) return buf.toString('utf8');
  throw new Error('Unsupported file. Upload a PDF, DOCX or TXT resume.');
}

// 2. NLP: tokenize, TF-IDF, cosine similarity
const tokens = (t) => (t.toLowerCase().match(/[a-z][a-z0-9+#.]*/g) || []).map((w) => w.replace(/\.+$/, '')).filter((w) => w.length > 1 && !STOP.has(w));

function cosine(a, b, corpus) {
  const docs = [a, b, ...corpus].map(tokens), N = docs.length, df = {};
  docs.forEach((d) => new Set(d).forEach((w) => (df[w] = (df[w] || 0) + 1)));
  const vec = (d) => {
    const tf = {}, v = {};
    d.forEach((w) => (tf[w] = (tf[w] || 0) + 1));
    for (const w in tf) v[w] = tf[w] * (Math.log((N + 1) / (df[w] + 1)) + 1);
    return v;
  };
  const x = vec(docs[0]), y = vec(docs[1]);
  let dot = 0, nx = 0, ny = 0;
  for (const w in x) { nx += x[w] ** 2; if (y[w]) dot += x[w] * y[w]; }
  for (const w in y) ny += y[w] ** 2;
  return nx && ny ? dot / Math.sqrt(nx * ny) : 0;
}

// 3. skills
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const skillRe = (alias) => new RegExp('(^|[^a-z0-9+#])(' + alias.split('|').map(esc).join('|') + ')($|[^a-z0-9+#])', 'i');
const skillList = (r) => Object.entries(r.skills).map(([name, [alias, w, h]]) => ({ name, re: skillRe(alias), w, h }));

function requiredSkills(opts) {
  if (opts.mode === 'jd') {
    const seen = {};
    Object.values(roles).forEach((r) => skillList(r).forEach((s) => { if (s.re.test(opts.jd) && !seen[s.name]) seen[s.name] = s; }));
    return { name: 'Pasted job description', skills: Object.values(seen), ref: opts.jd };
  }
  const r = roles[opts.role] || roles[Object.keys(roles)[0]];
  return { name: r.name, skills: skillList(r), ref: r.description };
}

// 4. score
function analyze(text, opts) {
  const req = requiredSkills(opts);
  const matched = [], missing = [];
  req.skills.forEach((s) => (s.re.test(text) ? matched : missing).push(s));
  const totalW = req.skills.reduce((a, s) => a + s.w, 0);
  const skillScore = totalW ? matched.reduce((a, s) => a + s.w, 0) / totalW : 0;
  const corpus = Object.values(roles).map((r) => r.description);
  const sim = Math.min(1, cosine(text, req.ref, corpus) / 0.5); // cosine >= 0.5 counts as full marks

  const words = text.split(/\s+/).filter(Boolean).length;
  const verbs = VERBS.filter((v) => new RegExp('\\b' + v + '\\b', 'i').test(text)).length;
  const checks = [
    [/[\w.+-]+@[\w-]+\.[\w.]+/.test(text), 'Email address', 'Email address found.', 'No email address found.', 'Recruiters and application forms need a way to reach you. Use a professional address.'],
    [/\+?\d[\d\s-]{8,}\d/.test(text), 'Phone number', 'Phone number found.', 'No phone number found.', 'Many follow-ups happen by phone, so list a number you answer.'],
    [/education/i.test(text), 'Education section', 'Education section found.', 'No "Education" heading found.', 'ATS parsers rely on standard headings to sort your details correctly.'],
    [/experience|internship/i.test(text), 'Experience section', 'Experience or internship section found.', 'No "Experience" or "Internships" heading found.', 'Work or internship history is the first thing most screens look for.'],
    [/skills/i.test(text), 'Skills section', 'Skills section found.', 'No "Skills" heading found.', 'A clear skills list is where keyword matching works best.'],
    [/projects?/i.test(text), 'Projects section', 'Projects section found.', 'No "Projects" heading found.', 'For students, projects prove skills when work experience is limited.'],
    [words >= 200 && words <= 1000, 'Resume length', `Length is good (${words} words).`, `Length looks off (${words} words). Aim for about 300-800.`, 'Too short looks thin; too long gets skimmed or cut off.'],
    [/\d+\s?%|\b\d{2,}\b/.test(text), 'Measurable results', 'Includes numbers and measurable results.', 'No numbers or measurable results found.', 'Numbers like "reduced report time by 30%" make your impact believable.'],
    [verbs >= 4, 'Action verbs', 'Uses strong action verbs.', 'Few action verbs found.', 'Starting bullets with verbs like built, analyzed or automated shows ownership.'],
  ];
  const fmt = checks.filter((c) => c[0]).length / checks.length;
  const score = Math.round(10 * (0.5 * skillScore + 0.2 * sim + 0.3 * fmt) * 10) / 10;

  const feedback = checks.map((c) => ({ ok: c[0], title: c[1], text: c[0] ? c[2] : c[3], why: c[4], pts: Math.round((3 / checks.length) * 10) / 10 }));
  if (!req.skills.length) feedback.unshift({ ok: false, title: 'Skills not detected', why: '', pts: 0, text: 'No known skills were detected in the job description, so skill matching is limited. Paste a fuller JD or pick a role.' });

  const fits = Object.values(roles).map((r) => { const sk = skillList(r), tw = sk.reduce((a, s) => a + s.w, 0); return { name: r.name, pct: Math.round((sk.filter((s) => s.re.test(text)).reduce((a, s) => a + s.w, 0) / tw) * 100) }; }).sort((a, b) => b.pct - a.pct).slice(0, 6);
  return {
    role: req.name, score, fits,
    breakdown: { skills: Math.round(skillScore * 100), similarity: Math.round(sim * 100), format: Math.round(fmt * 100) },
    matched: matched.map((s) => s.name),
    missing: missing.map((s) => ({ name: s.name, resources: resources(s.name) })),
    feedback, roadmap: roadmap(missing, opts.hours), preview: text.slice(0, 4000),
  };
}

// 5. courses (curated list + generated search links)
function resources(name) {
  const q = encodeURIComponent(name);
  const list = [...(curated[name] || [])];
  list.push({ type: 'YouTube', title: `${name} tutorials for beginners`, url: `https://www.youtube.com/results?search_query=${q}+full+course+for+beginners` });
  if (!curated[name]) list.push({ type: 'Course', title: `Free ${name} courses on Coursera`, url: `https://www.coursera.org/search?query=${q}` });
  return list;
}

// 6. roadmap (rule-based: most important skills first, packed into weeks)
function roadmap(missing, hoursPerWeek) {
  const hpw = Math.min(40, Math.max(2, hoursPerWeek || 8));
  const weeks = []; let cur = { tasks: [], left: hpw };
  [...missing].sort((a, b) => b.w - a.w).forEach((s) => {
    let h = s.h;
    while (h > 0) {
      if (cur.left <= 0) { weeks.push(cur); cur = { tasks: [], left: hpw }; }
      const t = Math.min(h, cur.left);
      cur.tasks.push(`Learn ${s.name} (${t} hrs)`); cur.left -= t; h -= t;
    }
  });
  if (cur.tasks.length) weeks.push(cur);
  weeks.push({ tasks: ['Build a small project that uses these skills', 'Add the skills and project to your resume', 'Upload the updated resume here and compare scores'] });
  return weeks.map((w, i) => ({ week: i + 1, tasks: w.tasks }));
}

module.exports = { extractText, analyze };
