{ pkgs, config, lib, ... }: {
  languages.javascript = {
    enable = true;
    bun = {
      enable = true;
      install.enable = true;
    };
  };
  languages.typescript.enable = true;

  packages = [ pkgs.git pkgs.glab pkgs.gitleaks ];

  # The repo's common Git directory is bare and shared by worktrees. Standard
  # hook installation would mutate every checkout's hooks, so install locally.
  git-hooks.install.enable = false;
  git-hooks.configPath = ".pre-commit-config.yaml";
  git-hooks.hooks = {
    web-check = {
      enable = true;
      name = "web check and tests";
      entry = "web/tools/hook-check";
      language = "system";
      pass_filenames = false;
      files = "^(web/|\\.gitlab-ci\\.yml$|\\.gitlab/legacy-ci\\.yml$|\\.gitignore$)";
    };
    web-staged-secrets = {
      enable = true;
      name = "redacted staged secret scan";
      entry = "web/tools/scan-staged-secrets";
      language = "system";
      pass_filenames = false;
      always_run = true;
    };
  };

  # devenv still schedules its install task when install.enable is false.
  tasks."devenv:git-hooks:install".exec = lib.mkForce "true";

  env.GLAB_CONFIG_DIR = "${config.devenv.state}/glab";
  enterShell = ''
    terrace_git_config_index="''${GIT_CONFIG_COUNT:-0}"
    if ! [[ "$terrace_git_config_index" =~ ^[0-9]+$ ]]; then
      echo "Invalid GIT_CONFIG_COUNT; cannot select Terrace hooks" >&2
      exit 1
    fi
    export "GIT_CONFIG_KEY_''${terrace_git_config_index}=core.hooksPath"
    export "GIT_CONFIG_VALUE_''${terrace_git_config_index}=${config.devenv.root}/.githooks"
    export GIT_CONFIG_COUNT="$((terrace_git_config_index + 1))"
  '';
}
