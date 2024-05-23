import { Hono } from "hono";
import { html } from "hono/html";
import { verify } from "../scrypt";
import { lucia } from "../auth";
import { getUserByName } from "../models";
import { setCookie } from "hono/cookie";
import client from "../config/database";

const app = new Hono();

app.get("/", (c) =>
  c.html(
    html`<html lang="en">
      <body>
        <h1>Sign in</h1>
        <form method="post">
          <label for="username">Username</label>
          <input id="username" name="username" />
          <label for="password">Password</label>
          <input id="password" name="password" />
          <button>Continue</button>
        </form>
      </body>
    </html>`,
  ),
);

app.post("/", async (c) => {
  const formData = await c.req.formData();
  const username = formData.get("username");
  if (
    typeof username !== "string" ||
    username.length < 3 ||
    username.length > 31 ||
    !/^[a-z0-9_-]+$/.test(username)
  ) {
    return new Response("Invalid username", {
      status: 400,
    });
  }
  const password = formData.get("password");
  if (
    typeof password !== "string" ||
    password.length < 6 ||
    password.length > 255
  ) {
    return new Response("Invalid password", {
      status: 400,
    });
  }

  // @ts-ignore
  const existingUser = await getUserByName(client, username);
  if (!existingUser) {
    // NOTE:
    // Returning immediately allows malicious actors to figure out valid usernames from response times,
    // allowing them to only focus on guessing passwords in brute-force attacks.
    // As a preventive measure, you may want to hash passwords even for invalid usernames.
    // However, valid usernames can be already be revealed with the signup page among other methods.
    // It will also be much more resource intensive.
    // Since protecting against this is non-trivial,
    // it is crucial your implementation is protected against brute-force attacks with login throttling etc.
    // If usernames are public, you may outright tell the user that the username is invalid.
    return new Response("Incorrect username or password", {
      status: 400,
    });
  }

  const validPassword = await verify(existingUser.passwordHash, password);
  if (!validPassword) {
    return new Response("Incorrect username or password", {
      status: 400,
    });
  }

  const session = await lucia.createSession(existingUser.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  setCookie(
    c,
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );

  return c.redirect("/");
});
export default app;
