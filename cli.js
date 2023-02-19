const chalk = require('chalk');
const debug = require('debug')('cli');
const yargs = require('yargs/yargs');
const fs = require('fs');
const path = require('path');

const {
  execute,
  isLoopBackApp,
  updateFile,
  addImport,
} = require('./utils');

module.exports = async () => {
  const {
    redisHost,
    redisPort,
    redisPassword,
    redisDb,
    cacheTTL
  } = yargs(process.argv.slice(2)).argv;
  
  const log = console.log;
  const invokedFrom = process.cwd();
  const modelConfigs = JSON.stringify(require('./model-config'));
  const package = require(`${invokedFrom}/package.json`);

  if (!isLoopBackApp(package)) throw Error('Not a loopback project');

  try {
    const deps = package.dependencies;
    const pkg = 'loopback-api-cache';
    if (!deps[pkg]) await execute(`npm i ${pkg}`, `Installing ${pkg}`);
    log(chalk.blue('Confirming if openapi routes are in place...'));
    const openAPIControllerPath = `${invokedFrom}/src/controllers/open-api.controller.ts`;
    if (!fs.existsSync(openAPIControllerPath)) {
      throw Error('Please run lb4 openapi before running this command.');
    }
    log(chalk.bold(chalk.green('OK.')));

    const modelPath = `${invokedFrom}/src/models/cache.model.ts`;
    if (!fs.existsSync(modelPath)) {
      await execute(`lb4 model -c '${modelConfigs}' --yes`, 'model');
    }

    const dsPath = `${invokedFrom}/src/datasources/cache.datasource.ts`;
    if (!fs.existsSync(dsPath)) {
      await execute(
        `lb4 datasource -c '{"name":"cache","connector":"kv-redis","url":"","host":"${redisHost || '127.0.0.1'}","port":"${redisPort || '6379'}","password": "${redisPassword || ''}","db":"${redisDb || 0}"}' -y && yarn build`,
        'datasource'
      );
    }

    const repoPath = `${invokedFrom}/src/repositories/cache.repository.ts`;
    if (!fs.existsSync(repoPath)) {
      await execute(
        `lb4 repository -c '{"name":"Cache", "datasource":"cache", "model":"Cache", "repositoryBaseClass":"DefaultKeyValueRepository"}' --yes`,
        'repository'
      );
    }

    const providerDir = `${invokedFrom}/src/providers`;
    if (!fs.existsSync(providerDir)) fs.mkdirSync(providerDir);

    const providerPath = `${invokedFrom}/src/providers/cache-strategy.provider.ts`;
    if (!fs.existsSync(providerPath)) {
      log(chalk.blue('creating cache provider.'));
      fs.copyFileSync(path.join(__dirname, './text-codes/cache-strategy.provider.txt'), providerPath);
      log(chalk.bold(chalk.green('OK.')));
    }
    
    const sequencePath = `${invokedFrom}/src/sequence.ts`;
    const file = fs.readFileSync(sequencePath, 'utf8');
    if (file.indexOf('loopback-api-cache') === -1) {
      log(chalk.blue('rewriting sequence.ts'));
      console.log('Updating sequence.');
      fs.copyFileSync(path.join(__dirname, './text-codes/sequence.txt'), sequencePath);
      log(chalk.bold(chalk.green('OK.')));
    }

    const applicationPath = `${invokedFrom}/src/application.ts`;
    addImport(applicationPath, 'import {CacheBindings, CacheComponent} from \'loopback-api-cache\';');
    addImport(applicationPath, 'import {CacheStrategyProvider} from \'./providers/cache-strategy.provider\';');

    updateFile(
      applicationPath,
      'super(options);',
      'this.component(CacheComponent);'
    );

    updateFile(
      applicationPath,
      'this.component(CacheComponent);',
      'this.bind(CacheBindings.CACHE_STRATEGY).toProvider(CacheStrategyProvider);'
    );

    const controllerPath = `${invokedFrom}/src/controllers/open-api.controller.ts`;
    addImport(controllerPath, 'import {cache} from \'loopback-api-cache\';');

    updateFile(
      controllerPath,
      '@operation(',
      `@cache(${cacheTTL || 60})`,
      true,
      true
    );
    log(chalk.green('Everything done.'));
    process.exit(0);
  } catch (error) {
    debug(error);
    throw Error('Operation failed.');
  }
}
