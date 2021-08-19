export ZSH="${HOME}/.oh-my-zsh"
export ZSH_THEME="powerlevel10k/powerlevel10k"

plugins=(git zsh-syntax-highlighting)

source $ZSH/oh-my-zsh.sh

[[ ! -f .devcontainer/.p10k.zsh ]] || source .devcontainer/.p10k.zsh
