const AWS = require("aws-sdk");
const crypto = require("crypto");

const cognito = new AWS.CognitoIdentityServiceProvider();
const userPoolId = process.env.USER_POOL_ID;
const clientId = process.env.APP_CLIENT_ID;
const clientSecret = process.env.APP_CLIENT_SECRET;

exports.handler = async (event) => {
  try {
    // Parse the body
    let body;
    try {
      body =
        event.body && typeof event.body === "string"
          ? JSON.parse(event.body)
          : event.body;
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Invalid request body format." }),
      };
    }

    if (!body || !body.username || !body.password) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Username and password are required." }),
      };
    }

    const { username, password } = body;

    // Calculate the SECRET_HASH
    const secretHash = crypto
      .createHmac("SHA256", clientSecret)
      .update(username + clientId)
      .digest("base64");

    // Call Cognito's initiateAuth API
    const params = {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: secretHash,
      },
    };

    try {
      const response = await cognito.initiateAuth(params).promise();

      if (response.AuthenticationResult) {
        const { IdToken, AccessToken, RefreshToken } =
          response.AuthenticationResult;

        return {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
            "Access-Control-Allow-Credentials": "true",
          },
          multiValueHeaders: {
            "Set-Cookie": [
              `idToken=${IdToken}; HttpOnly; SameSite=None; Secure; Partitioned; Path=/`,
              `accessToken=${AccessToken}; HttpOnly; SameSite=None; Secure; Partitioned; Path=/`,
              `refreshToken=${RefreshToken}; HttpOnly; SameSite=None; Secure; Partitioned; Path=/`,
            ],
          },
          body: JSON.stringify({ message: "Login successful" }),
        };
      } else {
        return {
          statusCode: 401,
          headers: {
            "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
            "Access-Control-Allow-Credentials": "true",
          },
          body: JSON.stringify({ error: "Authentication failed." }),
        };
      }
    } catch (authError) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Invalid username or password." }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Internal server error." }),
    };
  }
};
