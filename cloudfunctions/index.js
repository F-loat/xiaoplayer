require('dotenv').config();

const express = require('express');
const proxy = require('./proxy');
const musictag = require('./musictag');
const qrcode = require('./qrcode');

const app = express();
const bodyParser = require('body-parser');
const port = process.env.PORT || 7529;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/proxy', (req, res) => {
  proxy.main(req.body, {}, (err, data) => {
    if (err) res.status(500);
    res.send(err ? { code: err.code, message: err.message } : data);
  });
});

app.post('/musictag', (req, res) => {
  musictag.main(req.body, {}, (err, data) => {
    if (err) res.status(500);
    res.send(err ? { code: err.code, message: err.message } : data);
  });
});

app.post('/qrcode', (req, res) => {
  qrcode.main(req.body, {}, (err, data) => {
    if (err) res.status(500);
    res.send(err ? { code: err.code, message: err.message } : data);
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
