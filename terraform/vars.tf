variable "heroku_email" {
  type        = string
  default     = "schrader.tristan@gmail.com"
  description = "The email for the heroku services account"
}

variable "heroku_api_key" {
  type        = string
  sensitive   = true
  description = "The access key for provisioning heroku resources"
}

variable "postgres_password" {
  type        = string
  sensitive   = true
  description = "The access code for the taproom"
}

variable "gcreds_path" {}
variable "heroku_app" {}
variable "secret_key" {}
variable "mapbox_access_token" {}
variable "gcreds" {}

output "heroku_image" {
  value = module.server.heroku_image
}
output "heroku_dyno" {
  value = module.server.dyno_id
}
output "heroku_url" {
  value = heroku_app.default.web_url
}
output "heroku_redis_config" {
  value = module.cache.cache_config
}
output "cloudsql_certs" {
  value = module.postgres.datapass
}
output "media_bucket_url" {
  value = module.buckets.media_bucket_url
}
output "cloudsql_instance" {
  value = module.postgres.database.connection_name
}