const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { ensureDefaultAdmin } = require('./utils/ensureDefaultAdmin');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/health', require('./routes/health'));
app.use('/api/request', require('./routes/request'));
app.use('/api/donation', require('./routes/donation'));
app.use('/api/admin', require('./routes/admin'));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await ensureDefaultAdmin();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer().catch((err) => {
    console.error('Server startup failed:', err.message);
    process.exit(1);
});
