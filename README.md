# Share the Load API

## Usage

Create a _run.sh_ file in your home directory and include the following:

```js
export CLIENT_BASE_URL="http://localhost:8100"
export MYSQL_DATABASE="share_the_load"
export MYSQL_USER="root"
export MYSQL_PASSWORD="*your password*"
export MYSQL_HOST="localhost"
export LOG_LEVEL="debug"
export JWT_HMAC_SECRET="adf90i0932rif90efv423"

npm start
```

## Starting the api

_sh run.sh_
