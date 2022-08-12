import http from 'http';
import {server as WebSocketServer, request, connection} from 'websocket';
import {createClient} from 'redis';
import dotenv from 'dotenv';
import {randomInt} from 'crypto';
import {AdminMessage, ChatMessage} from './types';

const isProd = process.env.NODE_ENV !== 'test';
if (isProd) {
  dotenv.config();
}
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const appId = process.env.APP_ID || randomInt(100);
const namedCollections: Record<string, connection> = {};
const connectionPool: Record<string, Set<connection>> = {
  livechat: new Set(),
};

const subscriberClient = createClient({
  url: redisUrl,
});

const publisher = createClient({
  url: redisUrl,
});

(async () => {
  await publisher.connect();
  await subscriberClient.connect();

  await subscriberClient.subscribe('livechat', message => {
    const data = JSON.parse(message) as ChatMessage;
    if (!connectionPool[data.channel]) {
      connectionPool[data.channel] = new Set();
    }
    connectionPool[data.channel].forEach(c =>
      c ? c.send(data.message) : connectionPool[data.channel].delete(c)
    );
  });

  await subscriberClient.subscribe('admin', message => {
    const data = JSON.parse(message) as AdminMessage;
    if (data.type === 'friend') {
      const channel = [data.from, data.to].sort().join('<->');
      if (!connectionPool[channel]) {
        connectionPool[channel] = new Set();
      }
      if (namedCollections[data.to]) {
        connectionPool[channel].add(namedCollections[data.from]);
        connectionPool[channel].add(namedCollections[data.to]);
        connectionPool[channel].forEach(c =>
          c.send(`Confirmed! ${data.from} connects to ${data.to}`)
        );
      } else {
        namedCollections[data.from].send(`Sorry, ${data.to} is not online`);
      }
    }
    if (data.type === 'join') {
      if (!connectionPool[data.channel]) {
        connectionPool[data.channel] = new Set();
      }
      connectionPool[data.channel].add(namedCollections[data.from]);
      namedCollections[data.from].send(
        `Confirmed! You join the channel ${data.channel}`
      );
    }
  });
})();

const originIsAllowed = (origin: string) => {
  return true;
};

const httpServer = http.createServer((request, response) => {
  console.log(`${new Date()} ${appId} Received request for ${request.url}`);
  // block all non-ws requests?
  response.writeHead(404);
  response.end();
});

httpServer.listen(8080, () => {
  console.log(`${new Date()} ${appId} Server is listening on port 8080`);
});

const wsServer = new WebSocketServer({
  httpServer,
  autoAcceptConnections: false,
});

const logPrefix = () => {
  return `${new Date()} Server: ${appId}`;
};

wsServer.on('request', (req: request) => {
  if (!originIsAllowed(req.origin)) {
    req.reject();
    console.log(`${logPrefix()} Connection from origin ${req.origin} rejected`);
    return;
  }

  const connection = req.accept('echo-protocol', req.origin);
  console.log(`${logPrefix()} Connection from origin ${req.origin} accepted.`);
  connection.on('message', message => {
    if (message.type === 'utf8') {
      console.log(`${logPrefix()} Received Message: ${message.utf8Data}`);
      const data = JSON.parse(message.utf8Data);
      if (data.type) {
        publisher.publish('admin', message.utf8Data);
      } else {
        publisher.publish('livechat', message.utf8Data);
      }
    } else if (message.type === 'binary') {
      console.log(
        `${logPrefix()} Received Binary Message of ${
          message.binaryData.length
        } bytes`
      );
      publisher.publish('livechat', message.binaryData);
    }
  });

  connection.on('close', (reasonCode, description) => {
    console.log(`${logPrefix()} Peer connection.remoteAddress disconnected.`);
  });
  namedCollections[req.origin] = connection;
  connectionPool['livechat'].add(connection);
});
