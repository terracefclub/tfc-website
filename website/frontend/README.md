# Jest Configuration 

```
"jest": {
  "moduleFileExtensions": ["ts", "js"],
  "moduleDirectories": [""],
  "moduleNameMapper": {
    "\\.(ico|jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2)$": "<rootDir>/__mocks__/fileMock.js",
    "\\.scss$": "<rootDir>/__mocks__/styleMock.js"
  }
},
```