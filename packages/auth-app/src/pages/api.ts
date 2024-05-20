import { Hono } from "hono";
type Variables = {
  user: string;
};
const app = new Hono<{ Variables: Variables }>();

app.get("/", (c) => {
  const user = c.get("user");
  if (!user) {
    return c.redirect("/signin");
  }
  return c.json({ content: "Secret content", user });
});

export default app;
