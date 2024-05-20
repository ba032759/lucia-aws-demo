import type {
  Adapter,
  DatabaseSession,
  RegisteredDatabaseSessionAttributes,
  DatabaseUser,
  RegisteredDatabaseUserAttributes,
  UserId,
} from "lucia";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { TypeSafeDocumentClientV3 } from "typesafe-dynamodb/lib/document-client-v3.js";

const BATCH_MAX = 25;
export interface User extends RegisteredDatabaseUserAttributes {
  PK: `USER#${UserId}`;
  SK: `USER#${UserId}`;
  [key: string]: string | number | boolean | null | ArrayBuffer;
}

type SessionId = string;
export interface Session extends RegisteredDatabaseSessionAttributes {
  PK: `SESSION#${SessionId}`;
  SK: `USER#${UserId}`;
  ExpiresAt: string;
  [key: string]: string | number | boolean | null | ArrayBuffer;
}

export class DynamodbAdapter implements Adapter {
  private client: TypeSafeDocumentClientV3<Session | User, "PK">;
  private tableName: string;

  constructor(client: DynamoDBDocumentClient, tableName: string) {
    this.client = client as TypeSafeDocumentClientV3<Session | User, "PK">;
    this.tableName = tableName;
  }

  public async deleteSession(sessionId: string): Promise<void> {
    const { Items } = await this.client.query({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": `SESSION#${sessionId}`,
      },
    });
    const [session] = Items ?? [];
    await this.client.delete({
      TableName: this.tableName,
      Key: { PK: `SESSION#${sessionId}`, SK: session?.SK },
    });
  }

  public async deleteUserSessions(userId: UserId): Promise<void> {
    const result = await this.client.query({
      TableName: this.tableName,
      IndexName: "UserIdIndex",
      KeyConditionExpression: "SK = :userId and begins_with(PK, :session)",
      ExpressionAttributeValues: {
        ":userId": `USER#${userId}`,
        ":session": "SESSION#",
      },
    });

    // batch items and delete with batchWriteItem
    const sessions = result.Items ?? [];
    const batches = [];
    for (let i = 0; i < sessions.length; i += BATCH_MAX) {
      batches.push(
        this.client.batchWrite({
          RequestItems: {
            [this.tableName]: sessions.slice(i, i + BATCH_MAX).map((item) => ({
              DeleteRequest: {
                Key: {
                  PK: item.PK,
                  SK: item.SK,
                },
              },
            })),
          },
        })
      );
    }
    await Promise.all(batches);
  }

  public async getSessionAndUser(
    sessionId: string
  ): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
    const { Items } = await this.client.query({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": `SESSION#${sessionId}`,
      },
    });
    const session = Items?.at(0) as Session | undefined; // cannot be User because of KeyConditionExpression
    if (!session || !session.PK || !session.SK) return [null, null];
    const { Item: user } = await this.client.get({
      TableName: this.tableName,
      Key: { PK: session.SK, SK: session.SK },
    });
    if (!user) return [null, null];
    const dbSession = transformIntoDatabaseSession(session);
    const dbUser = transformIntoDatabaseUser(user);
    return [dbSession, dbUser];
  }

  public async getUserSessions(userId: UserId): Promise<DatabaseSession[]> {
    const { Items } = await this.client.query({
      TableName: this.tableName,
      IndexName: "UserIdIndex",
      KeyConditionExpression: "SK = :userId and begins_with(PK, :session)",
      ExpressionAttributeValues: {
        ":userId": `USER#${userId}`,
        ":session": "SESSION#",
      },
    });

    return (
      Items?.map((val) => transformIntoDatabaseSession(val as Session)) ?? []
    ); // cannot be User because of KeyConditionExpression
  }

  public async setSession(session: DatabaseSession): Promise<void> {
    const value: Session = {
      PK: `SESSION#${session.id}`,
      SK: `USER#${session.userId}`,
      ExpiresAt: session.expiresAt.toISOString(),
      ...session.attributes,
    };
    await this.client.put({
      TableName: this.tableName,
      Item: value,
    });
  }

  public async updateSessionExpiration(
    sessionId: string,
    expiresAt: Date
  ): Promise<void> {
    const { Items } = await this.client.query({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": `SESSION#${sessionId}`,
      },
    });
    const [session] = Items ?? [];
    await this.client.update({
      TableName: this.tableName,
      Key: { PK: session.PK, SK: session.SK },
      UpdateExpression: "SET ExpiresAt = :expiresAt",
      ExpressionAttributeValues: {
        ":expiresAt": expiresAt.toISOString(),
      },
    });
  }

  public async deleteExpiredSessions(): Promise<void> {
    // better to use TTL, since   this will to a full table scan
    const { Items } = await this.client.scan({
      TableName: this.tableName,
      FilterExpression: "attribute_not_exists(ExpiresAt) OR ExpiresAt < :now",
      ExpressionAttributeValues: {
        ":now": new Date().toISOString(),
      },
    });
    // delete expired sessions in batch
    if (!Items?.length) return;
    await this.client.batchWrite({
      RequestItems: {
        [this.tableName]: Items?.map((item) => ({
          DeleteRequest: {
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
          },
        })),
      },
    });
  }
}

function transformIntoDatabaseUser(user: User): DatabaseUser {
  const { PK: userId, SK, ...attributes } = user;
  return {
    id: parseUserId(userId),
    attributes,
  };
}

function transformIntoDatabaseSession(session: Session): DatabaseSession {
  const { PK: id, SK: userId, ExpiresAt: expiresAt, ...attributes } = session;
  return {
    id: parseSessionId(id),
    userId: parseUserId(userId),
    expiresAt: new Date(expiresAt),
    attributes,
  };
}

function parseUserId(userId: string): string {
  return userId.replace("USER#", "");
}

function parseSessionId(sessionId: string): string {
  return sessionId.replace("SESSION#", "");
}
