import { WHOLE_CAR, type Build, type SlotView } from "../../car/build";

/** Too narrow for a car beside the page: the page takes the screen, no stage. */
const NARROW = "(orientation: portrait) and (max-width: 700px)";

/** How a page sits with the car: beside it, around it in panels the car is framed between, or alone on the scene with no car. */
export type StageRoom = "beside" | "around" | "bare";

export interface RoomStage {
  readonly canvas: Pick<HTMLElement, "hidden">;
  start(view: SlotView): void;
  stop(): void;
  show(build: Build): void;
  aim(view: SlotView): void;
  resize(panels: readonly HTMLElement[]): void;
}

export interface ShowroomHost {
  build(): Build;
  /** The page's panels around the car, each naming its side in `--stage-side`. */
  panels(): HTMLElement[];
}

export type ShowroomWindow = Pick<Window, "addEventListener" | "removeEventListener" | "matchMedia">;

export class Showroom {
  private readonly narrow: MediaQueryList;
  private wanted = false;
  private live = false;
  private room: StageRoom = "beside";
  private view: SlotView = WHOLE_CAR;

  constructor(
    private readonly stage: RoomStage,
    private readonly host: ShowroomHost,
    private readonly win: ShowroomWindow = window,
  ) {
    this.narrow = win.matchMedia(NARROW);
    stage.canvas.hidden = true;
  }

  /** The world's own car hides under a live stage, and in a bare room, which shows the scene with no car at all. */
  get hides_world_car(): boolean {
    return this.live || (this.wanted && this.room === "bare");
  }

  show(room: StageRoom = "beside") {
    this.room = room;
    if (!this.wanted) {
      this.wanted = true;
      this.narrow.addEventListener("change", this.apply);
    }
    this.apply();
  }

  sync() {
    if (this.live) this.stage.show(this.host.build());
  }

  /** Turns the car to `view`: eased while the stage is up, the pose it starts in otherwise. */
  aim(view: SlotView) {
    if (view === this.view) return;
    this.view = view;
    if (this.live) this.stage.aim(view);
  }

  reframe() {
    if (this.live) this.fit();
  }

  hide() {
    if (!this.wanted) return;
    this.wanted = false;
    this.narrow.removeEventListener("change", this.apply);
    this.apply();
  }

  private readonly apply = () => {
    const live = this.wanted && this.room !== "bare" && (this.room === "around" || !this.narrow.matches);
    if (live && !this.live) {
      this.stage.canvas.hidden = false;
      this.stage.start(this.view);
      this.win.addEventListener("resize", this.fit);
    } else if (!live && this.live) {
      this.stage.canvas.hidden = true;
      this.stage.stop();
      this.win.removeEventListener("resize", this.fit);
    }
    this.live = live;
    if (!live) return;
    this.stage.show(this.host.build());
    this.fit();
  };

  private readonly fit = () => {
    this.stage.resize(this.host.panels());
  };
}
