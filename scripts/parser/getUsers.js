const { default: axios } = require("axios");
const { parse } = require("fast-html-parser");
const { Client } = require("pg");

const createEntries = `
    CREATE TABLE IF NOT EXISTS "entries_new" (
	    "id" INT NOT NULL,
	    "project_id" INT NOT NULL,
	    "created_by" INT NOT NULL,
        "hours" VARCHAR(10) NOT NULL,
        "worked" VARCHAR(100) NOT NULL,
        "created" VARCHAR(100) NOT NULL,
        "notes" VARCHAR(1000) NOT NULL,
	    PRIMARY KEY ("id")
    );`;

// const createUsers = `
//     CREATE TABLE IF NOT EXISTS "userTest" (
// 	    "id" INT NOT NULL,
//         "name" VARCHAR(100) NOT NULL,
//         "notes" VARCHAR(1000) NOT NULL,
// 	    PRIMARY KEY ("id")
//     );`;

let successCount = 0;
let axiosError = [];
let dbError = [];

const insertEntryQuery =
  "INSERT INTO entries_new(id, project_id, created_by, hours, worked, created, notes) VALUES($1, $2, $3, $4, $5, $6, $7)";

const init = async () => {
  const client = new Client();
  await client.connect();
  await client.query(createEntries);
  console.log("Connected to a client");
  return client;
};

const main = async () => {
  const db = await init();
  const res = await db.query("SELECT DISTINCT created_by FROM entries_new ORDER BY created_by");
  console.log(res.rowCount);
  console.log(res.rows.map(row => row.created_by));
};

main();
