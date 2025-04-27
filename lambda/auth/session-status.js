const jwt = require("jsonwebtoken");
const axios = require("axios");
const forge = require("node-forge");

let cognitoJwks = null;

async function getCognitoJwks() {
  if (!cognitoJwks) {
    const jwksUrl = `${process.env.COGNITO_ISSUER}/.well-known/jwks.json`;
    const response = await axios.get(jwksUrl);
    cognitoJwks = response.data.keys;
  }
  return cognitoJwks;
}

function getPublicKey(kid, jwks) {
  const key = jwks.find((key) => key.kid === kid);
  if (!key) {
    throw new Error("Public key not found for kid");
  }
  return key;
}

function constructPemFromKey(key) {
  const publicKey = forge.pki.setRsaPublicKey(
    new forge.jsbn.BigInteger(Buffer.from(key.n, "base64").toString("hex"), 16),
    new forge.jsbn.BigInteger(Buffer.from(key.e, "base64").toString("hex"), 16)
  );
  return forge.pki.publicKeyToPem(publicKey);
}

exports.handler = async (event) => {
  try {
    // Extract the idToken from the Cookie header
    let cookies = event.headers?.Cookie || event.headers?.cookie || "";

    if (!cookies) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({
          isValid: false,
          error: "No cookies found in the request headers",
        }),
      };
    }

    // Split and trim the cookies
    const cookieArray = cookies.split(";").map((cookie) => cookie.trim());

    // Find the idToken
    const idToken = cookieArray
      .find((cookie) => cookie.startsWith("idToken="))
      ?.split("=")[1];

    if (!idToken) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({
          isValid: false,
          error: "idToken not found in cookies",
        }),
      };
    }

    // Decode the token header to get the kid
    const decodedHeader = jwt.decode(idToken, { complete: true });
    if (!decodedHeader || !decodedHeader.header || !decodedHeader.header.kid) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ isValid: false, error: "Invalid token header" }),
      };
    }

    const kid = decodedHeader.header.kid;

    // Get the public key for the kid
    const jwks = await getCognitoJwks();

    const publicKey = getPublicKey(kid, jwks);

    // Construct the PEM key manually
    const pem = constructPemFromKey(publicKey);

    const verifiedToken = jwt.verify(idToken, pem, {
      algorithms: ["RS256"],
      issuer: process.env.COGNITO_ISSUER,
      audience: process.env.COGNITO_AUDIENCE,
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ isValid: true, user: verifiedToken }),
    };
  } catch (error) {
    return {
      statusCode: 401,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        isValid: false,
        error: "Invalid or expired token",
      }),
    };
  }
};
