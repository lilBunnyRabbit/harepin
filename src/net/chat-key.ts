/** T opens the chat anywhere it is free; Enter only where no card's primary shows it as its own key. */
export const opens_chat = (code: string, enter_taken: boolean) => code === "KeyT" || (code === "Enter" && !enter_taken);
