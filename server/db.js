/**
 * Simple JSON file-based database — no native compilation needed.
 * All data is kept in memory and written to disk after every mutation.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const EMPTY = {
  users: [],
  rooms: [],
  contributions: [],
  comments: [],
  reactions: [],
  notifications: [],
  chat_messages: [],
  room_members: []
};

let store;

try {
  store = fs.existsSync(DATA_FILE)
    ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    : { ...EMPTY };
  // Make sure all collections exist (for schema migrations)
  for (const key of Object.keys(EMPTY)) {
    if (!store[key]) store[key] = [];
  }
} catch (e) {
  console.warn('DB load failed, starting fresh:', e.message);
  store = { ...EMPTY };
}

function save() {
  // Atomic write: write to temp then rename
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, DATA_FILE);
}

module.exports = { store, save };
