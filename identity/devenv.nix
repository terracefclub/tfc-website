{ pkgs, ... }: {
  languages.javascript = { enable = true; bun.enable = true; };
  packages = [ pkgs.jdk25 pkgs.gnutar pkgs.jq pkgs.coreutils ];
  env.JAVA_HOME = "${pkgs.jdk25}";
}
