const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Helper functions to read/write from DB
const readDb = () => {
    const db = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(db);
};

const writeDb = (data) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

// --- Frontend Routes ---

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// --- API Endpoints ---

// User Registration
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Semua field harus diisi.' });
    }

    const db = readDb();
    const userExists = db.users.find(user => user.email === email);

    if (userExists) {
        return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
    }

    const newUser = {
        name,
        email,
        password, // In a real app, you MUST hash the password.
        activeUntil: null,
        apiKey: null,
    };

    db.users.push(newUser);
    writeDb(db);

    res.status(201).json({ success: true, message: 'Registrasi berhasil.' });
});

// User Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password harus diisi.' });
    }

    const db = readDb();
    const user = db.users.find(u => u.email === email && u.password === password);

    if (!user) {
        return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    // Check if user is active
    if (user.activeUntil && new Date(user.activeUntil) < new Date()) {
        return res.status(403).json({ success: false, message: 'Akun Anda sudah tidak aktif. Hubungi admin.' });
    }

    res.json({ success: true, message: 'Login berhasil.', name: user.name, email: user.email });
});


// --- Admin API Endpoints ---

// Get all users
app.get('/api/admin/users', (req, res) => {
    const db = readDb();
    res.json({ users: db.users });
});

// Set user's active period
app.post('/api/admin/users/:email/set-active-period', (req, res) => {
    const { email } = req.params;
    const { activeUntil } = req.body;

    if (!activeUntil) {
        return res.status(400).json({ success: false, message: 'Tanggal masa aktif harus diisi.' });
    }

    const db = readDb();
    const userIndex = db.users.findIndex(u => u.email === email);

    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    db.users[userIndex].activeUntil = activeUntil;
    writeDb(db);

    res.json({ success: true, message: 'Masa aktif berhasil diperbarui.' });
});

// Create API key for a user
app.post('/api/admin/users/:email/create-apikey', (req, res) => {
    const { email } = req.params;

    const db = readDb();
    const userIndex = db.users.findIndex(u => u.email === email);

    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    // Generate a random API key
    const apiKey = crypto.randomBytes(20).toString('hex');
    db.users[userIndex].apiKey = apiKey;
    writeDb(db);

    res.json({ success: true, message: 'API key berhasil dibuat.', apiKey });
});


// Serve static files (for CSS, JS, etc.)
app.use(express.static(__dirname));


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Admin panel is available at http://localhost:${PORT}/admin`);
});
