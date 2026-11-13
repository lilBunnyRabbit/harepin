<script lang="ts">
  import { DEVICES, detect_device } from "./device";
  import { issue_link, short_agent, type IssueFields } from "./issue-link";
  import { QualityMode } from "./prefs";
  import Card from "./ui/Card.svelte";
  import Icon from "./ui/Icon.svelte";
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

  const FUNDING = [
    { title: "GitHub", icon: "icon-brand-github", note: "Sponsor monthly or once", href: "https://github.com/sponsors/lilBunnyRabbit" },
    { title: "Coffee", icon: "icon-brand-buymeacoffee", note: "Buy me a coffee", href: "https://buymeacoffee.com/lilBunnyRabbit" },
    { title: "PayPal", icon: "icon-brand-paypal", note: "Any amount", href: "https://www.paypal.me/ThelilBunnyRabbit" },
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

  <Card class="support-back">
    <SectionHead eyebrow="Totally optional" title="Like Harepin?" />
    <p class="support-note">Harepin is free and stays free. If it gave you a good drive and you'd like to chip in, it helps me keep building it. Thank you either way.</p>
    <nav class="support-funds" aria-label="Chip in">
      {#each FUNDING as fund (fund.href)}
        <a class="support-fund" href={fund.href} target="_blank" rel="noopener">
          <Icon name={fund.icon} />
          <span class="support-fund-text">
            <b>{fund.title}</b>
            <small>{fund.note}</small>
          </span>
        </a>
      {/each}
    </nav>
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
    grid-template: "about list" auto "back list" auto "sent list" 1fr / minmax(0, 1fr) minmax(0, 1.25fr);
    align-items: start;
    gap: var(--space-5);
  }

  .support-page > :global(.support-about) {
    grid-area: about;
  }

  .support-page > :global(.support-back) {
    grid-area: back;
    border-color: var(--secondary);
    background: color-mix(in oklch, var(--secondary) 10%, var(--set-panel));
  }

  .support-funds {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
  }

  .support-fund {
    --icon-size: var(--text-xl);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 64px;
    padding: var(--space-3) var(--space-4);
    border: 1px solid color-mix(in oklch, var(--secondary) 55%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--secondary) 14%, var(--set-panel));
    color: var(--foreground);
    text-decoration: none;
  }

  .support-fund:hover {
    border-color: var(--secondary);
    background: color-mix(in oklch, var(--secondary) 26%, var(--set-panel));
  }

  .support-fund:focus-visible {
    outline: 2px solid var(--secondary);
    outline-offset: 2px;
  }

  .support-fund > :global(svg) {
    flex: none;
    color: var(--secondary);
  }

  .support-fund-text {
    display: grid;
    gap: var(--space-0);
    min-width: 0;
  }

  .support-fund-text b {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .support-fund-text small {
    color: var(--set-dim);
    font-size: var(--text-sm);
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
      grid-template: "about" "back" "list" "sent" / minmax(0, 1fr);
    }
  }
</style>
