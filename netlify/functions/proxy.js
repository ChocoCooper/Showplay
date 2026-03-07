const https = require('https');
const http  = require('http');

var CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Max safe body: Netlify Lambda limit is 6MB; base64 adds ~33%.
// Cap at 4MB raw — larger responses are video segments that the browser
// should fetch directly (ProxyLoader direct-fetch handles this).
var MAX_BODY_BYTES = 4 * 1024 * 1024;

function parseUrl(rawUrl) {
    var isHttps = rawUrl.startsWith('https://');
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
    return { hostname, port, path: pathPart, isHttps };
}

function doRequest(parsed, method, reqHeaders, bodyData, redirectCount) {
    return new Promise(function(resolve, reject) {
        if (redirectCount > 5) return reject(new Error('Too many redirects'));
        var lib = parsed.isHttps ? https : http;
        var options = {
            hostname: parsed.hostname,
            port:     parsed.port,
            path:     parsed.path,
            method,
            headers: Object.assign({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }, reqHeaders),
            rejectUnauthorized: false
        };
        if (bodyData) options.headers['Content-Length'] = Buffer.byteLength(bodyData);

        var req = lib.request(options, function(res) {
            if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
                var loc = res.headers.location;
                if (!loc.startsWith('http')) {
                    loc = (parsed.isHttps ? 'https' : 'http') + '://' + parsed.hostname +
                          (loc.startsWith('/') ? '' : '/') + loc;
                }
                res.resume();
                try { return resolve(doRequest(parseUrl(loc), 'GET', reqHeaders, null, redirectCount + 1)); }
                catch(e) { return reject(e); }
            }
            var chunks = [], totalBytes = 0;
            res.on('data', function(c) {
                var buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
                totalBytes += buf.length;
                if (totalBytes > MAX_BODY_BYTES) {
                    req.destroy();
                    var err = new Error('Response too large (' + totalBytes + ' bytes) — fetch directly');
                    err.code = 'TOO_LARGE';
                    return reject(err);
                }
                chunks.push(buf);
            });
            res.on('end',   function() { resolve({ statusCode: res.statusCode, rawBody: Buffer.concat(chunks), contentType: res.headers['content-type'] || '' }); });
            res.on('error', reject);
        });
        req.setTimeout(25000, function() { req.destroy(); reject(new Error('Timeout')); });
        req.on('error', reject);
        if (bodyData) req.write(bodyData);
        req.end();
    });
}

// Async handler — avoids Node.js 24 callback deprecation warning
exports.handler = async function(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    var payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch(e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    var url    = payload.url;
    var method = (payload.method || 'GET').toUpperCase();
    var hdrs   = payload.headers || {};
    var body   = payload.body;

    if (!url) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing url' }) };

    var parsed;
    try { parsed = parseUrl(url); }
    catch(e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Bad url: ' + e.message }) }; }

    var bodyData = null;
    if (body != null) {
        bodyData = typeof body === 'string' ? body : JSON.stringify(body);
        if (!hdrs['Content-Type'] && !hdrs['content-type']) hdrs['Content-Type'] = 'application/json';
    }

    try {
        var result = await doRequest(parsed, method, hdrs, bodyData, 0);
        var text = result.rawBody.toString('utf8');
        var b64  = result.rawBody.toString('base64');
        var json = null;
        try { json = JSON.parse(text); } catch(e) {}
        return {
            statusCode: 200,
            headers: CORS,
            body: JSON.stringify({ ok: result.statusCode >= 200 && result.statusCode < 300, status: result.statusCode, text, base64: b64, json })
        };
    } catch(err) {
        var status = err.code === 'TOO_LARGE' ? 413 : 502;
        return { statusCode: status, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
};
