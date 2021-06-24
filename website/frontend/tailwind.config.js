// This is a minimal config.
// If you need the full config, get it from here:
// https://unpkg.com/browse/tailwindcss@latest/stubs/defaultConfig.stub.js
module.exports = {
  mode: 'jit',
  purge: [
    '../templates/**/*.html',
  ],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        darkishgray: '#585B5C',
        darkgray: '#3C3E3E',
        darkgreen: '#354E35',
        darkergray: '#2C2F2E',
        offwhite: '#b7ab98',
        greenish: '#5CC258'
      }
    },
  },
  variants: {
    extend: {
      display: ['group-hover']
    },
  },
  plugins: [],
}
