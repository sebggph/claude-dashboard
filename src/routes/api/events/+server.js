// Server-Sent Events: pushes "sessions" events when transcripts change.
import { subscribe } from '#lib/server/watch.js';

export function GET({ request }) {
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (text) => { try { controller.enqueue(enc.encode(text)); } catch { cleanup(); } };
      send('retry: 5000\n: connected\n\n');
      const unsubscribe = subscribe((evt) => send(`event: sessions\ndata: ${JSON.stringify(evt)}\n\n`));
      const ping = setInterval(() => send(': ping\n\n'), 25000); // keeps proxies from closing the stream
      cleanup = () => { clearInterval(ping); unsubscribe(); };
      request.signal.addEventListener('abort', () => { cleanup(); try { controller.close(); } catch { /* already closed */ } });
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' },
  });
}
