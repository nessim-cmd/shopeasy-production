const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query('SELECT 1'))
  .then(() => console.log('DB is awake!'))
  .catch(e => console.error('DB Wake Error:', e))
  .finally(() => client.end());
