const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const DELIVERY_FEE = 150;
const FREE_DELIVERY_ABOVE = 3000;
const PHONE_RE = /^[0-9+\-\s]{10,15}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ALLOWED_NEXT = ['/', '/cart', '/profile', '/orders', '/favourites', '/addresses'];

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));

// Smart fallback for banners: automatically serve .png, .jpg, or .jpeg regardless of extension requested
app.get('/images/banners/:name', (req, res, next) => {
    const raw = req.params.name;
    const baseName = path.basename(raw, path.extname(raw));
    const bannerDir = path.join(__dirname, 'public', 'images', 'banners');
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'svg']) {
        const file = path.join(bannerDir, `${baseName}.${ext}`);
        if (fs.existsSync(file)) {
            return res.sendFile(file);
        }
    }
    next();
});

// Favicon route with no-cache to force browser tab refresh
app.get('/favicon.ico', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'amnas-bakery-semester-project',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' }
}));

// ---------- helpers available in every page ----------
function money(n) {
    return 'Rs. ' + Math.round(Number(n)).toLocaleString('en-US');
}
function fmtDate(value) {
    const d = new Date(String(value).replace(' ', 'T') + 'Z');
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
app.use((req, res, next) => {
    res.locals.loggedIn = !!req.session.userId;
    res.locals.money = money;
    res.locals.fmtDate = fmtDate;
    res.locals.deliveryFee = DELIVERY_FEE;
    res.locals.freeAbove = FREE_DELIVERY_ABOVE;
    res.locals.pageTitle = 'Menu';
    res.locals.active = '';
    next();
});

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login?next=' + encodeURIComponent(req.path));
    }
    next();
}
function safeNext(value) {
    return ALLOWED_NEXT.includes(value) ? value : '/';
}
function favouriteIds(req) {
    if (!req.session.userId) { return []; }
    return db.all('SELECT product_id FROM favourites WHERE user_id = ?', [req.session.userId]).map(r => r.product_id);
}
function startSession(req, res, user, destination) {
    req.session.regenerate(err => {
        if (err) { return res.status(500).send('Could not start session.'); }
        req.session.userId = user.id;
        req.session.userName = user.full_name;
        req.session.save(() => res.redirect(destination));
    });
}

// ---------- home ----------
const VALID_TABLES = ['products', 'users', 'orders', 'order_items', 'addresses', 'favourites'];
app.get('/', (req, res) => {
    const products = db.all('SELECT * FROM products ORDER BY category, id');
    const categories = [...new Set(products.map(p => p.category))];
    res.render('index', { pageTitle: 'Menu', active: 'home', products, categories, favs: favouriteIds(req) });
});

// ---------- product details ----------
app.get('/product/:id', (req, res) => {
    const product = db.get('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
    if (!product) { return res.redirect('/'); }
    const related = db.all('SELECT * FROM products WHERE category = ? AND id <> ? ORDER BY id LIMIT 4', [product.category, product.id]);
    const favs = favouriteIds(req);
    res.render('product', {
        pageTitle: product.name, active: 'home', product, related, favs, isFav: favs.includes(product.id)
    });
});

// ---------- favourites ----------
app.post('/favourite', (req, res) => {
    if (!req.session.userId) { return res.status(401).json({ login: true }); }
    const pid = parseInt(req.body.product_id, 10) || 0;
    if (!db.get('SELECT id FROM products WHERE id = ?', [pid])) {
        return res.status(404).json({ error: 'Product not found' });
    }
    const uid = req.session.userId;
    if (db.get('SELECT id FROM favourites WHERE user_id = ? AND product_id = ?', [uid, pid])) {
        db.run('DELETE FROM favourites WHERE user_id = ? AND product_id = ?', [uid, pid]);
        return res.json({ status: 'removed' });
    }
    db.run('INSERT INTO favourites (user_id, product_id) VALUES (?, ?)', [uid, pid]);
    res.json({ status: 'added' });
});

app.get('/favourites', requireLogin, (req, res) => {
    const items = db.all(
        'SELECT p.* FROM favourites f JOIN products p ON p.id = f.product_id WHERE f.user_id = ? ORDER BY f.id DESC',
        [req.session.userId]
    );
    res.render('favourites', { pageTitle: 'Favourites', active: 'favourites', items, favs: items.map(p => p.id) });
});

// ---------- login / signup / logout ----------
app.get('/login', (req, res) => {
    const next = safeNext(req.query.next);
    if (req.session.userId) { return res.redirect(next); }
    res.render('login', { pageTitle: 'Login', next, error: '', email: '' });
});

app.post('/login', (req, res) => {
    const next = safeNext(req.body.next);
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const fail = msg => res.render('login', { pageTitle: 'Login', next, error: msg, email });

    if (!email || !password) { return fail('Please enter your email and password.'); }
    const user = db.get('SELECT id, full_name, password_hash FROM users WHERE email = ?', [email]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return fail('Incorrect email or password.');
    }
    startSession(req, res, user, next);
});

app.get('/signup', (req, res) => {
    if (req.session.userId) { return res.redirect('/profile'); }
    res.render('signup', { pageTitle: 'Sign Up', errors: [], form: { full_name: '', email: '', phone: '' } });
});

app.post('/signup', (req, res) => {
    const form = {
        full_name: String(req.body.full_name || '').trim(),
        email: String(req.body.email || '').trim().toLowerCase(),
        phone: String(req.body.phone || '').trim()
    };
    const password = String(req.body.password || '');
    const confirm = String(req.body.confirm || '');
    const errors = [];

    if (form.full_name.length < 2) { errors.push('Please enter your full name.'); }
    if (!EMAIL_RE.test(form.email)) { errors.push('Please enter a valid email address.'); }
    if (!PHONE_RE.test(form.phone)) { errors.push('Please enter a valid phone number (10 to 15 digits).'); }
    if (password.length < 6) { errors.push('Password must be at least 6 characters.'); }
    if (password !== confirm) { errors.push('Passwords do not match.'); }
    if (!errors.length && db.get('SELECT id FROM users WHERE email = ?', [form.email])) {
        errors.push('An account with this email already exists.');
    }
    if (errors.length) {
        return res.render('signup', { pageTitle: 'Sign Up', errors, form });
    }

    const hash = bcrypt.hashSync(password, 10);
    const r = db.run('INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
        [form.full_name, form.email, form.phone, hash]);
    startSession(req, res, { id: r.lastId, full_name: form.full_name }, '/profile');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// ---------- profile ----------
function renderProfile(req, res, msg, error) {
    const uid = req.session.userId;
    const user = db.get('SELECT full_name, email, phone, created_at FROM users WHERE id = ?', [uid]);
    if (!user) { return res.redirect('/logout'); }
    res.render('profile', {
        pageTitle: 'My Profile', user, msg, error,
        orderCount: db.get('SELECT COUNT(*) AS c FROM orders WHERE user_id = ?', [uid]).c,
        favCount: db.get('SELECT COUNT(*) AS c FROM favourites WHERE user_id = ?', [uid]).c
    });
}
app.get('/profile', requireLogin, (req, res) => renderProfile(req, res, '', ''));
app.post('/profile', requireLogin, (req, res) => {
    const name = String(req.body.full_name || '').trim();
    const phone = String(req.body.phone || '').trim();
    if (name.length < 2) { return renderProfile(req, res, '', 'Please enter your full name.'); }
    if (!PHONE_RE.test(phone)) { return renderProfile(req, res, '', 'Please enter a valid phone number.'); }
    db.run('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [name, phone, req.session.userId]);
    req.session.userName = name;
    renderProfile(req, res, 'Profile updated.', '');
});

// ---------- cart and checkout ----------
function renderCart(req, res, errors, form) {
    const addresses = req.session.userId
        ? db.all('SELECT * FROM addresses WHERE user_id = ? ORDER BY id DESC', [req.session.userId])
        : [];
    res.render('cart', { pageTitle: 'Cart', active: '', errors, form, addresses });
}
app.get('/cart', (req, res) => renderCart(req, res, [], {}));

app.post('/cart', requireLogin, (req, res) => {
    const uid = req.session.userId;
    const form = {
        address_id: String(req.body.address_id || ''),
        new_address: String(req.body.new_address || ''),
        phone: String(req.body.phone || ''),
        notes: String(req.body.notes || '')
    };
    const errors = [];

    // 1. Read the cart sent by the browser. Prices always come from the database.
    let raw = [];
    try { raw = JSON.parse(req.body.cart_json || '[]'); } catch (e) { raw = []; }
    const lines = [];
    let subtotal = 0;
    if (Array.isArray(raw)) {
        raw.forEach(item => {
            const prod = db.get('SELECT id, name, price FROM products WHERE id = ?', [parseInt(item && item.id, 10) || 0]);
            const qty = Math.max(1, Math.min(20, parseInt(item && item.qty, 10) || 1));
            if (prod) {
                lines.push({ id: prod.id, name: prod.name, price: prod.price, qty });
                subtotal += prod.price * qty;
            }
        });
    }
    if (!lines.length) { errors.push('Your cart is empty.'); }

    // 2. Delivery address and phone
    let addressText = '';
    let phone = form.phone.trim();
    const addressId = parseInt(form.address_id, 10) || 0;
    if (addressId > 0) {
        const ad = db.get('SELECT address_line, city, phone FROM addresses WHERE id = ? AND user_id = ?', [addressId, uid]);
        if (ad) {
            addressText = ad.address_line + ', ' + ad.city;
            if (!phone) { phone = ad.phone; }
        } else {
            errors.push('Please choose a valid address.');
        }
    } else {
        addressText = form.new_address.trim();
        if (addressText.length < 8) { errors.push('Please enter your full delivery address.'); }
    }
    if (!PHONE_RE.test(phone)) { errors.push('Please enter a valid phone number.'); }
    const notes = form.notes.trim().slice(0, 300);

    if (errors.length) { return renderCart(req, res, errors, form); }

    // 3. Save the order
    const fee = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
    const total = subtotal + fee;
    try {
        const orderId = db.transaction(() => {
            const o = db.run(
                'INSERT INTO orders (user_id, address_text, phone, notes, subtotal, delivery_fee, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [uid, addressText, phone, notes, subtotal, fee, total]
            );
            lines.forEach(l => db.run(
                'INSERT INTO order_items (order_id, product_id, product_name, price, qty) VALUES (?, ?, ?, ?, ?)',
                [o.lastId, l.id, l.name, l.price, l.qty]
            ));
            return o.lastId;
        });
        res.redirect('/orders?placed=' + orderId);
    } catch (err) {
        console.error(err);
        renderCart(req, res, ['Sorry, we could not place your order. Please try again.'], form);
    }
});

// ---------- orders ----------
app.get('/orders', requireLogin, (req, res) => {
    const orders = db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [req.session.userId]);
    orders.forEach(o => {
        o.items = db.all('SELECT product_name, price, qty FROM order_items WHERE order_id = ?', [o.id]);
    });
    res.render('orders', {
        pageTitle: 'My Orders', active: 'orders', orders, placed: parseInt(req.query.placed, 10) || 0
    });
});

// ---------- addresses ----------
function renderAddresses(req, res, error, flash) {
    const addresses = db.all('SELECT * FROM addresses WHERE user_id = ? ORDER BY id DESC', [req.session.userId]);
    res.render('addresses', { pageTitle: 'Addresses', active: 'addresses', addresses, error, flash });
}
app.get('/addresses', requireLogin, (req, res) => {
    const flash = req.query.saved ? 'Address saved.' : (req.query.deleted ? 'Address removed.' : '');
    renderAddresses(req, res, '', flash);
});
app.post('/addresses', requireLogin, (req, res) => {
    const uid = req.session.userId;
    if (req.body.action === 'delete') {
        db.run('DELETE FROM addresses WHERE id = ? AND user_id = ?', [parseInt(req.body.id, 10) || 0, uid]);
        return res.redirect('/addresses?deleted=1');
    }
    let label = String(req.body.label || 'Home');
    const line = String(req.body.address_line || '').trim();
    const city = String(req.body.city || '').trim();
    const phone = String(req.body.phone || '').trim();
    if (!['Home', 'Work', 'Other'].includes(label)) { label = 'Other'; }
    if (line.length < 8 || city.length < 2) { return renderAddresses(req, res, 'Please enter a full address and city.', ''); }
    if (!PHONE_RE.test(phone)) { return renderAddresses(req, res, 'Please enter a valid phone number.', ''); }
    db.run('INSERT INTO addresses (user_id, label, address_line, city, phone) VALUES (?, ?, ?, ?, ?)', [uid, label, line, city, phone]);
    res.redirect('/addresses?saved=1');
});

// ---------- admin & database portal ----------
function requireAdmin(req, res, next) {
    if (!req.session.isAdmin) {
        return res.redirect('/admin/login');
    }
    next();
}

app.get('/admin/login', (req, res) => {
    if (req.session.isAdmin) { return res.redirect('/admin'); }
    res.render('admin/login', { error: req.query.error || '' });
});

app.post('/admin/login', (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const admin = db.get('SELECT * FROM admins WHERE username = ?', [username]);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        return res.render('admin/login', { error: 'Invalid admin username or password.' });
    }
    req.session.isAdmin = true;
    req.session.adminUser = admin.username;
    res.redirect('/admin');
});

app.get('/admin/logout', (req, res) => {
    req.session.isAdmin = false;
    req.session.adminUser = null;
    res.redirect('/admin/login');
});

app.get('/admin', requireAdmin, (req, res) => {
    const activeTab = req.query.tab || 'database';
    const requestedTable = String(req.query.table || '').toLowerCase();
    const activeTable = VALID_TABLES.includes(requestedTable) ? requestedTable : 'products';

    const totalRevenue = db.get('SELECT COALESCE(SUM(total), 0) AS rev FROM orders')?.rev || 0;
    const totalOrders = db.get('SELECT COUNT(*) AS c FROM orders')?.c || 0;
    const totalProducts = db.get('SELECT COUNT(*) AS c FROM products')?.c || 0;
    const totalUsers = db.get('SELECT COUNT(*) AS c FROM users')?.c || 0;

    const tableCounts = VALID_TABLES.map(name => {
        const row = db.get(`SELECT COUNT(*) AS c FROM ${name}`);
        return { name, count: row ? row.c : 0 };
    });

    const rows = db.all(`SELECT * FROM ${activeTable} ORDER BY id DESC LIMIT 100`);

    const ordersRaw = db.all(`
        SELECT o.*, u.full_name AS customer_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.id DESC
    `);
    const allOrders = ordersRaw.map(o => {
        const items = db.all('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
        return { ...o, items };
    });

    res.render('admin/dashboard', {
        adminUser: req.session.adminUser || 'Admin',
        activeTab,
        activeTable,
        tables: tableCounts,
        rows,
        allOrders,
        stats: { totalRevenue, totalOrders, totalProducts, totalUsers },
        successMsg: req.query.saved ? 'Settings saved successfully.' : (req.query.updated ? 'Order status updated.' : ''),
        errorMsg: req.query.err || ''
    });
});

app.post('/admin/order-status', requireAdmin, (req, res) => {
    const orderId = parseInt(req.body.order_id, 10) || 0;
    const status = String(req.body.status || 'Pending');
    if (['Pending', 'Confirmed', 'Delivered', 'Cancelled'].includes(status)) {
        db.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    }
    res.redirect('/admin?tab=orders&updated=1');
});

app.post('/admin/change-password', requireAdmin, (req, res) => {
    const oldPass = String(req.body.old_password || '');
    const newPass = String(req.body.new_password || '');
    const confirmPass = String(req.body.confirm_password || '');

    const admin = db.get('SELECT * FROM admins WHERE username = ?', [req.session.adminUser]);
    if (!admin || !bcrypt.compareSync(oldPass, admin.password_hash)) {
        return res.redirect('/admin?tab=security&err=' + encodeURIComponent('Current password was incorrect.'));
    }
    if (newPass.length < 6) {
        return res.redirect('/admin?tab=security&err=' + encodeURIComponent('New password must be at least 6 characters.'));
    }
    if (newPass !== confirmPass) {
        return res.redirect('/admin?tab=security&err=' + encodeURIComponent('New passwords do not match.'));
    }

    const newHash = bcrypt.hashSync(newPass, 10);
    db.run('UPDATE admins SET password_hash = ? WHERE username = ?', [newHash, req.session.adminUser]);
    res.redirect('/admin?tab=security&saved=1');
});

// Protect /database route so it is strictly for authenticated admins only
app.get('/database', (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin/login');
    }
    res.redirect('/admin?tab=database' + (req.query.table ? '&table=' + encodeURIComponent(req.query.table) : ''));
});

// ---------- not found ----------
app.use((req, res) => {
    res.status(404).render('notfound', { pageTitle: 'Page not found', active: '' });
});

db.init().then(() => {
    // Ensure admins table and default admin exist
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const existingAdmin = db.get('SELECT id FROM admins WHERE username = ?', ['admin']);
    if (!existingAdmin) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['admin', hash]);
        console.log('Default admin created: username="admin", password="admin123"');
    }

    app.listen(PORT, () => {
        console.log("Amna's Bakery is running at http://localhost:" + PORT);
    });
}).catch(err => {
    console.error('Could not start the server:', err);
    process.exit(1);
});
