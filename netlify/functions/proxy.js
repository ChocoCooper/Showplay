/**
 * Netlify Function: proxy
 * 
 * Server-side CORS proxy for stream scraper API calls.
 * Uses Node.js built-in https/http modules — no external dependencies.
 * Works on Node 12, 14, 16, 18+.
 * 
 * POST body: { url, method?, headers?, body? }
 * Response:  { ok, status, text, json? }
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
};

const ALLOWED_DOMAINS = [
    'enc-dec.app',
    'api.videasy.net',
    'videasy.net',
    'vidlink.pro',
    'themoviedb.hexa.su',
    'api.smashystream.top',
    'smashystream.top',
    'smashyplayer.top',
    'play.xpass.top',
    'xpass.top',
    'solarmovie.fi',
    'rapidshare.cc',
    'cdn.madplay.site',
    'api.madplay.site',
    'madplay.site',
    'vixsrc.to',
    'api.themoviedb.org',
];

function isAllowed(hostname) {
    return ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
}

function makeRequest(urlStr, options = {}) {
    return new Promise((resolve, reject) => {
        let parsed;
        try { parsed = new URL(urlStr); } catch (e) { return reject(new Error('Invalid URL: ' + urlStr)); }

        const isHttps = parsed.protocol === 'https:';
        const lib = isHttps ? https : http;

        const reqOptions = {
            hostname: parsed.hostname,
            port:     parsed.port || (isHttps ? 443 : 80),
            path:     parsed.pathname + parsed.search,
            method:   (options.method || 'GET').toUpperCase(),
            headers:  {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...(options.headers || {}),
            },
            timeout: 15000,
        };

        const req = lib.request(reqOptions, (res) => {
            // Follow redirects up to 5 hops
            if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && (options._redirects||0) < 5) {
                const loc = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
                return makeRequest(loc, { ...options, _redirects: (options._redirects||0)+1 })
                    .then(resolve).catch(reject);
            }
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });

        req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
        req.on('error', reject);
        if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        req.end();
    });
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { url, method='GET', headers={}, body } = payload;
    if (!url) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing url' }) };

    let parsed;
    try { parsed = new URL(url); }
    catch { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Malformed url' }) }; }

    if (!isAllowed(parsed.hostname)) {
        return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: `Domain not allowed: ${parsed.hostname}` }) };
    }

    try {
        const result = await makeRequest(url, { method, headers, body });
        let json = null;
        try { json = JSON.parse(result.body); } catch {}
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ ok: result.statusCode >= 200 && result.statusCode < 300, status: result.statusCode, text: result.body, json }),
        };
    } catch (err) {
        return { statusCode: 502, headers: CORS_HEADERS, body: JSON.stringify({ error: `Upstream failed: ${err.message}` }) };
    }
};
