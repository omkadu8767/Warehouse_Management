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
                res.send('Rack added successfully');
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
        if (err) {
            console.error(err); // Log the error for debugging
            return res.status(500).send('Error adding category'); // Send error response
        }
        res.send('Category added successfully'); // Send success response
    });
});

// Handle adding a subcategory
app.post('/addSubcategory', (req, res) => {
    const { subcategory_name, category_id } = req.body;

    console.log('Received:', { subcategory_name, category_id }); // Log received data

    if (!subcategory_name || !category_id) {
        return res.status(400).send('All fields are required');
    }

    // Check if the category exists
    const checkCategorySql = 'SELECT * FROM categories WHERE category_id = ?';
    db.query(checkCategorySql, [category_id], (err, results) => {
        if (err) return handleError(err, res, 'Error checking category');

        if (results.length === 0) {
            return res.status(400).send('Category does not exist. Please add the category first.');
        }

        // Create subcategory ID based on your requirements
        const subcategory_id = `${category_id}-${Date.now().toString().slice(-4)}`;
        const sql = 'INSERT INTO subcategories (subcategory_id, subcategory_name, category_id) VALUES (?, ?, ?)';

        db.query(sql, [subcategory_id, subcategory_name, category_id], (err) => {
            if (err) {
                console.error(err); // Log any SQL errors
                return res.status(500).send('Error adding subcategory');
            }
            res.send('Subcategory added successfully');
        });
    });
});

// Handle retrieving categories for the UI
app.get('/categories', (req, res) => {
    const sql = 'SELECT * FROM categories';
    db.query(sql, (err, results) => {
        if (err) return handleError(err, res, 'Error fetching categories');

        res.json(results); // Send categories as JSON
    });
});

// Add Item (Feature 6)
app.post('/addItem', (req, res) => {
    const { item_name, category_id, subcategory_id, quantity, quantity_unit, barcode_value } = req.body;

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

        // Remove bin_id from here since it doesn't exist in your items table
        const sql = 'INSERT INTO items (item_name, category_id, subcategory_id, quantity, quantity_unit, barcode_value) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(sql, [item_name, category_id, subcategory_id, quantity, quantity_unit, barcode_value], (err) => {
            if (err) {
                console.error('Error adding item:', err);
                return res.status(500).send('Error adding item');
            }
            res.send('Item added successfully');
        });
    });
});
app.get('/subcategories', (req, res) => {
    const categoryId = req.query.category_id;

    const sql = 'SELECT * FROM subcategories WHERE category_id = ?';
    db.query(sql, [categoryId], (err, results) => {
        if (err) return handleError(err, res, 'Error fetching subcategories');

        res.json(results); // Send subcategories as JSON
    });
});


// Transactions (Feature 7, 9, 10)
// app.post('/addTransaction', (req, res) => {
//     const { item_id, transaction_type, quantity } = req.body;

//     if (!item_id || !transaction_type || !quantity) {
//         return res.status(400).send('All fields are required');
//     }

//     const sqlTransaction = 'INSERT INTO transactions (item_id, transaction_type, quantity) VALUES (?, ?, ?)';
//     db.query(sqlTransaction, [item_id, transaction_type, quantity], (err) => {
//         if (err) return handleError(err, res, 'Error adding transaction');

//         const updateSql =
//             transaction_type === 'ADD'
//                 ? 'UPDATE items SET quantity = quantity + ? WHERE item_id = ?'
//                 : 'UPDATE items SET quantity = quantity - ? WHERE item_id = ?';

//         db.query(updateSql, [quantity, item_id], (err) => {
//             if (err) return handleError(err, res, 'Error updating item quantity');
//             res.send('Transaction processed successfully');
//         });
//     });
// });

// Endpoint to add items to the warehouse
app.post('/addItemToWarehouse', (req, res) => {
    const { item_id, item_add_quantity, item_name } = req.body;

    if (!item_id || !item_add_quantity || !item_name) {
        return res.status(400).send('All fields are required');
    }

    const sql = `
        INSERT INTO add_item_to_warehouse (item_id, item_name, item_add_quantity)
        VALUES (?, ?, ?)
    `;

    db.query(sql, [item_id, item_name, item_add_quantity], (err) => {
        if (err) {
            console.error('Error adding item to warehouse:', err);
            return res.status(500).send('Error adding item to warehouse');
        }

        // Update item quantity in the main items table
        const updateSql = 'UPDATE items SET quantity = quantity + ? WHERE item_id = ?';

        db.query(updateSql, [item_add_quantity, item_id], (err) => {
            if (err) {
                console.error('Error updating item quantity:', err);
                return res.status(500).send('Error updating item quantity');
            }

            // Update available_items table
            const availableUpdateSql = `
                INSERT INTO available_items (item_id, item_name, added_quantity, picked_quantity)
                VALUES (?, ?, ?, 0)
                ON DUPLICATE KEY UPDATE added_quantity = added_quantity + VALUES(added_quantity)
            `;
            db.query(availableUpdateSql, [item_id, item_name, item_add_quantity], (err) => {
                if (err) {
                    console.error('Error updating available items:', err);
                    return res.status(500).send('Error updating available items');
                }
                res.send('Item added to warehouse successfully');
            });
        });
    });
});

// Endpoint to fetch all items
app.get('/items', (req, res) => {
    const sql = 'SELECT * FROM items'; // Adjust this query as necessary based on your database structure
    db.query(sql, (err, results) => {
        if (err) return handleError(err, res, 'Error fetching items');

        res.json(results); // Send items as JSON response
    });
});

// Endpoint to pick items to the warehouse
app.post('/pickUpItem', (req, res) => {
    const { item_id, item_pick_quantity, item_name } = req.body;

    if (!item_id || !item_pick_quantity || !item_name) {
        return res.status(400).send('All fields are required');
    }

    const sql = `
        INSERT INTO pick_up_item_from_warehouse (item_id, item_name, item_quantity)
        VALUES (?, ?, ?)
    `;

    db.query(sql, [item_id, item_name, item_pick_quantity], (err) => { // Corrected variable name here
        if (err) {
            console.error('Error picking up item from warehouse:', err);
            return res.status(500).send('Error picking up item from warehouse');
        }

        // Update quantity in main items table
        const updateSql = 'UPDATE items SET quantity = quantity - ? WHERE item_id = ?'; // Changed to decrement

        db.query(updateSql, [item_pick_quantity, item_id], (err) => {
            if (err) {
                console.error('Error updating item quantity:', err);
                return res.status(500).send('Error updating item quantity');
            }

            // Update available_items table
            const availableUpdateSql = `
                UPDATE available_items 
                SET picked_quantity = picked_quantity + ?
                WHERE item_id = ?
            `;
            db.query(availableUpdateSql, [item_pick_quantity, item_id], (err) => {
                if (err) {
                    console.error('Error updating available items:', err);
                    return res.status(500).send('Error updating available items');
                }
                res.send('Item picked from warehouse successfully'); // Success message returned to client
            });
        });
    });
});


// Endpoint to handle barcode-based addition
app.post('/addItemByBarcode', (req, res) => {
    const { item_name, item_quantity, barcode_value } = req.body;

    if (!item_name || !item_quantity || !barcode_value) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Insert new item directly into the add_item_to_warehouse_by_barcode_scanning table
    const sqlInsertTransaction = `
        INSERT INTO add_item_to_warehouse_by_barcode_scanning (item_name, item_quantity, barcode_value)
        VALUES (?, ?, ?)
    `;

    db.query(sqlInsertTransaction, [item_name, item_quantity, barcode_value], (err) => {
        if (err) {
            console.error('Error adding item by barcode:', err);
            return res.status(500).json({ message: 'Error adding item by barcode' });
        }

        res.json({
            message: 'Item added to warehouse by barcode successfully',
        });
    });
});

// Endpoint to handle barcode-based pickUp

// Endpoint to fetch all available barcodes
app.get('/barcodes', (req, res) => {
    const sqlGetBarcodes = 'SELECT DISTINCT barcode_value FROM add_item_to_warehouse_by_barcode_scanning';

    db.query(sqlGetBarcodes, (err, results) => {
        if (err) {
            console.error('Error fetching barcodes:', err);
            return res.status(500).json({ message: 'Error fetching barcodes' });
        }

        res.json(results); // Send back the list of barcodes
    });
});

// Endpoint to fetch item details based on barcode
app.get('/items', (req, res) => {
    const barcode = req.query.barcode;

    if (!barcode) {
        return res.status(400).json({ message: 'Barcode is required' });
    }

    const sqlGetItem = 'SELECT item_name, item_quantity FROM add_item_to_warehouse_by_barcode_scanning WHERE barcode_value = ?';

    db.query(sqlGetItem, [barcode], (err, results) => {
        if (err) {
            console.error('Error fetching item:', err);
            return res.status(500).json({ message: 'Error fetching item' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Item not found with this barcode' });
        }

        res.json(results[0]); // Send back the first matching item's details
    });
});

// Endpoint to fetch all available barcodes
app.get('/barcodes', (req, res) => {
    const sqlGetBarcodes = 'SELECT DISTINCT barcode_value FROM add_item_to_warehouse_by_barcode_scanning';

    db.query(sqlGetBarcodes, (err, results) => {
        if (err) {
            console.error('Error fetching barcodes:', err);
            return res.status(500).json({ message: 'Error fetching barcodes' });
        }

        res.json(results); // Send back the list of barcodes
    });
});

// Endpoint to fetch all available barcodes
app.get('/barcodes', (req, res) => {
    const sqlGetBarcodes = 'SELECT DISTINCT barcode_value FROM add_item_to_warehouse_by_barcode_scanning';

    db.query(sqlGetBarcodes, (err, results) => {
        if (err) {
            console.error('Error fetching barcodes:', err);
            return res.status(500).json({ message: 'Error fetching barcodes' });
        }

        res.json(results); // Send back the list of barcodes
    });
});

// Endpoint to fetch item details based on barcode
app.get('/items', (req, res) => {
    const barcode = req.query.barcode;

    if (!barcode) {
        return res.status(400).json({ message: 'Barcode is required' });
    }

    const sqlGetItem = 'SELECT item_name, item_quantity FROM add_item_to_warehouse_by_barcode_scanning WHERE barcode_value = ?';

    db.query(sqlGetItem, [barcode], (err, results) => {
        if (err) {
            console.error('Error fetching item:', err);
            return res.status(500).json({ message: 'Error fetching item' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Item not found with this barcode' });
        }

        res.json(results[0]); // Send back the first matching item's details
    });
});

// Endpoint to handle picking items by barcode
// Endpoint to fetch all available barcodes
app.get('/barcodes', (req, res) => {
    const sqlGetBarcodes = 'SELECT DISTINCT barcode_value FROM add_item_to_warehouse_by_barcode_scanning';

    db.query(sqlGetBarcodes, (err, results) => {
        if (err) {
            console.error('Error fetching barcodes:', err);
            return res.status(500).json({ message: 'Error fetching barcodes' });
        }

        res.json(results); // Send back the list of barcodes
    });
});

// Endpoint to fetch item details based on barcode
app.get('/items', (req, res) => {
    const barcode = req.query.barcode;

    if (!barcode) {
        return res.status(400).json({ message: 'Barcode is required' });
    }

    const sqlGetItem = 'SELECT item_name, item_quantity FROM add_item_to_warehouse_by_barcode_scanning WHERE barcode_value = ?';

    db.query(sqlGetItem, [barcode], (err, results) => {
        if (err) {
            console.error('Error fetching item:', err);
            return res.status(500).json({ message: 'Error fetching item' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Item not found with this barcode' });
        }

        res.json(results[0]); // Send back the first matching item's details
    });
});

// Endpoint to handle picking items by barcode
app.post('/pickUpItemByBarcode', (req, res) => {
    const item_name = 'item_name';
    const { barcode_value, item_quantity } = req.body;

    if (!barcode_value || !item_name || !item_quantity) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const sqlGetItem = 'SELECT item_quantity FROM add_item_to_warehouse_by_barcode_scanning WHERE barcode_value = ?';

    db.query(sqlGetItem, [barcode_value], (err, results) => {
        if (err) {
            console.error('Error fetching item:', err);
            return res.status(500).json({ message: 'Error fetching item' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Item not found with this barcode' });
        }

        const currentQuantity = results[0].item_quantity;

        if (item_quantity > currentQuantity) {
            return res.status(400).json({ message: 'Not enough stock available' });
        }

        // Update quantity in add_item_to_warehouse_by_barcode_scanning table
        const updatedQuantity = currentQuantity - item_quantity;

        const sqlUpdateItem = 'UPDATE add_item_to_warehouse_by_barcode_scanning SET item_quantity = ? WHERE barcode_value = ?';

        db.query(sqlUpdateItem, [updatedQuantity, barcode_value], (err) => {
            if (err) {
                console.error('Error updating item quantity:', err);
                return res.status(500).json({ message: 'Error updating item quantity' });
            }

            // Insert new entry into pick_up_item_by_barcode_scanning table
            const sqlInsertTransaction = `
                  INSERT INTO pick_up_item_by_barcode_scanning (item_name, item_quantity, barcode_value)
                  VALUES (?, ?, ?)
              `;

            db.query(sqlInsertTransaction, [item_name, item_quantity, barcode_value], (err) => {
                if (err) {
                    console.error('Error adding pick-up transaction:', err);
                    return res.status(500).json({ message: 'Error adding pick-up transaction' });
                }

                res.json({
                    message: 'Item picked successfully',
                    item_name: item_name,
                    picked_quantity: item_quantity,
                });
            });
        });
    });
});

// Endpoint to handle order placement
app.post('/api/orders', (req, res) => {
    const { orderId, price, itemName } = req.body;

    // SQL query to insert new order
    const query = `
        INSERT INTO orders (order_id, price, item_name, order_date, order_time)
        VALUES (?, ?, ?, CURDATE(), CURTIME())
    `;

    db.execute(query, [orderId, price, itemName], (err, results) => {
        if (err) {
            console.error('Error inserting order:', err);
            return res.status(500).json({ error: 'Failed to place order' });
        }
        res.status(201).json({ message: 'Order placed successfully', orderId });
    });
});

// Endpoint to fetch available items
app.get('/availableItems', (req, res) => {
    const query = 'SELECT * FROM available_items';
    db.query(query, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});




// Default route for undefined routes
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}/index.html`);
});
