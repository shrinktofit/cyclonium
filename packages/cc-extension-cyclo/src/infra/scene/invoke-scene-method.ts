import { selfPackageName } from '../../self-info.js';

type SceneMethods = typeof import('../../contributions/scene/contribution.js').methods;

export async function invokeSelfSceneMethod<TMethod extends keyof SceneMethods>(method: TMethod, ...args: Parameters<SceneMethods[TMethod]>) {
  return await Editor.Message.request('scene', 'execute-scene-script', {
    name: selfPackageName,
    method,
    args,
  });
}
