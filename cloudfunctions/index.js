require('dotenv').config();

const express = require('express');
const proxy = require('./proxy');
const musictag = require('./musictag');

const app = express();
const bodyParser = require('body-parser');
const port = process.env.PORT || 7529;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/proxy', (req, res) => {
  proxy.main(req.body, {}, (err, data) => res.send(err || data));
});

app.post('/musictag', (req, res) => {
  musictag.main(req.body, {}, (err, data) => res.send(err || data));
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
