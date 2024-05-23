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
        GSI1PK: "string",
        GSI1SK: "string",
      },
      primaryIndex: { hashKey: "PK", rangeKey: "SK" },
      globalIndexes: {
        GSI1: { hashKey: "GSI1PK", rangeKey: "GSI1SK" },
      },
    });

    const hono = new sst.aws.Function("Hono", {
      url: true,
      handler: "src/index.handler",
      link: [table],
      environment: {
        TABLE_NAME: table.name,
        INDEX_NAME: "GSI1",
      },
    });

    return {
      api: hono.url,
      table: table.name,
    };
  },
});
