const keys = require('./keys');

// express app setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

var app = express();

app.use(cors());
app.use(bodyParser.json());

// PG client setup
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  port: keys.pgPort,
  database: keys.pgDatabase,
  password: keys.pgPassword
});

pgClient.on('error', () => console.log('Lost connection to PG'));

// create a table to store the values
pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch((err) => console.log(err));

// Redis client setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();

// express route handler
app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * FROM values');

  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  if (index > 40) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet');

  // ask worker to calculate the fibonacci
  console.log('publishing message to cauculate fib');
  redisPublisher.publish('insert', index);

  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  res.send({ working: true });
});

// start the app
app.listen(5000, (err) => {
  console.log('App listening on 5000');
});
