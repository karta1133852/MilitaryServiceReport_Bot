const pg = require('pg');
require('dotenv').config();

const getPgClient = () => {
  const pgClient = new pg.Client({
    connectionString: process.env.PG_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  return pgClient
}

const pgQuery = async (sql) => {
  const client = getPgClient();
  try {
    client.connect();
    const res = await client.query(sql);
    //console.log(res);

    return res;
  } catch (err) {
    console.log(err);
    return null;
  } finally {
    client.end();
  }
}

module.exports = { getPgClient, pgQuery };