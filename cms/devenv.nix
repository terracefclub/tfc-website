{ pkgs, config, ... }: {
  languages.javascript = {
    enable = true;
    bun = { enable = true; install.enable = true; };
  };
  languages.typescript.enable = true;
  packages = [ pkgs.postgresql_17 pkgs.git pkgs.glab ];
  env.GLAB_CONFIG_DIR = "${config.devenv.state}/glab";
}
