import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();
const PORT = Number(process.env.PORT) || 3000;

app.get("/health", (c) => {
  return c.json({
    ok: true,
    message: "API is running",
  });
});

serve({
  fetch: app.fetch,
  port: PORT,
});
console.log(`Server is running on http://localhost:${PORT}`);
