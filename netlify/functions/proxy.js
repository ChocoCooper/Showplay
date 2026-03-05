const https = require('https');
const http  = require('http');

var CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
};

function parseUrl(rawUrl) {
    var isHttps = rawUrl.indexOf('https://') === 0;
    var withoutProto = rawUrl.replace(/^https?:\/\//, '');
    var slashIdx = withoutProto.indexOf('/');
    var hostPart = slashIdx === -1 ? withoutProto : withoutProto.slice(0, slashIdx);
    var pathPart = slashIdx === -1 ? '/' : withoutProto.slice(slashIdx);
    var colonIdx = hostPart.lastIndexOf(':');
    var hostname, port;
    if (colonIdx > -1 && colonIdx > hostPart.indexOf(']')) {
        hostname = hostPart.slice(0, colonIdx);
        port = parseInt(hostPart.slice(colonIdx + 1));
    } else {
        hostname = hostPart;
        port = isHttps ? 443 : 80;
    }
    return { hostname: hostname, port: port, path: pathPart, isHttps: isHttps };
}

// doRequest: calls callback(error, { statusCode, rawBody, contentType })
function doRequest(parsed, method, reqHeaders, bodyData, redirectCount, callback) {
    if (redirectCount > 5) return callback(new Error('Too many redirects'));
    var lib = parsed.isHttps ? https : http;
    var options = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.path,
        method: method,
        headers: Object.assign({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, reqHeaders),
        rejectUnauthorized: false
    };
    if (bodyData) options.headers['Content-Length'] = Buffer.byteLength(bodyData);

    var req = lib.request(options, function(res) {
        if ([301,302,303,307,308].indexOf(res.statusCode) > -1 && res.headers.location) {
            var loc = res.headers.location;
            if (loc.indexOf('http') !== 0) {
                loc = (parsed.isHttps ? 'https' : 'http') + '://' + parsed.hostname + (loc.charAt(0) === '/' ? '' : '/') + loc;
            }
            try { return doRequest(parseUrl(loc), 'GET', reqHeaders, null, redirectCount + 1, callback); }
            catch(e) { return callback(e); }
        }
        var chunks = [];
        res.on('data', function(c) { chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); });
        res.on('end', function() {
            callback(null, {
                statusCode: res.statusCode,
                rawBody: Buffer.concat(chunks),
                contentType: res.headers['content-type'] || ''
            });
        });
        res.on('error', callback);
    });
    req.setTimeout(25000, function() { req.destroy(); callback(new Error('Timeout')); });
    req.on('error', callback);
    if (bodyData) req.write(bodyData);
    req.end();
}

exports.handler = function(event, context, callback) {
    // ── OPTIONS preflight ────────────────────────────────────────────────────
    if (event.httpMethod === 'OPTIONS') {
        return callback(null, { statusCode: 204, headers: CORS, body: '' });
    }

    // ── GET ?url=... — used by HLS.js ProxyLoader for manifest + segments ───
    if (event.httpMethod === 'GET') {
        var qs = event.queryStringParameters || {};
        var getUrl = qs.url || qs.URL;
        if (!getUrl) {
            return callback(null, { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) });
        }
        var getParsed;
        try { getParsed = parseUrl(getUrl); }
        catch(e) { return callback(null, { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Bad url' }) }); }

        return doRequest(getParsed, 'GET', {
            'Accept': '*/*',
            'Origin': 'https://showplay.netlify.app'
        }, null, 0, function(err, result) {
            if (err) return callback(null, { statusCode: 502, headers: CORS, body: JSON.stringify({ error: err.message }) });
            // Return raw body — HLS.js needs actual M3U8/TS content, not a JSON envelope
            var bodyStr = result.rawBody.toString('utf8');
            var ct = result.contentType || 'application/octet-stream';
            if (bodyStr.indexOf('#EXTM3U') === 0 || bodyStr.indexOf('#EXT-X') !== -1) {
                ct = 'application/vnd.apple.mpegurl';
            }
            callback(null, {
                statusCode: result.statusCode,
                headers: Object.assign({}, CORS, { 'Content-Type': ct }),
                body: bodyStr,
                isBase64Encoded: false
            });
        });
    }

    // ── POST { url, method?, headers?, body? } — used by pFetch ─────────────
    if (event.httpMethod !== 'POST') {
        return callback(null, { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) });
    }

    var payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch(e) { return callback(null, { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }); }

    var url    = payload.url;
    var method = (payload.method || 'GET').toUpperCase();
    var hdrs   = payload.headers || {};
    var body   = payload.body;

    if (!url) return callback(null, { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing url' }) });

    var parsed;
    try { parsed = parseUrl(url); }
    catch(e) { return callback(null, { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Bad url: ' + e.message }) }); }

    var bodyData = null;
    if (body !== undefined && body !== null) {
        bodyData = typeof body === 'string' ? body : JSON.stringify(body);
        if (!hdrs['Content-Type'] && !hdrs['content-type']) hdrs['Content-Type'] = 'application/json';
    }

    doRequest(parsed, method, hdrs, bodyData, 0, function(err, result) {
        if (err) return callback(null, { statusCode: 502, headers: CORS, body: JSON.stringify({ error: err.message }) });
        var text = result.rawBody.toString('utf8');
        var json = null;
        try { json = JSON.parse(text); } catch(e) {}
        callback(null, {
            statusCode: 200,
            headers: CORS,
            body: JSON.stringify({ ok: result.statusCode >= 200 && result.statusCode < 300, status: result.statusCode, text: text, json: json })
        });
    });
};
