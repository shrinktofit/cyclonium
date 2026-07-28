import type {
  AssetGroupsExtensionMethods,
  CycloBuildTaskOption,
} from '../asset-groups/panel-contract.js';
import {
  buildCycloContent,
  queryCycloContentBuildTasks,
} from './content-build.js';

export const assetCatalogExtensionMethods: Pick<
  AssetGroupsExtensionMethods,
  'queryCycloBuildTasks' | 'buildCycloContent'
> = {
  async queryCycloBuildTasks(): Promise<readonly CycloBuildTaskOption[]> {
    const tasks = await queryCycloContentBuildTasks();
    return tasks.map((task) => ({
      id: task.id,
      label: task.name,
      platform: task.platform,
    }));
  },

  async buildCycloContent(buildTaskId: string): Promise<void> {
    await buildCycloContent(buildTaskId);
  },
};
