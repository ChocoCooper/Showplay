const https = require('https');
const http  = require('http');

var CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

function respond(callback, status, body) {
    callback(null, { statusCode: status, headers: CORS, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

function parseUrl(rawUrl) {
    var isHttps = rawUrl.indexOf('https://') === 0;
    var withoutProto = rawUrl.replace(/^https?:\/\//, '');
    var qIdx = withoutProto.indexOf('?');
    var hostAndPath = withoutProto;
    var query = '';
    if (qIdx > -1) {
        // find first slash to separate host
    }
    var slashIdx = withoutProto.indexOf('/');
    var hostPart, pathPart;
    if (slashIdx === -1) {
        hostPart = withoutProto;
        pathPart = '/';
    } else {
        hostPart = withoutProto.slice(0, slashIdx);
        pathPart = withoutProto.slice(slashIdx);
    }
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

function doRequest(parsed, method, reqHeaders, bodyData, redirectCount, callback) {
    if (redirectCount > 5) return respond(callback, 502, { error: 'Too many redirects' });

    var lib = parsed.isHttps ? https : http;
    var options = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.path,
        method: method,
        headers: Object.assign({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, reqHeaders),
        rejectUnauthorized: false
    };
    if (bodyData) {
        options.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    var req = lib.request(options, function(res) {
        if ([301,302,303,307,308].indexOf(res.statusCode) > -1 && res.headers.location) {
            var loc = res.headers.location;
            if (loc.indexOf('http') !== 0) {
                var proto = parsed.isHttps ? 'https' : 'http';
                loc = proto + '://' + parsed.hostname + (loc.indexOf('/') === 0 ? '' : '/') + loc;
            }
            try {
                var newParsed = parseUrl(loc);
                return doRequest(newParsed, 'GET', reqHeaders, null, redirectCount + 1, callback);
            } catch(e) { return respond(callback, 502, { error: 'Redirect parse error: ' + e.message }); }
        }

        var chunks = [];
        res.on('data', function(c) { chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); });
        res.on('end', function() {
            var text = Buffer.concat(chunks).toString('utf8');
            var json = null;
            try { json = JSON.parse(text); } catch(e) {}
            respond(callback, 200, { ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: text, json: json });
        });
        res.on('error', function(e) { respond(callback, 502, { error: 'Response error: ' + e.message }); });
    });

    req.setTimeout(25000, function() { req.destroy(); respond(callback, 502, { error: 'Request timeout' }); });
    req.on('error', function(e) { respond(callback, 502, { error: 'Request error: ' + e.message }); });
    if (bodyData) req.write(bodyData);
    req.end();
}

exports.handler = function(event, context, callback) {
    // Support GET with ?url= query param for HLS.js proxy loader
    if (event.httpMethod === 'GET') {
        var qs = event.queryStringParameters || {};
        var getUrl = qs.url || qs.URL;
        if (!getUrl) return respond(callback, 400, { error: 'Missing url param' });
        var getParsed;
        try { getParsed = parseUrl(getUrl); } catch(e) { return respond(callback, 400, { error: 'Bad url' }); }
        return doRequest(getParsed, 'GET', {}, null, 0, function(err, result) {
            if (err) return callback(err);
            // For HLS content, return raw text/binary with proper content-type
            var body = result.body;
            var parsed2;
            try { parsed2 = JSON.parse(body); } catch(e) { parsed2 = null; }
            var isHlsContent = body && (body.indexOf('#EXTM3U') === 0 || body.indexOf('#EXT') === 0);
            callback(null, {
                statusCode: result.statusCode || 200,
                headers: Object.assign({}, CORS, {
                    'Content-Type': isHlsContent ? 'application/vnd.apple.mpegurl' : (result.contentType || 'application/octet-stream')
                }),
                body: body,
                isBase64Encoded: false
            });
        });
    }
    if (event.httpMethod === 'OPTIONS') return respond(callback, 204, '');
    if (event.httpMethod !== 'POST')    return respond(callback, 405, { error: 'Method not allowed' });

    var payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch(e) { return respond(callback, 400, { error: 'Invalid JSON' }); }

    var url    = payload.url;
    var method = (payload.method || 'GET').toUpperCase();
    var hdrs   = payload.headers || {};
    var body   = payload.body;

    if (!url || typeof url !== 'string') return respond(callback, 400, { error: 'Missing url' });

    var parsed;
    try { parsed = parseUrl(url); }
    catch(e) { return respond(callback, 400, { error: 'Bad url: ' + e.message }); }

    var bodyData = null;
    if (body !== undefined && body !== null) {
        bodyData = typeof body === 'string' ? body : JSON.stringify(body);
        if (!hdrs['Content-Type'] && !hdrs['content-type']) hdrs['Content-Type'] = 'application/json';
    }

    doRequest(parsed, method, hdrs, bodyData, 0, callback);
};
