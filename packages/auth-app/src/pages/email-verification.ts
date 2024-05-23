import type { User } from "lucia";
import { Hono } from "hono";
import { html } from "hono/html";
import { lucia } from "../auth";
import { verifyEmailVerificationCode } from "../models/emailVerificationCode";
import client from "../config/database";
import { updateEmailVerified } from "../models";

type Variables = {
  user: User;
};
const app = new Hono<{ Variables: Variables }>();

app.get("/", (c) =>
  c.html(
    html`<html lang="en">
      <body>
        <h1>Email verification</h1>
        <form method="post">
          <label for="code">Code</label>
          <input id="code" name="code" />
          <button>Verify</button>
        </form>
      </body>
    </html>`,
  ),
);

app.post("/", async (c) => {
  const formData = await c.req.formData();
  const code = formData.get("code");
  if (typeof code !== "string") {
    return new Response(null, {
      status: 400,
    });
  }
  const user = c.get("user");

  // @ts-ignore
  const validCode = await verifyEmailVerificationCode(client, user, code);
  if (!validCode) {
    return new Response(null, {
      status: 400,
    });
  }

  await lucia.invalidateUserSessions(user.id);
  await updateEmailVerified(client, user.id);

  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": sessionCookie.serialize(),
    },
  });
});

export default app;
