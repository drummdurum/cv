const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { registerQuizService } = require('./quizGrpc');

const definition = protoLoader.loadSync(path.join(__dirname, 'echo.proto'), {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const EchoService = grpc.loadPackageDefinition(definition).event.EchoService;

function echo(call, callback) {
  const message = call.request.message.trim();
  if (!message) {
    callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Beskeden må ikke være tom.' });
    return;
  }
  callback(null, { message: `You said: ${message}`, timestamp: new Date().toISOString(), name: call.request.name || '' });
}

function startGrpcServer(port = Number(process.env.GRPC_PORT) || 50051) {
  const server = new grpc.Server();
  server.addService(EchoService.service, { Echo: echo });
  registerQuizService(server);
  return new Promise((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error, boundPort) => {
      if (error) return reject(error);
      resolve({ server, port: boundPort });
    });
  });
}

function createEchoClient(address = `127.0.0.1:${process.env.GRPC_PORT || 50051}`) {
  return new EchoService(address, grpc.credentials.createInsecure());
}

module.exports = { startGrpcServer, createEchoClient };
