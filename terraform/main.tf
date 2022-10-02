terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "3.81.0"
    }
    heroku = {
      source  = "heroku/heroku"
      version = "4.6.0"
    }
    herokux = {
      source  = "davidji99/herokux"
      version = "0.30.3"
    }
  }
  backend "gcs" {
    credentials = "../config/credentials.json"
    bucket = "tfc-secrets"
    prefix = "terraform"
  }
}



provider "google" {
  credentials = file("../config/credentials.json") 
  project = "terracefclub"
  region  = "us-east1"
  zone    = "us-east1-c"
}

provider "heroku" {
  email   = var.heroku_email
  api_key = var.heroku_api_key
}

provider "herokux" {
  api_key = var.heroku_api_key
}



resource "google_service_account" "forkman" {
  account_id   = "forkman"
  description  = "for forking it up"
  display_name = "El Forko"
}

resource "heroku_app" "default" {
  name        = var.heroku_app
  region      = "us"
  stack       = "container"

  config_vars = {
    POSTGRES_DB = module.postgres.database.db
    POSTGRES_USER = module.postgres.database.user
    POSTGRES_HOST = "localhost"
    ALLOWED_HOSTS = "${var.heroku_app}.herokuapp.com"
    NEW_RELIC_APP_NAME = "Flabyrinth Returns"
    SQL_INSTANCE = module.postgres.database.connection_name
  }

  sensitive_config_vars = {
    DATABASE_URL = "postgres://${module.postgres.database.user}:${module.postgres.database.password}@localhost:5432/${module.postgres.database.db}"
    POSTGRES_PASSWORD = module.postgres.database.password
    SECRET_KEY = var.secret_key
    MAPBOX_ACCESS_TOKEN = var.mapbox_access_token
    GOOGLE_CREDENTIALS = var.gcreds
    GOOGLE_APPLICATION_CREDENTIALS = var.gcreds_path
  }
}



module "buckets" {
  source   = "./modules/buckets"
  servicer = google_service_account.forkman.email
}

module "cache" {
  source = "./modules/cache"
  app = heroku_app.default
}

module "postgres" {
  source      = "./modules/postgres"
  servicer = google_service_account.forkman.email
  database = {
    host = "tapinator"
    db = "taproom"
    user = "sqoopboi"
    password = var.postgres_password
  }
}

module "server" {
  source   = "./modules/server"
  app = heroku_app.default
}
