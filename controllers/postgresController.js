const pg = require('pg');
require('dotenv').config();

let pgClient

const getPgClient = () => {
  if (pgClient == null) {
    pgClient = new pg.Client({
      connectionString: process.env.PG_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  
  return pgClient
}

module.exports = { getPgClient };