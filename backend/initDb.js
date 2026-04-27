const Database = require('better-sqlite3');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const db = new Database('retail.db');

// 1. Create Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    brand_name TEXT,
    latitude REAL,
    longitude REAL,
    status TEXT,
    state TEXT,
    city TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_coords ON stores (latitude, longitude);
  CREATE INDEX IF NOT EXISTS idx_state ON stores (state);
  CREATE INDEX IF NOT EXISTS idx_brand ON stores (brand_name);
`);

console.log('--- Database Schema Created ---');

// 2. Import CSV
const stores = [];
const csvPath = path.join(__dirname, 'data.csv');

console.log('Reading CSV and importing to SQLite...');

const insert = db.prepare(`
  INSERT OR REPLACE INTO stores (id, brand_name, latitude, longitude, status, state, city)
  VALUES (@id, @brand_name, @latitude, @longitude, @status, @state, @city)
`);

const insertMany = db.transaction((rows) => {
  for (const row of rows) insert.run(row);
});

let count = 0;
let batch = [];

fs.createReadStream(csvPath)
  .pipe(csv())
  .on('data', (row) => {
    batch.push({
      id: row.id,
      brand_name: row.brand_name,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      status: row.status,
      state: row.state ? row.state.toLowerCase() : '',
      city: row.city
    });

    if (batch.length >= 1000) {
      insertMany(batch);
      count += batch.length;
      process.stdout.write(`Imported ${count} rows...\r`);
      batch = [];
    }
  })
  .on('end', () => {
    if (batch.length > 0) {
      insertMany(batch);
      count += batch.length;
    }
    console.log(`\n✅ Successfully imported ${count} stores into retail.db`);
  });
