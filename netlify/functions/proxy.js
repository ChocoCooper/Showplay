/**
 * Netlify Function: /api/proxy
 * 
 * Acts as a server-side CORS proxy for all stream scraper API calls.
 * Accepts:  POST { url, method?, headers?, body? }
 * Returns:  { ok, status, text, json? }
 */

exports.handler = async (event) => {
    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Invalid JSON body' }),
        };
    }

    const { url, method = 'GET', headers = {}, body } = payload;

    if (!url || typeof url !== 'string') {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Missing or invalid url' }),
        };
    }

    // Allowlist of permitted upstream domains
    const ALLOWED_DOMAINS = [
        'enc-dec.app',
        'api.videasy.net',
        'vidlink.pro',
        'themoviedb.hexa.su',
        'api.smashystream.top',
        'play.xpass.top',
        'solarmovie.fi',
        'cdn.madplay.site',
        'api.madplay.site',
        'vixsrc.to',
        'rapidshare.cc',
        'api.themoviedb.org',
    ];

    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Malformed url' }),
        };
    }

    const hostname = parsedUrl.hostname;
    const isAllowed = ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
    if (!isAllowed) {
        return {
            statusCode: 403,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Domain not allowed: ${hostname}` }),
        };
    }

    try {
        const fetchOptions = {
            method: method.toUpperCase(),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...headers,
            },
        };

        if (body !== undefined && body !== null) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
            if (!fetchOptions.headers['Content-Type']) {
                fetchOptions.headers['Content-Type'] = 'application/json';
            }
        }

        const response = await fetch(url, fetchOptions);
        const text = await response.text();

        // Try to parse as JSON, fall back to raw text
        let json = null;
        try { json = JSON.parse(text); } catch { /* not JSON */ }

        return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ok: response.ok,
                status: response.status,
                text,
                json,
            }),
        };
    } catch (err) {
        return {
            statusCode: 502,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Upstream fetch failed: ${err.message}` }),
        };
    }
};
