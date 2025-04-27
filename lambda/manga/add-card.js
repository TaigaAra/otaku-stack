const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fetch = require("node-fetch");

const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);

    const {
      userId,
      mangaId,
      title,
      coverUrl,
      latestChapter,
      status,
      readChapter,
      platform,
    } = body;
    if (!userId || !mangaId || !title || !coverUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    let s3ImageUrl = null;
    try {
      const response = await fetch(coverUrl, {
        headers: {
          "User-Agent": "OtakuStack/1.0", // Required by MangaDex
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch cover image. Status: ${response.status}`
        );
      }

      const buffer = await response.arrayBuffer();

      const s3Params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `manga-covers/${mangaId}.jpg`,
        Body: Buffer.from(buffer),
        ContentType: "image/jpeg",
      };
      const s3Command = new PutObjectCommand(s3Params);
      await s3Client.send(s3Command);

      s3ImageUrl = `https://${s3Params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Params.Key}`;
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to process cover image" }),
      };
    }

    const dynamoParams = {
      TableName: process.env.DYNAMODB_TABLE,
      Item: {
        userId,
        mangaId,
        title,
        coverUrl: s3ImageUrl,
        latestChapter,
        status,
        readChapter,
        platform,
      },
    };

    try {
      const dynamoCommand = new PutCommand(dynamoParams);
      await dynamoDbClient.send(dynamoCommand);
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to save data to DynamoDB" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Manga card added successfully",
        mangaData: {
          userId,
          mangaId,
          title,
          coverUrl: s3ImageUrl,
          latestChapter,
          status,
          readChapter,
          platform,
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
