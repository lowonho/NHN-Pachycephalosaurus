import { e1 } from "./e1.mjs";
import { e2 } from "./e2.mjs";
import { e3 } from "./e3.mjs";
import { e4 } from "./e4.mjs";
import { e5 } from "./e5.mjs";

export const STAGE_GAMES = Object.freeze(Object.fromEntries(
  [e1, e2, e3, e4, e5].map(stage => [stage.id, stage]),
));
