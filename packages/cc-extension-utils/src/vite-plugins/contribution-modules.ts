import { type Plugin } from 'vite';
import { join, parse, relative, basename } from 'node:path';
import crypto from 'node:crypto';

export function contributionModules({
  sourceRoot,
}: {
  sourceRoot?: string;
} = {}): Plugin {
  const contributionModulePattern = /^(.*?)([?&])contribution-script((?:$|&).*)/;
  const resolvedContributionModulePrefix = `\0contribution:`;
  const fileIds = new Set<string>();
  const stripExtension = (filename: string) => {
    const { dir, name } = parse(filename);
    return join(dir, name);
  };
  const makeChunkName = (filename: string) => {
    const hash = crypto
      .createHash('md5')
      .update(filename)
      .digest('hex')
      .slice(0, 6);
    return stripExtension(filename) + `-${hash}`;
  };
  return {
    name: 'contribution-script',

    enforce: 'pre',

    buildStart() {
      fileIds.clear();
    },

    async resolveId(source, importer, options) {
      const match = contributionModulePattern.exec(source);
      if (!match) {
        return;
      }
      const [_, pre, _boundary, post] = match;
      const target = pre + (_boundary && post === '?' ? '?' : '') + post;
      const resolvedTarget = await this.resolve(target, importer, {
        ...options,
        skipSelf: true,
      });
      if (!resolvedTarget) {
        return;
      }
      return resolvedContributionModulePrefix + resolvedTarget.id;
    },

    load(id) {
      if (!id.startsWith(resolvedContributionModulePrefix)) {
        return;
      }
      const target = id.slice(resolvedContributionModulePrefix.length);
      const fileId = this.emitFile({
        type: 'chunk',
        id: target,
        fileName: makeChunkName(sourceRoot ? relative(sourceRoot, target) : basename(target)) + '.cjs',
      });
      fileIds.add(fileId);
      return ``
        + `import { resolve } from 'node:path';\n`
        + `import { fileURLToPath } from 'node:url';\n`
        + `const { from, path } = import.meta.ROLLUP_FILE_URL_${fileId};\n`
        + `const fromFile = from.startsWith('file:') ? fileURLToPath(from) : from;\n`
        + `export default resolve(fromFile, '..', path);\n`;
    },

    resolveFileUrl({ relativePath, referenceId, format }) {
      if (!fileIds.has(referenceId)) {
        return;
      }
      const fromFileExp = format === 'es' ? 'import.meta.url' : '__filename';
      return `{ from: ${fromFileExp}, path: ${JSON.stringify(relativePath)} }`;
    },
  };
}
