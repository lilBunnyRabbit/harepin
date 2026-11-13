export const Device = {
  KEYBOARD: "keyboard",
  PAD: "pad",
  TOUCH: "touch",
} as const;
export type Device = (typeof Device)[keyof typeof Device];

export const DEVICES: [Device, string][] = [
  [Device.KEYBOARD, "Keyboard"],
  [Device.PAD, "Controller"],
  [Device.TOUCH, "Touch"],
];

export function detect_device(): Device {
  if (matchMedia("(pointer: coarse)").matches) return Device.TOUCH;
  if (navigator.getGamepads().some((pad) => pad?.connected)) return Device.PAD;
  return Device.KEYBOARD;
}
