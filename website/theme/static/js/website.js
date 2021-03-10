[...document.getElementsByClassName('nav-drop')].forEach(el => el.addEventListener("click", () => {
  if (el.classList.contains('arrow-r')) {
    el.classList.remove('arrow-r');
    el.classList.add('arrow-d');
  } else if (el.classList.contains('arrow-d')) {
    el.classList.remove('arrow-d');
    el.classList.add('arrow-r');
  }
}))

const sidebar = document.getElementById('sidebar');
const sidebar_x = document.getElementById('sidebar-x');
const sidebar_trigger = document.getElementById('sidebar-trigger');
sidebar_x.addEventListener("click", () => sidebar.classList.add("invisible"));
sidebar_trigger.addEventListener("click", () => sidebar.classList.remove("invisible"));