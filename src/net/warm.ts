import { NO_P2P } from "./net";

const WARM_DOC = "<script>try{new RTCPeerConnection().close()}finally{parent.postMessage(0,'*')}</script>";

/**
 * Chrome sets WebRTC up inside the first `RTCPeerConnection` of a browser launch and holds the calling thread for
 * about half a second while it does; every one after takes a few milliseconds, in any tab. Left to trystero that
 * first one comes with the first peer's announce, seconds into Home, and freezes a drag or a drive.
 *
 * A sandboxed frame has its own origin, so Chrome runs it in its own process and the wait lands there. A browser that
 * keeps the frame in this process pays it here instead, under the loading screen.
 */
export function warm_rtc() {
  if (NO_P2P) return;
  const frame = document.createElement("iframe");
  frame.sandbox.add("allow-scripts");
  frame.hidden = true;
  frame.srcdoc = WARM_DOC;
  const done = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow) return;
    removeEventListener("message", done);
    frame.remove();
  };
  addEventListener("message", done);
  document.body.append(frame);
}
