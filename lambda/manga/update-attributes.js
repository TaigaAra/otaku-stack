const AWS = require("aws-sdk");
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const jwt = require("jsonwebtoken");

exports.handler = async (event) => {
  try {
    const cookies = event.headers.Cookie || event.headers.cookie || "";
    const idToken = cookies
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("idToken="))
      ?.split("=")[1];

    if (!idToken) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ message: "Unauthorized: No idToken found" }),
      };
    }

    // Decode the token to extract the userId (sub)
    const tokenPayload = jwt.decode(idToken);
    const userId = tokenPayload?.sub;

    if (!userId) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ message: "Unauthorized: Invalid token" }),
      };
    }

    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;

    const { mangaId, readChapter, platform } = body;

    if (!mangaId || (readChapter === undefined && !platform)) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({
          message: "Missing mangaId or update attributes",
        }),
      };
    }

    const updateExpression = [];
    const expressionAttributeValues = {};

    if (readChapter !== undefined) {
      const readChapterNumber = parseInt(readChapter, 10);
      if (isNaN(readChapterNumber)) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
            "Access-Control-Allow-Credentials": "true",
          },
          body: JSON.stringify({ message: "Invalid readChapter value" }),
        };
      }
      updateExpression.push("readChapter = :readChapter");
      expressionAttributeValues[":readChapter"] = readChapterNumber;
    }

    if (platform) {
      updateExpression.push("platform = :platform");
      expressionAttributeValues[":platform"] = platform;
    }

    const updateParams = {
      TableName: process.env.DYNAMODB_TABLE,
      Key: { userId, mangaId },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "UPDATED_NEW",
    };

    const result = await dynamoDB.update(updateParams).promise();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ message: "Attributes updated successfully" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
