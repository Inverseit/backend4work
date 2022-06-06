import axios from "axios";
import { HTMLElement, parse } from "fast-html-parser";
import { FastifyInstance, FastifyReply } from "fastify";
import { RedisClientType } from "redis";
import {
  HoursRequest,
  Job,
  JobsRequest,
  JobTimeEntry,
  EntryPostRequest,
} from "../types";
import {
  createKeyHours,
  createKeyJobs,
  getEnteredString,
  max,
} from "../helpers";
import {
  backUpEntries,
  backUpJobs,
  getEntriesFromDb,
  getJobsFromDb,
} from "../data_helpers";
import qs from "qs";
import fetch from "node-fetch";

const unauthorized = (reply: FastifyReply) => {
  return reply.code(401).send("Not allowed to see this");
};

const getJobObjects = (tableRows: HTMLElement[]): Job[] => {
  const jobRows: HTMLElement[] = tableRows.filter(
    (row) => row.tagName === "tr"
  );

  const getJobObject = (row: HTMLElement): Job => {
    const entries: HTMLElement[] = row.childNodes
      .filter((row) => row.tagName === "td")
      .slice(1);
    console.log(entries[4].childNodes);
    return {
      jobID: entries[0].childNodes[0].rawText,
      ref: entries[1].childNodes[0].rawText,
      title: entries[2].childNodes[0].rawText,
      superviser: entries[3].childNodes[0]
        ? entries[3].childNodes[0].rawText
        : "",
      hours: {
        thisMonth: entries[4].childNodes[0]
          ? parseInt(entries[4].childNodes[0].rawText)
          : 0,
        lastMonth: entries[5].childNodes[0]
          ? parseInt(entries[5].childNodes[0].rawText)
          : 0,
        total: entries[6].childNodes[0]
          ? parseInt(entries[6].childNodes[0].rawText)
          : 0,
      },
    };
  };

  return jobRows.map(getJobObject);
};

const getTotalEntries = (html: string): number => {
  const len = html.length;
  const excerpt = html.slice(max(0, len - 50));
  const splitted = excerpt.split("\n");
  const row = splitted[splitted.length - 4];
  const lastSpaceIdx = row.lastIndexOf(" ");
  const num = parseInt(row.slice(lastSpaceIdx + 1));
  return num;
};

const getAllEntries = async (
  userID: string,
  jobID: string,
  totalEntries: number,
  cookie: string
) => {
  const entries: JobTimeEntry[] = [];
  console.log(entries, totalEntries);

  const getDataFromChild = (child: HTMLElement[]): JobTimeEntry => {
    try {
      const readOrEmpty = (index: number) => {
        if (child[index]?.childNodes[0]?.rawText === undefined) {
          return "";
        }
        return child[index].childNodes[0].rawText;
      };

      const tid = child[1].childNodes[0].childNodes[0].rawText;
      const jid = child[3].childNodes[0].rawText;
      const uid = child[5].childNodes[0].rawText;
      const hours = child[7].childNodes[0].rawText;
      const worked = child[9].childNodes[0].rawText;
      const entered = child[11].childNodes[0].rawText;
      const notes = readOrEmpty(13);
      const data: JobTimeEntry = {
        tid,
        jid,
        uid,
        hours,
        worked,
        entered,
        notes,
      };
      return data;
    } catch (error) {
      console.log(error);
      return {
        tid: "",
        jid: "",
        uid: "",
        hours: "",
        worked: "",
        entered: "",
        notes: "",
      };
    }
  };

  const getEntriesPerPage = (html: string) => {
    const table = parse(html).querySelector("table")?.childNodes;
    if (!table) return [];
    const onlyRows = table.filter(
      (elem) => elem.tagName === "tr" && elem.rawAttrs === ""
    );
    const children = onlyRows.map((elem) => elem.childNodes);
    const data = children.map(getDataFromChild);
    return data;
  };

  const getPage = async (offset: number) => {
    try {
      console.log("Getting an offset: " + offset);
      const res = await axios.get(
        "https://www.tech4work.com/studentemp/job_timesheet.asp",
        {
          params: { uid: userID, jid: jobID, offset: offset },
          headers: {
            cookie,
          },
        }
      );
      entries.push(...getEntriesPerPage(res.data));
    } catch (error) {
      console.log(error);
    }
  };

  const offsets = [...Array(1 + Math.floor(totalEntries / 10)).keys()];
  const allRequests = offsets.map((i) => {
    return getPage(i * 10);
  });

  await Promise.allSettled(allRequests);
  return entries;
};

const preBackUpEntries = async (
  job: Job,
  user_id: string,
  fastify: FastifyInstance
) => {
  const job_id = job.jobID;
  const { redis: redisUntyped } = fastify;
  const redis = redisUntyped as RedisClientType;
  const key = createKeyHours(job_id, user_id);
  const cache_entry = await redis.get(key);
  if (cache_entry == null) {
    console.log("Started loading:" + user_id + " " + job_id);
    const res = await getHours(user_id, job_id, "");
    await backUpEntries(res.entries, fastify.pg.client);
    console.log("Fetched:" + user_id + " " + job_id);
    //@ts-ignore
    await redis.set(key, "LOOK_FROM_DB", "ex", 60 * 15);
  }
};

const getHours = async (userID: string, jobID: string, cookie: string) => {
  console.log("Got request");
  const res = await axios.get(
    "https://www.tech4work.com/studentemp/job_timesheet.asp",
    {
      params: { uid: userID, jid: jobID },
      headers: {
        cookie,
      },
    }
  );
  if (!res.headers["set-cookie"]) {
    throw new Error("No cookie");
  }
  try {
    const aspCookie: string = res.headers["set-cookie"][0];
    const html: string = res.data;
    const totalEntries = getTotalEntries(html);
    console.log(totalEntries);
    const allEntries = await getAllEntries(userID, jobID, totalEntries, cookie);
    console.log(aspCookie, allEntries);
    const response = { n: allEntries.length, entries: allEntries };
    return response;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Promise<Job[]>
const getJobs = async (id: string, cookie: string) => {
  const res = await axios.get(
    "https://www.tech4work.com/studentemp/index.asp",
    {
      params: { uid: id },
      headers: {
        cookie,
      },
    }
  );
  if (!res.headers["set-cookie"]) {
    throw new Error("No cookie");
  }
  const aspCookie: string = res.headers["set-cookie"][0];
  const table: HTMLElement = parse(res.data).querySelectorAll("table")[2];
  const tableRows = table.childNodes.slice(5, table.childNodes.length - 2);
  const jobs = getJobObjects(tableRows);
  return { id, cookie: aspCookie, jobs };
};

export default async function userController(fastify: FastifyInstance) {
  // GET /user/hours?id=${id}
  fastify.get(
    "/hours",
    async function (_request: HoursRequest, reply: FastifyReply) {
      const userID: string = _request.query.user_id;
      const jobID: string = _request.query.job_id;
      if (
        !_request.headers["x-cookie-token"] ||
        Array.isArray(_request.headers["x-cookie-token"])
      ) {
        unauthorized(reply);
        return;
      }
      try {
        const { redis: redisUntyped } = fastify;
        const redis = redisUntyped as RedisClientType;
        const key = createKeyHours(jobID, userID);
        const cache_entry = await redis.get(key);
        if (cache_entry != null) {
          const dbResult = await getEntriesFromDb(
            userID,
            jobID,
            fastify.pg.client
          );
          reply.send({ n: dbResult.length, entries: dbResult });
          return;
        }
        const cookie: string = _request.headers["x-cookie-token"];
        const res = await getHours(userID, jobID, cookie);
        reply.send(res);
        await backUpEntries(res.entries, fastify.pg.client);
        //@ts-ignore
        await redis.set(key, "LOOK_FROM_DB", "ex", 60 * 15);
      } catch (error) {
        console.log(error);
        throw error;
      }
    }
  );

  fastify.post(
    "/entry",
    async function (_request: EntryPostRequest, reply: FastifyReply) {
      const user_id: number = parseInt(_request.body.user_id);
      const job_id: number = parseInt(_request.body.job_id);
      const notes: string = _request.body.notes;
      const worked: string = _request.body.worked;
      const hours: number = _request.body.hours;
      const entered: string = getEnteredString();
      // const client = fastify.pg.client;

      try {        
        const res = await fetch(`http://www.tech4work.com/studentemp/add_hours.asp?jid=${job_id}&uid=${user_id}`, {
          method: "POST",
          body: qs.stringify(          {
            worked: worked,
            hours1: hours + "",
            notes: notes ? notes : "",
            project_id: job_id + "",
            created_by: user_id + "",
            created: entered,
            MM_insert: "form1",
          }),
          headers: {
            "accept-language": "en",
            "cache-control": "max-age=0",
            "content-type": "application/x-www-form-urlencoded",
            "upgrade-insecure-requests": "1"
          },
          redirect: "manual",
        });

        console.log(res.status, res);
        reply.send(res.body);
      } catch (error) {
        console.log(error);
        reply.code(500).send("ERROR");
      }
    }
  );

  // GET /user/jobs?id=${id}
  fastify.get(
    "/jobs",
    async function (_request: JobsRequest, reply: FastifyReply) {
      const user_id: string = _request.query.user_id;
      if (
        !_request.headers["x-cookie-token"] ||
        Array.isArray(_request.headers["x-cookie-token"])
      ) {
        unauthorized(reply);
        return;
      }
      const { redis: redisUntyped } = fastify;
      const redis = redisUntyped as RedisClientType;
      const key = createKeyJobs(user_id);
      const cache_entry = await redis.get(key);
      if (cache_entry != null) {
        const dbResult = await getJobsFromDb(user_id, fastify.pg.client);
        reply.send({
          id: user_id,
          cookie: "NOT_NEEDED",
          jobs: dbResult,
        });
        return;
      }
      const cookie: string = _request.headers["x-cookie-token"];
      const res = await getJobs(user_id, cookie);
      console.log("sending requests");
      reply.send(res);
      console.log("started back up of jobs");
      await backUpJobs(res.jobs, user_id, fastify.pg.client);
      console.log("done back up of jobs");
      //@ts-ignore
      await redis.set(key, "LOOK_FROM_DB", "ex", 60 * 60 * 24);
      console.log("started job entries");
      await res.jobs.forEach(
        async (job) => await preBackUpEntries(job, user_id, fastify)
      );
    }
  );
}

// fetch("http://www.tech4work.com/studentemp/add_hours.asp?jid=2851&uid=7371", {
//   "headers": {
//     "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
//     "accept-language": "en,en-US;q=0.9,ru;q=0.8,kk;q=0.7",
//     "cache-control": "max-age=0",
//     "content-type": "application/x-www-form-urlencoded",
//     "upgrade-insecure-requests": "1",
//     "cookie": "f3d738c418aa61aea5fa91bda09d4e09=t8lci08kofa0fnhus165brn5e5; ASPSESSIONIDAQRCASCT=NENHBNKCOGNEFMKEDOCJBOOB",
//     "Referer": "http://www.tech4work.com/studentemp/add_hours.asp?jid=2851&uid=7371",
//     "Referrer-Policy": "strict-origin-when-cross-origin"
//   },
//   "body": "worked=6%2F6%2F2022&hours1=1&notes=TEST+WHILE+DEVELOPMENT%2C+NOT+A+REAL+WORK&project_id=2851&created_by=7371&created=6%2F6%2F2022+7%3A51%3A20+PM&MM_insert=form1",
//   "method": "POST"
// });

// fetch("http://www.tech4work.com/studentemp/job_timesheet_detail.asp?tid=328841", {
//   "headers": {
//     "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
//     "accept-language": "en,en-US;q=0.9,ru;q=0.8,kk;q=0.7",
//     "cache-control": "max-age=0",
//     "content-type": "application/x-www-form-urlencoded",
//     "upgrade-insecure-requests": "1",
//     "cookie": "f3d738c418aa61aea5fa91bda09d4e09=t8lci08kofa0fnhus165brn5e5; ASPSESSIONIDAQRCASCT=NENHBNKCOGNEFMKEDOCJBOOB",
//     "Referer": "http://www.tech4work.com/studentemp/job_timesheet_detail.asp?tid=328841",
//     "Referrer-Policy": "strict-origin-when-cross-origin"
//   },
//   "body": "Submit=Delete&MM_delete=form1&MM_recordId=328841",
//   "method": "POST"
// });
