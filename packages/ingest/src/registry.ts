import { jobMap, type JobMap } from "./job";
import { bondJobs } from "./bonds/jobs";
import { marketJobs } from "./markets/jobs";

/** Jobs runnable from the CLI. (`wallet-notify` lives in the web app, it needs push credentials.) */
export const cliJobs: JobMap = { ...jobMap(bondJobs), ...jobMap(marketJobs) };
