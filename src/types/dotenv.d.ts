declare module 'dotenv' {
  export type DotenvConfigOptions = {
    path?: string;
    encoding?: string;
    debug?: boolean;
    override?: boolean;
    processEnv?: Record<string, string>;
  };

  export type DotenvConfigOutput = {
    parsed?: Record<string, string>;
    error?: Error;
  };

  export function config(options?: DotenvConfigOptions): DotenvConfigOutput;
}
