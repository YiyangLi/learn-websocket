import {client as WebSocketClient, connection, Message} from 'websocket';
import dotenv from 'dotenv';

const isProd = process.env.NODE_ENV !== 'test';
if (isProd) {
  dotenv.config();
}
const wsUrl = process.env.WS_URL || 'ws://localhost:8080';

export default class Client {
  private connection: connection | undefined;
  constructor(
    private username: string,
    messageHandler: (msg: string) => void = console.log,
    private url: string = wsUrl
  ) {
    const client = new WebSocketClient();
    client.on('connect', conn => {
      this.connection = conn;
      this.connection.on('message', (originalMessage: Message) => {
        if (originalMessage.type === 'utf8') {
          messageHandler(originalMessage.utf8Data);
        } else if (originalMessage.type === 'binary') {
          messageHandler(originalMessage.binaryData.toString());
        }
      });
      this.connection.on('close', () => {
        console.log(`${new Date()} echo-protocol Connection Closed`);
        this.connection = undefined;
      });
    });

    client.connect(this.url, 'echo-protocol', this.username);
  }

  join(channel: string): void {
    if (this.connection !== undefined) {
      this.connection.send(
        JSON.stringify({from: this.username, channel, type: 'join'})
      );
    }
  }

  friend(friendName: string): void {
    if (this.connection !== undefined) {
      this.connection.send(
        JSON.stringify({from: this.username, to: friendName, type: 'friend'})
      );
    }
  }

  dm(friend: string, message: string): void {
    const channel = [this.username, friend].sort().join('<->');
    this.send(channel, message);
  }

  send(channel: string, message: string): void {
    if (this.connection !== undefined) {
      this.connection.send(
        JSON.stringify({
          channel,
          message: `${this.username}: ${message}`,
        })
      );
    }
  }

  reconnect() {}
}
