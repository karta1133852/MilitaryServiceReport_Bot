const { pgQuery } = require('../controllers/postgresController');

const sqlCreateTable = 'CREATE TABLE IF NOT EXISTS report_content (student_id integer, content text, state text, group_id text);' +
  'CREATE TABLE IF NOT EXISTS group_info ( group_id text, start_id integer, end_id integer );' +
  'CREATE TABLE IF NOT EXISTS report_date ( date text );' + 
  'CREATE INDEX index ON report_content (student_id);';

(async () => {
  await pgQuery(sqlCreateTable);
})();