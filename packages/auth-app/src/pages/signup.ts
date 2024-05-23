import { Hono } from "hono";
import { html } from "hono/html";
import { setCookie } from "hono/cookie";
import { hash } from "../scrypt";
import { generateIdFromEntropySize } from "lucia";
import { lucia } from "../auth";
import { createUser } from "../models";
import client from "../config/database";
import { z } from "zod";
import {
  generateEmailVerificationCode,
  sendEmailVerificationCode,
} from "../models/emailVerificationCode";

const app = new Hono();

app.get("/", (c) =>
  c.html(
    html`<html lang="en">
      <body>
        <h1>Sign up</h1>
        <form method="post">
          <label for="username">Username</label>
          <input id="username" name="username" />
          <label for="email">Email</label>
          <input id="email" name="email" />
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
  const email = formData.get("email");
  const parsedEmail = z.string().min(5).email().safeParse(email);
  if (!parsedEmail.success) {
    return new Response("Invalid email", {
      status: 400,
    });
  }
  // username must be between 4 ~ 31 characters, and only consists of lowercase letters, 0-9, -, and _
  // keep in mind some database (e.g. mysql) are case insensitive
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

  const userId = generateIdFromEntropySize(10); // 16 characters long
  const passwordHash = await hash(password);
  const parsedEmailData = parsedEmail.data;

  const statusCode = await createUser(client, {
    id: userId,
    passwordHash,
    username,
    email: parsedEmailData,
  });
  if (statusCode === 422) {
    return new Response("Invalid data", {
      status: 422,
    });
  }
  if (statusCode === 409) {
    return new Response("Username or email already exists", {
      status: 409,
    });
  }

  const emailVerificationCode = await generateEmailVerificationCode(
    client,
    userId,
    parsedEmailData,
  );
  await sendEmailVerificationCode(parsedEmailData, emailVerificationCode);

  const session = await lucia.createSession(userId, {});
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
