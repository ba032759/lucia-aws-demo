import { Hono } from "hono";
import { html } from "hono/html";
import { csrf } from "hono/csrf";
import { handle } from "hono/aws-lambda";
import api from "./pages/api";
import signup from "./pages/signup";
import signin from "./pages/signin";
import signout from "./pages/signout";
import emailVerification from "./pages/email-verification";
import { luciaMiddleware } from "./middleware";

type Variables = {
  user: string;
};
const app = new Hono<{ Variables: Variables }>();
app.use(csrf());
app.use(luciaMiddleware);

app.get("/", (c) =>
  c.html(
    html`<html lang="en">
      <body>
        <h1>Welcome!</h1>
        <ul>
          <li>
            <a href="/signup">Sign up</a>
          </li>
          <li>
            <a href="/signin">Sign in</a>
          </li>
          <li>
            <a href="/signout">Sign out</a>
          </li>
          <li>
            <a href="/email-verification">Verify Email</a>
          </li>
          <li>
            <a href="/foo">Secret content</a>
          </li>
        </ul>
      </body>
    </html>`,
  ),
);
app.get("/foo", async (c) => {
  console.log("foo context", c);
  const user = c.get("user");
  if (!user) {
    return c.json({ content: "Unauthorized", status: 401 }, 401);
  }
  return c.json({ content: "Secret content" });
});
app.route("/api", api);
app.route("/signup", signup);
app.route("/signin", signin);
app.route("/signout", signout);
app.route("/email-verification", emailVerification);

export const handler = handle(app);
