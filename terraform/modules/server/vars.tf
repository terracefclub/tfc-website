variable "app" {
  description = "The heroku app the server is run on"
}

variable "tier" {
  type = string
  default = "free"
}

variable "node_count" {
  type = number
  default = 1
}

output "heroku_image" {
  value = { 
    for key in ["size", "digest"]: 
    key => data.herokux_registry_image.server[key] 
  }
}

output "dyno_id" {
  value = heroku_formation.default.id
}
