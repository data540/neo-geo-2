import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "neo-geo",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
