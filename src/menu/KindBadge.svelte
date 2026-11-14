<script lang="ts">
  import { ChangeKind, TEASE, type Highlight } from "../changelog";
  import Badge from "./ui/Badge.svelte";

  interface Props {
    kind: Highlight["kind"];
  }

  let { kind }: Props = $props();

  const KINDS = {
    [ChangeKind.NEW]: { label: "New", tone: "success" },
    [ChangeKind.IMPROVED]: { label: "Improved", tone: "info" },
    [ChangeKind.FIXED]: { label: "Fixed", tone: "warning" },
    [TEASE]: { label: "Locked", tone: "warning" },
  } as const;
</script>

<Badge tone={KINDS[kind].tone}>{KINDS[kind].label}</Badge>
