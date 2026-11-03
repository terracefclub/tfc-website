{ pkgs, config, ... }: {
  languages.javascript = {
    enable = true;
    bun = { enable = true; install.enable = true; };
  };
  languages.typescript.enable = true;
  packages = [ pkgs.postgresql_17 pkgs.git pkgs.glab ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.chromium pkgs.bubblewrap pkgs.gnutar pkgs.lsof pkgs.procps ];
  env.GLAB_CONFIG_DIR = "${config.devenv.state}/glab";
}
