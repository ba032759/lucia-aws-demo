import { Hono } from "hono";

const app = new Hono();

// app.get("/", (c) => {
//   const user = c.get("user");
//   if (!user) {
//     return c.redirect("/signin");
//   }
//   c.json({ content: "Secret content", user });
// });
app.get("/", (c) => {
  console.log("foo context", c);
  const user = c.get("user");
  if (!user) {
    return c.redirect("/signin");
  }
  return c.json({ content: "Secret content", user });
});

export default app;
