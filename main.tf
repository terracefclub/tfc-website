provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
    // gcloud can be configured here ^ !
  }
}

resource "helm_release" "full_chart" {
  name = "app-release"
  repository = "kubernetes"
  chart = "app"
}