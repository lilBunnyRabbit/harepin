<script lang="ts">
  import Slider from "../../ui/Slider.svelte";
  import SettingRow from "../SettingRow.svelte";

  interface Props {
    label: string;
    help: string | (() => string);
    value: number;
    onchange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    disabled?: boolean;
  }

  let { label, help, value, onchange, min = 0, max = 100, step = 5, unit = "%", disabled = false }: Props = $props();
</script>

<SettingRow {label} {help} stack adjust={(by) => onchange(Math.max(min, Math.min(max, value + by * step)))} accept={() => {}}>
  <span class="set-slider">
    <Slider {value} {min} {max} {step} {label} {disabled} tabindex={-1} format={(now) => `${Math.round(now)}${unit}`} {onchange} />
  </span>
</SettingRow>

<style>
  .set-slider {
    width: 14rem;
  }
</style>
