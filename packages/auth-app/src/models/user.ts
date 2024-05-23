import type { User as DatabaseUser } from "lucia-dynamodb-adapter";
import type { User } from "lucia";
import { lucia } from "../auth";
import { User as ZodUser, type DynamoClient } from "../types";

const tableName = process.env.TABLE_NAME;
if (!tableName) {
  throw new Error("Missing TABLE_NAME environment variable");
}

export const createUser = async (client: DynamoClient, user: ZodUser) => {
  const parseResult = ZodUser.safeParse(user);
  if (!parseResult.success) {
    return 422;
  }
  const { id, passwordHash, username, email } = parseResult.data;
  try {
    await client.transactWrite({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: `USER#${id}`,
              SK: `USER#${id}`,
              Id: id,
              UserName: username,
              Email: email,
              EmailVerified: false,
              PasswordHash: passwordHash,
            },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: `userName#${username}`,
              SK: `userName#${username}`,
              Id: id,
            },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: `email#${email}`,
              SK: `email#${email}`,
              Id: id,
            },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
      ],
    });
  } catch (_) {
    return 409;
  }
  return 200;
};

export const getUserByName = async (
  client: DynamoClient,
  username: string,
): Promise<DatabaseUser | undefined> => {
  const { Items } = await client.query({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: {
      ":pk": `userName#${username}`,
    },
  });
  if (
    !Items ||
    Items.length === 0 ||
    !Items[0].PK.startsWith("userName") ||
    !Items[0].SK.startsWith("USER#")
  ) {
    return undefined;
  }
  const { Item } = await client.get({
    TableName: tableName,
    Key: {
      PK: Items[0].SK,
      SK: Items[0].SK,
    },
  });
  if (!Item) return undefined;
  return Item;
};

export const deleteUser = async (client: DynamoClient, userId: string) => {
  // delete all sessions
  const sessions = await lucia.getUserSessions(userId);
  client.batchWrite({
    RequestItems: {
      [tableName]: sessions.map((session) => ({
        DeleteRequest: {
          Key: {
            PK: `SESSION#${session.id}`,
            SK: `SESSION#${session.id}`,
          },
        },
      })),
    },
  });
  // delete user
  try {
    client.transactWrite({
      TransactItems: [
        {
          Delete: {
            TableName: tableName,
            Key: {
              PK: `USER#${userId}`,
              SK: `USER#${userId}`,
            },
          },
        },
        {
          Delete: {
            TableName: tableName,
            Key: {
              PK: `userName#${userId}`,
              SK: `userName#${userId}`,
            },
          },
        },
        {
          Delete: {
            TableName: tableName,
            Key: {
              PK: `email#${userId}`,
              SK: `email#${userId}`,
            },
          },
        },
      ],
    });
  } catch (_) {
    return 409;
  }
  return 200;
};

export const updateEmailVerified = async (
  client: DynamoClient,
  userId: string,
) => {
  await client.update({
    TableName: tableName,
    Key: {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`,
    },
    UpdateExpression: "set emailVerified = :emailVerified",
    ExpressionAttributeValues: {
      ":emailVerified": true,
    },
  });
};
