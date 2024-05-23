import { TimeSpan, createDate, isWithinExpirationDate } from "oslo";
import { generateRandomString, alphabet } from "oslo/crypto";
import type { DynamoClient, EmailVerificationCode } from "../types";
import type { User } from "lucia";

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
  throw new Error("Missing TABLE_NAME environment variable");
}
const INDEX_NAME = process.env.INDEX_NAME;
if (!INDEX_NAME) {
  throw new Error("Missing INDEX_NAME environment variable");
}

export const generateEmailVerificationCode = async (
  client: DynamoClient,
  userId: string,
  email: string,
): Promise<string> => {
  const code = generateRandomString(8, alphabet("0-9"));
  const item: EmailVerificationCode = {
    PK: `EMAIL_VERIFICATION_CODE#${email}`,
    SK: `USER#${userId}`,
    GSI1PK: `USER#${userId}`,
    GSI1SK: `EMAIL_VERIFICATION_CODE#${email}`,
    Code: code,
    ExpiresAt: createDate(new TimeSpan(15, "m")).toISOString(),
  };
  await client.put({
    TableName: TABLE_NAME,
    Item: item,
  });
  return code;
};

export const sendEmailVerificationCode = async (
  email: string,
  code: string,
) => {
  // TODO implement sending email
  console.log(`Sending email to ${email} with code ${code}`);
};

export const verifyEmailVerificationCode = async (
  client: DynamoClient,
  user: User,
  code: string,
): Promise<boolean> => {
  const { Items } = await client.query({
    TableName: TABLE_NAME,
    IndexName: INDEX_NAME,
    KeyConditionExpression: "GSI1PK = :userId and GSI1SK = :code",
    ExpressionAttributeValues: {
      ":userId": `USER#${user.id}`,
      ":code": `EMAIL_VERIFICATION_CODE#${user.email}`,
    },
  });
  if (!Items || Items.length < 0) return false;
  const item = Items[0] as EmailVerificationCode;
  if (item.PK.replace("EMAIL_VERIFICATION_CODE#", "") !== user.email) {
    return false;
  }
  if (item.Code !== code) return false;
  if (!isWithinExpirationDate(new Date(item.ExpiresAt))) return false;
  await client.delete({
    TableName: TABLE_NAME,
    Key: {
      PK: item.PK,
      SK: item.SK,
    },
  });
  return true;
};
