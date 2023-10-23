/* eslint-disable no-restricted-globals */
/// <reference no-default-lib="true" />
/// <reference lib="ES2015" />
/// <reference types="@types/sharedworker" />
import ReconnectingWebsocket from 'reconnecting-websocket';
import { FLAG_INFO } from 'vj/constant/message';

console.log('SharedWorker init');

let conn: ReconnectingWebsocket;
let lcookie: string;
let ports: MessagePort[] = [];
interface RequestInitSharedConnPayload {
  type: 'conn';
  cookie: string;
  path: string;
}
interface RequestAckPayload {
  type: 'ack';
  id: string;
}
interface RequestUnloadPayload {
  type: 'unload';
}
type RequestPayload = RequestInitSharedConnPayload | RequestAckPayload | RequestUnloadPayload;
const ack = {};

function broadcastMsg(message: any) {
  for (const p of ports) p.postMessage(message);
}
function initConn(path: string, port: MessagePort, cookie: any) {
  if (cookie !== lcookie) conn?.close();
  else if (conn && conn.readyState === conn.OPEN) return;
  lcookie = cookie;
  console.log('Init connection for', path);
  conn = new ReconnectingWebsocket(path);
  ports.push(port);
  conn.onopen = () => conn.send(cookie);
  conn.onerror = () => broadcastMsg({ type: 'error' });
  conn.onclose = (ev) => broadcastMsg({ type: 'close', error: ev.reason });
  conn.onmessage = (message) => {
    if (process.env.NODE_ENV !== 'production') console.log('SharedWorker.port.onmessage: ', message);
    const payload = JSON.parse(message.data);
    if (payload.event === 'auth') {
      if (['PermissionError', 'PrivilegeError'].includes(payload.error)) {
        broadcastMsg({ type: 'close', error: payload.error });
        conn.close();
      } else {
        console.log('Connected to', path);
        broadcastMsg({ type: 'open' });
      }
    } else {
      broadcastMsg({ type: 'message', payload });
      let acked = false;
      ack[payload.mdoc.id] = () => { acked = true; };
      setTimeout(() => {
        delete ack[payload.mdoc.id];
        if (acked) return;
        if (payload.mdoc.flag & FLAG_INFO) return;
        if (Notification?.permission !== 'granted') {
          console.log('Notification permission denied');
          return;
        }
        // eslint-disable-next-line no-new
        new Notification(
          payload.udoc.uname || 'Hydro Notification',
          {
            tag: `message-${payload.mdoc._id}`,
            icon: payload.udoc.avatarUrl || '/android-chrome-192x192.png',
            body: payload.mdoc.content,
          },
        );
      }, 5000);
    }
  };
}

onconnect = function (e) { // eslint-disable-line no-undef
  const port = e.ports[0];

  port.addEventListener('message', (msg: { data: RequestPayload }) => {
    if (msg.data.type === 'conn') initConn(msg.data.path, port, msg.data.cookie);
    if (msg.data.type === 'ack') ack[msg.data.id]();
    if (msg.data.type === 'unload') ports = ports.filter((i) => i !== port);
  });

  port.start();
};
