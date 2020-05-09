const https = require('https');

module.exports = async (url, options = null) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, options, res => {
            if (res.statusCode === 403) {
                return reject(new Error(`Invalid token`));
            }
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Status Code: ${res.statusCode}`));
            }

            const data = [];

            res.on('data', chunk => {
                data.push(chunk);
            });

            res.on('end', () => resolve(JSON.parse(Buffer.concat(data).toString())));
        });

        req.on('error', reject);

        req.end();
    });
};