const express = require('express');
const cassandra = require('cassandra-driver');
const { NodeTracerProvider } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-collector-grpc');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { CassandraDriverInstrumentation } = require('@opentelemetry/instrumentation-cassandra-driver');
const { SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Initialize OpenTelemetry
const exporter = new OTLPTraceExporter({
  url: 'http://localhost:4317', // OpenTelemetry Collector endpoint
});
const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'cassandra-service',
  }),
});
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();

registerInstrumentations({
  instrumentations: [
    new CassandraDriverInstrumentation(),
  ],
});

const app = express();
app.use(express.json());

// Cassandra client setup
const client = new cassandra.Client({
  contactPoints: ['127.0.0.1'],
  localDataCenter: 'datacenter1',
  keyspace: 'test'
});

app.post('/users', async (req, res) => {
  const { id, name } = req.body;
  try {
    await client.execute('INSERT INTO users (id, name) VALUES (?, ?)', [id, name], { prepare: true });
    res.status(201).send('User created');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await client.execute('SELECT * FROM users WHERE id = ?', [id], { prepare: true });
    if (result.rowLength === 0) {
      res.status(404).send('User not found');
    } else {
      res.status(200).json(result.rows[0]);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  try {
    await client.connect();
    console.log(`Server is running on port ${PORT}`);
  } catch (error) {
    console.error('Failed to connect to Cassandra', error);
    process.exit(1);
  }
});
