import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Setup SQLite database
const db = new Database('database.sqlite');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS monthly_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    payer_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    receipt_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payer_id) REFERENCES members (id),
    UNIQUE(month, year)
  );

  CREATE TABLE IF NOT EXISTS member_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    receipt_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES monthly_bills (id),
    FOREIGN KEY (member_id) REFERENCES members (id),
    UNIQUE(bill_id, member_id)
  );
`);

// Setup Multer for file uploads (memory storage for sharp processing)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// API Routes

// Get all members
app.get('/api/members', (req, res) => {
  try {
    const members = db.prepare('SELECT * FROM members').all();
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Add a new member
app.post('/api/members', (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const stmt = db.prepare('INSERT INTO members (name, email) VALUES (?, ?)');
    const info = stmt.run(name, email || null);
    res.json({ id: info.lastInsertRowid, name, email });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Delete a member
app.delete('/api/members/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM member_payments WHERE member_id = ?').run(id);
      db.prepare('DELETE FROM monthly_bills WHERE payer_id = ?').run(id);
      db.prepare('DELETE FROM members WHERE id = ?').run(id);
    })();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

// Mark payment as unpaid
app.delete('/api/member_payments/:bill_id/:member_id', (req, res) => {
  const bill_id = parseInt(req.params.bill_id, 10);
  const member_id = parseInt(req.params.member_id, 10);
  try {
    db.prepare('DELETE FROM member_payments WHERE bill_id = ? AND member_id = ?').run(bill_id, member_id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark as unpaid' });
  }
});

// Get bill for a specific month and year
app.get('/api/bills', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'Month and year are required' });

  try {
    const bill = db.prepare(`
      SELECT b.*, m.name as payer_name 
      FROM monthly_bills b
      JOIN members m ON b.payer_id = m.id
      WHERE b.month = ? AND b.year = ?
    `).get(month, year);

    if (!bill) {
      return res.json(null);
    }

    const payments = db.prepare(`
      SELECT p.*, m.name as member_name
      FROM member_payments p
      JOIN members m ON p.member_id = m.id
      WHERE p.bill_id = ?
    `).all(bill.id);

    res.json({ ...bill, payments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bill' });
  }
});

// Set monthly bill
app.post('/api/bills', upload.single('receipt'), async (req, res) => {
  const { month, year, payer_id, total_amount } = req.body;
  let receipt_url = null;

  if (req.file) {
    try {
      const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg';
      const filepath = path.join(uploadsDir, filename);
      await sharp(req.file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(filepath);
      receipt_url = `/uploads/${filename}`;
    } catch (err) {
      console.error('Image processing error:', err);
      return res.status(500).json({ error: 'Failed to process image' });
    }
  }

  if (!month || !year || !payer_id || !total_amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO monthly_bills (month, year, payer_id, total_amount, receipt_url) 
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(month, year) DO UPDATE SET 
        payer_id = excluded.payer_id,
        total_amount = excluded.total_amount,
        receipt_url = COALESCE(excluded.receipt_url, monthly_bills.receipt_url)
    `);
    const info = stmt.run(month, year, payer_id, total_amount, receipt_url);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to set bill' });
  }
});

// Record member payment
app.post('/api/member_payments', upload.single('receipt'), async (req, res) => {
  const { bill_id, member_id, amount } = req.body;
  let receipt_url = null;

  if (req.file) {
    try {
      const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg';
      const filepath = path.join(uploadsDir, filename);
      await sharp(req.file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(filepath);
      receipt_url = `/uploads/${filename}`;
    } catch (err) {
      console.error('Image processing error:', err);
      return res.status(500).json({ error: 'Failed to process image' });
    }
  }

  if (!bill_id || !member_id || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO member_payments (bill_id, member_id, amount, receipt_url) 
      VALUES (?, ?, ?, ?)
      ON CONFLICT(bill_id, member_id) DO UPDATE SET 
        amount = excluded.amount,
        receipt_url = COALESCE(excluded.receipt_url, member_payments.receipt_url)
    `);
    const info = stmt.run(bill_id, member_id, amount, receipt_url);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Error handling middleware for multer
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message });
  } else if (err) {
    res.status(400).json({ error: err.message });
  } else {
    next();
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
