import { Lucia } from "lucia";
import { DynamodbAdapter } from "lucia-dynamodb-adapter";
import client from "./config/database";
import type { User } from "./types";

const tableName = process.env.TABLE_NAME;
if (!tableName) {
  throw new Error("Missing TABLE_NAME environment variable");
}
const indexName = process.env.INDEX_NAME;
if (!indexName) {
  throw new Error("Missing INDEX_NAME environment variable");
}
const adapter = new DynamodbAdapter(client, tableName, indexName);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      // set to `true` when using HTTPS
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.Email,
      username: attributes.Username,
      emailVerified: attributes.EmailVerified,
      id: attributes.Id,
    };
  },
});

// IMPORTANT!
declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      Email: string;
      Username: string;
      EmailVerified: boolean;
      Id: string;
    };
  }
}
