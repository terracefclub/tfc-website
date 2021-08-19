# Install ZSH
sudo apt-get update
sudo apt-get install -qy --no-install-recommends zsh

# Set ZSH as default
sudo chsh -s /bin/zsh $(whoami)

# Install oh-my-zsh
cd $HOME
curl -fsSL https://github.com/robbyrussell/oh-my-zsh/raw/master/tools/install.sh | zsh || true
cd $BASE_DIR

# Install powerlevel10k theme
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k;

source .devcontainer/.zshrc