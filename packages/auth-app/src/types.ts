import { z } from "zod";
import type { TypeSafeDocumentClientV3 } from "typesafe-dynamodb/lib/document-client-v3";
import type { User as DatabaseUser, Session } from "lucia-dynamodb-adapter";

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
export const User = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().min(5).email(),
  passwordHash: z.string(),
});
export type User = z.infer<typeof User>;

export interface EmailVerificationCode {
  PK: `EMAIL_VERIFICATION_CODE#${email}`;
  SK: `USER#${UserId}`;
  GSI1PK: `USER#${UserId}`;
  GSI1SK: `EMAIL_VERIFICATION_CODE#${email}`;
  Code: string;
  ExpiresAt: string;
}
export interface DynamoClient
  extends TypeSafeDocumentClientV3<
    DatabaseUser | Session | Email | UserName | EmailVerificationCode,
    "PK",
    "SK"
  > {}
