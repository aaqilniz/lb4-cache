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
- With custom options: `lb4-cache --redisHost localhost --redisPort 6379 --redisPassword "" --redisDb 0 --cacheTTL 10`

### Options

```
--specURL: URL to open api specs. This is requried parameter.

--redisHost: pass redis host. Default is 127.0.0.1.

--redisPort: pass redis port. Default is 6379.

--redisUser: pass redis user. Default is root

--redisPassword: pass redis password. Default is empty string.

--cacheTTL: Pass ttl (in seconds) for caching. Default is 60 seconds. 

```
