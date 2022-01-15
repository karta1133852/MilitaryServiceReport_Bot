const { pgQuery } = require('../controllers/postgresController');

const sqlDropTable = 'DROP TABLE report_content; ' +
  'DROP TABLE group_info; ' +
  'DROP TABLE report_date;';

(async () => {
  const res = await pgQuery(sqlDropTable).catch(err => console.log(err));
  if (res !== null) {
    console.log('成功刪除資料表');
  }
})();