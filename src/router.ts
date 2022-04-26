import { FastifyInstance } from "fastify";
import userController from "./controller/userController";
import indexController from "./controller/indexController";
import loginController from "./controller/loginController";

export default async function router(fastify: FastifyInstance) {
  fastify.register(userController, { prefix: "/api/v1/user" });
  fastify.register(loginController, { prefix: "/login" });
  fastify.register(indexController, { prefix: "/" });
}
