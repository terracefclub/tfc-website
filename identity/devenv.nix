{ pkgs, ... }: {
  languages.javascript = { enable = true; bun.enable = true; };
  packages = [ pkgs.jdk25 pkgs.gnutar pkgs.jq pkgs.coreutils pkgs.lsof ] ++ pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux [ pkgs.procps ];
  env.JAVA_HOME = "${pkgs.jdk25}";
}
