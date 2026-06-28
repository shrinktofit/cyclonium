export interface BasicDump<TValueDump = {
  [x: string]: Dump;
}> {
  type: string;
  readonly: boolean;
  visible: boolean;
  value: TValueDump;
  extends: string[];
  default?: unknown;
  path?: string;
}

export interface ComponentDump extends BasicDump<Record<string, Dump>> {
  cid: string;
  groups: Record<string, unknown>;
  editor: {
    inspector: string;
    icon: string;
    help: string;
    _showTick: boolean;
  };
}

export interface Dump extends BasicDump<Record<string, Dump>> {
  [x: string]: unknown;
}
