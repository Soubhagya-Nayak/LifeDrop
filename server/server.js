const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { ensureDefaultAdmin } = require('./utils/ensureDefaultAdmin');

// Pre-initialise Firebase if credentials are provided (gracefully skipped if not)
require('./services/notificationService');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // allow base64 QR payloads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/health', require('./routes/health'));
app.use('/api/request', require('./routes/request'));
app.use('/api/donation', require('./routes/donation'));
app.use('/api/admin', require('./routes/admin'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/ping', (_req, res) => res.json({ status: 'ok', service: 'LifeDrop API' }));

// ─── Global error handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[Unhandled Error]', err.message);
    res.status(500).json({ msg: 'Internal server error', detail: err.message });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await ensureDefaultAdmin();
    app.listen(PORT, () => {
        console.log(`\n✅  LifeDrop server running on port ${PORT}`);
        console.log(`   API base: http://localhost:${PORT}/api`);
        console.log(`   Ping:     http://localhost:${PORT}/api/ping\n`);
    });
};

startServer().catch((err) => {
    console.error('❌  Server startup failed:', err.message);
    process.exit(1);
});
