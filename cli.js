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
  getControllerName,
  log
} = require('./utils');

module.exports = async () => {
  let {
    redisDS,
    cacheTTL,
    specURL,
    config
  } = yargs(process.argv.slice(2)).argv;

  if(config && typeof config === 'string') {
    config = JSON.parse(config);
    redisDS = config.redisDS;
    cacheTTL = config.cacheTTL;
    specURL = config.specURL;
  }
  const invokedFrom = process.cwd();
  const modelConfigs = JSON.stringify(require('./model-config.json'));
  const package = require(`${invokedFrom}/package.json`);


  log(chalk.blue('Confirming if this is a LoopBack 4 project.'));
  if (!isLoopBackApp(package)) throw Error('Not a loopback project');
  log(chalk.bold(chalk.green('OK.')));

  const controllerName = await getControllerName(specURL, invokedFrom)
  const controllerPath = `${invokedFrom}/src/controllers/openapi.${controllerName}.controller.ts`;

  log(chalk.blue('Confirming if openapi routes are in place...'));
  if (!fs.existsSync(controllerPath)) {
    throw Error('Please run lb4 openapi before this.');
  }
  log(chalk.bold(chalk.green('OK.')));

  try {
    const deps = package.dependencies;
    const pkg = 'loopback-api-cache';
    if (!deps[pkg]) {
      await execute(`npm i ${pkg}`, `Installing ${pkg}`);
    }

    const modelPath = `${invokedFrom}/src/models/cache.model.ts`;
    if (!fs.existsSync(modelPath)) {
      await execute(
        `lb4 model -c '${modelConfigs}' --yes`,
        'Creating cache model'
      );
    }

    const repoPath = `${invokedFrom}/src/repositories/cache.repository.ts`;
    if (!fs.existsSync(repoPath)) {
      await execute(
        `lb4 repository -c '{"name":"Cache", "datasource":"${redisDS}", "model":"Cache", "repositoryBaseClass":"DefaultKeyValueRepository"}' --yes`,
        'Creating cache repository'
      );
    }

    const providerDir = `${invokedFrom}/src/providers`;
    if (!fs.existsSync(providerDir)) fs.mkdirSync(providerDir);

    const providerPath = `${invokedFrom}/src/providers/cache-strategy.provider.ts`;
    if (!fs.existsSync(providerPath)) {
      log(chalk.blue('Creating cache provider.'));
      fs.copyFileSync(path.join(__dirname, './text-codes/cache-strategy.provider.txt'), providerPath);
      log(chalk.bold(chalk.green('OK.')));
    }

    const sequencePath = `${invokedFrom}/src/sequence.ts`;
    const file = fs.readFileSync(sequencePath, 'utf8');
    if (file.indexOf('loopback-api-cache') === -1) {
      log(chalk.blue('Rewriting sequence.ts'));
      fs.copyFileSync(path.join(__dirname, './text-codes/sequence.txt'), sequencePath);
      log(chalk.bold(chalk.green('OK.')));
    }

    log(chalk.blue('Adding imports to application.ts'));
    const applicationPath = `${invokedFrom}/src/application.ts`;
    addImport(applicationPath, 'import {CacheBindings, CacheComponent} from \'loopback-api-cache\';');
    addImport(applicationPath, 'import {CacheStrategyProvider} from \'./providers/cache-strategy.provider\';');
    log(chalk.bold(chalk.green('OK.')));

    log(chalk.blue('Updating application.ts'));
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
    log(chalk.bold(chalk.green('OK.')));

    log(chalk.blue('Adding new imports to controller.ts'));
    addImport(controllerPath, 'import {cache} from \'loopback-api-cache\';');

    updateFile(
      controllerPath,
      '@operation(\'get\'',
      `@cache(${cacheTTL || 60})`,
      true, //add before
      true  // replace all occurances
    );
    log(chalk.green('Everything done.'));
    process.exit(0);
  } catch (error) {
    debug(error);
    throw Error('Operation failed.');
  }
}
