import { randomUUID } from 'node:crypto';
import { link, open, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export interface AuthoringAssetPersistence {
  create(file: string, assetDbUrl: string, contents: string): Promise<void>;
  save(file: string, assetDbUrl: string, contents: string): Promise<void>;
  move(sourceFile: string, sourceAssetDbUrl: string, targetFile: string, targetAssetDbUrl: string): Promise<void>;
  delete(file: string, assetDbUrl: string): Promise<void>;
  deleteDirectory(directory: string, assetDbUrl: string): Promise<void>;
}

export class FileSystemAuthoringAssetPersistence implements AuthoringAssetPersistence {
  async create(file: string, _assetDbUrl: string, contents: string): Promise<void> {
    await atomicWriteFile(file, contents, false);
  }

  async save(file: string, _assetDbUrl: string, contents: string): Promise<void> {
    await atomicWriteFile(file, contents);
  }

  async move(sourceFile: string, _sourceAssetDbUrl: string, targetFile: string, _targetAssetDbUrl: string): Promise<void> {
    await rename(sourceFile, targetFile);
  }

  async delete(file: string, _assetDbUrl: string): Promise<void> {
    await rm(file);
  }

  async deleteDirectory(directory: string, _assetDbUrl: string): Promise<void> {
    await rm(directory, { recursive: true });
  }
}

export class AssetDbAuthoringAssetPersistence implements AuthoringAssetPersistence {
  async create(file: string, assetDbUrl: string, contents: string): Promise<void> {
    await atomicWriteFile(file, contents, false);
    try {
      await Editor.Message.request('asset-db', 'refresh-asset', file);
      await waitForImportedUniversalAsset(file, assetDbUrl);
    } catch (error) {
      await rollbackCreatedAsset(file);
      const reason = error instanceof Error ? `: ${error.message}` : '';
      throw new Error(`Failed to create Cyclo authoring UniversalAsset ${assetDbUrl}${reason}`, { cause: error });
    }
  }

  async save(file: string, assetDbUrl: string, contents: string): Promise<void> {
    const info = await waitForImportedUniversalAsset(file, assetDbUrl);
    const saved = await Editor.Message.request('asset-db', 'save-asset', info.uuid, contents);
    if (saved === null) {
      throw new Error(`AssetDB did not save the Cyclo authoring UniversalAsset: ${assetDbUrl}`);
    }
    await waitForImportedUniversalAsset(file, assetDbUrl);
  }

  async move(
    _sourceFile: string,
    sourceAssetDbUrl: string,
    targetFile: string,
    targetAssetDbUrl: string,
  ): Promise<void> {
    await Editor.Message.request('asset-db', 'move-asset', sourceAssetDbUrl, targetAssetDbUrl);
    if (targetFile.endsWith('.asset')) {
      await waitForImportedUniversalAsset(targetFile, targetAssetDbUrl);
    } else {
      await waitForAssetDbEntry(targetFile, targetAssetDbUrl);
    }
  }

  async delete(file: string, assetDbUrl: string): Promise<void> {
    const info = await waitForImportedUniversalAsset(file, assetDbUrl);
    const deleted = await Editor.Message.request('asset-db', 'delete-asset', info.uuid);
    if (deleted === null) {
      throw new Error(`AssetDB did not delete the Cyclo authoring UniversalAsset: ${assetDbUrl}`);
    }
  }

  async deleteDirectory(_directory: string, assetDbUrl: string): Promise<void> {
    const deleted = await Editor.Message.request('asset-db', 'delete-asset', assetDbUrl);
    if (deleted === null) {
      throw new Error(`AssetDB did not delete the Cyclo technical BundleRoot: ${assetDbUrl}`);
    }
  }
}

interface ImportedUniversalAsset {
  readonly uuid: string;
}

async function waitForImportedUniversalAsset(
  file: string,
  assetDbUrl: string,
): Promise<ImportedUniversalAsset> {
  const deadline = Date.now() + 15_000;
  let lastImporter = '<missing>';
  while (Date.now() < deadline) {
    const info = await Editor.Message.request('asset-db', 'query-asset-info', file);
    if (info !== null) {
      lastImporter = info.importer;
      if (info.imported) {
        if (info.importer !== 'universal-asset') {
          throw new Error(`AssetDB selected importer ${info.importer} instead of universal-asset`);
        }
        return info;
      }
    }
    await delay(50);
  }
  throw new Error(`AssetDB did not finish importing ${assetDbUrl}; last importer was ${lastImporter}`);
}

async function waitForAssetDbEntry(file: string, assetDbUrl: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await Editor.Message.request('asset-db', 'query-asset-info', file) !== null) {
      return;
    }
    await delay(50);
  }
  throw new Error(`AssetDB did not finish moving the Cyclo path to ${assetDbUrl}`);
}

async function rollbackCreatedAsset(file: string): Promise<void> {
  const info = await Editor.Message.request('asset-db', 'query-asset-info', file);
  if (info !== null) {
    const deleted = await Editor.Message.request('asset-db', 'delete-asset', info.uuid);
    if (deleted !== null) {
      return;
    }
  }
  await rm(file, { force: true });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function atomicWriteFile(file: string, contents: string, replace = true): Promise<void> {
  const temporaryFile = join(
    dirname(file),
    `.${basename(file)}.${randomUUID()}.tmp`,
  );
  const handle = await open(temporaryFile, 'wx');
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    if (replace) {
      await rename(temporaryFile, file);
    } else {
      await link(temporaryFile, file);
      await rm(temporaryFile);
    }
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw error;
  }
}
