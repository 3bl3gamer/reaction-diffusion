const http = require('http')

let promise = Promise.resolve()
http.createServer((req, res) => {
	res.setHeader('Access-Control-Allow-Origin', '*')
	req.on('data', data => {
		promise = promise.then(new Promise(res => process.stdout.write(data, res)))
	})
	req.on('end', () => {
		promise.then(() => res.end('OK'))
	})
}).listen(5001)
