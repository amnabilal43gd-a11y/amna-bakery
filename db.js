// Small SQLite helper built on sql.js (pure JavaScript, nothing to compile or install).
// The database lives in data/amnas_bakery.db and is saved to disk after every change.
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'amnas_bakery.db');
let db;
let inTransaction = false;

function persist() {
    const data = db.export();               // export() resets pragmas, so set them again
    db.run('PRAGMA foreign_keys = ON');
    fs.writeFileSync(DB_FILE, Buffer.from(data));
}

async function init() {
    const SQL = await initSqlJs();
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    const fresh = !fs.existsSync(DB_FILE);
    db = fresh ? new SQL.Database() : new SQL.Database(fs.readFileSync(DB_FILE));
    db.run('PRAGMA foreign_keys = ON');
    if (fresh) {
        db.exec(fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8'));
        persist();
        console.log('Created new database at ' + DB_FILE);
    }
}

function all(sql, params = []) {
    const stmt = db.prepare(sql);
    try {
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        return rows;
    } finally {
        stmt.free();
    }
}

function get(sql, params = []) {
    return all(sql, params)[0] || null;
}

function run(sql, params = []) {
    db.run(sql, params);
    const lastId = get('SELECT last_insert_rowid() AS id').id;
    if (!inTransaction) {
        persist();
    }
    return { lastId };
}

function transaction(fn) {
    db.run('BEGIN');
    inTransaction = true;
    try {
        const result = fn();
        db.run('COMMIT');
        inTransaction = false;
        persist();
        return result;
    } catch (err) {
        inTransaction = false;
        try { db.run('ROLLBACK'); } catch (e) { /* nothing to roll back */ }
        throw err;
    }
}

module.exports = { init, all, get, run, transaction };
