const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fetch = require("node-fetch");

// Initialize AWS SDK v3 clients
const dynamoDbClient = new DynamoDBClient({ region: "REGION" }); // Replace REGION with your AWS region
const s3Client = new S3Client({ region: "REGION" }); // Replace REGION with your AWS region

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);

    // Validate required fields
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

    // Fetch the cover image
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

      // Upload the image to S3
      const s3Params = {
        Bucket: "BUCKET_NAME", // Replace BUCKET_NAME with your S3 bucket name
        Key: `manga-covers/${mangaId}.jpg`, // Unique key for the image
        Body: Buffer.from(buffer),
        ContentType: "image/jpeg",
      };
      const s3Command = new PutObjectCommand(s3Params);
      await s3Client.send(s3Command);

      // Construct the S3 URL manually
      s3ImageUrl = `https://${s3Params.Bucket}.s3.REGION.amazonaws.com/${s3Params.Key}`;
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to process cover image" }),
      };
    }

    // Save the manga data to DynamoDB
    const dynamoParams = {
      TableName: "TABLE_NAME", // Replace TABLE_NAME with your DynamoDB table name
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
