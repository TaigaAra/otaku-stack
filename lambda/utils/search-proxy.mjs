import AWS from "aws-sdk";
import fetch from "node-fetch";

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const IMAGE_SIZE_THRESHOLD = 4 * 1024 * 1024; // 4 MB size threshold

export const handler = async (event) => {
  const url = event.queryStringParameters?.url;
  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing 'url' query parameter" }),
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "OtakuStack/1.0",
      },
      timeout: 5000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch data from MangaDex API. Status: ${response.status}`
      );
    }

    const contentType = response.headers.get("Content-Type");

    if (contentType && contentType.startsWith("image/")) {
      const imageBuffer = await response.buffer();

      if (imageBuffer.length > IMAGE_SIZE_THRESHOLD) {
        const imageKey = `mangadex-images/${Date.now()}-${url
          .split("/")
          .pop()}`;

        await s3
          .putObject({
            Bucket: BUCKET_NAME,
            Key: imageKey,
            Body: imageBuffer,
            ContentType: contentType,
          })
          .promise();

        const signedUrl = s3.getSignedUrl("getObject", {
          Bucket: BUCKET_NAME,
          Key: imageKey,
          Expires: 3600,
        });

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            isBase64Encoded: false,
            contentType,
            imageUrl: signedUrl,
          }),
        };
      } else {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            isBase64Encoded: true,
            contentType,
            body: imageBuffer.toString("base64"),
          }),
        };
      }
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch data from the provided URL",
      }),
    };
  }
};
