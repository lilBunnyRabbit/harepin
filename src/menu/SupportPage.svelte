<script lang="ts">
  import { DEVICES, detect_device } from "./device";
  import { issue_link, short_agent, type IssueFields } from "./issue-link";
  import { QualityMode } from "./prefs";
  import Card from "./ui/Card.svelte";
  import Row from "./ui/Row.svelte";
  import RowList from "./ui/RowList.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  const KINDS = [
    { template: "bug.yml", icon: "icon-bug", title: "Report a bug", note: "Something broke, glitched or doesn't work" },
    { template: "feel.yml", icon: "icon-car", title: "Driving feel", note: "Handling, grip, steering, drifts, the camera" },
    { template: "maps.yml", icon: "icon-globe", title: "Maps and worlds", note: "Roads, terrain, spawns, a spot that looks wrong" },
    { template: "performance.yml", icon: "icon-gauge", title: "Performance", note: "Low frame rate, stutter, long loads" },
    { template: "idea.yml", icon: "icon-idea", title: "Idea or improvement", note: "Something you'd like added or changed" },
  ];

  const FIELD_LABELS: [keyof IssueFields, string][] = [
    ["version", "Version"],
    ["device", "Device"],
    ["input", "Input"],
    ["map", "Map"],
    ["graphics", "Graphics"],
  ];

  let { menu, live }: PageProps = $props();

  const agent = short_agent(navigator.userAgent, navigator.maxTouchPoints);
  const device = $derived(live.live(detect_device));
  const tier = $derived(live.live(() => menu.host.quality_status().tier));
  const fields: IssueFields = $derived({
    version: menu.host.version,
    device: agent,
    input: DEVICES.find(([id]) => id === device)?.[1] ?? device,
    map: menu.host.code ?? `${menu.host.kind} ${menu.host.seed}`,
    graphics: live.prefs.quality === QualityMode.AUTO ? `auto, ${tier}` : tier,
  });
</script>

<div class="support-page">
  <Card class="support-about">
    <SectionHead eyebrow="Work in progress" title="Harepin is still being built" role="page" />
    <p class="support-note">
      I'm still tuning how the cars feel, how fast it runs and how the worlds get built, so things will change and some will
      break. If something feels off, tell me. I read every report.
    </p>
  </Card>

  <Card class="support-list" list>
    <RowList nav label="Open a GitHub issue">
      {#each KINDS as kind (kind.template)}
        <Row label={kind.title} help={kind.note} icon={kind.icon} href={issue_link(kind.template, fields)} external />
      {/each}
    </RowList>
  </Card>

  <Card class="support-sent">
    <p class="support-lead">Each link opens a GitHub issue with this filled in:</p>
    <dl class="support-facts">
      {#each FIELD_LABELS as [key, label] (key)}
        <dt>{label}</dt>
        <dd>{fields[key]}</dd>
      {/each}
    </dl>
    <small class="support-caption">Posting needs a GitHub account. Links open in a new tab.</small>
  </Card>
</div>

<style>
  .support-page {
    display: grid;
    grid-template: "about list" auto "sent list" 1fr / minmax(0, 1fr) minmax(0, 1.25fr);
    align-items: start;
    gap: var(--space-5);
  }

  .support-page > :global(.support-about) {
    grid-area: about;
  }

  .support-page > :global(.support-list) {
    grid-area: list;
  }

  .support-page > :global(.support-sent) {
    grid-area: sent;
  }

  .support-note {
    margin: 0;
    max-width: 60ch;
    font-size: var(--text-lg);
    line-height: 1.45;
    text-wrap: pretty;
  }

  .support-lead {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-md);
  }

  .support-facts {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-2) var(--space-5);
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--set-well);
    font-size: var(--text-md);
  }

  .support-facts dt {
    color: var(--set-dim);
  }

  .support-facts dd {
    margin: 0;
    overflow: hidden;
    font-family: var(--font-mono);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .support-caption {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    text-wrap: pretty;
  }

  @media (max-width: 600px) {
    .support-page {
      grid-template: "about" "list" "sent" / minmax(0, 1fr);
    }
  }
</style>
