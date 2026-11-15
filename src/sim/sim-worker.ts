import { World } from "../world/world";
import { SimHost } from "./sim-host";
import { packet_size, write_packet, type SimRequest } from "./sim-packet";

let host: SimHost | null = null;
let out = new Float64Array(0);

addEventListener("message", (event: MessageEvent<SimRequest>) => {
  const request = event.data;
  if (request.type === "init") {
    host = new SimHost(new World(request.seed, request.plan, [], request.levels), request.spec);
    return;
  }
  if (!host) throw new Error("sim worker: a frame before init");
  for (const command of request.commands) host.apply(command);
  const frame = host.frame(request.frame);
  const size = packet_size(host.car, host.field_cars);
  if (out.length !== size) out = new Float64Array(size);
  write_packet(out, request.epoch, frame, host.car, host.from, host.field_cars);
  postMessage(out);
});
