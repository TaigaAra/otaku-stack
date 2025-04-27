const AWS = require("aws-sdk");

const cognito = new AWS.CognitoIdentityServiceProvider();
const clientId = process.env.APP_CLIENT_ID;
const clientSecret = process.env.APP_CLIENT_SECRET;

function calculateSecretHash(username) {
  const crypto = require("crypto");
  const message = username + clientId;
  return crypto
    .createHmac("SHA256", clientSecret)
    .update(message)
    .digest("base64");
}

exports.handler = async (event) => {
  try {
    const cookies = event.headers.Cookie || event.headers.cookie || "";
    const refreshToken = cookies
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("refreshToken="))
      ?.split("=")[1];

    if (!refreshToken) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({
          error: "No refresh token found. Please log in again.",
        }),
      };
    }

    const params = {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
        SECRET_HASH: calculateSecretHash("EXAMPLE_USERNAME"), // Replace with actual username if needed
      },
    };

    const response = await cognito.initiateAuth(params).promise();

    const { IdToken, AccessToken } = response.AuthenticationResult;

    // Set the new tokens in HttpOnly cookies
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
        "Set-Cookie": [
          `idToken=${IdToken}; HttpOnly; Secure; SameSite=Strict; Path=/`,
          `accessToken=${AccessToken}; HttpOnly; Secure; SameSite=Strict; Path=/`,
        ].join(", "),
      },
      body: JSON.stringify({ message: "Tokens refreshed successfully." }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to refresh tokens." }),
    };
  }
};
