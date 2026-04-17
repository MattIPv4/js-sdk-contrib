import { ClientProviderEvents, FlagNotFoundError, ParseError } from '@openfeature/web-sdk';
import { LocalStorageProvider } from './localstorage-provider';

describe('LocalStorage Provider', () => {
  const localStorageProvider = new LocalStorageProvider();

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    localStorage.clear();
  });

  it('should match the expected metadata name', () => {
    expect(localStorageProvider.metadata.name).toBe('localStorage');
  });

  describe('resolveBooleanEvaluation', () => {
    it('should return true', () => {
      localStorage.setItem('openfeature.bool-value', 'true');
      expect(localStorageProvider.resolveBooleanEvaluation('bool-value')).toMatchObject({
        reason: 'STATIC',
        value: true,
      });
    });

    it('should return false', () => {
      localStorage.setItem('openfeature.bool-value', 'false');
      expect(localStorageProvider.resolveBooleanEvaluation('bool-value')).toMatchObject({
        reason: 'STATIC',
        value: false,
      });
    });

    it('should throw because the value was the wrong type', () => {
      localStorage.setItem('openfeature.bool-value', 'invalid');
      expect(() => localStorageProvider.resolveBooleanEvaluation('bool-value')).toThrow(ParseError);
    });
  });

  describe('resolveNumberEvaluation', () => {
    it('should return an integer', () => {
      localStorage.setItem('openfeature.num-value', '1');
      expect(localStorageProvider.resolveNumberEvaluation('num-value')).toMatchObject({
        reason: 'STATIC',
        value: 1,
      });
    });

    it('should return a float', () => {
      localStorage.setItem('openfeature.num-value', '1.25');
      expect(localStorageProvider.resolveNumberEvaluation('num-value')).toMatchObject({
        reason: 'STATIC',
        value: 1.25,
      });
    });

    it('should throw because the value was the wrong type', () => {
      localStorage.setItem('openfeature.num-value', 'invalid');
      expect(() => localStorageProvider.resolveNumberEvaluation('num-value')).toThrow(ParseError);
    });
  });

  describe('resolveStringEvaluation', () => {
    it('should return a string', () => {
      localStorage.setItem('openfeature.str-value', 'openfeature');
      expect(localStorageProvider.resolveStringEvaluation('str-value')).toMatchObject({
        reason: 'STATIC',
        value: 'openfeature',
      });
    });
  });

  describe('resolveObjectEvaluation', () => {
    it('should return a boolean', () => {
      localStorage.setItem('openfeature.obj-value', 'true');
      expect(localStorageProvider.resolveObjectEvaluation('obj-value')).toMatchObject({
        reason: 'STATIC',
        value: true,
      });
    });

    it('should return a number', () => {
      localStorage.setItem('openfeature.obj-value', '1');
      expect(localStorageProvider.resolveObjectEvaluation('obj-value')).toMatchObject({
        reason: 'STATIC',
        value: 1,
      });
    });

    it('should return a string', () => {
      localStorage.setItem('openfeature.obj-value', '"openfeature"');
      expect(localStorageProvider.resolveObjectEvaluation('obj-value')).toMatchObject({
        reason: 'STATIC',
        value: 'openfeature',
      });
    });

    it('should return an object', () => {
      localStorage.setItem('openfeature.obj-value', '{"name": "openfeature"}');
      expect(localStorageProvider.resolveObjectEvaluation('obj-value')).toMatchObject({
        reason: 'STATIC',
        value: { name: 'openfeature' },
      });
    });

    it('should return an array', () => {
      localStorage.setItem('openfeature.obj-value', '["openfeature"]');
      expect(localStorageProvider.resolveObjectEvaluation('obj-value')).toMatchObject({
        reason: 'STATIC',
        value: ['openfeature'],
      });
    });
  });

  describe('options.prefix', () => {
    it('should find a flag when the prefix is empty', () => {
      const localStorageProviderCustomPrefix = new LocalStorageProvider({ prefix: '' });
      localStorage.setItem('bool-value', 'true');
      expect(localStorageProviderCustomPrefix.resolveBooleanEvaluation('bool-value')).toMatchObject({
        reason: 'STATIC',
        value: true,
      });
    });

    it('should find a flag when the prefix is custom', () => {
      const localStorageProviderCustomPrefix = new LocalStorageProvider({ prefix: 'custom.' });
      localStorage.setItem('custom.bool-value', 'true');
      expect(localStorageProviderCustomPrefix.resolveBooleanEvaluation('bool-value')).toMatchObject({
        reason: 'STATIC',
        value: true,
      });
    });

    it('should not find a flag when the prefix does not match', () => {
      const localStorageProviderCustomPrefix = new LocalStorageProvider({ prefix: 'custom.' });
      localStorage.setItem('bool-value', 'true');
      expect(() => localStorageProviderCustomPrefix.resolveBooleanEvaluation('bool-value')).toThrow(FlagNotFoundError);
    });
  });

  describe('options.pollInterval', () => {
    it('should start polling on initialize', async () => {
      const provider = new LocalStorageProvider({ pollInterval: 1000 });
      await provider.initialize();

      localStorage.setItem('openfeature.flag1', 'true');

      const handler = jest.fn();
      provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, handler);

      jest.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledTimes(1);

      await provider.onClose();
    });

    it('should not start polling when pollInterval is negative', async () => {
      const provider = new LocalStorageProvider({ pollInterval: -1 });
      await provider.initialize();

      localStorage.setItem('openfeature.flag1', 'true');

      const handler = jest.fn();
      provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, handler);

      jest.advanceTimersByTime(60000);
      expect(handler).not.toHaveBeenCalled();

      await provider.onClose();
    });

    it('should stop polling on close', async () => {
      const provider = new LocalStorageProvider({ pollInterval: 1000 });
      await provider.initialize();
      await provider.onClose();

      localStorage.setItem('openfeature.flag1', 'true');

      const handler = jest.fn();
      provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, handler);

      jest.advanceTimersByTime(5000);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should emit ConfigurationChanged when a flag value changes', async () => {
      const provider = new LocalStorageProvider({ pollInterval: 1000 });
      localStorage.setItem('openfeature.flag1', 'value1');
      await provider.initialize();

      const handler = jest.fn();
      provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, handler);

      localStorage.setItem('openfeature.flag1', 'value2');
      jest.advanceTimersByTime(1000);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Flags updated',
          flagsChanged: expect.arrayContaining(['flag1']),
        }),
      );

      await provider.onClose();
    });

    it('should emit ConfigurationChanged when a new flag is added', async () => {
      const provider = new LocalStorageProvider({ pollInterval: 1000 });
      await provider.initialize();

      const handler = jest.fn();
      provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, handler);

      localStorage.setItem('openfeature.new-flag', 'hello');
      jest.advanceTimersByTime(1000);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          flagsChanged: expect.arrayContaining(['new-flag']),
        }),
      );

      await provider.onClose();
    });

    it('should emit ConfigurationChanged when a flag is removed', async () => {
      const provider = new LocalStorageProvider({ pollInterval: 1000 });
      localStorage.setItem('openfeature.flag1', 'value1');
      await provider.initialize();

      const handler = jest.fn();
      provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, handler);

      localStorage.removeItem('openfeature.flag1');
      jest.advanceTimersByTime(1000);

      expect(handler).toHaveBeenCalledTimes(1);

      await provider.onClose();
    });

    it('should not emit ConfigurationChanged when nothing changes', async () => {
      const provider = new LocalStorageProvider({ pollInterval: 1000 });
      localStorage.setItem('openfeature.flag1', 'value1');
      await provider.initialize();

      const handler = jest.fn();
      provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, handler);

      jest.advanceTimersByTime(5000);
      expect(handler).not.toHaveBeenCalled();

      await provider.onClose();
    });

    it('should use the default poll interval of 30000ms', async () => {
      const provider = new LocalStorageProvider();
      await provider.initialize();

      localStorage.setItem('openfeature.flag1', 'true');

      const handler = jest.fn();
      provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, handler);

      jest.advanceTimersByTime(29999);
      expect(handler).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(handler).toHaveBeenCalledTimes(1);

      await provider.onClose();
    });

    it('should only emit for flags matching the configured prefix', async () => {
      const provider = new LocalStorageProvider({ prefix: 'custom.', pollInterval: 1000 });
      await provider.initialize();

      const handler = jest.fn();
      provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, handler);

      localStorage.setItem('openfeature.flag1', 'true');
      jest.advanceTimersByTime(1000);
      expect(handler).not.toHaveBeenCalled();

      localStorage.setItem('custom.flag1', 'true');
      jest.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledTimes(1);

      await provider.onClose();
    });

    it('should only emit once for a flag that has changed once', async () => {
      const provider = new LocalStorageProvider({ prefix: 'custom.', pollInterval: 1000 });
      await provider.initialize();

      const handler = jest.fn();
      provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, handler);

      localStorage.setItem('custom.flag1', 'true');
      jest.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(5000);
      expect(handler).toHaveBeenCalledTimes(1);

      await provider.onClose();
    });

    it('should detect multiple consecutive changes across intervals', async () => {
      const provider = new LocalStorageProvider({ pollInterval: 1000 });
      await provider.initialize();

      const handler = jest.fn();
      provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, handler);

      localStorage.setItem('openfeature.flag1', 'a');
      jest.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledTimes(1);

      localStorage.setItem('openfeature.flag1', 'b');
      jest.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledTimes(2);

      await provider.onClose();
    });
  });
});
