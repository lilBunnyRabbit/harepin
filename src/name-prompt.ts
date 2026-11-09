import { clean_name } from "./net";
import "./name-prompt.css";

export function ask_name(parent: HTMLElement, suggested: string): Promise<string> {
  const root = document.createElement("div");
  root.className = "name-prompt";
  const form = document.createElement("form");
  form.className = "name-prompt-card";
  form.setAttribute("role", "dialog");
  form.setAttribute("aria-modal", "true");
  form.setAttribute("aria-labelledby", "name-prompt-title");

  const title = document.createElement("h2");
  title.id = "name-prompt-title";
  title.className = "name-prompt-title";
  title.textContent = "Your name";
  const hint = document.createElement("p");
  hint.className = "name-prompt-hint";
  hint.textContent = "Everyone in the room sees it. Change it later in Settings, Lobby.";

  const input = document.createElement("input");
  input.className = "name-prompt-input";
  input.type = "text";
  input.value = suggested;
  input.maxLength = 24;
  input.autocomplete = "off";
  input.enterKeyHint = "go";
  input.setAttribute("aria-labelledby", "name-prompt-title");

  const drive = document.createElement("button");
  drive.className = "name-prompt-drive";
  drive.type = "submit";
  drive.textContent = "Drive";

  const row = document.createElement("div");
  row.className = "name-prompt-row";
  row.append(input, drive);
  form.append(title, hint, row);
  root.append(form);

  return new Promise((resolve) => {
    const done = (name: string) => {
      root.remove();
      resolve(name);
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      done(input.value.trim() ? clean_name(input.value) : suggested);
    });
    root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      done(suggested);
    });
    parent.append(root);
    input.focus();
    input.select();
  });
}
