variable "tier" {
  type = string
  default = "heroku-redis:hobby-dev"
  description = "The resource and pricing plan for managing the heroku redis addon"
}

variable "app" {}

output "cache_config" {
  value = {
    uuid = herokux_redis_config.cache_config.redis_id
    config = heroku_addon.cache.config_vars
  }
}