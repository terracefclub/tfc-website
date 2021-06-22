terraform {
  required_providers {
    heroku = {
      source = "heroku/heroku"
      version = "~> 4.0"
    }
  }
}

provider "heroku" {
  email       = var.heroku_email
  api_key     = var.heroku_api_key
}

resource "heroku_app" "default" {
  name        = var.app_name
  region      = "us"
  stack       = "container"
  buildpacks  = [
    "heroku/postgresql",
    "heroku/redis"
  ]
}

resource "heroku_build" "default" {
  app         = heroku_app.default.name

  source {
    url       = ""
    version   = "1.0.0"
    path      = "/app"
  }
}

resource "heroku_formation" "default" {
  app         = heroku_app.default.id
  type        = "web"
  quantity    = 1
  size        = "Standard-1x"
  depends_on  = ["heroku_build.default"]
}

output "heroku_app_url" {
  value = "https://${heroku_app.default.name}.herokuapp.com"
}
