const { execFileSync } = require('child_process');

// electron-builder는 기본 Developer ID 인증서가 없으면 서명을 건너뛰는데,
// Apple Silicon에서는 서명이 전혀 없는 앱은 실행 자체가 거부된다.
// DMG/zip을 만들기 전에 여기서 ad-hoc 서명을 적용해 최종 배포물에 반영되도록 한다.
exports.default = async function afterSign(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  });
};
