import fastify from "fastify";
import router from "./router";

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

// Middleware: Router
server.register(router);

export default server;
