import { Lucia } from "lucia";
import { DynamodbAdapter } from "lucia-dynamodb-adapter";
import client from "./config/database";

const tableName = process.env.TABLE_NAME;
if (!tableName) {
  throw new Error("Missing TABLE_NAME environment variable");
}
const adapter = new DynamodbAdapter(client, tableName);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      // set to `true` when using HTTPS
      secure: process.env.NODE_ENV === "production",
    },
  },
});

// IMPORTANT!
declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
  }
}
