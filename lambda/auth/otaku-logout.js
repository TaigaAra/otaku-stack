exports.handler = async (event) => {
  try {
    // Return a response that clears the cookies
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      multiValueHeaders: {
        "Set-Cookie": [
          "idToken=; Max-Age=0; Path=/; HttpOnly; SameSite=None; Secure; Partitioned;",
          "accessToken=; Max-Age=0; Path=/; HttpOnly; SameSite=None; Secure; Partitioned;",
          "refreshToken=; Max-Age=0; Path=/; HttpOnly; SameSite=None; Secure; Partitioned;",
        ],
      },
      body: JSON.stringify({ message: "Logged out successfully" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_DOMAIN,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to log out" }),
    };
  }
};
