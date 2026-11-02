// Explicitly loopback-only and in an isolated schema; never uses DATABASE_URL.
exports.connect = async port => {
  const {Pool, types} = require('pg');
  types.setTypeParser(1082, value => value);
  const schema = 'calendar_test_' + process.pid + '_' + Date.now();
  const config = {host:'127.0.0.1',port,user:'backup_verifier',database:'postgres',ssl:false};
  const admin = new Pool(config);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({...config, options:`-c search_path=${schema},public`});
  return {
    query: (...args) => pool.query(...args),
    exec: sql => pool.query(sql),
    transaction: async fn => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {await client.query('ROLLBACK');throw error;}
      finally {client.release();}
    },
    close: async () => {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    },
  };
};
