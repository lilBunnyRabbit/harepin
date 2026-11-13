<script lang="ts">
  import { CameraReturn, CameraView, SpeedZoom } from "../prefs";
  import type { MenuState } from "../ui/menu-state.svelte";
  import ChoiceRow from "./rows/ChoiceRow.svelte";
  import ToggleRow from "./rows/ToggleRow.svelte";
  import { CAMERA_RETURN_LABEL, SPEED_ZOOM_LABEL, options, while_driving } from "./sections";

  interface Props {
    live: MenuState;
  }

  let { live }: Props = $props();

  const VIEWS = options([
    [CameraView.CHASE, "Chase"],
    [CameraView.COCKPIT, "Cockpit"],
  ]);
  const RETURNS = Object.values(CameraReturn).map((value) => ({ value, label: CAMERA_RETURN_LABEL[value] }));
  const ZOOMS = Object.values(SpeedZoom).map((value) => ({ value, label: SPEED_ZOOM_LABEL[value] }));
</script>

<ChoiceRow
  label="View"
  help={() => while_driving(live.prefs.bindings, "camera", "Behind the car or from the driver's seat.")}
  value={live.prefs.camera}
  options={VIEWS}
  onchange={(value) => live.set("camera", value)}
/>
<ChoiceRow
  label="Returns after"
  help="After a mouse look, the camera swings back behind the car once it drives."
  value={live.prefs.camera_return}
  options={RETURNS}
  onchange={(value) => live.set("camera_return", value)}
/>
<ChoiceRow
  label="Speed zoom"
  help="How much the view widens and backs off as you go faster."
  value={live.prefs.speed_zoom}
  options={ZOOMS}
  onchange={(value) => live.set("speed_zoom", value)}
/>
<ToggleRow
  label="Camera tilt"
  help="The chase view dips under braking and lifts as you accelerate. It never leans."
  checked={live.prefs.camera_tilt}
  onchange={(value) => live.set("camera_tilt", value)}
/>
<ToggleRow label="Invert camera Y" help="Mouse drag and right stick." checked={live.prefs.invert_y} onchange={(value) => live.set("invert_y", value)} />
