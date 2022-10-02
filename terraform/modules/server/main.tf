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

resource "herokux_app_container_release" "staging_release" {
  app_id      = var.app.uuid
  image_id    = data.herokux_registry_image.server.digest
  process_type = "web"
}

resource "heroku_formation" "default" {
  app         = var.app.name
  type        = "web"
  quantity    = var.node_count
  size        = var.tier
  depends_on  = [herokux_app_container_release.staging_release]
}

data "herokux_registry_image" "server" {
  app_id      = var.app.uuid
  process_type = "web"
}

resource "heroku_addon" "monitoring" {
  app = var.app.name
  plan = "newrelic:wayne"
}