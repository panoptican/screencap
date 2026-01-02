import { IpcChannels } from "../../../shared/ipc";
import { refreshRepoMonitor } from "../../features/projectJournal";
import {
	attachRepoToProject,
	detachRepoFromProject,
	generateProjectSummary,
	getProjectGitActivity,
	listReposForProject,
} from "../../features/projectJournal/ProjectJournalService";
import { secureHandle } from "../secure";
import {
	ipcProjectJournalAttachRepoArgs,
	ipcProjectJournalDetachRepoArgs,
	ipcProjectJournalGenerateSummaryArgs,
	ipcProjectJournalGetActivityArgs,
	ipcProjectJournalListReposArgs,
} from "../validation";

export function registerProjectJournalHandlers(): void {
	secureHandle(
		IpcChannels.ProjectJournal.ListRepos,
		ipcProjectJournalListReposArgs,
		(projectName: string) => {
			return listReposForProject(projectName);
		},
	);

	secureHandle(
		IpcChannels.ProjectJournal.AttachRepo,
		ipcProjectJournalAttachRepoArgs,
		async (projectName: string, path: string) => {
			const repo = await attachRepoToProject({ projectName, path });
			refreshRepoMonitor();
			return repo;
		},
	);

	secureHandle(
		IpcChannels.ProjectJournal.DetachRepo,
		ipcProjectJournalDetachRepoArgs,
		(repoId: string) => {
			detachRepoFromProject(repoId);
			refreshRepoMonitor();
		},
	);

	secureHandle(
		IpcChannels.ProjectJournal.GetActivity,
		ipcProjectJournalGetActivityArgs,
		async (options: {
			projectName: string;
			startAt: number;
			endAt: number;
			limitPerRepo?: number;
		}) => {
			return await getProjectGitActivity(options);
		},
	);

	secureHandle(
		IpcChannels.ProjectJournal.GenerateSummary,
		ipcProjectJournalGenerateSummaryArgs,
		async (options: {
			projectName: string;
			startAt: number;
			endAt: number;
		}) => {
			return await generateProjectSummary(options);
		},
	);
}
