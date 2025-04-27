const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { userId, mangaId, coverUrl } = body;

    if (!userId || !mangaId || !coverUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // Extract the S3 object key from the coverUrl
    const s3Key = coverUrl.split(".com/")[1];

    // Delete the item from DynamoDB
    const dynamoParams = {
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        userId,
        mangaId,
      },
    };

    try {
      const dynamoCommand = new DeleteCommand(dynamoParams);
      await dynamoDbClient.send(dynamoCommand);
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to delete data from DynamoDB" }),
      };
    }

    // Delete the corresponding image from S3
    const s3Params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
    };

    try {
      const s3Command = new DeleteObjectCommand(s3Params);
      await s3Client.send(s3Command);
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to delete image from S3" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Manga card and image removed successfully",
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
