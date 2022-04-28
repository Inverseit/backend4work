import axios from "axios";
import { HTMLElement, parse } from "fast-html-parser";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
type JobsRequest = FastifyRequest<{
  Querystring: { id: string };
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
      superviser: entries[3].childNodes[0] ? entries[3].childNodes[0].rawText: "",
      hours: {
        thisMonth: entries[4].childNodes[0] ? parseInt(entries[4].childNodes[0].rawText) : 0,
        lastMonth: entries[5].childNodes[0] ? parseInt(entries[5].childNodes[0].rawText): 0,
        total: entries[6].childNodes[0] ? parseInt(entries[6].childNodes[0].rawText) : 0,
      },
    };
  };

  return jobRows.map(getJobObject);
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
  // GET /user/jobs?id=${id}
  fastify.get(
    "/jobs",
    async function (_request: JobsRequest, reply: FastifyReply) {
      const id: string = _request.query.id;
      if (!_request.headers.cookie) {
        unauthorized(reply);
        return;
      }
      const cookie: string = _request.headers.cookie;
      const res = await getJobs(id, cookie);
      reply.send(res);
    }
  );
}
