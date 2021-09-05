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
        darkishgray: '#585b5c',
        darkgray: '#3c3e3e',
        darkgreen: '#354e35',
        darkergray: '#2c2f2e',
        offwhite: '#b7ab98',
        greenish: '#5cc258',
        dark: '#353535',
        darker: '#26292a',
        green: '#248437',
        blue: '#186586',
        brown: '#8f5a05',
        yellow: '#d9bb36',
        purple: '#7d2b7b',
        red: '#b82815',
        gray: '#c4c4c4',
        'facebook-blue': '#4267b2',
        'zoom-blue': '#2d8cff'
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
