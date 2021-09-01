terraform {
  required_providers {
    heroku = {
      source  = "heroku/heroku"
      version = "4.6.0"
    }
    herokux = {
      source  = "davidji99/herokux"
      version = "0.30.3"
    }
  }
}

data "herokux_addons" "cache" {
  app_id = var.app.uuid
  addon_service_name = "heroku-redis"
}

resource "heroku_addon" "cache" {
  app         = var.app.name
  plan        = var.tier
}

resource "herokux_redis_config" "cache_config" {
  redis_id    = keys(data.herokux_addons.cache.addons)[0]
  maxmemory_policy = "allkeys-lru"
  timeout = 500
}