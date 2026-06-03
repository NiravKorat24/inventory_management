const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const db = new sqlite3.Database('./robotics.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Create tables
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS components (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    total_quantity INTEGER NOT NULL,
                    available_quantity INTEGER NOT NULL
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    component_id INTEGER,
                    type TEXT NOT NULL, 
                    quantity INTEGER NOT NULL,
                    person_name TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(component_id) REFERENCES components(id)
                )
            `);
        });
    }
});

// API Routes

// Get all components
app.get('/api/components', (req, res) => {
    db.all('SELECT * FROM components ORDER BY name ASC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get recent transactions for the dashboard
app.get('/api/transactions/recent', (req, res) => {
    const query = `
        SELECT t.id, c.name as component_name, t.type, t.quantity, t.person_name, t.timestamp 
        FROM transactions t
        JOIN components c ON t.component_id = c.id
        ORDER BY t.timestamp DESC
        LIMIT 10
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get dashboard stats
app.get('/api/stats', (req, res) => {
    db.get('SELECT COUNT(*) as total_components, SUM(total_quantity) as total_items, SUM(available_quantity) as available_items FROM components', [], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
});

// Add a new component
app.post('/api/components', (req, res) => {
    const { name, category, quantity } = req.body;
    if (!name || !category || quantity == null) {
        return res.status(400).json({ error: 'Please provide name, category, and quantity' });
    }

    db.run(
        'INSERT INTO components (name, category, total_quantity, available_quantity) VALUES (?, ?, ?, ?)',
        [name, category, quantity, quantity],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({
                message: 'Component added successfully',
                id: this.lastID
            });
        }
    );
});

// Issue a component
app.post('/api/issue', (req, res) => {
    const { component_id, quantity, person_name } = req.body;
    if (!component_id || !quantity || !person_name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.get('SELECT available_quantity FROM components WHERE id = ?', [component_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Component not found' });
        if (row.available_quantity < quantity) {
            return res.status(400).json({ error: 'Not enough available quantity' });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('UPDATE components SET available_quantity = available_quantity - ? WHERE id = ?', [quantity, component_id]);
            db.run('INSERT INTO transactions (component_id, type, quantity, person_name) VALUES (?, ?, ?, ?)', [component_id, 'issue', quantity, person_name]);
            db.run('COMMIT', (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Transaction failed' });
                }
                res.json({ message: 'Component issued successfully' });
            });
        });
    });
});

// Return a component
app.post('/api/return', (req, res) => {
    const { component_id, quantity, person_name } = req.body;
    if (!component_id || !quantity || !person_name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const qtyToReturn = parseInt(quantity);

    // Check how many items this person has currently issued
    const checkQuery = `
        SELECT SUM(CASE WHEN type = 'issue' THEN quantity ELSE -quantity END) as net_issued
        FROM transactions 
        WHERE person_name = ? AND component_id = ?
    `;

    db.get(checkQuery, [person_name, component_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const netIssued = row ? (row.net_issued || 0) : 0;
        
        if (netIssued < qtyToReturn) {
            return res.status(400).json({ 
                error: `Cannot return. ${person_name} has only ${netIssued} of this component issued.` 
            });
        }

        // Proceed to return if they actually have the item
        db.get('SELECT total_quantity, available_quantity FROM components WHERE id = ?', [component_id], (err, compRow) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!compRow) return res.status(404).json({ error: 'Component not found' });
            
            if (compRow.available_quantity + qtyToReturn > compRow.total_quantity) {
                return res.status(400).json({ error: 'Return quantity exceeds total capacity' });
            }

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run('UPDATE components SET available_quantity = available_quantity + ? WHERE id = ?', [qtyToReturn, component_id]);
                db.run('INSERT INTO transactions (component_id, type, quantity, person_name) VALUES (?, ?, ?, ?)', [component_id, 'return', qtyToReturn, person_name]);
                db.run('COMMIT', (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Transaction failed' });
                    }
                    res.json({ message: 'Component returned successfully' });
                });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
