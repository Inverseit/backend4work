import { FastifyRequest } from "fastify";
export type JobsRequest = FastifyRequest<{
    Querystring: { user_id: string };
  }>;
  
  export type HoursRequest = FastifyRequest<{
    Querystring: { user_id: string; job_id: string };
  }>;
  
  export  type Job = {
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
  
  export type JobTimeEntry = {
    tid: string;
    jid: string;
    uid: string;
    hours: string;
    worked: string;
    entered: string;
    notes: string;
  };