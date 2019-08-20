import uWS from 'uWebSockets.js';

import { httpMethods } from './helpers';

export default class App {
  get config() {
    return this._config;
  }
  get host() {
    const { _config: config } = this;
    return config.host;
  }
  get port() {
    const { _config: config } = this;
    return config.port;
  }
  get address() {
    const { _config: config } = this;
    let address = '';
    if (config.host) {
      address += config.https ? 'https://' : 'http://';
      address += config.host;
      address += ':' + config.port;
    }

    return address;
  }
  constructor(config, app, route) {
    this._config = config;
    this._app = app;
    this._route = route;

    this.time = Date.now();

    this._instance = null;

    if (config && config.swagger) {
      this.activateDocs();
    }

    return this;
  }
  activateDocs() {
    this._route._addMethod(
      'get',
      '/docs/swagger.json',
      undefined,
      (req, res) => {
        res.writeHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(this._config.swagger, null, 4));
      }
    );
  }
  setErrorHandler(fn) {
    this._config._errorHandler = fn;

    return this;
  }
  setValidationErrorHandler(fn) {
    this._config._validationErrorHandler = fn;

    return this;
  }
  use(...args) {
    this._route.use(...args);

    return this;
  }
  ws(path, options, fn) {
    this._app.ws(
      path,
      options && options.isRaw ? (ws, req) => fn(req, ws) : fn
    );

    return this;
  }
  listen(port, host) {
    const { _config: config, _app: app } = this;

    // Attach handlers
    this._app.any('*', this._route.run);

    return new Promise((resolve, reject) => {
      if (port === undefined) {
        console.log('[Server]: PORT is required');
        return undefined;
      }
      port = Number(port);
      app.listen(port, host, (token) => {
        if (typeof host === 'string') {
          config.host = host;
        } else {
          config.host = 'localhost';
        }
        if (typeof port === 'number') {
          config.port = port;
        }

        if (token) {
          this._instance = token;
          console.log(
            `[Server]: started successfully at [${
              config.host
            }:${port}] in [${Date.now() - this.time}ms]`
          );
          resolve(this);
        } else {
          console.log(`[Server]: failed to host at [${config.host}:${port}]`);
          reject(
            new Error(`[Server]: failed to host at [${config.host}:${port}]`)
          );
          config.host = null;
          config.port = null;
        }
      });
    });
  }
  close() {
    const { _config: config } = this;

    if (this._instance) {
      config.host = null;
      config.port = null;
      uWS.us_listen_socket_close(this._instance);
      this._instance = null;
      console.log('[Server]: stopped successfully');
      return true;
    } else {
      console.log('[Server]: Error, failed while stopping');
      return false;
    }
  }
}

for (let i = 0, len = httpMethods.length; i < len; i++) {
  const method = httpMethods[i];
  App.prototype[method] = function(path, ...fns) {
    if (fns.length > 0) {
      const isRaw = fns.find((fn) => fn.isRaw === true);
      const schema = fns.find((fn) => fn.schema);

      this._route._addMethod(method, path, schema, fns.pop(), isRaw);
    }
    return this;
  };
}