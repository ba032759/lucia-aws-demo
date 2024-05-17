import { databaseUser, testAdapter } from "@lucia-auth/adapter-test";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import type { TypeSafeDocumentClientV3 } from "typesafe-dynamodb/lib/document-client-v3";
import { DynamodbAdapter, type User, type Session } from "../src/index";

const client = new DynamoDB({ region: "eu-central-1" });

const docClient = DynamoDBDocument.from(client) as TypeSafeDocumentClientV3<
  User | Session,
  "PK",
  "SK"
>;

const tableName = process.env.TABLE_NAME;
if (!tableName) {
  throw new Error("Missing TABLE_NAME environment variable");
}
const { id: databaseUserId, attributes } = databaseUser;
await docClient.put({
  TableName: tableName,
  Item: {
    PK: `USER#${databaseUserId}`,
    SK: `USER#${databaseUserId}`,
    ...attributes,
  },
});
const adapter = new DynamodbAdapter(docClient, tableName);
await testAdapter(adapter);

process.exit(0);
