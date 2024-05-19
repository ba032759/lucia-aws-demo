import { Hono } from "hono";
import { lucia } from "../auth";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import type { User, Session } from "lucia";

const app = new Hono<{
  Variables: {
    user: User | null;
    session: Session | null;
  };
}>();

// see https://hono.dev/middleware/builtin/csrf for more options

export const luciaMiddleware = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, lucia.sessionCookieName) ?? null;
  if (!sessionId) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }
  const { session, user } = await lucia.validateSession(sessionId);
  if (session?.fresh) {
    // use `header()` instead of `setCookie()` to avoid TS errors
    c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize(), {
      append: true,
    });
  }
  if (!session) {
    c.header("Set-Cookie", lucia.createBlankSessionCookie().serialize(), {
      append: true,
    });
  }
  c.set("user", user);
  c.set("session", session);
  return next();
});
