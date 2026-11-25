// Local dev server. On Vercel, files in /api run as serverless functions instead.
const express = require('express');
const app = express();
app.use(express.static('public'));
app.get('/api/roles', require('./api/roles'));
app.post('/api/analyze', require('./api/analyze'));
app.listen(3000, () => console.log('ATSified running at http://localhost:3000'));
