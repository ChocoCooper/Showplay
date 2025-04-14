// netlify/functions/utils.js
exports.getTmdbUrl = (path, apiKey, params = {}) => {
  const baseUrl = 'https://api.themoviedb.org/3';
  const query = new URLSearchParams({ api_key: apiKey, ...params }).toString();
  return `${baseUrl}/${path}?${query}`;
};

exports.corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};
