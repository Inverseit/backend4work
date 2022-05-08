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

const parseData = (html) => {
  const parsed = parse(html);
  const table = parsed
    .querySelector("table")
    .childNodes.filter(
      (row) => row.tagName === "tr" && row.childNodes.length == 5
    );

  const textNodes = table.map((elem) => elem.childNodes[3].childNodes[0]);
  const filtered = textNodes.filter((elem) => elem !== undefined);
  const rawData = filtered.map((elem) => elem.rawText);
  return {
    tid: parseInt(rawData[0]),
    project_id: parseInt(rawData[1]),
    user_id: parseInt(rawData[2]),
    hours: rawData[3],
    worked: rawData[4],
    created: rawData[5],
    notes: rawData[6] ? rawData[6] : "",
  };
};

// https://tech4work.com/studentemp/index.asp?uid=
const getEntry = async (db, tid) => {
  try {
    console.log("Starting " + tid);
    const res = await axios.get(
      `https://www.tech4work.com/studentemp/job_timesheet_detail.asp`,
      {
        params: { tid },
      }
    );
    const data = parseData(res.data);
    await writeEntry(tid, data, db);
  } catch (error) {
    console.log("axios error", tid);
    axiosError.append([tid, error]);
  }
};

const writeEntry = async (id, data, db) => {
  if (data) {
    try {
      let { tid, project_id, user_id, hours, worked, created, notes } = data;
      await db.query(insertEntryQuery, [
        tid,
        project_id,
        user_id,
        hours,
        worked,
        created,
        notes,
      ]);
      successCount++;
      console.log(successCount, id);
    } catch (error) {
      console.log("db error", tid);
      dbError.append([id, error]);
    }
  }
};

const main = async () => {
  const db = await init();
  const startID = 324565;
  const total = 5000;
  const allRequests = [...Array(total).keys()].map((i) =>
    getEntry(db, startID + i)
  );
  await Promise.allSettled(allRequests);
  console.log("Done");
  console.log(
    `Success : ${successCount} (${
      (successCount * 100) / total
    }%). Axios Error: ${axiosError.length}. Db Error: ${dbError.length} `
  );
};

main();
