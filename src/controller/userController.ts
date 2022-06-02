import axios from "axios";
import { HTMLElement, parse } from "fast-html-parser";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { max } from "../helpers";

type JobsRequest = FastifyRequest<{
  Querystring: { user_id: string };
}>;

type HoursRequest = FastifyRequest<{
  Querystring: { user_id: string; job_id: string };
}>;

type Job = {
  jobID: string;
  ref: string;
  title: string;
  superviser: string;
  hours: {
    thisMonth: number;
    lastMonth: number;
    total: number;
  };
};

type JobTimeEntry = {
  tid: string;
  jid: string;
  uid: string;
  hours: string;
  worked: string;
  entered: string;
  notes: string;
};

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

const hoursCache : any = {
}

const getHours = async (userID: string, jobID: string, cookie: string) => {
  console.log("Got request");
  const cacheKey = userID + "/" + jobID;
  if (cacheKey in hoursCache){
    return hoursCache[cacheKey];
  }
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
    const response =  { n: allEntries.length, entries: allEntries };
    hoursCache[cacheKey] = response;
    return response;
  } catch (error) {
    console.log(error);
    throw error;
  }

};

// Promise<Job[]>
const getJobs = async (id: string, cookie: string) => {
  console.log(id, cookie);
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
        const cookie: string = _request.headers["x-cookie-token"];
        const res = await getHours(userID, jobID, cookie);
        reply.send(res);
      } catch (error) {
        console.log(error);
        throw error;
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
      const cookie: string = _request.headers["x-cookie-token"];
      const res = await getJobs(user_id, cookie);
      reply.send(res);
    }
  );
}
