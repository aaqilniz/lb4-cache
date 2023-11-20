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
  getControllerNames,
  kebabCase,
  log
} = require('./utils');

module.exports = async () => {
  let {
    redisDS,
    cacheTTL,
    specURL,
    prefix,
    config,
    openapi
  } = yargs(process.argv.slice(2)).argv;

  if(config && typeof config === 'string') {
    config = JSON.parse(config);
    redisDS = config.redisDS;
    cacheTTL = config.cacheTTL;
    specURL = config.specURL;
    prefix = config.prefix;
  }
  
  if(openapi && typeof openapi === 'string') {
    openapi = JSON.parse(openapi);
    specURL = openapi.url;
    prefix = openapi.prefix;
  }

  if(!prefix) prefix = 'openapi';
  prefix = prefix.replace(/\w+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());

  const invokedFrom = process.cwd();
  const modelConfigs = JSON.stringify(require('./model-config.json'));
  const package = require(`${invokedFrom}/package.json`);

  log(chalk.blue('Confirming if this is a LoopBack 4 project.'));
  if (!isLoopBackApp(package)) throw Error('Not a loopback project');
  log(chalk.bold(chalk.green('OK.')));

  const controllerNames = await getControllerNames(specURL, invokedFrom, prefix);
  log(chalk.blue('Confirming if openapi routes are in place...'));
  
  controllerNames.forEach(controllerName => {
    const controllerPath = `${invokedFrom}/src/controllers/${controllerName}.controller.ts`;
    if (!fs.existsSync(controllerPath)) {
      throw Error('Please run lb4 openapi before this.');
    }
  });
  log(chalk.bold(chalk.green('OK.')));
  
  log(chalk.blue('Confirming if datasource is generated...'));
  const datasourcePath = `${invokedFrom}/src/datasources/${kebabCase(redisDS)}.datasource.ts`;
  if (!fs.existsSync(datasourcePath)) {
    throw Error('Please generate the datasource first.');
  }
  log(chalk.bold(chalk.green('OK.')));

  try {
    const deps = package.dependencies;
    const pkg = '@aaqilniz/rest-cache';
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

    const middlewareDir = `${invokedFrom}/src/middleware`;
    if (!fs.existsSync(middlewareDir)) fs.mkdirSync(middlewareDir);

    const middlewarePath = `${invokedFrom}/src/middleware/cache.middleware.ts`;
    if (!fs.existsSync(middlewarePath)) {
      log(chalk.blue('Creating cache middleware.'));
      fs.copyFileSync(path.join(__dirname, './text-codes/cache.middleware.txt'), middlewarePath);
      log(chalk.bold(chalk.green('OK.')));
    }

    log(chalk.blue('Adding imports to application.ts'));
    const applicationPath = `${invokedFrom}/src/application.ts`;
    addImport(applicationPath, 'import {CacheBindings, CacheComponent} from \'@aaqilniz/rest-cache\';');
    addImport(applicationPath, 'import {CacheStrategyProvider} from \'./providers/cache-strategy.provider\';');
    addImport(applicationPath, 'import {CacheMiddlewareProvider} from \'./middleware/cache.middleware\';');
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

    updateFile(
      applicationPath,
      'this.bind(CacheBindings.CACHE_STRATEGY).toProvider(CacheStrategyProvider);',
      'this.middleware(CacheMiddlewareProvider);'
    );
    log(chalk.bold(chalk.green('OK.')));

    
    log(chalk.blue('Adding new imports to controller.ts'));
    controllerNames.forEach(controllerName => {
      const controllerPath = `${invokedFrom}/src/controllers/${controllerName}.controller.ts`;
      addImport(controllerPath, 'import {cache} from \'@aaqilniz/rest-cache\';');
      updateFile(
        controllerPath,
        '@operation(\'get\'',
        `@cache(${cacheTTL || 60*1000})`,
        true, //add before
        true  // replace all occurances
      );
    });
    log(chalk.green('Everything done.'));
    process.exit(0);
  } catch (error) {
    console.log(error);
    debug(error);
    throw Error('Operation failed.');
  }
}
