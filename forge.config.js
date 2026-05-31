module.exports = {
  packagerConfig: {
    asar: true,
    prune: true,
  },

  rebuildConfig: {},

  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: "BookIt",
        authors: "Iqbal Ussain",
        exe: 'BookIt.exe',
        // Installer icon
        iconUrl: 'https://via.placeholder.com/256',
        // Setup icon  
        setupIcon: './build/icon.ico',
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    },
  ],

  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    },

    new (require('@electron-forge/plugin-fuses').FusesPlugin)({
      version: require('@electron/fuses').FuseVersion.V1,
      [require('@electron/fuses').FuseV1Options.RunAsNode]: false,
      [require('@electron/fuses').FuseV1Options.EnableCookieEncryption]: true,
      [require('@electron/fuses').FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [require('@electron/fuses').FuseV1Options.EnableNodeCliInspectArguments]: false,
      [require('@electron/fuses').FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [require('@electron/fuses').FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};