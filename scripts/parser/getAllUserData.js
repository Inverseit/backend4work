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

const createUsers = `
    CREATE TABLE IF NOT EXISTS "users_test" (
	    "id" INT NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "notes" VARCHAR(1000) NOT NULL,
	    PRIMARY KEY ("id")
    );`;

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

const parseRawHTML = (id, html) => {
  const startIndex = html.indexOf("cellpadding");
  const tableBeginString = html.slice(startIndex - 31);
  const endIndex = tableBeginString.indexOf("</table>");
  const notes = tableBeginString.slice(0, endIndex + 8);
  const removed = notes.replace("<!--", "").replace("-->", "");
  const nameStartIndex = removed.indexOf("Student:") + 9;
  const nameEndIndex = removed.indexOf("</td>");
  const name = removed.slice(nameStartIndex, nameEndIndex);
  return [id, name, notes];
}

const writeToDB = async (db, data, id) => {
  try {
    await db.query("INSERT INTO users_test values ($1, $2, $3)", data);
    successCount++;
    console.log("Wrote " + id);
  } catch (error) {
    console.log("Got db error " + id);
    dbError.push([id, data]);
  }
}

const getUserData = async (db, id) => {
  try {
    console.log("Sending " + id);
    const res = await axios.get("https://www.tech4work.com/studentemp/index.asp", {
      params: {uid: id}
    })
    const html = res.data;
    const data = parseRawHTML(id, html);
    await writeToDB(db, data, id);
  } catch (error) {
    console.log("Got axios error " + id);
    axiosError.push([id, error]);
  }
}

const main = async () => {
  const db = await init();
  await db.query(createUsers);
  const res = await db.query("SELECT DISTINCT created_by FROM entries_new ORDER BY created_by");
  const total = res.rowCount;
  const users = res.rows.map(row => row.created_by);
  console.log("Going to do " + total);
  await Promise.allSettled(users.map(id => getUserData(db, id)));
  console.log("Done everything");
  console.log(
    `Success : ${successCount} (${
      (successCount * 100) / total
    }%). Axios Error: ${axiosError.length}. Db Error: ${dbError.length}.`
  );
};

main();
