const { createTables, dropTables } = require('./dbOperations');

(async () => {
  await dropTables;
  await createTables;
})();