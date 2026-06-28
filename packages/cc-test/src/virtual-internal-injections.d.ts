declare module 'virtual:cyclo-cc-test/internal-injections' {
  export interface InternalInjections {
    baseURL: string;
    headless: boolean;
  }

  export const internalInjections: InternalInjections;
}
