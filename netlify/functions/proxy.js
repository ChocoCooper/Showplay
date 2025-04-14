// netlify/functions/proxy.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const apiKey = process.env.TMDB_API_KEY;
  const tmdbBaseUrl = 'https://api.themoviedb.org/3';

  try {
    // Extract query parameters and path from the request
    const { path, ...queryParams } = event.queryStringParameters;
    if (!path) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Path parameter is required' }),
      };
    }

    // Construct TMDb API URL
    const queryString = new URLSearchParams({
      api_key: apiKey,
      ...queryParams,
    }).toString();
    const url = `${tmdbBaseUrl}/${path}?${queryString}`;

    // Make request to TMDb API
    const response = await fetch(url, {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `TMDb API error: ${response.statusText}` }),
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow CORS
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
