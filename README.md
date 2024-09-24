# quick-ws

Simple wrapper around native Websocket class for browsers with automatic reconnection.

## Example

Simple example:
```typescript
import QuickWs from 'quick-ws';

const websocketClient = new QuickWs();

websocketClient.onConnectionEstablished((webSocket: WebSocket) => {
  console.log('new websocket connection');
});

websocketClient.onConnectionBroken(() => {
  console.error('WebSocket connection broken and max retries exceeded');
});

websocketClient.onMessageReceived((webSocket: WebSocket, message: string) => {
  console.log(`WebSocket - received new message: ${message}`);
  if (message === 'ping') {
    webSocket.send('pong');
  }
  if (message === 'terminate') {
    console.log('closing connection');
    websocketClient.close();
  }
});

websocketClient.connect('ws://localhost:9999/ws');
```
