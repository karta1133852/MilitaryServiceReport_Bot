const { pgQuery } = require('../controllers/postgresController');

async function createTables() {

  const sqlCreateTable = 'CREATE TABLE IF NOT EXISTS report_content (student_id integer PRIMARY KEY NOT NULL, name text, content text, state text, group_id text); ' +
    'CREATE TABLE IF NOT EXISTS group_info ( group_id text PRIMARY KEY NOT NULL, start_id integer, end_id integer ); ' +
    'CREATE TABLE IF NOT EXISTS report_date ( date text PRIMARY KEY NOT NULL );';

  const res = await pgQuery(sqlCreateTable);
  if (res !== null) {
    console.log('成功建立資料表');
  }
}

async function dropTables() {

  const sqlDropTable = 'DROP TABLE report_content; ' +
    'DROP TABLE group_info; ' +
    'DROP TABLE report_date;';

  const res = await pgQuery(sqlDropTable);
  if (res !== null) {
    console.log('成功刪除資料表');
  } 
}

module.exports = { createTables, dropTables };