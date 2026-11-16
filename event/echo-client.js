const { createEchoClient } = require('./grpc');

const client = createEchoClient();
client.Echo({ message: process.argv.slice(2).join(' ') }, (error, response) => {
  client.close();
  if (error) {
    console.error(`gRPC ${error.code}: ${error.details}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${response.message} (${response.timestamp})`);
});
