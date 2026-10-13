import { agent } from "harmony/ai";
import { summarize } from "./tools";

export default agent({
  name: "librarian",
  instructions: "Help the reader with the shelf. Do not send mail.",
  tools: [summarize],
});
