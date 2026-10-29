{ pkgs, ... }: {
  languages.javascript = { enable = true; bun.enable = true; };
  packages = [ pkgs.jdk25 pkgs.gnutar ];
  env.JAVA_HOME = "${pkgs.jdk25}";
}
