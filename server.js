const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Pass@123',
    database: 'warehouse_management'
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Utility Function: Handle Errors
const handleError = (err, res, message = 'An error occurred') => {
    console.error(message, err);
    res.status(500).send(message);
};

// Add Rack (Feature 1)
app.post('/addRack', (req, res) => {
    const { rack_name, num_shelves, num_bins } = req.body;

    if (!rack_name || !num_shelves || !num_bins) {
        return res.status(400).send('All fields are required');
    }

    const sqlRack = 'INSERT INTO racks (rack_name, num_shelves, num_bins) VALUES (?, ?, ?)';
    db.query(sqlRack, [rack_name, num_shelves, num_bins], (err, result) => {
        if (err) return handleError(err, res, 'Error adding rack');

        const rack_id = result.insertId;

        // Generate shelves and bins
        const shelves = [];
        const bins = [];
        for (let i = 1; i <= num_shelves; i++) {
            const shelf_id = `${rack_id}-${i}`;
            shelves.push([shelf_id, rack_id, i]);

            for (let j = 1; j <= num_bins; j++) {
                const bin_id = `${shelf_id}-${j}`;
                bins.push([bin_id, shelf_id, rack_id, j]);
            }
        }

        const sqlShelves = 'INSERT INTO shelves (shelf_id, rack_id, shelf_number) VALUES ?';
        db.query(sqlShelves, [shelves], (err) => {
            if (err) return handleError(err, res, 'Error adding shelves');

            const sqlBins = 'INSERT INTO bins (bin_id, shelf_id, rack_id, bin_number) VALUES ?';
            db.query(sqlBins, [bins], (err) => {
                if (err) return handleError(err, res, 'Error adding bins');
                res.send('Rack, shelves, and bins added successfully');
            });
        });
    });
});

// View Racks (Feature 2)
app.get('/viewRacks', (req, res) => {
    const sql = 'SELECT * FROM racks';
    db.query(sql, (err, results) => {
        if (err) return handleError(err, res, 'Error fetching racks');
        res.json(results);
    });
});

// Add Category (Feature 4)
app.post('/addCategory', (req, res) => {
    const { category_name } = req.body;

    if (!category_name) {
        return res.status(400).send('Category name is required');
    }

    const sql = 'INSERT INTO categories (category_name) VALUES (?)';
    db.query(sql, [category_name], (err) => {
        if (err) return handleError(err, res, 'Error adding category');
        res.send('Category added successfully');
    });
});

// Add Subcategory (Feature 5)
app.post('/addSubcategory', (req, res) => {
    const { subcategory_name, category_id } = req.body;

    if (!subcategory_name || !category_id) {
        return res.status(400).send('All fields are required');
    }

    const checkCategorySql = 'SELECT * FROM categories WHERE category_id = ?';
    db.query(checkCategorySql, [category_id], (err, results) => {
        if (err) return handleError(err, res, 'Error checking category');

        if (results.length === 0) {
            return res.status(400).send('Category does not exist. Please add the category first.');
        }

        const subcategory_id = `${category_id}-${Date.now().toString().slice(-4)}`;
        const sql = 'INSERT INTO subcategories (subcategory_id, subcategory_name, category_id) VALUES (?, ?, ?)';
        db.query(sql, [subcategory_id, subcategory_name, category_id], (err) => {
            if (err) return handleError(err, res, 'Error adding subcategory');
            res.send('Subcategory added successfully');
        });
    });
});

// Add Item (Feature 6)
app.post('/addItem', (req, res) => {
    const { item_name, category_id, subcategory_id, bin_id, quantity, quantity_unit, barcode_value } = req.body;

    if (!item_name || !category_id || !subcategory_id || !quantity || !quantity_unit || !barcode_value) {
        return res.status(400).send('All fields are required');
    }

    console.log('Checking subcategory:', subcategory_id);

    const checkSubcategorySql = 'SELECT * FROM subcategories WHERE subcategory_id = ?';
    db.query(checkSubcategorySql, [subcategory_id], (err, results) => {
        if (err) {
            console.error('Error checking subcategory:', err);
            return res.status(500).send('Error checking subcategory');
        }

        if (results.length === 0) {
            return res.status(400).send('Subcategory does not exist. Please add the subcategory first.');
        }

        console.log('Subcategory exists:', results);

        const sql = 'INSERT INTO items (item_name, category_id, subcategory_id, bin_id, quantity, quantity_unit, barcode_value) VALUES (?, ?, ?, ?, ?, ?, ?)';
        db.query(sql, [item_name, category_id, subcategory_id, bin_id, quantity, quantity_unit, barcode_value], (err) => {
            if (err) {
                console.error('Error adding item:', err);
                return res.status(500).send('Error adding item');
            }
            res.send('Item added successfully');
        });
    });
});

// Transactions (Feature 7, 9, 10)
app.post('/addTransaction', (req, res) => {
    const { item_id, transaction_type, quantity } = req.body;

    if (!item_id || !transaction_type || !quantity) {
        return res.status(400).send('All fields are required');
    }

    const sqlTransaction = 'INSERT INTO transactions (item_id, transaction_type, quantity) VALUES (?, ?, ?)';
    db.query(sqlTransaction, [item_id, transaction_type, quantity], (err) => {
        if (err) return handleError(err, res, 'Error adding transaction');

        const updateSql =
            transaction_type === 'ADD'
                ? 'UPDATE items SET quantity = quantity + ? WHERE item_id = ?'
                : 'UPDATE items SET quantity = quantity - ? WHERE item_id = ?';

        db.query(updateSql, [quantity, item_id], (err) => {
            if (err) return handleError(err, res, 'Error updating item quantity');
            res.send('Transaction processed successfully');
        });
    });
});

// Default route for undefined routes
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
