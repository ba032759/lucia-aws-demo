import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { handle } from "hono/aws-lambda";
import api from "./api";
import signup from "./signup";
import signin from "./signin";
import { luciaMiddleware } from "./middleware";

const app = new Hono();
app.use(csrf());
app.use(luciaMiddleware);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});
app.get("/foo", async (c) => {
  console.log("foo context", c);
  const user = c.get("user");
  if (!user) {
    return c.body(null, 401);
  }
  return c.json({ content: "Secret content" });
});
app.route("/api", api);
app.route("/signup", signup);
app.route("/signin", signin);

export const handler = handle(app);
