const { getCredentials, getSearchConfig, validateEnvironment, getDelay } = require('../config.js');

describe('getCredentials', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('throws error when LINKEDIN_EMAIL is missing', () => {
    delete process.env.LINKEDIN_EMAIL;
    delete process.env.LINKEDIN_PASSWORD;
    expect(() => getCredentials()).toThrow('LinkedIn credentials required');
  });

  test('throws error when LINKEDIN_PASSWORD is missing', () => {
    process.env.LINKEDIN_EMAIL = 'test@test.com';
    delete process.env.LINKEDIN_PASSWORD;
    expect(() => getCredentials()).toThrow('LinkedIn credentials required');
  });

  test('returns credentials when both are set', () => {
    process.env.LINKEDIN_EMAIL = 'test@test.com';
    process.env.LINKEDIN_PASSWORD = 'password123';
    const creds = getCredentials();
    expect(creds.email).toBe('test@test.com');
    expect(creds.password).toBe('password123');
  });
});

describe('getSearchConfig', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    process.argv = ['node', 'main.js'];
  });

  afterAll(() => {
    process.argv = originalArgv;
  });

  test('returns default values when no args provided', () => {
    const config = getSearchConfig();
    expect(config.keyword).toBe('developer');
    expect(config.location).toBe('Brazil');
    expect(config.maxPages).toBe(0);
    expect(config.exportCsv).toBe(false);
    expect(config.remoteOnly).toBe(false);
  });

  test('parses --keyword argument', () => {
    process.argv = ['node', 'main.js', '--keyword', 'engineer'];
    const config = getSearchConfig();
    expect(config.keyword).toBe('engineer');
  });

  test('parses -k shorthand argument', () => {
    process.argv = ['node', 'main.js', '-k', 'manager'];
    const config = getSearchConfig();
    expect(config.keyword).toBe('manager');
  });

  test('parses --location argument', () => {
    process.argv = ['node', 'main.js', '--location', 'São Paulo'];
    const config = getSearchConfig();
    expect(config.location).toBe('São Paulo');
  });

  test('parses -l shorthand argument', () => {
    process.argv = ['node', 'main.js', '-l', 'Remote'];
    const config = getSearchConfig();
    expect(config.location).toBe('Remote');
  });

  test('parses --max-pages argument', () => {
    process.argv = ['node', 'main.js', '--max-pages', '5'];
    const config = getSearchConfig();
    expect(config.maxPages).toBe(5);
  });

  test('parses -m shorthand argument', () => {
    process.argv = ['node', 'main.js', '-m', '10'];
    const config = getSearchConfig();
    expect(config.maxPages).toBe(10);
  });

  test('parses --export-csv argument', () => {
    process.argv = ['node', 'main.js', '--export-csv'];
    const config = getSearchConfig();
    expect(config.exportCsv).toBe(true);
  });

  test('parses -e shorthand for export-csv', () => {
    process.argv = ['node', 'main.js', '-e'];
    const config = getSearchConfig();
    expect(config.exportCsv).toBe(true);
  });

  test('parses --remote-only argument', () => {
    process.argv = ['node', 'main.js', '--remote-only'];
    const config = getSearchConfig();
    expect(config.remoteOnly).toBe(true);
  });

  test('parses -r shorthand for remote-only', () => {
    process.argv = ['node', 'main.js', '-r'];
    const config = getSearchConfig();
    expect(config.remoteOnly).toBe(true);
  });

  test('returns false for remote-only when not provided', () => {
    const config = getSearchConfig();
    expect(config.remoteOnly).toBe(false);
  });
});

describe('getDelay', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('returns default 2000ms when env not set', () => {
    delete process.env.REQUEST_DELAY_MS;
    const delay = getDelay();
    expect(delay).toBe(2000);
  });

  test('parses REQUEST_DELAY_MS environment variable', () => {
    process.env.REQUEST_DELAY_MS = '5000';
    const delay = getDelay();
    expect(delay).toBe(5000);
  });
});
