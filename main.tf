terraform {
  required_providers {
    heroku    = {
      source  = "heroku/heroku"
      version = "~> 4.0"
    }
    herokux   = {
      source  = "davidji99/herokux"
      version = "0.27.2"
    }
  }
}

provider "heroku" {
  email       = var.heroku_email
  api_key     = var.heroku_api_key
}

provider "herokux" {
  email       = var.heroku_email
  api_key     = var.heroku_api_key
}

resource "herokux_postgres_backup_schedule" "backing_up" {
  postgres_id = heroku_addon.database.id
  hour        = 23
  timezone    = "America/New_York"
}

data "herokux_registry_image" "server" {
  app_id      = heroku_app.default.uuid
  process_type = "web"
  docker_tag  = "dev"
}

resource "herokux_app_container_release" "staging_release" {
  app_id      = heroku_app.default.uuid
  image_id    = data.herokux_registry_image.server.digest
  process_type = "web"
}

resource "heroku_app" "default" {
  name        = var.app_name
  region      = "us"
  stack       = "container"
}

resource "heroku_addon" "database" {
  app         = heroku_app.default.name
  plan        = "heroku-postgresql:hobby-dev"
}

resource "heroku_addon" "cache" {
  app         = heroku_app.default.name
  plan        = "heroku-redis:hobby-dev"
}

resource "herokux_redis_config" "cache_creds" {
  redis_id    = heroku_addon.cache.id
  maxmemory_policy = "allkeys-lru"
}

resource "heroku_formation" "default" {
  app         = heroku_app.default.id
  type        = "web"
  quantity    = 3
  size        = "Standard-1x"
  depends_on  = ["herokux_app_container_release.staging_release"]
}

output "heroku_app_url" {
  value       = "https://${heroku_app.default.name}.herokuapp.com"
}
