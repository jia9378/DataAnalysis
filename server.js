const express   = require('express');
const path      = require('path');
const fs        = require('fs');
const Datastore = require('nedb');

const app  = express();
const PORT = 3001;

// ── neDB — user submissions ──────────────────────────────────────────────
const db = new Datastore({ filename: path.join(__dirname, 'submissions.db'), autoload: true });

app.use(express.json());

// ── Static files ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ── API: list slices from /assets (pre-loaded CT data) ───────────────────
app.get('/api/slices', (req, res) => {
  const assetsDir = path.join(__dirname, 'assets');

  if (!fs.existsSync(assetsDir)) return res.json({ slices: [], count: 0 });

  const slices = fs.readdirSync(assetsDir)
    .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? '0');
      const nb = parseInt(b.match(/\d+/)?.[0] ?? '0');
      return na - nb;
    })
    .map(f => `/assets/${f}`);

  res.json({ slices, count: slices.length });
});

// ── API: submit user data ────────────────────────────────────────────────
app.post('/api/submit', (req, res) => {
  const { name, days, category } = req.body;
  if (days === undefined || days === null) {
    return res.status(400).json({ error: 'Missing days field' });
  }
  const record = {
    name: name || 'Anonymous',
    days: parseInt(days),
    category: category || 'Unknown',
    timestamp: new Date().toISOString(),
  };
  db.insert(record, (err, doc) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, id: doc._id });
  });
});

// ── API: get all submissions ─────────────────────────────────────────────
app.get('/api/submissions', (req, res) => {
  db.find({}).sort({ timestamp: -1 }).exec((err, docs) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ submissions: docs, count: docs.length });
  });
});

// ── API: serve analysis data ─────────────────────────────────────────────
app.get('/api/data', (req, res) => res.sendFile(path.join(__dirname, 'nsduh_results.json')));

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Spirit Slices running at http://localhost:${PORT}`);
  console.log(`  CT slices: /assets`);
});