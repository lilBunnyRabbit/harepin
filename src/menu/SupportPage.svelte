<script lang="ts">
  import { DEVICES, detect_device } from "./device";
  import { issue_link, short_agent, type IssueFields } from "./issue-link";
  import MenuFrame from "./MenuFrame.svelte";
  import { MenuTab } from "./page";
  import { QualityMode } from "./prefs";
  import Card from "./ui/Card.svelte";
  import Icon from "./ui/Icon.svelte";
  import Row from "./ui/Row.svelte";
  import RowList from "./ui/RowList.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import "./events.css";

  const KINDS = [
    { template: "bug.yml", icon: "icon-bug", title: "Report a bug", note: "Something broke, glitched or doesn't work" },
    { template: "feel.yml", icon: "icon-car", title: "Driving feel", note: "Handling, grip, steering, drifts, the camera" },
    { template: "maps.yml", icon: "icon-globe", title: "Maps and worlds", note: "Roads, terrain, spawns, a spot that looks wrong" },
    { template: "performance.yml", icon: "icon-gauge", title: "Performance", note: "Low frame rate, stutter, long loads" },
    { template: "idea.yml", icon: "icon-idea", title: "Idea or improvement", note: "Something you'd like added or changed" },
  ];

  const FUNDING = [
    { title: "GitHub", icon: "icon-brand-github", note: "Monthly or once", href: "https://github.com/sponsors/lilBunnyRabbit" },
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

<MenuFrame {menu} id={MenuTab.SUPPORT} eyebrow="Settings" title="Support" season={false} veil={0.6} note="Posting needs a GitHub account. Links open in a new tab.">
  <div class="support">
    <div class="support-side">
      <Card label="About Harepin">
        <div class="ev-head">
          <span class="ev-eyebrow">Work in progress</span>
          <h2 class="ev-h2">Harepin is still being built</h2>
        </div>
        <p class="support-note">
          I'm still tuning how the cars feel, how fast it runs and how the worlds get built, so things will change and some will
          break. If something feels off, tell me. I read every report.
        </p>
      </Card>

      <Card label="Chip in">
        <div class="ev-head">
          <span class="ev-eyebrow">Totally optional</span>
          <h2 class="ev-h2">Like Harepin?</h2>
        </div>
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
    </div>

    <Card class="support-report" label="Send feedback">
      <div class="ev-head">
        <span class="ev-eyebrow">Feedback</span>
        <h2 class="ev-h2">Tell me what you found</h2>
      </div>
      <RowList nav label="Open a GitHub issue">
        {#each KINDS as kind (kind.template)}
          <Row label={kind.title} help={kind.note} icon={kind.icon} href={issue_link(kind.template, fields)} external fill />
        {/each}
      </RowList>
      <div class="support-sent">
        <span class="ev-small">Each link opens a GitHub issue with this filled in:</span>
        <dl class="support-facts">
          {#each FIELD_LABELS as [key, label] (key)}
            <dt>{label}</dt>
            <dd>{fields[key]}</dd>
          {/each}
        </dl>
      </div>
    </Card>
  </div>
</MenuFrame>

<style>
  .support {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    align-items: start;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .support-side {
    display: grid;
    gap: var(--gap);
    min-width: 0;
  }

  .support-note {
    margin: 0;
    max-width: 60ch;
    color: var(--dim);
    line-height: 1.45;
    text-wrap: pretty;
  }

  .support-funds {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--gap-sm);
  }

  .support-fund {
    --icon-size: 1.4em;
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    min-width: 0;
    min-height: var(--primary-h);
    padding: var(--gap-sm) var(--gap-md);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--row);
    color: var(--foreground);
    text-decoration: none;
  }

  .support-fund:hover {
    border-color: var(--secondary);
    background: var(--row-on);
  }

  .support-fund:focus-visible {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: var(--space-0);
  }

  .support-fund > :global(svg) {
    flex: none;
    color: var(--secondary);
  }

  .support-fund-text {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .support-fund-text b {
    font-weight: 700;
  }

  .support-fund-text small {
    overflow: hidden;
    color: var(--dim);
    font-size: var(--type-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .support-sent {
    display: grid;
    gap: var(--gap-sm);
  }

  .support-facts {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
    gap: var(--gap-xs) var(--gap-md);
    margin: 0;
    padding: var(--gap-md);
    border-radius: var(--radius-sm);
    background: var(--row);
    font-size: var(--type-small);
  }

  .support-facts dt {
    color: var(--dim);
  }

  .support-facts dd {
    margin: 0;
    overflow: hidden;
    font-family: var(--font-mono);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-height: 500px) {
    .support {
      height: auto;
      overflow: visible;
    }
  }

  @media (max-width: 600px) {
    .support,
    .support-funds {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
