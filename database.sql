-- Amna's Bakery database (SQLite)
-- This file is run automatically the first time the server starts.
-- The database file is created at data/amnas_bakery.db
-- To reset everything, stop the server and delete data/amnas_bakery.db

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  old_price REAL,
  image TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favourites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_text TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  subtotal REAL NOT NULL,
  delivery_fee REAL NOT NULL,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Cash on Delivery',
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  price REAL NOT NULL,
  qty INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (name, category, description, price, old_price, image) VALUES
('Chocolate Truffle Cake', 'Cakes', 'Rich chocolate sponge layered with silky truffle ganache and finished with chocolate shavings.', 2800, NULL, '/images/products/chocolate-truffle-cake.jpg'),
('Vanilla Bean Layer Cake', 'Cakes', 'Soft vanilla sponge with vanilla bean cream between every layer. A classic for any celebration.', 2400, 2800, '/images/products/vanilla-bean-layer-cake.jpg'),
('Red Velvet Cake', 'Cakes', 'Velvety red sponge with tangy cream cheese frosting and a soft crumb topping.', 3000, NULL, '/images/products/red-velvet-cake.jpg'),
('Strawberry Fresh Cream Cake', 'Cakes', 'Light sponge, whipped fresh cream and sweet strawberry filling, topped with berries.', 2900, NULL, '/images/products/strawberry-fresh-cream-cake.jpg'),
('Caramel Biscoff Cake', 'Cakes', 'Caramel sponge with biscoff spread, crushed biscuit crumble and a golden caramel drizzle.', 3200, 3600, '/images/products/caramel-biscoff-cake.jpg'),
('Lemon Drizzle Cake', 'Cakes', 'Zesty lemon sponge soaked in lemon syrup with a bright, sweet glaze.', 2200, NULL, '/images/products/lemon-drizzle-cake.jpg'),
('Classic Vanilla Cupcake', 'Cupcakes', 'Fluffy vanilla cupcake with swirled buttercream and rainbow sprinkles.', 280, NULL, '/images/products/classic-vanilla-cupcake.jpg'),
('Chocolate Fudge Cupcake', 'Cupcakes', 'Moist chocolate cupcake with a fudge centre and chocolate buttercream.', 320, NULL, '/images/products/chocolate-fudge-cupcake.jpg'),
('Red Velvet Cupcake', 'Cupcakes', 'Mini red velvet cupcake with cream cheese frosting.', 350, 400, '/images/products/red-velvet-cupcake.jpg'),
('Choco Chip Cookie', 'Cookies', 'Golden, chewy cookie loaded with chocolate chips. Baked fresh every morning.', 180, NULL, '/images/products/choco-chip-cookie.jpg'),
('Oatmeal Raisin Cookie', 'Cookies', 'Soft oatmeal cookie with plump raisins and a hint of cinnamon.', 160, NULL, '/images/products/oatmeal-raisin-cookie.jpg'),
('Double Chocolate Cookie', 'Cookies', 'Dark chocolate cookie with melted chocolate chunks inside.', 200, NULL, '/images/products/double-chocolate-cookie.jpg'),
('Walnut Brownie', 'Brownies', 'Dense, fudgy brownie topped with crunchy walnut pieces.', 350, NULL, '/images/products/walnut-brownie.jpg'),
('Fudgy Brownie', 'Brownies', 'Our signature gooey brownie with a shiny, crackly top.', 300, 360, '/images/products/fudgy-brownie.jpg'),
('Glazed Donut', 'Donuts', 'Light and airy donut with a smooth sugar glaze.', 220, NULL, '/images/products/glazed-donut.jpg'),
('Sprinkle Donut', 'Donuts', 'Pink frosted donut covered in colourful sprinkles.', 240, NULL, '/images/products/sprinkle-donut.jpg');
