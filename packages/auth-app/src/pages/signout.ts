import { Hono } from "hono";
import { html } from "hono/html";
import { lucia } from "../auth";
import { setCookie } from "hono/cookie";
import type { Session } from "lucia";

const app = new Hono();

app.get("/", (c) =>
  c.html(
    html`<html lang="en">
      <body>
        <h1>Sign out</h1>
        <form method="post">
          <button>Sign out</button>
        </form>
      </body>
    </html>`
  )
);

app.post("/", async (c) => {
  const session = c.get("session") as Session;
  if (!session) {
    return new Response(null, {
      status: 401,
    });
  }

  await lucia.invalidateSession(session.id);

  const sessionCookie = lucia.createBlankSessionCookie();
  setCookie(
    c,
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );

  return c.redirect("/signin");
});
export default app;
