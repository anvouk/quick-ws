export type OnConnectionEstablishedCallback = (ws: WebSocket) => void;
export type OnConnectionBrokenCallback = () => void;
export type OnMessageReceivedCallback = (ws: WebSocket, msg: string) => void;

export type LoggerCallback = (msg: string) => void;

/**
 * Low-level websocket connection abstraction.
 *
 * Automatically retries to establish a new connection on failure up to
 * n times, after which, connection is given up and custom callback is
 * fired.
 */
export class QuickWs {
  private _socket: WebSocket | null = null;

  private _retryTimer: number | null = null;
  private _retryTimeoutBase: number = 2;
  private _retryTimeoutMax: number = 30;
  private _retryTimeoutIncrement: number = 2;
  private _retryTimeoutJitter: number = 2;
  private _currentRetry: number = 0;
  private _maxRetries: number;

  private _onConnectionEstablished: OnConnectionEstablishedCallback | null = null;
  private _onConnectionBroken: OnConnectionBrokenCallback | null = null;
  private _onMessageReceived: OnMessageReceivedCallback | null = null;

  public logDebugCallback: LoggerCallback | null = null;
  public logErrorCallback: LoggerCallback | null = null;

  private _logDebug(msg: string) {
    if (this.logDebugCallback != null) {
      this.logDebugCallback(msg);
    }
  }

  private _logError(msg: string) {
    if (this.logErrorCallback != null) {
      this.logErrorCallback(msg);
    }
  }

  /**
   * Create new ws object.
   * @param maxRetries Max number of retries before giving up.
   */
  public constructor(maxRetries: number = 5) {
    this._maxRetries = maxRetries;
  }

  /**
   * Create a new websocket connection.
   * @param wsUri Websocket endpoint.
   */
  public connect(wsUri: string) {
    this._resetRetries();
    this._reopenSocket(wsUri);
  }

  /**
   * Close websocket connection.
   *
   * See list of codes here https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#status_codes.
   *
   * @param code Reason code.
   * @param reason Reason message.
   */
  public close(code: number = 1005, reason: string = 'clean shutdown') {
    if (this._socket != null) {
      this._resetRetries();
      this._socket.close(code, reason);
      this._socket = null;
    }
  }

  /**
   * Register a callback for websocket connection established.
   */
  public onConnectionEstablished(callback: OnConnectionEstablishedCallback) {
    this._onConnectionEstablished = callback;
  }

  /**
   * Register a callback for websocket connection broken and irrecoverable.
   *
   * When this is called, it means that all connection retries have been
   * exhausted.
   */
  public onConnectionBroken(callback: OnConnectionBrokenCallback) {
    this._onConnectionBroken = callback;
  }

  /**
   * Register a callback for events received through websocket.
   */
  public onMessageReceived(callback: OnMessageReceivedCallback) {
    this._onMessageReceived = callback;
  }

  /**
   * Reset connection counters to default values.
   * @private
   */
  private _resetRetries() {
    this._retryTimeoutBase = 2;
    this._retryTimeoutMax = 30;
    this._retryTimeoutIncrement = 2;
    this._retryTimeoutJitter = 2;
    this._currentRetry = 0;
    if (this._retryTimer != null) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
  }

  /**
   * Open a connection and try to keep it open.
   * @param wsUri Websocket connection URI.
   * @private
   */
  private _reopenSocket(wsUri: string) {
    this._currentRetry++;
    this._logDebug(`attempt ${this._currentRetry}/${this._maxRetries} opening socket to: ${wsUri}`);
    this._socket = new WebSocket(wsUri);

    // connection established
    this._socket.addEventListener('open', (_) => {
      this._resetRetries();
      if (this._onConnectionEstablished != null) {
        this._onConnectionEstablished(this._socket!);
      }
    });

    // when failed to establish connection completely
    this._socket.addEventListener('error', (err) => {
      this._logError(`error: ${JSON.stringify(err)}`);
    });

    // when connection was successfully established and then closed
    this._socket.addEventListener('close', (event) => {
      this._logDebug(`connection closed: ${JSON.stringify(event)}`);
      this._retryConnectionLogic(() => this._reopenSocket(wsUri));
    });

    // when a new message is received from websocket
    this._socket.addEventListener('message', (event) => {
      if (this._onMessageReceived != null) {
        this._onMessageReceived(this._socket!, event.data);
      }
    });
  }

  /**
   * Websocket Reconnection manager.
   * @param callback Function used to create ws connection.
   * @private
   */
  private _retryConnectionLogic(callback: () => void) {
    if (this._currentRetry >= this._maxRetries) {
      this._logError(`connection retries exceeded max retry attempt of ${this._maxRetries}. aborting...`);
      if (this._onConnectionBroken != null) {
        this._onConnectionBroken();
      }
      return;
    }

    const waitTimeSecs = Math.min(this._retryTimeoutBase
      + (this._retryTimeoutIncrement * this._currentRetry)
      + this._getRandomInt(-this._retryTimeoutJitter, this._retryTimeoutJitter)
      , this._retryTimeoutMax);

    this._logDebug(`next connection retry in: ${waitTimeSecs}`);
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      callback();
    }, waitTimeSecs * 1000);
  }

  /**
   * Generate random in between 2 numbers.
   * @returns Rand number.
   * @private
   */
  private _getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
  }
}

export default QuickWs;
