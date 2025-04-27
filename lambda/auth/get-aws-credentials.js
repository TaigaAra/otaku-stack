const AWS = require("aws-sdk");

const cognitoIdentity = new AWS.CognitoIdentity();
const identityPoolId = process.env.IDENTITY_POOL_ID;

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
        body: JSON.stringify({ error: "Unauthorized: No idToken found" }),
      };
    }

    // Decode the idToken to extract the userId
    const tokenPayload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64").toString()
    );
    const userId = tokenPayload.sub;

    // Get AWS credentials using the Cognito Identity Pool
    const params = {
      IdentityPoolId: identityPoolId,
      Logins: {
        [`cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}`]:
          idToken,
      },
    };

    const identityId = await cognitoIdentity.getId(params).promise();
    const credentials = await cognitoIdentity
      .getCredentialsForIdentity({
        IdentityId: identityId.IdentityId,
        Logins: params.Logins,
      })
      .promise();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        userId,
        credentials: credentials.Credentials,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to get AWS credentials" }),
    };
  }
};
