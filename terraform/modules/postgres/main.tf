terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "3.81.0"
    }
  }
}

resource "google_sql_database_instance" "default" {
  name   = var.database.host
  database_version = "POSTGRES_13"
  deletion_protection  = true
  settings {
    tier = "db-f1-micro"
    backup_configuration {
      enabled = true
      start_time = "23:00"
    }
    maintenance_window {
      day = 7
      hour = 22
      update_track = "stable"
    }
  }
}

data "google_sql_ca_certs" "datapass" {
  instance    = google_sql_database_instance.default.name
}

resource "google_project_service" "api" {
  service = "sqladmin.googleapis.com"
}

resource "google_project_iam_member" "bucketman" {
  role = "roles/cloudsql.admin"
  member = "serviceAccount:${var.servicer}"
}

resource "google_sql_database" "default" {
  name     = var.database.db
  instance = google_sql_database_instance.default.name
}

resource "google_sql_user" "users" {
  name     = var.database.user
  instance = google_sql_database_instance.default.name
  password = var.database.password
}