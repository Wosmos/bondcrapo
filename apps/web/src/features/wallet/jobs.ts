import { jobMap, type Job } from "@bondcheck/ingest";

/** Lane C: add the `wallet-notify` job here (it needs the web push credentials). */
const walletJobList: Job[] = [];

export const walletJobs = jobMap(walletJobList);
