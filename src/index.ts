import app from "./app";
const FASTIFY_PORT = Number(process.env.FASTIFY_PORT) || 3006;

app.get("/health", (_request, reply) => {
  reply.status(200).send("Hello World");
});

app.listen(FASTIFY_PORT, "0.0.0.0", (error) => {
  if (error) {
    process.exit(1);
  }
});


console.log(`🚀  Fastify server running on port ${FASTIFY_PORT}`);
console.log(`Route index: /`);
console.log(`Route user: /api/v1/user`);
