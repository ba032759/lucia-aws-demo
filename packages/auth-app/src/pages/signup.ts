import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { html } from "hono/html";
import { setCookie } from "hono/cookie";
import { Scrypt } from "oslo/password";
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

app.post(
  "/",
  zValidator(
    "form",
    z.object({
      // username must be between 4 ~ 31 characters, and only consists of lowercase letters, 0-9, -, and _
      username: z
        .string()
        .min(3)
        .max(31)
        .regex(/^[a-z0-9_-]+$/)
        .trim(),
      email: z.string().min(5).email().trim(),
      password: z.string().min(6).max(255),
    }),
    (data, c) => {
      if (!data.success) {
        return c.text(`Invalid input! ${data.error}`, 422);
      }
    },
  ),
  async (c) => {
    const { password, email, username } = await c.req.valid("form");

    const userId = generateIdFromEntropySize(10); // 16 characters long
    const scrypt = new Scrypt();
    const passwordHash = await scrypt.hash(password);

    const statusCode = await createUser(client, {
      id: userId,
      passwordHash,
      username,
      email,
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
      email,
    );
    await sendEmailVerificationCode(email, emailVerificationCode);

    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    setCookie(
      c,
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );

    return c.redirect("/");
  },
);
export default app;
