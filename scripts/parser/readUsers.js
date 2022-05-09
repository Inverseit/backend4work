const { Client } = require("pg");

const init = async () => {
  const client = new Client();
  await client.connect();
  console.log("Connected to a client");
  return client;
};

const main = async () => {
  const db = await init();
  const res = await db.query("SELECT * FROM users_test ORDER BY id");
  console.log(res.rows);
};

main();
