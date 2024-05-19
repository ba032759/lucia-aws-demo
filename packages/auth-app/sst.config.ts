/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "auth-app",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const table = new sst.aws.Dynamo("AuthTable", {
      fields: {
        PK: "string",
        SK: "string",
      },
      primaryIndex: { hashKey: "PK", rangeKey: "SK" },
      globalIndexes: {
        UserIdIndex: { hashKey: "SK", rangeKey: "PK" },
      },
    });

    const hono = new sst.aws.Function("Hono", {
      url: true,
      handler: "src/index.handler",
      link: [table],
      environment: {
        TABLE_NAME: table.name,
      },
    });

    return {
      api: hono.url,
      table: table.name,
    };
  },
});
