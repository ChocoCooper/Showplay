exports.handler = async (event, context) => {
  const { path, queryStringParameters } = event;
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  try {
    const tmdbUrl = `https://api.themoviedb.org${path.replace("/.netlify/functions/tmdb-proxy", "")}?api_key=${apiKey}${queryStringParameters ? "&" + new URLSearchParams(queryStringParameters).toString() : ""}`;
    const response = await fetch(tmdbUrl);
    const responseBody = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: responseBody,
    };
  } catch (error) {
    console.error("Error proxying TMDb request:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch TMDb data" }),
    };
  }
};
