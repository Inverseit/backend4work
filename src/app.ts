import fastify from "fastify";
import router from "./router";
const dbconnector = require('./database');

declare module 'fastify' {
  interface FastifyInstance {
    redisUntyped: any;
    pg: any;
  }
}

const server = fastify({
  // Logger only for production
  logger: !!(process.env.NODE_ENV !== "development"),
});

// CORS
server.register(require("@fastify/cors"), {
  origin: (origin: any, cb: any) => {
    console.log(origin);
    cb(null, true);
    return;
  },
});

server.register(dbconnector)

server.register(require('@fastify/redis'),{ 
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT, // Redis port
})

// Middleware: Router
server.register(router);

export default server;
