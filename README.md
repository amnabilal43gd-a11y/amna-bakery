# Amna's Bakery

Semester web project: an online bakery ordering website. The layout and style follow the Layers ordering site (gold and white theme, header with logo and navbar, banner slider, category tabs, product cards, cart drawer, account pages). The name, products and images are placeholders.

## Technologies

- HTML5 (pages are written as EJS templates in the `views` folder and sent to the browser as HTML)
- CSS3 (`public/css/style.css`, responsive for phone, tablet and desktop)
- JavaScript in the browser (`public/js/main.js`: slider, category tabs and search, cart, favourites, form checks)
- Node.js with Express (the web server, login sessions and all the logic)
- SQLite database (one file, no database server to install)
- Font Awesome icons (loaded from the internet)

## Pages

| Page | Address |
| --- | --- |
| Home (slider, tabs, search, products) | `/` |
| Product details | `/product/1` |
| Cart and checkout | `/cart` |
| Login | `/login` |
| Sign up | `/signup` |
| Profile | `/profile` |
| My orders | `/orders` |
| Favourites | `/favourites` |
| Addresses | `/addresses` |

All pages share the same header and footer (`views/partials`). The footer has the social media links and icons.

## Database

File: `data/amnas_bakery.db` (created automatically the first time the server starts, from `database.sql`).

Tables: `users`, `products`, `addresses`, `favourites`, `orders`, `order_items`. Passwords are stored hashed with bcrypt, never as plain text.

To look inside the database, open the file with the free program DB Browser for SQLite. To reset everything, stop the server and delete `data/amnas_bakery.db`. A fresh one is created on the next start.

## How to run

1. Install Node.js (the LTS version) from https://nodejs.org if you do not have it. Check with `node -v` in a terminal.
2. Open a terminal inside this folder. On Windows you can click the folder address bar in File Explorer, type `cmd` and press Enter.
3. Run `npm install` (only needed once, needs internet).
4. Run `npm start`.
5. Open http://localhost:3000 in your browser.

To stop the server press `Ctrl + C` in the terminal.

If port 3000 is busy, start it on another port. In Command Prompt: `set PORT=4000 && npm start`. In PowerShell: `$env:PORT=4000; npm start`. Then open http://localhost:4000.

## How to use

1. Browse the menu on the home page, use the tabs or the search bar.
2. Click Add to put items in the cart. The cart is saved in the browser.
3. Sign up or log in, then open the cart and place the order (Cash on Delivery).
4. Check My Orders, Favourites, Addresses and Profile from the header.

## Folder structure

```
amnas-bakery/
  server.js          the web server, routes and logic
  db.js              database helper
  database.sql       tables and sample products
  package.json       list of Node packages
  views/             HTML templates (pages and shared header and footer)
  public/            files sent to the browser (css, js, images, fonts)
  data/              the SQLite database file (created on first run)
```
