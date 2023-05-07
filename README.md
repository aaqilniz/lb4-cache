# lb4-cache

This is a small cli tool to add caching to an OpenAPI based controllers created in a LoopBack 4 app.
At this point, the CLI only works for OpenAPI based contrllers created with `lb4 openapi`

## Installing

`npm install lb4-cache`

## Prerequisites

- Run the cli in a LoopBack 4 project.
- Run the cli after the OpenAPI based controllers are created using `lb4 openapi`

## How to run

- With default options: `lb4-cache`
- With custom options: `lb4-cache --redisDS redisDataSource --cacheTTL 10 --specURL 'http://localhost:3000/openapi.json'`

### Options

```
--redisDS: pass redis datasource generated with lb4 datasource. This is a required parameter.
--cacheTTL: Pass ttl (in seconds) for caching. Default is 60 seconds. 
--specURL: URL to open api specs. This is requried parameter.

```
