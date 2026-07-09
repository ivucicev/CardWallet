import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { createServer as createViteServer } from 'vite';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const dbPath = path.join(process.cwd(), 'wallet.db');
  console.log(`Initializing SQLite database at: ${dbPath}`);

  // Open SQLite database connection
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create cards table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      store TEXT NOT NULL,
      cardNumber TEXT NOT NULL,
      barcodeType TEXT NOT NULL,
      color TEXT,
      notes TEXT,
      isCoupon INTEGER DEFAULT 0,
      expiryDate TEXT,
      createdAt TEXT
    )
  `);

  // Auto-migration: Check if older wallet.json exists and migrate contents to SQLite
  const jsonDbFile = path.join(process.cwd(), 'wallet.json');
  try {
    const fileExists = await fs.access(jsonDbFile).then(() => true).catch(() => false);
    if (fileExists) {
      console.log('Migrating existing cards from wallet.json to SQLite database...');
      const data = await fs.readFile(jsonDbFile, 'utf-8');
      const cards = JSON.parse(data);
      if (Array.isArray(cards)) {
        for (const card of cards) {
          await db.run(
            `INSERT OR REPLACE INTO cards (id, name, store, cardNumber, barcodeType, color, notes, isCoupon, expiryDate, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              card.id,
              card.name,
              card.store,
              card.cardNumber,
              card.barcodeType,
              card.color || 'bg-pink-600 border border-pink-700/10',
              card.notes || '',
              card.isCoupon ? 1 : 0,
              card.expiryDate || '',
              card.createdAt || new Date().toISOString()
            ]
          );
        }
        console.log(`Successfully migrated ${cards.length} cards from wallet.json to SQLite!`);
      }
      // Backup/Rename wallet.json to avoid double-migration on subsequent boots
      await fs.rename(jsonDbFile, jsonDbFile + '.bak');
    }
  } catch (err) {
    console.warn('Migration status / non-fatal warning:', err);
  }

  // API Route: Get all cards
  app.get('/api/cards', async (req, res) => {
    try {
      const cards = await db.all('SELECT * FROM cards ORDER BY createdAt DESC');
      const formattedCards = cards.map(card => ({
        ...card,
        isCoupon: card.isCoupon === 1
      }));
      res.json(formattedCards);
    } catch (error: any) {
      console.error('Error fetching cards from SQLite:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // API Route: Save or update a card
  app.post('/api/cards', async (req, res) => {
    try {
      const { id, name, store, cardNumber, barcodeType, color, notes, isCoupon, expiryDate, createdAt } = req.body;
      
      if (!id || !name || !store || !cardNumber || !barcodeType) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO cards (id, name, store, cardNumber, barcodeType, color, notes, isCoupon, expiryDate, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           store = excluded.store,
           cardNumber = excluded.cardNumber,
           barcodeType = excluded.barcodeType,
           color = excluded.color,
           notes = excluded.notes,
           isCoupon = excluded.isCoupon,
           expiryDate = excluded.expiryDate`,
        [
          id,
          name,
          store,
          cardNumber,
          barcodeType,
          color || 'bg-pink-600 border border-pink-700/10',
          notes || '',
          isCoupon ? 1 : 0,
          expiryDate || '',
          createdAt || now
        ]
      );

      res.json({ success: true, id });
    } catch (error: any) {
      console.error('Error saving card to SQLite:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // API Route: Get a specific card by ID (for sharing/importing)
  app.get('/api/cards/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const card = await db.get('SELECT * FROM cards WHERE id = ?', [id]);
      
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }

      const formattedCard = {
        ...card,
        isCoupon: card.isCoupon === 1
      };

      res.json(formattedCard);
    } catch (error: any) {
      console.error('Error fetching card from SQLite:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // API Route: Delete a card
  app.delete('/api/cards/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.run('DELETE FROM cards WHERE id = ?', [id]);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Card not found' });
      }
      
      res.json({ success: true, id });
    } catch (error: any) {
      console.error('Error deleting card from SQLite:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // API Route: Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'sqlite' });
  });

  // Serve static assets or mount Vite in dev mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Card Wallet server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
