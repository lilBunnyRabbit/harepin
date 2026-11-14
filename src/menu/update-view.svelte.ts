import type { RemoteVersion } from "../version";

export interface Pending {
  remote: RemoteVersion | null;
  status: string;
  applying: boolean;
}

export class UpdateView {
  pending = $state<Pending | null>(null);
  toast = $state(false);
  /** The release whose story the Updates page shows; null shows the list. */
  reading = $state<string | null>(null);
}
