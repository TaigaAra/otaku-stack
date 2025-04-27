const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");

const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  try {
    const cookiesHeader = event.headers?.Cookie || event.headers?.cookie || "";
    // Split and log each cookie
    const cookiesArray = cookiesHeader.split(";");

    // Extract the accessToken
    const accessToken = cookiesArray
      .find((cookie) => cookie.trim().startsWith("accessToken="))
      ?.split("=")[1]
      ?.trim();

    // Validate the token format
    if (!accessToken || accessToken.split(".").length !== 3) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Unauthorized: Invalid token format" }),
      };
    }

    // Decode the token payload
    const tokenParts = accessToken.split(".");
    const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString());

    const userId = payload.sub;
    if (!userId) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({
          error: "Unauthorized: Missing userId in token",
        }),
      };
    }

    // Query DynamoDB for the user's saved manga cards
    const params = {
      TableName: process.env.DYNAMODB_TABLE,
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
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "No manga cards found" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify(data.Items),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
