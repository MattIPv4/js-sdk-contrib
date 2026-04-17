import {
  type JsonValue,
  type Provider,
  type ResolutionDetails,
  ClientProviderEvents,
  FlagNotFoundError,
  OpenFeatureEventEmitter,
  ParseError,
  StandardResolutionReasons,
} from '@openfeature/web-sdk';

export type Config = {
  /**
   * Prefix to use when mapping localStorage keys to flag keys.
   * This allows you to avoid potential naming conflicts with other data in localStorage.
   *
   * @default 'openfeature.'
   */
  prefix?: string;
  /**
   * How often, in milliseconds, to check localStorage for changes to flag values.
   * If a negative number is provided, the provider will not poll for localStorage changes.
   *
   * @default 30000
   */
  pollInterval?: number;
};

export class LocalStorageProvider implements Provider {
  metadata = {
    name: 'localStorage',
  };

  readonly runsOn = 'client';
  readonly events = new OpenFeatureEventEmitter();

  private readonly options: Config;
  private pollingIntervalId?: number;
  private pollingSnapshot?: Map<string, string | null>;

  constructor(options: Partial<Config> = {}) {
    this.options = {
      prefix: 'openfeature.',
      pollInterval: 30000,
      ...options,
    };
  }

  hooks = [];

  initialize(): Promise<void> {
    if (this.options.pollInterval !== undefined && this.options.pollInterval >= 0) {
      this.startPolling();
    }
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.stopPolling();
    return Promise.resolve();
  }

  resolveBooleanEvaluation(flagKey: string): ResolutionDetails<boolean> {
    return this.evaluateLocalStorage(flagKey, (value) => {
      switch (value) {
        case 'true':
          return true;
        case 'false':
          return false;
        default:
          throw new ParseError(`Unable to cast '${value}' to a boolean`);
      }
    });
  }

  resolveStringEvaluation(flagKey: string): ResolutionDetails<string> {
    return this.evaluateLocalStorage(flagKey, (value) => value);
  }

  resolveNumberEvaluation(flagKey: string): ResolutionDetails<number> {
    return this.evaluateLocalStorage(flagKey, (value) => {
      const result = Number.parseFloat(value);
      if (Number.isNaN(result)) {
        throw new ParseError(`'${value}' is not a number`);
      }
      return result;
    });
  }

  resolveObjectEvaluation<U extends JsonValue>(flagKey: string): ResolutionDetails<U> {
    return this.evaluateLocalStorage(flagKey, (value) => {
      try {
        return JSON.parse(value);
      } catch (e) {
        throw new ParseError(`Unable to parse '${value}' as JSON`);
      }
    });
  }

  private evaluateLocalStorage<T extends JsonValue>(key: string, parse: (value: string) => T): ResolutionDetails<T> {
    const localStorageKey = `${this.options.prefix ?? ''}${key}`;
    const value = typeof localStorage !== 'undefined' ? localStorage.getItem(localStorageKey) : null;

    if (value === null) {
      throw new FlagNotFoundError(`Unable to find a localStorage entry with the key '${localStorageKey}'`);
    }

    try {
      const parsedValue = parse(value);

      return {
        value: parsedValue,
        reason: StandardResolutionReasons.STATIC,
      };
    } catch (err) {
      if (err instanceof ParseError) {
        throw err;
      }
      const errorMessage = err instanceof Error ? err.message : 'unknown parsing error';
      throw new ParseError(errorMessage);
    }
  }

  private snapshotLocalStorage(): Map<string, string | null> {
    if (typeof localStorage === 'undefined') {
      return new Map<string, string | null>();
    }

    const flags = new Map<string, string | null>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.options.prefix ?? '')) {
        flags.set(key.slice(this.options.prefix?.length), localStorage.getItem(key));
      }
    }

    return flags;
  }

  private startPolling() {
    this.pollingSnapshot = this.snapshotLocalStorage();

    this.pollingIntervalId = setInterval(async () => {
      const previousSnapshot = this.pollingSnapshot;
      if (!previousSnapshot) {
        return;
      }

      const updatedSnapshot = this.snapshotLocalStorage();
      this.pollingSnapshot = updatedSnapshot;

      if (
        previousSnapshot.size === updatedSnapshot.size &&
        previousSnapshot
          .keys()
          .every((key) => updatedSnapshot.has(key) && updatedSnapshot.get(key) === previousSnapshot.get(key))
      ) {
        return;
      }

      this.events?.emit(ClientProviderEvents.ConfigurationChanged, {
        message: 'Flags updated',
        flagsChanged: Array.from(updatedSnapshot.keys()),
      });
    }, this.options.pollInterval) as unknown as number;
  }

  private stopPolling() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
    }
  }
}
