const common = {
  require: ['tests/e2e/support/**/*.js', 'tests/e2e/steps/**/*.js'],
  format: [
    'progress-bar',
    'html:tests/e2e/reports/cucumber-report.html',
    'json:tests/e2e/reports/cucumber-results.json',
  ],
  formatOptions: {
    snippetInterface: 'async-await',
  },
  failFast: true,
};

module.exports = {
  default: {
    ...common,
    paths: ['tests/e2e/features/**/*.feature'],
    worldParameters: {
      appUrl: 'http://localhost:4401',
      environment: 'native',
    },
  },
  native: {
    ...common,
    paths: ['tests/e2e/features/**/*.feature'],
    worldParameters: {
      appUrl: 'http://localhost:4401',
      environment: 'native',
    },
  },
  docker: {
    ...common,
    paths: ['tests/e2e/features/**/*.feature'],
    worldParameters: {
      appUrl: 'http://localhost:4420',
      environment: 'docker',
    },
  },
  ci: {
    ...common,
    paths: ['tests/e2e/features/**/*.feature'],
    parallel: 1,
    worldParameters: {
      appUrl: 'http://localhost:4420',
      environment: 'ci',
      useMocks: true,
    },
  },
};
