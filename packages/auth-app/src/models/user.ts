import type { TypeSafeDocumentClientV3 } from "typesafe-dynamodb/lib/document-client-v3";
import type {
  User as DatabaseUser,
  Session,
} from "../../../lucia-dynamodb-adapter/src";

const tableName = process.env.TABLE_NAME;
if (!tableName) {
  throw new Error("Missing TABLE_NAME environment variable");
}

type User = {
  id: string;
  passwordHash: string;
};

export const createUser = async (
  client: TypeSafeDocumentClientV3<DatabaseUser | Session, "PK", "SK">,
  user: User
): Promise<void> => {
  const { id: userId, ...attributes } = user;
  await client.put({
    TableName: tableName,
    Item: {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`,
      ...attributes,
    },
    ConditionExpression: "attribute_not_exists(PK)",
  });
};

export const getUser = async (
  client: TypeSafeDocumentClientV3<DatabaseUser | Session, "PK", "SK">,
  userId: string
): Promise<User | undefined> => {
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
  const { PK: id, passwordHash } = item;
  if (!id || !passwordHash) {
    throw new Error("Invalid user");
  }
  return {
    id: item.PK.replace("USER#", ""),
    passwordHash: passwordHash,
  };
};
