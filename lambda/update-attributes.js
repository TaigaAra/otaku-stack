const AWS = require("aws-sdk");
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;

    const { mangaId, readChapter, platform } = body;

    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Unauthorized: Missing userId" }),
      };
    }

    if (!mangaId || (readChapter === undefined && !platform)) {
      return {
        statusCode: 400,
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
      TableName: "TABLE_NAME", // Replace TABLE_NAME with your DynamoDB table name
      Key: { userId, mangaId },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "UPDATED_NEW",
    };

    const result = await dynamoDB.update(updateParams).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Attributes updated successfully" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
