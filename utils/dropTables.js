const { pgQuery } = require('../controllers/postgresController');

const sqlDropTable = 'DROP TABLE report_content; ' +
  'DROP TABLE group_info; ' +
  'DROP TABLE report_date;';

(async () => {
  try {
    const res = await pgQuery(sqlDropTable);
    if (res !== null) {
      console.log('成功刪除資料表');
    } 
  } catch (err) {
    
  }
})();