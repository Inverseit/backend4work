import fastify from "fastify";
import router from "./router";

const server = fastify({
  // Logger only for production
  logger: !!(process.env.NODE_ENV !== "development"),
});

// CORS
server.register(require("@fastify/cors"), {
  origin: (origin: any, cb: any) => {
    const hostname = new URL(origin).hostname;
    if (hostname === "localhost") {
      //  Request from localhost will pass
      cb(null, true);
      return;
    }
    // Generate an error on other origins, disabling access
    cb(new Error("Not allowed"));
  },
});

// Middleware: Router
server.register(router);

export default server;
