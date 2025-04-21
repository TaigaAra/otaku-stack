const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");

const dynamoDbClient = new DynamoDBClient({ region: "REGION" }); // Replace REGION with your AWS region

exports.handler = async (event) => {
  const idToken = event.headers?.Authorization;
  if (!idToken) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing Authorization header" }),
    };
  }

  try {
    const tokenParts = idToken.split(".");
    const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString());
    const userId = payload.sub;

    const params = {
      TableName: "TABLE_NAME", // Replace TABLE_NAME with your DynamoDB table name
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": { S: userId },
      },
    };

    const command = new QueryCommand(params);
    const data = await dynamoDbClient.send(command);

    if (!data.Items || data.Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "No manga cards found" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data.Items),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch manga cards" }),
    };
  }
};
