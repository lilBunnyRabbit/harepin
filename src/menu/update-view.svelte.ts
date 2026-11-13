import type { RemoteVersion } from "../version";

export interface Pending {
  remote: RemoteVersion | null;
  status: string;
  applying: boolean;
}

export class UpdateView {
  pending = $state<Pending | null>(null);
  toast = $state(false);
}
