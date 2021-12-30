const { getPgClient } = require('./controllers/postgresController');

const sqlCreateTable = 'CREATE TABLE IF NOT EXISTS report_content ( student_id integer, content text );' +
  'CREATE TABLE IF NOT EXISTS group_info ( group_id text, start_id integer, end_id integer );' +
  'CREATE TABLE IF NOT EXISTS report_date ( date text );';

(async () => {
  try {
    const client = getPgClient();
    client.connect();
    client.query(sqlCreateTable, (err, res) => {
      if (err) throw err;
      client.end();
    });
  } catch (err) {
    console.log(err);
  }
})();