import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { loadSettings } from "./settings";
import { notifyNewWins, syncDrawReminders } from "./notifications";

export const RESULTS_TASK = "bondcheck.results-check";
/** Android's WorkManager runs it at most this often (minutes); the OS may delay it further. */
const INTERVAL_MINUTES = 6 * 60;

/** Background work: look for new wins and refresh reminders. Must be defined at module scope. */
export async function runResultsCheck(): Promise<BackgroundTask.BackgroundTaskResult> {
  try {
    const settings = await loadSettings();
    if (settings.winAlerts) await notifyNewWins(settings.locale);
    if (settings.drawReminders) await syncDrawReminders(settings.locale, true);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}

if (!TaskManager.isTaskDefined(RESULTS_TASK)) {
  TaskManager.defineTask(RESULTS_TASK, runResultsCheck);
}

/** Registers or removes the periodic task to match the settings. */
export async function configureBackgroundChecks(enabled: boolean): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(RESULTS_TASK);
  if (enabled && !registered) {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    await BackgroundTask.registerTaskAsync(RESULTS_TASK, { minimumInterval: INTERVAL_MINUTES });
  } else if (!enabled && registered) {
    await BackgroundTask.unregisterTaskAsync(RESULTS_TASK);
  }
}
