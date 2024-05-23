import type { TypeSafeDocumentClientV3 } from "typesafe-dynamodb/lib/document-client-v3";
import { z } from "zod";
import type {
  User as DatabaseUser,
  Session,
} from "../../../lucia-dynamodb-adapter/src";

type userName = string;
type UserId = string;
type email = string;
export interface UserName {
  PK: `userName#${userName}`;
  SK: `USER#${UserId}`;
  [key: string]: string | number | boolean | null | ArrayBuffer;
}
export interface Email {
  PK: `email#${email}`;
  SK: `USER#${UserId}`;
  [key: string]: string | number | boolean | null | ArrayBuffer;
}
interface DynamoClient
  extends TypeSafeDocumentClientV3<
    DatabaseUser | Session | Email | UserName,
    "PK",
    "SK"
  > {}

const tableName = process.env.TABLE_NAME;
if (!tableName) {
  throw new Error("Missing TABLE_NAME environment variable");
}

const User = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().min(5).email(),
  passwordHash: z.string(),
});
export type User = z.infer<typeof User>;

export const createUser = async (client: DynamoClient, user: User) => {
  const parsedUser = User.safeParse(user);
  if (!parsedUser.success) {
    return 422;
  }
  const { id: userId, username, email, ...attributes } = parsedUser.data;
  try {
    const output = await client.transactWrite({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: `USER#${userId}`,
              SK: `USER#${userId}`,
              email,
              username,
              ...attributes,
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
              userId,
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
              userId,
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
): Promise<User | undefined> => {
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
    !Items[0].SK.startsWith("userName") ||
    !Items[0].userId
  ) {
    return undefined;
  }
  const userId = Items[0].userId;
  const { Item } = await client.get({
    TableName: tableName,
    Key: {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`,
    },
  });
  if (!Item) return undefined;
  return transformIntoUser(Item);
};

const transformIntoUser = (item: DatabaseUser): User => {
  const { PK: id, ...attributes } = item;
  if (
    !id ||
    !attributes.passwordHash ||
    typeof attributes.passwordHash !== "string" ||
    !attributes.username ||
    typeof attributes.username !== "string" ||
    !attributes.email ||
    typeof attributes.email !== "string"
  ) {
    throw new Error("Invalid user");
  }
  return {
    id: item.PK.replace("USER#", ""),
    passwordHash: attributes.passwordHash,
    email: attributes.email,
    username: attributes.username,
  };
};
