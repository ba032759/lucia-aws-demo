import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import type { TypeSafeDocumentClientV3 } from "typesafe-dynamodb/lib/document-client-v3";
import type { User as DatabaseUser, Session } from "lucia-dynamodb-adapter";

const client = new DynamoDB({ region: "eu-central-1" });

const docClient = DynamoDBDocument.from(
  client,
) as unknown as TypeSafeDocumentClientV3<DatabaseUser | Session, "PK", "SK">;

export default docClient;
