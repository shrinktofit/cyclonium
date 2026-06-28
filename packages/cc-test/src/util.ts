import { evaluateScript as evaluateScript_env } from '#env';

export async function evaluateScript(url: string, type?: string) {
  await evaluateScript_env(url, type);
}
